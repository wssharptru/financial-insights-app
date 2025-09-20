// functions/index.js (Corrected for V2 SDK and Environment Variables)
const {onRequest} = require("firebase-functions/v2/https");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors({origin: true}));

// Access config variables populated by functions:config:set
const finnhubApiKey = process.env.FINNHUB_KEY;
const fmpApiKey = process.env.FMP_KEY;
const twelveDataApiKey = process.env.TWELVEDATA_KEY;
const geminiUrl = process.env.GEMINI_URL;

app.post("/", async (request, response) => {
  console.log("API Proxy function was triggered!");
  try {
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

exports.apiProxy = onRequest(app);