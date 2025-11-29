// functions/index.js (Corrected Final Version)
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
        targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${geminiApiKey}`;
        
        const geminiResponse = await axios.post(targetUrl, payload);
        return response.status(200).send(geminiResponse.data);
      }
      default:
        return response.status(400).send("Invalid API specified.");
    }
  } catch (error) {
    console.error("Error in API Proxy:", error.message);
    return response.status(500).send("Failed to fetch from the upstream API.");
  }
});

// Expose the Express app as a single Cloud Function
exports.apiProxy = functions.https.onRequest(app);
