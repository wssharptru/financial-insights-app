import { appState } from './state.js';
import { saveDataToFirestore } from './firestore.js';
import { formatCurrency } from './utils.js';

// Cache Bootstrap modal instances once created
const budgetModals = {};

// Module-level UI state
let showActuals = false;

// Debounce timer for typing in "actuals"
let actualsTypingTimer = null;
// Debounce interval (ms) used before auto-saving typed values
const SAVE_DEBOUNCE_MS = 3000; // 3 seconds - gives users time to finish typing

// Module-level totals for the dashboard
let totalIncome = 0;
let totalBudgetedExpenses = 0;
let totalActualExpenses = 0;


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

  // Inject control buttons into the budget container (only once)
  if (budgetContainer) {
    if (!budgetContainer.dataset.dragInitialized) {
        budgetContainer.dataset.dragInitialized = "true";
        // Global drag event listeners can be attached here if needed
        // But we will attach specific ones to the items for better control
    }

    // Zero values button (keeps categories)
    if (!document.getElementById('zeroValuesBtn')) {
      const zeroBtn = document.createElement('button');
      zeroBtn.id = 'zeroValuesBtn';
      zeroBtn.type = 'button';
      zeroBtn.className = 'btn btn--warning btn-sm me-2';
      zeroBtn.textContent = 'Zero Values';
      zeroBtn.addEventListener('click', async () => {
        if (!confirm('Zero all income and expense amounts (categories will be preserved)?')) return;
        await handleZeroValues();
      });
      budgetContainer.insertAdjacentElement('afterbegin', zeroBtn);
    }

    // Reset all (values + categories) button
    if (!document.getElementById('resetAllBtn')) {
      const resetAllBtn = document.createElement('button');
      resetAllBtn.id = 'resetAllBtn';
      resetAllBtn.type = 'button';
      resetAllBtn.className = 'btn btn--danger btn-sm ms-2';
      resetAllBtn.textContent = 'Reset All (values + categories)';
      resetAllBtn.addEventListener('click', async () => {
        if (!confirm('Reset budget values AND restore default categories? This will overwrite your custom categories.')) return;
        await handleResetAll();
      });
      budgetContainer.insertAdjacentElement('afterbegin', resetAllBtn);
    }
  }

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
    // Calculate totals for dashboard
    totalIncome = budget.income.reduce((sum, item) => sum + (item.amount || 0), 0);
    totalBudgetedExpenses = 0;
    totalActualExpenses = 0;

    const groupedExpenses = budget.expenses.reduce((acc, item) => {
      const [main, sub] = (item.category || 'Uncategorized').split('-');
      if (!acc[main]) acc[main] = { total: 0, items: [] };
      
      const amount = (item.amount || 0);
      const actual = (item.actual || 0);
      
      acc[main].total += amount;
      acc[main].items.push({ ...item, subCategory: sub });
      
      totalBudgetedExpenses += amount;
      totalActualExpenses += actual;
      
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
        <div class="list-item main-category" draggable="true" data-category="${category}">
          <div class="drag-handle"><i class="fas fa-grip-vertical"></i></div>
          <button type="button" class="btn btn-sm btn-light-outline collapse-toggle" data-category="${category}" style="margin-right: 8px;">
            <i class="fas fa-chevron-down"></i>
          </button>
          <span class="list-item-name">${category}</span>
          <span class="list-item-amount">${formatCurrency(data.total)}</span>
          <div class="list-item-actual">
            ${
              showActuals
                ? (hasNoSubcategories
                    ? `<input type="text" inputmode="decimal" class="form-control actual-amount-input ${varianceClass}" data-id="${singleItemId}" value="${singleItemActual != null ? singleItemActual : ''}" placeholder="0.00">`
                    : `<strong class="${varianceClass}">${formatCurrency(categoryActualTotal)}</strong>`
                  )
                : ''
            }
          </div>
          ${hasNoSubcategories ? `<button type="button" class="btn btn--secondary btn-sm edit-expense-btn" ${singleItemId != null ? `data-id="${singleItemId}"` : ''}>Edit</button>` : '<div></div>'}
        </div>
        <!-- PROGRESS BAR for Main Category -->
        <div class="category-progress-container px-3 pb-2">
            <div class="progress" style="height: 6px;">
                <div class="progress-bar ${categoryVariance < 0 ? 'bg-danger' : (categoryActualTotal / data.total > 0.9 ? 'bg-warning' : 'bg-success')}" 
                     role="progressbar" 
                     style="width: ${Math.min((categoryActualTotal / (data.total || 1)) * 100, 100)}%">
                </div>
            </div>
        </div>`;

        // Always render per-item rows when there is more than one item,
        // even if none have a subCategory, so each expense has its own Edit button.
        if (!hasNoSubcategories) {
          categoryHtml += `<div class="collapsible-content" id="collapse-${category.replace(/[^a-zA-Z0-9]/g, '')}">`;
          categoryHtml += data.items.map(item => {
              const itemVariance = (item.amount || 0) - (item.actual || 0);
              const itemVarianceClass = itemVariance > 0 ? 'variance-positive' : (itemVariance < 0 ? 'variance-negative' : '');
              return `
            <div class="list-item sub-category">
              <span class="list-item-name">${item.subCategory || 'General'}</span>
              <span class="list-item-amount">${formatCurrency(item.amount)}</span>
              <div class="list-item-actual">
                ${ showActuals
                    ? `<input type="text" inputmode="decimal" class="form-control actual-amount-input ${itemVarianceClass}" data-id="${item.id}" value="${item.actual != null ? item.actual : ''}" placeholder="0.00">`
                    : ''
                }
              </div>
              <button type="button" class="btn btn--secondary btn-sm edit-expense-btn" data-id="${item.id}">Edit</button>
            </div>`;
            }).join('');
          categoryHtml += `</div>`;
        }
        return categoryHtml;
      }).join('');
      }

  // Add event listeners for collapse toggles (AFTER rendering)
  // Use a timeout to ensure DOM is updated, or simpler: attach immediately
  setTimeout(() => {
    document.querySelectorAll('.collapse-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const category = btn.dataset.category;
        const icon = btn.querySelector('i');
        const contentId = `collapse-${category.replace(/[^a-zA-Z0-9]/g, '')}`;
        const content = document.getElementById(contentId);
        
        if (content) {
          if (content.style.display === 'none') {
             content.style.display = 'block';
             icon.classList.remove('fa-chevron-right');
             icon.classList.add('fa-chevron-down');
          } else {
             content.style.display = 'none';
             icon.classList.remove('fa-chevron-down');
             icon.classList.add('fa-chevron-right');
          }
        }
      });
    });
  }, 0);

  // Add Drag and Drop Event Listeners
  setTimeout(() => {
    const draggables = document.querySelectorAll('.list-item.main-category');
    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', handleDragStart);
        draggable.addEventListener('dragover', handleDragOver);
        draggable.addEventListener('drop', handleDrop);
        draggable.addEventListener('dragend', handleDragEnd);
        draggable.addEventListener('dragleave', handleDragLeave);
    });
  }, 0);

  renderBudgetTotals();


  renderBudgetChart(budget);
}

/**
 * Renders just the totals and savings sections of the budget.
 */
function renderBudgetTotals() {
  const budget = getBudgetObject();
  if (!budget) return;

  /* 
     Update Dashboard Cards 
     IDs: dashboardIncome, dashboardBudgeted, dashboardSpent, dashboardSavings, savingsProgressBar, savingsCaption
  */
  const dashboardIncome = document.getElementById('dashboardIncome');
  const dashboardBudgeted = document.getElementById('dashboardBudgeted');
  const dashboardSpent = document.getElementById('dashboardSpent');
  const dashboardSavings = document.getElementById('dashboardSavings');
  const savingsProgressBar = document.getElementById('savingsProgressBar');
  const savingsCaption = document.getElementById('savingsCaption');

  if (dashboardIncome) dashboardIncome.textContent = formatCurrency(totalIncome);
  if (dashboardBudgeted) dashboardBudgeted.textContent = formatCurrency(totalBudgetedExpenses);
  if (dashboardSpent) dashboardSpent.textContent = formatCurrency(totalActualExpenses);

  const leftToBudget = totalIncome - totalBudgetedExpenses; 
  // "Savings" for dashboard is Income - Actuals (Net position) OR Left To Budget? 
  // Plan said "Left to Budget" / Savings. Let's show "Left to Budget" (Income - Budgeted) mainly 
  // or maybe better "Available" (Income - Actual).
  
  // Let's stick to "Left to Budget" as per plan card label
  if (dashboardSavings) {
      dashboardSavings.textContent = formatCurrency(leftToBudget);
      dashboardSavings.className = 'card-value ' + (leftToBudget >= 0 ? 'text-success' : 'text-danger');
  }

  // Calculate Savings Rate (based on Actuals vs Income)
  const netSavings = totalIncome - totalActualExpenses;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  
  if (savingsProgressBar) {
      const clampedRate = Math.max(0, Math.min(savingsRate, 100)); // 0 to 100
      savingsProgressBar.style.width = `${clampedRate}%`;
      savingsProgressBar.className = 'progress-bar ' + (savingsRate > 20 ? 'bg-success' : (savingsRate > 0 ? 'bg-warning' : 'bg-danger'));
  }
  
  if (savingsCaption) {
      savingsCaption.textContent = `${savingsRate.toFixed(1)}% Savings Rate`;
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

  // Try to parse the input as a potential math expression
  let valStart = inputElement.value.trim();
  let actualAmount = null;

  if (valStart === '') {
      actualAmount = null;
  } else {
      // Check if it looks like math (digits, operators, dots, parens)
      if (/^[\d\.\+\-\*\/\(\)\s]+$/.test(valStart)) {
          try {
              // Create a safe function to evaluate simple math
              // NOTE: This restricts to return a number only
              const result = new Function(`return ${valStart}`)();
              if (isFinite(result)) {
                  actualAmount = parseFloat(result.toFixed(2));
                  // Update the input view with the calculated result
                  // But only if it's different to avoid cursor jumps while typing?
                  // Actually, we usually want this on blur/change, not every keystroke.
                  // For now, let's update it so the user sees the result.
                  if (document.activeElement !== inputElement) {
                      inputElement.value = actualAmount;
                  }
              }
          } catch (e) {
              // If eval fails, just try parseFloat
              console.warn("Math eval failed", e);
              actualAmount = parseFloat(valStart);
          }
      } else {
          actualAmount = parseFloat(valStart);
      }
  }
  
  if (isNaN(actualAmount)) actualAmount = null;

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
  }, SAVE_DEBOUNCE_MS);
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



// --- Drag and Drop Handlers ---

let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.category);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Simple visual cue: add class to potential drop target if it's not the dragged item
    const target = e.target.closest('.main-category');
    if (target && target !== draggedItem) {
        target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const target = e.target.closest('.main-category');
    if (target) {
        target.classList.remove('drag-over');
    }
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.main-category').forEach(el => el.classList.remove('drag-over'));
    draggedItem = null;
}

async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target.closest('.main-category');
    if (draggedItem && target && draggedItem !== target) {
        const sourceCategory = draggedItem.dataset.category;
        const targetCategory = target.dataset.category;

        console.log(`Dropped ${sourceCategory} onto ${targetCategory}`);
        
        // Reorder budget.expenseCategories based on DOM order or direct swap
        // Since groupedExpenses iterates Object.entries, order depends on insertion order in JS objects (mostly).
        // A robust way: Reconstruct the expenseCategories object in the new order.
        
        const budget = getBudgetObject();
        const oldCategories = budget.expenseCategories;
        const newCategories = {};
        
        // Get all current categories keys in order
        const keys = Object.keys(oldCategories);
        const fromIndex = keys.indexOf(sourceCategory);
        const toIndex = keys.indexOf(targetCategory);
        
        if (fromIndex > -1 && toIndex > -1) {
             // Remove from old pos
             keys.splice(fromIndex, 1);
             // Insert at new pos
             // Note: if dropping ONTO, do we place before or after? 
             // DOM 'drop' usually implies "insert here". Let's assume insert BEFORE if coming from below, AFTER if above?
             // For simplicity, let's just use splice at the index.
             keys.splice(toIndex, 0, sourceCategory);
             
             // Rebuild object
             keys.forEach(k => {
                 newCategories[k] = oldCategories[k];
             });
             
             budget.expenseCategories = newCategories;
             
             // Save and re-render
             try {
                await saveDataToFirestore();
                showSaveToast('Order saved');
             } catch (err) {
                 console.error("Failed to save reorder", err);
                 showSaveToast('Save failed', 'danger');
             }
             renderBudgetTool();
        }
    }
}



/**
 * Reset all budget numeric values to zero (income amounts and expense amounts/actuals).
 * Persists the changes to Firestore and re-renders the budget UI.
 */
export async function handleResetBudget() {
  const budgetData = getBudgetObject();
  if (!budgetData) return;

  // Zero income amounts
  if (Array.isArray(budgetData.income)) {
    budgetData.income = budgetData.income.map(i => ({ ...i, amount: 0 }));
  }

  // Zero expense amounts and actuals
  if (Array.isArray(budgetData.expenses)) {
    budgetData.expenses = budgetData.expenses.map(e => ({ ...e, amount: 0, actual: 0 }));
  }

  try {
    await saveDataToFirestore();
    showSaveToast('Budget reset');
  } catch (err) {
    console.error('Failed to reset budget', err);
    showSaveToast('Reset failed', 'danger');
  }
  renderBudgetTool();
}

/**
 * Zero all numeric values but keep categories/sub-categories intact.
 */
export async function handleZeroValues() {
  const budgetData = getBudgetObject();
  if (!budgetData) return;

  if (Array.isArray(budgetData.income)) {
    budgetData.income = budgetData.income.map(i => ({ ...i, amount: 0 }));
  }
  if (Array.isArray(budgetData.expenses)) {
    budgetData.expenses = budgetData.expenses.map(e => ({ ...e, amount: 0, actual: 0 }));
  }

  try {
    await saveDataToFirestore();
    showSaveToast('Values zeroed (categories kept)');
  } catch (err) {
    console.error('Failed to zero values', err);
    showSaveToast('Zero failed', 'danger');
  }
  renderBudgetTool();
}

/**
 * Reset values and restore default categories/sub-categories.
 */
export async function handleResetAll() {
  const budgetData = getBudgetObject();
  if (!budgetData) return;

  // restore default categories
  budgetData.expenseCategories = cloneDefaultCategories();

  // zero values
  if (Array.isArray(budgetData.income)) {
    budgetData.income = budgetData.income.map(i => ({ ...i, amount: 0 }));
  }
  if (Array.isArray(budgetData.expenses)) {
    budgetData.expenses = budgetData.expenses.map(e => ({ ...e, amount: 0, actual: 0 }));
  }

  try {
    await saveDataToFirestore();
    showSaveToast('Budget reset to defaults');
  } catch (err) {
    console.error('Failed to reset all', err);
    showSaveToast('Reset failed', 'danger');
  }
  renderBudgetTool();
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

  // Sort by value descending so the largest categories are at the top
  const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => k);
  const data = sorted.map(([, v]) => v);

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
    'Housing':               '#2563eb',
    'Transportation':        '#f59e0b',
    'Food':                  '#d946ef',
    'Utilities':             '#14b8a6',
    'Personal':              '#ef4444',
    'Health & Wellness':     '#22c55e',
    'Debt':                  '#8b5cf6',
    'Savings & Investments': '#6366f1',
    'Miscellaneous':         '#64748b',
  };
  const fallbackColors = ['#f43f5e', '#d97706', '#0ea5e9', '#84cc16'];
  let colorIndex = 0;
  const backgroundColors = labels.map(label =>
    (categoryColorMap[label] || fallbackColors[colorIndex++ % fallbackColors.length]) + 'cc' // slight transparency
  );
  const borderColors = labels.map(label =>
    categoryColorMap[label] || fallbackColors[colorIndex++ % fallbackColors.length]
  );

  const chartTitle = useActualsForChart ? 'Actual Spending Breakdown' : 'Budgeted Expense Breakdown';
  const chartHeaderEl = document.querySelector('.chart-header h3');
  if (chartHeaderEl) chartHeaderEl.textContent = chartTitle;

  if (!window.Chart) return;

  const total = data.reduce((s, v) => s + v, 0);

  appState.charts.budgetChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Amount',
        data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',   // <-- this makes it a HORIZONTAL bar chart
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 8, bottom: 8, left: 8, right: 24 } },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: value => '$' + value.toLocaleString(),
            font: { family: 'Inter', size: 11 },
            color: '#64748b',
            maxTicksLimit: 6,
          },
          border: { display: false }
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { family: 'Inter', size: 12, weight: '500' },
            color: '#334155',
          },
          border: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.parsed.x || 0;
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `  ${formatCurrency(value)}  (${pct}%)`;
            }
          },
          bodyFont: { family: 'Inter', size: 13 },
          padding: 10,
          cornerRadius: 8,
        }
      }
    }
  });
}
