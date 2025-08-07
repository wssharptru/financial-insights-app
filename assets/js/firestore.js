import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { appState } from './main.js';

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
 */
export function loadDataFromFirestore(userId) {
    if (appState.unsubscribeFromFirestore) {
        appState.unsubscribeFromFirestore();
    }
    const userDocRef = doc(appState.db, "users", userId);

    appState.unsubscribeFromFirestore = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            appState.data = docSnap.data();

            // Guard against old data structures
            if (!appState.data.portfolios) appState.data.portfolios = [];
            if (!appState.data.user_profile) appState.data.user_profile = JSON.parse(JSON.stringify(initialData.user_profile));
            
        } else {
            appState.data = JSON.parse(JSON.stringify(initialData));
            await setDoc(userDocRef, appState.data);
        }

        const portfolios = appState.data.portfolios || [];
        const activeIdIsValid = portfolios.some(p => p.id === appState.data.activePortfolioId);

        // This validation is now more robust.
        if (!activeIdIsValid) {
            if (portfolios.length > 0) {
                // If ID is bad but portfolios exist, set to first one.
                appState.data.activePortfolioId = portfolios[0].id;
            } else {
                // If no portfolios exist, explicitly set ID to null.
                appState.data.activePortfolioId = null;
            }
        }
        
        renderCallback();
    });
}

/**
 * Saves the current application state to Firestore.
 */
export async function saveDataToFirestore() {
    if (!appState.currentUserId) return;
    const userDocRef = doc(appState.db, "users", appState.currentUserId);
    const dataToSave = JSON.parse(JSON.stringify(appState.data));
    await setDoc(userDocRef, dataToSave, { merge: true });
}
