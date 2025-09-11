import { appState } from './main.js';
import { saveDataToFirestore } from './firestore.js';
import { formatCurrency } from './utils.js';

// This object holds the Bootstrap modal instances for the budget page.
let budgetModals = {};

/**
 * Initializes modal instances for the budget tool.
 * This should be called once the application UI is ready.
 */
export function initializeBudgetModals() {
    const incomeModalEl = document.getElementById('incomeModal');
    const expenseModalEl = document.getElementById('expenseModal');
    const categoryModalEl = document.getElementById('categoryManagementModal');
    
    if (incomeModalEl) budgetModals.income = new bootstrap.Modal(incomeModalEl);
    if (expenseModalEl) budgetModals.expense = new bootstrap.Modal(expenseModalEl);
    if (categoryModalEl) {
        budgetModals.categoryManager = new bootstrap.Modal(categoryModalEl);
        // When the category manager is closed, refresh the dropdowns in the expense modal
        categoryModalEl.addEventListener('hidden.bs.modal', () => populateCategoryDropdowns());
    }
}

/**
 * Main render function for the budget tool.
 */
export function renderBudgetTool() {
    if (!appState.data.budgets || appState.data.budgets.length === 0) return;

    const budget = appState.data.budgets[0];
    if (!budget) return;

    budget.income = budget.income || [];
    budget.expenses = budget.expenses || [];

    const incomeListEl = document.getElementById('incomeList');
    const expenseListEl = document.getElementById('expenseList');
    const incomeTotalEl = document.getElementById('incomeTotal');
    const expenseTotalEl = document.getElementById('expenseTotal');
    const savingsSectionEl = document.getElementById('savingsSection');
    const budgetNameInput = document.getElementById('budgetName');

    if (budgetNameInput) budgetNameInput.value = budget.name;

    // Render Income
    let totalIncome = budget.income.reduce((sum, item) => sum + item.amount, 0);
    if (incomeListEl) {
        incomeListEl.innerHTML = budget.income.map(item => `
            <div class="list-item">
                <span class="list-item-name">${item.source}</span>
                <span class="list-item-amount">${formatCurrency(item.amount)}</span>
                <button class="btn btn--secondary btn-sm edit-income-btn" data-id="${item.id}">Edit</button>
            </div>`).join('');
    }

    // Render Expenses
    let totalExpenses = budget.expenses.reduce((sum, item) => sum + item.amount, 0);
    if (expenseListEl) {
        const groupedExpenses = budget.expenses.reduce((acc, item) => {
            const [main, sub] = (item.category || '').split('-');
            if (!acc[main]) acc[main] = { total: 0, items: [] };
            acc[main].total += item.amount;
            acc[main].items.push({ ...item, subCategory: sub });
            return acc;
        }, {});

        expenseListEl.innerHTML = Object.entries(groupedExpenses).map(([category, data]) => {
            let categoryHtml = `
                <div class="list-item main-category">
                    <span class="list-item-name">${category}</span>
                    <span class="list-item-amount">${formatCurrency(data.total)}</span>
                    ${data.items.length === 1 && !data.items[0].subCategory ? `<button class="btn btn--secondary btn-sm edit-expense-btn" data-id="${data.items[0].id}">Edit</button>` : ''}
                </div>`;
            
            if (data.items.some(item => item.subCategory)) {
                 categoryHtml += data.items.map(item => `
                    <div class="list-item sub-category">
                        <span class="list-item-name">${item.subCategory}</span>
                        <span class="list-item-amount">${formatCurrency(item.amount)}</span>
                        <button class="btn btn--secondary btn-sm edit-expense-btn" data-id="${item.id}">Edit</button>
                    </div>`).join('');
            }
            return categoryHtml;
        }).join('');
    }
    
    // Render Totals
    if (incomeTotalEl) incomeTotalEl.innerHTML = `<span>Total Income</span><span>${formatCurrency(totalIncome)}</span>`;
    if (expenseTotalEl) expenseTotalEl.innerHTML = `<span>Total Expenses</span><span>${formatCurrency(totalExpenses)}</span>`;

    // Render Savings
    if (savingsSectionEl) {
        const savings = totalIncome - totalExpenses;
        const savingsClass = savings >= 0 ? 'text-success' : 'text-danger';
        savingsSectionEl.innerHTML = `
            <div class="savings-label"><span>Income</span><span>-</span><span>Expenses</span><span>=</span><span>Savings</span></div>
            <div class="savings-value"><span>${formatCurrency(totalIncome)}</span><span>-</span><span>${formatCurrency(totalExpenses)}</span><span>=</span><span class="${savingsClass}">${formatCurrency(savings)}</span></div>`;
    }
}

// --- Event Handlers ---

export function handleAddIncome() {
    document.getElementById('incomeForm').reset();
    document.getElementById('incomeId').value = '';
    document.getElementById('incomeModalTitle').textContent = 'Add Income';
    document.getElementById('deleteIncomeBtn').style.display = 'none';
    budgetModals.income?.show();
}

export function handleAddExpense() {
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseId').value = '';
    document.getElementById('expenseModalTitle').textContent = 'Add Expense';
    document.getElementById('deleteExpenseBtn').style.display = 'none';
    populateCategoryDropdowns();
    budgetModals.expense?.show();
}

export function handleEditIncome(button) {
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

export function handleEditExpense(button) {
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

export async function handleSaveIncome() {
    const budget = appState.data.budgets?.[0];
    if (!budget) return;
    if (!budget.income) budget.income = [];

    const id = parseInt(document.getElementById('incomeId').value);
    const newIncome = {
        id: id || Date.now(),
        source: document.getElementById('incomeSource').value,
        amount: parseFloat(document.getElementById('incomeAmount').value),
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

export async function handleSaveExpense() {
    const budget = appState.data.budgets[0];
    if (!budget) return;
    if (!budget.expenses) budget.expenses = [];

    const id = parseInt(document.getElementById('expenseId').value);
    const mainCat = document.getElementById('expenseCategory').value;
    const subCat = document.getElementById('expenseSubCategory').value;

    let finalCategory = mainCat;
    if (subCat && subCat !== "N/A" && subCat !== "") {
        finalCategory = `${mainCat}-${subCat}`;
    }
    const newExpense = {
        id: id || Date.now(),
        category: finalCategory,
        amount: parseFloat(document.getElementById('expenseAmount').value),
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

export async function handleDeleteIncome() {
    const budget = appState.data.budgets[0];
    const id = parseInt(document.getElementById('incomeId').value);
    budget.income = budget.income.filter(i => i.id !== id);
    await saveDataToFirestore();
    renderBudgetTool();
    budgetModals.income?.hide();
}

export async function handleDeleteExpense() {
    const budget = appState.data.budgets[0];
    const id = parseInt(document.getElementById('expenseId').value);
    budget.expenses = budget.expenses.filter(e => e.id !== id);
    await saveDataToFirestore();
    renderBudgetTool();
    budgetModals.expense?.hide();
}

export async function handleSaveBudgetName() {
    const budget = appState.data.budgets[0];
    budget.name = document.getElementById('budgetName').value;
    await saveDataToFirestore();
}

// --- Category Management ---

export function handleManageCategories() {
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
                    </li>`).join('')}
            </ul>
            <div class="input-group input-group-sm">
                <input type="text" class="form-control" placeholder="New sub-category..." id="sub-input-${mainCat.replace(/\s+/g, '')}">
                <button class="btn btn--secondary add-subcategory-btn" data-category="${mainCat}">Add</button>
            </div>
        </div>`).join('');
}

export async function handleAddMainCategory() {
    const input = document.getElementById('newMainCategoryInput');
    const newCategory = input.value.trim();
    if (!newCategory) return;
    const budget = appState.data.budgets[0];
    if (!budget.expenseCategories[newCategory]) {
        budget.expenseCategories[newCategory] = [];
        await saveDataToFirestore();
        renderCategoryManager();
        input.value = '';
    }
}

export async function handleAddSubCategory(button) {
    const mainCategory = button.dataset.category;
    const input = document.getElementById(`sub-input-${mainCategory.replace(/\s+/g, '')}`);
    const newSubCategory = input.value.trim();
    if (!newSubCategory) return;
    const budget = appState.data.budgets[0];
    if (!budget.expenseCategories[mainCategory].includes(newSubCategory)) {
        budget.expenseCategories[mainCategory].push(newSubCategory);
        await saveDataToFirestore();
        renderCategoryManager();
    }
}

export async function handleDeleteMainCategory(button) {
    const mainCategory = button.dataset.category;
    if (confirm(`Delete the "${mainCategory}" category and all its expenses?`)) {
        const budget = appState.data.budgets[0];
        delete budget.expenseCategories[mainCategory];
        budget.expenses = budget.expenses.filter(exp => !exp.category.startsWith(mainCategory));
        await saveDataToFirestore();
        renderCategoryManager();
        renderBudgetTool();
    }
}

export async function handleDeleteSubCategory(button) {
    const mainCategory = button.dataset.category;
    const subCategory = button.dataset.subcategory;
    if (confirm(`Delete the "${subCategory}" sub-category and its expenses?`)) {
        const budget = appState.data.budgets[0];
        budget.expenseCategories[mainCategory] = budget.expenseCategories[mainCategory].filter(s => s !== subCategory);
        const fullCategoryName = `${mainCategory}-${subCategory}`;
        budget.expenses = budget.expenses.filter(exp => exp.category !== fullCategoryName);
        await saveDataToFirestore();
        renderCategoryManager();
        renderBudgetTool();
    }
}

// --- Dropdown Helpers ---

export function populateCategoryDropdowns(selectedMain = '', selectedSub = '') {
    const categories = appState.data.budgets[0]?.expenseCategories || {};
    const mainCategoryEl = document.getElementById('expenseCategory');
    if (!mainCategoryEl) return;
    mainCategoryEl.innerHTML = '<option value="">Select a category...</option>';
    for (const category in categories) {
        mainCategoryEl.innerHTML += `<option value="${category}" ${category === selectedMain ? 'selected' : ''}>${category}</option>`;
    }
    populateSubCategoryDropdown(selectedSub);
}

export function populateSubCategoryDropdown(selectedSub = '') {
    const categories = appState.data.budgets[0]?.expenseCategories || {};
    const mainCategoryEl = document.getElementById('expenseCategory');
    const subCategoryEl = document.getElementById('expenseSubCategory');
    if (!mainCategoryEl || !subCategoryEl) return;
    
    const selectedMain = mainCategoryEl.value;
    subCategoryEl.innerHTML = '';
    
    if (selectedMain && categories[selectedMain]?.length > 0) {
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

// --- Export Functions ---

export function handleExportToPdf() {
    const budgetContainer = document.querySelector('.budget-container');
    const budgetName = document.getElementById('budgetName').value || 'budget';
    const filename = `${budgetName.replace(/\s+/g, '_')}.pdf`;

    const opt = {
        margin: 0.5,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    const elementToExport = budgetContainer.cloneNode(true);
    elementToExport.querySelectorAll('button, .btn-group, .dropdown-menu').forEach(btn => btn.remove());
    
    html2pdf().from(elementToExport).set(opt).save();
}

export function handleExportToExcel() {
    const budget = appState.data.budgets[0];
    const budgetName = budget.name || 'budget';
    const filename = `${budgetName.replace(/\s+/g, '_')}.xlsx`;

    const incomeData = budget.income.map(item => ({
        Source: item.source, Amount: item.amount, Comments: item.comments || ''
    }));
    const incomeSheet = XLSX.utils.json_to_sheet(incomeData);

    const expenseData = budget.expenses.map(item => {
        const [category = '', subCategory = ''] = (item.category || '').split('-');
        return {
            Category: category, 'Sub-Category': subCategory, Payee: item.payee || '', Amount: item.amount
        };
    });
    const expenseSheet = XLSX.utils.json_to_sheet(expenseData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, incomeSheet, 'Income');
    XLSX.utils.book_append_sheet(workbook, expenseSheet, 'Expenses');
    XLSX.writeFile(workbook, filename);
}