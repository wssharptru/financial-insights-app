// assets/js/main.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

import { injectHTML } from './loader.js';
import { initializeAuthHandlers } from './auth.js';
import { initializeNavigation } from './navigation.js';
import { initializeEventListeners } from './event-listeners.js';
import { loadInitialData, listenForDataChanges, setRenderCallback } from './firestore.js';
import { renderAll } from './renderer.js';

// --- CONFIGURATION & KEYS ---
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


// --- GLOBAL STATE ---
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
    // Initialize Firebase services
    appState.app = initializeApp(appState.config.firebaseConfig);
    appState.auth = getAuth(appState.app);
    appState.db = getFirestore(appState.app);

    // Set the callback function in firestore.js to trigger UI updates
    setRenderCallback(renderAll);
    
    // The onAuthStateChanged listener now drives the entire application startup
    initializeAuth();
}

/**
 * Loads static HTML partials and sets up core event listeners. 
 * This function runs only once to build the application's shell.
 */
async function initializeAppUI() {
    if (appState.uiInitialized) return;

    // Load all necessary HTML partials into the DOM
    await Promise.all([
        injectHTML('sidebar-container', 'partials/sidebar.html'),
        injectHTML('auth-container', 'partials/auth/auth-forms.html'),
        injectHTML('modals-container', 'partials/modals.html')
    ]);

    // Load the initial page content
    await injectHTML('main-content', 'pages/dashboard.html');

    // Initialize all event handlers and navigation logic
    initializeAuthHandlers();
    initializeNavigation();
    initializeEventListeners();
    
    appState.uiInitialized = true;
}

/**
 * Manages the application state based on user authentication status.
 * This is the central function that controls what the user sees.
 */
function initializeAuth() {
    const globalLoader = document.getElementById('globalLoader');
    const appWrapper = document.getElementById('app-wrapper');

    onAuthStateChanged(appState.auth, async (user) => {
        // Ensure the basic UI shell is loaded before proceeding
        await initializeAppUI();

        if (user) {
            // --- LOGGED-IN FLOW ---
            appState.currentUserId = user.uid;

            // 1. Await the initial data fetch. This is a crucial blocking call
            //    that prevents race conditions by ensuring data is present before rendering.
            await loadInitialData(user.uid);

            // 2. Once data is loaded, display the main application interface.
            appWrapper.classList.remove('logged-out', 'd-none');
            appWrapper.classList.add('logged-in');
            globalLoader.classList.add('d-none');

            // 3. Render the UI for the first time with the freshly loaded data.
            renderAll();
            
            // 4. Attach the real-time listener for any subsequent data changes from Firestore.
            listenForDataChanges(user.uid);

        } else {
            // --- LOGGED-OUT FLOW ---
            appState.currentUserId = null;
            // Detach the Firestore listener if it exists to prevent errors
            if (appState.unsubscribeFromFirestore) {
                appState.unsubscribeFromFirestore();
            }
            // Clear any existing user data from the state
            appState.data = {};
            
            // Show the login/signup forms and hide the main application
            appWrapper.classList.add('logged-out');
            appWrapper.classList.remove('logged-in', 'd-none');
            globalLoader.classList.add('d-none');
        }
    });
}

/**
 * Registers the service worker for offline capabilities.
 * This is wrapped in a check to ensure it only runs in supported browsers.
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('ServiceWorker registration successful with scope: ', registration.scope))
                .catch(err => console.log('ServiceWorker registration failed: ', err));
        });
    }
}

// --- APP START ---
document.addEventListener('DOMContentLoaded', () => {
    main();
    registerServiceWorker(); // Register the service worker on initial load
});
