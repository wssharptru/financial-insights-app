import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { appState } from './main.js';
// import { renderAll } from './renderer.js'; // This would create a circular dependency. We need a better way.

/**
 * A placeholder for the render function to avoid circular dependencies.
 * This will be set from main.js after all modules are loaded.
 */
let renderCallback = () => {};
export function setRenderCallback(callback) {
    renderCallback = callback;
}

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
initialData.activePortfolioId = initialData.portfolios[0].id;


/**
 * Sets up a real-time listener to load and sync user data from Firestore.
 * @param {string} userId - The UID of the currently logged-in user.
 */
export function loadDataFromFirestore(userId) {
    if (appState.unsubscribeFromFirestore) {
        appState.unsubscribeFromFirestore();
    }
    const userDocRef = doc(appState.db, "users", userId);

    appState.unsubscribeFromFirestore = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            const loadedData = docSnap.data();
            // Deep merge to ensure new properties from initialData are added
            appState.data = deepMerge(JSON.parse(JSON.stringify(initialData)), loadedData);
        } else {
            // If no data exists, create the document with initial data
            appState.data = JSON.parse(JSON.stringify(initialData));
            await setDoc(userDocRef, appState.data);
        }
        // Call the render function to update the UI
        renderCallback();
    });
}

/**
 * Saves the current application state to Firestore.
 */
export async function saveDataToFirestore() {
    if (!appState.currentUserId) return;
    const userDocRef = doc(appState.db, "users", appState.currentUserId);
    // Use JSON stringify/parse to remove any undefined values or methods
    const dataToSave = JSON.parse(JSON.stringify(appState.data));
    await setDoc(userDocRef, dataToSave, { merge: true });
}

/**
 * Recursively merges properties of a source object into a target object.
 * @param {object} target - The target object.
 * @param {object} source - The source object.
 * @returns {object} The merged target object.
 */
function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] instanceof Object && key in target && !(source[key] instanceof Array)) {
            target[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}
