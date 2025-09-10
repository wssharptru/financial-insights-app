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
    activePortfolioId: null, // This gets set later
    insights: [
        {
            type: "opportunity",
            title: "Welcome to AI Finance!",
            description: "Add your first investment to see your portfolio dashboard and generate personalized AI insights."
        }
    ],
    aiScreenerReports: [],
    budgets: [
        {
            id: Date.now(),
            name: 'Personal Budget',
            income: [],
            expenses: [],
            // **FIX**: Pre-populated expense categories for a better user experience.
            expenseCategories: {
                'Housing': ['Mortgage/Rent', 'Property Tax', 'Home Insurance', 'Repairs & Maintenance', 'HOA Fees'],
                'Transportation': ['Car Payment', 'Gas/Fuel', 'Car Insurance', 'Public Transit', 'Repairs'],
                'Food': ['Groceries', 'Restaurants', 'Coffee Shops', 'Pet Food'],
                'Utilities': ['Electricity', 'Water', 'Natural Gas', 'Internet', 'Phone', 'Trash'],
                'Personal': ['Shopping', 'Entertainment', 'Subscriptions', 'Hobbies', 'Gifts'],
                'Health & Wellness': ['Health Insurance', 'Doctor Visits', 'Pharmacy', 'Gym Membership'],
                'Debt': ['Credit Card Payment', 'Student Loan', 'Personal Loan'],
                'Savings & Investments': ['Retirement', 'Emergency Fund', 'Brokerage'],
                'Miscellaneous': ['Charity', 'Taxes', 'Other']
            }
        }
    ]
};
initialData.activePortfolioId = initialData.portfolios[0].id;

/**
 * Fetches the user's data ONCE. This is an awaitable function
 * used on initial login to ensure data is present before rendering.
 * @param {string} userId - The UID of the user.
 */
export async function loadInitialData(userId) {
    const userDocRef = doc(appState.db, "users", userId);
    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            appState.data = docSnap.data();
            // Guard against old data structures
            if (!appState.data.portfolios) appState.data.portfolios = [];
            if (!appState.data.user_profile) appState.data.user_profile = JSON.parse(JSON.stringify(initialData.user_profile));
            
            // **FIX**: Add guards to create the budget structure for existing users who don't have it.
            if (!appState.data.budgets || !Array.isArray(appState.data.budgets) || appState.data.budgets.length === 0) {
                 appState.data.budgets = JSON.parse(JSON.stringify(initialData.budgets));
            }
            // Also ensure the first budget has the categories object
            if (appState.data.budgets[0] && (!appState.data.budgets[0].expenseCategories || Object.keys(appState.data.budgets[0].expenseCategories).length === 0)) {
                appState.data.budgets[0].expenseCategories = JSON.parse(JSON.stringify(initialData.budgets[0].expenseCategories));
            }

        } else {
            // New user: set initial data and save it.
            appState.data = JSON.parse(JSON.stringify(initialData));
            await setDoc(userDocRef, appState.data);
        }
        // Validate the active portfolio ID after loading
        validateActivePortfolio();

    } catch (error) {
        console.error("Error fetching initial user data:", error);
        // Handle error case, maybe show an error message
        appState.data = JSON.parse(JSON.stringify(initialData));
    }
}

/**
 * Attaches a real-time listener to Firestore for live updates.
 * This function does NOT block and is used for updates after the initial load.
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
            // Re-render the UI with the fresh data
            renderCallback();
        }
    });
}

/**
 * Validates that the activePortfolioId points to an existing portfolio.
 * If not, it resets it to a valid ID or null.
 */
function validateActivePortfolio() {
    const portfolios = appState.data.portfolios || [];
    const activeIdIsValid = portfolios.some(p => p.id === appState.data.activePortfolioId);

    if (!activeIdIsValid) {
        appState.data.activePortfolioId = portfolios.length > 0 ? portfolios[0].id : null;
    }
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
