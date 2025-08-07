// assets/js/event-listeners.js

import { appState } from './main.js';
import { saveDataToFirestore } from './firestore.js';
import { getActivePortfolio, recalculateHolding, calculatePortfolioMetrics } from './portfolio-logic.js';
import { finnhubApiCall, generateContent, fmpApiCall, formatCurrency, getCheckedValues, getPreferenceValues } from './utils.js';
import { showSection } from './navigation.js';
import { renderAll } from './renderer.js';
// Import the new handler for showing the asset profile
import { handleShowAssetProfile } from './asset-profile.js';

/**
 * Initializes all primary event listeners for the application.
 */
export function initializeEventListeners() {
    
    document.body.addEventListener('click', (e) => {
        const targetId = e.target.id;
        const targetClosest = (selector) => e.target.closest(selector);

        // ... (other event listeners remain the same)

        // Delegated events for portfolio table
        const assetLink = targetClosest('.asset-symbol-link');
        if (assetLink) {
            e.preventDefault();
            const holdingId = parseInt(assetLink.dataset.id);
            // Call the new, dedicated handler
            handleShowAssetProfile(holdingId);
        }
        
        // ... (other event listeners remain the same)

        // Back button in asset profile
        if (targetId === 'backToPortfolioBtn' || targetClosest('#backToPortfolioBtn')) {
            showSection('portfolio');
        }
        
        // ... (the rest of the file remains the same)
    });

    // ... (rest of the functions in this file: handlePortfolioChange, handleSavePortfolio, etc.)
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
    renderAll(); // Re-render to show transaction history
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
