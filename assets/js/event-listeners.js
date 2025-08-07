import { appState } from './main.js';
import { saveDataToFirestore } from './firestore.js';
import { getActivePortfolio, recalculateHolding, calculatePortfolioMetrics } from './portfolio-logic.js';
import { finnhubApiCall, generateContent, fmpApiCall, formatCurrency } from './utils.js';
import { showSection } from './navigation.js';
import { renderAll } from './renderer.js';

/**
 * Initializes all primary event listeners for the application.
 * Uses event delegation for dynamically loaded content.
 */
export function initializeEventListeners() {
    
    document.body.addEventListener('click', (e) => {
        const targetId = e.target.id;
        const targetClosest = (selector) => e.target.closest(selector);

        // Portfolio Page Buttons
        if (targetId === 'addInvestmentBtnPortfolio' || targetId === 'addInvestmentBtnDashboard' || targetId === 'addInvestmentBtnEmpty') openInvestmentModal();
        if (targetId === 'createPortfolioBtn') openPortfolioModalForCreate();
        if (targetId === 'editPortfolioNameBtn') openPortfolioModalForEdit();
        if (targetId === 'updatePricesBtn') handleUpdatePrices(e);

        // Modal Save/Confirm Buttons
        if (targetId === 'savePortfolioBtn') handleSavePortfolio();
        if (targetId === 'saveInvestmentBtn') handleSaveInvestment();
        if (targetId === 'saveAssetEditBtn') handleSaveAssetEdit();
        if (targetId === 'confirmDeleteBtn') handleConfirmDelete();
        
        // Asset Info Buttons
        if (targetId === 'getAssetInfoBtn') handleGetAssetInfo(false);
        if (targetId === 'getAssetInfoBtnEdit') handleGetAssetInfo(true);

        // Insights Page Buttons
        if (targetId === 'generateInsightsBtn') handlePortfolioAnalysis(e);
        if (targetId === 'getNewsAnalysisBtn') handleNewsAnalysis(e);

        // Preferences Page Buttons
        if (targetId === 'openQuestionnaireBtn') openRiskQuestionnaireModal();
        if (targetId === 'submitQuestionnaireBtn') handleRiskAnalysis(e);
        
        // Delegated events for portfolio table
        const assetLink = targetClosest('.asset-symbol-link');
        if (assetLink) {
            e.preventDefault();
            const holdingId = parseInt(assetLink.dataset.id);
            showAssetProfile(holdingId);
        }
        const transactionBtn = targetClosest('.transaction-btn');
        if (transactionBtn) {
            e.stopPropagation();
            const holdingId = parseInt(transactionBtn.dataset.id);
            openTransactionModal(holdingId);
        }
        const editBtn = targetClosest('.edit-btn');
        if (editBtn) {
            e.stopPropagation();
            const holdingId = parseInt(editBtn.dataset.id);
            openEditAssetModal(holdingId);
        }
        const deleteBtn = targetClosest('.delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const holdingId = parseInt(deleteBtn.dataset.id);
            openDeleteConfirmModal(holdingId, 'holding');
        }

        // Back button in asset profile
        if (targetId === 'backToPortfolioBtn' || targetClosest('#backToPortfolioBtn')) {
            showSection('portfolio');
        }
        
        // AI Screener
        const startBtn = targetClosest('#startAiAnalysisBtn');
        const startHrhrBtn = targetClosest('#startHrhrAnalysisBtn');
        const historyItem = targetClosest('.history-list-group .list-group-item');
        const deleteScreenerBtn = targetClosest('.delete-screener-report-btn');

        if (startBtn) handleStartAiAnalysis('standard');
        if (startHrhrBtn) handleStartAiAnalysis('hrhr');
        if (deleteScreenerBtn) {
            e.stopPropagation();
            const reportId = parseInt(deleteScreenerBtn.dataset.reportId);
            openDeleteConfirmModal(reportId, 'screenerReport');
        } else if (historyItem) {
            appState.activeScreenerReportId = parseInt(historyItem.dataset.reportId);
            renderAll();
        }
    });

    document.body.addEventListener('submit', (e) => {
        if (e.target.matches('#transactionForm')) handleSaveTransaction(e);
        if (e.target.matches('#preferencesForm')) handleSavePreferences(e);
    });

    document.body.addEventListener('change', (e) => {
        if (e.target.matches('#portfolioSelector')) handlePortfolioChange(e);
    });
}

// --- MODAL HANDLERS ---
function getModalInstance(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return bootstrap.Modal.getOrCreateInstance(el);
}

function openInvestmentModal() {
    const portfolio = getActivePortfolio();
    document.getElementById('investmentForm').reset();
    document.getElementById('investmentDate').valueAsDate = new Date();
    document.getElementById('modalPortfolioName').textContent = portfolio.name;
    document.getElementById('companyInfoCard').classList.add('d-none');
    document.getElementById('companyInfoContent').innerHTML = '';
    getModalInstance('investmentModal')?.show();
}

function openPortfolioModalForCreate() {
    document.getElementById('portfolioForm').reset();
    document.getElementById('editPortfolioId').value = '';
    document.getElementById('portfolioModalTitle').textContent = 'Create New Portfolio';
    getModalInstance('portfolioModal')?.show();
}

function openPortfolioModalForEdit() {
    const portfolio = getActivePortfolio();
    if (!portfolio) return;
    document.getElementById('portfolioForm').reset();
    document.getElementById('editPortfolioId').value = portfolio.id;
    document.getElementById('portfolioName').value = portfolio.name;
    document.getElementById('portfolioModalTitle').textContent = 'Edit Portfolio Name';
    getModalInstance('portfolioModal')?.show();
}

function openTransactionModal(holdingId) {
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionDate').valueAsDate = new Date();
    document.getElementById('transactionHoldingId').value = holdingId;
    // renderTransactionHistory(holdingId); // This needs to be implemented in renderer.js
    getModalInstance('transactionModal')?.show();
}

function openEditAssetModal(holdingId) {
    const portfolio = getActivePortfolio();
    const holding = portfolio.holdings.find(h => h.id === holdingId);
    if (!holding) return;
    document.getElementById('editAssetId').value = holding.id;
    document.getElementById('editAssetSymbol').value = holding.symbol;
    document.getElementById('editAssetName').value = holding.name;
    document.getElementById('editAssetType').value = holding.asset_type;
    document.getElementById('editAssetInfoCard').classList.add('d-none');
    getModalInstance('editAssetModal')?.show();
}

function openDeleteConfirmModal(id, type) {
    appState.itemToDelete = { id, type };
    const titleEl = document.getElementById('deleteConfirmModalTitle');
    const bodyEl = document.getElementById('deleteConfirmModalBody');
    if (type === 'holding') {
        titleEl.textContent = 'Delete Holding';
        bodyEl.textContent = 'Are you sure you want to delete this holding and all its transactions? This action cannot be undone.';
    } else if (type === 'screenerReport') {
        titleEl.textContent = 'Delete Report';
        bodyEl.textContent = 'Are you sure you want to delete this analysis report? This action cannot be undone.';
    }
    getModalInstance('deleteConfirmModal')?.show();
}

function openRiskQuestionnaireModal() {
    getModalInstance('riskQuestionnaireModal')?.show();
}

// --- FORM & ACTION HANDLERS ---

function handlePortfolioChange(e) {
    appState.data.activePortfolioId = parseInt(e.target.value);
    saveDataToFirestore();
}

function handleSavePortfolio() {
    const portfolioId = document.getElementById('editPortfolioId').value;
    const nameInput = document.getElementById('portfolioName');
    const name = nameInput.value.trim();
    if (!name) return;

    if (portfolioId) {
        const portfolio = appState.data.portfolios.find(p => p.id == portfolioId);
        if (portfolio) portfolio.name = name;
    } else {
        const newPortfolio = { id: Date.now(), name: name, holdings: [], transactions: [] };
        appState.data.portfolios.push(newPortfolio);
        appState.data.activePortfolioId = newPortfolio.id;
    }
    saveDataToFirestore();
    getModalInstance('portfolioModal')?.hide();
}

function handleSaveInvestment() {
    const portfolio = getActivePortfolio();
    const transactionData = {
        type: 'Buy',
        date: document.getElementById('investmentDate').value,
        shares: parseFloat(document.getElementById('investmentShares').value),
        price: parseFloat(document.getElementById('investmentPrice').value)
    };
    if (!transactionData.date || !transactionData.shares || !transactionData.price) {
        alert("Please fill all purchase details: Shares, Price, and Date.");
        return;
    }
    const newHolding = {
        id: Date.now(),
        symbol: document.getElementById('investmentSymbol').value.toUpperCase(),
        name: document.getElementById('investmentName').value,
        asset_type: document.getElementById('investmentType').value,
        current_price: transactionData.price,
        shares: 0,
        average_cost: 0,
        total_value: 0,
        gain_loss: 0,
        gain_loss_percent: 0,
        fundamentals: null,
        price_history: []
    };
    if (!newHolding.symbol || !newHolding.name) {
        alert("Please fill out at least the Symbol and Name.");
        return;
    }
    if (portfolio.holdings.find(h => h.symbol === newHolding.symbol)) {
        alert(`Asset with symbol ${newHolding.symbol} already exists. Please add transactions to the existing asset.`);
        return;
    }
    portfolio.holdings.push(newHolding);
    transactionData.holdingId = newHolding.id;
    transactionData.total = transactionData.shares * transactionData.price;
    if (!portfolio.transactions) portfolio.transactions = [];
    portfolio.transactions.push(transactionData);
    recalculateHolding(newHolding.id);
    saveDataToFirestore();
    getModalInstance('investmentModal')?.hide();
}

function handleSaveAssetEdit() {
    const portfolio = getActivePortfolio();
    const holdingId = parseInt(document.getElementById('editAssetId').value);
    const holding = portfolio.holdings.find(h => h.id === holdingId);
    if (!holding) return;
    holding.symbol = document.getElementById('editAssetSymbol').value.toUpperCase();
    holding.name = document.getElementById('editAssetName').value;
    holding.asset_type = document.getElementById('editAssetType').value;
    saveDataToFirestore();
    getModalInstance('editAssetModal')?.hide();
}

function handleSaveTransaction(e) {
    e.preventDefault();
    const portfolio = getActivePortfolio();
    const holdingId = parseInt(document.getElementById('transactionHoldingId').value);
    const transactionData = {
        holdingId: holdingId,
        type: document.getElementById('transactionType').value,
        date: document.getElementById('transactionDate').value,
        shares: parseFloat(document.getElementById('transactionShares').value),
        price: parseFloat(document.getElementById('transactionPrice').value)
    };
    if (!transactionData.date || !transactionData.shares || (!transactionData.price && transactionData.type !== 'Dividend')) {
        alert("Please fill all required fields.");
        return;
    }
    transactionData.total = transactionData.type === 'Dividend' ? transactionData.shares : transactionData.shares * transactionData.price;
    if (transactionData.type === 'Sell') {
        const holding = portfolio.holdings.find(h => h.id === holdingId);
        if (transactionData.shares > holding.shares) {
            alert(`Cannot sell more shares (${transactionData.shares}) than you own (${holding.shares}).`);
            return;
        }
    }
    if (!portfolio.transactions) portfolio.transactions = [];
    portfolio.transactions.push(transactionData);
    recalculateHolding(holdingId);
    saveDataToFirestore();
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionDate').valueAsDate = new Date();
    // renderTransactionHistory(holdingId); // This needs to be implemented in renderer.js
}

function handleConfirmDelete() {
    if (!appState.itemToDelete.id || !appState.itemToDelete.type) return;

    if (appState.itemToDelete.type === 'holding') {
        const portfolio = getActivePortfolio();
        portfolio.holdings = portfolio.holdings.filter(h => h.id !== appState.itemToDelete.id);
        portfolio.transactions = (portfolio.transactions || []).filter(t => t.holdingId !== appState.itemToDelete.id);
    } else if (appState.itemToDelete.type === 'screenerReport') {
        appState.data.aiScreenerReports = appState.data.aiScreenerReports.filter(r => r.id !== appState.itemToDelete.id);
        if (appState.activeScreenerReportId === appState.itemToDelete.id) {
            appState.activeScreenerReportId = null;
            const latestCompleted = appState.data.aiScreenerReports.find(r => r.status === 'complete');
            if (latestCompleted) appState.activeScreenerReportId = latestCompleted.id;
        }
    }

    appState.itemToDelete = { id: null, type: null };
    getModalInstance('deleteConfirmModal')?.hide();
    saveDataToFirestore();
}

function handleSavePreferences(e) {
    e.preventDefault();
    const profile = appState.data.user_profile;
    profile.risk_tolerance = document.getElementById('riskTolerance').value;
    profile.available_capital = parseFloat(document.getElementById('investmentCapital').value) || 0;
    profile.sub_goals = Array.from(document.querySelectorAll('#subInvestmentGoals input:checked')).map(cb => cb.value);
    profile.tax_considerations = Array.from(document.querySelectorAll('#taxConsiderations input:checked')).map(cb => cb.value);
    // Logic for asset/sector preferences needs to be added here
    saveDataToFirestore();
    const msgEl = document.getElementById('preferencesMessage');
    msgEl.innerHTML = `<div class="alert alert-success" role="alert">Preferences saved successfully!</div>`;
    setTimeout(() => msgEl.innerHTML = '', 3000);
}

async function handleUpdatePrices(e) {
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Updating...`;
    btn.disabled = true;

    const portfolio = getActivePortfolio();
    if (!portfolio || !portfolio.holdings || portfolio.holdings.length === 0) {
        btn.disabled = false;
        btn.innerHTML = originalText;
        return;
    }
    const pricePromises = portfolio.holdings.map(h =>
        finnhubApiCall('quote', `symbol=${h.symbol}`).then(data => ({ id: h.id, price: data ? data.c : null }))
    );
    try {
        const results = await Promise.all(pricePromises);
        let pricesUpdated = false;
        results.forEach(result => {
            const holding = portfolio.holdings.find(h => h.id === result.id);
            if (holding && result.price && holding.current_price !== result.price) {
                holding.current_price = result.price;
                recalculateHolding(holding.id);
                pricesUpdated = true;
            }
        });
        if (pricesUpdated) {
            await saveDataToFirestore();
        }
    } catch (error) {
        console.error("Error updating prices:", error);
        alert("An error occurred while updating prices.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleGetAssetInfo(isEditMode) {
    const symbolInputId = isEditMode ? 'editAssetSymbol' : 'investmentSymbol';
    const nameInputId = isEditMode ? 'editAssetName' : 'investmentName';
    const typeSelectId = isEditMode ? 'editAssetType' : 'investmentType';
    const infoCardId = isEditMode ? 'editAssetInfoCard' : 'companyInfoCard';
    const infoContentId = isEditMode ? 'editAssetInfoContent' : 'companyInfoContent';
    const btnId = isEditMode ? 'getAssetInfoBtnEdit' : 'getAssetInfoBtn';

    const symbol = document.getElementById(symbolInputId).value.toUpperCase();
    if (!symbol) {
        alert("Please enter a symbol first.");
        return;
    }
    const btn = document.getElementById(btnId);
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    btn.disabled = true;

    const infoCard = document.getElementById(infoCardId);
    const infoContent = document.getElementById(infoContentId);

    try {
        const data = await finnhubApiCall('stock/profile2', `symbol=${symbol}`);
        if (!data || Object.keys(data).length === 0) throw new Error(`No data found for symbol "${symbol}".`);
        document.getElementById(nameInputId).value = data.name || '';
        document.getElementById(typeSelectId).value = data.finnhubIndustry === 'CRYPTOCURRENCY' ? 'Crypto' : 'Stock';
        infoContent.innerHTML = `<h6 class="card-title">${data.name} <span class="badge bg-secondary">${data.ticker}</span></h6><p class="card-text small mb-1"><strong>Industry:</strong> ${data.finnhubIndustry || 'N/A'}</p><p class="card-text small"><strong>Exchange:</strong> ${data.exchange || 'N/A'}</p>`;
        infoCard.classList.remove('d-none');
    } catch (error) {
        console.error("Error fetching asset info:", error);
        infoContent.innerHTML = `<p class="card-text text-danger">${error.message}</p>`;
        infoCard.classList.remove('d-none');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handlePortfolioAnalysis(e) {
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Analyzing...`;
    btn.disabled = true;
    
    // ... Logic for portfolio analysis ...

    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function handleNewsAnalysis(e) {
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Analyzing...`;
    btn.disabled = true;

    // ... Logic for news analysis ...

    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function handleRiskAnalysis(e) {
    e.preventDefault();
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Analyzing...`;
    btn.disabled = true;
    
    // ... Logic for risk analysis ...

    btn.innerHTML = originalText;
    btn.disabled = false;
}

async function handleStartAiAnalysis(type) {
    // ... Logic for AI Screener ...
}

async function showAssetProfile(holdingId) {
    await showSection('asset-profile');
    // renderAssetProfileData(holdingId); // This would be in renderer.js
}
