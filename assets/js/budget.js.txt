import { appState } from './main.js';
import { saveDataToFirestore } from './firestore.js';
import { formatCurrency } from './utils.js';

/**
 * Main render function for the budget tool.
 */
export function renderBudgetTool() {
    if (!appState.data.budgets || appState.data.budgets.length === 0) return;

    // For simplicity, we'll work with the first budget
    const budget = appState.data.budgets[0];
    if (!budget) return;

    const incomeListEl = document.getElementById('incomeList');
    const expenseListEl = document.getElementById('expenseList');
    const incomeTotalEl = document.getElementById('incomeTotal');
    const expenseTotalEl = document.getElementById('expenseTotal');
    const savingsSectionEl = document.getElementById('savingsSection');
    const budgetNameInput = document.getElementById('budgetName');

    if(budgetNameInput) budgetNameInput.value = budget.name;

    // Render Income
    let totalIncome = 0;
    if (incomeListEl) {
        incomeListEl.innerHTML = budget.income.map(item => {
            totalIncome += item.amount;
            return `
                <div class="list-item">
                    <span class="list-item-name">${item.source}</span>
                    <span class="list-item-amount">${formatCurrency(item.amount)}</span>
                    <button class="btn btn--secondary btn-sm edit-income-btn" data-id="${item.id}">Edit</button>
                </div>`;
        }).join('');
    }

    // Render Expenses
    let totalExpenses = 0;
    if (expenseListEl) {
        const groupedExpenses = budget.expenses.reduce((acc, item) => {
            totalExpenses += item.amount;
            const parts = item.category.split('-');
            const main = parts[0];
            const sub = parts.length > 1 ? parts.slice(1).join('-') : null;
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
                </div>`;
            
            if (data.items.some(item => item.subCategory)) {
                 categoryHtml += data.items.map(item => `
                    <div class="list-item sub-category">
                        <span class="list-item-name">${item.subCategory || item.category}</span>
                        <span class="list-item-amount">${formatCurrency(item.amount)}</span>
                        <button class="btn btn--secondary btn-sm edit-expense-btn" data-id="${item.id}">Edit</button>
                    </div>`
                ).join('');
            } else {
                 categoryHtml = `
                <div class="list-item main-category">
                    <span class="list-item-name">${category}</span>
                    <span class="list-item-amount">${formatCurrency(data.total)}</span>
                     <button class="btn btn--secondary btn-sm edit-expense-btn" data-id="${data.items[0].id}">Edit</button>
                </div>`;
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
            <span>Savings:</span>
            <span class="${savingsClass}">${formatCurrency(savings)}</span>`;
    }
}

