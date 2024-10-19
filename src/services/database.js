import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, updateDoc, query, getDoc, orderBy, doc, setDoc } from 'firebase/firestore'
import { setPersistence, browserLocalPersistence, getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { Toast, getCurrentDate } from '../utility';

/* ==== FIREBASE INIT ==== */
const firebaseApp = initializeApp({
    apiKey: "AIzaSyD9RHiBSUHoxoBtKPC-sj4tBEn4RyPKZeo",
    authDomain: "luckygame-1905f.firebaseapp.com",
    projectId: "luckygame-1905f",
    storageBucket: "luckygame-1905f.appspot.com",
    messagingSenderId: "391623292354",
    appId: "1:391623292354:web:6c9871f970a8ad833d925b"
});

const db = getFirestore();
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Failed to set persistence:', error);
});

/* ==== AUTH FUNCTIONS ==== */
export function signUp(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
}

export function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function googleSignIn() {
    return signInWithPopup(auth, googleProvider);
}

export function logoutUser() {
    return signOut(auth);
}

export function getCurrentUser() {
    return auth.currentUser;
}

/* ==== FIREBASE NOTES ==== */

export async function verifyPassword(displayId, inputPassword) {
    const storedPassword = await dbGetVariable(displayId, 'password');
    return storedPassword === inputPassword;
}

// Return if code exists
export async function dbDoesExist(code){
    try{
        const docRef = doc(db, code, "variables")
        const snapshot = await getDoc(docRef)

        return snapshot.exists()
    }catch(err){
        Toast("Having trouble connecting to internet...", 4)
    }
}

// Return list of notes from db 
export async function dbGetNotes(code){
    const colRef = collection(db, code)
    const q = query(colRef, orderBy("createdOn", "asc"))
    const snapshot = await getDocs(q)
    let data = []
    snapshot.docs.forEach((doc) => {
        data.push({...doc.data(), id: doc.id})
    }) 
    return data
}

// Add note to db
export function dbAddNote(code, val){
    const colRef = collection(db, code)

    addDoc(colRef, {
        note: val,
        createdOn: getCurrentDate(),
        readOn: null,
        read: false,
        isFavorite: false
    });
}

// Add read note to db
export function dbAddReadNote(code, val){
    const colRef = collection(db, code)

    addDoc(colRef, {
        note: val,
        createdOn: getCurrentDate(),
        readOn: getCurrentDate(),
        read: true,
        isFavorite: false
    });
}

// Set the user's associated displayId
export async function dbSetUserCode(uid, displayId) {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, { displayId }, { merge: true });
}

// Get the user's associated displayId
export async function dbGetUserCode(uid) {
    const userDocRef = doc(db, 'users', uid);
    const docSnapshot = await getDoc(userDocRef);
    if (docSnapshot.exists()) {
        return docSnapshot.data().displayId;
    }
    return null;
}

// Store a variable associated with this code to db
export function dbSetVariable(code, varName, value){
    const docRef = doc(db, code, "variables")
    setDoc(docRef, {[varName]: value}, {merge: true})
}

// Retrieve a variable associated with this code to db
export async function dbGetVariable(code, varName){
    const docRef = doc(db, code, "variables")
    const snapshot = await getDoc(docRef)

    if (snapshot.exists()){
        return snapshot.data()[varName]
    }
    return ""
}

// Update note from db
export function dbUpdateNote(code, noteId, newNote){
    const docRef = doc(db, code, noteId);

    updateDoc(docRef, {
        note: newNote
    });
}

// Set note as favorite
export function dbFavoriteNote(code, noteId, isFav){
    const docRef = doc(db, code, noteId);

    updateDoc(docRef, {
        isFavorite: isFav
    });
}

// Set a note as read
export function dbReadNote(code, noteId, date){
    const docRef = doc(db, code, noteId);

    updateDoc(docRef, {
        readOn: date,
        read: true
    });
}

// Delete note from db
export function dbDeleteNote(code, val){
    const docRef = doc(db, code, val)

    deleteDoc(docRef)
}
