import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, deleteDoc, updateDoc, query, getDoc, orderBy, doc, setDoc } from 'firebase/firestore'

var utilityObj = new Utility()
var currentCode = null
var noteList = []

// Display
var currentNoteIndex = 0
var lastReadNoteIndex = 0
var canChangeNote = true

// Strings to access variables from db
var dbVarPassword = "password"
var dbVarPageTitle = "pageTitle"
var dbVarImageURL = "imageURL"
var dbVarUsername = "displayPageId"

window.addEventListener("load", function(event) {

    var path = window.location.pathname;
    var page = path.split("/").pop();
    
    if (page == "index.html"){
        let btnSaveChanges = document.getElementById("btnSaveChanges")
        let btnHelp = document.getElementById("btnHelp")
        let btnGetDisplayURL = document.getElementById("btnGetDisplayURL")
        let btnGetEditURL = document.getElementById("btnGetEditURL")


        btnSaveChanges.addEventListener('click', updateNotes)
        btnHelp.addEventListener('click', help)
        btnGetDisplayURL.addEventListener('click', function(){
            copyURLClipboard("display");
        })
        btnGetEditURL.addEventListener('click', function(){
            copyURLClipboard("edit");
        })

        autoAddNote();

        // Get user from URL
        let params = location.search
        params = new URLSearchParams(params);
        let username = params.get('username')
        let password = params.get('password')

        if (username != undefined && password != undefined){
            signIn(username, password)
        }

    }else if (page == "display.html"){
        let leftArrow = document.getElementById("leftArrow")
        let rightArrow = document.getElementById("rightArrow")
        let flower = document.getElementById("flower")
        let msgElm = document.getElementById("msg")

        leftArrow.addEventListener('click', leftArrowClick)
        rightArrow.addEventListener('click', rightArrowClick)
        flower.addEventListener('dblclick', flowerDblClick)

        // Get display id from URL
        let params = location.search
        params = new URLSearchParams(params);
        params = params.get('displayId')

        if (params == undefined){
            utilityObj.Toast("Page does not exist",4)
        }else{
            currentCode = window.atob( params );
            displayLoadImage()
            displayLoadTitle()

            setTimeout(displayLoadNotes, 2500)
        }
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

// Store a variable associated with this code to db
function dbSetVariable(code, varName, value){
    const docRef = doc(db, code, "variables")
    setDoc(docRef, {[varName]: value}, {merge: true})
}

// Retrieve a variable associated with this code to db
async function dbGetVariable(code, varName){
    const docRef = doc(db, code, "variables")
    const snapshot = await getDoc(docRef)

    if (snapshot.exists()){
        return snapshot.data()[varName]
    }
    return ""
}

// Update note from db
function dbUpdateNote(code, noteId, newNote){
    const docRef = doc(db, code, noteId);

    updateDoc(docRef, {
        note: newNote
    });
}

// Set a note as read
function dbReadNote(code, noteId){
    const docRef = doc(db, code, noteId);

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

// Automatically add note element
function autoAddNote(){
    let noteContainer = document.getElementById("noteContainer");

    noteContainer.children[noteContainer.children.length-1].removeEventListener("click", autoAddNote);
    addNote();
    noteContainer.children[noteContainer.children.length-1].addEventListener("click", autoAddNote);
}

// Add note element on page
function addNote(){
    let noteContainer = document.getElementById("noteContainer");
    let note = document.createElement("input")
    note.classList.add("w3-input")
    note.maxLength = 420
    noteContainer.appendChild(note)
}

// Apply changes for the current code
async function updateNotes(){
    let pageTitle = document.getElementById("inputTitle").value
    let imageURL = document.getElementById("inputImageURL").value

    let currentNotes = getCurrentNotes()

    // Count how many actual notes are present
    let actNoteCount = 0
    for (let i = 0; i < currentNotes.length; i++){
        if (currentNotes[i].length > 0) actNoteCount++;
    }

    // Create user if does not exist
    if (currentCode == null || currentCode == ""){
        if (pageTitle == ""){
            utilityObj.Toast("Missing page title", 2)
            return;
        }
        else if (actNoteCount < 5){
            utilityObj.Toast("Must make at least 5 notes", 2)
            return;
        }
        else{
            await signUp()
        }
    }

    let notes = await dbGetNotes(currentCode)
    // Update note if text is on notes line, otherwise delete note
    for (let i = 0; i < notes.length; i++){
        if (currentNotes[i] == '')
            dbDeleteNote(currentCode, notes[i].id)
        else
            dbUpdateNote(currentCode, notes[i].id, currentNotes[i])
    }

    // Create note if does not exist
    if (currentNotes.length > notes.length){
        for (let i = notes.length; i < currentNotes.length; i++){
            if (currentNotes[i] != '')
                setTimeout(dbAddNote, 100, currentCode, currentNotes[i])
        }
    }

    // Store title
    dbSetVariable(currentCode, dbVarPageTitle, pageTitle)
    // Store image url
    dbSetVariable(currentCode, dbVarImageURL, imageURL)

    utilityObj.Toast("Notes updated", 2)
}

// Loads notes
function loadNotes(){
    dbGetNotes(currentCode).then(notes => {
        if (notes.length == 0){
            return
        }

        clearNotes()
        let noteContainer = document.getElementById("noteContainer").children

        // Create as many notes as needed
        let diff = noteContainer.length - notes.length
        if (diff < 0){
            for (let i = -1; i < diff*-1; i++){
                autoAddNote()
            }
        }
 
        // Fill notes with notes found in database
        for (let i = 0; i < notes.length; i++){
            noteContainer[i].value = notes[i].note

            // Show what notes have been read
            if (notes[i].read == true){
                noteContainer[i].style.backgroundColor = "#fdfd96";
            }
        }
    });
}

// Loads title 
function loadAttributes(){
    // Load title
    dbGetVariable(currentCode, dbVarPageTitle).then(title => {
        if (title == undefined) return;
        let titleElm = document.getElementById("inputTitle")
        titleElm.value = title
    })

    // Load IMG URL
    dbGetVariable(currentCode, dbVarImageURL).then(url => {
        if (url == undefined) return;
        let urlElm = document.getElementById("inputImageURL")
        urlElm.value = url
    })

}

// Copy URL to clipboard
function copyURLClipboard(urlOpt){
    if (currentCode == null || currentCode == ""){
        utilityObj.Toast("Create and save some notes first", 4);
        return;
    }

    dbGetVariable(currentCode, dbVarUsername).then(username => {
        dbGetVariable(currentCode, dbVarPassword).then(password => {
            let currentHost = window.location.host;
            let url = urlOpt == "display" ? currentHost + "/display.html" + "?displayId=" + username :
            currentHost + "/index.html" + "?username=" + window.btoa(currentCode) + "&password=" + window.btoa(password);
            
            navigator.clipboard.writeText(url)
            utilityObj.Toast("Copied to clipboard", 2);
        })
    })
}

// Attempts user sign in to retrieve data from db
function signIn(usernameIn, passwordIn){
    usernameIn = window.atob(usernameIn);
    passwordIn = window.atob(passwordIn);

    dbGetVariable(usernameIn, dbVarPassword).then(password => {
        if (passwordIn != password) return;

        currentCode = usernameIn
        loadNotes()
        loadAttributes()
    })
}

// Signs user up to db if username does not already exist
async function signUp(){
    let usernameIn = createRandomStr(8)
    let passwordIn = createRandomStr(8)

    let password = await dbGetVariable(usernameIn, dbVarPassword)
    // If there is no account for this username, create one
    if (password == ""){
        dbSetVariable(usernameIn, dbVarPassword, window.btoa( passwordIn ))
        dbSetVariable(usernameIn, dbVarUsername, window.btoa( usernameIn ))
        // Store edit url as backup
        let url = currentHost + "/index.html" + "?username=" + window.btoa(usernameIn) + "&password=" + window.btoa(passwordIn);
        dbSetVariable(usernameIn, "EditURL", url)
    }
    else{
        return
    }

    currentCode = usernameIn
    loadAttributes()
}

function help(){
    utilityObj.Toast("Set a title and write some notes, press save.\nTo access this page again press Edit Page URL to copy your unique edit URL.\nTo see the display page press Display Page URL to copy your unique display URL.", 10)
}

/* ==== DISPLAY PAGE ====*/ 

function displayLoadNotes(){
    // Load notes and display
    dbGetNotes(currentCode).then(notes => {
        // Set first note as read if not done
        if (notes[0].read == false)
            dbReadNote(currentCode, notes[0].id)

        // Display last read note
        for (let i = 0; i < notes.length; i++){
            if (notes[i].read == true && notes[i+1] != undefined ? notes[i+1].read == false : true){
                displayNote(notes[i].note)
                currentNoteIndex = i
                lastReadNoteIndex = i
                break
            }
        }

        // Store notes
        noteList = notes
    })
}

function displayNote(note){
    let noteTarget = document.getElementById("noteTarget");
    let fadeTimer = 1000

    if (noteTarget.innerHTML != ""){
        utilityObj.PlayAnimation(noteTarget, "fadeOut", "1", "ease-in-out")
    }else
        fadeTimer = 0
            
    setTimeout(() => {
        noteTarget.innerHTML = note;
        noteTarget.style.opacity = 0;
        setTimeout(() => {
            noteTarget.style.opacity = 1;
        }, 100)

        var textWrapper = document.querySelector('.ml6 .letters');
        textWrapper.innerHTML = textWrapper.textContent.replace(/\S/g, "<span class='letter'>$&</span>");
        
        anime.timeline({loop: false})
            .add({
                targets: '.ml6 .letter',
                translateY: ["1.1em", 0],
                translateZ: 0,
                duration: 750,
                opacity: [0,1],
                delay: (el, i) => 50 * i
            })
    }, fadeTimer)
}

function displayLoadTitle(){
    // Load title and display
    dbGetVariable(currentCode, dbVarPageTitle).then(title => {
        let titleElm = document.getElementById("title")
        titleElm.innerHTML = title
    })
}

function displayLoadImage(){
    // Load title and display
    dbGetVariable(currentCode, dbVarImageURL).then(url => {
        if (url == "" || url == undefined) return;
        let imageElm = document.getElementById("flower")
        imageElm.src = url
    })
}

function leftArrowClick(){
    if (!canChangeNote) return;

    // Stop user from spamming
    canChangeNote = false; 
    setTimeout(() => {
        canChangeNote = true;
    }, 1000)

    // Display previous note if exists
    if (noteList[currentNoteIndex-1] != undefined){
        displayNote(noteList[currentNoteIndex-1].note)
        currentNoteIndex--
    }
}

function rightArrowClick(){
    if (!canChangeNote) return;

    // Stop user from spamming
    canChangeNote = false; 
    setTimeout(() => {
        canChangeNote = true;
    }, 1000)

    // Check if a new note exists
    if (noteList[currentNoteIndex+1] == undefined){
        utilityObj.Toast("No more notes for now!", 4)
        return
    }

    // Check if next note has been read already, allowing to see it
    if (noteList[currentNoteIndex+1].read == true){
        displayNote(noteList[currentNoteIndex+1].note)
        currentNoteIndex++
        return
    }

    let lastReadNote = noteList[lastReadNoteIndex]
    // If next note has not been read
    // Check if it has been a day since reading most recently read note
    if (((lastReadNote.readOn / 1000) + 86400) < getCurrentDate() / 1000){
        displayNote(noteList[lastReadNoteIndex+1].note)
        dbReadNote(currentCode, noteList[lastReadNoteIndex+1].id)
        currentNoteIndex++

        // Play animation on new note revealed
        utilityObj.PlayAnimation(document.getElementById("msgBackgroundEffect"), "fadeInOut", "5", "ease-in-out")
    }else{
        // Get time to wait in hours
        let timeLeft = ((((lastReadNote.readOn / 1000) + 86400) - (getCurrentDate() / 1000)) / 60) / 60
        utilityObj.Toast("New note available in " + Math.floor(timeLeft) + " hours", 4)
    }
}

function flowerDblClick(){
    utilityObj.PlayAnimation(document.getElementById("msgBackgroundEffect"), "fadeInOut", "5", "ease-in-out")
}

/* ==== HELP FUNCTIONS ====*/ 

// Make random string
function createRandomStr(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}

// Hide / Unhide all elements with a class
function hideElements(className, isHidden){
    let elements = document.getElementsByClassName(className)

    for (let i = 0; i < elements.length; i++){
        if (isHidden){
            elements[i].style.display = "none"
        }else{
            elements[i].style.display = ""
        }
    }
}

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