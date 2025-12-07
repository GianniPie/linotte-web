const playerDie = document.getElementById("dieId")
const rollBtn = document.getElementById("rollBtn")
const doneBtn = document.getElementById("doneBtn")
const p_a1 = document.getElementById("p_a1")


let rollAnimationID
let stopRollID



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



p_a1.addEventListener("click", function() {    
	put();
})


function put() {
  const elem = document.getElementById("p_a1");

  elem.style.top = (Math.random() * 40)+30;
  elem.style.left = (Math.random() * 40)+30;

  if (elem.classList.contains("img-bounce")) {
  	elem.classList.remove("img-bounce"); // reset
  } else {
  	elem.classList.add("img-bounce");
  }
}


rollBtn.addEventListener("click", function() {    
    //rollBtn.disabled = true
    rollAnimationID = setInterval(rollAnimation, 100)
    stopRollID = setInterval(stopRoll, 1200)
})


function rollAnimation() {
    
    var randomNumber = Math.floor(Math.random() * 6) + 1
    var randomDeg = Math.floor(Math.random() * 21) - 10

    playerDie.style.webkitTransform = 
        'rotate(' + randomDeg + 'deg)' + 
        'translate('+ randomNumber*2 + 'px,' + -randomNumber*2 + 'px)'
    playerDie.style.backgroundPositionX = -randomNumber *100 + 'px'
} 



function stopRoll() {
    clearInterval(rollAnimationID);
    clearInterval(stopRollID);

    const randomNumber = Math.floor(Math.random() * 6) + 1

    playerDie.style.backgroundPositionX = -randomNumber *100 + 'px'
    playerDie.classList.add("shaking")
    playerDie.classList.remove("shaking")
}     











