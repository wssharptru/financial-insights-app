import { appState } from './main.js';
import { saveDataToFirestore } from './firestore.js';
import { getActivePortfolio, recalculateHolding } from './portfolio-logic.js';
import { finnhubApiCall, generateContent } from './utils.js';
import { showSection } from './navigation.js';

/**
 * Initializes all primary event listeners for the application.
 * Uses event delegation for dynamically loaded content.
 */
export function initializeEventListeners() {
    
    // Use the body for delegated events on content that is loaded dynamically
    document.body.addEventListener('click', (e) => {
        // Portfolio Page Buttons
        if (e.target.matches('#addInvestmentBtnPortfolio')) openInvestmentModal();
        if (e.target.matches('#createPortfolioBtn')) openPortfolioModalForCreate();
        if (e.target.matches('#editPortfolioNameBtn')) openPortfolioModalForEdit();
        if (e.target.matches('#updatePricesBtn')) handleUpdatePrices(e);

        // Modal Save/Confirm Buttons
        if (e.target.matches('#savePortfolioBtn')) handleSavePortfolio();
        if (e.target.matches('#saveInvestmentBtn')) handleSaveInvestment();
        if (e.target.matches('#saveAssetEditBtn')) handleSaveAssetEdit();
        if (e.target.matches('#confirmDeleteBtn')) handleConfirmDelete();
        
        // Asset Info Buttons
        if (e.target.matches('#getAssetInfoBtn')) handleGetAssetInfo(false);
        if (e.target.matches('#getAssetInfoBtnEdit')) handleGetAssetInfo(true);

        // Insights Page Buttons
        if (e.target.matches('#generateInsightsBtn')) handlePortfolioAnalysis(e);
        if (e.target.matches('#getNewsAnalysisBtn')) handleNewsAnalysis(e);

        // Preferences Page Buttons
        if (e.target.matches('#openQuestionnaireBtn')) openRiskQuestionnaireModal();
        if (e.target.matches('#submitQuestionnaireBtn')) handleRiskAnalysis(e);
        
        // Delegated events for portfolio table
        const assetLink = e.target.closest('.asset-symbol-link');
        if (assetLink) {
            e.preventDefault();
            const holdingId = parseInt(assetLink.dataset.id);
            showAssetProfile(holdingId);
        }
        // ... other delegated events for transaction, edit, delete buttons
    });

    // Delegated form submissions
    document.body.addEventListener('submit', (e) => {
        if (e.target.matches('#transactionForm')) handleSaveTransaction(e);
        if (e.target.matches('#preferencesForm')) handleSavePreferences(e);
    });

    // Delegated change events
    document.body.addEventListener('change', (e) => {
        if (e.target.matches('#portfolioSelector')) handlePortfolioChange(e);
    });
}

// --- MODAL HANDLERS ---
function openInvestmentModal() {
    // Logic to open and prepare the investment modal
    // Example: new bootstrap.Modal(document.getElementById('investmentModal')).show();
}

function openPortfolioModalForCreate() { /* ... */ }
function openPortfolioModalForEdit() { /* ... */ }
function openRiskQuestionnaireModal() { /* ... */ }


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

    if (portfolioId) { // Editing existing
        const portfolio = appState.data.portfolios.find(p => p.id == portfolioId);
        if (portfolio) portfolio.name = name;
    } else { // Creating new
        const newPortfolio = { id: Date.now(), name: name, holdings: [], transactions: [] };
        appState.data.portfolios.push(newPortfolio);
        appState.data.activePortfolioId = newPortfolio.id;
    }
    saveDataToFirestore();
    // Hide modal: bootstrap.Modal.getInstance(document.getElementById('portfolioModal')).hide();
}

function handleSaveInvestment() {
    // Logic from original file to save a new investment
    // ...
    saveDataToFirestore();
}

function handleSaveAssetEdit() { /* ... */ }
function handleSaveTransaction(e) { e.preventDefault(); /* ... */ }
function handleConfirmDelete() { /* ... */ }
function handleSavePreferences(e) { e.preventDefault(); /* ... */ }
async function handleUpdatePrices(e) { /* ... */ }
async function handleGetAssetInfo(isEditMode) { /* ... */ }
async function handlePortfolioAnalysis(e) { /* ... */ }
async function handleNewsAnalysis(e) { /* ... */ }
async function handleRiskAnalysis(e) { e.preventDefault(); /* ... */ }

// --- PAGE NAVIGATION/DISPLAY LOGIC ---
async function showAssetProfile(holdingId) {
    await showSection('asset-profile');
    // Add logic to fetch and render the specific asset's details
}
