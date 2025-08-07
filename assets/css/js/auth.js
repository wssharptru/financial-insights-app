import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { appState } from './main.js';

/**
 * Initializes all event listeners related to authentication forms.
 */
export function initializeAuthHandlers() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    document.getElementById('show-signup').addEventListener('click', toggleAuthForms);
    document.getElementById('show-login').addEventListener('click', toggleAuthForms);
    document.getElementById('signOutBtn').addEventListener('click', () => signOut(appState.auth));
    document.getElementById('toggleLoginPassword').addEventListener('click', () => togglePasswordVisibility('loginPassword', 'toggleLoginPassword'));
    document.getElementById('toggleSignupPassword').addEventListener('click', () => togglePasswordVisibility('signupPassword', 'toggleSignupPassword'));
}

/**
 * Handles the user login form submission.
 * @param {Event} e - The form submission event.
 */
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('login-error');
    
    signInWithEmailAndPassword(appState.auth, email, password)
        .catch(error => {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        });
}

/**
 * Handles the user signup form submission.
 * @param {Event} e - The form submission event.
 */
function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const errorDiv = document.getElementById('signup-error');

    createUserWithEmailAndPassword(appState.auth, email, password)
        .catch(error => {
            errorDiv.textContent = error.message;
            errorDiv.classList.remove('d-none');
        });
}

/**
 * Toggles between the login and signup forms.
 * @param {Event} e - The click event.
 */
function toggleAuthForms(e) {
    e.preventDefault();
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const isShowingLogin = !loginForm.classList.contains('d-none');
    
    loginForm.classList.toggle('d-none', isShowingLogin);
    signupForm.classList.toggle('d-none', !isShowingLogin);
    
    // Hide any previous error messages
    document.getElementById('login-error').classList.add('d-none');
    document.getElementById('signup-error').classList.add('d-none');
}

/**
 * Toggles the visibility of a password input field.
 * @param {string} passwordInputId - The ID of the password input.
 * @param {string} toggleButtonId - The ID of the button that triggers the toggle.
 */
function togglePasswordVisibility(passwordInputId, toggleButtonId) {
    const passwordInput = document.getElementById(passwordInputId);
    const icon = document.querySelector(`#${toggleButtonId} i`);
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    
    passwordInput.setAttribute('type', type);
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}
