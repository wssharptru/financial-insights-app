// assets/js/utils.js

import { appState } from './main.js';

/**
 * Helper function to call your new Firebase Cloud Function proxy.
 * @param {object} body - The request payload to send to the proxy.
 * @returns {Promise<object|null>} The JSON response from the API, or null on error.
 */
async function callProxy(body) {
    // IMPORTANT: Replace this with your actual deployed function URL
    const proxyUrl = "https://us-central1-gen-lang-client-0367955800.cloudfunctions.net/apiProxy"; 
    
    try {
        const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Proxy Error: ${errorText}`);
        }
        return response.json();
    } catch (error) {
        console.error("Failed to call API proxy:", error);
        return null; // Return null to handle errors gracefully in the calling function
    }
}

/**
 * Makes an API call to the Finnhub service via the secure proxy.
 * @param {string} endpoint - The API endpoint (e.g., 'quote').
 * @param {string} params - The query parameters for the endpoint.
 * @returns {Promise<object|null>} The JSON response from the API, or null on error.
 */
export async function finnhubApiCall(endpoint, params) {
    return callProxy({ api: 'finnhub', endpoint, params });
}

/**
 * Makes an API call to the Financial Modeling Prep service via the secure proxy.
 * @param {string} endpoint - The API endpoint.
 * @param {string} params - The query parameters.
 * @returns {Promise<object|null>} The JSON response from the API, or null on error.
 */
export async function fmpApiCall(endpoint, params) {
    return callProxy({ api: 'fmp', endpoint, params });
}

/**
 * Makes an API call to the Twelve Data service via the secure proxy.
 * @param {string} endpoint - The API endpoint.
 * @param {string} params - The query parameters.
 * @returns {Promise<object|null>} The JSON response from the API, or null on error.
 */
export async function twelveDataApiCall(endpoint, params) {
    return callProxy({ api: 'twelvedata', endpoint, params });
}

/**
 * Generates content using the Gemini model via the secure proxy.
 * @param {string} prompt - The text prompt to send to the model.
 * @param {object} generationConfig - Configuration for the generation request.
 * @returns {Promise<object|string>} The parsed JSON or text response.
 */
export async function generateContent(prompt, generationConfig = {}) {
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig
    };
    const result = await callProxy({ api: 'gemini', endpoint: 'generateContent', payload });
    
    if (!result) {
       throw new Error("Invalid response from API: No data returned from proxy.");
    }

    const part = result?.candidates?.[0]?.content?.parts?.[0];
    if (!part || !part.text) {
        console.error("Invalid API response structure:", JSON.stringify(result, null, 2));
        throw new Error("Invalid response from API: No text part found.");
    }
    
    if (generationConfig.responseMimeType === "application/json") {
        try {
            const cleanedText = part.text.replace(/^```json\n/, '').replace(/\n```$/, '');
            return JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse JSON response:", part.text, e);
            throw new Error("The AI returned a response that was not valid JSON.");
        }
    }
    return part.text;
}

// --- UNCHANGED HELPER FUNCTIONS ---

export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

export function toYYYYMMDD(date) {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function isMarketOpen() {
    // This function remains the same as it doesn't involve API keys.
    try {
        const now = new Date();
        const options = { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(now);
        const dayPart = parts.find(p => p.type === 'weekday');
        const hourPart = parts.find(p => p.type === 'hour');
        const minutePart = parts.find(p => p.type === 'minute');

        if (!dayPart || !hourPart || !minutePart) return false;

        const day = dayPart.value;
        const hour = parseInt(hourPart.value, 10);
        const minute = parseInt(minutePart.value, 10);
        const weekend = ['Sat', 'Sun'];

        if (weekend.includes(day)) return false;

        const timeInMinutes = hour * 60 + minute;
        const marketOpenInMinutes = 9 * 60 + 30; // 9:30 AM
        const marketCloseInMinutes = 16 * 60;   // 4:00 PM
        return timeInMinutes >= marketOpenInMinutes && timeInMinutes < marketCloseInMinutes;
    } catch (error) {
        console.error("Error checking market hours:", error);
        return false;
    }
}

export function getCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

export function getPreferenceValues(containerId) {
    const container = document.getElementById(containerId);
    const preferences = { preferred: [], excluded: [] };
    if (!container) return preferences;

    container.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
        if (radio.dataset.type === 'preferred') {
            preferences.preferred.push(radio.dataset.item);
        } else if (radio.dataset.type === 'excluded') {
            preferences.excluded.push(radio.dataset.item);
        }
    });
    return preferences;
}