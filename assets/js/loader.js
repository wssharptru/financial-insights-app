/**
 * Fetches HTML content from a given path and injects it into a specified DOM element.
 * @param {string} id - The ID of the DOM element to inject the HTML into.
 * @param {string} path - The path to the HTML file to fetch.
 */
export async function injectHTML(id, path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
    }
    const html = await response.text();
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = html;
    } else {
      console.error(`Element with ID "${id}" not found.`);
    }
  } catch (error) {
    console.error(`Failed to load HTML from ${path}:`, error);
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = `<div class="alert alert-danger">Error: Component could not be loaded.</div>`;
    }
  }
}
