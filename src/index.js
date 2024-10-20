import { InputInit } from './pages/input.js';
import { OutputInit } from './pages/display.js';
import { LoginInit } from './pages/login.js';
import { verifyPassword } from './services/database.js';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const auth = getAuth();

// Wrap onAuthStateChanged in a Promise to ensure proper handling
function checkAuthState() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            resolve(user); // Resolve with the user state once determined
        });
    });
}

window.addEventListener("load", async function (event) {
    const user = await checkAuthState(); // Wait for the auth state to be determined

    const path = window.location.pathname;
    const page = path.split("/").pop();

    console.log("Page: " + page);

    if (page === "") {
        console.log("Directing to login")
        window.location.href = `/login.html`;
        return;
    }

    // Display page does not require the user to be logged in
    if (page === "display.html") {
        OutputInit();
        return;
    } else if (page === "login.html") {
        LoginInit();
    }

    if (user) {
        // User is signed in, proceed to the appropriate page
        if (page === "input.html") {
            InputInit();
        } else if (page === "login.html" || page == "index.html") {
            console.log("Directing to input")
            window.location.href = `/input.html`; // Redirect to input page if already logged in
        }
    } else {
        // No user is logged in, handle legacy account flow or redirect to login
        const params = new URLSearchParams(window.location.search);
        const displayId = params.get('displayId');
        const password = params.get('password');

        // Check if a legacy account exists and redirect to login with parameters
        if (displayId && password && await verifyPassword(displayId, password) && page !== "login.html") {
            console.log("Directing to login1")
            window.location.href = `/login.html?displayId=${displayId}&password=${password}&message=Please create an account to access your notes`;
        } else if (page !== "login.html") {
            console.log("Directing to login2")
            window.location.href = `/login.html`; // Redirect to login if not on login page
        }
    }
});
