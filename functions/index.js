// functions/index.js (Final Version using Express.js)
const {onRequest} = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

// Create an Express app
const app = express();

// Automatically allow cross-origin requests
app.use(cors({origin: true}));

// Get API keys from the secure environment configuration
const finnhubApiKey = functions.config().finnhub.key;
const fmpApiKey = functions.config().fmp.key;
const twelveDataApiKey = functions.config().twelvedata.key;
const geminiUrl = functions.config().gemini.url;

// Build a single POST route to handle all API proxy requests
app.post("/", async (request, response) => {
  try {
    const {api, endpoint, params} = request.body;

    if (!api) {
      return response.status(400).send("Missing 'api' in request body.");
    }

    let targetUrl;
    const finalParams = params ? `${params}&` : "";

    switch (api) {
      case "finnhub": {
        targetUrl = `https://finnhub.io/api/v1/${endpoint}?${finalParams}token=${finnhubApiKey}`;
        const finnhubResponse = await axios.get(targetUrl);
        response.status(200).send(finnhubResponse.data);
        break;
      }
      case "fmp": {
        targetUrl = `https://financialmodelingprep.com/api/v3/${endpoint}?${finalParams}apikey=${fmpApiKey}`;
        const fmpResponse = await axios.get(targetUrl);
        response.status(200).send(fmpResponse.data);
        break;
      }
      case "twelvedata": {
        targetUrl = `https://api.twelvedata.com/${endpoint}?${finalParams}apikey=${twelveDataApiKey}`;
        const twelveDataResponse = await axios.get(targetUrl);
        response.status(200).send(twelveDataResponse.data);
        break;
      }
      case "gemini": {
        const geminiResponse = await axios.post(geminiUrl,
            request.body.payload);
        response.status(200).send(geminiResponse.data);
        break;
      }
      default:
        response.status(400).send("Invalid API specified.");
        break;
    }
  } catch (error) {
    console.error("Error proxying:", error.message);
    response.status(500).send("Failed to fetch from the upstream API.");
  }
});

// Expose Express API as a single Cloud Function:
exports.apiProxy = onRequest(app);
