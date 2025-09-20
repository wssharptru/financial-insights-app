// functions/index.js (Corrected Final Version)
const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

// Automatically handle CORS preflight requests
app.use(cors({ origin: true }));

// Get API keys from the secure environment configuration
const finnhubApiKey = functions.config().finnhub.key;
const fmpApiKey = functions.config().fmp.key;
const twelveDataApiKey = functions.config().twelvedata.key;
const geminiUrl = functions.config().gemini.url;

app.post("/", async (request, response) => {
  try {
    const { api, endpoint, params, payload } = request.body;

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
        const geminiResponse = await axios.post(geminiUrl, payload);
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