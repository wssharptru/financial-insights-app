// assets/js/main.js

// Firebase v9+ modular SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { injectHTML } from './loader.js';
import { initializeAuthHandlers } from './auth.js';
import { initializeNavigation } from './navigation.js';
import { initializeEventListeners } from './event-listeners.js';
// Import 'setRenderCallback' from firestore.js
import { loadDataFromFirestore, saveDataToFirestore, setRenderCallback } from './firestore.js';
import { renderAll } from './renderer.js';

// --- CONFIGURATION & KEYS --- //
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

// --- GLOBAL STATE --- //
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
    }
};

// --- INITIALIZATION --- //
async function main() {
    // Initialize Firebase
    appState.app = initializeApp(appState.config.firebaseConfig);
    appState.auth = getAuth(appState.app);
    appState.db = getFirestore(appState.app);

    // *** ADDED THIS LINE ***
    // Connects the Firestore data loader to the rendering engine.
    setRenderCallback(renderAll);

    await loadInitialUI();
    
    initializeAuth();
    initializeNavigation();
    initializeEventListeners();
}

async function loadInitialUI() {
    // Load static partials
    await Promise.all([
        injectHTML('sidebar-container', 'partials/sidebar.html'),
        injectHTML('auth-container', 'partials/auth/auth-forms.html'),
        injectHTML('modals-container', 'partials/modals.html')
    ]);

    // Load the initial page
    await injectHTML('main-content', 'pages/dashboard.html');
}

function initializeAuth() {
    const appWrapper = document.querySelector('.app-wrapper');
    initializeAuthHandlers();

    onAuthStateChanged(appState.auth, user => {
        if (user) {
            appState.currentUserId = user.uid;
            appWrapper.classList.remove('logged-out');
            appWrapper.classList.add('logged-in');
            loadDataFromFirestore(appState.currentUserId);
        } else {
            appState.currentUserId = null;
            if (appState.unsubscribeFromFirestore) {
                appState.unsubscribeFromFirestore();
            }
            appState.data = {};
            appWrapper.classList.add('logged-out');
            appWrapper.classList.remove('logged-in');
            // Optionally, clear the UI or show a login screen
            document.getElementById('main-content').innerHTML = '';
            document.getElementById('sidebar-container').innerHTML = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', main);