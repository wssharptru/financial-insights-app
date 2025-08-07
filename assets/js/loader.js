// assets/js/loader.js

/**
 * Fetches HTML content from a given path and injects it into a specified DOM element.
 * This version is enhanced with sessionStorage and ETag caching to reduce redundant network requests
 * and minimize unnecessary DOM manipulations, improving performance.
 * @param {string} id - The ID of the DOM element to inject the HTML into.
 * @param {string} path - The path to the HTML file to fetch.
 */
export async function injectHTML(id, path) {
    const container = document.getElementById(id);
    if (!container) {
        console.error(`Element with ID "${id}" not found.`);
        return;
    }

    // Define unique keys for sessionStorage based on the file path
    const cacheKey = `html_cache:${path}`;
    const etagKey = `${cacheKey}:etag`;

    // Retrieve cached HTML and ETag from the current session
    const cachedHtml = sessionStorage.getItem(cacheKey);
    const etag = sessionStorage.getItem(etagKey) || '';

    try {
        // Set up request headers. 'If-None-Match' tells the server to only send
        // the file if it has changed (i.e., if its ETag is different).
        const headers = new Headers();
        if (etag) {
            headers.append('If-None-Match', etag);
        }

        const response = await fetch(path, { headers });

        // HTTP 304 Not Modified: The file on the server is the same as our cached version.
        if (response.status === 304) {
            console.log(`Content for ${path} is unchanged. Using session cache.`);
            if (cachedHtml) {
                container.innerHTML = cachedHtml;
            }
            return;
        }
        
        // If the request was not successful for other reasons, throw an error.
        if (!response.ok) {
            throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
        }

        // The request was successful (HTTP 200 OK), meaning we got new content.
        const newHtml = await response.text();
        const newEtag = response.headers.get('ETag');

        // Update the DOM with the new HTML.
        container.innerHTML = newHtml;

        // Store the new HTML and the new ETag in sessionStorage for future requests.
        sessionStorage.setItem(cacheKey, newHtml);
        if (newEtag) {
            sessionStorage.setItem(etagKey, newEtag);
        }

    } catch (error) {
        console.error(`Failed to load HTML from ${path}:`, error);
        // If fetching fails (e.g., offline), try to use the cached version as a fallback.
        if (cachedHtml) {
            console.warn(`Using stale content for ${path} due to network error.`);
            container.innerHTML = cachedHtml;
        } else {
            // If there's no cached version, display an error message.
            container.innerHTML = `<div class="alert alert-danger">Error: Component could not be loaded.</div>`;
        }
    }
}
