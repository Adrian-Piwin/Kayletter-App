import { dbGetNotes, dbAddNote, dbSetVariable, dbGetVariable, dbUpdateNote, dbReadNote, dbDeleteNote } from './database'
import { PlayAnimation, Toast, createRandomStr, getCurrentNotes, getCurrentDate, clearNotes } from './utility'

var currentCode = null

// Strings to access variables from db
var dbVarPassword = "password"
var dbVarPageTitle = "pageTitle"
var dbVarImageURL = "imageURL"
var dbVarDisplayId = "displayPageId"
var dbVarFavorite = "favoriteNote"

var defaultImgSrc = "/dist/flowers/sunflower.gif"

export function InputInit(){
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

    // Get user from URL
    let params = location.search
    params = new URLSearchParams(params);
    let displayId = params.get('displayId')
    let password = params.get('password')

    if (displayId != undefined && password != undefined){
        signIn(displayId, password)
    }
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
    note.maxLength = 240
    noteContainer.appendChild(note)
}

// Apply changes for the current code
async function updateNotes(){
    let pageTitle = document.getElementById("inputTitle").value
    let imageURL = document.getElementById("inputImageURL").value

    // Update image to show on this page
    let displayImg = document.getElementById("displayImg");
    displayImg.src = imageURL == null || imageURL == "" ? defaultImgSrc : imageURL

    let currentNotes = getCurrentNotes()

    // Count how many actual notes are present
    let actNoteCount = 0
    for (let i = 0; i < currentNotes.length; i++){
        if (currentNotes[i].length > 0) actNoteCount++;
    }

    // Create user if does not exist
    if (currentCode == null || currentCode == ""){
        if (pageTitle == ""){
            Toast("Missing page title", 2)
            return;
        }
        else if (actNoteCount < 5){
            Toast("Must make at least 5 notes", 2)
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

    Toast("Notes updated", 2)
}

// Loads notes
async function loadNotes(){
    let notes = await dbGetNotes(currentCode)

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
    }else{
        autoAddNote()
    }

    // Fill notes with notes found in database
    for (let i = 0; i < notes.length; i++){
        noteContainer[i].value = notes[i].note

        // Show what notes have been read
        if (notes[i].read){
            noteContainer[i].style.backgroundColor = "#fdfd96";
        }

        // Show favorite note
        if (notes[i].isFavorite){
            noteContainer[i].style.backgroundColor = "#FF748C";
        }
    }
 
}

// Loads title 
function loadAttributes(){
    // Load title
    dbGetVariable(currentCode, dbVarPageTitle).then(title => {
        if (title == null || title == "") return;
        let titleElm = document.getElementById("inputTitle")
        titleElm.value = title
    })

    // Load IMG URL
    dbGetVariable(currentCode, dbVarImageURL).then(url => {
        if (url == null || url == "") return;
        let urlElm = document.getElementById("inputImageURL")
        urlElm.value = url

        // Update image on this page
        let flower = document.getElementById("flower");
        flower.src = url
    })

}

// Copy URL to clipboard
function copyURLClipboard(urlOpt){
    if (currentCode == null || currentCode == ""){
        Toast("Create and save some notes first", 4);
        return;
    }

    dbGetVariable(currentCode, dbVarPassword).then(password => {
        let currentHost = window.location.host;
        let url = urlOpt == "display" ? currentHost + "/display.html" + "?displayId=" + currentCode :
        currentHost + "/index.html" + "?displayId=" + currentCode + "&password=" + password;
        
        navigator.clipboard.writeText(url)
        Toast("Copied to clipboard", 2);
    })
}

// Attempts user sign in to retrieve data from db
function signIn(displayIdIn, passwordIn){
    dbGetVariable(displayIdIn, dbVarPassword).then(password => {
        if (passwordIn != password) {  
            Toast("User not found", 2);
            return;
        }

        currentCode = displayIdIn
        loadNotes()
        loadAttributes()
    })
}

// Signs user up to db if username does not already exist
async function signUp(){
    let displayIdIn = createRandomStr(8)
    let passwordIn = createRandomStr(8)

    let password = await dbGetVariable(displayIdIn, dbVarPassword)
    // If there is no account for this username, create one
    if (password == ""){
        dbSetVariable(displayIdIn, dbVarPassword, passwordIn)
        // Store edit url as backup
        let currentHost = window.location.host;
        let url = currentHost + "/index.html" + "?displayId=" + displayIdIn + "&password=" + passwordIn;
        dbSetVariable(displayIdIn, "EditURL", url)
    }
    else{
        return
    }

    currentCode = displayIdIn
    loadAttributes()
}

function help(){
    Toast("Set a title and write some notes, press save. Make sure to save your edit URL to access this page again or your data will be lost. If a note is highlighted it means it has been read.", 10)
}