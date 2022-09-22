import { dbGetNotes, dbAddNote, dbSetVariable, dbGetVariable, dbUpdateNote, dbReadNote, dbDeleteNote, dbFavoriteNote, dbDoesExist } from './database'
import { PlayAnimation, Toast, createRandomStr, getCurrentNotes, getCurrentDate, clearNotes } from './utility'
import { dbVarPassword, dbVarUsername, dbVarImageURL, dbVarPageTitle, dbVarFavorite } from './staticvariables'

// Data to load
var currentCode = null
var displayTitle
var displayImage
var noteList = []

// Note indexes
var currentNoteIndex = 0
var lastReadNoteIndex = 0

// Fav note
var favNoteStyle = '-1px -1px 0 #ffe28a, 1px -1px 0 #ffe28a, -1px 1px 0 #ffe28a, 1px 1px 0 #ffe28a'
var currentFavNoteIndex = -1

// Changing note arrows
var clickTimerId = null
var canChangeNote = true

export function OutputInit(){
    let leftArrow = document.getElementById("leftArrow")
    let rightArrow = document.getElementById("rightArrow")
    let displayImg = document.getElementById("displayImg")
    let noteTarget = document.getElementById("noteTarget")

    // Left arrow click & double click
    leftArrow.addEventListener('click', () => {
        if (!canChangeNote) return;
        clickTimerId = setTimeout(leftArrowClick, 500)
    })

    leftArrow.addEventListener('dblclick', () => {
        if (!canChangeNote) return;
        clearInterval(clickTimerId)
        leftArrowDblClick()
    })
    
    // Right arrow click & double click
    rightArrow.addEventListener('click', () => {
        if (!canChangeNote) return;
        clickTimerId = setTimeout(rightArrowClick, 500)
    })

    rightArrow.addEventListener('dblclick', () => {
        if (!canChangeNote) return;
        clearInterval(clickTimerId)
        rightArrowDblClick()
    })

    // Image double click
    displayImg.addEventListener('dblclick', () => {
        displayImgDblClick()
        displayFavNote()
    })

    // Note double click
    noteTarget.addEventListener('dblclick', displaySetFavNote)

    // Get display id from URL
    let params = location.search
    params = new URLSearchParams(params);
    params = params.get('displayId')

    if (params == undefined){
        // No display id found
        Toast("Page does not exist",4)
    }else{
        // Attempt load of display id
        loadData(params)
    }
}

/* ==== DISPLAY PAGE ====*/ 

async function loadData(code){
    let canReloadData = false;

    // Allow to load data if code does not match local code, but code exists
    if (localStorage.currentCode){
        if (localStorage.currentCode != code){
            if (await dbDoesExist(code))
                canReloadData = true
            else
                return
        }
    }

    // Find out if its been a day or first time setup
    // to see if we can load data from database
    if (localStorage.timeSinceLastUpdate){
        let timeSinceLastUpdate = new Date(localStorage.timeSinceLastUpdate)
        timeSinceLastUpdate.setDate(timeSinceLastUpdate.getDate() + 1)
    
        let now = new Date().getTime()
        let timeleft = timeSinceLastUpdate.getTime() - now
        if (timeleft <= 0)
            canReloadData = true
    }else
        canReloadData = true

    // Load data from database to local
    if (canReloadData){
        let notes = []
        // Update read and fav notes to db
        if (localStorage.noteList){
            notes = await dbGetNotes(code)
            setData(notes, localStorage.noteList)
            // Wait so db can catchup
            await new Promise(r => setTimeout(r, 100))
        }

        // Get updated notes from db
        notes = await dbGetNotes(code)

        // Store all variables in local storage
        localStorage.noteList = JSON.stringify(notes)
        localStorage.displayTitle = await dbGetVariable(code, dbVarPageTitle)
        localStorage.displayImage = await dbGetVariable(code, dbVarImageURL)
        localStorage.timeSinceLastUpdate = getCurrentDate()
        localStorage.currentCode = code
    }

    // Load data from storage
    noteList = JSON.parse(localStorage.noteList)
    displayTitle = localStorage.displayTitle
    displayImage = localStorage.displayImage
    currentCode = code

    // Load page
    displayLoadAttributes()
    displayLoadNotes()
    displayLoadTimer()
}

function setData(databaseNoteList, localNoteList){
    // Updates database data with local data
    for (let i = 0; i < localNoteList.length; i++){
        // Set read in db if not already
        if (localNoteList[i].read != databaseNoteList[i].read){
            dbReadNote(currentCode, localNoteList[i].id)
        }

        // Set favorite in db if not already
        if (localNoteList[i].isFavorite != databaseNoteList[i].isFavorite){
            dbFavoriteNote(currentCode, localNoteList[i].id, localNoteList[i].isFavorite)
        }
    }
}

function displayLoadNotes(){
    // Load notes and display
    for (let i = 0; i < noteList.length; i++){
        // Display last read note
        if (noteList[i].read == true && noteList[i+1] != undefined ? noteList[i+1].read == false : true){
            currentNoteIndex = i
            lastReadNoteIndex = i

            // Display note on a delay
            setTimeout(displayNote, 1500, noteList[i])
            displayNoteInfo()
            break
        }
    }
}

function displayLoadAttributes(){
    // Load title and image url
    let titleElm = document.getElementById("displayTitle")
    titleElm.innerHTML = displayTitle

    if (displayImage != null && displayImage != ""){
        let imageElm = document.getElementById("displayImg")
        imageElm.src = displayImage
    }
}

// Load the timer 
function displayLoadTimer(){
    // Do not load timer if a new note does not exist
    if (noteList[lastReadNoteIndex+1] == undefined) return

    let timerElm = document.getElementById("liveTimer");
    let countDownDate = new Date(noteList[lastReadNoteIndex].readOn)
    countDownDate.setDate(countDownDate.getDate() + 1);
    countDownDate = countDownDate.getTime();

    // Interval for timer
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

// Animate displaying a new note
function displayNote(note){
    let noteTarget = document.getElementById("noteTarget");
    let fadeTimer = 500
    canChangeNote = false

    PlayAnimation(noteTarget, "fadeOut", "0.5", "ease-in-out")
            
    setTimeout(() => {
        noteTarget.style.textShadow = note.isFavorite ? favNoteStyle : 'none'
        noteTarget.innerHTML = note.note;
        PlayAnimation(noteTarget, "fadeIn2", "0.3", "ease-in-out")

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
        
        canChangeNote = true
    }, fadeTimer)
}

function displayNoteInfo(){
    // Update info for current note
    let noteDateElm = document.getElementById("noteDate")
    let notePosElm = document.getElementById("notePosition")

    let date = new Date(noteList[currentNoteIndex].readOn)
    let pos = (currentNoteIndex+1) + " / " + (lastReadNoteIndex+1)

    notePosElm.innerHTML = pos
    noteDateElm.innerHTML = (date.getMonth()+1) + " / " + date.getDate() + " / " + date.getFullYear()
}

function leftArrowClick(){
    // Display previous note if exists
    if (noteList[currentNoteIndex-1] != undefined){
        currentNoteIndex--
        displayNote(noteList[currentNoteIndex])
        displayNoteInfo()
    }
}

function leftArrowDblClick(){
    // Display first note
    currentNoteIndex = 0
    displayNote(noteList[currentNoteIndex])
    displayNoteInfo()
}

function rightArrowClick(){
    // Check if a new note exists
    if (noteList[currentNoteIndex+1] == undefined){
        Toast("No more notes for now!", 4)
        return
    }

    // Check if next note has been read already, allowing to see it
    if (noteList[currentNoteIndex+1].read == true){
        currentNoteIndex++
        displayNote(noteList[currentNoteIndex])
        displayNoteInfo()
        return
    }

    let now = new Date().getTime();
    let targetDate = new Date(noteList[lastReadNoteIndex].readOn)
    targetDate.setDate(targetDate.getDate() + 1);
    let timeleft = targetDate.getTime() - now;
    // If next note has not been read
    // Check if it has been a day since reading most recently read note
    if (timeleft <= 0){
        currentNoteIndex++
        lastReadNoteIndex++

        // Show new note
        displayNote(noteList[currentNoteIndex])
        displayNoteInfo()

        // Update local note to read
        noteList[currentNoteIndex].read = true
        noteList[currentNoteIndex].readOn = getCurrentDate()
        localStorage.noteList = JSON.stringify(notes)

        // Update timer
        displayLoadTimer()

        // Play animation on new note revealed
        PlayAnimation(document.getElementById("msgBackgroundEffect"), "fadeInOut", "5", "ease-in-out")
    }
}

// Display last note
function rightArrowDblClick(){
    currentNoteIndex = lastReadNoteIndex
    displayNote(noteList[currentNoteIndex])
    displayNoteInfo()
}

// Show hearts on double click
function displayImgDblClick(){
    PlayAnimation(document.getElementById("msgBackgroundEffect"), "fadeInOut", "5", "ease-in-out")
}

// Set note as favorite on double click
function displaySetFavNote(){
    noteList[currentNoteIndex].isFavorite = !noteList[currentNoteIndex].isFavorite == null ? true : !noteList[currentNoteIndex].isFavorite
    localStorage.noteList = JSON.stringify(notes)

    let noteTarget = document.getElementById("noteTarget");
    noteTarget.style.textShadow = noteList[currentNoteIndex].isFavorite ? favNoteStyle : 'none'
    Toast(noteList[currentNoteIndex].isFavorite ? 'Added to favorites' : 'Removed from favorites', 2)
}

// Display favorite note on double click
function displayFavNote(){
    let favList = []
    let favIndexList = []

    for (let i = 0; i < noteList.length; i++){
        if (noteList[i].isFavorite){
            favList.push(noteList[i])
            favIndexList.push(i)
        }
    }

    if (favList.length == 0) return

    currentFavNoteIndex = currentFavNoteIndex + 1 >= favList.length ? 0 : currentFavNoteIndex+1
    currentNoteIndex = favIndexList[currentFavNoteIndex]
    displayNote(noteList[currentNoteIndex])
    displayNoteInfo()
}
