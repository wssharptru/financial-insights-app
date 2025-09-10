// assets/js/budget.js
import { appState } from './main.js';
import { saveDataToFirestore } from './firestore.js';
import { formatCurrency, toYYYYMMDD } from './utils.js';

let debounceTimer;

// --- INITIALIZATION ---
export function initializeBudgetTool() {
    // Event listeners are delegated in renderer to ensure elements exist
}

// --- RENDERING ---
export function renderBudgetTool() {
    const container = document.getElementById('budget-content-container');
    if (!container) return;

    const budget = getActiveBudget();
    if (!budget) {
        container.innerHTML = `<div class="empty-state"><h4>No Budget Found</h4><p>There was an issue loading your budget data.</p></div>`;
        return;
    }

    const incomeItems = budget.items?.filter(item => item.type === 'income') || [];
    const expenseItems = budget.items?.filter(item => item.type === 'expense') || [];

    const totalIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenseItems.reduce((sum, item) => sum + item.amount, 0);
    const netSavings = totalIncome - totalExpenses;

    container.innerHTML = `
        ${renderSummary(totalIncome, totalExpenses, netSavings)}
        <div class="row">
            <div class="col-lg-6">
                ${renderSection('income', 'Monthly Income', incomeItems, totalIncome)}
            </div>
            <div class="col-lg-6">
                ${renderSection('expense', 'Monthly Expenses', expenseItems, totalExpenses)}
            </div>
        </div>`;
    
    addBudgetEventListeners();
}

function renderSummary(income, expenses, net) {
    const netClass = net >= 0 ? 'positive' : 'negative';
    return `
        <div class="budget-summary-card mb-4">
            <div class="row align-items-center">
                <div class="col-md-4 summary-item">
                    <h6>Total Income</h6>
                    <p class="amount positive">${formatCurrency(income)}</p>
                </div>
                <div class="col-md-4 summary-item">
                     <h6>Total Expenses</h6>
                    <p class="amount negative">${formatCurrency(expenses)}</p>
                </div>
                <div class="col-md-4 summary-item">
                    <h6>Net Savings</h6>
                    <p class="amount ${netClass}">${formatCurrency(net)}</p>
                </div>
            </div>
        </div>`;
}

function renderSection(type, title, items, total) {
    const headerClass = type === 'income' ? 'income-header' : 'expenses-header';
    const amountClass = type === 'income' ? 'income' : 'expense';
    const sortedItems = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));

    return `
        <div class="budget-section">
            <div class="budget-section-header ${headerClass}">
                <h5>${title}</h5>
                <button class="btn btn-sm btn--secondary" id="add-${type}-btn"><i class="fas fa-plus"></i></button>
            </div>
            <ul class="budget-list">
                ${sortedItems.length > 0 ? sortedItems.map(item => renderListItem(item, amountClass)).join('') : `<li class="budget-list-item text-muted">No ${type} items yet.</li>`}
            </ul>
            <div class="budget-section-header d-flex justify-content-end">
                <strong>Total: ${formatCurrency(total)}</strong>
            </div>
        </div>`;
}

function renderListItem(item, amountClass) {
    const mainText = item.type === 'income' ? item.source : item.payee;
    const subText = item.type === 'expense' ? `${item.category.main} ${item.category.sub ? ' / ' + item.category.sub : ''}` : (item.notes || 'No notes');

    return `
        <li class="budget-list-item" data-id="${item.id}">
            <div class="item-sync-indicator">
                <!-- Sync status icon here -->
            </div>
            <div class="item-details">
                <span class="payee" data-field="payee">${mainText || 'N/A'}</span>
                <p class="category text-muted mb-0">${subText}</p>
            </div>
            <div class="item-amount ${amountClass}">
                <span data-field="amount">${formatCurrency(item.amount)}</span>
            </div>
            <div class="item-actions">
                <button class="btn btn-sm btn--secondary edit-item-btn" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn--secondary delete-item-btn" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        </li>`;
}

// --- EVENT LISTENERS ---
function addBudgetEventListeners() {
    document.getElementById('add-income-btn')?.addEventListener('click', () => openItemModal('income'));
    document.getElementById('add-expense-btn')?.addEventListener('click', () => openItemModal('expense'));
    
    document.getElementById('saveIncomeBtn')?.addEventListener('click', () => handleSaveItem('income'));
    document.getElementById('saveExpenseBtn')?.addEventListener('click', () => handleSaveItem('expense'));

    const listItems = document.querySelectorAll('.budget-list-item');
    listItems.forEach(item => {
        item.querySelector('.edit-item-btn')?.addEventListener('click', (e) => {
            const itemId = e.currentTarget.closest('.budget-list-item').dataset.id;
            const budgetItem = findBudgetItem(itemId);
            if(budgetItem) openItemModal(budgetItem.type, budgetItem);
        });
        item.querySelector('.delete-item-btn')?.addEventListener('click', (e) => {
             const itemId = e.currentTarget.closest('.budget-list-item').dataset.id;
             if (confirm('Are you sure you want to delete this item?')) {
                deleteBudgetItem(itemId);
             }
        });
        
        // Inline editing for payee/amount
        item.querySelector('[data-field="payee"]')?.addEventListener('click', handleInlineEdit);
        item.querySelector('[data-field="amount"]')?.addEventListener('click', handleInlineEdit);
    });
}

// --- CORE LOGIC & DATA MANIPULATION ---
function getActiveBudget() {
    if (!appState.data.budgets || appState.data.budgets.length === 0) {
        return null;
    }
    // For now, we only support one budget
    return appState.data.budgets[0];
}

function findBudgetItem(itemId) {
    const budget = getActiveBudget();
    return budget?.items.find(i => i.id === itemId);
}

function openItemModal(type, item = null) {
    const modalId = type === 'income' ? 'incomeModal' : 'expenseModal';
    const formId = type === 'income' ? 'incomeForm' : 'expenseForm';
    const form = document.getElementById(formId);
    
    form.reset();
    form.querySelector('[name="itemId"]').value = item ? item.id : '';
    
    if (type === 'income') {
        form.querySelector('[name="source"]').value = item?.source || '';
        form.querySelector('[name="amount"]').value = item?.amount || '';
        form.querySelector('[name="date"]').value = item ? toYYYYMMDD(item.date) : toYYYYMMDD(new Date());
        form.querySelector('[name="notes"]').value = item?.notes || '';
    } else { // expense
        form.querySelector('[name="payee"]').value = item?.payee || '';
        form.querySelector('[name="amount"]').value = item?.amount || '';
        form.querySelector('[name="date"]').value = item ? toYYYYMMDD(item.date) : toYYYYMMDD(new Date());
        form.querySelector('[name="category_main"]').value = item?.category.main || '';
        form.querySelector('[name="category_sub"]').value = item?.category.sub || '';
        form.querySelector('[name="notes"]').value = item?.notes || '';
    }

    bootstrap.Modal.getOrCreateInstance(document.getElementById(modalId)).show();
}

function handleSaveItem(type) {
    const formId = type === 'income' ? 'incomeForm' : 'expenseForm';
    const form = document.getElementById(formId);
    const itemId = form.querySelector('[name="itemId"]').value;
    
    let newItemData;
    const now = new Date().toISOString();

    if (type === 'income') {
        newItemData = {
            type: 'income',
            source: form.querySelector('[name="source"]').value,
            amount: parseFloat(form.querySelector('[name="amount"]').value),
            date: form.querySelector('[name="date"]').value,
            notes: form.querySelector('[name="notes"]').value,
        };
    } else {
        newItemData = {
            type: 'expense',
            payee: form.querySelector('[name="payee"]').value,
            amount: parseFloat(form.querySelector('[name="amount"]').value),
            date: form.querySelector('[name="date"]').value,
            category: {
                main: form.querySelector('[name="category_main"]').value.trim(),
                sub: form.querySelector('[name="category_sub"]').value.trim(),
            },
            notes: form.querySelector('[name="notes"]').value,
        };
    }

    // Basic Validation
    if (!newItemData.amount || isNaN(newItemData.amount)) {
        alert("Please enter a valid amount.");
        return;
    }

    if (itemId) { // Update existing
        updateBudgetItem(itemId, newItemData);
    } else { // Add new
        addBudgetItem(newItemData);
    }
    
    const modalId = type === 'income' ? 'incomeModal' : 'expenseModal';
    bootstrap.Modal.getInstance(document.getElementById(modalId)).hide();
}

function addBudgetItem(itemData) {
    const budget = getActiveBudget();
    if (!budget) return;

    const newItem = {
        ...itemData,
        id: self.crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        deviceId: 'web-client' // Or a unique device ID
    };

    if (!budget.items) budget.items = [];
    budget.items.push(newItem);
    
    renderBudgetTool();
    saveDataToFirestore();
}

function updateBudgetItem(itemId, newData) {
    const budget = getActiveBudget();
    const itemIndex = budget.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return;
    
    const updatedItem = {
        ...budget.items[itemIndex],
        ...newData,
        lastUpdated: new Date().toISOString(),
    };
    budget.items[itemIndex] = updatedItem;

    renderBudgetTool();
    saveDataToFirestore();
}

function deleteBudgetItem(itemId) {
    const budget = getActiveBudget();
    budget.items = budget.items.filter(i => i.id !== itemId);
    renderBudgetTool();
    saveDataToFirestore();
}


// --- INLINE EDITING ---
function handleInlineEdit(e) {
    const span = e.currentTarget;
    const currentText = span.textContent;
    const field = span.dataset.field;

    // Prevent re-triggering if already editing
    if (span.querySelector('input')) return;

    const input = document.createElement('input');
    input.type = field === 'amount' ? 'number' : 'text';
    input.className = 'inline-edit-input';
    input.value = field === 'amount' ? parseFloat(currentText.replace(/[^0-9.-]+/g,"")) : currentText;
    
    span.textContent = '';
    span.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener('blur', () => {
        saveInlineEdit(span, field, input.value);
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            span.innerHTML = currentText; // Revert without saving
        }
    });
}

function saveInlineEdit(spanElement, field, newValue) {
    const listItem = spanElement.closest('.budget-list-item');
    const itemId = listItem.dataset.id;
    const item = findBudgetItem(itemId);

    if (item) {
        let updateData = {};
        if (field === 'amount') {
            const newAmount = parseFloat(newValue);
            if (!isNaN(newAmount)) {
                updateData.amount = newAmount;
            }
        } else if (field === 'payee') {
            const key = item.type === 'income' ? 'source' : 'payee';
            updateData[key] = newValue;
        }
        updateBudgetItem(itemId, updateData);
    } else {
        renderBudgetTool(); // Re-render to discard changes if item not found
    }
}
