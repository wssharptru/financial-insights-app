// assets/js/renderer.js

import { appState } from './main.js';
import { formatCurrency } from './utils.js';
import { getActivePortfolio, calculatePortfolioMetrics } from './portfolio-logic.js';
import { initializeCharts } from './charts.js';

const PREF_DEFAULTS = {
    assetClasses: ["Stock", "ETF", "Bond", "Crypto", "Mutual Fund", "Other"],
    sectors: ["Technology", "Healthcare", "Financials", "Consumer Discretionary", "Industrials", "Green Energy", "No Fossil Fuels"]
};

/**
 * Main render function that orchestrates rendering of all visible components.
 */
export async function renderAll() {
    if (!appState.data || !appState.data.portfolios) return;

    const activeLink = document.querySelector('.nav-link.active');
    const currentSection = activeLink ? activeLink.dataset.section : 'dashboard';

    renderPortfolioSelector();

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
    if (portfolioNameEl) {
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
    
    initializeCharts(portfolio);
}

/**
 * Renders the portfolio holdings table.
 */
function renderPortfolio() {
    const container = document.getElementById('portfolioContent');
    if (!container) return;

    const portfolio = getActivePortfolio();

    // *** THIS IS THE FIX ***
    // Replace the simple <p> tag with a full "empty state" card.
    if (!portfolio.holdings || portfolio.holdings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wallet"></i>
                <h4>Your Portfolio is Empty</h4>
                <p>Add an investment to this portfolio to start tracking your assets and performance.</p>
                <button class="btn btn--primary" id="addInvestmentBtnEmpty">
                    <i class="fas fa-plus me-2"></i>Add First Investment
                </button>
            </div>`;
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
                <td><span class="badge rounded-pill bg-light text-dark border">${h.asset_type}</span></td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn--secondary btn-sm transaction-btn" data-id="${h.id}" title="Manage Transactions"><i class="fas fa-exchange-alt"></i></button>
                        <button class="btn btn--secondary btn-sm edit-btn" data-id="${h.id}" title="Edit Asset"><i class="fas fa-edit"></i></button>
                        <button class="btn btn--secondary btn-sm delete-btn" data-id="${h.id}" title="Delete Asset"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    container.innerHTML = `<div class="card"><div class="card__body p-0"><div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>Symbol</th><th>Shares</th><th>Current Price</th><th>Total Value</th><th>Gain/Loss</th><th>Type</th><th>Actions</th></tr></thead><tbody>${holdingsRows}</tbody></table></div></div></div>`;
}

/**
 * Renders the AI Insights page.
 */
function renderInsights() {
    const container = document.getElementById('insightsContainer');
    if (!container) return;

    const insights = appState.data.insights || [];
    if (insights.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="empty-state"><i class="fas fa-brain"></i><h4>No Insights Yet</h4><p>Click one of the analysis buttons above to generate AI-powered insights for your portfolio or the market.</p></div></div>';
        return;
    }

    const insightsCards = insights.map(insight => {
        const iconMap = { rebalance: 'fa-balance-scale', performance: 'fa-chart-line', risk: 'fa-shield-alt', opportunity: 'fa-lightbulb', news: 'fa-newspaper' };
        const iconClass = iconMap[insight.type] || 'fa-info-circle';
        return `<div class="col-md-6 col-lg-4 mb-4">
                    <div class="insight-card">
                        <div class="insight-header">
                            <div class="insight-icon ${insight.type || 'default'}"><i class="fas ${iconClass}"></i></div>
                            <h6 class="insight-title">${insight.title}</h6>
                        </div>
                        <p class="insight-description">${insight.description}</p>
                    </div>
                </div>`;
    }).join('');
    container.innerHTML = insightsCards;
}

/**
 * Renders the User Preferences page form fields.
 */
function renderPreferences() {
    const profile = appState.data.user_profile;
    if (!profile) return;
    
    const riskTol = document.getElementById('riskTolerance');
    const invCap = document.getElementById('investmentCapital');

    if (riskTol) riskTol.value = profile.risk_tolerance;
    if (invCap) invCap.value = profile.available_capital || '';
    
    renderCheckboxGroup('subInvestmentGoals', profile.sub_goals || []);
    renderCheckboxGroup('taxConsiderations', profile.tax_considerations || []);
    renderPreferenceGroup('assetClassPrefs', PREF_DEFAULTS.assetClasses, profile.asset_preferences);
    renderPreferenceGroup('sectorPrefs', PREF_DEFAULTS.sectors, profile.sector_preferences);
}

function renderCheckboxGroup(containerId, checkedItems) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.form-check-input').forEach(checkbox => {
        checkbox.checked = checkedItems.includes(checkbox.value);
    });
}

function renderPreferenceGroup(containerId, allItems, preferences) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const prefs = preferences || { preferred: [], excluded: [] };
    container.innerHTML = allItems.map(item => {
        const isPreferred = prefs.preferred.includes(item);
        const isExcluded = prefs.excluded.includes(item);
        const id = `${containerId}-${item.replace(/\s+/g, '')}`;
        return `
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span>${item}</span>
                <div class="btn-group" role="group">
                    <input type="radio" class="btn-check" name="${id}" id="${id}-neutral" autocomplete="off" ${!isPreferred && !isExcluded ? 'checked' : ''} data-type="neutral" data-item="${item}">
                    <label class="btn btn-sm btn-outline-secondary" for="${id}-neutral"><i class="fa-solid fa-minus"></i></label>
                    <input type="radio" class="btn-check" name="${id}" id="${id}-preferred" autocomplete="off" ${isPreferred ? 'checked' : ''} data-type="preferred" data-item="${item}">
                    <label class="btn btn-sm btn-outline-success" for="${id}-preferred"><i class="fa-solid fa-thumbs-up"></i></label>
                    <input type="radio" class="btn-check" name="${id}" id="${id}-excluded" autocomplete="off" ${isExcluded ? 'checked' : ''} data-type="excluded" data-item="${item}">
                    <label class="btn btn-sm btn-outline-danger" for="${id}-excluded"><i class="fa-solid fa-thumbs-down"></i></label>
                </div>
            </div>`;
    }).join('');
}


function renderAiScreener() {
    const mainContainer = document.getElementById('aiScreenerMainContent');
    const historyContainer = document.getElementById('aiScreenerHistoryContainer');
    if (!mainContainer || !historyContainer) return;

    const reports = appState.data.aiScreenerReports || [];
    const pendingReport = reports.find(r => r.status === 'pending');
    const sortedReports = [...reports].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedReports.length > 0) {
        historyContainer.innerHTML = `<ul class="list-group list-group-flush history-list-group">${sortedReports.map(r => {
            const reportTypeLabel = r.type === 'hrhr' ? 'HRHR' : 'Profile-Based';
            const activeClass = r.id === appState.activeScreenerReportId ? 'active' : '';
            return `
            <li class="list-group-item d-flex justify-content-between align-items-center ${activeClass}" data-report-id="${r.id}">
                <div>
                    ${new Date(r.date).toLocaleString()} <span class="badge bg-info text-dark">${reportTypeLabel}</span>
                    ${r.status === 'pending' ? '<span class="badge bg-warning ms-2">In Progress...</span>' : ''}
                    ${r.status === 'error' ? '<span class="badge bg-danger ms-2">Failed</span>' : ''}
                </div>
                <button class="btn btn-sm btn-outline-danger delete-screener-report-btn" data-report-id="${r.id}" title="Delete Report" ${activeClass ? 'style="color:white; border-color:white;"' : ''}><i class="fas fa-trash"></i></button>
            </li>`;
        }).join('')}</ul>`;
    } else {
        historyContainer.innerHTML = '<p class="text-muted text-center p-3">No analysis history.</p>';
    }

    if (pendingReport) {
        mainContainer.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <div class="spinner-border text-primary mb-3" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <h4>AI Analysis in Progress...</h4>
                    <p class="text-secondary">Your stock screening is underway. This may take a moment.</p>
                </div>
            </div>`;
    } else {
        const activeReport = reports.find(r => r.id === appState.activeScreenerReportId);
        if (activeReport) {
            renderScreenerReport(mainContainer, activeReport);
        } else {
            mainContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-robot"></i>
                    <h4>Ready for New Opportunities?</h4>
                    <p>Choose an analysis type to find investments that match your profile or to uncover high-risk, high-reward plays.</p>
                    <div class="d-grid gap-2 d-sm-flex justify-content-sm-center">
                        <button class="btn btn--primary btn-lg" id="startAiAnalysisBtn">
                            <i class="fas fa-wand-magic-sparkles me-2"></i>Start Profile-Based Analysis
                        </button>
                        <button class="btn btn--secondary btn-lg" id="startHrhrAnalysisBtn">
                            <i class="fas fa-rocket me-2"></i>Find High Risk, High Reward
                        </button>
                    </div>
                </div>`;
        }
    }
}

function renderScreenerReport(container, report) {
    if (report.status === 'error') {
        container.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <h4 class="text-danger">Analysis Failed</h4>
                    <p class="text-secondary"><strong>Error:</strong> ${report.error || 'An unknown error occurred.'}</p>
                    <div class="d-grid gap-2 d-sm-flex justify-content-sm-center mt-3">
                         <button class="btn btn--primary" id="startAiAnalysisBtn"><i class="fas fa-redo me-2"></i>Try Again</button>
                    </div>
                </div>
            </div>`;
        return;
    }

    const isHrhrReport = report.type === 'hrhr';
    const recommendationsHtml = (report.recommendations || []).map(rec => `
        <div class="card mb-3">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">${rec.ticker} - ${rec.companyName}</h5>
            </div>
            <div class="card-body">
                <p><strong>AI Analysis:</strong> ${rec.analysis}</p>
                ${isHrhrReport ? `<p><strong>HRHR Rationale:</strong> ${rec.hrhrRationale || 'N/A'}</p>` : ''}
                <div class="row">
                    <div class="col-md-3 col-6 mb-3 mb-md-0"><strong>Current Price</strong><p class="h5 text-primary mb-0">${formatCurrency(rec.currentPrice)}</p></div>
                    <div class="col-md-3 col-6 mb-3 mb-md-0"><strong>Target Entry</strong><p class="h5 text-success mb-0">${formatCurrency(rec.targetEntryPrice)}</p></div>
                    <div class="col-md-3 col-6"><strong>Est. Sell Price</strong><p class="h5 text-danger mb-0">${formatCurrency(rec.estimatedSellPrice)}</p></div>
                    <div class="col-md-3 col-6"><strong>Confidence</strong><p class="h5 mb-0">${rec.confidenceScore}%</p><div class="confidence-bar mt-1"><div class="confidence-bar-inner" style="width: ${rec.confidenceScore}%;"></div></div></div>
                </div>
            </div>
        </div>
    `).join('');

    const reportTitle = isHrhrReport ? 'High Risk, High Reward Report' : 'Profile-Based Screener Report';

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div>
                <h4>${reportTitle}</h4>
                <p class="text-secondary mb-0">Generated on ${new Date(report.date).toLocaleString()}</p>
            </div>
            <div class="btn-group"><button class="btn btn--primary" id="startAiAnalysisBtn"><i class="fas fa-redo me-2"></i>New Profile-Based</button><button class="btn btn--secondary" id="startHrhrAnalysisBtn"><i class="fas fa-rocket me-2"></i>New HRHR</button></div>
        </div>
        ${recommendationsHtml || '<p class="text-center text-muted">No recommendations were generated in this report.</p>'}`;
}
