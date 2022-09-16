import { dbGetNotes, dbAddNote, dbSetVariable, dbGetVariable, dbUpdateNote, dbReadNote, dbDeleteNote } from './database'
import { PlayAnimation, Toast, createRandomStr, getCurrentNotes, getCurrentDate, clearNotes } from './utility'

var currentCode = null
var noteList = []

// Display
var currentNoteIndex = 0
var lastReadNoteIndex = 0

// Strings to access variables from db
var dbVarPassword = "password"
var dbVarPageTitle = "pageTitle"
var dbVarImageURL = "imageURL"
var dbVarUsername = "displayPageId"
var dbVarFavorite = "favoriteNote"

export function OutputInit(){
    let leftArrow = document.getElementById("leftArrow")
    let rightArrow = document.getElementById("rightArrow")
    let displayImg = document.getElementById("displayImg")
    let noteTarget = document.getElementById("noteTarget")

    leftArrow.addEventListener('click', leftArrowClick)
    leftArrow.addEventListener('dblclick', leftArrowDblClick)

    rightArrow.addEventListener('click', rightArrowClick)
    rightArrow.addEventListener('dblclick', rightArrowDblClick)

    displayImg.addEventListener('dblclick', displayImgDblClick)
    displayImg.addEventListener('click', function (evt) {
        if (evt.detail === 3) {
            displayFavNote()
        }
    })
    noteTarget.addEventListener('dblclick', displaySetFavNote)

    // Get display id from URL
    let params = location.search
    params = new URLSearchParams(params);
    params = params.get('displayId')

    if (params == undefined){
        Toast("Page does not exist",4)
    }else{
        currentCode = window.atob( params );
        displayLoadImage()
        displayLoadTitle()

        setTimeout(displayLoadNotes, 1500)
    }
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
        // Start timer
        displayLoadTimer()
    })
}

function displayNote(note){
    let noteTarget = document.getElementById("noteTarget");
    let fadeTimer = 500

    PlayAnimation(noteTarget, "fadeOut", "0.5", "ease-in-out")
            
    setTimeout(() => {
        noteTarget.innerHTML = note;
        PlayAnimation(noteTarget, "fadeIn2", "0.2", "ease-in-out")

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
        let titleElm = document.getElementById("displayTitle")
        titleElm.innerHTML = title
    })
}

function displayLoadImage(){
    // Load title and display
    dbGetVariable(currentCode, dbVarImageURL).then(url => {
        if (url == "" || url == undefined) return;
        let imageElm = document.getElementById("displayImg")
        imageElm.src = url
    })
}

function displayLoadTimer(){
    let timerElm = document.getElementById("liveTimer");
    let countDownDate = new Date(noteList[lastReadNoteIndex].readOn).getTime();

    let intervalID = setInterval(() => {
        let now = new Date().getTime();
        let timeleft = countDownDate - now;

        let hours = Math.floor((timeleft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        let minutes = Math.floor((timeleft % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((timeleft % (1000 * 60)) / 1000);

        timerElm.innerHTML = "New note in " + (hours.toString().length == 1 ? "0" : "") + hours + " : " + (minutes.toString().length == 1 ? "0" : "") + minutes + " : " + (seconds.toString().length == 1 ? "0" : "") + seconds

        if (timeleft <= 0){
            timerElm.innerHTML = "New note available"
            clearInterval(intervalID)
        }
    }, 1000)
}

function leftArrowClick(){
    // Display previous note if exists
    if (noteList[currentNoteIndex-1] != undefined){
        displayNote(noteList[currentNoteIndex-1].note)
        currentNoteIndex--
    }
}

function leftArrowDblClick(){
    // Display first note
    displayNote(noteList[0].note)
    currentNoteIndex = 0
}

function rightArrowClick(){
    // Check if a new note exists
    if (noteList[currentNoteIndex+1] == undefined){
        Toast("No more notes for now!", 4)
        return
    }

    // Check if next note has been read already, allowing to see it
    if (noteList[currentNoteIndex+1].read == true){
        displayNote(noteList[currentNoteIndex+1].note)
        currentNoteIndex++
        return
    }

    let now = new Date().getTime();
    let timeleft = new Date(noteList[lastReadNoteIndex].readOn).getTime() - now;
    // If next note has not been read
    // Check if it has been a day since reading most recently read note
    if (timeleft <= 0){
        currentNoteIndex++
        lastReadNoteIndex++

        // Update note, set as read in db, and update timer
        displayNote(noteList[currentNoteIndex].note)
        dbReadNote(currentCode, noteList[currentNoteIndex].id)
        displayLoadTimer()

        // Play animation on new note revealed
        PlayAnimation(document.getElementById("msgBackgroundEffect"), "fadeInOut", "5", "ease-in-out")
    }
}

function rightArrowDblClick(){
    // Display last note
    displayNote(noteList[lastReadNoteIndex].note)
    currentNoteIndex = lastReadNoteIndex
}

// Show hearts on double click
function displayImgDblClick(){
    PlayAnimation(document.getElementById("msgBackgroundEffect"), "fadeInOut", "5", "ease-in-out")
}

// Set note as favorite on triple click
function displaySetFavNote(){
    dbSetVariable(currentCode, dbVarFavorite, currentNoteIndex)
    Toast('Set as favorite note', 2)
}

// Display favorite note on double click
function displayFavNote(){
    dbGetVariable(currentCode, dbVarFavorite).then(favIndex => {
        if (favIndex == null || favIndex == "") return

        displayNote(noteList[favIndex].note)
        currentNoteIndex = favIndex
    })
}
