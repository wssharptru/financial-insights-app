import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { appState } from './main.js';

// This function will be set by main.js to link to the renderer, avoiding circular dependencies.
let renderCallback = () => {};
export function setRenderCallback(callback) {
    renderCallback = callback;
}

// Default data structure for a brand-new user.
const initialData = {
    user_profile: {
        name: "New User",
        risk_tolerance: "Moderate",
        investment_goals: ["Wealth Building"],
        available_capital: 50000,
        sub_goals: ["Long-term Growth"],
        asset_preferences: { preferred: ["Stock", "ETF"], excluded: [] },
        sector_preferences: { preferred: ["Technology", "Green Energy"], excluded: ["Fossil Fuels"] },
        tax_considerations: ["Tax-loss Harvesting"],
    },
    portfolios: [
        {
            id: Date.now(),
            name: "My First Portfolio",
            holdings: [],
            transactions: [],
        }
    ],
    activePortfolioId: null,
    insights: [
        {
            type: "opportunity",
            title: "Welcome to AI Finance!",
            description: "Add your first investment to see your portfolio dashboard and generate personalized AI insights."
        }
    ],
    aiScreenerReports: []
};
// Set the initial active ID right after the object is created.
initialData.activePortfolioId = initialData.portfolios[0].id;

/**
 * Sets up a real-time listener to load and sync user data from Firestore.
 * This is the central function for data synchronization.
 * @param {string} userId - The UID of the currently logged-in user.
 */
export function loadDataFromFirestore(userId) {
    if (appState.unsubscribeFromFirestore) {
        appState.unsubscribeFromFirestore();
    }
    const userDocRef = doc(appState.db, "users", userId);
    const globalLoader = document.getElementById('globalLoader');
    const appWrapper = document.getElementById('app-wrapper');

    // onSnapshot creates a live listener. It will fire once with the initial data,
    // and then again every time the data changes in Firestore.
    appState.unsubscribeFromFirestore = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            // If the user document exists, use its data as the source of truth.
            appState.data = docSnap.data();

            // Guard against old data structures where these properties might not exist.
            if (!appState.data.portfolios) appState.data.portfolios = [];
            if (!appState.data.user_profile) appState.data.user_profile = JSON.parse(JSON.stringify(initialData.user_profile));
            
        } else {
            // If the document doesn't exist, this is a new user.
            // Create their document in Firestore using the initial data structure.
            appState.data = JSON.parse(JSON.stringify(initialData));
            await setDoc(userDocRef, appState.data);
        }

        const portfolios = appState.data.portfolios || [];
        const activeIdIsValid = portfolios.some(p => p.id === appState.data.activePortfolioId);

        // Validate the activePortfolioId to ensure it's always pointing to a valid portfolio.
        // This is critical for preventing errors after a portfolio is deleted.
        if (!activeIdIsValid) {
            if (portfolios.length > 0) {
                // If the ID is bad but other portfolios exist, default to the first one.
                appState.data.activePortfolioId = portfolios[0].id;
            } else {
                // If there are no portfolios at all, set the active ID to null.
                appState.data.activePortfolioId = null;
            }
        }

        // --- This is the key to fixing the race condition ---
        // Once we have confirmed data is loaded and validated, hide the global loader.
        globalLoader.classList.add('d-none');
        // Show the main application wrapper.
        appWrapper.classList.remove('d-none');
        
        // Now that the app is visible, trigger the rendering of all its components.
        renderCallback();
    });
}

/**
 * Saves the current application state to Firestore.
 */
export async function saveDataToFirestore() {
    if (!appState.currentUserId) return;
    const userDocRef = doc(appState.db, "users", appState.currentUserId);
    // Create a clean, serializable copy of the app's data to save.
    const dataToSave = JSON.parse(JSON.stringify(appState.data));
    // Using { merge: true } prevents overwriting fields if the local state is temporarily out of sync.
    await setDoc(userDocRef, dataToSave, { merge: true });
}
