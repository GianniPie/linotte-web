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

const face0 = "";
const face1 = "https://cdn.prod.website-files.com/692d60554543f993a2e48990/692db68a59e44dfdb6cc3dd5_Asset%2011.png";
const face2 = "https://cdn.prod.website-files.com/692d60554543f993a2e48990/692db68a92617b743b2f46bf_Asset%2012.png";
const face3 = "https://cdn.prod.website-files.com/692d60554543f993a2e48990/692db68a233fa935eab3232a_Asset%2013.png";
const face4 = "https://cdn.prod.website-files.com/692d60554543f993a2e48990/692db68acc315641d0266221_Asset%2014.png";
const face5 = "https://cdn.prod.website-files.com/692d60554543f993a2e48990/692db68ab44a4f55b05cade1_Asset%2010.png";
const face6 = "https://cdn.prod.website-files.com/692d60554543f993a2e48990/692db68bf158290c2d161e57_Asset%209.png";

let faces = [face0, face1, face2, face3, face4, face5, face6];


function setPos(x,y){
    var floatDiv = document.getElementById("die");
    floatDiv.style.left = x+"px";
    floatDiv.style.top = y+"px";
}
  

var interval;

function random(){
  clearInterval(interval);
  var len = [5,3,1];
  var pos = 0;
  
  interval = setInterval(function(){
    var length = len[pos];
    pos++;
    var deg = Math.random() * 360 * 0.01745;
    var xto = Math.cos(deg) * length + 100;
    var yto = Math.sin(deg) * length + 100;
    setPos(xto,yto);
    if(pos==len.length) clearInterval(interval);
  },30);
}


function roll(){
	playerDie.classList.add("shaking");
}



document.querySelectorAll(".piece").forEach(el => {
    el.addEventListener("click", function() {
        let elem = document.getElementById(this.id);
        
        rndH = (Math.random() * 50)+25;
        rndV = (Math.random() * 50)+25;
        elem.style.backgroundPosition = rndH + "% " + rndV + "%";

        if (elem.classList.contains("img-bounce")) {

            elem.classList.remove("img-bounce"); // reset
            document.getElementById(this.parentElement.id).classList.add("img-disappear");
        } else {
            elem.classList.add("img-bounce");
            document.getElementById(this.parentElement.id).classList.remove("img-disappear");
        }
    });
});




rollBtn.addEventListener("click", function() {    
    rollAnimationID = setInterval(rollAnimation, 100)
    stopRollID = setInterval(stopRoll, 1200)
})


function rollAnimation() {
    const d = 6;
    const e = 10;


    wr1.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    wr2.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    wr3.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    wr4.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';
    wr5.style.transform = 'rotate(' + rndNum(-e,e) + 'deg)' + 'translate('+ rndNum(-d,d) + 'px,' + rndNum(-d,d) + 'px)';

    dd1.style.backgroundImage = "url('"+ faces[rndNum(1,6)] + "')";
    dd2.style.backgroundImage = "url('"+ faces[rndNum(1,6)] + "')";
    dd3.style.backgroundImage = "url('"+ faces[rndNum(1,6)] + "')";
    dd4.style.backgroundImage = "url('"+ faces[rndNum(1,6)] + "')";
    dd5.style.backgroundImage = "url('"+ faces[rndNum(1,6)] + "')";
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
//non va
    document.querySelectorAll(".die").forEach(el => {
        el.classList.remove("selected");
    });
}     



doneBtn.addEventListener("click", function() {    

    dd1.style.webkitTransform = 'rotate(0deg) translate(0px,0px)';
    dd2.style.webkitTransform = 'rotate(0deg) translate(0px,0px)';
    dd3.style.webkitTransform = 'rotate(0deg) translate(0px,0px)';
    dd4.style.webkitTransform = 'rotate(0deg) translate(0px,0px)';
    dd5.style.webkitTransform = 'rotate(0deg) translate(0px,0px)';
})



document.querySelectorAll(".die").forEach(el => {
    el.addEventListener("click", function() {
        elem = document.getElementById(this.id);
        
        if (elem.classList.contains("selected")) {
            elem.classList.remove("selected"); // reset
        } else {
            elem.classList.add("selected");
        }
    });
});








