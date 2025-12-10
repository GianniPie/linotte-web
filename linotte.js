const dd1 = document.getElementById("dd1")
const dd2 = document.getElementById("dd2")
const dd3 = document.getElementById("dd3")
const dd4 = document.getElementById("dd4")
const dd5 = document.getElementById("dd5")

const wr1 = document.getElementById("wr1")
const wr2 = document.getElementById("wr2")
const wr3 = document.getElementById("wr3")
const wr4 = document.getElementById("wr4")
const wr5 = document.getElementById("wr5")

const rollBtn = document.getElementById("rollBtn")
const doneBtn = document.getElementById("doneBtn")

let rollAnimationID;
let stopRollID;

const face0 = "resources/images/g100.svg";
const face1 = "resources/images/g107.svg";
const face2 = "resources/images/g102.svg";
const face3 = "resources/images/g103.svg";
const face4 = "resources/images/g104.svg";
const face5 = "resources/images/g105.svg";
const face6 = "resources/images/g106.svg";

let faces = [face0, face1, face2, face3, face4, face5, face6];

let numRoll = 3;

function setPos(x,y){
    var floatDiv = document.getElementById("die");
    floatDiv.style.left = x+"px";
    floatDiv.style.top = y+"px";
}



function roll(){
	playerDie.classList.add("shaking");
}



document.querySelectorAll(".piece").forEach(el => {
    el.addEventListener("click", function() {
        let piece = document.getElementById(this.id);
        let wrapper = document.getElementById(this.parentElement.id);

        rndH = (Math.random() * 50)+25;
        rndV = (Math.random() * 50)+25;
        piece.style.backgroundPosition = rndH + "% " + rndV + "%";

        if (piece.classList.contains("img-bounce")) {
            wrapper.classList.add("img-disappear");

            wrapper.addEventListener("animationend", function handler(e) {
                if (e.animationName === "bounceOut") {
                    piece.classList.remove("img-bounce");
                    wrapper.classList.remove("img-disappear");
                    wrapper.removeEventListener("bounceOut", handler);
                }
            });
        } else {
            wrapper.classList.remove("img-disappear");
            piece.classList.add("img-bounce");
        }
    });
});



rollBtn.addEventListener("click", function() {  

    if(numRoll < 1)
    return;

    document.querySelector("#rollBtn .text-button").innerText = "ROLL " + --numRoll;
    rollAnimationID = setInterval(rollAnimation, 100)
    stopRollID = setInterval(stopRoll, 1200)

})


function rollAnimation() {
    const d = 7;
    const e = 10;

    if(!dd1.classList.contains("selected")) {
        dd1.style.backgroundImage = "url('"+ faces[rndNum(1,6)] + "')";
        wr1.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd2.classList.contains("selected")) {
        dd2.style.backgroundImage = "url('"+ faces[rndNum(1,6)] + "')";
        wr2.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd3.classList.contains("selected")) {
        dd3.style.backgroundImage = "url('"+ faces[rndNum(1,6)] + "')";
        wr3.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd4.classList.contains("selected")) {
        dd4.style.backgroundImage = "url('"+ faces[rndNum(1,6)] + "')";
        wr4.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
    if(!dd5.classList.contains("selected")) {
        dd5.style.backgroundImage = "url('"+ faces[rndNum(1,6)] + "')";
        wr5.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    }
} 



function rndNum(numFrom, numTo) {
    var  spanNum = numTo - numFrom + 1;
    var num = Math.floor(Math.random() * spanNum) + numFrom; // numFrom to numTo
    if (num < numFrom) {num = numFrom}
    if (num > numTo) {num = numTo}
    return num;
}



function stopRoll() {
    clearInterval(rollAnimationID);
    clearInterval(stopRollID);
}     



doneBtn.addEventListener("click", function() {    
    wr1.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr2.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr3.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr4.style.transform = 'rotate(0deg) translate(0px,0px)';
    wr5.style.transform = 'rotate(0deg) translate(0px,0px)';

    document.querySelectorAll(".die").forEach(el => {
        el.classList.remove("selected"); // reset
        el.style.backgroundImage = "url('"+ faces[0] + "')";

        document.querySelector("#rollBtn .text-button").innerText = "ROLL 3";
        numRoll = 3;
    });
})



document.querySelectorAll(".die").forEach(el => {
    el.addEventListener("click", function() {
        elem = document.getElementById(this.id);
        
        if(numRoll === 3)
            return;

        if (elem.classList.contains("selected")) {
            elem.classList.remove("selected"); // reset
        } else {
            elem.classList.add("selected");
        }
    });
});








