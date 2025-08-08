// assets/js/charts.js

import { appState } from './main.js';
import { formatCurrency } from './utils.js';

/**
 * Initializes or updates the charts on the dashboard.
 * @param {object} portfolio - The active portfolio object.
 */
export function initializeCharts(portfolio) {
    if (!portfolio || !portfolio.holdings || portfolio.holdings.length === 0) {
        return;
    }

    // Destroy existing charts to prevent memory leaks on re-render
    if (appState.charts.allocationChart) {
        appState.charts.allocationChart.destroy();
    }
    if (appState.charts.performanceChart) {
        appState.charts.performanceChart.destroy();
    }

    renderAllocationChart(portfolio);
    renderPerformanceChart(portfolio);
}

/**
 * Renders the portfolio allocation doughnut chart.
 * @param {object} portfolio - The active portfolio object.
 */
function renderAllocationChart(portfolio) {
    const allocationCtx = document.getElementById('allocationChart')?.getContext('2d');
    if (!allocationCtx) return;

    const allocationData = portfolio.holdings.reduce((acc, holding) => {
        const type = holding.asset_type || 'Other';
        if (!acc[type]) {
            acc[type] = 0;
        }
        acc[type] += holding.total_value;
        return acc;
    }, {});

    const labels = Object.keys(allocationData);
    const data = Object.values(allocationData);
    
    // Define a color palette for the chart
    const chartColors = [
        'rgba(33, 128, 141, 0.8)',  // Teal
        'rgba(94, 82, 64, 0.8)',    // Brown
        'rgba(98, 108, 113, 0.8)',  // Slate
        'rgba(230, 129, 97, 0.8)', // Orange
        'rgba(50, 184, 198, 0.8)',  // Light Teal
        'rgba(168, 75, 47, 0.8)'    // Dark Orange
    ];

    appState.charts.allocationChart = new Chart(allocationCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Portfolio Allocation',
                data: data,
                backgroundColor: chartColors,
                borderColor: 'rgba(252, 252, 249, 1)', // --color-cream-50
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'rgba(98, 108, 113, 1)', // --color-slate-500
                        font: { family: 'Inter', size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += formatCurrency(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renders the portfolio performance line chart.
 * Note: This is a simplified implementation. A real-world scenario would require historical data snapshots.
 * @param {object} portfolio - The active portfolio object.
 */
function renderPerformanceChart(portfolio) {
    const performanceCtx = document.getElementById('performanceChart')?.getContext('2d');
    if (!performanceCtx) return;

    // Simplified: show initial investment vs. current value for each holding
    const labels = portfolio.holdings.map(h => h.symbol);
    const costBasisData = portfolio.holdings.map(h => h.average_cost * h.shares);
    const currentValueData = portfolio.holdings.map(h => h.total_value);

    appState.charts.performanceChart = new Chart(performanceCtx, {
        type: 'bar', // Bar chart is better for comparing individual assets
        data: {
            labels: labels,
            datasets: [{
                label: 'Cost Basis',
                data: costBasisData,
                backgroundColor: 'rgba(98, 108, 113, 0.7)', // --color-slate-500
                borderColor: 'rgba(98, 108, 113, 1)',
                borderWidth: 1
            }, {
                label: 'Current Value',
                data: currentValueData,
                backgroundColor: 'rgba(33, 128, 141, 0.7)', // --color-primary
                borderColor: 'rgba(33, 128, 141, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value, index, values) {
                            return formatCurrency(value);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            }
        }
    });
}