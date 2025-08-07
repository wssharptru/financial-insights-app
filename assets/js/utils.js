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
 * Makes a generic API call to the Finnhub service with improved error handling.
 * @param {string} endpoint - The API endpoint (e.g., 'quote').
 * @param {string} params - The query parameters for the endpoint.
 * @returns {Promise<object|null>} The JSON response from the API, or null on error.
 */
export async function finnhubApiCall(endpoint, params) {
    const apiKey = appState.config.finnhubApiKey.trim();
    if (!apiKey || apiKey === "__FINNHUB_API_KEY__") {
        console.error("Finnhub API key is not configured.");
        return null;
    }
    const url = `https://finnhub.io/api/v1/${endpoint}?${params}&token=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Finnhub API error for ${endpoint}: ${response.status} ${response.statusText}`, errorBody);
            return null;
        }
        const data = await response.json();
        
        // FIX: Specifically check for Finnhub's common "no data" response for quotes.
        if (endpoint === 'quote' && data.c === 0 && data.pc === 0) {
            console.warn(`Finnhub returned a 'no data' response for quote: ${params}`);
            return null; // Treat as no data found
        }
        
        // FIX: Check if the API returned an empty object, which it does for some invalid symbols.
        if (Object.keys(data).length === 0) {
            console.warn(`Finnhub returned an empty object for ${endpoint} with params: ${params}`);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error(`Error fetching from Finnhub (${endpoint}):`, error);
        return null;
    }
}

// ... (The rest of the functions in this file remain unchanged) ...
export function isMarketOpen() {
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

export async function fmpApiCall(endpoint, params) {
    const apiKey = appState.config.fmpApiKey.trim();
    if (!apiKey || apiKey === "__FMP_API_KEY__") {
        throw new Error("Financial Modeling Prep API key is not configured.");
    }

    let cleanParams = params.replace(/&?apikey=[^&]*/g, '');
    cleanParams = cleanParams.replace(/&?limit=[^&]*/g, '');
    
    const url = `https://financialmodelingprep.com/api/v3/${endpoint}?${cleanParams}&apikey=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`FMP API request failed for ${endpoint} with status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching from FMP (${endpoint}):`, error);
        throw error;
    }
}

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

export async function generateContent(prompt, generationConfig = {}) {
    const url = 'https://gemini-proxy-835285817704.us-east4.run.app/';
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("API Error Response:", errorBody);
        throw new Error(`API call failed with status: ${response.status}`);
    }

    const result = await response.json();
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
