const dd1 = document.getElementById("dd1")
const dd2 = document.getElementById("dd2")
const dd3 = document.getElementById("dd3")
const dd4 = document.getElementById("dd4")
const dd5 = document.getElementById("dd5")

const rollBtn = document.getElementById("rollBtn")
const doneBtn = document.getElementById("doneBtn")

const piece_a1  = document.getElementById("piece_a1");
const piece_a2  = document.getElementById("piece_a2");
const piece_a3  = document.getElementById("piece_a3");
const piece_a4  = document.getElementById("piece_a4");
const piece_a5  = document.getElementById("piece_a5");
const piece_b1  = document.getElementById("piece_b1");
const piece_b2  = document.getElementById("piece_b2");
const piece_b3  = document.getElementById("piece_b3");
const piece_b4  = document.getElementById("piece_b4");
const piece_b5  = document.getElementById("piece_b5");
const piece_c1  = document.getElementById("piece_c1");
const piece_c2  = document.getElementById("piece_c2");
const piece_c3  = document.getElementById("piece_c3");
const piece_c4  = document.getElementById("piece_c4");
const piece_c5  = document.getElementById("piece_c5");
const piece_d1  = document.getElementById("piece_d1");
const piece_d2  = document.getElementById("piece_d2");
const piece_d3  = document.getElementById("piece_d3");
const piece_d4  = document.getElementById("piece_d4");
const piece_d5  = document.getElementById("piece_d5");
const piece_e1  = document.getElementById("piece_e1");
const piece_e2  = document.getElementById("piece_e2");
const piece_e3  = document.getElementById("piece_e3");
const piece_e4  = document.getElementById("piece_e4");
const piece_e5  = document.getElementById("piece_e5");

let pices = [piece_a1, piece_a2, piece_a3, piece_a4, piece_a5, piece_b1, piece_b2, piece_b3, piece_b4, piece_b5, piece_c1, piece_c2, piece_c3, piece_c4, piece_c5, piece_d1, piece_d2, piece_d3, piece_d4, piece_d5, piece_e1, piece_e2, piece_e3, piece_e4, piece_e5];

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
        elem = document.getElementById(this.id);
        
        rndH = (Math.random() * 40)+30;
        rndV = (Math.random() * 40)+30;
        elem.style.backgroundPosition = rndH + "% " + rndV + "%";


        if (elem.classList.contains("img-bounce")) {
            elem.classList.remove("img-bounce"); // reset
        } else {
            elem.classList.add("img-bounce");
        }

    });
});




rollBtn.addEventListener("click", function() {    
    rollAnimationID = setInterval(rollAnimation, 100)
    stopRollID = setInterval(stopRoll, 1200)
})


function rollAnimation() {
    var rndNum1 = Math.floor(Math.random() * 4) + 1;
    var rndNum2 = Math.floor(Math.random() * 4) + 1;
    var rndNum3 = Math.floor(Math.random() * 4) + 1;
    var rndNum4 = Math.floor(Math.random() * 4) + 1;
    var rndNum5 = Math.floor(Math.random() * 4) + 1;

    var rndDeg1 = Math.floor(Math.random() * 20) - 10;
    var rndDeg2 = Math.floor(Math.random() * 20) - 10;
    var rndDeg3 = Math.floor(Math.random() * 20) - 10;
    var rndDeg4 = Math.floor(Math.random() * 20) - 10;
    var rndDeg5 = Math.floor(Math.random() * 20) - 10;

    dd1.style.webkitTransform = 'rotate(' + rndDeg1 + 'deg)' + 'translate('+ rndNum1 * 2 + 'px,' + -rndNum1 * 2 + 'px)';
    dd2.style.webkitTransform = 'rotate(' + rndDeg2 + 'deg)' + 'translate('+ rndNum2 * 2 + 'px,' + -rndNum2 * 2 + 'px)';
    dd3.style.webkitTransform = 'rotate(' + rndDeg3 + 'deg)' + 'translate('+ rndNum3 * 2 + 'px,' + -rndNum3 * 2 + 'px)';
    dd4.style.webkitTransform = 'rotate(' + rndDeg4 + 'deg)' + 'translate('+ rndNum4 * 2 + 'px,' + -rndNum4 * 2 + 'px)';
    dd5.style.webkitTransform = 'rotate(' + rndDeg5 + 'deg)' + 'translate('+ rndNum5 * 2 + 'px,' + -rndNum5 * 2 + 'px)';

    var rndRes1 = Math.floor(Math.random() * 6) + 1;
    var rndRes2 = Math.floor(Math.random() * 6) + 1;
    var rndRes3 = Math.floor(Math.random() * 6) + 1;
    var rndRes4 = Math.floor(Math.random() * 6) + 1;
    var rndRes5 = Math.floor(Math.random() * 6) + 1;

    dd1.style.backgroundImage = "url('"+ faces[rndRes1] + "')";
    dd2.style.backgroundImage = "url('"+ faces[rndRes2] + "')";
    dd3.style.backgroundImage = "url('"+ faces[rndRes3] + "')";
    dd4.style.backgroundImage = "url('"+ faces[rndRes4] + "')";
    dd5.style.backgroundImage = "url('"+ faces[rndRes5] + "')";
} 



function changeBackground() {
  const div = document.getElementById("myDiv");
  div.style.backgroundImage = "url('https://via.placeholder.com/200/ff0000')"; // nuova immagine
}


function stopRoll() {
    clearInterval(rollAnimationID);
    clearInterval(stopRollID);
}     




doneBtn.addEventListener("click", function() {    

    dd1.style.webkitTransform = 'rotate(0deg) translate(0px,0px)';
    dd2.style.webkitTransform = 'rotate(0deg) translate(0px,0px)';
    dd3.style.webkitTransform = 'rotate(0deg) translate(0px,0px)';
    dd4.style.webkitTransform = 'rotate(0deg) translate(0px,0px)';
    dd5.style.webkitTransform = 'rotate(0deg) translate(0px,0px)';
})











