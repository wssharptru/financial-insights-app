// assets/js/event-listeners.js

import { appState } from './main.js';
import { saveDataToFirestore } from './firestore.js';
import { getActivePortfolio, recalculateHolding } from './portfolio-logic.js';
import { finnhubApiCall, generateContent, getCheckedValues, getPreferenceValues, formatCurrency, fmpApiCall } from './utils.js';
import { showSection } from './navigation.js';
import { renderAll } from './renderer.js';
import { handleShowAssetProfile } from './asset-profile.js';
// Import only the rendering function from budget.js
import { renderBudgetTool } from './budget.js';

let budgetModals = {
    income: null,
    expense: null,
    categoryManager: null
};

/**
 * Initializes all primary event listeners for the application.
 */
export function initializeEventListeners() {
    // Initialize modal instances once the DOM is fully loaded and partials are injected
    setTimeout(() => {
        const incomeModalEl = document.getElementById('incomeModal');
        const expenseModalEl = document.getElementById('expenseModal');
        const categoryModalEl = document.getElementById('categoryManagementModal');
        if (incomeModalEl) budgetModals.income = new bootstrap.Modal(incomeModalEl);
        if (expenseModalEl) budgetModals.expense = new bootstrap.Modal(expenseModalEl);
        if (categoryModalEl) {
            budgetModals.categoryManager = new bootstrap.Modal(categoryModalEl);
            categoryModalEl.addEventListener('hidden.bs.modal', () => populateCategoryDropdowns());
        }
    }, 1000); // Delay to ensure HTML is injected

    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const targetId = e.target.id;
        const targetClosest = (selector) => e.target.closest(selector);

        // --- Portfolio Page Buttons ---
        if (targetId === 'addInvestmentBtnPortfolio' || targetId === 'addInvestmentBtnDashboard' || targetId === 'addInvestmentBtnEmpty') openInvestmentModal();
        if (targetId === 'createPortfolioBtn') openPortfolioModalForCreate();
        if (targetClosest('#editPortfolioNameBtn')) openPortfolioModalForEdit();
        if (targetId === 'updatePricesBtn') handleUpdatePrices(e);

        // --- Modal Save/Confirm Buttons ---
        if (targetId === 'savePortfolioBtn') handleSavePortfolio();
        if (targetId === 'saveInvestmentBtn') handleSaveInvestment();
        if (targetId === 'saveAssetEditBtn') handleSaveAssetEdit();
        if (targetId === 'confirmDeleteBtn') handleConfirmDelete();
        if (targetId === 'deletePortfolioBtn') handleDeletePortfolio();

        // --- Asset Info Buttons ---
        if (targetId === 'getAssetInfoBtn') handleGetAssetInfo(false);
        if (targetId === 'getAssetInfoBtnEdit') handleGetAssetInfo(true);

        // --- Insights Page Buttons ---
        if (targetId === 'generateInsightsBtn') handlePortfolioAnalysis(e);
        if (targetId === 'getNewsAnalysisBtn') handleNewsAnalysis(e);

        // --- Preferences Page Buttons ---
        if (targetId === 'openQuestionnaireBtn') openRiskQuestionnaireModal();
        if (targetId === 'submitQuestionnaireBtn') handleRiskAnalysis(e);
        
        // --- Delegated events for portfolio table ---
        const assetLink = targetClosest('.asset-symbol-link');
        if (assetLink) {
            e.preventDefault();
            const holdingId = parseInt(assetLink.dataset.id);
            handleShowAssetProfile(holdingId);
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

        // --- Back button in asset profile ---
        if (targetId === 'backToPortfolioBtn' || targetClosest('#backToPortfolioBtn')) {
            showSection('portfolio');
        }
        
        // --- AI Screener ---
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
        } else if (historyItem && !deleteScreenerBtn) {
            appState.activeScreenerReportId = parseInt(historyItem.dataset.reportId);
            renderAll();
        }

        // --- Budget Tool Listeners ---
        if (targetId === 'addIncomeBtn') handleAddIncome();
        if (targetId === 'addExpenseBtn') handleAddExpense();
        if (targetId === 'saveIncomeBtn') handleSaveIncome();
        if (targetId === 'saveExpenseBtn') handleSaveExpense();
        if (targetClosest('.edit-income-btn')) handleEditIncome(targetClosest('.edit-income-btn'));
        if (targetClosest('.edit-expense-btn')) handleEditExpense(targetClosest('.edit-expense-btn'));
        if (targetId === 'deleteIncomeBtn') handleDeleteIncome();
        if (targetId === 'deleteExpenseBtn') handleDeleteExpense();
        if (targetId === 'budgetEditBtn') handleSaveBudgetName();

        // --- Budget Category Manager Listeners ---
        if (targetId === 'manageCategoriesBtn') handleManageCategories();
        if (targetId === 'addMainCategoryBtn') handleAddMainCategory();
        if (targetClosest('.add-subcategory-btn')) handleAddSubCategory(targetClosest('.add-subcategory-btn'));
        if (targetClosest('.delete-main-category-btn')) handleDeleteMainCategory(targetClosest('.delete-main-category-btn'));
        if (targetClosest('.delete-subcategory-btn')) handleDeleteSubCategory(targetClosest('.delete-subcategory-btn'));
    });

    document.body.addEventListener('submit', (e) => {
        if (e.target.matches('#transactionForm')) handleSaveTransaction(e);
        if (e.target.matches('#preferencesForm')) handleSavePreferences(e);
    });

    document.body.addEventListener('change', (e) => {
        if (e.target.matches('#portfolioSelector')) handlePortfolioChange(e);
        if (e.target.matches('#expenseCategory')) populateSubCategoryDropdown();
    });
}


// --- Portfolio, Modals, Insights, etc. Handlers (Existing Logic) ---

function handlePortfolioChange(e) {
    appState.data.activePortfolioId = parseInt(e.target.value);
    renderAll();
    saveDataToFirestore();
}

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
    const form = document.getElementById('portfolioForm');
    form.reset();
    document.getElementById('editPortfolioId').value = '';
    document.getElementById('portfolioModalTitle').textContent = 'Create New Portfolio';
    document.getElementById('deletePortfolioBtn').style.display = 'none';
    getModalInstance('portfolioModal')?.show();
}

function openPortfolioModalForEdit() {
    const portfolio = getActivePortfolio();
    if (!portfolio || portfolio.id === 0) return;
    document.getElementById('portfolioForm').reset();
    document.getElementById('editPortfolioId').value = portfolio.id;
    document.getElementById('portfolioName').value = portfolio.name;
    document.getElementById('portfolioModalTitle').textContent = 'Edit Portfolio Name';
    document.getElementById('deletePortfolioBtn').style.display = 'inline-block';
    getModalInstance('portfolioModal')?.show();
}

function handleDeletePortfolio() {
    const portfolioId = parseInt(document.getElementById('editPortfolioId').value);
    if (!portfolioId) return;
    if (appState.data.portfolios.length <= 1) {
        alert("You cannot delete your only portfolio.");
        return;
    }
    getModalInstance('portfolioModal')?.hide();
    setTimeout(() => {
       openDeleteConfirmModal(portfolioId, 'portfolio');
    }, 500);
}

function openTransactionModal(holdingId) {
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionDate').valueAsDate = new Date();
    document.getElementById('transactionHoldingId').value = holdingId;
    renderAll();
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
    } else if (type === 'portfolio') {
        titleEl.textContent = 'Delete Portfolio';
        bodyEl.textContent = 'Are you sure you want to permanently delete this entire portfolio and all of its holdings? This action cannot be undone.';
    }
    getModalInstance('deleteConfirmModal')?.show();
}

function openRiskQuestionnaireModal() {
    getModalInstance('riskQuestionnaireModal')?.show();
}

async function handleSavePortfolio() {
    const portfolioName = document.getElementById('portfolioName').value.trim();
    if (!portfolioName) return;

    const portfolioId = parseInt(document.getElementById('editPortfolioId').value);
    if (portfolioId) {
        const portfolio = appState.data.portfolios.find(p => p.id === portfolioId);
        if (portfolio) portfolio.name = portfolioName;
    } else {
        const newPortfolio = {
            id: Date.now(),
            name: portfolioName,
            holdings: [],
            transactions: []
        };
        appState.data.portfolios.push(newPortfolio);
        appState.data.activePortfolioId = newPortfolio.id;
    }

    await saveDataToFirestore();
    renderAll();
    getModalInstance('portfolioModal')?.hide();
}

async function handleSaveInvestment() {
    const portfolio = getActivePortfolio();
    const newHolding = {
        id: Date.now(),
        symbol: document.getElementById('investmentSymbol').value.toUpperCase(),
        name: document.getElementById('investmentName').value,
        asset_type: document.getElementById('investmentType').value,
        shares: parseFloat(document.getElementById('investmentShares').value),
        average_cost: parseFloat(document.getElementById('investmentPrice').value),
        purchase_date: document.getElementById('investmentDate').value,
        current_price: parseFloat(document.getElementById('investmentPrice').value),
    };

    const newTransaction = {
        id: Date.now() + 1,
        holdingId: newHolding.id,
        type: 'Buy',
        date: newHolding.purchase_date,
        shares: newHolding.shares,
        price: newHolding.average_cost,
        total: newHolding.shares * newHolding.average_cost,
    };
    
    if (!portfolio.holdings) portfolio.holdings = [];
    if (!portfolio.transactions) portfolio.transactions = [];

    portfolio.holdings.push(newHolding);
    portfolio.transactions.push(newTransaction);
    recalculateHolding(newHolding.id);

    await saveDataToFirestore();
    renderAll();
    getModalInstance('investmentModal')?.hide();
}

async function handleSaveAssetEdit() {
    const portfolio = getActivePortfolio();
    const holdingId = parseInt(document.getElementById('editAssetId').value);
    const holding = portfolio.holdings.find(h => h.id === holdingId);
    if (!holding) return;

    holding.symbol = document.getElementById('editAssetSymbol').value.toUpperCase();
    holding.name = document.getElementById('editAssetName').value;
    holding.asset_type = document.getElementById('editAssetType').value;

    await saveDataToFirestore();
    renderAll();
    getModalInstance('editAssetModal')?.hide();
}

async function handleConfirmDelete() {
    const { id, type } = appState.itemToDelete;
    if (!id || !type) return;

    if (type === 'holding') {
        const portfolio = getActivePortfolio();
        portfolio.holdings = portfolio.holdings.filter(h => h.id !== id);
        portfolio.transactions = portfolio.transactions.filter(t => t.holdingId !== id);
    } else if (type === 'screenerReport') {
        appState.data.aiScreenerReports = appState.data.aiScreenerReports.filter(r => r.id !== id);
        if (appState.activeScreenerReportId === id) {
            appState.activeScreenerReportId = null;
        }
    } else if (type === 'portfolio') {
        appState.data.portfolios = appState.data.portfolios.filter(p => p.id !== id);
        if (appState.data.activePortfolioId === id) {
            appState.data.activePortfolioId = appState.data.portfolios[0]?.id || null;
        }
    }

    await saveDataToFirestore();
    appState.itemToDelete = { id: null, type: null };
    renderAll();
    getModalInstance('deleteConfirmModal')?.hide();
}

async function handleGetAssetInfo(isEdit = false) {
    const symbol = document.getElementById(isEdit ? 'editAssetSymbol' : 'investmentSymbol').value.toUpperCase();
    if (!symbol) return;
    const infoCard = document.getElementById(isEdit ? 'editAssetInfoCard' : 'companyInfoCard');
    const infoContent = document.getElementById(isEdit ? 'editAssetInfoContent' : 'companyInfoContent');
    const nameInput = document.getElementById(isEdit ? 'editAssetName' : 'investmentName');

    infoContent.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';
    infoCard.classList.remove('d-none');
    
    const profile = await finnhubApiCall('stock/profile2', `symbol=${symbol}`);
    if (profile && profile.name) {
        infoContent.innerHTML = `<strong>${profile.name}</strong> (${profile.exchange}) - ${profile.finnhubIndustry}`;
        nameInput.value = profile.name;
    } else {
        infoContent.innerHTML = `<span class="text-danger">Could not find company info for symbol.</span>`;
    }
}

async function handlePortfolioAnalysis(e) {
    e.target.disabled = true;
    e.target.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Analyzing...`;
    const portfolio = getActivePortfolio();
    const prompt = `Analyze my investment portfolio. Holdings: ${JSON.stringify(portfolio.holdings)}. My risk tolerance is ${appState.data.user_profile.risk_tolerance}. Provide insights on diversification, risk, and potential opportunities.`;
    try {
        const analysis = await generateContent(prompt);
        appState.data.insights.unshift({ type: 'performance', title: 'Portfolio Analysis', description: analysis });
        await saveDataToFirestore();
        renderAll();
    } catch (error) {
        console.error(error);
        alert("Failed to generate insights.");
    } finally {
        e.target.disabled = false;
        e.target.innerHTML = `<i class="fas fa-wand-magic-sparkles me-2"></i>✨ Analyze My Portfolio`;
    }
}

async function handleNewsAnalysis(e) {
    e.target.disabled = true;
    e.target.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Fetching...`;
    const prompt = `What are the top 3-5 major financial news headlines today that could impact a US-based investor with a moderate risk tolerance? Provide a brief summary for each.`;
    try {
        const analysis = await generateContent(prompt);
        appState.data.insights.unshift({ type: 'news', title: 'Market News Summary', description: analysis });
        await saveDataToFirestore();
        renderAll();
    } catch (error) {
        console.error(error);
        alert("Failed to fetch news analysis.");
    } finally {
        e.target.disabled = false;
        e.target.innerHTML = `<i class="fas fa-newspaper me-2"></i>✨ Get Market News Analysis`;
    }
}

async function handleRiskAnalysis(e) {
    e.target.disabled = true;
    e.target.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Analyzing...`;
    const form = document.getElementById('riskQuestionnaireForm');
    const formData = new FormData(form);
    const answers = Object.fromEntries(formData.entries());
    const prompt = `Based on these questionnaire answers: ${JSON.stringify(answers)}, determine the investor's risk profile (Low, Moderate, High) and provide a one-sentence justification. Return ONLY the profile and justification, like this: "Moderate: The user shows a balance between wanting growth and avoiding significant losses."`;
    try {
        const result = await generateContent(prompt);
        const [profile, justification] = result.split(': ');
        document.getElementById('riskTolerance').value = profile;
        document.getElementById('riskAnalysisResult').textContent = justification || "AI analysis complete.";
        getModalInstance('riskQuestionnaireModal')?.hide();
    } catch (error) {
        alert("Could not complete AI risk analysis.");
    } finally {
        e.target.disabled = false;
        e.target.innerHTML = `Submit for Analysis`;
    }
}

async function handleUpdatePrices(e) {
    const button = e.target;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Updating...`;

    const portfolio = getActivePortfolio();
    const symbols = portfolio.holdings.map(h => h.symbol);
    const promises = symbols.map(symbol => finnhubApiCall('quote', `symbol=${symbol}`));
    
    try {
        const results = await Promise.all(promises);
        results.forEach((quote, index) => {
            if (quote && quote.c) {
                portfolio.holdings[index].current_price = quote.c;
            }
        });
        portfolio.holdings.forEach(h => recalculateHolding(h.id));
        await saveDataToFirestore();
        renderAll();
    } catch (error) {
        console.error("Failed to update prices:", error);
        alert("An error occurred while updating prices.");
    } finally {
        button.disabled = false;
        button.innerHTML = `<i class="fas fa-dollar-sign me-2"></i>Update Prices`;
    }
}

async function handleSaveTransaction(e) {
    e.preventDefault();
    const portfolio = getActivePortfolio();
    const holdingId = parseInt(document.getElementById('transactionHoldingId').value);
    const newTransaction = {
        id: Date.now(),
        holdingId: holdingId,
        type: document.getElementById('transactionType').value,
        date: document.getElementById('transactionDate').value,
        shares: parseFloat(document.getElementById('transactionShares').value),
        price: parseFloat(document.getElementById('transactionPrice').value),
    };
    newTransaction.total = newTransaction.shares * newTransaction.price;
    portfolio.transactions.push(newTransaction);
    recalculateHolding(holdingId);
    await saveDataToFirestore();
    renderAll();
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionDate').valueAsDate = new Date();
}

async function handleSavePreferences(e) {
    e.preventDefault();
    const profile = appState.data.user_profile;
    profile.risk_tolerance = document.getElementById('riskTolerance').value;
    profile.available_capital = parseFloat(document.getElementById('investmentCapital').value);
    profile.sub_goals = getCheckedValues('subInvestmentGoals');
    profile.tax_considerations = getCheckedValues('taxConsiderations');
    profile.asset_preferences = getPreferenceValues('assetClassPrefs');
    profile.sector_preferences = getPreferenceValues('sectorPrefs');
    
    await saveDataToFirestore();
    const msgEl = document.getElementById('preferencesMessage');
    msgEl.innerHTML = `<div class="alert alert-success">Preferences saved successfully!</div>`;
    setTimeout(() => { msgEl.innerHTML = ''; }, 3000);
}

async function handleStartAiAnalysis(type) {
    const newReport = { id: Date.now(), date: new Date().toISOString(), status: 'pending', type: type, recommendations: [] };
    if (!appState.data.aiScreenerReports) appState.data.aiScreenerReports = [];
    appState.data.aiScreenerReports.push(newReport);
    appState.activeScreenerReportId = newReport.id;
    
    renderAll();
    await saveDataToFirestore();

    try {
        const userProfile = appState.data.user_profile;
        const portfolio = getActivePortfolio();

        const basePrompt = `Act as an expert financial advisor AI. Your task is to screen for new investment opportunities. For each ticker you recommend, provide a concise analysis, current price, a target entry price, an estimated sell price for a 1-year horizon, and a confidence score (0-100).`;
        const hrhrPrompt = `Find 3 high-risk, high-reward stocks. These should be volatile, perhaps smaller-cap or in speculative industries, but with significant upside potential. For each, explain the specific high-risk, high-reward rationale.`;
        const profilePrompt = `Based on the following user profile, find 3 stocks that align with their goals. Profile: Risk Tolerance: ${userProfile.risk_tolerance}. Goals: ${userProfile.sub_goals.join(', ')}. Capital: ${formatCurrency(userProfile.available_capital)}. Sector Preferences: Prefer ${userProfile.sector_preferences.preferred.join(', ')}, Exclude ${userProfile.sector_preferences.excluded.join(', ')}. Current Portfolio for context (avoid recommending these): ${portfolio.holdings.map(h => h.symbol).join(', ')}.`;
        
        const finalPrompt = `${basePrompt} ${type === 'hrhr' ? hrhrPrompt : profilePrompt}`;
        
        const schema = {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        ticker: { type: "STRING" },
                        companyName: { type: "STRING" },
                        analysis: { type: "STRING" },
                        hrhrRationale: { type: "STRING" },
                        currentPrice: { type: "NUMBER" },
                        targetEntryPrice: { type: "NUMBER" },
                        estimatedSellPrice: { type: "NUMBER" },
                        confidenceScore: { type: "NUMBER" }
                    },
                    required: ["ticker", "companyName", "analysis", "currentPrice", "targetEntryPrice", "estimatedSellPrice", "confidenceScore"]
                }
            }
        };

        const analysisResult = await generateContent(finalPrompt, schema);
        
        const report = appState.data.aiScreenerReports.find(r => r.id === newReport.id);
        if (report) {
            report.status = 'complete';
            report.recommendations = analysisResult;
        }

    } catch (error) {
        console.error("AI Screener failed:", error);
        const report = appState.data.aiScreenerReports.find(r => r.id === newReport.id);
        if (report) {
            report.status = 'error';
            report.error = error.message;
        }
    } finally {
        await saveDataToFirestore();
        renderAll();
    }
}


// --- Budget Tool Handler Functions ---

function handleAddIncome() {
    document.getElementById('incomeForm').reset();
    document.getElementById('incomeId').value = '';
    document.getElementById('incomeModalTitle').textContent = 'Add Income';
    document.getElementById('deleteIncomeBtn').style.display = 'none';
    budgetModals.income?.show();
}

function handleAddExpense() {
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseId').value = '';
    document.getElementById('expenseModalTitle').textContent = 'Add Expense';
    document.getElementById('deleteExpenseBtn').style.display = 'none';
    populateCategoryDropdowns();
    budgetModals.expense?.show();
}

function handleEditIncome(button) {
    const id = parseInt(button.dataset.id);
    const budget = appState.data.budgets[0];
    const incomeItem = budget.income.find(i => i.id === id);
    if (!incomeItem) return;

    document.getElementById('incomeId').value = incomeItem.id;
    document.getElementById('incomeSource').value = incomeItem.source;
    document.getElementById('incomeAmount').value = incomeItem.amount;
    document.getElementById('incomeComments').value = incomeItem.comments;
    document.getElementById('incomeModalTitle').textContent = 'Edit Income';
    document.getElementById('deleteIncomeBtn').style.display = 'block';
    budgetModals.income?.show();
}

function handleEditExpense(button) {
    const id = parseInt(button.dataset.id);
    const budget = appState.data.budgets[0];
    const expenseItem = budget.expenses.find(e => e.id === id);
    if (!expenseItem) return;

    document.getElementById('expenseId').value = expenseItem.id;
    const [mainCat, subCat] = (expenseItem.category || '').split('-');
    populateCategoryDropdowns(mainCat, subCat);
    document.getElementById('expenseAmount').value = expenseItem.amount;
    document.getElementById('expensePayee').value = expenseItem.payee;
    document.getElementById('expenseDay').value = expenseItem.day;
    document.getElementById('expenseNotes').value = expenseItem.notes;
    document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
    document.getElementById('deleteExpenseBtn').style.display = 'block';
    budgetModals.expense?.show();
}

async function handleSaveIncome() {
    const budget = appState.data.budgets?.[0];
    if (!budget) {
        console.error("No active budget found.");
        return;
    }
    // **FIX**: Ensure the income array exists before trying to push to it.
    if (!budget.income) {
        budget.income = [];
    }

    const id = parseInt(document.getElementById('incomeId').value);
    const amountInput = document.getElementById('incomeAmount').value;
    const sourceInput = document.getElementById('incomeSource').value;

    if (!sourceInput.trim()) {
        alert('Please enter an income source.');
        return;
    }
    if (!amountInput || isNaN(parseFloat(amountInput)) || parseFloat(amountInput) <= 0) {
        alert('Please enter a valid positive amount.');
        return;
    }

    const newIncome = {
        id: id || Date.now(),
        source: sourceInput,
        amount: parseFloat(amountInput),
        comments: document.getElementById('incomeComments').value,
    };

    if (id) {
        const index = budget.income.findIndex(i => i.id === id);
        if (index > -1) budget.income[index] = newIncome;
    } else {
        budget.income.push(newIncome);
    }
    await saveDataToFirestore();
    renderBudgetTool();
    budgetModals.income?.hide();
}

async function handleSaveExpense() {
    const budget = appState.data.budgets[0];
    if (!budget) {
        console.error("No active budget found.");
        return;
    }
    // **FIX**: Ensure the expenses array exists before trying to push to it.
    if (!budget.expenses) {
        budget.expenses = [];
    }

    const id = parseInt(document.getElementById('expenseId').value);
    const mainCat = document.getElementById('expenseCategory').value;
    const subCat = document.getElementById('expenseSubCategory').value;
    const amountInput = document.getElementById('expenseAmount').value;

    // **FIX**: Add validation for required fields
    if (!mainCat) {
        alert('Please select an expense category.');
        return;
    }
    if (!amountInput || isNaN(parseFloat(amountInput)) || parseFloat(amountInput) <= 0) {
        alert('Please enter a valid positive amount.');
        return;
    }

    let finalCategory = mainCat;
    if (subCat && subCat !== "N/A" && subCat !== "") {
        finalCategory = `${mainCat}-${subCat}`;
    }
    const newExpense = {
        id: id || Date.now(),
        category: finalCategory,
        amount: parseFloat(amountInput),
        payee: document.getElementById('expensePayee').value,
        day: parseInt(document.getElementById('expenseDay').value),
        notes: document.getElementById('expenseNotes').value,
    };

    if (id) {
        const index = budget.expenses.findIndex(e => e.id === id);
        if(index > -1) budget.expenses[index] = newExpense;
    } else {
        budget.expenses.push(newExpense);
    }
    await saveDataToFirestore();
    renderBudgetTool();
    budgetModals.expense?.hide();
}

async function handleDeleteIncome() {
    const budget = appState.data.budgets[0];
    const id = parseInt(document.getElementById('incomeId').value);
    budget.income = budget.income.filter(i => i.id !== id);
    await saveDataToFirestore();
    renderBudgetTool();
    budgetModals.income?.hide();
}

async function handleDeleteExpense() {
    const budget = appState.data.budgets[0];
    const id = parseInt(document.getElementById('expenseId').value);
    budget.expenses = budget.expenses.filter(e => e.id !== id);
    await saveDataToFirestore();
    renderBudgetTool();
    budgetModals.expense?.hide();
}

async function handleSaveBudgetName() {
    const budget = appState.data.budgets[0];
    budget.name = document.getElementById('budgetName').value;
    await saveDataToFirestore();
    alert('Budget name updated!');
}

// --- Category Management Functions ---

function handleManageCategories() {
    renderCategoryManager();
    budgetModals.categoryManager?.show();
}

function renderCategoryManager() {
    const container = document.getElementById('categoryListContainer');
    const categories = appState.data.budgets[0]?.expenseCategories || {};
    container.innerHTML = Object.entries(categories).map(([mainCat, subCats]) => `
        <div class="category-manager-item">
            <div class="category-manager-header">
                <h6>${mainCat}</h6>
                <button class="btn btn-sm btn-outline-danger delete-main-category-btn" data-category="${mainCat}">&times;</button>
            </div>
            <ul class="sub-category-list">
                ${(subCats || []).map(sub => `
                    <li class="sub-category-list-item">
                        <span>${sub}</span>
                        <button class="btn btn-sm btn-outline-danger delete-subcategory-btn" data-category="${mainCat}" data-subcategory="${sub}">&times;</button>
                    </li>
                `).join('')}
            </ul>
            <div class="input-group input-group-sm">
                <input type="text" class="form-control" placeholder="New sub-category..." id="sub-input-${mainCat.replace(/\s+/g, '')}">
                <button class="btn btn--secondary add-subcategory-btn" data-category="${mainCat}">Add</button>
            </div>
        </div>
    `).join('');
}

async function handleAddMainCategory() {
    const input = document.getElementById('newMainCategoryInput');
    const newCategory = input.value.trim();
    if (!newCategory) return;
    const budget = appState.data.budgets[0];
    if (!budget) return;
    if (!budget.expenseCategories) {
        budget.expenseCategories = {};
    }
    if (!budget.expenseCategories[newCategory]) {
        budget.expenseCategories[newCategory] = [];
        await saveDataToFirestore();
        renderCategoryManager();
        input.value = '';
    } else {
        alert('This category already exists.');
    }
}

async function handleAddSubCategory(button) {
    const mainCategory = button.dataset.category;
    const input = document.getElementById(`sub-input-${mainCategory.replace(/\s+/g, '')}`);
    const newSubCategory = input.value.trim();
    if (!newSubCategory) return;
    const budget = appState.data.budgets[0];
    if (!budget.expenseCategories[mainCategory].includes(newSubCategory)) {
        budget.expenseCategories[mainCategory].push(newSubCategory);
        await saveDataToFirestore();
        renderCategoryManager();
    } else {
        alert('This sub-category already exists.');
    }
}

async function handleDeleteMainCategory(button) {
    const mainCategory = button.dataset.category;
    if (confirm(`Are you sure you want to delete the entire "${mainCategory}" category? This will also remove all expenses associated with it.`)) {
        const budget = appState.data.budgets[0];
        delete budget.expenseCategories[mainCategory];
        budget.expenses = budget.expenses.filter(exp => !exp.category.startsWith(mainCategory));
        await saveDataToFirestore();
        renderCategoryManager();
        renderBudgetTool();
    }
}

async function handleDeleteSubCategory(button) {
    const mainCategory = button.dataset.category;
    const subCategory = button.dataset.subcategory;
    if (confirm(`Are you sure you want to delete the sub-category "${subCategory}"? This will also remove all expenses associated with it.`)) {
        const budget = appState.data.budgets[0];
        budget.expenseCategories[mainCategory] = budget.expenseCategories[mainCategory].filter(s => s !== subCategory);
        const fullCategoryName = `${mainCategory}-${subCategory}`;
        budget.expenses = budget.expenses.filter(exp => exp.category !== fullCategoryName);
        await saveDataToFirestore();
        renderCategoryManager();
        renderBudgetTool();
    }
}

function populateCategoryDropdowns(selectedMain = '', selectedSub = '') {
    const budget = appState.data.budgets[0];
    const categories = budget.expenseCategories || {};
    const mainCategoryEl = document.getElementById('expenseCategory');
    if (!mainCategoryEl) return;
    mainCategoryEl.innerHTML = '<option value="">Select a category...</option>';
    for (const category in categories) {
        mainCategoryEl.innerHTML += `<option value="${category}" ${category === selectedMain ? 'selected' : ''}>${category}</option>`;
    }
    populateSubCategoryDropdown(selectedSub);
}

function populateSubCategoryDropdown(selectedSub = '') {
    const budget = appState.data.budgets[0];
    const categories = budget.expenseCategories || {};
    const mainCategoryEl = document.getElementById('expenseCategory');
    const subCategoryEl = document.getElementById('expenseSubCategory');
    if (!mainCategoryEl || !subCategoryEl) return;
    const selectedMain = mainCategoryEl.value;
    subCategoryEl.innerHTML = '';
    if (selectedMain && categories[selectedMain] && categories[selectedMain].length > 0) {
        subCategoryEl.disabled = false;
        subCategoryEl.innerHTML = '<option value="">Select a sub-category...</option>';
        categories[selectedMain].forEach(sub => {
            subCategoryEl.innerHTML += `<option value="${sub}" ${sub === selectedSub ? 'selected' : ''}>${sub}</option>`;
        });
    } else {
        subCategoryEl.disabled = true;
        subCategoryEl.innerHTML = '<option value="">N/A</option>';
    }
}

