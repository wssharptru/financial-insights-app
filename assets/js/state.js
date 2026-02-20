
// assets/js/state.js

// Global Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCWLNOrUwyj1VKajaUi5M74AnAL75c3p_M",
    authDomain: "financial-insights-app.firebaseapp.com",
    projectId: "financial-insights-app",
    storageBucket: "financial-insights-app.appspot.com",
    messagingSenderId: "436668403248",
    appId: "1:436668403248:web:c52797f37c053f1ab327f5",
    measurementId: "G-3NYHCJ4RT8"
};

// Global Application State
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
        budgetChart: null,
    },
    config: {
        firebaseConfig
    },
    uiInitialized: false
};
