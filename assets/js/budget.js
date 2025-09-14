import { appState } from './main.js';
import { saveDataToFirestore } from './firestore.js';
import { formatCurrency } from './utils.js';

// This object will cache the Bootstrap modal instances once they are created.
const budgetModals = {};

/**
 * Gets or creates a Bootstrap modal instance.
 * This "lazy-loads" the modals to prevent race conditions on startup.
 * @param {string} modalId - The ID of the modal element (e.g., 'incomeModal').
 * @returns {bootstrap.Modal|null} The modal instance or null if the element doesn't exist.
 */
function getBudgetModal(modalId) {
    if (budgetModals[modalId]) {
        return budgetModals[modalId];
    }
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
        budgetModals[modalId] = new bootstrap.Modal(modalEl);
        
        // Special case for the category manager: refresh dropdowns when it closes.
        if (modalId === 'categoryManagementModal') {
             modalEl.addEventListener('hidden.bs.modal', () => populateCategoryDropdowns());
        }
        
        return budgetModals[modalId];
    }
    return null;
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
                        <span class="list-item-name">${item.subCategory || 'General'}</span>
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

    // NEW: Render the expense breakdown chart
    renderBudgetChart(budget);
}

// --- Event Handlers ---

export function handleAddIncome() {
    document.getElementById('incomeForm').reset();
    document.getElementById('incomeId').value = '';
    document.getElementById('incomeModalTitle').textContent = 'Add Income';
    document.getElementById('deleteIncomeBtn').style.display = 'none';
    getBudgetModal('incomeModal')?.show();
}

export function handleAddExpense() {
    document.getElementById('expenseForm').reset();
    document.getElementById('expenseId').value = '';
    document.getElementById('expenseModalTitle').textContent = 'Add Expense';
    document.getElementById('deleteExpenseBtn').style.display = 'none';
    populateCategoryDropdowns();
    getBudgetModal('expenseModal')?.show();
}

export function handleEditIncome(button) {
    const id = parseInt(button.dataset.id);
    const budgetData = appState.data.budgets[0];
    const incomeItem = budgetData.income.find(i => i.id === id);
    if (!incomeItem) return;

    document.getElementById('incomeId').value = incomeItem.id;
    document.getElementById('incomeSource').value = incomeItem.source;
    document.getElementById('incomeAmount').value = incomeItem.amount;
    document.getElementById('incomeComments').value = incomeItem.comments;
    document.getElementById('incomeModalTitle').textContent = 'Edit Income';
    document.getElementById('deleteIncomeBtn').style.display = 'block';
    getBudgetModal('incomeModal')?.show();
}

export function handleEditExpense(button) {
    const id = parseInt(button.dataset.id);
    const budgetData = appState.data.budgets[0];
    const expenseItem = budgetData.expenses.find(e => e.id === id);
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
    getBudgetModal('expenseModal')?.show();
}

export async function handleSaveIncome() {
    const budgetData = appState.data.budgets?.[0];
    if (!budgetData) return;
    if (!budgetData.income) budgetData.income = [];

    const id = parseInt(document.getElementById('incomeId').value);
    const newIncome = {
        id: id || Date.now(),
        source: document.getElementById('incomeSource').value,
        amount: parseFloat(document.getElementById('incomeAmount').value),
        comments: document.getElementById('incomeComments').value,
    };

    if (id) {
        const index = budgetData.income.findIndex(i => i.id === id);
        if (index > -1) budgetData.income[index] = newIncome;
    } else {
        budgetData.income.push(newIncome);
    }
    await saveDataToFirestore();
    renderBudgetTool();
    getBudgetModal('incomeModal')?.hide();
}

export async function handleSaveExpense() {
    const budgetData = appState.data.budgets[0];
    if (!budgetData) return;
    if (!budgetData.expenses) budgetData.expenses = [];

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
        const index = budgetData.expenses.findIndex(e => e.id === id);
        if(index > -1) budgetData.expenses[index] = newExpense;
    } else {
        budgetData.expenses.push(newExpense);
    }
    await saveDataToFirestore();
    renderBudgetTool();
    getBudgetModal('expenseModal')?.hide();
}

export async function handleDeleteIncome() {
    const budgetData = appState.data.budgets[0];
    const id = parseInt(document.getElementById('incomeId').value);
    budgetData.income = budgetData.income.filter(i => i.id !== id);
    await saveDataToFirestore();
    renderBudgetTool();
    getBudgetModal('incomeModal')?.hide();
}

export async function handleDeleteExpense() {
    const budgetData = appState.data.budgets[0];
    const id = parseInt(document.getElementById('expenseId').value);
    budgetData.expenses = budgetData.expenses.filter(e => e.id !== id);
    await saveDataToFirestore();
    renderBudgetTool();
    getBudgetModal('expenseModal')?.hide();
}

export async function handleSaveBudgetName() {
    const budgetData = appState.data.budgets[0];
    budgetData.name = document.getElementById('budgetName').value;
    await saveDataToFirestore();
}

// --- Category Management ---

export function handleManageCategories() {
    renderCategoryManager();
    getBudgetModal('categoryManagementModal')?.show();
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
    const budgetData = appState.data.budgets[0];
    if (!budgetData.expenseCategories[newCategory]) {
        budgetData.expenseCategories[newCategory] = [];
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
    const budgetData = appState.data.budgets[0];
    if (!budgetData.expenseCategories[mainCategory].includes(newSubCategory)) {
        budgetData.expenseCategories[mainCategory].push(newSubCategory);
        await saveDataToFirestore();
        renderCategoryManager();
    }
}

export async function handleDeleteMainCategory(button) {
    const mainCategory = button.dataset.category;
    if (confirm(`Delete the "${mainCategory}" category and all its expenses?`)) {
        const budgetData = appState.data.budgets[0];
        delete budgetData.expenseCategories[mainCategory];
        budgetData.expenses = budgetData.expenses.filter(exp => !exp.category.startsWith(mainCategory));
        await saveDataToFirestore();
        renderCategoryManager();
        renderBudgetTool();
    }
}

export async function handleDeleteSubCategory(button) {
    const mainCategory = button.dataset.category;
    const subCategory = button.dataset.subcategory;
    if (confirm(`Delete the "${subCategory}" sub-category and its expenses?`)) {
        const budgetData = appState.data.budgets[0];
        budgetData.expenseCategories[mainCategory] = budgetData.expenseCategories[mainCategory].filter(s => s !== subCategory);
        const fullCategoryName = `${mainCategory}-${subCategory}`;
        budgetData.expenses = budgetData.expenses.filter(exp => exp.category !== fullCategoryName);
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
    const budgetData = appState.data.budgets[0];
    const budgetName = budgetData.name || 'budget';
    const filename = `${budgetName.replace(/\s+/g, '_')}.xlsx`;

    const exportData = [];
    budgetData.income.forEach(item => {
        exportData.push({
            'Type': 'Income', 'Source/Payee': item.source, 'Category': '', 'Sub-Category': '',
            'Amount': item.amount, 'Notes': item.comments || ''
        });
    });
    budgetData.expenses.forEach(item => {
        const [category = '', subCategory = ''] = (item.category || '').split('-');
        exportData.push({
            'Type': 'Expense', 'Source/Payee': item.payee || '', 'Category': category, 'Sub-Category': subCategory,
            'Amount': item.amount, 'Notes': item.notes || ''
        });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Budget');
    XLSX.writeFile(workbook, filename);
}

// --- CHART RENDERING LOGIC ---

/**
 * Renders the expense breakdown doughnut chart.
 * @param {object} budget - The active budget object from appState.
 */
function renderBudgetChart(budget) {
    const ctx = document.getElementById('budgetPieChart')?.getContext('2d');
    if (!ctx) return;

    // Destroy the previous chart instance if it exists to prevent memory leaks
    if (appState.charts.budgetChart) {
        appState.charts.budgetChart.destroy();
    }

    const expenses = budget.expenses || [];

    // Aggregate expense data by main category
    const categoryTotals = expenses.reduce((acc, expense) => {
        const mainCategory = (expense.category || 'Uncategorized').split('-')[0];
        acc[mainCategory] = (acc[mainCategory] || 0) + expense.amount;
        return acc;
    }, {});

    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    const chartContainer = document.querySelector('.chart-container');
    if (labels.length === 0) {
        if(chartContainer) chartContainer.innerHTML = '<p class="text-center text-secondary mt-5">Add an expense to see your breakdown.</p>';
        return;
    } else {
        if(chartContainer) chartContainer.innerHTML = '<canvas id="budgetPieChart"></canvas>';
    }

    // Define a color palette
    const chartColors = [
        'rgba(40, 167, 69, 0.8)', 'rgba(220, 53, 69, 0.8)', 'rgba(255, 193, 7, 0.8)', 
        'rgba(13, 202, 240, 0.8)', 'rgba(253, 126, 20, 0.8)', 'rgba(111, 66, 193, 0.8)',
        'rgba(214, 51, 132, 0.8)', 'rgba(25, 135, 84, 0.8)', 'rgba(32, 201, 151, 0.8)', 
        'rgba(102, 16, 242, 0.8)'
    ];

    // Create the new chart instance and store it in the app state
    appState.charts.budgetChart = new Chart(document.getElementById('budgetPieChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses',
                data: data,
                backgroundColor: chartColors,
                borderColor: 'var(--color-surface)',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 60,
                    bottom: 60,
                    left: 60,
                    right: 60
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.chart.getDatasetMeta(0).total || 1;
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                },
                datalabels: {
                    // NEW: Prevent labels from being cut off at the edge of the canvas.
                    clip: false,
                    anchor: 'end',
                    align: 'end',
                    offset: 4,
                    rotation: function(ctx) {
                        const segment = ctx.chart.getDatasetMeta(0).data[ctx.dataIndex];
                        if (!segment) return 0;
                        const angle = (segment.startAngle + segment.endAngle) / 2; // in radians
                        let degrees = angle * (180 / Math.PI);
                        // Flip labels on the bottom half to be readable
                        if (degrees > 90 && degrees < 270) {
                            return degrees + 180;
                        }
                        return degrees;
                    },
                    formatter: (value, ctx) => {
                        const label = ctx.chart.data.labels[ctx.dataIndex];
                        const total = ctx.chart.getDatasetMeta(0).total;
                        const percentage = (value / total) * 100;
                        // UPDATED: Lower the threshold to show more labels for smaller slices.
                        if (percentage < 2) { 
                            return null;
                        }
                        return `${label}\n${percentage.toFixed(0)}%`;
                    },
                    color: 'var(--color-text-secondary)',
                    font: {
                        weight: '500',
                        size: 12
                    },
                    textAlign: 'center'
                }
            }
        }
    });
}

