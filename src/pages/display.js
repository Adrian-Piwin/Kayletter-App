import { dbGetNotes, dbGetVariable, dbReadNote, dbFavoriteNote, dbDoesExist } from '../services/database'
import { PlayAnimation, Toast, getCurrentDate, checkDayPassed } from '../utility'
import { dbVarImageURL, dbVarPageTitle, revealAudio, defaultImgSrc } from '../staticvariables'
import { FlowerCanvas } from '../p5-flower'

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
var didDoubleClick = false
var canChangeNote = true

export function OutputInit(){
    let imageElm = document.getElementById("displayImg");
    imageElm.src = defaultImgSrc;
    
    let leftArrow = document.getElementById("leftArrow")
    let rightArrow = document.getElementById("rightArrow")
    let displayImg = document.getElementById("displayImg")
    let noteTarget = document.getElementById("noteTarget")

    // Left arrow click vs dblclick detection
    leftArrow.addEventListener('click', () => {
        if (!canChangeNote) return;

        if (clickTimer == null){
            clickTimer = new Date().getTime();
            setTimeout(() => {
                if (!didDoubleClick)
                    leftArrowClick()
                else
                    leftArrowDblClick()
                
                didDoubleClick = false
                clickTimer = null
            }, 300)
        }else if(new Date().getTime() - clickTimer < 300){
            didDoubleClick = true
        }
    })

    // Right arrow click vs long press detection
    rightArrow.addEventListener('click', () => {
        if (!canChangeNote) return;

        if (clickTimer == null){
            clickTimer = new Date().getTime();
            setTimeout(() => {
                if (!didDoubleClick)
                    rightArrowClick()
                else
                    rightArrowDblClick()
                
                didDoubleClick = false
                clickTimer = null
            }, 300)
        }else if(new Date().getTime() - clickTimer < 300){
            didDoubleClick = true
        }
    })

    // Image double click
    displayImg.addEventListener('dblclick', displayImgDblClick)

    // Note double click
    noteTarget.addEventListener('dblclick', displaySetFavNote)

    // Get display id from URL
    let params = location.search
    params = new URLSearchParams(params);
    params = params.get('displayId')

    if (params == undefined){
        Toast("Page does not exist", 2)
    }else{
        // Attempt load of display id
        loadData(params)
    }
}

// Decide where to load data from
async function loadData(code){
    if (!await loadDatabaseData(code))
        return

    // Load page
    animationLoad();
    displayLoadAttributes()
    displayLoadNotes()
    displayLoadTimer()
}

// Loads data from database or local storage
async function loadDatabaseData(code){
    if (!await dbDoesExist(code)) return false

    noteList = await dbGetNotes(code)
    displayTitle = await dbGetVariable(code, dbVarPageTitle)
    displayImage = await dbGetVariable(code, dbVarImageURL)
    currentCode = code
    
    return true
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
    console.log(displayImage)

    if (displayImage != null && displayImage != ""){
        let imageElm = document.getElementById("displayImg")

        if (displayImage == "special"){
            imageElm.style.display = "none";
            FlowerCanvas()
        }else
            imageElm.src = displayImage
    }
}

// Fade elements in
function animationLoad(){
    PlayAnimation(document.getElementById("displayImg"), "fadeIn2", 2, "ease-in-out")
    PlayAnimation(document.getElementById("displayTitle"), "fadeIn2", 3, "ease-in-out")
    PlayAnimation(document.getElementById("liveTimer"), "fadeIn2", 5, "ease-in-out")
    PlayAnimation(document.getElementById("msgContainer"), "fadeIn2", 3, "ease-in-out")
}

// Load the timer for new note countdown
function displayLoadTimer(){
    let timerElm = document.getElementById("liveTimer");

    // Don't display timer if there is no new note
    if (noteList[lastReadNoteIndex+1] == undefined){
        timerElm.innerHTML = "&#x200B;"
        return
    }

    // Check if day has passed and if a new note is available
    if (checkDayPassed(noteList[lastReadNoteIndex].readOn) <= 0){
        if (noteList[lastReadNoteIndex+1] != undefined && !noteList[lastReadNoteIndex+1].read){
            timerElm.innerHTML = "New note available"
            return
        }else
            return
    }

    let timeleft = checkDayPassed(noteList[lastReadNoteIndex].readOn)
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
function displayNote(note) {
    let noteTarget = document.getElementById("noteTarget");
    let fadeTimer = 400;
    canChangeNote = false;

    PlayAnimation(noteTarget, "fadeOut", "0.4", "ease-in-out");

    setTimeout(() => {
        noteTarget.style.textShadow = note.isFavorite ? favNoteStyle : 'none';

        // Split text into words and wrap each word
        const words = note.note.split(' ').map(word =>
            `<span class="word">${[...word].map(letter => `<span class='letter'>${letter}</span>`).join('')}</span>`
        ).join(' ');

        noteTarget.innerHTML = words;

        PlayAnimation(noteTarget, "fadeIn2", "0.1", "ease-in-out");

        anime.timeline({ loop: false })
            .add({
                targets: '.ml6 .letter',
                translateY: ["1.1em", 0],
                translateZ: 0,
                duration: 750,
                opacity: [0, 1],
                delay: (el, i) => 50 * i
            });

        canChangeNote = true;
    }, fadeTimer);
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
function leftArrowDblClick(){
    // Display first note
    currentNoteIndex = 0
    displayNote(noteList[currentNoteIndex])
    displayNoteInfo()
}

// Right arrow click
function rightArrowClick(){
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
    if (checkDayPassed(noteList[lastReadNoteIndex].readOn) <= 0){
        currentNoteIndex++
        lastReadNoteIndex++

        // Update local storage list
        noteList[currentNoteIndex].read = true
        noteList[currentNoteIndex].readOn = getCurrentDate()
        dbReadNote(currentCode, noteList[currentNoteIndex].id, noteList[currentNoteIndex].readOn)

        // Show new note
        displayNote(noteList[currentNoteIndex])
        displayNoteInfo()
        // Play sound
        revealAudio.play()

        // Update timer
        displayLoadTimer()

        // Play animation on new note revealed
        PlayAnimation(document.getElementById("msgBackgroundEffect"), "fadeInOut", "5", "ease-in-out")
    }
}

// Right arrow long press
function rightArrowDblClick(){
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
    dbFavoriteNote(currentCode, noteList[currentNoteIndex].id, noteList[currentNoteIndex].isFavorite)

    let noteTarget = document.getElementById("noteTarget");
    noteTarget.style.textShadow = noteList[currentNoteIndex].isFavorite ? favNoteStyle : 'none'
    Toast(noteList[currentNoteIndex].isFavorite ? 'Added to favorites' : 'Removed from favorites', 2)
}

// Display favorite notes
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
