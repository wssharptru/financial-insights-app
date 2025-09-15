# Testing and Deployment Notes

## Testing Steps

To verify the new Help page functionality, please follow these steps:

1.  **Navigate to the Help Page:**
    *   Open the application in your browser.
    *   In the sidebar navigation, click on the "Help" tab.
    *   **Expected Result:** The Help page should load in the main content area, displaying a search box and a list of FAQs.

2.  **Verify the FAQ Content:**
    *   Check that there are at least 8-15 FAQs displayed on the page.
    *   Confirm that the FAQs are grouped by categories (e.g., "Getting Started," "Portfolio Tracking").
    *   **Expected Result:** The page should be populated with a variety of relevant FAQs.

3.  **Test the Search/Filter Functionality:**
    *   In the search box, type a keyword that appears in one of the FAQs (e.g., "portfolio," "budget").
    *   **Expected Result:** The list of FAQs should filter in real-time to show only the items that contain the keyword.

4.  **Test the Expand/Collapse Behavior:**
    *   Click on an FAQ question.
    *   **Expected Result:** The answer to the question should expand and become visible. Clicking the question again should collapse the answer.

5.  **Check for SEO Markup:**
    *   Using your browser's developer tools, inspect the page's HTML.
    *   Look for a `<script type="application/ld+json">` tag in the `<head>` or `<body>`.
    *   **Expected Result:** The script tag should contain valid `FAQPage` schema.org markup with the generated FAQs.

## Deployment Notes

*   **New Files:**
    *   `pages/help.html`
    *   `assets/js/help.js`
    *   `TESTING.md`

*   **Modified Files:**
    *   `partials/sidebar.html`
    *   `assets/js/navigation.js`

*   **Dependencies:**
    *   No new third-party dependencies have been added.

*   **Build Process:**
    *   No changes to the build process are required. This is a static site, so the new files just need to be deployed along with the existing ones.
