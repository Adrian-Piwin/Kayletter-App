import { getCurrentUser, dbGetNotes, dbAddNote, dbSetVariable, dbGetVariable, dbUpdateNote, dbAddReadNote, dbGetUserCode, dbDoesExist, logoutUser } from '../services/database'
import { PlayAnimation, Toast, createRandomStr, getCurrentNotes, getCurrentDate, clearNotes } from '../utility'
import { dbVarPassword, dbVarUsername, dbVarImageURL, dbVarPageTitle, dbVarFavorite, defaultImgSrc } from '../staticvariables'

var currentCode = null
var currentPassword = null
var displayTitle
var displayImage
var noteList = []
let isBannerVisible = true;

export async function InputInit(){
    let imageElm = document.getElementById("displayImg");
    imageElm.src = defaultImgSrc;

    let btnSaveChanges = document.getElementById("btnSaveChanges")
    let btnHelp = document.getElementById("btnHelp")
    let helpMenuClose = document.getElementById("helpClose")
    let helpMenu = document.getElementById("helpMenu")
    let btnGetDisplayURL = document.getElementById("btnGetDisplayURL")
    let logoutBtn = document.getElementById("logoutBtn")

    const banner = document.getElementById('adBanner');
    const arrow = document.getElementById('bannerArrow');

    function toggleBanner() {
        if (isBannerVisible) {
            banner.style.bottom = '-250px';
        } else {
            banner.style.bottom = '0';
        }
        isBannerVisible = !isBannerVisible;
    }

    arrow.addEventListener('click', toggleBanner);

    logoutBtn.addEventListener('click', async () => {
        try {
            await logoutUser();
            window.location.href = '/login.html';
        } catch (error) {
            Toast('Logout failed: ' + error.message, 4);
        }
    });

    helpMenuClose.addEventListener('click', help)
    btnHelp.addEventListener('click', help)

    btnSaveChanges.addEventListener('click', updateNotes)
    btnGetDisplayURL.addEventListener('click', function(){
        copyURLClipboard("display");
    })

    // Set up auto note
    autoAddNote()

    // Get the user and load the notes for them
    const user = getCurrentUser();
    if (user) {
        const userCode = await dbGetUserCode(user.uid);
        if (userCode) {
            currentCode = userCode; // Set currentCode with the user’s associated displayId
            loadData(currentCode);
        } else {
            Toast('No code associated with your account.', 4);
        }
    }
}

async function loadData(code){
    await reloadData(code)
    loadNotes()
    loadAttributes()
}

// Gets data from datbase
async function reloadData(code){
    // Load variables from database
    noteList = await dbGetNotes(code)
    displayTitle = await dbGetVariable(code, dbVarPageTitle)
    displayImage = await dbGetVariable(code, dbVarImageURL)
}

// Apply changes for the current code
async function updateNotes(){

    // ========= UPDATE VARIABLES ========= 

    let pageTitle = document.getElementById("inputTitle").value
    let imageURL = document.getElementById("inputImageURL").value

    // Update image to show on this page
    let displayImg = document.getElementById("displayImg");
    displayImg.src = imageURL == null || imageURL == "" ? defaultImgSrc : imageURL

    // Get notes from list
    let currentNotes = getCurrentNotes()

    // Count how many actual notes are present
    let actNoteCount = 0
    for (let i = 0; i < currentNotes.length; i++){
        if (currentNotes[i].length > 0) actNoteCount++;
    }

    // Create user if does not exist
    if (pageTitle == ""){
        Toast("Missing page title", 2)
        return;
    }
    else if (actNoteCount < 1){
        Toast("Must make at least 1 note", 2)
        return;
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
                // Make first note read
                if (i == 0 && !currentNotes[i].read){
                    dbAddReadNote(currentCode, currentNotes[i])
                    noteList.push(currentNotes[i])
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
    let currentHost = window.location.host;
    let url = urlOpt == "display" ? currentHost + "/display.html" + "?displayId=" + currentCode :
    currentHost + "/input.html" + "?displayId=" + currentCode + "&password=" + currentPassword;
    
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
