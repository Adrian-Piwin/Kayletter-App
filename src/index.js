import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, updateDoc, query, orderBy, doc } from 'firebase/firestore'

var utilityObj = new Utility()
var textPromptObj = null
var noteList = []
var currentNoteIndex = 0
var lastReadNoteIndex = 0

window.addEventListener("load", function(event) {

    var path = window.location.pathname;
    var page = path.split("/").pop();
    
    if (page == "index.html"){
        let btnAddNote = document.getElementById("btnAddNote")
        let btnUpdateNotes = document.getElementById("btnUpdateNotes")
        let btnLoadNotes = document.getElementById("btnLoadNotes")

        btnAddNote.addEventListener('click', addNote)
        btnUpdateNotes.addEventListener('click', updateNotes)
        btnLoadNotes.addEventListener('click', loadNotes)
    }else if (page == "display.html"){
        let leftArrow = document.getElementById("leftArrow")
        let rightArrow = document.getElementById("rightArrow")
        let msgElm = document.getElementById("msg")

        textPromptObj = new TextPrompt(msgElm)

        leftArrow.addEventListener('click', leftArrowClick)
        rightArrow.addEventListener('click', rightArrowClick)

        displayPageLoad("test")
    }

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

/* ==== DATABASE ====*/ 

// Return list of notes from db 
async function dbGetNotes(code){
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
function dbAddNote(code, val){
    const colRef = collection(db, code)

    addDoc(colRef, {
        note: val,
        createdOn: getCurrentDate(),
        readOn: null,
        read: false
    });
}

// Update note from db
function dbUpdateNote(code, noteId, newNote){
    const docRef = doc(db, code, noteId);

    // Set the "capital" field of the city 'DC'
    updateDoc(docRef, {
        note: newNote
    });
}

// Set a note as read
function dbReadNote(code, noteId){
    const docRef = doc(db, code, noteId);

    // Set the "capital" field of the city 'DC'
    updateDoc(docRef, {
        readOn: getCurrentDate(),
        read: true
    });
}

// Delete note from db
function dbDeleteNote(code, val){
    const docRef = doc(db, code, val)

    deleteDoc(docRef)
}

/* ==== INDEX PAGE ====*/ 

// Add note element on page
function addNote(){
    let noteContainer = document.getElementById("noteContainer");
    let note = document.createElement("input")
    note.classList.add("w3-input")
    note.maxLength = 420
    noteContainer.appendChild(note)
}

// Apply changes for the current code
function updateNotes(){
    let code = document.getElementById("inputCode").value
    let currentNotes = getCurrentNotes()

    dbGetNotes(code).then(notes => {
        // Update note if text is on notes line, otherwise delete note
        for (let i = 0; i < notes.length; i++){
            if (currentNotes[i] == '')
                dbDeleteNote(code, notes[i].id)
            else
                dbUpdateNote(code, notes[i].id, currentNotes[i])
        }

        // Create note if does not exist
        if (currentNotes.length > notes.length){
            for (let i = notes.length; i < currentNotes.length; i++){
                if (currentNotes[i] != '')
                    dbAddNote(code, currentNotes[i])
            }
        }

        utilityObj.Toast("Notes updated", 4)
    });
}

// Load notes for the given code 
function loadNotes(){
    let code = document.getElementById("inputCode").value
    if (code == "") {
        utilityObj.Toast("Valid code required", 4)
        return
    }

    dbGetNotes(code).then(notes => {
        if (notes.length == 0){
            utilityObj.Toast("No notes found for this code", 4)
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

/* ==== DISPLAY PAGE ====*/ 

function displayPageLoad(code){
    dbGetNotes(code).then(notes => {
        // Set first note as read if not done
        if (notes[0].read == false)
            dbReadNote(code, notes[0].id)

        // Display last read note
        for (let i = 0; i < notes.length; i++){
            if (notes[i].read == true && notes[i+1] != undefined ? notes[i+1].read == false : true){
                textPromptObj.EnterText(notes[i].note)
                currentNoteIndex = i
                lastReadNoteIndex = i
                break
            }
        }

        // Store notes
        noteList = notes
    })
}

function leftArrowClick(){
    // Display previous note if exists
    if (noteList[currentNoteIndex-1] != undefined){
        textPromptObj.EnterText(noteList[currentNoteIndex-1].note)
        currentNoteIndex--
    }
}

function rightArrowClick(){
    // Check if a new note exists
    if (noteList[currentNoteIndex+1] == undefined){
        utilityObj.Toast("No more notes for now!", 4)
        return
    }

    // Check if next note has been read already, allowing to see it
    if (noteList[currentNoteIndex+1].read == true){
        textPromptObj.EnterText(noteList[currentNoteIndex+1].note)
        currentNoteIndex++
        return
    }

    let lastReadNote = noteList[lastReadNoteIndex]
    // If next note has not been read
    // Check if it has been a day since reading most recently read note
    if ((lastReadNote.readOn / 1000 + 86400) < getCurrentDate() / 1000){
        textPromptObj.EnterText(noteList[lastReadNoteIndex+1].note)
        dbReadNote(code, noteList[lastReadNoteIndex+1].id)
        currentNoteIndex++
    }else{
        utilityObj.Toast("Check for a new note tomorrow", 4)
    }
}

/* ==== HELP FUNCTIONS ====*/ 

// Return list of notes in note container
function getCurrentNotes(){
    let noteContainer = document.getElementById("noteContainer");
    let noteList = []
    for (let i = 0; i < noteContainer.children.length; i++){
        noteList.push(noteContainer.children[i].value)
    }
    return noteList
}

// Return the UTC date
function getCurrentDate(){
    let currentDate = new Date()
    let cDay = currentDate.getDate()
    let cMonth = currentDate.getMonth() + 1
    let cYear = currentDate.getFullYear()
    return Date.UTC(cYear, cMonth, cDay, currentDate.getHours(), currentDate.getMinutes(), currentDate.getSeconds(), currentDate.getMilliseconds())
}

// Clear notes on page
function clearNotes(){
    let noteContainer = document.getElementById("noteContainer");
    for (let i = 0; i < noteContainer.children.length; i++){
        noteContainer.children[i].value = ''
    }
}

/* ==== UTILITY OBJECT ====*/ 

function Utility(){
    this.toastTimeoutId;

    // Play animation
    this.PlayAnimation = function(element, animName, time, animSetting=''){
        element.style.animation = '';
        element.offsetWidth;
        element.style.animation = animName + ' ' + ( animSetting == '' ? '' : (animSetting + ' ')) + time + 's';
    }

    this.Toast = function(str, timeToShow){
        var snackbarElm = document.getElementById("snackbar");

        clearTimeout(this.toastTimeoutId);
        snackbarElm.innerHTML = str;
        this.PlayAnimation(snackbarElm, 'fadein 0.5s, fadeout 0.5s', timeToShow-0.5);
        snackbarElm.style.visibility = 'visible';

        this.toastTimeoutId = setTimeout(() => 
        {
            snackbarElm.style.visibility = 'hidden';
        }, timeToShow * 1000);
    }
}

/* ==== TEXT PROMPT OBJECT ====*/ 

function TextPrompt(element){
    this.element = element;
    this.typingTimeoutIds = [];
    this.typeInterval = 80;
    this.deleteInterval = 50;

    // Start typing if empty, or delete then start typing
    this.EnterText = function(text){
        if (this.element.innerHTML != ""){
            // Stop current typing
            this.ClearTimeouts();
            // Calculate time to delete current text
            let timeToDel = this.element.innerHTML.length * this.deleteInterval;
            // Delete current text
            this.DeleteText();
            // Type new text once delete is finished
            setTimeout(() => {
                this.TypeText(text);
            }, timeToDel+200);
        }
        else{
            this.TypeText(text);
        }
    }

    // Delete text
    this.ClearText = function(){
        // Stop current typing
        this.ClearTimeouts();
        // Delete all
        this.DeleteText();
    }

    // Enter text letter by letter, with an interval
    this.TypeText = function(text, textIndex=0){
        // End of recursion
        if (text.length == textIndex) {
            return;
        }

        // Add new letter from string to element
        let newText = this.element.innerHTML;
        newText += text[textIndex];
        this.element.innerHTML = newText;

        // Recursion
        this.typingTimeoutIds.push(setTimeout(() => {
            this.TypeText(text, textIndex+1, false);
        }, this.typeInterval));
        
    }

    // Delete text letter by letter, with an interval
    this.DeleteText = function(){
        clearTimeout(this.typingTimeoutId);
        let str = this.element.innerHTML;
        if (str.length == 0) return;

        str = str.slice(0, -1);
        this.element.innerHTML = str;

        setTimeout(() => {
            this.DeleteText();
        }, this.deleteInterval);
    }

    // Clear all timeouts
    this.ClearTimeouts = function(){
        for (let i = 0; i < this.typingTimeoutIds.length; i++){
            clearTimeout(this.typingTimeoutIds[i]);
        }
        this.typingTimeoutIds = [];
    }
}
