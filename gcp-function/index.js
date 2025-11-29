const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Initialize Firebase Admin
// In Google Cloud Functions, if the service account has permissions, 
// initializeApp() works without arguments.
try {
  admin.initializeApp();
} catch (e) {
  console.error("Firebase Admin Init Failed:", e);
}

const app = express();

// Automatically handle CORS preflight requests
app.use(cors({ origin: true }));

// Helper to get config from environment variables
const getConfig = (envKey) => {
  return process.env[envKey] || "";
};

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

    // Get API keys from Environment Variables
    const finnhubApiKey = getConfig("FINNHUB_KEY");
    const fmpApiKey = getConfig("FMP_KEY");
    const twelveDataApiKey = getConfig("TWELVEDATA_KEY");
    const geminiApiKey = getConfig("GEMINI_KEY");

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

// Register the function with Functions Framework
functions.http('apiProxy', app);
