import { injectHTML } from './loader.js';
import { appState } from './main.js';
// Import render functions if they are needed after page load
// Example: import { renderPortfolio } from './renderer.js';

/**
 * Initializes navigation event listeners for the sidebar and mobile menu.
 */
export function initializeNavigation() {
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    
    mobileMenuBtn.addEventListener('click', () => sidebar.classList.toggle('show'));

    // Use event delegation on the container for dynamically loaded sidebar
    document.getElementById('sidebar-container').addEventListener('click', e => {
        const link = e.target.closest('.nav-link');
        if (link) {
            e.preventDefault();
            const section = link.getAttribute('data-section');
            if (section) {
                showSection(section);
                sidebar.classList.remove('show');
            }
        }
    });

    // Close sidebar if clicking outside of it on mobile
    document.addEventListener('click', e => {
        if (sidebar && !sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
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

    // After loading the page, you might need to re-render its dynamic content
    // This part would need to be built out based on the app's full logic
    // For example:
    // switch(sectionName) {
    //     case 'portfolio':
    //         renderPortfolio();
    //         break;
    //     case 'dashboard':
    //         renderDashboard();
    //         break;
    // }
}
