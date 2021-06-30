var HOST = location.origin.replace(/^http/, 'ws')
const ws = new WebSocket(HOST);
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext("2d");
let state = "loading";
var scale;
var mouseX = 1;
var mouseY = 1;
var winX = 0;
var winY = 0;
var leftBorder = 0;
var topBorder = 0;
var windowWidth = 0;
var windowHeight = 0;
var mouseMove = false;
var mouseLock = false;

var clickLock = false;

const menuDiv = document.getElementById("menu");
const gameDiv = document.getElementById("game");
const playButton = document.getElementById("playButton");

let waveTime = 0;
let wave = 0;
let inWave = false;

var players = {};
var enemies = {};

let keys = [0, 0, 0, 0, 0];
let lastKeys = [0, 0, 0, 0, 0];

function lerp( start, end, time ) {
	return start * ( 1 - time ) + end * time;
}

class Player{
  constructor(initPack){
    this.x = initPack.x;
    this.y = initPack.y;
    this.middleX = this.x;
    this.middleY = this.y;
    this.serverX = this.x;
    this.serverY = this.y;
    this.name = initPack.name;
    this.id = initPack.id;
    this.radius = 20;
    this.dead = initPack.dead;
  }
  update(dt){
		this.x = lerp(this.x, this.middleX, dt * 27/1000)
		this.y = lerp(this.y, this.middleY, dt * 27/1000)
		this.middleX = lerp(this.middleX, this.serverX, dt * 27/1000)
		this.middleY = lerp(this.middleY, this.serverY, dt * 27/1000)
  }
  updatePack(pack){
    if (pack.x != undefined){
      this.serverX = pack.x;
    }
    if (pack.y != undefined){
      this.serverY = pack.y;
    }
    if (pack.name != undefined){
      this.name = pack.name;
    }
    if (pack.dead != undefined){
      this.dead = pack.dead;
    }
  }
}
class Enemy {
  constructor(initPack){
    this.x = initPack.x;
    this.y = initPack.y;
    this.middleX = this.x;
    this.middleY = this.y;
    this.serverX = this.x;
    this.serverY = this.y;
    this.id = initPack.id;
    this.radius = initPack.radius;
    this.type = initPack.type;
    if (initPack.switchType != undefined){
      this.switchType = initPack.switchType;
    }
  }
  update(dt){
		this.x = lerp(this.x, this.middleX, dt * 42/1000)
		this.y = lerp(this.y, this.middleY, dt * 42/1000)
		this.middleX = lerp(this.middleX, this.serverX, dt * 42/1000)
		this.middleY = lerp(this.middleY, this.serverY, dt * 42/1000)
  }
  updatePack(pack){
    if (pack.x != undefined){
      this.serverX = pack.x;
    }
    if (pack.y != undefined){
      this.serverY = pack.y;
    }
    if (pack.switchType != undefined){
      this.switchType = pack.switchType;
    }
    if (pack.radius != undefined){
      this.radius = pack.radius;
    }
  }
}


ws.onopen = () => {
  state = "game"
  /*
  ws.send(JSON.stringify({
    type: "name",
    name: name
  }))
  */
}
let closeReason = "Disconnected";
ws.onclose = (e) => {
  state = "over";
  if (e.code == 1000){
    closeReason = "Wiped";
  }
}
playButton.onclick = () => {
  ws.send(JSON.stringify({
    type: "name",
    name: document.getElementById("nameBox").value
  }))
}


function resize(){ 
  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;
  scale = window.innerWidth/canvas.width;
  if(window.innerHeight/canvas.height < window.innerWidth/canvas.width){
    scale = window.innerHeight/canvas.height;
  }
  leftBorder = windowWidth-canvas.width/2;
  topBorder = windowHeight-canvas.height/2;
  canvas.style.transform ="scale(" + scale +")";
  canvas.style.left = 1/2 * (windowWidth-canvas.width) + "px";
  canvas.style.top = 1/2 * (windowHeight-canvas.height) +"px";
  ctx.fillStyle = "rgb(255,0,0)"
}
window.onload = function(){
window.addEventListener("resize",resize)
canvas.addEventListener('mousemove', e => {
  mouseX = Math.round(e.pageX/scale - leftBorder/scale);
  mouseY = Math.round(e.pageY/scale - topBorder/scale);
  if (mouseMove){
    ws.send(JSON.stringify({
      type: "mouse",
      mouse: [mouseX, mouseY]
    }))
  }
});
canvas.addEventListener('mousedown', e => {
  if (clickLock === false){
  clicked = true;
  clickLock = true;
  }
  if (!mouseLock){
  mouseMove = !mouseMove;
  mouseLock = true;
  ws.send(JSON.stringify({
    type: "mouseMove",
    move: mouseMove
  }))
  if (mouseMove == true){
    ws.send(JSON.stringify({
      type: "mouse",
      mouse: [mouseX, mouseY]
    }))
  }
  }

});
canvas.addEventListener('mouseup', e => {
  clicked = false;
  mouseLock = false;
  clickLock = false;
});

resize();
}
resize();

function getBorders(){
    let stuff = windowHeight/windowWidth;

  let realWindowWidth = windowWidth;
  let realWindowHeight = windowHeight;
  if (stuff > 9/16){
    realWindowHeight = windowWidth * 9/16;
  }
  if (stuff < 9/16){
    realWindowWidth = windowHeight * 16/9;
  }

  let changeX = Math.abs(realWindowWidth - windowWidth);
  let changeY = Math.abs(realWindowHeight - windowHeight);

  leftBorder = changeX/2;
  topBorder = changeY/2;
}



let lastTime = window.performance.now();
function update(){
  let delta = window.performance.now() - lastTime;
  lastTime = window.performance.now();
  getBorders();

  ctx.textAlign = "center";
  switch(state){
    case "loading": {
      ctx.clearRect(0, 0, 1600, 900);
      ctx.fillStyle = "rgb(0, 0, 0)"
      ctx.fillRect(0, 0, 1600, 900);
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.font = "100px 'Exo 2'";
      ctx.fillText("Loading...", 800, 450);
      break;
    }
    case "game": {
      ctx.fillStyle = "rgba(200, 200, 200, 0.7)"
      ctx.fillRect(0, 0, 1600, 900);
      ctx.font = "30px 'Exo 2'"
      ctx.fillStyle = 'rgb(0, 0, 0)';
      if (inWave){
      ctx.fillText("Wave "+wave, 800, 50);
      ctx.fillText("Time Remaining: "+waveTime+"s", 800, 850);
      }
      else{
      ctx.fillText(`Wave ${wave + 1} starts in: `+waveTime+"s", 800, 850);
      }
      for(let i of Object.keys(players)){
        players[i].update(delta);
        const player = players[i];
        if (player.dead == true){
          ctx.fillStyle = "rgb(255, 0, 0)"
        }
        else{
          ctx.fillStyle = "rgb(0, 0, 0)";
        }
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(player.name, player.x, player.y - 30)
      
      }
      for(let i of Object.keys(enemies)){
        const enemy = enemies[i];
        enemy.update(delta);
        if (enemy.type == "normal"){
          ctx.fillStyle = "rgb(100, 100, 100)"
        }
        if (enemy.type == "dasher"){
          ctx.fillStyle = "rgb(70, 70, 220)"
        }
        if (enemy.type == "border"){
          ctx.fillStyle = "rgb(0, 0, 0)";
        }
        if (enemy.type == "switch"){
          ctx.fillStyle = "rgb(50, 50, 50)";
          if (enemy.switchType == false){
            ctx.globalAlpha = 0.3;
          }
        }
        if (enemy.type == "icicle"){
          ctx.fillStyle = "#287075";
        }
        if (enemy.type == "liquid"){
          ctx.fillStyle = "#1e6fa6";
        }
        if (enemy.type == "sizing"){
          ctx.fillStyle = "#eda13e";
        }
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        if (enemy.type == "switch"){
          ctx.globalAlpha = 1;
        }
      }
      if (JSON.stringify(lastKeys) != JSON.stringify(keys)){
        ws.send(JSON.stringify({
          type: "keys",
          keys: keys
        }))
      }
      break;
    }
    case "over": {
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = "rgb(0, 0, 0)";
      ctx.fillRect(0, 0, 1600, 900);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgb(255, 255, 255)";
      ctx.font = "150px 'Exo 2'";
      ctx.fillText(closeReason, 800, 300);
      ctx.font = "60px 'Exo 2'";
      ctx.fillText("Wave Achieved: "+wave, 800, 600);
      ctx.fillText("Reload to Try Again", 800, 800);
      break;
    }
  }
  requestAnimationFrame(update);
}
requestAnimationFrame(update);

ws.addEventListener("message", ( datas ) => {
  const msg = JSON.parse(datas.data);
  if (msg.type == "init"){
    menuDiv.style.display = "none";
    gameDiv.style.display = "";
    for(let i of msg.pack){
      players[i.id] = new Player(i);
    }
    for(let i of msg.enemyPack){
      enemies[i.id] = new Enemy(i);
    }
    waveTime = msg.waveTime;
    wave = msg.wave;
    inWave = msg.inWave;
  }
  else if (msg.type == "leave"){
    delete players[msg.id];
  }
  else if (msg.type == "time"){
    waveTime = msg.waveTime;
    wave = msg.wave;
    inWave = msg.inWave;
  }
  else if (msg.type == "waveOver"){
    enemies = {};
  }
  else if (msg.type == "newEnemy"){
    for(let i of msg.pack){
      enemies[i.id] = new Enemy(i);
    }
  }
  else if (msg.type == "join"){
    players[msg.pack.id] = new Player(msg.pack);
  }
  else if (msg.type == "update"){
    for(let i of msg.pack){
      players[i.id].updatePack(i);
    }
    for(let i of msg.enemyPack){
      enemies[i.id].updatePack(i);
    }
  }
});

document.onkeydown = function(e){
  if (!e.repeat){
    if (e.key == "ArrowUp" || e.key.toLowerCase() == "w"){
      keys[0] = true;
    }
    if (e.key == "ArrowLeft" || e.key.toLowerCase() == "a"){
      keys[1] = true;
    }
    if (e.key == "ArrowDown" || e.key.toLowerCase() == "s"){
      keys[2] = true;
    }
    if (e.key == "ArrowRight" || e.key.toLowerCase() == "d"){
      keys[3] = true;
    }
    if (e.key == "Shift"){
      keys[4] = true;
    }

  }
}
document.onkeyup = function(e){
    if (e.key == "ArrowUp" || e.key.toLowerCase() == "w"){
      keys[0] = false;
    }
    if (e.key == "ArrowLeft" || e.key.toLowerCase() == "a"){
      keys[1] = false;
    }
    if (e.key == "ArrowDown" || e.key.toLowerCase() == "s"){
      keys[2] = false;
    }
    if (e.key == "ArrowRight" || e.key.toLowerCase() == "d"){
      keys[3] = false;
    }
    if (e.key == "Shift"){
      keys[4] = false;
    }
}