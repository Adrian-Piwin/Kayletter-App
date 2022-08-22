import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore'

var noteList = []

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

async function dbGetNotes(code){
    const colRef = collection(db, code)

    const snapshot = await getDocs(colRef)
    let data = []
    snapshot.docs.forEach((doc) => {
        data.push({...doc.data(), id: doc.id})
    }) 

    return data
}

function dbAddNote(code, val){
    const colRef = collection(db, code)

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

function deleteData(val){
    const docRef = doc(db, 'safe-code', val)

    deleteDoc(docRef)
}

// Add note element on page
function addNote(){
    let noteContainer = document.getElementById("noteContainer");
    let note = document.createElement("input")
    note.classList.add("w3-input")
    noteContainer.appendChild(note)
}

// Apply changes to the given code
function finish(){
    let code = document.getElementById("inputCode").value
    let nodeContainer = document.getElementById("noteContainer")

    // Add each note found in container to the database
    for (let i = 0; i < nodeContainer.children.length; i++){
        if (nodeContainer.children[i].value != "")
            dbAddNote(code, nodeContainer.children[i].value)
    }
}

// Load notes for this code 
function loadNotes(){
    let code = document.getElementById("inputCode").value
    dbGetNotes(code).then(notes => {
        let noteContainer = document.getElementById("noteContainer").children

        for (let i = 0; i < notes.length; i++){
            if (noteContainer[i].value != undefined) {
                noteContainer[i].value = notes[i].note
            }
            else{
                addNote()
                noteContainer = document.getElementById("noteContainer").children
                noteContainer[i].value = notes[i].note
            }
        }

        noteList = notes
    });

    
    
}




