import { dbGetNotes, dbAddNote, dbSetVariable, dbGetVariable, dbUpdateNote, dbReadNote, dbDeleteNote, dbAddReadNote, dbDoesExist } from './services/mockdatabase'
import { PlayAnimation, Toast, createRandomStr, getCurrentNotes, getCurrentDate, clearNotes } from './utility'
import { dbVarPassword, dbVarUsername, dbVarImageURL, dbVarPageTitle, dbVarFavorite, defaultImgSrc } from './staticvariables'

var currentCode = null
var currentPassword = null
var displayTitle
var displayImage
var noteList = []

export function InputInit(){
    let btnSaveChanges = document.getElementById("btnSaveChanges")
    let btnHelp = document.getElementById("btnHelp")
    let helpMenuClose = document.getElementById("helpClose")
    let helpMenu = document.getElementById("helpMenu")
    let btnGetDisplayURL = document.getElementById("btnGetDisplayURL")
    let btnGetEditURL = document.getElementById("btnGetEditURL")

    helpMenuClose.addEventListener('click', help)
    btnHelp.addEventListener('click', help)

    btnSaveChanges.addEventListener('click', updateNotes)
    btnGetDisplayURL.addEventListener('click', function(){
        copyURLClipboard("display");
    })
    btnGetEditURL.addEventListener('click', function(){
        copyURLClipboard("edit");
    })

    // Set up auto note
    autoAddNote()

    // Get user from URL
    let params = location.search
    params = new URLSearchParams(params);
    let displayId = params.get('displayId')
    let password = params.get('password')

    if (displayId != undefined && password != undefined){
        loadData(displayId, password)
    }
}

async function loadData(code, password){
    // If code exists, attempt sign in
    if (dbDoesExist(code)){
        if (signIn(code,password))
            await reloadData(code)
        else
            return
    }

    loadNotes()
    loadAttributes()
}

// Gets data from datbase
async function reloadData(code){
    // Load variables from database
    noteList = await dbGetNotes(code)
    displayTitle = await dbGetVariable(code, dbVarPageTitle)
    displayImage = await dbGetVariable(code, dbVarImageURL)
    currentPassword = await dbGetVariable(code, dbVarPassword)
    currentCode = code
}

// Attempts user sign in to retrieve data from db
async function signIn(displayIdIn, passwordIn){
    let password = dbGetVariable(displayIdIn, dbVarPassword)
    if (passwordIn != password) {  
        return false
    }

    currentCode = displayIdIn
    currentPassword = password
    return true
}

// Signs user up to db if username does not already exist
async function signUp(){
    let displayIdIn = createRandomStr(10)
    let passwordIn = createRandomStr(8)

    // Store edit url as backup
    let currentHost = window.location.host;
    let url = "/index.html" + "?displayId=" + displayIdIn + "&password=" + passwordIn;
    // Change current url
    window.history.pushState('Kayletter', 'Kayletter', url)

    // Set up in database
    dbSetVariable(displayIdIn, dbVarPassword, passwordIn)
    dbSetVariable(displayIdIn, "EditURL", currentHost + url)

    currentCode = displayIdIn
    currentPassword = passwordIn
}

// Apply changes for the current code
async function updateNotes(){

    // ========= UPDATE VARIABLES ========= 

    let pageTitle = document.getElementById("inputTitle").value
    let imageURL = document.getElementById("inputImageURL").value

    // Update image to show on this page
    let displayImg = document.getElementById("displayImg");
    displayImg.src = imageURL == null || imageURL == "" ? defaultImgSrc : imageURL

    // ========= SIGN UP IF NOT SIGNED IN ========= 

    // Get notes from list
    let currentNotes = getCurrentNotes()

    // Count how many actual notes are present
    let actNoteCount = 0
    for (let i = 0; i < currentNotes.length; i++){
        if (currentNotes[i].length > 0) actNoteCount++;
    }

    let newUser = false
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
            newUser = true
        }
    }

    // Store title
    dbSetVariable(currentCode, dbVarPageTitle, pageTitle)
    // Store image url
    if (imageURL != null || imageURL != "")
        dbSetVariable(currentCode, dbVarImageURL, imageURL)

    // ========= UPDATE NOTES ========= 

    // Update note if text is on notes line
    for (let i = 0; i < noteList.length; i++){
        if (noteList[i].note != currentNotes[i]){
            dbUpdateNote(currentCode, noteList[i].id, currentNotes[i])
            noteList[i].note = currentNotes[i]
        }
    }

    // ========= CREATE NOTES ========= 

    // Create note if does not exist
    if (currentNotes.length > noteList.length){
        for (let i = noteList.length; i < currentNotes.length; i++){
            if (currentNotes[i] != ''){
                // Make first note read if new user
                if (newUser){
                    dbAddReadNote(currentCode, currentNotes[i])
                    noteList.push(currentNotes[i])
                    newUser = false
                }
                // Add normal unread note
                else{
                    dbAddNote(currentCode, currentNotes[i])
                    noteList.push(currentNotes[i])
                }
                    
                await new Promise(r => setTimeout(r, 50))
            }
        }
    }

    Toast("Notes updated", 2)
}

// Loads notes
async function loadNotes(){
    if (noteList.length == 0)
        return

    let noteContainer = document.getElementById("noteContainer").children

    // Create as many notes as needed
    let diff = noteContainer.length - noteList.length
    if (diff < 0){
        for (let i = -1; i < diff*-1; i++){
            autoAddNote()
        }
    }

    // Fill notes with notes found in database
    for (let i = 0; i < noteList.length; i++){
        noteContainer[i].innerHTML = noteList[i].note

        // Show what notes have been read
        if (noteList[i].read){
            noteContainer[i].style.backgroundColor = "#fdfd96";
        }

        // Show favorite note
        if (noteList[i].isFavorite){
            noteContainer[i].style.backgroundColor = "#FF748C";
        }
    }
}

// Loads title 
function loadAttributes(){
    // Load title
    let titleElm = document.getElementById("inputTitle")
    titleElm.value = displayTitle

    // Check for img 
    if (displayImage != null && displayImage != ""){
        // Load img url
        let urlElm = document.getElementById("inputImageURL")
        urlElm.value = displayImage

        // Update image on this page
        let flower = document.getElementById("flower");
        flower.src = displayImage
    }
}

// Copy URL to clipboard
function copyURLClipboard(urlOpt){
    if (currentCode == null || currentCode == ""){
        Toast("Create and save some notes first", 4);
        return;
    }

    let currentHost = window.location.host;
    let url = urlOpt == "display" ? currentHost + "/display.html" + "?displayId=" + currentCode :
    currentHost + "/index.html" + "?displayId=" + currentCode + "&password=" + currentPassword;
    
    navigator.clipboard.writeText(url)
    Toast("Copied to clipboard", 2);
}

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
    let copy = noteContainer.children[noteContainer.children.length-1]
    let note = copy.cloneNode(true);
    noteContainer.appendChild(note)
}

// Enable/Disable help
function help(){
    let helpMenu = document.getElementById("helpMenu")
    helpMenu.style.opacity = helpMenu.style.opacity == "1" ? "0" : "1"
    helpMenu.style.visibility = helpMenu.style.visibility == "visible" ? "hidden" : "visible"
}
