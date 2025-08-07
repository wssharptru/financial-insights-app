// Firebase v9+ modular SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { injectHTML } from './loader.js';
import { initializeAuthHandlers } from './auth.js';
import { initializeNavigation } from './navigation.js';
import { initializeEventListeners } from './event-listeners.js';
import { loadDataFromFirestore, saveDataToFirestore } from './firestore.js';
import { renderAll } from './renderer.js';

// --- CONFIGURATION & KEYS --- //
const firebaseConfig = {
    apiKey: "AIzaSyCWLNOrUwyj1VKajaUi5M74AnAL75c3p_M",
    authDomain: "financial-insights-app.firebaseapp.com",
    projectId: "financial-insights-app",
    storageBucket: "financial-insights-app.appspot.com",
    messagingSenderId: "436668403248",
    appId: "1:436668403248:web:c52797f37c053f1ab327f5",
    measurementId: "G-3NYHCJ4RT8"
};

const finnhubApiKey = "d27bc81r01qloaribsbgd27bc81r01qloaribsc0";
const twelvedataApiKey = "__TWELVEDATA_API_KEY__";
const fmpApiKey = "GPb5tztXZjGXByEJipa5eKL8LpOVxkG5";

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
