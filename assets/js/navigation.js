// assets/js/navigation.js

import { injectHTML } from './loader.js';
import { appState } from './main.js';
// *** ADD THIS IMPORT ***
// Import the main rendering function to be called after navigation.
import { renderAll } from './renderer.js';

/**
 * Initializes navigation event listeners for the sidebar and mobile menu.
 */
export function initializeNavigation() {
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    // Ensure elements exist before adding listeners
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => sidebar?.classList.toggle('show'));
    }

    // Use event delegation on the container for dynamically loaded sidebar
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        sidebarContainer.addEventListener('click', e => {
            const link = e.target.closest('.nav-link');
            if (link) {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                if (section) {
                    showSection(section);
                    sidebar?.classList.remove('show');
                }
            }
        });
    }

    // Close sidebar if clicking outside of it on mobile
    document.addEventListener('click', e => {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn'); // Re-check in case it was re-rendered
        if (sidebar && !sidebar.contains(e.target) && mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
            sidebar.classList.remove('show');
        }
    });
}

/**
 * Loads a new page into the main content area and updates navigation links.
 * @param {string} sectionName - The name of the section/page to show.
 */
export async function showSection(sectionName) {
    // Load the corresponding HTML file into the main content area
    await injectHTML('main-content', `pages/${sectionName}.html`);

    // Update the active state on navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(l => l.classList.remove('active'));
    
    const activeLink = document.querySelector(`.nav-link[data-section="${sectionName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // *** ADD THIS LINE ***
    // After loading the new page's static HTML, call the main render function
    // to populate it with dynamic data (metrics, charts, tables, etc.).
    renderAll();
}
