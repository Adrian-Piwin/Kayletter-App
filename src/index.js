import { InputInit } from './inputpage.js'
import { OutputInit } from './outputpage.js'

var defaultImgSrc = "/flowers/sunflower.gif"

window.addEventListener("load", function(event) {

    var path = window.location.pathname;
    var page = path.split("/").pop();

    let imageElm = document.getElementById("displayImg")
    imageElm.src = defaultImgSrc
    
    if (page == "index.html"){
        InputInit()
    }else if (page == "display.html"){
        OutputInit()
    }

});

