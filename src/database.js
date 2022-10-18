import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, updateDoc, query, getDoc, orderBy, doc, setDoc } from 'firebase/firestore'
import { Toast } from './utility';
import { getCurrentDate } from './utility';

/* ==== DATABASE ====*/ 

const firebaseApp = initializeApp({
    piKey: "AIzaSyD9RHiBSUHoxoBtKPC-sj4tBEn4RyPKZeo",
    authDomain: "luckygame-1905f.firebaseapp.com",
    databaseURL: "https://luckygame-1905f-default-rtdb.firebaseio.com",
    projectId: "luckygame-1905f",
    storageBucket: "luckygame-1905f.appspot.com",
    messagingSenderId: "391623292354",
    appId: "1:391623292354:web:6c9871f970a8ad833d925b",
    measurementId: "G-8V32MBZQPM"
});

const db = getFirestore();

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

export async function dotask(){
    let code = "gpxlEIMy"

    let notes = await dbGetNotes(code);
    let notesCount = 0;
    for (let i = 0; i < notes.length; i++){
        if (notes[i].read) notesCount++;
    }
    
    let readCount = 1
    let today = new Date()

    for (let i = 0; i < notes.length; i++){
        if (notes[i].read){
            let result = Date.now() + -(notesCount)*24*3600*1000;
            notesCount--;

            dbUpdateDate(code, notes[i].id, result)
            console.log("Updated read note " + i + " to " + new Date(result))
        }
    }

    for (let i = 0; i < notes.length; i++){
        if (!notes[i].read){
            let result = Date.now() + (readCount)*24*3600*1000;
            readCount++

            dbUpdateDate2(code, notes[i].id, result)
            console.log("Updated unread note " + i + " to " + new Date(result))
        }
    }
}

function dbUpdateDate(code, noteId, newDate){
    const docRef = doc(db, code, noteId);

    updateDoc(docRef, {
        readOn: newDate,
        createdOn: newDate
    });
}

function dbUpdateDate2(code, noteId, newDate){
    const docRef = doc(db, code, noteId);

    updateDoc(docRef, {
        createdOn: newDate
    });
}