// assets/js/charts.js

import { appState } from './main.js';
import { formatCurrency } from './utils.js';

// --- HELPER FUNCTIONS ---

/**
 * Processes portfolio holdings to generate data for the allocation chart.
 * @param {object} portfolio - The active portfolio object.
 * @returns {{labels: string[], data: number[]}} - Data structured for Chart.js.
 */
function buildAllocationData(portfolio) {
    const allocationData = portfolio.holdings.reduce((acc, holding) => {
        const type = holding.asset_type || 'Other';
        acc[type] = (acc[type] || 0) + holding.total_value;
        return acc;
    }, {});
    return {
        labels: Object.keys(allocationData),
        data: Object.values(allocationData)
    };
}

/**
 * Processes portfolio holdings to generate data for the performance chart.
 * @param {object} portfolio - The active portfolio object.
 * @returns {{labels: string[], cost: number[], current: number[]}} - Data structured for Chart.js.
 */
function buildPerformanceData(portfolio) {
    const labels = portfolio.holdings.map(h => h.symbol);
    const costBasisData = portfolio.holdings.map(h => h.average_cost * h.shares);
    const currentValueData = portfolio.holdings.map(h => h.total_value);
    return {
        labels,
        cost: costBasisData,
        current: currentValueData
    };
}

/**
 * A universal utility to update the data of an existing Chart.js instance.
 * This prevents destroying and recreating charts on every render.
 * @param {Chart} chart - The Chart.js instance to update.
 * @param {string[]} labels - The new array of labels for the x-axis.
 * @param {number[]|number[][]} seriesArray - The new data. Can be a single array for one dataset
 * or an array of arrays for multiple datasets.
 */
function updateChartData(chart, labels, seriesArray) {
    chart.data.labels = labels;
    if (Array.isArray(seriesArray[0])) {
        // Handle multiple datasets (e.g., performance bar chart)
        seriesArray.forEach((datasetData, i) => {
            if (chart.data.datasets[i]) {
                chart.data.datasets[i].data = datasetData;
            }
        });
    } else {
        // Handle a single dataset (e.g., allocation doughnut chart)
        chart.data.datasets[0].data = seriesArray;
    }
    // Update the chart without any animation for a snappier feel.
    chart.update('none');
}


// --- CHART RENDERING LOGIC ---

/**
 * Initializes or updates all charts on the dashboard.
 * @param {object} portfolio - The active portfolio object.
 */
export function initializeCharts(portfolio) {
    if (!portfolio || !portfolio.holdings || portfolio.holdings.length === 0) {
        // If there's no data, ensure any existing charts are cleared.
        if (appState.charts.allocationChart) appState.charts.allocationChart.destroy();
        if (appState.charts.performanceChart) appState.charts.performanceChart.destroy();
        appState.charts.allocationChart = null;
        appState.charts.performanceChart = null;
        return;
    }

    updateAllocationChart(portfolio);
    updatePerformanceChart(portfolio);
}

/**
 * Creates or updates the portfolio allocation doughnut chart.
 * @param {object} portfolio - The active portfolio object.
 */
function updateAllocationChart(portfolio) {
    const ctx = document.getElementById('allocationChart')?.getContext('2d');
    if (!ctx) return;

    const { labels, data } = buildAllocationData(portfolio);

    if (appState.charts.allocationChart) {
        // If the chart instance already exists, just update its data.
        updateChartData(appState.charts.allocationChart, labels, data);
    } else {
        // If it doesn't exist, create a new chart instance.
        const chartColors = [
            'rgba(33, 128, 141, 0.8)', 'rgba(94, 82, 64, 0.8)', 'rgba(98, 108, 113, 0.8)',
            'rgba(230, 129, 97, 0.8)', 'rgba(50, 184, 198, 0.8)', 'rgba(168, 75, 47, 0.8)'
        ];

        appState.charts.allocationChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Portfolio Allocation',
                    data: data,
                    backgroundColor: chartColors,
                    borderColor: 'rgba(252, 252, 249, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: 'rgba(98, 108, 113, 1)', font: { family: 'Inter', size: 12 } } },
                    tooltip: { callbacks: { label: (context) => `${context.label || ''}: ${formatCurrency(context.parsed)}` } }
                }
            }
        });
    }
}

/**
 * Creates or updates the portfolio performance bar chart.
 * @param {object} portfolio - The active portfolio object.
 */
function updatePerformanceChart(portfolio) {
    const ctx = document.getElementById('performanceChart')?.getContext('2d');
    if (!ctx) return;

    const { labels, cost, current } = buildPerformanceData(portfolio);

    if (appState.charts.performanceChart) {
        // If the chart instance already exists, update its data.
        updateChartData(appState.charts.performanceChart, labels, [cost, current]);
    } else {
        // If it doesn't exist, create a new chart instance.
        appState.charts.performanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cost Basis',
                    data: cost,
                    backgroundColor: 'rgba(98, 108, 113, 0.7)',
                    borderColor: 'rgba(98, 108, 113, 1)',
                    borderWidth: 1
                }, {
                    label: 'Current Value',
                    data: current,
                    backgroundColor: 'rgba(33, 128, 141, 0.7)',
                    borderColor: 'rgba(33, 128, 141, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { callback: (value) => formatCurrency(value) } } },
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } }
                }
            }
        });
    }
}
