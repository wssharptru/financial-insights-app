// assets/js/asset-profile.js

import { appState } from './main.js';
import { getActivePortfolio } from './portfolio-logic.js';
import { finnhubApiCall, generateContent, formatCurrency, twelveDataApiCall } from './utils.js';
import { showSection } from './navigation.js';

/**
 * Orchestrates the display of the asset profile page.
 * @param {number} holdingId - The ID of the holding to display.
 */
export async function handleShowAssetProfile(holdingId) {
    const portfolio = getActivePortfolio();
    const holding = portfolio.holdings.find(h => h.id === holdingId);
    if (!holding) {
        console.error("Holding not found for ID:", holdingId);
        showSection('portfolio'); // Go back if holding is invalid
        return;
    }

    // Navigate to the section and show a loading spinner immediately
    await showSection('asset-profile');
    const container = document.getElementById('assetProfileContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <button class="btn btn--secondary" id="backToPortfolioBtn">
                <i class="fas fa-arrow-left me-2"></i>Back to Portfolio
            </button>
        </div>
        <div class="spinner-container card">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>`;

    try {
        // Fetch all necessary data in parallel for speed
        const [profile, quote, financials, earnings] = await Promise.all([
            finnhubApiCall('stock/profile2', `symbol=${holding.symbol}`),
            finnhubApiCall('quote', `symbol=${holding.symbol}`),
            finnhubApiCall('stock/metric', `symbol=${holding.symbol}&metric=all`),
            finnhubApiCall('calendar/earnings', `symbol=${holding.symbol}`)
        ]);

        // **FIX:** Add a check to ensure critical data was fetched successfully.
        if (!profile || !quote || Object.keys(profile).length === 0 || Object.keys(quote).length === 0) {
            throw new Error(`Could not retrieve essential financial data for the symbol "${holding.symbol}". It may be an invalid or delisted ticker.`);
        }

        // Render the main data first
        renderAssetProfileData(container, { profile, quote, financials, earnings });

        // Now, asynchronously fetch and render the Gemini AI analysis
        const geminiContainer = document.getElementById('geminiAnalysisContainer');
        if (geminiContainer) {
            const prompt = createGeminiPrompt({ profile, quote, financials, earnings });
            const schema = {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "summary": { "type": "STRING" },
                        "recommendation": { "type": "STRING" },
                        "confidence": { "type": "STRING" },
                        "reasoning": { "type": "STRING" },
                        "news": { "type": "ARRAY", "items": { "type": "STRING" } }
                    },
                    required: ["summary", "recommendation", "confidence", "reasoning", "news"]
                }
            };
            
            generateContent(prompt, schema)
                .then(analysis => renderGeminiAnalysis(geminiContainer, analysis))
                .catch(error => {
                    console.error("Error generating Gemini analysis:", error);
                    geminiContainer.innerHTML = `<div class="alert alert-danger">Could not generate AI analysis at this time. ${error.message}</div>`;
                });
        }
    } catch (error) {
        console.error("Error fetching asset profile data:", error);
        container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <button class="btn btn--secondary" id="backToPortfolioBtn">
                    <i class="fas fa-arrow-left me-2"></i>Back to Portfolio
                </button>
            </div>
            <div class="alert alert-danger">${error.message}</div>`;
    }
}

/**
 * Renders the static financial data onto the asset profile page.
 * @param {HTMLElement} container - The main container element for the page.
 * @param {object} data - An object containing all the fetched API data.
 */
function renderAssetProfileData(container, data) {
    const { profile, quote, financials } = data;
    const quoteChangeClass = quote?.d >= 0 ? 'gain-positive' : 'gain-negative';
    const quoteChangeSign = quote?.d >= 0 ? '+' : '';

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <button class="btn btn--secondary" id="backToPortfolioBtn">
                <i class="fas fa-arrow-left me-2"></i>Back to Portfolio
            </button>
        </div>
        <div class="card mb-4">
            <div class="card-body d-flex align-items-center">
                ${profile?.logo ? `<img src="${profile.logo}" alt="logo" class="me-3" style="width: 60px; height: 60px; border-radius: var(--radius-base);">` : ''}
                <div>
                    <h2 class="mb-0">${profile?.name || 'N/A'}</h2>
                    <p class="text-secondary mb-0">${profile?.ticker || 'N/A'} &bull; ${profile?.exchange || 'N/A'}</p>
                </div>
            </div>
        </div>
        <div class="row">
            <div class="col-lg-6">
                <div class="card mb-4">
                    <div class="card-header"><h5>Latest Quote</h5></div>
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h3 class="mb-0">${formatCurrency(quote?.c)}</h3>
                            <h4 class="${quoteChangeClass} mb-0">${quoteChangeSign}${formatCurrency(quote?.d)} (${quoteChangeSign}${quote?.dp?.toFixed(2)}%)</h4>
                        </div>
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between"><span>Open</span><strong>${formatCurrency(quote?.o)}</strong></li>
                            <li class="list-group-item d-flex justify-content-between"><span>High</span><strong>${formatCurrency(quote?.h)}</strong></li>
                            <li class="list-group-item d-flex justify-content-between"><span>Low</span><strong>${formatCurrency(quote?.l)}</strong></li>
                            <li class="list-group-item d-flex justify-content-between"><span>Previous Close</span><strong>${formatCurrency(quote?.pc)}</strong></li>
                        </ul>
                    </div>
                </div>
                <div class="card mb-4">
                    <div class="card-header"><h5>Key Financials</h5></div>
                    <div class="card-body">
                        <ul class="list-group list-group-flush">
                            <li class="list-group-item d-flex justify-content-between"><span>Market Cap</span><strong>${formatCurrency((financials?.metric?.marketCapitalization || 0) * 1000000)}</strong></li>
                            <li class="list-group-item d-flex justify-content-between"><span>52-Week High</span><strong>${formatCurrency(financials?.metric?.['52WeekHigh'])}</strong></li>
                            <li class="list-group-item d-flex justify-content-between"><span>52-Week Low</span><strong>${formatCurrency(financials?.metric?.['52WeekLow'])}</strong></li>
                            <li class="list-group-item d-flex justify-content-between"><span>P/E Ratio</span><strong>${financials?.metric?.peNormalizedAnnual?.toFixed(2) || 'N/A'}</strong></li>
                            <li class="list-group-item d-flex justify-content-between"><span>EPS (TTM)</span><strong>${financials?.metric?.epsNormalizedAnnual?.toFixed(2) || 'N/A'}</strong></li>
                            <li class="list-group-item d-flex justify-content-between"><span>Dividend Yield</span><strong>${(financials?.metric?.dividendYieldIndicatedAnnual || 0).toFixed(2)}%</strong></li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="card mb-4">
                    <div class="card-header d-flex align-items-center"><i class="fas fa-brain me-2 text-primary"></i><h5>AI-Powered Analysis</h5></div>
                    <div class="card-body" id="geminiAnalysisContainer">
                        <div class="spinner-container">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Generating analysis...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}

/**
 * Renders the AI-generated analysis into its container.
 * @param {HTMLElement} container - The specific container for the Gemini analysis.
 * @param {object} analysis - The parsed JSON object from the Gemini API.
 */
function renderGeminiAnalysis(container, analysis) {
    // **FIX:** Add a guard clause to prevent errors if analysis is null or undefined.
    if (!analysis) {
        container.innerHTML = `<div class="alert alert-warning">The AI analysis could not be completed. The model may have returned an empty response.</div>`;
        return;
    }
    const recommendation = analysis.recommendation?.toLowerCase() || 'hold';
    const badgeClass = `bg-${recommendation}`;
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="mb-0">Recommendation</h6>
            <div>
                <span class="badge fs-6 rounded-pill ${badgeClass}">${analysis.recommendation || 'N/A'}</span>
                <span class="ms-2 text-secondary">Confidence: ${analysis.confidence || 'N/A'}</span>
            </div>
        </div>
        <p class="mb-4"><strong>Reasoning:</strong> ${analysis.reasoning || 'No reasoning provided.'}</p>
        <h6>Comprehensive Summary</h6>
        <p class="text-secondary">${analysis.summary || 'No summary provided.'}</p>
        <h6>Recent News & Developments</h6>
        ${analysis.news && analysis.news.length > 0 ? `<ul class="list-group list-group-flush">${analysis.news.map(item => `<li class="list-group-item">${item}</li>`).join('')}</ul>` : '<p class="text-secondary">No recent news found.</p>'}`;
}

/**
 * Creates the detailed prompt for the Gemini API.
 * @param {object} data - An object containing all the fetched API data.
 * @returns {string} The formatted prompt string.
 */
function createGeminiPrompt(data) {
    const { profile, quote, financials, earnings } = data;
    const profileData = `Company: ${profile?.name}, Ticker: ${profile?.ticker}, Industry: ${profile?.finnhubIndustry}.`;
    const quoteData = `Current Price: ${quote?.c}, Daily Change: ${quote?.d}, Percent Change: ${quote?.dp}%.`;
    const financialsData = `Market Cap: ${financials?.metric?.marketCapitalization}M, P/E Ratio: ${financials?.metric?.peNormalizedAnnual}, EPS: ${financials?.metric?.epsNormalizedAnnual}, 52-Week High: ${financials?.metric?.['52WeekHigh']}, 52-Week Low: ${financials?.metric?.['52WeekLow']}.`;
    const earningsData = earnings?.earningsCalendar?.[0] ? `Next earnings date: ${earnings.earningsCalendar[0].date}, EPS Estimate: ${earnings.earningsCalendar[0].epsEstimate}.` : "No upcoming earnings data.";
    
    return `You are a financial analyst AI. Analyze the following company based on the provided data and a search of recent news.
    **Company Data:**
    - Profile: ${profileData}
    - Quote: ${quoteData}
    - Key Financials: ${financialsData}
    - Earnings Info: ${earningsData}

    **Instructions:**
    1. Provide a comprehensive summary of the company's current financial health and market position.
    2. Search for the latest news about this company (${profile?.name} / ${profile?.ticker}). Summarize the top 2-3 most impactful news items.
    3. Based on all available information (the data provided and the news), give a clear investment recommendation. The recommendation must be one of: "Buy", "Sell", or "Hold".
    4. State your confidence level in this recommendation. The confidence level must be one of: "Low", "Medium", or "High".
    5. Provide a concise paragraph explaining the reasoning behind your recommendation, referencing both the data and the news.

    Return the entire analysis as a single JSON object.`;
}
