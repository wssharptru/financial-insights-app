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
import { appState } from './state.js';


// --- INITIALIZATION --- //

// --- INITIALIZATION --- //
async function main() {
    appState.app = initializeApp(appState.config.firebaseConfig);
    appState.auth = getAuth(appState.app);
    appState.db = getFirestore(appState.app);

    setRenderCallback(renderAll);
    
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
            await loadInitialData(user.uid);
            appWrapper.classList.remove('logged-out', 'd-none');
            appWrapper.classList.add('logged-in');
            globalLoader.classList.add('d-none');
            renderAll();
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