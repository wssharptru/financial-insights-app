// assets/js/utils.js

import { appState } from './main.js';

/**
 * Formats a number as a US dollar currency string.
 * @param {number} amount - The number to format.
 * @returns {string} The formatted currency string.
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

/**
 * Converts a Date object or date string to a 'YYYY-MM-DD' format.
 * @param {Date|string} date - The date to convert.
 * @returns {string} The formatted date string.
 */
export function toYYYYMMDD(date) {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Checks if the US stock market is currently open.
 * @returns {boolean} True if the market is open, false otherwise.
 */
export function isMarketOpen() {
    // ... (function remains the same)
}

/**
 * Makes a generic API call to the Finnhub service.
 * @param {string} endpoint - The API endpoint (e.g., 'quote').
 * @param {string} params - The query parameters for the endpoint.
 * @returns {Promise<object|null>} The JSON response from the API, or null on error.
 */
export async function finnhubApiCall(endpoint, params) {
    // ... (function remains the same)
}

/**
 * Makes a generic API call to the Financial Modeling Prep (FMP) service.
 * @param {string} endpoint - The API endpoint (e.g., 'stock-screener').
 * @param {string} params - The query parameters.
 * @returns {Promise<object>} The JSON response from the API.
 */
export async function fmpApiCall(endpoint, params) {
    // ... (function remains the same)
}

/**
 * **NEW FUNCTION**
 * Makes a generic API call to the Twelve Data service for historical prices.
 * @param {string} endpoint - The API endpoint (e.g., 'time_series').
 * @param {string} params - The query parameters.
 * @returns {Promise<object>} The JSON response from the API.
 */
export async function twelveDataApiCall(endpoint, params) {
    const apiKey = appState.config.twelvedataApiKey.trim();
    if (!apiKey || apiKey === "__TWELVEDATA_API_KEY__") {
        throw new Error("Twelve Data API key is not configured.");
    }
    const url = `https://api.twelvedata.com/${endpoint}?${params}&apikey=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Twelve Data API request failed with status ${response.status}: ${errorData.message}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from Twelve Data (${endpoint}):`, error);
        throw error;
    }
}


/**
 * Calls the Gemini API proxy to generate content.
 * @param {string} prompt - The prompt to send to the model.
 * @param {object} generationConfig - The generation configuration for the model.
 * @returns {Promise<any>} The parsed response from the API.
 */
export async function generateContent(prompt, generationConfig = {}) {
    // ... (function remains the same)
}

/**
 * Gets the values of all checked checkboxes within a given container.
 * @param {string} containerId - The ID of the element containing the checkboxes.
 * @returns {string[]} An array of the values of the checked boxes.
 */
export function getCheckedValues(containerId) {
    // ... (function remains the same)
}

/**
 * Gets the preference values (preferred/excluded) from a group of radio buttons.
 * @param {string} containerId - The ID of the element containing the preference controls.
 * @returns {{preferred: string[], excluded: string[]}} An object with arrays of preferred and excluded items.
 */
export function getPreferenceValues(containerId) {
    // ... (function remains the same)
}
