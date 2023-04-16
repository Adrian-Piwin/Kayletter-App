/* ==== UTILITY OBJECT ====*/ 

var toastTimeoutId = null;

// Play animation
export function PlayAnimation(element, animName, time, animSetting=''){
    element.style.animation = '';
    element.offsetWidth;
    element.style.animation = animName + ' ' + ( animSetting == '' ? '' : (animSetting + ' ')) + time + 's';
    element.style.animationFillMode = "forwards"
}

export function Toast(str, timeToShow){
    var snackbarElm = document.getElementById("snackbar");

    clearTimeout(toastTimeoutId);
    snackbarElm.innerHTML = str;
    PlayAnimation(snackbarElm, 'fadein 0.5s, fadeout 0.5s', timeToShow-0.5);
    snackbarElm.style.visibility = 'visible';

    toastTimeoutId = setTimeout(() => 
    {
        snackbarElm.style.visibility = 'hidden';
    }, timeToShow * 1000);
}

// Make random string
export function createRandomStr(length) {
    let result           = '';
    let characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for ( let i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * 
        charactersLength));
    }
    return result;
}

// Return list of notes in note container
export function getCurrentNotes(){
    let noteContainer = document.getElementById("noteContainer");
    let noteList = []
    for (let i = 0; i < noteContainer.children.length; i++){
        noteList.push(noteContainer.children[i].innerHTML)
    }
    return noteList
}

// Return the UTC date
export function getCurrentDate(){
    return Date.now()
}

// Given a date, return time left till a day has passed
export function checkDayPassed(date){
    // Add day to original time
    date += 86400000

    // Subtract from todays date
    return date - Date.now()
}

// Clear notes on page
export function clearNotes(){
    let noteContainer = document.getElementById("noteContainer");
    for (let i = 0; i < noteContainer.children.length; i++){
        noteContainer.children[i].value = ''
    }
}
