import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
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
    // Add the new budgets array for new users
    budgets: [
        {
            id: `budget_${Date.now()}`,
            name: "Personal Budget",
            currency: "USD",
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            items: [
                { id: self.crypto.randomUUID(), type: "income", source: "Salary", amount: 3000, date: new Date().toISOString().split('T')[0], category: { main: "Job", sub: ""}, notes: "Monthly Paycheck" },
                { id: self.crypto.randomUUID(), type: "expense", payee: "Landlord", amount: 1200, date: new Date().toISOString().split('T')[0], category: { main: "Housing", sub: "Rent"}, notes: "" }
            ]
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
 * Migrates legacy budget item categories from string to object format.
 * @param {object} data - The user's data object.
 * @returns {boolean} - True if a migration was performed.
 */
function migrateLegacyCategories(data) {
    let changed = false;
    if (!data.budgets) return changed;

    data.budgets.forEach(budget => {
        if (!budget.items) return;
        budget.items = budget.items.map(item => {
            if (item.category && typeof item.category === 'string' && item.category.includes('-')) {
                const [main, sub] = item.category.split('-').map(s => s.trim());
                item.category = { main: main || 'Uncategorized', sub: sub || '' };
                changed = true;
            }
            // Ensure all expense items have a category object
            if (item.type === 'expense' && typeof item.category !== 'object') {
                 item.category = { main: 'Uncategorized', sub: '' };
                 changed = true;
            }
            return item;
        });
    });
    return changed;
}

/**
 * Fetches the user's data ONCE.
 * @param {string} userId - The UID of the user.
 */
export async function loadInitialData(userId) {
    const userDocRef = doc(appState.db, "users", userId);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            appState.data = docSnap.data();
            // Guard against old data structures & add new ones if missing
            if (!appState.data.portfolios) appState.data.portfolios = [];
            if (!appState.data.user_profile) appState.data.user_profile = JSON.parse(JSON.stringify(initialData.user_profile));
            if (!appState.data.budgets) {
                 appState.data.budgets = JSON.parse(JSON.stringify(initialData.budgets));
                 // Save the new budget structure immediately for existing users
                 await saveDataToFirestore();
            }

            // Run migration for existing users
            const migrationOccurred = migrateLegacyCategories(appState.data);
            if (migrationOccurred) {
                console.log("Budget category migration performed.");
                await saveDataToFirestore(); // Save migrated data
            }

        } else {
            // New user: set initial data and save it.
            appState.data = JSON.parse(JSON.stringify(initialData));
            await setDoc(userDocRef, appState.data);
        }
        validateActivePortfolio();
    } catch (error) {
        console.error("Error fetching initial user data:", error);
        appState.data = JSON.parse(JSON.stringify(initialData));
    }
}

/**
 * Attaches a real-time listener to Firestore for live updates.
 * @param {string} userId - The UID of the user.
 */
export function listenForDataChanges(userId) {
    if (appState.unsubscribeFromFirestore) {
        appState.unsubscribeFromFirestore();
    }
    const userDocRef = doc(appState.db, "users", userId);
    
    appState.unsubscribeFromFirestore = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            appState.data = docSnap.data();
            validateActivePortfolio();
            renderCallback();
        }
    }, (error) => {
        console.error("Firestore snapshot error:", error);
    });
}

function validateActivePortfolio() {
    const portfolios = appState.data.portfolios || [];
    const activeIdIsValid = portfolios.some(p => p.id === appState.data.activePortfolioId);
    if (!activeIdIsValid) {
        appState.data.activePortfolioId = portfolios.length > 0 ? portfolios[0].id : null;
    }
}

export async function saveDataToFirestore() {
    if (!appState.currentUserId) {
        console.warn("Attempted to save data without a user ID.");
        return;
    };
    try {
        const userDocRef = doc(appState.db, "users", appState.currentUserId);
        const dataToSave = JSON.parse(JSON.stringify(appState.data));
        await setDoc(userDocRef, dataToSave, { merge: true });
    } catch (error) {
        console.error("Error saving data to Firestore:", error);
    }
}
