import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore'

window.addEventListener("load", function(event) {
    let btnAddNote = document.getElementById("btnAddNote")
    let btnFinish = document.getElementById("btnFinish")
    let btnLoadNotes = document.getElementById("btnLoadNotes")

    btnAddNote.addEventListener('click', addNote)
    btnFinish.addEventListener('click', finish)
    btnLoadNotes.addEventListener('click', loadNotes)
});

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

// Return list of notes from db 
async function dbGetNotes(code){
    const colRef = collection(db, code)

    const snapshot = await getDocs(colRef)
    let data = []
    snapshot.docs.forEach((doc) => {
        data.push({...doc.data(), id: doc.id})
    }) 

    return data
}

// Add note to db
function dbAddNote(code, val){
    const colRef = collection(db, code)

    // Get current date
    let currentDate = new Date()
    let cDay = currentDate.getDate()
    let cMonth = currentDate.getMonth() + 1
    let cYear = currentDate.getFullYear()
    let today = cDay + "/" + cMonth + "/" + cYear

    addDoc(colRef, {
        note: val,
        createdOn: today,
        read: false
    });
}

// Delete note from db
function dbDelNote(code, val){
    const docRef = doc(db, code, val)

    deleteDoc(docRef)
}

// Add note element on page
function addNote(){
    let noteContainer = document.getElementById("noteContainer");
    let note = document.createElement("input")
    note.classList.add("w3-input")
    noteContainer.appendChild(note)
}

// Apply changes for the current code
function finish(){
    let code = document.getElementById("inputCode").value
    let currentNotes = getCurrentNotes()
    console.log(currentNotes)

    dbGetNotes(code).then(notes => {
        // Delete notes from db
        for (let i = 0; i < notes.length; i++){
            dbDelNote(code, notes[i].id)
        }

        // Add each note 
        for (let i = 0; i < currentNotes.length; i++){
            dbAddNote(code, currentNotes[i])
        }

        displayMsg("Notes updated")
    });
}

// Load notes for the given code 
function loadNotes(){
    let code = document.getElementById("inputCode").value
    if (code == "") {
        displayMsg("Valid code required")
        return
    }

    dbGetNotes(code).then(notes => {
        if (notes.length == 0){
            displayMsg("No notes found for this code")
            return
        }

        clearNotes()
        let noteContainer = document.getElementById("noteContainer").children

        // Create as many notes as needed
        let diff = noteContainer.length - notes.length
        if (diff < 0){
            for (let i = 0; i < diff*-1; i++){
                addNote()
            }
        }

        // Fill notes with notes found in database
        for (let i = 0; i < notes.length; i++){
            noteContainer[i].value = notes[i].note
        }
    });
}

// Return list of notes in note container
function getCurrentNotes(){
    let noteContainer = document.getElementById("noteContainer");
    let noteList = []
    for (let i = 0; i < noteContainer.children.length; i++){
        if (noteContainer.children[i].value != '' && noteContainer.children[i].value != null)
            noteList.push(noteContainer.children[i].value)
    }
    return noteList
}

// Clear notes on page
function clearNotes(){
    let noteContainer = document.getElementById("noteContainer");
    for (let i = 0; i < noteContainer.children.length; i++){
        noteContainer.children[i].value = ''
    }
}

// Display message to user
function displayMsg(msg){
    let resultMsg = document.getElementById("resultMsg");
    resultMsg.innerHTML = msg 
}


