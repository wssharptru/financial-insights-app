// assets/js/main.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { injectHTML } from './loader.js';
import { initializeAuthHandlers } from './auth.js';
import { initializeNavigation } from './navigation.js';
import { initializeEventListeners } from './event-listeners.js';
import { loadDataFromFirestore, setRenderCallback } from './firestore.js';
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
    uiInitialized: false // Flag to prevent re-initializing UI
};

// --- INITIALIZATION --- //
async function main() {
    appState.app = initializeApp(appState.config.firebaseConfig);
    appState.auth = getAuth(appState.app);
    appState.db = getFirestore(appState.app);

    // Set the render callback for firestore.js
    setRenderCallback(renderAll);

    // Let onAuthStateChanged handle the initial UI setup
    initializeAuth();
}

async function initializeAppUI() {
    // Only run this once
    if (appState.uiInitialized) return;

    await Promise.all([
        injectHTML('sidebar-container', 'partials/sidebar.html'),
        injectHTML('auth-container', 'partials/auth/auth-forms.html'),
        injectHTML('modals-container', 'partials/modals.html')
    ]);

    // Load initial page content and set up all event listeners
    await injectHTML('main-content', 'pages/dashboard.html');
    initializeAuthHandlers();
    initializeNavigation();
    initializeEventListeners();
    
    appState.uiInitialized = true;
}


function initializeAuth() {
    const globalLoader = document.getElementById('globalLoader');
    const appWrapper = document.getElementById('app-wrapper');

    onAuthStateChanged(appState.auth, async (user) => {
        // First, ensure the static parts of the UI are loaded
        await initializeAppUI();

        if (user) {
            appState.currentUserId = user.uid;
            
            // Keep loader visible, prepare app container
            appWrapper.classList.remove('logged-out');
            appWrapper.classList.add('logged-in');

            // Set up the listener that will hide the loader and render the app
            loadDataFromFirestore(user.uid);

        } else {
            appState.currentUserId = null;
            if (appState.unsubscribeFromFirestore) {
                appState.unsubscribeFromFirestore();
            }
            appState.data = {};
            
            // Show the login form
            appWrapper.classList.add('logged-out');
            appWrapper.classList.remove('logged-in');
            
            // Hide loader and show the auth screen
            globalLoader.classList.add('d-none');
            appWrapper.classList.remove('d-none');
        }
    });
}

document.addEventListener('DOMContentLoaded', main);
