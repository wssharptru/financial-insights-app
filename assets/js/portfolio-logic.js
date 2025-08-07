import { appState } from './main.js';

/**
 * Retrieves the currently active portfolio from the application state.
 * This function is now crash-proof and handles all edge cases.
 * @returns {object} The active portfolio object or a safe default.
 */
export function getActivePortfolio() {
    const portfolios = appState.data.portfolios || [];

    // 1. Handle the primary edge case: No portfolios exist.
    if (portfolios.length === 0) {
        return { id: 0, name: "No Portfolios", holdings: [], transactions: [] };
    }

    // 2. Find the portfolio matching the active ID.
    const activePortfolio = portfolios.find(p => p.id === appState.data.activePortfolioId);

    // 3. If found, return it. This is the normal case.
    if (activePortfolio) {
        return activePortfolio;
    }

    // 4. If not found (meaning the activePortfolioId is invalid),
    //    return the first available portfolio as a safe fallback.
    //    We know portfolios.length > 0 because of the first check.
    return portfolios[0];
}


/**
 * Recalculates all metrics for a specific holding based on its transactions.
 * @param {number} holdingId - The ID of the holding to recalculate.
 */
export function recalculateHolding(holdingId) {
    const portfolio = getActivePortfolio();
    if (!portfolio || portfolio.id === 0) return; // Don't run on the default object

    const holding = portfolio.holdings.find(h => h.id === holdingId);
    if (!holding) return;

    const transactions = (portfolio.transactions || []).filter(t => t.holdingId === holdingId);
    const buyTransactions = transactions.filter(t => t.type === 'Buy');
    
    const totalSharesBought = buyTransactions.reduce((sum, t) => sum + t.shares, 0);
    const totalSharesSold = transactions.filter(t => t.type === 'Sell').reduce((sum, t) => sum + t.shares, 0);
    const totalCost = buyTransactions.reduce((sum, t) => sum + t.total, 0);

    holding.shares = totalSharesBought - totalSharesSold;
    holding.average_cost = totalSharesBought > 0 ? totalCost / totalSharesBought : 0;
    holding.total_value = holding.shares * holding.current_price;
    
    const costBasisForCurrentShares = holding.shares * holding.average_cost;
    holding.gain_loss = holding.total_value - costBasisForCurrentShares;
    holding.gain_loss_percent = costBasisForCurrentShares > 0 ? (holding.gain_loss / costBasisForCurrentShares) * 100 : 0;
}

/**
 * Calculates high-level metrics for an entire portfolio.
 * @param {object} portfolio - The portfolio object to analyze.
 * @returns {object} An object containing totalValue, dailyChange, and dailyChangePercent.
 */
export function calculatePortfolioMetrics(portfolio) {
    if (!portfolio || !portfolio.holdings) {
        return { totalValue: 0, dailyChange: 0, dailyChangePercent: 0 };
    }

    const totalValue = portfolio.holdings.reduce((sum, h) => sum + h.total_value, 0);
    const totalGainLoss = portfolio.holdings.reduce((sum, h) => sum + h.gain_loss, 0);
    const totalInvested = portfolio.holdings.reduce((sum, h) => sum + (h.average_cost * h.shares), 0);
    
    return {
        totalValue: totalValue,
        dailyChange: totalGainLoss, // Note: This is total gain/loss, not daily.
        dailyChangePercent: totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0
    };
}
