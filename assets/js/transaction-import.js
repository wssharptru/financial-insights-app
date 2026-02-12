// assets/js/transaction-import.js

import { appState } from './main.js';
import { getActivePortfolio, recalculateHolding } from './portfolio-logic.js';
import { saveDataToFirestore } from './firestore.js';
import { renderAll } from './renderer.js';

/**
 * Activity type mapping from brokerage export to app transaction types.
 * Returns null for types that should be skipped.
 */
const ACTIVITY_TYPE_MAP = {
    'bought': 'Buy',
    'sold': 'Sell',
    'dividend': 'Dividend',
    'qualified dividend': 'Dividend',
    'reinvested dividend': 'Dividend',
};

/** State for the current import session */
let importState = {
    parsedData: null, // { holdings: [], transactions: [], skippedRows: [] }
};

/**
 * Opens the import transactions modal.
 */
export function openImportModal() {
    importState.parsedData = null;
    const fileInput = document.getElementById('importFileInput');
    const previewContainer = document.getElementById('importPreviewContainer');
    const importSummary = document.getElementById('importSummary');
    const confirmImportBtn = document.getElementById('confirmImportBtn');

    if (fileInput) fileInput.value = '';
    if (previewContainer) previewContainer.innerHTML = '<p class="text-muted text-center">Select a source above to preview transactions.</p>';
    if (importSummary) importSummary.classList.add('d-none');
    if (confirmImportBtn) confirmImportBtn.disabled = true;

    const el = document.getElementById('importTransactionsModal');
    if (el) bootstrap.Modal.getOrCreateInstance(el)?.show();
}

/**
 * Handles the file selection and parses the spreadsheet.
 */
export async function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    const previewContainer = document.getElementById('importPreviewContainer');
    const importSummary = document.getElementById('importSummary');
    const confirmImportBtn = document.getElementById('confirmImportBtn');

    previewContainer.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Parsing spreadsheet...</p></div>';

    try {
        const data = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

        importState.parsedData = processImportData(rawRows);
        renderImportPreview(previewContainer, importSummary, confirmImportBtn);

    } catch (error) {
        console.error('Error parsing file:', error);
        previewContainer.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Failed to parse the file. Please ensure it is a valid spreadsheet (.xlsx, .xls, or .csv).</div>`;
        confirmImportBtn.disabled = true;
    }
}

/**
 * Reads a File object as an ArrayBuffer.
 */
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(new Uint8Array(e.target.result));
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Finds the header row index by looking for a row containing both "Symbol" and "Activity Type" (or similar).
 */
function findHeaderRow(rawRows) {
    for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
        const row = rawRows[i];
        if (!row) continue;
        const lowerRow = row.map(cell => (cell || '').toString().toLowerCase().trim());
        const hasSymbol = lowerRow.some(c => c === 'symbol');
        const hasActivity = lowerRow.some(c => c.includes('activity type') || c.includes('action'));
        if (hasSymbol && hasActivity) return i;
    }
    // Fallback: look for a row that has "Symbol" anywhere
    for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
        const row = rawRows[i];
        if (!row) continue;
        const lowerRow = row.map(cell => (cell || '').toString().toLowerCase().trim());
        if (lowerRow.includes('symbol')) return i;
    }
    return -1;
}

/**
 * Processes raw spreadsheet rows into structured import data.
 * Returns { holdings: Map<symbol, holdingInfo>, transactions: [], skippedRows: [], skippedCount: number }
 */
function processImportData(rawRows) {
    const headerIdx = findHeaderRow(rawRows);
    if (headerIdx === -1) {
        throw new Error('Could not find a header row with "Symbol" column. Please check your spreadsheet format.');
    }

    const headers = rawRows[headerIdx].map(h => (h || '').toString().trim());

    // Build column index map (case-insensitive)
    const colIdx = {};
    headers.forEach((h, i) => {
        const lower = h.toLowerCase();
        if (lower.includes('transaction date') || lower.includes('trade date')) colIdx.date = colIdx.date ?? i;
        if (lower === 'activity type' || lower === 'action') colIdx.activityType = i;
        if (lower === 'description') colIdx.description = i;
        if (lower === 'symbol') colIdx.symbol = i;
        if (lower.includes('quantity') || lower.includes('qty')) colIdx.quantity = i;
        if (lower.includes('price')) colIdx.price = i;
        if (lower.includes('amount')) colIdx.amount = i;
    });

    // Fallback: use the first date-looking column if we didn't find "Transaction Date"
    if (colIdx.date === undefined) {
        headers.forEach((h, i) => {
            if (h.toLowerCase().includes('date') && colIdx.date === undefined) colIdx.date = i;
        });
    }

    const holdingsMap = new Map(); // symbol -> { name, transactions: [] }
    const allTransactions = [];
    const skippedRows = [];

    for (let i = headerIdx + 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) continue;

        const symbol = (row[colIdx.symbol] || '').toString().trim().toUpperCase();
        const activityTypeRaw = (row[colIdx.activityType] || '').toString().trim().toLowerCase();
        const description = (row[colIdx.description] || '').toString().trim();
        const dateRaw = (row[colIdx.date] || '').toString().trim();
        const quantity = parseFloat(row[colIdx.quantity]) || 0;
        const price = parseFloat(row[colIdx.price]) || 0;
        const amount = parseFloat(row[colIdx.amount]) || 0;

        // Skip rows without a valid symbol or with placeholder symbols
        if (!symbol || symbol === '--' || symbol === 'N/A' || symbol === '') {
            if (activityTypeRaw) skippedRows.push({ row: i + 1, reason: 'No symbol', description, activityType: activityTypeRaw });
            continue;
        }

        // Map activity type
        const mappedType = ACTIVITY_TYPE_MAP[activityTypeRaw];
        if (!mappedType) {
            skippedRows.push({ row: i + 1, reason: `Unsupported type: ${activityTypeRaw}`, symbol, description });
            continue;
        }

        // Parse date from MM/DD/YYYY to YYYY-MM-DD
        const parsedDate = parseDate(dateRaw);

        const txn = {
            type: mappedType,
            date: parsedDate,
            shares: Math.abs(quantity),
            price: Math.abs(price),
            total: Math.abs(amount),
            symbol: symbol,
            description: description,
        };

        allTransactions.push(txn);

        // Group by symbol for holdings creation
        if (!holdingsMap.has(symbol)) {
            // Clean up the description for the holding name
            const cleanName = cleanHoldingName(description);
            holdingsMap.set(symbol, { name: cleanName, symbol });
        }
    }

    return {
        holdings: holdingsMap,
        transactions: allTransactions,
        skippedRows: skippedRows,
    };
}

/**
 * Parses a date string (MM/DD/YYYY or other common formats) to YYYY-MM-DD.
 */
function parseDate(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];

    // Handle MM/DD/YYYY
    const parts = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (parts) {
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        let year = parts[3];
        if (year.length === 2) year = '20' + year;
        return `${year}-${month}-${day}`;
    }
    return dateStr;
}

/**
 * Cleans up a brokerage description into a readable holding name.
 */
function cleanHoldingName(description) {
    if (!description) return 'Unknown';
    // Remove common brokerage suffixes
    let name = description
        .replace(/CONFIRM\s*NBR.*$/i, '')
        .replace(/UNSOLICITED\s*TRADE.*$/i, '')
        .replace(/REC\s*\d{2}\/\d{2}\/\d{2,4}.*$/i, '')
        .replace(/DIVIDEND\s*REINVESTMENT.*$/i, '')
        .trim();
    // Title case
    if (name === name.toUpperCase() && name.length > 5) {
        name = name.split(' ').map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
    }
    return name || 'Unknown';
}

/**
 * Renders the import preview inside the modal.
 */
function renderImportPreview(container, summaryEl, confirmBtn) {
    const data = importState.parsedData;
    if (!data || data.transactions.length === 0) {
        container.innerHTML = '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle me-2"></i>No importable transactions found in the file. Make sure the spreadsheet contains Buy, Sell, or Dividend transactions with valid symbols.</div>';
        confirmBtn.disabled = true;
        return;
    }

    // Build summary
    const holdingCount = data.holdings.size;
    const txnCount = data.transactions.length;
    const buyCount = data.transactions.filter(t => t.type === 'Buy').length;
    const sellCount = data.transactions.filter(t => t.type === 'Sell').length;
    const divCount = data.transactions.filter(t => t.type === 'Dividend').length;

    summaryEl.innerHTML = `
        <div class="d-flex flex-wrap gap-3">
            <div><strong>${holdingCount}</strong> <span class="text-muted">new holding${holdingCount !== 1 ? 's' : ''}</span></div>
            <div><strong>${txnCount}</strong> <span class="text-muted">transaction${txnCount !== 1 ? 's' : ''}</span></div>
            <div class="text-success"><i class="fas fa-arrow-down me-1"></i>${buyCount} Buy</div>
            ${sellCount > 0 ? `<div class="text-danger"><i class="fas fa-arrow-up me-1"></i>${sellCount} Sell</div>` : ''}
            ${divCount > 0 ? `<div class="text-info"><i class="fas fa-coins me-1"></i>${divCount} Dividend</div>` : ''}
            ${data.skippedRows.length > 0 ? `<div class="text-warning"><i class="fas fa-forward me-1"></i>${data.skippedRows.length} skipped</div>` : ''}
        </div>`;
    summaryEl.classList.remove('d-none');

    // Build preview table
    const rows = data.transactions.map(t => {
        const typeClass = t.type === 'Buy' ? 'text-success' : t.type === 'Sell' ? 'text-danger' : 'text-info';
        return `<tr>
            <td>${t.date}</td>
            <td><strong>${t.symbol}</strong></td>
            <td class="${typeClass}">${t.type}</td>
            <td>${t.shares > 0 ? t.shares.toFixed(4) : '--'}</td>
            <td>${t.price > 0 ? '$' + t.price.toFixed(2) : '--'}</td>
            <td>$${t.total.toFixed(2)}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
            <table class="table table-sm table-hover mb-0">
                <thead class="sticky-top bg-body">
                    <tr>
                        <th>Date</th>
                        <th>Symbol</th>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;

    confirmBtn.disabled = false;
}

/**
 * Executes the import: creates holdings and transactions in the active portfolio.
 */
export async function executeImport() {
    const data = importState.parsedData;
    if (!data || data.transactions.length === 0) return;

    const confirmBtn = document.getElementById('confirmImportBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Importing...';

    try {
        const portfolio = getActivePortfolio();
        if (!portfolio.holdings) portfolio.holdings = [];
        if (!portfolio.transactions) portfolio.transactions = [];

        // Create holdings for each unique symbol
        const symbolToHoldingId = new Map();

        for (const [symbol, info] of data.holdings) {
            // Check if holding already exists in portfolio
            const existing = portfolio.holdings.find(h => h.symbol.toUpperCase() === symbol);
            if (existing) {
                symbolToHoldingId.set(symbol, existing.id);
            } else {
                const newHolding = {
                    id: Date.now() + Math.floor(Math.random() * 10000),
                    symbol: symbol,
                    name: info.name,
                    asset_type: 'Stock', // Default; user can edit later
                    shares: 0,
                    average_cost: 0,
                    current_price: 0,
                    total_value: 0,
                    gain_loss: 0,
                    gain_loss_percent: 0,
                };
                portfolio.holdings.push(newHolding);
                symbolToHoldingId.set(symbol, newHolding.id);
            }
            // Small delay to ensure unique IDs
            await new Promise(r => setTimeout(r, 1));
        }

        // Create transactions linked to their holdings
        for (const txn of data.transactions) {
            const holdingId = symbolToHoldingId.get(txn.symbol);
            if (!holdingId) continue;

            const newTransaction = {
                id: Date.now() + Math.floor(Math.random() * 100000),
                holdingId: holdingId,
                type: txn.type,
                date: txn.date,
                shares: txn.shares,
                price: txn.price,
                total: txn.total,
            };
            portfolio.transactions.push(newTransaction);
            await new Promise(r => setTimeout(r, 1));
        }

        // Recalculate all imported holdings
        for (const holdingId of symbolToHoldingId.values()) {
            recalculateHolding(holdingId);
        }

        await saveDataToFirestore();
        renderAll();

        // Show success and close modal
        const previewContainer = document.getElementById('importPreviewContainer');
        previewContainer.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle me-2"></i>Successfully imported <strong>${data.transactions.length}</strong> transactions across <strong>${data.holdings.size}</strong> holdings!</div>`;
        confirmBtn.innerHTML = '<i class="fas fa-check me-2"></i>Done';
        confirmBtn.classList.remove('btn--primary');
        confirmBtn.classList.add('btn--secondary');
        confirmBtn.onclick = () => {
            bootstrap.Modal.getOrCreateInstance(document.getElementById('importTransactionsModal'))?.hide();
            confirmBtn.classList.remove('btn--secondary');
            confirmBtn.classList.add('btn--primary');
            confirmBtn.onclick = null;
        };
        confirmBtn.disabled = false;

    } catch (error) {
        console.error('Import failed:', error);
        const previewContainer = document.getElementById('importPreviewContainer');
        previewContainer.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>Import failed: ${error.message}</div>`;
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fas fa-file-import me-2"></i>Retry Import';
    }
}

// --- E*TRADE API INTEGRATION ---

const PROXY_URL = "https://apiproxy-srcgpxworq-uc.a.run.app";

/**
 * E*TRADE transaction type mapping (API returns different names than spreadsheet).
 */
const ETRADE_TYPE_MAP = {
    'bought': 'Buy',
    'sold': 'Sell',
    'dividend': 'Dividend',
    'qualified dividend': 'Dividend',
    'reinvested dividend': 'Dividend',
    'buy': 'Buy',
    'sell': 'Sell',
};

/**
 * Helper: call the Firebase proxy with auth token.
 */
async function callEtradeProxy(path, method = 'POST', body = null) {
    const user = appState.auth.currentUser;
    if (!user) throw new Error('Not logged in');
    const token = await user.getIdToken();

    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    };
    if (body) options.body = JSON.stringify(body);

    const url = method === 'GET'
        ? `${PROXY_URL}${path}${path.includes('?') ? '&' : '?'}token=${token}`
        : `${PROXY_URL}${path}`;

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
    }
    return data;
}

/**
 * Step 1: Start E*TRADE OAuth - opens authorization in a new window.
 */
export async function startEtradeAuth() {
    const statusEl = document.getElementById('etradeAuthStatus');
    const connectBtn = document.getElementById('etradeConnectBtn');

    connectBtn.disabled = true;
    statusEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Connecting...';

    try {
        const data = await callEtradeProxy('/etrade/auth/start', 'GET');

        if (data.authorizeUrl) {
            // Open E*TRADE authorization page in a new window
            window.open(data.authorizeUrl, '_blank', 'width=800,height=600');

            // Show verifier input section
            statusEl.innerHTML = '<span class="text-success"><i class="fas fa-check-circle me-1"></i>Authorization page opened</span>';
            document.getElementById('etradeVerifierSection').classList.remove('d-none');
            connectBtn.disabled = false;
        }
    } catch (error) {
        console.error('E*TRADE auth start failed:', error);
        statusEl.innerHTML = `<span class="text-danger"><i class="fas fa-times-circle me-1"></i>${error.message}</span>`;
        connectBtn.disabled = false;
    }
}

/**
 * Step 2: Submit the OAuth verifier code from E*TRADE.
 */
export async function submitEtradeVerifier() {
    const verifierInput = document.getElementById('etradeVerifierInput');
    const submitBtn = document.getElementById('etradeVerifierSubmitBtn');
    const statusEl = document.getElementById('etradeAuthStatus');
    const verifier = verifierInput.value.trim();

    if (!verifier) {
        statusEl.innerHTML = '<span class="text-danger">Please enter the verification code</span>';
        return;
    }

    submitBtn.disabled = true;
    statusEl.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Verifying...';

    try {
        await callEtradeProxy('/etrade/auth/complete', 'POST', { verifier });

        statusEl.innerHTML = '<span class="text-success"><i class="fas fa-check-circle me-1"></i>Connected to E*TRADE!</span>';
        document.getElementById('etradeVerifierSection').classList.add('d-none');
        document.getElementById('etradeConnectSection').classList.add('d-none');

        // Fetch accounts
        await fetchEtradeAccounts();
    } catch (error) {
        console.error('E*TRADE verifier failed:', error);
        statusEl.innerHTML = `<span class="text-danger"><i class="fas fa-times-circle me-1"></i>${error.message}</span>`;
        submitBtn.disabled = false;
    }
}

/**
 * Step 3: Fetch E*TRADE accounts and populate the account selector.
 */
export async function fetchEtradeAccounts() {
    const accountSection = document.getElementById('etradeAccountSection');
    const selector = document.getElementById('etradeAccountSelector');
    const statusEl = document.getElementById('etradeAuthStatus');

    try {
        const data = await callEtradeProxy('/etrade/accounts', 'POST');

        const accounts = data?.AccountListResponse?.Accounts?.Account;
        if (!accounts || accounts.length === 0) {
            statusEl.innerHTML = '<span class="text-warning">No accounts found</span>';
            return;
        }

        const accountList = Array.isArray(accounts) ? accounts : [accounts];

        selector.innerHTML = accountList.map(a =>
            `<option value="${a.accountIdKey}">${a.accountName || a.accountDesc} (${a.accountId})</option>`
        ).join('');

        accountSection.classList.remove('d-none');
    } catch (error) {
        console.error('E*TRADE accounts fetch failed:', error);
        if (error.message.includes('expired') || error.message.includes('authorize')) {
            // Re-show connect button
            document.getElementById('etradeConnectSection').classList.remove('d-none');
            statusEl.innerHTML = '<span class="text-warning"><i class="fas fa-exclamation-triangle me-1"></i>Session expired. Please reconnect.</span>';
        } else {
            statusEl.innerHTML = `<span class="text-danger">${error.message}</span>`;
        }
    }
}

/**
 * Step 4: Fetch all transactions for the selected account and render preview.
 */
export async function fetchEtradeTransactions() {
    const selector = document.getElementById('etradeAccountSelector');
    const fetchBtn = document.getElementById('etradeFetchBtn');
    const previewContainer = document.getElementById('importPreviewContainer');
    const importSummary = document.getElementById('importSummary');
    const confirmImportBtn = document.getElementById('confirmImportBtn');
    const accountIdKey = selector.value;

    if (!accountIdKey) return;

    fetchBtn.disabled = true;
    fetchBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Fetching...';
    previewContainer.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div><p class="mt-2">Downloading transactions from E*TRADE...</p></div>';

    try {
        const data = await callEtradeProxy('/etrade/transactions', 'POST', { accountIdKey });

        if (!data.transactions || data.transactions.length === 0) {
            previewContainer.innerHTML = '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle me-2"></i>No transactions found for this account.</div>';
            fetchBtn.disabled = false;
            fetchBtn.innerHTML = '<i class="fas fa-download me-2"></i>Fetch Transactions';
            return;
        }

        // Transform E*TRADE API data into our import format
        importState.parsedData = processEtradeTransactions(data.transactions);
        renderImportPreview(previewContainer, importSummary, confirmImportBtn);

    } catch (error) {
        console.error('E*TRADE transactions fetch failed:', error);
        previewContainer.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i>${error.message}</div>`;
    } finally {
        fetchBtn.disabled = false;
        fetchBtn.innerHTML = '<i class="fas fa-download me-2"></i>Fetch Transactions';
    }
}

/**
 * Transforms E*TRADE API transaction objects into the same format used by file import.
 */
function processEtradeTransactions(apiTransactions) {
    const holdingsMap = new Map();
    const allTransactions = [];
    const skippedRows = [];

    for (const txn of apiTransactions) {
        const brokerage = txn.brokerage || txn.Brokerage || {};
        const product = brokerage.product || brokerage.Product || {};

        const symbol = (product.symbol || '').toString().trim().toUpperCase();
        const txnType = (txn.transactionType || brokerage.transactionType || '').toString().trim().toLowerCase();
        const description = (txn.description || '').toString().trim();

        // Skip non-symbol transactions
        if (!symbol || symbol === '--' || symbol === '') {
            if (txnType) skippedRows.push({ row: 0, reason: 'No symbol', description, activityType: txnType });
            continue;
        }

        // Map transaction type
        const mappedType = ETRADE_TYPE_MAP[txnType] || ACTIVITY_TYPE_MAP[txnType];
        if (!mappedType) {
            skippedRows.push({ row: 0, reason: `Unsupported: ${txnType}`, symbol, description });
            continue;
        }

        // Parse date (E*TRADE uses epoch milliseconds)
        let dateStr;
        const rawDate = txn.transactionDate || txn.settleDate;
        if (typeof rawDate === 'number') {
            const d = new Date(rawDate);
            dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } else {
            dateStr = parseDate(String(rawDate || ''));
        }

        const quantity = Math.abs(parseFloat(brokerage.quantity) || 0);
        const price = Math.abs(parseFloat(brokerage.price) || 0);
        const amount = Math.abs(parseFloat(txn.amount) || 0);

        allTransactions.push({
            type: mappedType,
            date: dateStr,
            shares: quantity,
            price: price,
            total: amount,
            symbol: symbol,
            description: description,
        });

        if (!holdingsMap.has(symbol)) {
            const cleanName = cleanHoldingName(description) || product.securityType || symbol;
            holdingsMap.set(symbol, { name: cleanName, symbol });
        }
    }

    return {
        holdings: holdingsMap,
        transactions: allTransactions,
        skippedRows: skippedRows,
    };
}
