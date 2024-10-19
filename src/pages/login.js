import { login, signUp, googleSignIn, dbSetUserCode, dbGetUserCode } from '../services/database.js';
import { Toast, createRandomStr } from '../utility.js';

const params = new URLSearchParams(window.location.search);

export function LoginInit(){
    // Handle email/password login
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const userPassword = document.getElementById('password').value;
        try {
            const userCredential = await login(email, userPassword);
            redirectToNotes();
        } catch (error) {
            Toast('Failed to log in: ' + error.message, 4);
        }
    });

    // Handle sign-up with email/password
    document.getElementById('signupBtn').addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const userPassword = document.getElementById('password').value;
        try {
            const userCredential = await signUp(email, userPassword);
            await associateDisplayIdWithUser(userCredential.user.uid);
            // redirectToNotes();
        } catch (error) {
            Toast('Failed to sign up: ' + error.message, 4);
        }
    });

    // Handle Google Sign-In
    document.getElementById('googleSignInBtn').addEventListener('click', async () => {
        try {
            const userCredential = await googleSignIn();
            await associateDisplayIdWithUser(userCredential.user.uid);
            redirectToNotes();
        } catch (error) {
            Toast('Google Sign-In failed: ' + error.message, 4);
        }
    });

    // Show message if redirected with a message in the URL
    const message = params.get('message');
    if (message) {
        Toast(message, 5);
    }
}

// Associate the displayId with the user’s account
async function associateDisplayIdWithUser(uid) {
    let displayId = await dbGetUserCode(uid);
    if (displayId) return;

    displayId = params.get('displayId');
    if (displayId) {
        await dbSetUserCode(uid, displayId);
    }else{
        await dbSetUserCode(uid, createRandomStr(10))
    }
}

// Redirect to the notes page
function redirectToNotes() {
    window.location.href = `/input.html`;
}
