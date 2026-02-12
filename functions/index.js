// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
try {
  admin.initializeApp();
} catch (e) {
  console.error("Firebase Admin Init Failed:", e);
}
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const OAuth = require("oauth-1.0a");
const crypto = require("crypto");

const app = express();

// Automatically handle CORS preflight requests
app.use(cors({origin: true}));

// Get API keys from the secure environment configuration
// Helper to safely get config
const getConfig = (envKey, configPath) => {
  if (process.env[envKey]) return process.env[envKey];
  try {
    const parts = configPath.split(".");
    let val = functions.config();
    for (const part of parts) {
      if (!val) return "";
      val = val[part];
    }
    return val || "";
  } catch (e) {
    console.warn(`Config lookup failed for ${configPath}:`, e.message);
    return "";
  }
};

const finnhubApiKey = getConfig("FINNHUB_KEY", "finnhub.key");
const fmpApiKey = getConfig("FMP_KEY", "fmp.key");
const twelveDataApiKey = getConfig("TWELVEDATA_KEY", "twelvedata.key");
// Gemini URL is now constructed dynamically in the proxy function

app.post("/", async (request, response) => {
  try {
    // Verify Firebase Auth Token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return response.status(403)
          .send("Unauthorized: Missing or invalid token");
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      await admin.auth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Token verification failed:", error);
      return response.status(403).send("Unauthorized: Invalid token");
    }

    const {api, endpoint, params, payload} = request.body;

    if (!api) {
      return response.status(400).send("Missing 'api' in request body.");
    }

    let targetUrl;
    const finalParams = params ? `${params}&` : "";

    switch (api) {
      case "finnhub": {
        targetUrl = `https://finnhub.io/api/v1/${endpoint}?${finalParams}token=${finnhubApiKey}`;
        const finnhubResponse = await axios.get(targetUrl);
        return response.status(200).send(finnhubResponse.data);
      }
      case "fmp": {
        targetUrl = `https://financialmodelingprep.com/api/v3/${endpoint}?${finalParams}apikey=${fmpApiKey}`;
        const fmpResponse = await axios.get(targetUrl);
        return response.status(200).send(fmpResponse.data);
      }
      case "twelvedata": {
        targetUrl = `https://api.twelvedata.com/${endpoint}?${finalParams}apikey=${twelveDataApiKey}`;
        const twelveDataResponse = await axios.get(targetUrl);
        return response.status(200).send(twelveDataResponse.data);
      }
      case "gemini": {
        // Construct the URL dynamically using the secure key and requested model
        const model = "gemini-2.5-flash";
        const geminiApiKey = getConfig("GEMINI_KEY", "gemini.key");
        targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}`;
        
        try {
          const geminiResponse = await axios.post(targetUrl, payload, {
            headers: {
              'x-goog-api-key': geminiApiKey,
              'Content-Type': 'application/json'
            }
          });
          return response.status(200).send(geminiResponse.data);
        } catch (apiError) {
          console.error("Gemini API Error:", apiError.response?.data || apiError.message);
          console.error("Gemini API Status:", apiError.response?.status);
          throw apiError; // Re-throw to be caught by the outer catch block
        }
      }
      default:
        return response.status(400).send("Invalid API specified.");
    }
  } catch (error) {
    console.error("Error in API Proxy:", error.message);
    if (error.response) {
        return response.status(error.response.status).send(error.response.data);
    }
    return response.status(500).send("Failed to fetch from the upstream API.");
  }
});

// --- E*TRADE OAUTH 1.0a INTEGRATION ---

// E*TRADE API base URLs (sandbox for development, switch for production)
//const ETRADE_BASE = "https://apisb.etrade.com"; // Sandbox
const ETRADE_BASE = "https://api.etrade.com"; // Production

const etradeConsumerKey = getConfig("ETRADE_KEY", "etrade.key");
const etradeConsumerSecret = getConfig("ETRADE_SECRET", "etrade.secret");

// Create OAuth 1.0a instance
function createOAuth() {
  return OAuth({
    consumer: {key: etradeConsumerKey, secret: etradeConsumerSecret},
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return crypto.createHmac("sha1", key)
          .update(baseString).digest("base64");
    },
  });
}

// Helper: verify Firebase ID token from query param or header
async function verifyUser(req) {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const idToken = authHeader.split("Bearer ")[1];
    return admin.auth().verifyIdToken(idToken);
  }
  // Check query param (used for redirect flows)
  if (req.query.token) {
    return admin.auth().verifyIdToken(req.query.token);
  }
  throw new Error("No auth token provided");
}

// Helper: make a signed OAuth 1.0a request
async function oauthRequest(url, method, token = null) {
  const oauth = createOAuth();
  const requestData = {url, method};
  const headers = oauth.toHeader(
      oauth.authorize(requestData, token || undefined),
  );
  const response = await axios({
    url,
    method,
    headers: {...headers, "Content-Type": "application/json",
      "Accept": "application/json"},
  });
  return response.data;
}

// E*TRADE access control: only allow specific UIDs
const ETRADE_ALLOWED_UIDS = (process.env.ETRADE_ALLOWED_UIDS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

function isEtradeAllowed(uid) {
  // If no allowlist configured, deny all (fail-safe)
  if (ETRADE_ALLOWED_UIDS.length === 0) return false;
  return ETRADE_ALLOWED_UIDS.includes(uid);
}

// Check if user has E*TRADE access (called by frontend to show/hide tab)
app.get("/etrade/check-access", async (req, res) => {
  try {
    const decodedToken = await verifyUser(req);
    return res.status(200).json({allowed: isEtradeAllowed(decodedToken.uid)});
  } catch (error) {
    return res.status(200).json({allowed: false});
  }
});

// 1) Start OAuth: get request token + return auth URL
app.get("/etrade/auth/start", async (req, res) => {
  try {
    const decodedToken = await verifyUser(req);
    const uid = decodedToken.uid;
    if (!isEtradeAllowed(uid)) {
      return res.status(403).json({error: "E*TRADE access not enabled for this account."});
    }

    const oauth = createOAuth();

    // Request token from E*TRADE (oauth_callback=oob is required for out-of-band flow)
    const requestTokenUrl =
        `${ETRADE_BASE}/oauth/request_token`;
    const requestData = {url: requestTokenUrl, method: "GET",
      data: {oauth_callback: "oob"}};
    const authHeader = oauth.toHeader(oauth.authorize(requestData));

    const tokenResponse = await axios.get(requestTokenUrl, {
      headers: {...authHeader,
        "Content-Type": "application/x-www-form-urlencoded"},
      params: {oauth_callback: "oob"},
    });

    // Parse the response (URL-encoded: oauth_token=xxx&oauth_token_secret=yyy)
    const params = new URLSearchParams(tokenResponse.data);
    const oauthToken = params.get("oauth_token");
    const oauthTokenSecret = params.get("oauth_token_secret");

    if (!oauthToken || !oauthTokenSecret) {
      console.error("Unexpected token response:", tokenResponse.data);
      return res.status(500).json({
        error: "Invalid response from E*TRADE",
        detail: tokenResponse.data,
      });
    }

    // Store the request token secret in Firestore (needed for access token exchange)
    const db = admin.firestore();
    await db.collection("users").doc(uid)
        .collection("etrade").doc("oauth_temp").set({
          requestToken: oauthToken,
          requestTokenSecret: oauthTokenSecret,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    // Return the authorization URL for the user to visit
    const authorizeUrl = `https://us.etrade.com/e/t/etws/authorize?key=${etradeConsumerKey}&token=${oauthToken}`;

    return res.status(200).json({authorizeUrl, oauthToken});
  } catch (error) {
    console.error("E*TRADE auth start error:", error.message);
    console.error("E*TRADE auth start detail:",
        error.response?.status, error.response?.data);
    return res.status(500).json({
      error: "Failed to start E*TRADE authorization",
      detail: error.response?.data || error.message,
    });
  }
});

// 2) Complete OAuth: exchange verifier for access token
app.post("/etrade/auth/complete", async (req, res) => {
  try {
    const decodedToken = await verifyUser(req);
    const uid = decodedToken.uid;
    if (!isEtradeAllowed(uid)) {
      return res.status(403).json({error: "E*TRADE access not enabled for this account."});
    }
    const {verifier} = req.body;

    if (!verifier) {
      return res.status(400).json({error: "Missing OAuth verifier code"});
    }

    // Retrieve the stored request token
    const db = admin.firestore();
    const tempDoc = await db.collection("users").doc(uid)
        .collection("etrade").doc("oauth_temp").get();

    if (!tempDoc.exists) {
      return res.status(400).json({
        error: "No pending OAuth session. Please start authorization again.",
      });
    }

    const {requestToken, requestTokenSecret} = tempDoc.data();

    // Exchange for access token
    const oauth = createOAuth();
    const accessTokenUrl = `${ETRADE_BASE}/oauth/access_token`;
    const token = {key: requestToken, secret: requestTokenSecret};
    const requestData = {
      url: accessTokenUrl,
      method: "GET",
      data: {oauth_verifier: verifier},
    };
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    const accessResponse = await axios.get(accessTokenUrl, {
      headers: {...authHeader,
        "Content-Type": "application/x-www-form-urlencoded"},
      params: {oauth_verifier: verifier},
    });

    // Parse access token response
    const accessParams = new URLSearchParams(accessResponse.data);
    const accessToken = accessParams.get("oauth_token");
    const accessTokenSecret = accessParams.get("oauth_token_secret");

    // Store access token in Firestore
    await db.collection("users").doc(uid)
        .collection("etrade").doc("tokens").set({
          accessToken,
          accessTokenSecret,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

    // Clean up temp token
    await db.collection("users").doc(uid)
        .collection("etrade").doc("oauth_temp").delete();

    return res.status(200).json({success: true, message: "E*TRADE connected!"});
  } catch (error) {
    console.error("E*TRADE auth complete error:", error.message);
    return res.status(500).json({
      error: "Failed to complete E*TRADE authorization",
      detail: error.response?.data || error.message,
    });
  }
});

// 3) List accounts
app.post("/etrade/accounts", async (req, res) => {
  try {
    const decodedToken = await verifyUser(req);
    const uid = decodedToken.uid;
    if (!isEtradeAllowed(uid)) {
      return res.status(403).json({error: "E*TRADE access not enabled for this account."});
    }

    // Get stored access token
    const db = admin.firestore();
    const tokenDoc = await db.collection("users").doc(uid)
        .collection("etrade").doc("tokens").get();

    if (!tokenDoc.exists) {
      return res.status(401).json({
        error: "Not connected to E*TRADE. Please authorize first.",
      });
    }

    const {accessToken, accessTokenSecret} = tokenDoc.data();
    const token = {key: accessToken, secret: accessTokenSecret};

    const url = `${ETRADE_BASE}/v1/accounts/list.json`;
    const data = await oauthRequest(url, "GET", token);

    return res.status(200).json(data);
  } catch (error) {
    console.error("E*TRADE accounts error:", error.message);
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "E*TRADE session expired. Please re-authorize.",
      });
    }
    return res.status(500).json({
      error: "Failed to fetch accounts",
      detail: error.response?.data || error.message,
    });
  }
});

// 4) List transactions (with pagination)
app.post("/etrade/transactions", async (req, res) => {
  try {
    const decodedToken = await verifyUser(req);
    const uid = decodedToken.uid;
    if (!isEtradeAllowed(uid)) {
      return res.status(403).json({error: "E*TRADE access not enabled for this account."});
    }
    const {accountIdKey, startDate, endDate} = req.body;

    if (!accountIdKey) {
      return res.status(400).json({error: "Missing accountIdKey"});
    }

    // Get stored access token
    const db = admin.firestore();
    const tokenDoc = await db.collection("users").doc(uid)
        .collection("etrade").doc("tokens").get();

    if (!tokenDoc.exists) {
      return res.status(401).json({
        error: "Not connected to E*TRADE. Please authorize first.",
      });
    }

    const {accessToken, accessTokenSecret} = tokenDoc.data();
    const token = {key: accessToken, secret: accessTokenSecret};

    // Fetch all transactions with pagination
    const allTransactions = [];
    let marker = null;
    let hasMore = true;
    const count = 50;

    while (hasMore) {
      let url = `${ETRADE_BASE}/v1/accounts/${accountIdKey}/transactions.json?count=${count}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (marker) url += `&marker=${marker}`;

      const data = await oauthRequest(url, "GET", token);

      if (data.TransactionListResponse &&
          data.TransactionListResponse.Transaction) {
        const txns = Array.isArray(
            data.TransactionListResponse.Transaction,
        ) ? data.TransactionListResponse.Transaction :
            [data.TransactionListResponse.Transaction];
        allTransactions.push(...txns);

        hasMore = data.TransactionListResponse.moreTransactions === true ||
            data.TransactionListResponse.moreTransactions === "true";

        if (hasMore && txns.length > 0) {
          marker = txns[txns.length - 1].transactionId;
        } else {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return res.status(200).json({
      transactions: allTransactions,
      totalCount: allTransactions.length,
    });
  } catch (error) {
    console.error("E*TRADE transactions error:", error.message);
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "E*TRADE session expired. Please re-authorize.",
      });
    }
    return res.status(500).json({
      error: "Failed to fetch transactions",
      detail: error.response?.data || error.message,
    });
  }
});

// Expose the Express app as a single Cloud Function
// Expose the Express app as a single Cloud Function using v2 SDK
const { onRequest } = require("firebase-functions/v2/https");
exports.apiProxy = onRequest({ cors: false, invoker: 'public' }, app);
