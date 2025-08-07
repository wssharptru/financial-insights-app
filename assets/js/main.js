// assets/js/main.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { injectHTML } from './loader.js';
import { initializeAuthHandlers } from './auth.js';
import { initializeNavigation } from './navigation.js';
import { initializeEventListeners } from './event-listeners.js';
// We now import two separate functions from firestore
import { loadInitialData, listenForDataChanges, setRenderCallback } from './firestore.js';
import { renderAll } from './renderer.js';

// --- CONFIGURATION & KEYS --- (remains the same)
const firebaseConfig = {
    apiKey: "__FIREBASE_API_KEY__",
    authDomain: "__FIREBASE_AUTH_DOMAIN__",
    projectId: "__FIREBASE_PROJECT_ID__",
    storageBucket: "__FIREBASE_STORAGE_BUCKET__",
    messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
    appId: "__FIREBASE_APP_ID__",
    measurementId: "__FIREBASE_MEASUREMENT_ID__"
};
const finnhubApiKey = "__FINNHUB_API_KEY__";
const twelvedataApiKey = "__TWELVEDATA_API_KEY__";
const fmpApiKey = "__FMP_API_KEY__";


// --- GLOBAL STATE --- (remains the same)
export let appState = {
    app: null,
    auth: null,
    db: null,
    data: {},
    currentUserId: null,
    unsubscribeFromFirestore: null,
    itemToDelete: { id: null, type: null },
    activeScreenerReportId: null,
    isFetchingHistoricalData: false,
    isAnalysisRunning: false,
    modals: {},
    charts: {
        allocationChart: null,
        performanceChart: null,
    },
    config: {
        firebaseConfig,
        finnhubApiKey,
        twelvedataApiKey,
        fmpApiKey
    },
    uiInitialized: false
};

// --- INITIALIZATION --- //
async function main() {
    appState.app = initializeApp(appState.config.firebaseConfig);
    appState.auth = getAuth(appState.app);
    appState.db = getFirestore(appState.app);

    setRenderCallback(renderAll);
    
    // The onAuthStateChanged listener now drives the entire application startup
    initializeAuth();
}

// Loads static HTML partials and sets up event listeners. Runs only once.
async function initializeAppUI() {
    if (appState.uiInitialized) return;

    await Promise.all([
        injectHTML('sidebar-container', 'partials/sidebar.html'),
        injectHTML('auth-container', 'partials/auth/auth-forms.html'),
        injectHTML('modals-container', 'partials/modals.html')
    ]);

    await injectHTML('main-content', 'pages/dashboard.html');
    initializeAuthHandlers();
    initializeNavigation();
    initializeEventListeners();
    
    appState.uiInitialized = true;
}

// Manages the application state based on user authentication.
function initializeAuth() {
    const globalLoader = document.getElementById('globalLoader');
    const appWrapper = document.getElementById('app-wrapper');

    onAuthStateChanged(appState.auth, async (user) => {
        await initializeAppUI();

        if (user) {
            // --- LOGGED-IN FLOW ---
            appState.currentUserId = user.uid;

            // 1. Await the initial data fetch. This is the blocking call that solves the race condition.
            await loadInitialData(user.uid);

            // 2. Now that data is guaranteed to be in appState, show the main application.
            appWrapper.classList.remove('logged-out', 'd-none');
            appWrapper.classList.add('logged-in');
            globalLoader.classList.add('d-none');

            // 3. Render the UI for the first time with the loaded data.
            renderAll();
            
            // 4. Attach the real-time listener for any subsequent data changes.
            listenForDataChanges(user.uid);

        } else {
            // --- LOGGED-OUT FLOW ---
            appState.currentUserId = null;
            if (appState.unsubscribeFromFirestore) {
                appState.unsubscribeFromFirestore();
            }
            appState.data = {};
            
            appWrapper.classList.add('logged-out');
            appWrapper.classList.remove('logged-in', 'd-none');
            globalLoader.classList.add('d-none');
        }
    });
}

document.addEventListener('DOMContentLoaded', main);
