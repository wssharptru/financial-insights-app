// main.js

import { loadUserData } from './firestore.js';
import { setupAuthListeners } from './auth.js';
import { setupNavigation } from './navigation.js';
import { showSection } from './loader.js';
import { renderAll } from './renderer.js';
import { initializeCharts } from './charts.js';
import { applyPreferences } from './utils.js';

const appState = {
  user: null,
  data: {
    portfolios: [],
    activePortfolioId: null
  },
  preferences: {
    theme: 'light'
  },
  charts: {
    allocationChart: null,
    performanceChart: null
  }
};

// ✅ Make appState and initializeCharts available for console debugging
window.appState = appState;
window.initializeCharts = initializeCharts;

document.addEventListener('DOMContentLoaded', async () => {
  console.log('App initialized');

  // Apply saved theme preference
  applyPreferences(appState);

  // Setup navigation & auth event listeners
  setupNavigation(appState);
  setupAuthListeners(appState);

  // Try loading stored user data
  const userData = await loadUserData();
  if (userData) {
    appState.user = userData.user;
    appState.data.portfolios = userData.portfolios || [];
    appState.data.activePortfolioId = userData.activePortfolioId || null;

    console.log('User data loaded:', appState);

    // Only render dashboard if portfolio data is available
    if (appState.data.portfolios.length > 0 && appState.data.activePortfolioId) {
      showSection('dashboard', appState);
    } else {
      showSection('portfolio', appState);
    }
  } else {
    showSection('auth', appState);
  }
});

// ✅ Register service worker with correct relative path
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => {
      console.log('ServiceWorker registration successful with scope: ', reg.scope);
    })
    .catch(err => {
      console.error('ServiceWorker registration failed: ', err);
    });
}
