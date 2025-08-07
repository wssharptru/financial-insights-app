// assets/js/renderer.js

import { appState } from './main.js';
import { formatCurrency } from './utils.js';
import { getActivePortfolio, calculatePortfolioMetrics } from './portfolio-logic.js';
// *** ADDED THIS IMPORT ***
import { initializeCharts } from './charts.js';

/**
 * Main render function that orchestrates rendering of all visible components.
 */
export async function renderAll() {
    if (!appState.data || !appState.data.portfolios) return; // Guard against rendering before data is loaded

    const currentSection = document.querySelector('.nav-link.active')?.dataset.section || 'dashboard';

    // Render components common to all pages
    renderPortfolioSelector();

    // Render the active section
    switch (currentSection) {
        case 'dashboard':
            await renderDashboard();
            break;
        case 'portfolio':
            renderPortfolio();
            break;
        case 'ai-screener':
            renderAiScreener();
            break;
        case 'insights':
            renderInsights();
            break;
        case 'preferences':
            renderPreferences();
            break;
    }
}

/**
 * Renders the portfolio selector dropdown.
 */
function renderPortfolioSelector() {
    const selector = document.getElementById('portfolioSelector');
    if (!selector) return;
    selector.innerHTML = (appState.data.portfolios || [])
        .map(p => `<option value="${p.id}" ${p.id === appState.data.activePortfolioId ? 'selected' : ''}>${p.name}</option>`)
        .join('');
}

/**
 * Renders the dashboard view with metrics and charts.
 */
async function renderDashboard() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;

    const portfolio = getActivePortfolio();
    const portfolioNameEl = document.getElementById('dashboard-portfolio-name');
    if(portfolioNameEl) {
        portfolioNameEl.textContent = `A real-time overview of your '${portfolio.name}' portfolio.`;
    }

    if (!portfolio.holdings || portfolio.holdings.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-chart-line"></i><h4>Your Dashboard is Ready</h4><p>Add your first investment to see your portfolio's value, performance, and allocation.</p><button class="btn btn--primary" id="addInvestmentBtnEmpty"><i class="fas fa-plus me-2"></i>Add First Investment</button></div>`;
        return;
    }

    const { totalValue, dailyChange, dailyChangePercent } = calculatePortfolioMetrics(portfolio);
    const changeClass = dailyChange >= 0 ? 'gain-positive' : 'gain-negative';
    const changeSign = dailyChange >= 0 ? '+' : '';

    container.innerHTML = `
        <div class="row">
            <div class="col-lg-4 mb-3"><div class="card metric-card"><div class="card__body d-flex justify-content-between align-items-center"><div><h6>Total Portfolio Value</h6><h3 class="text-primary">${formatCurrency(totalValue)}</h3></div><div class="metric-icon bg-primary"><i class="fas fa-dollar-sign"></i></div></div></div></div>
            <div class="col-lg-4 mb-3"><div class="card metric-card"><div class="card__body d-flex justify-content-between align-items-center"><div><h6>Total Gain/Loss</h6><h3 class="${changeClass}">${changeSign}${formatCurrency(dailyChange)} (${changeSign}${dailyChangePercent.toFixed(2)}%)</h3></div><div class="metric-icon ${dailyChange >= 0 ? 'bg-success' : 'bg-danger'}"><i class="fas ${dailyChange >= 0 ? 'fa-trending-up' : 'fa-trending-down'}"></i></div></div></div></div>
            <div class="col-lg-4 mb-3"><div class="card metric-card"><div class="card__body d-flex justify-content-between align-items-center"><div><h6>Total Holdings</h6><h3 class="text-info">${portfolio.holdings.length}</h3></div><div class="metric-icon bg-info"><i class="fas fa-list"></i></div></div></div></div>
        </div>
        <div class="row">
            <div class="col-lg-6 mb-4"><div class="card"><div class="card__body"><h5 class="card-title">Portfolio Allocation</h5><div style="position: relative; height: 300px;"><canvas id="allocationChart"></canvas></div></div></div></div>
            <div class="col-lg-6 mb-4"><div class="card"><div class="card__body"><h5 class="card-title">Asset Performance</h5><div style="position: relative; height: 300px;" id="performanceChartContainer"><canvas id="performanceChart"></canvas></div></div></div></div>
        </div>`;
    
    // *** UNCOMMENTED AND CORRECTED THIS LINE ***
    // Initialize charts after rendering the canvas elements
    initializeCharts(portfolio);
}

/**
 * Renders the portfolio holdings table.
 */
function renderPortfolio() {
    const container = document.getElementById('portfolioContent');
    if (!container) return;

    const portfolio = getActivePortfolio();

    if (!portfolio.holdings || portfolio.holdings.length === 0) {
        container.innerHTML = `<div class="card"><div class="card-body text-center"><p class="text-muted mt-4">No investments added yet. Click "Add Investment" to start.</p></div></div>`;
        return;
    }

    const holdingsRows = portfolio.holdings.map(h => {
        const gainLossClass = h.gain_loss >= 0 ? 'gain-positive' : 'gain-negative';
        const gainLossSign = h.gain_loss >= 0 ? '+' : '';
        return `
            <tr>
                <td>
                    <a href="#" class="asset-symbol-link" data-id="${h.id}">${h.symbol}</a>
                    <br><small class="text-muted">${h.name}</small>
                </td>
                <td>${h.shares.toFixed(4)}</td>
                <td>${formatCurrency(h.current_price)}</td>
                <td>${formatCurrency(h.total_value)}</td>
                <td class="${gainLossClass}">${gainLossSign}${formatCurrency(h.gain_loss)} (${gainLossSign}${h.gain_loss_percent.toFixed(2)}%)</td>
                <td><span class="badge rounded-pill text-bg-light">${h.asset_type}</span></td>
                <td>
                    <button class="btn btn--secondary btn-sm transaction-btn" data-id="${h.id}" title="Manage Transactions"><i class="fas fa-exchange-alt"></i></button>
                    <button class="btn btn--secondary btn-sm edit-btn" data-id="${h.id}" title="Edit Asset"><i class="fas fa-edit"></i></button>
                    <button class="btn btn--secondary btn-sm delete-btn" data-id="${h.id}" title="Delete Asset"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    }).join('');

    container.innerHTML = `<div class="card"><div class="card__body p-0"><div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>Symbol</th><th>Shares</th><th>Current Price</th><th>Total Value</th><th>Gain/Loss</th><th>Type</th><th>Actions</th></tr></thead><tbody>${holdingsRows}</tbody></table></div></div></div>`;
}

// Dummy functions for other renderers to prevent errors
function renderAiScreener() {
    const container = document.getElementById('aiScreenerMainContent');
    if (container) container.innerHTML = '<div class="card card-body text-center">AI Screener coming soon.</div>';
}
function renderInsights() {
    const container = document.getElementById('insightsContainer');
    if (container) container.innerHTML = '<div class="col-12"><div class="card card-body text-center">AI Insights coming soon.</div></div>';
}
function renderPreferences() {
    // This page is mostly static, but a render function is good practice
}