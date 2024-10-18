import { InputInit } from './inputpage.js'
import { OutputInit } from './outputpage.js'
import { defaultImgSrc } from './staticvariables.js'
import { FlowerCanvas } from './p5-flower.js';

window.addEventListener("load", function(event) {

    var path = window.location.pathname;
    var page = path.split("/").pop();

    let imageElm = document.getElementById("displayImg")
    imageElm.src = defaultImgSrc
    
    if (page == "display.html"){
        OutputInit()
    }else{
        InputInit()
    }

});

