import { dbVarImageURL } from '../staticvariables'

/* ==== MOCK DATABASE ====*/ 

let testNotes = [{
	id: 1,
	note: "This is a test",
	createdOn: Date.now() - 86400000*3,
	readOn: null,
	read: false,
	isFavorite: false
},
{
	id: 2,
	note: "This is a test with some really really long text, well would you look at that.",
	createdOn: Date.now() - 86400000*2,
	readOn: null,
	read: false,
	isFavorite: false
},
{
	id: 3,
	note: "Test",
	createdOn: Date.now() - 86400000,
	readOn: null,
	read: false,
	isFavorite: false
}];

// Return if code exists
export async function dbDoesExist(code){
    return true;
}

// Return list of notes from db 
export async function dbGetNotes(code){
    return testNotes;
}

// Add note to db
export function dbAddNote(code, val){

}

// Add read note to db
export function dbAddReadNote(code, val){

}

// Store a variable associated with this code to db
export function dbSetVariable(code, varName, value){
    
}

// Retrieve a variable associated with this code to db
export async function dbGetVariable(code, varName){
    if (varName == dbVarImageURL)
		return "";

	return "Test";
}

// Update note from db
export function dbUpdateNote(code, noteId, newNote){

}

// Set note as favorite
export function dbFavoriteNote(code, noteId, isFav){
    testNotes.find(o => o.id == noteId).isFavorite == isFav;
}

// Set a note as read
export function dbReadNote(code, noteId, date){

}

// Delete note from db
export function dbDeleteNote(code, val){

}
