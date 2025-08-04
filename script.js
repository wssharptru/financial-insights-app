// script.js

// Firebase v9+ modular SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Import config directly from the config.js module
import { firebaseConfig, finnhubApiKey } from './config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ... the rest of your script.js code remains the same

// --- STATE MANAGEMENT --- //
let appData = {};
let currentUserId = null;
let unsubscribeFromFirestore = null; // To detach the listener on sign-out
let holdingIdToModify = null;
const PREF_DEFAULTS = {
    assetClasses: ["Stock", "ETF", "Bond", "Crypto", "Mutual Fund", "Other"],
    sectors: ["Technology", "Healthcare", "Financials", "Consumer Discretionary", "Industrials", "Green Energy", "No Fossil Fuels"]
};

const initialData = {
    user_profile: {
        name: "New User",
        risk_tolerance: "Moderate",
        investment_goals: ["Wealth Building"],
        available_capital: 50000,
        sub_goals: ["Long-term Growth"],
        asset_preferences: { preferred: ["Stock", "ETF"], excluded: [] },
        sector_preferences: { preferred: ["Technology", "Green Energy"], excluded: ["Fossil Fuels"] },
        tax_considerations: ["Tax-loss Harvesting"],
    },
    portfolios: [
        {
            id: Date.now(),
            name: "My First Portfolio",
            holdings: [],
            transactions: [],
        }
    ],
    activePortfolioId: null,
    insights: [
        {
            type: "opportunity",
            title: "Welcome to AI Finance!",
            description: "Add your first investment to see your portfolio dashboard and generate personalized AI insights."
        }
    ]
};
initialData.activePortfolioId = initialData.portfolios[0].id;

// --- DOM ELEMENTS --- //
const appWrapper = document.querySelector('.app-wrapper');
const sidebar = document.getElementById('sidebar');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navLinks = document.querySelectorAll('.nav-link');
const contentSections = document.querySelectorAll('.content-section');

// Modals
const investmentModalEl = document.getElementById('investmentModal');
const investmentModal = new bootstrap.Modal(investmentModalEl);
const editAssetModalEl = document.getElementById('editAssetModal');
const editAssetModal = new bootstrap.Modal(editAssetModalEl);
const transactionModalEl = document.getElementById('transactionModal');
const transactionModal = new bootstrap.Modal(transactionModalEl);
const portfolioModalEl = document.getElementById('portfolioModal');
const portfolioModal = new bootstrap.Modal(portfolioModalEl);
const deleteConfirmModalEl = document.getElementById('deleteConfirmModal');
const deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalEl);
const riskQuestionnaireModalEl = document.getElementById('riskQuestionnaireModal');
const riskQuestionnaireModal = new bootstrap.Modal(riskQuestionnaireModalEl);

// --- CHARTS --- //
let allocationChart = null;
let performanceChart = null;
Chart.register(ChartDataLabels);

// --- INITIALIZATION --- //
function init() {
    initializeAuth();
    initializeNavigation();
    initializeEventListeners();
}

function renderAll() {
    renderDashboard();
    renderPortfolioSelector();
    renderPortfolio();
    renderInsights();
    renderPreferences();
}

// --- DATA PERSISTENCE (FIRESTORE) --- //
function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] instanceof Object && key in target && !(source[key] instanceof Array)) {
            target[key] = deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

function loadDataFromFirestore(userId) {
    if (unsubscribeFromFirestore) {
        unsubscribeFromFirestore(); // Detach any previous listener
    }
    const userDocRef = doc(db, "users", userId);
    
    unsubscribeFromFirestore = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const loadedData = docSnap.data();
            // Merge with defaults to ensure new properties are added for existing users
            appData = deepMerge(JSON.parse(JSON.stringify(initialData)), loadedData);
            renderAll();
        } else {
            // First time user, create their document
            appData = JSON.parse(JSON.stringify(initialData));
            setDoc(userDocRef, appData).then(() => {
                renderAll();
            });
        }
    });
}

async function saveDataToFirestore() {
    if (!currentUserId) return;
    const userDocRef = doc(db, "users", currentUserId);
    await setDoc(userDocRef, appData, { merge: true });
}

// --- HELPERS --- //
function getActivePortfolio() {
    if (!appData.portfolios || appData.portfolios.length === 0) {
        const newPortfolio = { id: Date.now(), name: "My First Portfolio", holdings: [], transactions: [] };
        appData.portfolios = [newPortfolio];
        appData.activePortfolioId = newPortfolio.id;
        saveDataToFirestore();
        return newPortfolio;
    }
    const activePortfolio = appData.portfolios.find(p => p.id === appData.activePortfolioId);
    if (!activePortfolio) {
        appData.activePortfolioId = appData.portfolios[0].id;
        return appData.portfolios[0];
    }
    return activePortfolio;
}

// --- NAVIGATION --- //
function initializeNavigation() {
    mobileMenuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            if (section) { // Ensure it's a valid link
                showSection(section);
                sidebar.classList.remove('show');
            }
        });
    });
    document.addEventListener('click', e => {
        if (!sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    });
}

function showSection(sectionName) {
    contentSections.forEach(section => section.classList.remove('active'));
    document.getElementById(sectionName)?.classList.add('active');
    navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-section="${sectionName}"]`)?.classList.add('active');
}

// --- EVENT LISTENERS --- //
function initializeEventListeners() {
    // Auth
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    document.getElementById('show-signup').addEventListener('click', toggleAuthForms);
    document.getElementById('show-login').addEventListener('click', toggleAuthForms);
    document.getElementById('signOutBtn').addEventListener('click', () => signOut(auth));
    document.getElementById('toggleLoginPassword').addEventListener('click', () => togglePasswordVisibility('loginPassword', 'toggleLoginPassword'));
    document.getElementById('toggleSignupPassword').addEventListener('click', () => togglePasswordVisibility('signupPassword', 'toggleSignupPassword'));

    // Main buttons
    document.getElementById('addInvestmentBtnPortfolio').addEventListener('click', () => openInvestmentModal());
    document.getElementById('createPortfolioBtn').addEventListener('click', openPortfolioModalForCreate);
    document.getElementById('editPortfolioNameBtn').addEventListener('click', openPortfolioModalForEdit);
    document.getElementById('savePortfolioBtn').addEventListener('click', handleSavePortfolio);
    document.getElementById('portfolioSelector').addEventListener('change', handlePortfolioChange);
    document.getElementById('updatePricesBtn').addEventListener('click', handleUpdatePrices);

    // Modals & Forms
    document.getElementById('saveInvestmentBtn').addEventListener('click', handleSaveInvestment);
    document.getElementById('saveAssetEditBtn').addEventListener('click', handleSaveAssetEdit);
    document.getElementById('transactionForm').addEventListener('submit', handleSaveTransaction);
    document.getElementById('preferencesForm').addEventListener('submit', handleSavePreferences);
    document.getElementById('confirmDeleteBtn').addEventListener('click', handleDeleteHolding);
    document.getElementById('openQuestionnaireBtn').addEventListener('click', () => riskQuestionnaireModal.show());
    document.getElementById('submitQuestionnaireBtn').addEventListener('click', handleRiskAnalysis);

    // AI & Data Buttons
    document.getElementById('generateInsightsBtn').addEventListener('click', handlePortfolioAnalysis);
    document.getElementById('getNewsAnalysisBtn').addEventListener('click', handleNewsAnalysis);
    document.getElementById('getAssetInfoBtn').addEventListener('click', handleGetAssetInfo);
    document.getElementById('getAssetInfoBtnEdit').addEventListener('click', handleGetAssetInfoForEdit);

    // Dynamic content listeners
    document.getElementById('portfolioContent').addEventListener('click', (e) => {
        const assetLink = e.target.closest('.asset-symbol-link');
        const transactionBtn = e.target.closest('.transaction-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        const editBtn = e.target.closest('.edit-btn');
        
        if (assetLink) {
            e.preventDefault();
            const holdingId = parseInt(assetLink.dataset.id);
            showAssetProfile(holdingId);
        } else if (transactionBtn) {
             e.stopPropagation();
            const holdingId = parseInt(transactionBtn.dataset.id);
            openTransactionModal(holdingId);
        } else if (deleteBtn) {
            e.stopPropagation(); 
            holdingIdToModify = parseInt(deleteBtn.dataset.id);
            deleteConfirmModal.show();
        } else if (editBtn) {
            e.stopPropagation();
            holdingIdToModify = parseInt(editBtn.dataset.id);
            openEditAssetModal(holdingIdToModify);
        }
    });
    
    document.getElementById('assetProfileContent').addEventListener('click', (e) => {
        if (e.target.matches('#backToPortfolioBtn, #backToPortfolioBtn *')) {
            showSection('portfolio');
        }
    });

    document.addEventListener('click', (e) => {
        if(e.target.matches('#addInvestmentBtnDashboard, #addInvestmentBtnEmpty')) {
            openInvestmentModal();
        }
    });
}

// --- AUTHENTICATION --- //
function initializeAuth() {
    onAuthStateChanged(auth, user => {
        if (user) {
            // User is signed in
            currentUserId = user.uid;
            appWrapper.classList.remove('logged-out');
            appWrapper.classList.add('logged-in');
            loadDataFromFirestore(currentUserId);
        } else {
            // User is signed out
            currentUserId = null;
            if (unsubscribeFromFirestore) unsubscribeFromFirestore();
            appData = {};
            appWrapper.classList.add('logged-out');
            appWrapper.classList.remove('logged-in');
        }
    });
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => {
            document.getElementById('login-error').textContent = error.message;
            document.getElementById('login-error').classList.remove('d-none');
        });
}

function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    createUserWithEmailAndPassword(auth, email, password)
        .catch(error => {
            document.getElementById('signup-error').textContent = error.message;
            document.getElementById('signup-error').classList.remove('d-none');
        });
}

function toggleAuthForms(e) {
    e.preventDefault();
    const isShowingLogin = !document.getElementById('loginForm').classList.contains('d-none');
    if (isShowingLogin) {
        document.getElementById('loginForm').classList.add('d-none');
        document.getElementById('signupForm').classList.remove('d-none');
    } else {
        document.getElementById('loginForm').classList.remove('d-none');
        document.getElementById('signupForm').add('d-none');
    }
    document.getElementById('login-error').classList.add('d-none');
    document.getElementById('signup-error').classList.add('d-none');
}

function togglePasswordVisibility(passwordInputId, toggleButtonId) {
    const passwordInput = document.getElementById(passwordInputId);
    const toggleButton = document.getElementById(toggleButtonId);
    const icon = toggleButton.querySelector('i');

    // Toggle the type
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);

    // Toggle the icon
    if (type === 'password') {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    } else {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
}

// --- RENDERING FUNCTIONS --- //
function renderDashboard() {
    const container = document.getElementById('dashboardContent');
    const portfolio = getActivePortfolio();
    
    document.getElementById('dashboard-portfolio-name').textContent = `A real-time overview of your '${portfolio.name}' portfolio.`;

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
            <div class="col-lg-6 mb-4"><div class="card"><div class="card__body"><h5 class="card-title">Portfolio Performance</h5><div style="position: relative; height: 300px;"><canvas id="performanceChart"></canvas></div></div></div></div>
        </div>`;
    initializeCharts(portfolio);
}

function renderPortfolioSelector() {
    const selector = document.getElementById('portfolioSelector');
    selector.innerHTML = (appData.portfolios || []).map(p => `<option value="${p.id}" ${p.id === appData.activePortfolioId ? 'selected' : ''}>${p.name}</option>`).join('');
}

function renderPortfolio() {
    const container = document.getElementById('portfolioContent');
    const portfolio = getActivePortfolio();

     if (!portfolio.holdings || portfolio.holdings.length === 0) {
        container.innerHTML = `<p class="text-center text-muted mt-4">No investments added yet. Click "Add Investment" to start.</p>`;
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

    container.innerHTML = `<div class="card"><div class="card__body p-0"><div class="table-responsive"><table class="table table-hover"><thead><tr><th>Symbol</th><th>Shares</th><th>Current Price</th><th>Total Value</th><th>Gain/Loss</th><th>Type</th><th>Actions</th></tr></thead><tbody>${holdingsRows}</tbody></table></div></div></div>`;
}

function renderInsights() {
    const container = document.getElementById('insightsContainer');
    const insightsCards = (appData.insights || []).map(insight => {
        const iconMap = { rebalance: 'fa-balance-scale', performance: 'fa-chart-line', risk: 'fa-shield-alt', opportunity: 'fa-lightbulb', news: 'fa-newspaper' };
        const iconClass = iconMap[insight.type] || 'fa-info-circle';
        return `<div class="col-md-6 col-lg-4 mb-4"><div class="insight-card"><div class="insight-header"><div class="insight-icon ${insight.type || 'default'}"><i class="fas ${iconClass}"></i></div><h6 class="insight-title">${insight.title}</h6></div><p class="insight-description">${insight.description}</p></div></div>`;
    }).join('');
    container.innerHTML = insightsCards.length > 0 ? insightsCards : '<p class="text-center text-muted">No insights available. Generate new insights based on your portfolio.</p>';
}

function renderPreferences() {
    const profile = appData.user_profile;
    if (!profile) return;
    document.getElementById('riskTolerance').value = profile.risk_tolerance;
    document.getElementById('investmentCapital').value = profile.available_capital || '';
    renderCheckboxGroup('subInvestmentGoals', profile.sub_goals || []);
    renderCheckboxGroup('taxConsiderations', profile.tax_considerations || []);
    renderPreferenceGroup('assetClassPrefs', PREF_DEFAULTS.assetClasses, profile.asset_preferences);
    renderPreferenceGroup('sectorPrefs', PREF_DEFAULTS.sectors, profile.sector_preferences);
}

function renderCheckboxGroup(containerId, checkedItems) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('.form-check-input').forEach(checkbox => {
        checkbox.checked = checkedItems.includes(checkbox.value);
    });
}

function renderPreferenceGroup(containerId, allItems, preferences) {
    const container = document.getElementById(containerId);
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

function renderTransactionHistory(holdingId) {
    const portfolio = getActivePortfolio();
    const holding = portfolio.holdings.find(h => h.id === holdingId);
    const container = document.getElementById('transactionHistoryContainer');
    document.getElementById('transactionHistorySymbol').textContent = holding.symbol;
    const transactions = (portfolio.transactions || []).filter(t => t.holdingId === holdingId).sort((a, b) => new Date(b.date) - new Date(a.date));
    if (transactions.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No transactions recorded for this asset yet.</p>';
        return;
    }
    container.innerHTML = `<table class="table table-sm"><tbody>${transactions.map(t => `<tr><td>${new Date(t.date).toLocaleDateString()}</td><td><span class="badge bg-${t.type.toLowerCase()}">${t.type}</span></td><td>${t.type !== 'Dividend' ? `${t.shares} @ ${formatCurrency(t.price)}` : ''}</td><td class="text-end"><strong>${formatCurrency(t.total)}</strong></td></tr>`).join('')}</tbody></table>`;
}

// --- CHARTING --- //
function initializeCharts(portfolio) {
    initializeAllocationChart(portfolio);
    initializePerformanceChart(portfolio);
}

function initializeAllocationChart(portfolio) {
    const ctx = document.getElementById('allocationChart')?.getContext('2d');
    if (!ctx) return;
    const allocation = {};
    (portfolio.holdings || []).forEach(h => {
        allocation[h.asset_type] = (allocation[h.asset_type] || 0) + h.total_value;
    });
    if (allocationChart) allocationChart.destroy();
    allocationChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(allocation),
            datasets: [{ data: Object.values(allocation), backgroundColor: ['#2196F3', '#4CAF50', '#FFC107', '#E91E63', '#9C27B0', '#607D8B'], borderWidth: 2, borderColor: 'var(--color-surface)' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (value, ctx) => { const datapoints = ctx.chart.data.datasets[0].data; const total = datapoints.reduce((total, datapoint) => total + datapoint, 0); const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0; return `${ctx.chart.data.labels[ctx.dataIndex]}\n${percentage}%`; }, color: '#fff', font: { weight: 'bold', size: 12, }, textShadowColor: 'rgba(0,0,0,0.3)', textShadowBlur: 4, } } }
    });
}

function initializePerformanceChart(portfolio) {
     const ctx = document.getElementById('performanceChart')?.getContext('2d');
    if (!ctx) return;
    const performanceData = generatePerformanceData(portfolio);
    if (performanceChart) performanceChart.destroy();
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: performanceData.map(p => p.date),
            datasets: [{ label: 'Portfolio Value', data: performanceData.map(p => p.value), borderColor: 'var(--color-primary)', borderWidth: 3, fill: false, tension: 0.1, pointRadius: 4, pointBackgroundColor: 'var(--color-primary)' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } }, scales: { y: { ticks: { callback: value => formatCurrency(value) } }, x: { ticks: { maxRotation: 45, minRotation: 45 } } } }
    });
}

// --- CORE LOGIC & HANDLERS --- //
function openInvestmentModal() {
    const portfolio = getActivePortfolio();
    document.getElementById('investmentForm').reset();
    document.getElementById('investmentDate').valueAsDate = new Date();
    document.getElementById('modalPortfolioName').textContent = portfolio.name;
    document.getElementById('companyInfoCard').classList.add('d-none');
    document.getElementById('companyInfoContent').innerHTML = '';
    investmentModal.show();
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
    editAssetModal.show();
}

function openTransactionModal(holdingId) {
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionDate').valueAsDate = new Date();
    document.getElementById('transactionHoldingId').value = holdingId;
    renderTransactionHistory(holdingId);
    transactionModal.show();
}

function openPortfolioModalForCreate() {
    document.getElementById('portfolioForm').reset();
    document.getElementById('editPortfolioId').value = '';
    document.getElementById('portfolioModalTitle').textContent = 'Create New Portfolio';
    portfolioModal.show();
}

function openPortfolioModalForEdit() {
    const portfolio = getActivePortfolio();
    if (!portfolio) return;
    document.getElementById('portfolioForm').reset();
    document.getElementById('editPortfolioId').value = portfolio.id;
    document.getElementById('portfolioName').value = portfolio.name;
    document.getElementById('portfolioModalTitle').textContent = 'Edit Portfolio Name';
    portfolioModal.show();
}

function handlePortfolioChange(e) {
    appData.activePortfolioId = parseInt(e.target.value);
    saveDataToFirestore();
}

function handleSavePortfolio() {
    const portfolioId = document.getElementById('editPortfolioId').value;
    const nameInput = document.getElementById('portfolioName');
    const name = nameInput.value.trim();
    if (!name) return;

    if (portfolioId) { // Editing existing
        const portfolio = appData.portfolios.find(p => p.id == portfolioId);
        if (portfolio) portfolio.name = name;
    } else { // Creating new
        const newPortfolio = { id: Date.now(), name: name, holdings: [], transactions: [] };
        appData.portfolios.push(newPortfolio);
        appData.activePortfolioId = newPortfolio.id;
    }
    saveDataToFirestore();
    portfolioModal.hide();
}

function handleSaveInvestment() {
    const portfolio = getActivePortfolio();
    const transactionData = {
        type: 'Buy',
        date: document.getElementById('investmentDate').value,
        shares: parseFloat(document.getElementById('investmentShares').value),
        price: parseFloat(document.getElementById('investmentPrice').value)
    };
    if (!transactionData.date || !transactionData.shares || !transactionData.price) { alert("Please fill all purchase details: Shares, Price, and Date."); return; }
    
    const newHolding = {
        id: Date.now(),
        symbol: document.getElementById('investmentSymbol').value.toUpperCase(),
        name: document.getElementById('investmentName').value,
        asset_type: document.getElementById('investmentType').value,
        current_price: transactionData.price,
        shares: 0, average_cost: 0, total_value: 0, gain_loss: 0, gain_loss_percent: 0, fundamentals: null
    };
    if(!newHolding.symbol || !newHolding.name) { alert("Please fill out at least the Symbol and Name."); return; }
    if (portfolio.holdings.find(h => h.symbol === newHolding.symbol)) { alert(`Asset with symbol ${newHolding.symbol} already exists. Please add transactions to the existing asset.`); return; }
    
    portfolio.holdings.push(newHolding);
    
    transactionData.holdingId = newHolding.id;
    transactionData.total = transactionData.shares * transactionData.price;
    if (!portfolio.transactions) portfolio.transactions = [];
    portfolio.transactions.push(transactionData);

    recalculateHolding(newHolding.id);
    saveDataToFirestore();
    investmentModal.hide();
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
    editAssetModal.hide();
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
    if (!transactionData.date || !transactionData.shares || (!transactionData.price && transactionData.type !== 'Dividend')) { alert("Please fill all required fields."); return; }
    transactionData.total = transactionData.type === 'Dividend' ? transactionData.shares : transactionData.shares * transactionData.price;
    if (transactionData.type === 'Sell') {
        const holding = portfolio.holdings.find(h => h.id === holdingId);
        if (transactionData.shares > holding.shares) { alert(`Cannot sell more shares (${transactionData.shares}) than you own (${holding.shares}).`); return; }
    }
    if (!portfolio.transactions) portfolio.transactions = [];
    portfolio.transactions.push(transactionData);

    const holding = portfolio.holdings.find(h => h.id === holdingId);
    if (holding && transactionData.type !== 'Dividend') {
        holding.current_price = transactionData.price;
    }

    recalculateHolding(holdingId);
    saveDataToFirestore();
    renderTransactionHistory(holdingId);
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionDate').valueAsDate = new Date();
}

function handleDeleteHolding() {
    if (holdingIdToModify === null) return;
    const portfolio = getActivePortfolio();
    portfolio.holdings = portfolio.holdings.filter(h => h.id !== holdingIdToModify);
    portfolio.transactions = portfolio.transactions.filter(t => t.holdingId !== holdingIdToModify);
    holdingIdToModify = null;
    saveDataToFirestore();
    deleteConfirmModal.hide();
}

function handleSavePreferences(e) {
    e.preventDefault();
    const profile = appData.user_profile;
    profile.risk_tolerance = document.getElementById('riskTolerance').value;
    profile.available_capital = parseFloat(document.getElementById('investmentCapital').value) || 0;
    profile.sub_goals = getCheckedValues('subInvestmentGoals');
    profile.tax_considerations = getCheckedValues('taxConsiderations');
    profile.asset_preferences = getPreferenceValues('assetClassPrefs');
    profile.sector_preferences = getPreferenceValues('sectorPrefs');
    saveDataToFirestore();
    const msgEl = document.getElementById('preferencesMessage');
    msgEl.innerHTML = `<div class="alert alert-success" role="alert">Preferences saved successfully!</div>`;
    setTimeout(() => msgEl.innerHTML = '', 3000);
}

function getCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

function getPreferenceValues(containerId) {
    const container = document.getElementById(containerId);
    const preferences = { preferred: [], excluded: [] };
    container.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
        if (radio.dataset.type === 'preferred') {
            preferences.preferred.push(radio.dataset.item);
        } else if (radio.dataset.type === 'excluded') {
            preferences.excluded.push(radio.dataset.item);
        }
    });
    return preferences;
}

// --- CALCULATION LOGIC --- //
function recalculateHolding(holdingId) {
    const portfolio = getActivePortfolio();
    const holding = portfolio.holdings.find(h => h.id === holdingId);
    if (!holding) return;

    const transactions = portfolio.transactions.filter(t => t.holdingId === holdingId);
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

function calculatePortfolioMetrics(portfolio) {
    if (!portfolio || !portfolio.holdings) return { totalValue: 0, dailyChange: 0, dailyChangePercent: 0 };
    const totalValue = portfolio.holdings.reduce((sum, h) => sum + h.total_value, 0);
    const totalGainLoss = portfolio.holdings.reduce((sum, h) => sum + h.gain_loss, 0);
    const totalInvested = portfolio.holdings.reduce((sum, h) => sum + (h.average_cost * h.shares), 0);
    return {
        totalValue: totalValue,
        dailyChange: totalGainLoss, // Simplified to total gain/loss
        dailyChangePercent: totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0
    };
}

function generatePerformanceData(portfolio) {
    const transactions = (portfolio.transactions || []).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (transactions.length === 0) return [];
    
    const performancePoints = [];
    const uniqueDates = [...new Set(transactions.map(t => t.date))].sort();

    let tempHoldings = {}; // { holdingId: { shares: X, price: Y } }

    uniqueDates.forEach(date => {
        const todaysTransactions = transactions.filter(t => t.date === date);

        todaysTransactions.forEach(t => {
            if (!tempHoldings[t.holdingId]) {
                tempHoldings[t.holdingId] = { shares: 0, price: 0 };
            }
            if (t.type === 'Buy') {
                tempHoldings[t.holdingId].shares += t.shares;
            } else if (t.type === 'Sell') {
                tempHoldings[t.holdingId].shares -= t.shares;
            }
            if (t.type !== 'Dividend') {
                tempHoldings[t.holdingId].price = t.price;
            }
        });

        const totalValue = Object.values(tempHoldings).reduce((sum, h) => sum + (h.shares * h.price), 0);
        performancePoints.push({
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: totalValue
        });
    });

    return performancePoints;
}

// --- GEMINI & FINNHUB API HANDLERS --- //

async function handleGetAssetInfo() {
    const symbol = document.getElementById('investmentSymbol').value.toUpperCase();
    if (!symbol) { alert("Please enter a symbol first."); return; }

    const btn = document.getElementById('getAssetInfoBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    btn.disabled = true;

    const infoCard = document.getElementById('companyInfoCard');
    const infoContent = document.getElementById('companyInfoContent');

    try {
        const data = await finnhubApiCall('stock/profile2', `symbol=${symbol}`);
        if (!data) throw new Error(`No data found for symbol "${symbol}". It may be invalid or not supported.`);

        document.getElementById('investmentName').value = data.name || '';
        document.getElementById('investmentType').value = data.finnhubIndustry === 'CRYPTOCURRENCY' ? 'Crypto' : 'Stock';
        
        infoContent.innerHTML = `
            <h6 class="card-title">${data.name} <span class="badge bg-secondary">${data.ticker}</span></h6>
            <p class="card-text small mb-1"><strong>Industry:</strong> ${data.finnhubIndustry || 'N/A'}</p>
            <p class="card-text small"><strong>Exchange:</strong> ${data.exchange || 'N/A'}</p>`;
        infoCard.classList.remove('d-none');

    } catch (error) {
        console.error("Error fetching asset info from Finnhub:", error);
        infoContent.innerHTML = `<p class="card-text text-danger">${error.message}</p>`;
        infoCard.classList.remove('d-none');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleGetAssetInfoForEdit() {
    const symbol = document.getElementById('editAssetSymbol').value.toUpperCase();
    if (!symbol) { alert("Please enter a symbol first."); return; }

    const btn = document.getElementById('getAssetInfoBtnEdit');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    btn.disabled = true;

    const infoCard = document.getElementById('editAssetInfoCard');
    const infoContent = document.getElementById('editAssetInfoContent');

    try {
        const data = await finnhubApiCall('stock/profile2', `symbol=${symbol}`);
        if (!data) throw new Error(`No data found for symbol "${symbol}". It may be invalid or not supported.`);

        document.getElementById('editAssetName').value = data.name || '';
        document.getElementById('editAssetType').value = data.finnhubIndustry === 'CRYPTOCURRENCY' ? 'Crypto' : 'Stock';

        infoContent.innerHTML = `
            <h6 class="card-title">${data.name} <span class="badge bg-secondary">${data.ticker}</span></h6>
            <p class="card-text small mb-1"><strong>Industry:</strong> ${data.finnhubIndustry || 'N/A'}</p>
            <p class="card-text small"><strong>Exchange:</strong> ${data.exchange || 'N/A'}</p>`;
        infoCard.classList.remove('d-none');

    } catch (error) {
        console.error("Error fetching asset info from Finnhub:", error);
        infoContent.innerHTML = `<p class="card-text text-danger">${error.message}</p>`;
        infoCard.classList.remove('d-none');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handlePortfolioAnalysis() {
    const btn = document.getElementById('generateInsightsBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Analyzing...`;
    btn.disabled = true;
    const portfolio = getActivePortfolio();
    const { totalValue } = calculatePortfolioMetrics(portfolio);
    const portfolioSummary = `Analyze the following investment portfolio named '${portfolio.name}' and provide 3-4 actionable insights. The user's risk tolerance is "${appData.user_profile.risk_tolerance}" and their goals are "${(appData.user_profile.sub_goals || []).join(', ')}". Total Portfolio Value: ${formatCurrency(totalValue)}. Holdings: ${portfolio.holdings.map(h => `- ${h.shares} shares of ${h.symbol} (${h.name}), type: ${h.asset_type}, current value: ${formatCurrency(h.total_value)}`).join('\n')}. For each insight, provide a 'type' (one of: rebalance, performance, risk, opportunity), a short 'title', and a one-sentence 'description'. Format the output as a JSON array of objects.`;
    try {
        const newInsights = await generateContent(portfolioSummary, { responseMimeType: "application/json", responseSchema: { type: "ARRAY", items: { type: "OBJECT", properties: { "type": { "type": "STRING" }, "title": { "type": "STRING" }, "description": { "type": "STRING" } }, required: ["type", "title", "description"] } } });
        appData.insights = newInsights;
        saveDataToFirestore();
    } catch (error) {
        console.error("Error generating insights:", error);
        appData.insights.unshift({ type: 'risk', title: 'Error', description: 'Could not generate portfolio insights at this time.' });
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleNewsAnalysis() {
    const btn = document.getElementById('getNewsAnalysisBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Analyzing...`;
    btn.disabled = true;
    const prompt = `Act as a financial analyst. Provide a summary of the top 3-4 financial news headlines for today. For each, briefly explain the potential impact on the market. Present each as an insight with a 'type' of "news", a 'title' from the headline, and a 'description' with the analysis. Format as a JSON array of objects.`;
    try {
        const newsInsights = await generateContent(prompt, { responseMimeType: "application/json", responseSchema: { type: "ARRAY", items: { type: "OBJECT", properties: { "type": { "type": "STRING" }, "title": { "type": "STRING" }, "description": { "type": "STRING" } }, required: ["type", "title", "description"] } } });
        appData.insights = [...newsInsights, ...appData.insights.filter(i => i.type !== 'news')];
        saveDataToFirestore();
    } catch (error) {
        console.error("Error generating news analysis:", error);
         appData.insights.unshift({ type: 'risk', title: 'Error', description: 'Could not generate news analysis at this time.' });
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function handleRiskAnalysis(e) {
    e.preventDefault();
    const btn = document.getElementById('submitQuestionnaireBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Analyzing...`;
    btn.disabled = true;

    const form = document.getElementById('riskQuestionnaireForm');
    const formData = new FormData(form);
    let answers = "";
    for (const [key, value] of formData.entries()) {
        const label = form.querySelector(`input[name="${key}"][value="${value}"]`).closest('.form-check').querySelector('.form-check-label').textContent;
        const question = form.querySelector(`input[name="${key}"]`).closest('.mb-3').querySelector('.form-label').textContent;
        answers += `${question}\nAnswer: ${label}\n\n`;
    }

    const prompt = `Based on the following answers to a risk tolerance questionnaire, determine the user's risk tolerance level (Low, Moderate, or High) and provide a brief, one-sentence justification. \n\n${answers} \n\nReturn the result as a single JSON object with keys "riskTolerance" and "justification". The riskTolerance value must be one of "Low", "Moderate", or "High".`;

    const resultContainer = document.getElementById('riskAnalysisResult');
    try {
        const result = await generateContent(prompt, { responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { "riskTolerance": { "type": "STRING" }, "justification": { "type": "STRING" } }, required: ["riskTolerance", "justification"] } });
        document.getElementById('riskTolerance').value = result.riskTolerance;
        resultContainer.innerHTML = `<i class="fas fa-check-circle text-success me-1"></i><strong>AI Assessment:</strong> ${result.justification}`;
        riskQuestionnaireModal.hide();
    } catch (error) {
        console.error("Error performing risk analysis:", error);
        resultContainer.innerHTML = `<i class="fas fa-times-circle text-danger me-1"></i>Could not perform analysis. Please try again.`;
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function generateContent(prompt, generationConfig = {}) {
    // Using a proxy for Gemini API for security and to avoid exposing keys on the client-side.
    // This proxy should be configured on your server.
    const url = 'https://gemini-proxy-835285817704.us-east4.run.app/'; 
    const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig };
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) { const errorBody = await response.text(); console.error("API Error Response:", errorBody); throw new Error(`API call failed with status: ${response.status}`); }
    const result = await response.json();
    const part = result?.candidates?.[0]?.content?.parts?.[0];
    if (!part || !part.text) { console.error("Invalid API response structure:", JSON.stringify(result, null, 2)); throw new Error("Invalid response from API: No text part found."); }
    return JSON.parse(part.text);
}

// --- FINNHUB API --- //
async function finnhubApiCall(endpoint, params) {
    const apiKey = finnhubApiKey.trim();
     if (!apiKey || apiKey === "finnhubApiKey") {
        console.error("Finnhub API key is not configured. Please set it up in your deployment secrets.");
        return null;
    }
    const url = `https://finnhub.io/api/v1/${endpoint}?${params}&token=${apiKey}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Finnhub API error for ${endpoint}: ${response.statusText}`);
            return null;
        }
        const data = await response.json();
        // Finnhub returns an empty object for some invalid symbols, so we check if it's not empty
        if (Object.keys(data).length === 0) {
            console.warn(`No data returned from Finnhub for ${endpoint} with params: ${params}`);
            return null;
        }
        return data;
    } catch (error) {
        console.error(`Error fetching from Finnhub (${endpoint}):`, error);
        return null;
    }
}

async function handleUpdatePrices(e) {
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Updating...`;
    btn.disabled = true;
    
    const portfolio = getActivePortfolio();
    const pricePromises = portfolio.holdings.map(h => 
        finnhubApiCall('quote', `symbol=${h.symbol}`)
            .then(data => ({ id: h.id, price: data ? data.c : null }))
    );

    try {
        const results = await Promise.all(pricePromises);
        results.forEach(result => {
            const holding = portfolio.holdings.find(h => h.id === result.id);
            if (holding && result.price) {
                holding.current_price = result.price;
            }
        });
        portfolio.holdings.forEach(h => recalculateHolding(h.id));
        await saveDataToFirestore();
    } catch (error) {
        console.error("Error updating prices:", error);
        alert("An error occurred while updating prices. Please check your API key and network connection.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// --- ASSET PROFILE PAGE --- //
async function showAssetProfile(holdingId) {
    const portfolio = getActivePortfolio();
    const holding = portfolio.holdings.find(h => h.id === holdingId);
    if (!holding) return;

    showSection('asset-profile');
    const container = document.getElementById('assetProfileContent');
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <button class="btn btn--secondary" id="backToPortfolioBtn"><i class="fas fa-arrow-left me-2"></i>Back to Portfolio</button>
        </div>
        <div class="spinner-container card"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>
    `;

    // Fetch all data in parallel
    const [profile, quote, financials, earnings] = await Promise.all([
        finnhubApiCall('stock/profile2', `symbol=${holding.symbol}`),
        finnhubApiCall('quote', `symbol=${holding.symbol}`),
        finnhubApiCall('stock/metric', `symbol=${holding.symbol}&metric=all`),
        finnhubApiCall('calendar/earnings', `symbol=${holding.symbol}`)
    ]);
    
    renderAssetProfileData(container, { profile, quote, financials, earnings });
    
    // Now, trigger Gemini analysis
    const geminiContainer = document.getElementById('geminiAnalysisContainer');
    if (geminiContainer) {
         try {
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

            const analysis = await generateContent(prompt, schema);
            renderGeminiAnalysis(geminiContainer, analysis);

        } catch (error) {
            console.error("Error generating Gemini analysis:", error);
            geminiContainer.innerHTML = `<div class="alert alert-danger">Could not generate AI analysis at this time. ${error.message}</div>`;
        }
    }
}

function renderAssetProfileData(container, data) {
    const { profile, quote, financials, earnings } = data;

    const quoteChangeClass = quote?.d >= 0 ? 'gain-positive' : 'gain-negative';
    const quoteChangeSign = quote?.d >= 0 ? '+' : '';

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
             <button class="btn btn--secondary" id="backToPortfolioBtn"><i class="fas fa-arrow-left me-2"></i>Back to Portfolio</button>
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
                     <div class="card-header d-flex align-items-center">
                        <i class="fas fa-brain me-2 text-primary"></i>
                        <h5>AI-Powered Analysis</h5>
                    </div>
                    <div class="card-body" id="geminiAnalysisContainer">
                        <div class="spinner-container">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Generating analysis...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderGeminiAnalysis(container, analysis) {
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
        ${analysis.news && analysis.news.length > 0 ? `
            <ul class="list-group list-group-flush">
                ${analysis.news.map(item => `<li class="list-group-item">${item}</li>`).join('')}
            </ul>
        ` : '<p class="text-secondary">No recent news found.</p>'}
    `;
}

function createGeminiPrompt(data) {
    const { profile, quote, financials, earnings } = data;
    // Sanitize and format the data to be clean for the prompt
    const profileData = `Company: ${profile?.name}, Ticker: ${profile?.ticker}, Industry: ${profile?.finnhubIndustry}.`;
    const quoteData = `Current Price: ${quote?.c}, Daily Change: ${quote?.d}, Percent Change: ${quote?.dp}%.`;
    const financialsData = `Market Cap: ${financials?.metric?.marketCapitalization}M, P/E Ratio: ${financials?.metric?.peNormalizedAnnual}, EPS: ${financials?.metric?.epsNormalizedAnnual}, 52-Week High: ${financials?.metric?.['52WeekHigh']}, 52-Week Low: ${financials?.metric?.['52WeekLow']}.`;
    const earningsData = earnings?.earningsCalendar?.[0] ? `Next earnings date: ${earnings.earningsCalendar[0].date}, EPS Estimate: ${earnings.earningsCalendar[0].epsEstimate}.` : "No upcoming earnings data.";

    return `
        You are a financial analyst AI. Analyze the following company based on the provided data and a search of recent news.
        
        **Company Data:**
        - Profile: ${profileData}
        - Quote: ${quoteData}
        - Key Financials: ${financialsData}
        - Earnings Info: ${earningsData}

        **Instructions:**
        1.  Provide a comprehensive summary of the company's current financial health and market position.
        2.  Search for the latest news about this company (${profile?.name} / ${profile?.ticker}). Summarize the top 2-3 most impactful news items.
        3.  Based on all available information (the data provided and the news), give a clear investment recommendation. The recommendation must be one of: "Buy", "Sell", or "Hold".
        4.  State your confidence level in this recommendation. The confidence level must be one of: "Low", "Medium", or "High".
        5.  Provide a concise paragraph explaining the reasoning behind your recommendation, referencing both the data and the news.

        Return the entire analysis as a single JSON object.
    `;
}

// --- UTILITY FUNCTIONS --- //
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
}

// --- START THE APP --- //
init();
