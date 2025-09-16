import { appState } from './main.js';
import { saveDataToFirestore } from './firestore.js';
import { formatCurrency } from './utils.js';

// Cache Bootstrap modal instances once created
const budgetModals = {};

// Module-level UI state
let showActuals = false;

// Debounce timer for typing in "actuals"
let actualsTypingTimer = null;

// Default expense categories to seed on first load (optional, safe)
const DEFAULT_EXPENSE_CATEGORIES = {
  'Housing': ['Rent/Mortgage', 'Property Taxes', 'Home Insurance', 'HOA', 'Maintenance'],
  'Transportation': ['Fuel', 'Public Transit', 'Insurance', 'Parking', 'Maintenance'],
  'Food': ['Groceries', 'Dining Out', 'Coffee/Snacks'],
  'Utilities': ['Electricity', 'Gas', 'Water/Sewer', 'Trash', 'Internet', 'Mobile'],
  'Personal': ['Clothing', 'Entertainment', 'Subscriptions', 'Hobbies'],
  'Health & Wellness': ['Health Insurance', 'Prescriptions', 'Doctor', 'Dental', 'Gym'],
  'Debt': ['Credit Card', 'Student Loan', 'Auto Loan', 'Personal Loan'],
  'Savings & Investments': ['Emergency Fund', 'Retirement', 'Brokerage'],
  'Miscellaneous': ['Gifts', 'Donations', 'Pet Care', 'Other']
};

function cloneDefaultCategories() {
  const out = {};
  Object.entries(DEFAULT_EXPENSE_CATEGORIES).forEach(([k, v]) => { out[k] = [...v]; });
  return out;
}

/**
 * Helper to return the active budget object (first in the budgets array).
 * Ensures the budgets array and first budget exist so callers can read/write
 * directly on the object and have persistence work with saveDataToFirestore().
 */
function getBudgetObject() {
  if (!appState.data) appState.data = {};
  if (!Array.isArray(appState.data.budgets) || appState.data.budgets.length === 0) {
    appState.data.budgets = [{ id: Date.now(), name: 'Personal Budget', income: [], expenses: [], expenseCategories: cloneDefaultCategories() }];
  }
  return appState.data.budgets[0];
}

/**
 * Gets or creates a Bootstrap modal instance.
 * Lazy-load to prevent startup race conditions.
 */
function getBudgetModal(modalId) {
  if (budgetModals[modalId]) return budgetModals[modalId];
  const modalEl = document.getElementById(modalId);
  if (modalEl) {
    budgetModals[modalId] = new bootstrap.Modal(modalEl);
    if (modalId === 'categoryManagementModal') {
      modalEl.addEventListener('hidden.bs.modal', () => populateCategoryDropdowns());
    }
    return budgetModals[modalId];
  }
  return null;
}

/**
 * Small helper to show a transient toast message using Bootstrap toasts.
 * Creates the DOM node on first use and reuses it.
 */
function showSaveToast(message = 'Saved', variant = 'success') {
  // Create container if missing
  let container = document.getElementById('budget-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'budget-toast-container';
    container.style.position = 'fixed';
    container.style.right = '1rem';
    container.style.bottom = '1rem';
    container.style.zIndex = 1080;
    document.body.appendChild(container);
  }

  const toastId = `budget-toast-${Date.now()}`;
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-bg-${variant} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>`;

  container.insertAdjacentHTML('beforeend', toastHtml);
  const toastEl = document.getElementById(toastId);
  try {
    const bsToast = new bootstrap.Toast(toastEl, { delay: 2300 });
    bsToast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  } catch (err) {
    // If bootstrap isn't available, fallback to a console log and remove after timeout
    console.log('Toast:', message);
    setTimeout(() => toastEl.remove(), 2300);
  }
}

/**
 * Seed default categories on the active budget if none exist.
 */
async function ensureDefaultExpenseCategories() {
  const budget = getBudgetObject();
  if (!budget) return;
  if (!budget.expenseCategories || Object.keys(budget.expenseCategories).length === 0) {
    budget.expenseCategories = cloneDefaultCategories();
    await saveDataToFirestore();
  }
}

/**
 * Main render function for the budget tool.
 */
export function renderBudgetTool() {
  const budget = getBudgetObject();
  if (!budget) return;

  // Initialize structures
  budget.income = budget.income || [];
  budget.expenses = budget.expenses || [];
  budget.expenseCategories = budget.expenseCategories || {};
  appState.charts = appState.charts || {};

  // Seed default categories once (non-blocking)
  ensureDefaultExpenseCategories();

  const incomeListEl = document.getElementById('incomeList');
  const expenseListEl = document.getElementById('expenseList');
  const budgetContainer = document.querySelector('.budget-container');
  const toggleBtn = document.getElementById('toggleActualsBtn');
  const budgetNameInput = document.getElementById('budgetName');

  if (budgetNameInput) budgetNameInput.value = budget.name;

  // --- Toggle Actuals View UI ---
  if (showActuals) {
    budgetContainer?.classList.add('show-actuals');
    if (toggleBtn) toggleBtn.innerHTML = `<i class="fas fa-eye-slash"></i> Hide Actuals`;
  } else {
    budgetContainer?.classList.remove('show-actuals');
    if (toggleBtn) toggleBtn.innerHTML = `<i class="fas fa-cash-register"></i> Show Actuals`;
  }

  // Render Income
  if (incomeListEl) {
    incomeListEl.innerHTML = budget.income.map(item => `
      <div class="list-item">
        <span class="list-item-name">${item.source}</span>
        <span class="list-item-amount">${formatCurrency(item.amount)}</span>
        <button type="button" class="btn btn--secondary btn-sm edit-income-btn" data-id="${item.id}">Edit</button>
      </div>`).join('');
  }

  // Render Expenses (group by main category)
  if (expenseListEl) {
    const groupedExpenses = budget.expenses.reduce((acc, item) => {
      const [main, sub] = (item.category || 'Uncategorized').split('-');
      if (!acc[main]) acc[main] = { total: 0, items: [] };
      acc[main].total += (item.amount || 0);
      acc[main].items.push({ ...item, subCategory: sub });
      return acc;
    }, {});

    expenseListEl.innerHTML = Object.entries(groupedExpenses).map(([category, data]) => {
      const categoryActualTotal = data.items.reduce((sum, item) => sum + (item.actual || 0), 0);
      const categoryVariance = (data.total || 0) - (categoryActualTotal || 0);
      const varianceClass = categoryVariance > 0 ? 'variance-positive' : (categoryVariance < 0 ? 'variance-negative' : '');
  const hasNoSubcategories = data.items.length === 1 && !data.items[0].subCategory;
  const singleItemId = hasNoSubcategories ? data.items[0].id : null;
  const singleItemActual = hasNoSubcategories ? data.items[0].actual : null;

      let categoryHtml = `
        <div class="list-item main-category">
          <span class="list-item-name">${category}</span>
          <span class="list-item-amount">${formatCurrency(data.total)}</span>
          <div class="list-item-actual">
            ${
              showActuals
                ? (hasNoSubcategories
                    ? `<input type="number" step="0.01" class="form-control actual-amount-input ${varianceClass}" data-id="${singleItemId}" value="${singleItemActual != null ? singleItemActual : ''}" placeholder="0.00">`
                    : `<strong class="${varianceClass}">${formatCurrency(categoryActualTotal)}</strong>`
                  )
                : ''
            }
          </div>
          ${hasNoSubcategories ? `<button type="button" class="btn btn--secondary btn-sm edit-expense-btn" ${singleItemId != null ? `data-id="${singleItemId}"` : ''}>Edit</button>` : '<div></div>'}
        </div>`;

      // Always render per-item rows when there is more than one item,
      // even if none have a subCategory, so each expense has its own Edit button.
      if (!hasNoSubcategories) {
        categoryHtml += data.items.map(item => {
          const itemVariance = (item.amount || 0) - (item.actual || 0);
          const itemVarianceClass = itemVariance > 0 ? 'variance-positive' : (itemVariance < 0 ? 'variance-negative' : '');
          return `
            <div class="list-item sub-category">
              <span class="list-item-name">${item.subCategory || 'General'}</span>
              <span class="list-item-amount">${formatCurrency(item.amount)}</span>
              <div class="list-item-actual">
                ${ showActuals
                    ? `<input type="number" step="0.01" class="form-control actual-amount-input ${itemVarianceClass}" data-id="${item.id}" value="${item.actual != null ? item.actual : ''}" placeholder="0.00">`
                    : ''
                }
              </div>
              <button type="button" class="btn btn--secondary btn-sm edit-expense-btn" data-id="${item.id}">Edit</button>
            </div>`;
        }).join('');
      }
      return categoryHtml;
    }).join('');
  }

  renderBudgetTotals();
  renderBudgetChart(budget);
}

/**
 * Renders just the totals and savings sections of the budget.
 */
function renderBudgetTotals() {
  const budget = getBudgetObject();
  if (!budget) return;

  const incomeTotalEl = document.getElementById('incomeTotal');
  const expenseTotalEl = document.getElementById('expenseTotal');
  const savingsSectionEl = document.getElementById('savingsSection');

  const totalIncome = (budget.income || []).reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalBudgetedExpenses = (budget.expenses || []).reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalActualExpenses = (budget.expenses || []).reduce((sum, item) => sum + (item.actual || 0), 0);
  const variance = totalBudgetedExpenses - totalActualExpenses;

  if (incomeTotalEl) {
    incomeTotalEl.innerHTML = `<div class="budget-summary-row"><span>Total Income</span><span>${formatCurrency(totalIncome)}</span></div>`;
  }

  if (expenseTotalEl) {
    const varianceClass = variance > 0 ? 'variance-positive' : (variance < 0 ? 'variance-negative' : '');
    let expenseHtml = `<div class="budget-summary-row"><span>Total Budgeted</span><span>${formatCurrency(totalBudgetedExpenses)}</span></div>`;
    if (showActuals) {
      expenseHtml += `
        <div class="budget-summary-row actuals-row"><span>Total Actual</span><span>${formatCurrency(totalActualExpenses)}</span></div>
        <div class="budget-summary-row actuals-row"><span>Variance</span><span class="${varianceClass}">${formatCurrency(variance)}</span></div>
      `;
    }
    expenseTotalEl.innerHTML = expenseHtml;
  }

  if (savingsSectionEl) {
    const savings = totalIncome - (showActuals ? totalActualExpenses : totalBudgetedExpenses);
    const savingsClass = savings >= 0 ? 'text-success' : 'text-danger';
    savingsSectionEl.innerHTML = `
      <div class="savings-label"><span>Income</span><span>-</span><span>Expenses</span><span>=</span><span>Savings</span></div>
      <div class="savings-value"><span>${formatCurrency(totalIncome)}</span><span>-</span><span>${formatCurrency(showActuals ? totalActualExpenses : totalBudgetedExpenses)}</span><span>=</span><span class="${savingsClass}">${formatCurrency(savings)}</span></div>`;
  }
}

// --- Event Handlers ---

export function handleToggleActuals() {
  showActuals = !showActuals;
  renderBudgetTool();
}

/**
 * Debounced input handler for actual amounts
 */
export async function handleActualAmountChange(inputElement) {
  const idStr = (inputElement.dataset.id ?? '').toString();
  const actualAmount = inputElement.value === '' ? null : parseFloat(inputElement.value);

  const budgetData = getBudgetObject();
  const expenseItem = budgetData.expenses.find(e => String(e.id) === idStr);
  if (!expenseItem) return;

  // Update state only (no full re-render)
  expenseItem.actual = actualAmount;

  // Update the input's variance styling immediately (strict comparisons)
  const variance = (expenseItem.amount || 0) - (actualAmount || 0);
  inputElement.classList.remove('variance-positive', 'variance-negative');
  if (variance > 0) inputElement.classList.add('variance-positive');
  else if (variance < 0) inputElement.classList.add('variance-negative');

  // Debounce totals/chart refresh and persistence
  if (actualsTypingTimer) clearTimeout(actualsTypingTimer);
  actualsTypingTimer = setTimeout(async () => {
    renderBudgetTotals();
    renderBudgetChart(budgetData);
    try {
      await saveDataToFirestore();
      showSaveToast('Budget saved');
    } catch (err) {
      console.error('Failed to save budget', err);
      showSaveToast('Save failed', 'danger');
    }
  }, 400);
}

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
  const idStr = (button.dataset.id ?? '').toString();
  const budgetData = getBudgetObject();
  const incomeItem = budgetData.income.find(i => String(i.id) === idStr);
  if (!incomeItem) return;

  document.getElementById('incomeId').value = incomeItem.id;
  document.getElementById('incomeSource').value = incomeItem.source;
  document.getElementById('incomeAmount').value = incomeItem.amount;
  document.getElementById('incomeComments').value = incomeItem.comments || '';
  document.getElementById('incomeModalTitle').textContent = 'Edit Income';
  document.getElementById('deleteIncomeBtn').style.display = 'block';
  getBudgetModal('incomeModal')?.show();
}

export function handleEditExpense(button) {
  // Primary id from button dataset. If missing (main-category single-item row),
  // attempt to resolve the expense by the main category name as a fallback.
  let idStr = (button.dataset.id ?? '').toString();
  const budgetData = getBudgetObject();

  // Normalize idStr to empty if it's not a usable value
  if (!idStr || idStr === 'null' || idStr === 'undefined') idStr = '';

  let expenseItem = (budgetData.expenses || []).find(e => String(e.id) === idStr);

  if (!expenseItem) {
    // Try to locate the main category label in the same row as a fallback
    const mainRow = button.closest('.main-category');
    const mainCatText = mainRow?.querySelector('.list-item-name')?.textContent?.trim();
    if (mainCatText) {
      const matches = (budgetData.expenses || []).filter(e => ((e.category || '').split('-')[0]) === mainCatText);
      if (matches.length === 1) {
        expenseItem = matches[0];
        idStr = String(expenseItem.id);
      }
    }
  }

  if (!expenseItem) {
    console.warn('handleEditExpense: could not find expense for id or main category', idStr, button);
    return;
  }

  document.getElementById('expenseId').value = expenseItem.id;
  const [mainCat, subCat] = (expenseItem.category || '').split('-');
  populateCategoryDropdowns(mainCat, subCat);
  document.getElementById('expenseAmount').value = expenseItem.amount;
  document.getElementById('expensePayee').value = expenseItem.payee || '';
  document.getElementById('expenseDay').value = expenseItem.day || '';
  document.getElementById('expenseNotes').value = expenseItem.notes || '';
  document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
  document.getElementById('deleteExpenseBtn').style.display = 'block';
  getBudgetModal('expenseModal')?.show();
}

export async function handleSaveIncome() {
  const budgetData = getBudgetObject();
  if (!budgetData) return;
  if (!budgetData.income) budgetData.income = [];

  const idField = (document.getElementById('incomeId').value ?? '').toString();
  const idStr = idField.length ? idField : '';
  const newIncome = {
    id: idStr || Date.now(),
    source: document.getElementById('incomeSource').value,
    amount: parseFloat(document.getElementById('incomeAmount').value),
    comments: document.getElementById('incomeComments').value,
  };

  const existingIndex = budgetData.income.findIndex(i => String(i.id) === String(newIncome.id));
  if (existingIndex > -1) budgetData.income[existingIndex] = newIncome;
  else budgetData.income.push(newIncome);

  try {
    await saveDataToFirestore();
    showSaveToast('Income saved');
  } catch (err) {
    console.error('Failed to save income', err);
    showSaveToast('Save failed', 'danger');
  }
  renderBudgetTool();
  getBudgetModal('incomeModal')?.hide();
}

export async function handleSaveExpense() {
  const budgetData = getBudgetObject();
  if (!budgetData) return;
  if (!budgetData.expenses) budgetData.expenses = [];

  const idField = (document.getElementById('expenseId').value ?? '').toString();
  const mainCat = document.getElementById('expenseCategory').value;
  const subCat = document.getElementById('expenseSubCategory').value;

  let finalCategory = mainCat;
  if (subCat && subCat !== "N/A" && subCat !== "") {
    finalCategory = `${mainCat}-${subCat}`;
  }
  const newExpense = {
    id: idField || Date.now(),
    category: finalCategory,
    amount: parseFloat(document.getElementById('expenseAmount').value),
    payee: document.getElementById('expensePayee').value,
    day: parseInt(document.getElementById('expenseDay').value),
    notes: document.getElementById('expenseNotes').value,
    actual: idField ? (budgetData.expenses.find(e => String(e.id) === String(idField))?.actual ?? null) : null
  };

  const existingIndex = budgetData.expenses.findIndex(e => String(e.id) === String(newExpense.id));
  if (existingIndex > -1) budgetData.expenses[existingIndex] = newExpense;
  else budgetData.expenses.push(newExpense);

  try {
    await saveDataToFirestore();
    showSaveToast('Expense saved');
  } catch (err) {
    console.error('Failed to save expense', err);
    showSaveToast('Save failed', 'danger');
  }
  renderBudgetTool();
  getBudgetModal('expenseModal')?.hide();
}

export async function handleDeleteIncome() {
  const budgetData = getBudgetObject();
  const idStr = (document.getElementById('incomeId').value ?? '').toString();
  budgetData.income = (budgetData.income || []).filter(i => String(i.id) !== idStr);
  try {
    await saveDataToFirestore();
    showSaveToast('Income deleted');
  } catch (err) {
    console.error('Failed to delete income', err);
    showSaveToast('Delete failed', 'danger');
  }
  renderBudgetTool();
  getBudgetModal('incomeModal')?.hide();
}

export async function handleDeleteExpense() {
  const budgetData = getBudgetObject();
  const idStr = (document.getElementById('expenseId').value ?? '').toString();
  budgetData.expenses = (budgetData.expenses || []).filter(e => String(e.id) !== idStr);
    try {
      await saveDataToFirestore();
      showSaveToast('Expense deleted');
    } catch (err) {
      console.error('Failed to delete expense', err);
      showSaveToast('Delete failed', 'danger');
    }
  renderBudgetTool();
  getBudgetModal('expenseModal')?.hide();
}

export async function handleSaveBudgetName() {
  const budgetData = getBudgetObject();
  budgetData.name = document.getElementById('budgetName').value;
  try {
    await saveDataToFirestore();
    showSaveToast('Budget name saved');
  } catch (err) {
    console.error('Failed to save budget name', err);
    showSaveToast('Save failed', 'danger');
  }
}

// --- Category Management ---

export function handleManageCategories() {
  renderCategoryManager();
  getBudgetModal('categoryManagementModal')?.show();
}

function renderCategoryManager() {
  const container = document.getElementById('categoryListContainer');
  const categories = getBudgetObject().expenseCategories || {};
  container.innerHTML = Object.entries(categories).map(([mainCat, subCats]) => {
    const safeId = (mainCat || '').toString().replace(/[^a-zA-Z0-9_-]/g, '');
    return `
      <div class="category-manager-item">
        <div class="category-manager-header">
          <h6>${mainCat}</h6>
          <button type="button" class="btn btn-sm btn-outline-danger delete-main-category-btn" data-category="${mainCat}">&times;</button>
        </div>
        <ul class="sub-category-list">
          ${(subCats || []).map(sub => `
            <li class="sub-category-list-item">
              <span>${sub}</span>
              <button type="button" class="btn btn-sm btn-outline-danger delete-subcategory-btn" data-category="${mainCat}" data-subcategory="${sub}">&times;</button>
            </li>`).join('')}
        </ul>
        <div class="input-group input-group-sm">
          <input type="text" class="form-control" placeholder="New sub-category..." id="sub-input-${safeId}">
          <button type="button" class="btn btn--secondary add-subcategory-btn" data-category="${mainCat}">Add</button>
        </div>
      </div>`;
  }).join('');
}

export async function handleAddMainCategory() {
  const input = document.getElementById('newMainCategoryInput');
  const newCategory = (input?.value || '').trim();
  if (!newCategory) return;

  const budgetData = getBudgetObject();
  if (!budgetData.expenseCategories) budgetData.expenseCategories = {};

    if (!budgetData.expenseCategories[newCategory]) {
    budgetData.expenseCategories[newCategory] = [];
    try {
      await saveDataToFirestore();
      showSaveToast('Category added');
    } catch (err) {
      console.error('Failed to add category', err);
      showSaveToast('Save failed', 'danger');
    }
  }
  renderCategoryManager();
  input.value = '';
}

export async function handleAddSubCategory(button) {
  const mainCategory = button.dataset.category;
  const safeId = (mainCategory || '').toString().replace(/[^a-zA-Z0-9_-]/g, '');
  const input = document.getElementById(`sub-input-${safeId}`);
  const newSubCategory = (input?.value || '').trim();
  if (!newSubCategory) return;

  const budgetData = getBudgetObject();
  if (!budgetData.expenseCategories) budgetData.expenseCategories = {};
  if (!budgetData.expenseCategories[mainCategory]) {
    budgetData.expenseCategories[mainCategory] = [];
  }

    if (!budgetData.expenseCategories[mainCategory].includes(newSubCategory)) {
    budgetData.expenseCategories[mainCategory].push(newSubCategory);
    try {
      await saveDataToFirestore();
      showSaveToast('Sub-category added');
    } catch (err) {
      console.error('Failed to add sub-category', err);
      showSaveToast('Save failed', 'danger');
    }
  }
  renderCategoryManager();
  if (input) input.value = '';
}

export async function handleDeleteMainCategory(button) {
  const mainCategory = button.dataset.category;
  if (confirm(`Delete the "${mainCategory}" category and all its expenses?`)) {
    const budgetData = getBudgetObject();
    delete budgetData.expenseCategories[mainCategory];
    budgetData.expenses = (budgetData.expenses || []).filter(exp => !String(exp.category || '').startsWith(mainCategory));
    try { await saveDataToFirestore(); showSaveToast('Category deleted'); } catch (err) { console.error('Failed to delete main category', err); showSaveToast('Delete failed', 'danger'); }
    renderCategoryManager();
    renderBudgetTool();
  }
}

export async function handleDeleteSubCategory(button) {
  const mainCategory = button.dataset.category;
  const subCategory = button.dataset.subcategory;
  if (confirm(`Delete the "${subCategory}" sub-category and its expenses?`)) {
    const budgetData = getBudgetObject();
    budgetData.expenseCategories[mainCategory] =
      (budgetData.expenseCategories[mainCategory] || []).filter(s => s !== subCategory);
    const fullCategoryName = `${mainCategory}-${subCategory}`;
    budgetData.expenses = (budgetData.expenses || []).filter(exp => String(exp.category) !== fullCategoryName);
    try { await saveDataToFirestore(); showSaveToast('Sub-category deleted'); } catch (err) { console.error('Failed to delete sub-category', err); showSaveToast('Delete failed', 'danger'); }
    renderCategoryManager();
    renderBudgetTool();
  }
}

// --- Dropdown Helpers ---

export function populateCategoryDropdowns(selectedMain = '', selectedSub = '') {
  const categories = getBudgetObject().expenseCategories || {};
  const mainCategoryEl = document.getElementById('expenseCategory');
  if (!mainCategoryEl) return;
  mainCategoryEl.innerHTML = '<option value="">Select a category...</option>';
  for (const category in categories) {
    mainCategoryEl.innerHTML += `<option value="${category}" ${category === selectedMain ? 'selected' : ''}>${category}</option>`;
  }
  populateSubCategoryDropdown(selectedSub);
}

export function populateSubCategoryDropdown(selectedSub = '') {
  const categories = getBudgetObject().expenseCategories || {};
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
  elementToExport.querySelectorAll('button, .btn-group, .dropdown-menu, input').forEach(el => el.remove());

  html2pdf().from(elementToExport).set(opt).save();
}

export function handleExportToExcel() {
  const budgetData = getBudgetObject();
  const budgetName = budgetData.name || 'budget';
  const filename = `${budgetName.replace(/\s+/g, '_')}.xlsx`;

  const exportData = [];
  budgetData.income.forEach(item => {
    exportData.push({
      'Type': 'Income', 'Source/Payee': item.source, 'Category': '', 'Sub-Category': '',
      'Budgeted': item.amount, 'Actual': '', 'Notes': item.comments || ''
    });
  });
  budgetData.expenses.forEach(item => {
    const [category = '', subCategory = ''] = (item.category || '').split('-');
    exportData.push({
      'Type': 'Expense', 'Source/Payee': item.payee || '', 'Category': category, 'Sub-Category': subCategory,
      'Budgeted': item.amount, 'Actual': item.actual, 'Notes': item.notes || ''
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Budget');
  XLSX.writeFile(workbook, filename);
}

// --- CHART RENDERING LOGIC ---

function renderBudgetChart(budget) {
  const chartContainer = document.querySelector('.chart-container');
  const canvas = document.getElementById('budgetPieChart');

  if (!chartContainer || !canvas) return;

  if (appState.charts?.budgetChart) {
    appState.charts.budgetChart.destroy();
    appState.charts.budgetChart = null;
  }

  const expenses = budget.expenses || [];
  const useActualsForChart = showActuals && expenses.some(e => e.actual != null && e.actual > 0);

  const categoryTotals = expenses.reduce((acc, expense) => {
    const mainCategory = ((expense.category || 'Uncategorized').split('-'))[0];
    const amount = useActualsForChart ? (expense.actual || 0) : (expense.amount || 0);
    acc[mainCategory] = (acc[mainCategory] || 0) + amount;
    return acc;
  }, {});

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  if (labels.length === 0 || data.every(d => d === 0)) {
    canvas.style.display = 'none';
    if (!chartContainer.querySelector('#budgetChartPlaceholder')) {
      const p = document.createElement('p');
      p.id = 'budgetChartPlaceholder';
      p.className = 'text-center text-secondary mt-5';
      p.textContent = 'Add an expense to see your breakdown.';
      chartContainer.appendChild(p);
    } else {
      chartContainer.querySelector('#budgetChartPlaceholder').style.display = 'block';
    }
    return;
  } else {
    canvas.style.display = 'block';
    const placeholder = chartContainer.querySelector('#budgetChartPlaceholder');
    if (placeholder) placeholder.style.display = 'none';
  }

  const categoryColorMap = {
    'Housing': '#2563eb',
    'Transportation': '#f59e0b',
    'Food': '#d946ef',
    'Utilities': '#14b8a6',
    'Personal': '#ef4444',
    'Health & Wellness': '#22c55e',
    'Debt': '#8b5cf6',
    'Savings & Investments': '#6366f1',
    'Miscellaneous': '#64748b',
  };
  const fallbackColors = ['#f43f5e', '#d97706', '#0ea5e9', '#84cc16'];
  let colorIndex = 0;
  const backgroundColors = labels.map(label => categoryColorMap[label] || fallbackColors[colorIndex++ % fallbackColors.length]);

  const chartTitle = useActualsForChart ? 'Actual Spending Breakdown' : 'Budgeted Expense Breakdown';
  const chartHeaderEl = document.querySelector('.chart-header h3');
  if (chartHeaderEl) chartHeaderEl.textContent = chartTitle;

  if (!window.Chart) return;
  try {
    if (window.ChartDataLabels) {
      window.Chart.register(window.ChartDataLabels);
    }
  } catch {}

  appState.charts.budgetChart = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        label: 'Expenses',
        data,
        backgroundColor: backgroundColors,
        borderColor: 'var(--color-surface)',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 50, bottom: 50, left: 50, right: 50 } },
      plugins: {
        legend: { display: false },
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
          clip: false,
          clamp: true,
          anchor: 'end',
          align: 'start',
          offset: 8,
          rotation: function(ctx) {
            const segment = ctx.chart.getDatasetMeta(0).data[ctx.dataIndex];
            if (!segment) return 0;
            const angle = (segment.startAngle + segment.endAngle) / 2;
            let degrees = angle * (180 / Math.PI);
            if (degrees > 90 && degrees < 270) return degrees + 180;
            return degrees;
          },
          formatter: (value, ctx) => {
            const total = ctx.chart.getDatasetMeta(0).total;
            const percentage = (value / total) * 100;
            if (percentage < 1.5) return '';
            const label = ctx.chart.data.labels[ctx.dataIndex];
            return `${label}\n${percentage.toFixed(0)}%`;
          },
          color: 'var(--color-text-secondary)',
          font: { weight: '500', size: 12 },
          textAlign: 'center'
        }
      }
    }
  });
}
