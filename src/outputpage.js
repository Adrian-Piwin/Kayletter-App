import { dbGetNotes, dbAddNote, dbSetVariable, dbGetVariable, dbUpdateNote, dbReadNote, dbDeleteNote, dbFavoriteNote, dbDoesExist } from './database'
import { PlayAnimation, Toast, createRandomStr, getCurrentNotes, getCurrentDate, clearNotes, checkDayPassed } from './utility'
import { dbVarPassword, dbVarUsername, dbVarImageURL, dbVarPageTitle, dbVarFavorite, revealAudio } from './staticvariables'

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

// Changing note arrow timer
var clickTimer = null
var canChangeNote = true

export function OutputInit(){
    let leftArrow = document.getElementById("leftArrow")
    let rightArrow = document.getElementById("rightArrow")
    let displayImg = document.getElementById("displayImg")
    let noteTarget = document.getElementById("noteTarget")

    // Left arrow click vs long press detection
    leftArrow.addEventListener('mousedown', () => {
        if (!canChangeNote) return;
        clickTimer = new Date().getTime();
    })

    leftArrow.addEventListener('mouseup', () => {
        if (!canChangeNote) return;
        if (new Date().getTime() - clickTimer < 500)
            leftArrowClick()
        else
            leftArrowLongPress()
    })

    // Right arrow click vs long press detection
    rightArrow.addEventListener('mousedown', () => {
        if (!canChangeNote) return;
        clickTimer = new Date().getTime();
    })

    rightArrow.addEventListener('mouseup', () => {
        if (!canChangeNote) return;
        if (new Date().getTime() - clickTimer < 500)
            rightArrowClick()
        else
            rightArrowLongPress()
    })

    // Image double click
    displayImg.addEventListener('dblclick', displayImgDblClick)

    // Note double click
    noteTarget.addEventListener('dblclick', displaySetFavNote)

    // Update database on page unload
    window.onbeforeunload = updateDatabase;

    // Get display id from URL
    let params = location.search
    params = new URLSearchParams(params);
    params = params.get('displayId')

    if (params == undefined){
        // No display id, display current code if exists
        if (localStorage.currentCode)
            loadData(localStorage.currentCode)
        else
            Toast("Page does not exist", 2)
    }else{
        // Attempt load of display id
        loadData(params)
    }
}

// Loads data from database or local storage
async function loadData(code){
    let canReloadData = false;

    // If code trying to access does not match local code, check if code exists
    // to display new data or display nothing, if code does match local, check if day passed
    if (localStorage.currentCode){
        if (localStorage.currentCode == code)
            canReloadData = checkDayPassed(code + "databaseUpdate") == 0
        else if (localStorage.currentCode != code && await dbDoesExist(code)){
            canReloadData = true
        }
        else{
            Toast("Page does not exist", 2)
            return
        }
    }else
        canReloadData = true

    // Load data from database to local
    if (canReloadData){
        // Store all variables in local storage
        localStorage.noteList = JSON.stringify(await dbGetNotes(code))
        localStorage.displayTitle = await dbGetVariable(code, dbVarPageTitle)
        localStorage.displayImage = await dbGetVariable(code, dbVarImageURL)
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

// Updates database data with local data
async function updateDatabase(){
    if (!currentCode) return

    let databaseNoteList = await dbGetNotes(currentCode)
    for (let i = 0; i < noteList.length; i++){
        // Set read in db if not already
        if (noteList[i].read != databaseNoteList[i].read){
            dbReadNote(code, noteList[i].id)
        }

        // Set favorite in db if not already
        if (noteList[i].isFavorite != databaseNoteList[i].isFavorite){
            dbFavoriteNote(code, noteList[i].id, noteList[i].isFavorite)
        }
    }
}

// On load first time note setup
function displayLoadNotes(){
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

// On load, first time title and image setup
function displayLoadAttributes(){
    let titleElm = document.getElementById("displayTitle")
    titleElm.innerHTML = displayTitle

    if (displayImage != null && displayImage != ""){
        let imageElm = document.getElementById("displayImg")
        imageElm.src = displayImage
    }
}

// Load the timer for new note countdown
function displayLoadTimer(){
    // Check if day has passed and if a new note is available
    if (checkDayPassed(currentCode + "newNote") == 0){
        if (noteList[lastReadNoteIndex+1] != undefined && !noteList[lastReadNoteIndex+1].read){
            timerElm.innerHTML = "New note available"
            return
        }else
            return
    }

    let timerElm = document.getElementById("liveTimer");
    let timeleft = checkDayPassed(currentCode + "newNote")
    // Countdown timer to new note
    let intervalID = setInterval(() => {
        // Subtract 1 second every second
        timeleft -= 1000
        
        // Check if day passed
        if (timeleft <= 0){
            timerElm.innerHTML = "New note available"
            clearInterval(intervalID)
            return
        }

        // Set timer
        let hours = Math.floor((timeleft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        let minutes = Math.floor((timeleft % (1000 * 60 * 60)) / (1000 * 60));
        let seconds = Math.floor((timeleft % (1000 * 60)) / 1000);

        timerElm.innerHTML = "New note in " + (hours.toString().length == 1 ? "0" : "") + hours + " : " + (minutes.toString().length == 1 ? "0" : "") + minutes + " : " + (seconds.toString().length == 1 ? "0" : "") + seconds
    }, 1000)
}

// Animate displaying a new note
function displayNote(note){
    let noteTarget = document.getElementById("noteTarget");
    let fadeTimer = 400
    canChangeNote = false

    PlayAnimation(noteTarget, "fadeOut", "0.4", "ease-in-out")
            
    setTimeout(() => {
        noteTarget.style.textShadow = note.isFavorite ? favNoteStyle : 'none'
        noteTarget.innerHTML = note.note;
        PlayAnimation(noteTarget, "fadeIn2", "0.1", "ease-in-out")

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

// Display current note date and index
function displayNoteInfo(){
    // Update info for current note
    let noteDateElm = document.getElementById("noteDate")
    let notePosElm = document.getElementById("notePosition")

    let date = new Date(noteList[currentNoteIndex].readOn)
    let pos = (currentNoteIndex+1) + " / " + (lastReadNoteIndex+1)

    notePosElm.innerHTML = pos
    noteDateElm.innerHTML = (date.getMonth()+1) + " / " + date.getDate() + " / " + date.getFullYear()
}

// Left arrow click
function leftArrowClick(){
    // Display previous note if exists
    if (noteList[currentNoteIndex-1] != undefined){
        currentNoteIndex--

        displayNote(noteList[currentNoteIndex])
        displayNoteInfo()
    }
}

// Left arrow long press
function leftArrowLongPress(){
    // Display first note
    currentNoteIndex = 0
    displayNote(noteList[currentNoteIndex])
    displayNoteInfo()
}

// Right arrow click
function rightArrowClick(){
    console.log(noteList)
    // Check if a new note exists
    if (noteList[currentNoteIndex+1] == undefined){
        return
    }

    // Check if next note has been read already, allowing to see it
    if (noteList[currentNoteIndex+1].read == true){
        currentNoteIndex++
        displayNote(noteList[currentNoteIndex])
        displayNoteInfo()
        return
    }

    // If next note has not been read
    // Check if it has been a day since reading most recently read note
    if (checkDayPassed(currentCode + "newNote") == 0){
        currentNoteIndex++
        lastReadNoteIndex++

        // Show new note
        displayNote(noteList[currentNoteIndex])
        displayNoteInfo()
        // Play sound
        revealAudio.play()


        // Update local note to read
        noteList[currentNoteIndex].read = true
        noteList[currentNoteIndex].readOn = getCurrentDate()
        localStorage.noteList = JSON.stringify(noteList)

        // Update timer
        displayLoadTimer()

        // Play animation on new note revealed
        PlayAnimation(document.getElementById("msgBackgroundEffect"), "fadeInOut", "5", "ease-in-out")
    }
}

// Right arrow long press
function rightArrowLongPress(){
    // Display last read note
    currentNoteIndex = lastReadNoteIndex
    displayNote(noteList[currentNoteIndex])
    displayNoteInfo()
}

// Show hearts on double click and cycle fav notes
function displayImgDblClick(){
    PlayAnimation(document.getElementById("msgBackgroundEffect"), "fadeInOut", "5", "ease-in-out")
    displayFavNote()
}

// Set note as favorite 
function displaySetFavNote(){
    noteList[currentNoteIndex].isFavorite = !noteList[currentNoteIndex].isFavorite == null ? true : !noteList[currentNoteIndex].isFavorite
    localStorage.noteList = JSON.stringify(noteList)

    let noteTarget = document.getElementById("noteTarget");
    noteTarget.style.textShadow = noteList[currentNoteIndex].isFavorite ? favNoteStyle : 'none'
    Toast(noteList[currentNoteIndex].isFavorite ? 'Added to favorites' : 'Removed from favorites', 2)
}

// Display favorite note 
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