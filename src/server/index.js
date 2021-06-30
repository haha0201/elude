/*
const fs = require("fs")
fs.unlink("index.js", ()=>{})
*/
/*
shift ctrl S in console
*/
console.log("Server Setup")
const express = require('express');
const WebSocket = require('ws');
const uuid = require("uuid");
const path = require("path");
const app = express();
const wss = new WebSocket.Server({
  noServer: true
});
let players = {};
let enemies = {};
let wave = 0;
let waveTime = 15;
let lastWaveTime = 15;
let inWave = false;
let id = 0;

function createId() {
  id++;
  return id;
}

const nano = function() {
  const hrtime = process.hrtime();
  return +hrtime[0] * 1e9 + +hrtime[1];
};
const ms = () => nano() * (1 / 1e9) * 1000;


app.use(express.static("src/public"));

app.get("/", function(req, res) {
  res.sendFile("index.html");
});

class Player {
  constructor(id, ws) {
    this.id = id;
    this.x = 800;
    this.y = 450;
    this.radius = 20;
    this.lastName = "";
    this.name = "";
    this.dead = false;
    this.lastDead = false;
    this.ws = ws;
    this.input = [false, false, false, false, false];
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseMove = false;
  }
  update(dt) {
    if (this.name.length > 16) {
      this.name = this.name.substring(0, 16);
    }
    let speed = 500 / 1000;
    if (this.input[4] == true) {
      speed = 250 / 1000;
    }
    if (this.dead){
      speed = 0;
      for(let i of Object.keys(players)){
        const player = players[i];
        if (!player.dead){
          let dist = Math.sqrt(Math.pow(player.x - this.x, 2) + Math.pow(player.y - this.y, 2));
          if (dist < player.radius + this.radius) {
            this.dead = false;
          }
        }
      }
    }
    if (this.mouseMove == false){
    if (this.input[0] == true) {
      this.y -= speed * dt;
    }
    if (this.input[1] == true) {
      this.x -= speed * dt;
    }
    if (this.input[2] == true) {
      this.y += speed * dt;
    }
    if (this.input[3] == true) {
      this.x += speed * dt;
    }
    }
    else{
      let moveAngle = Math.atan2(this.mouseY - this.y, this.mouseX - this.x);
      let dist = Math.sqrt(Math.pow(this.mouseX - this.x, 2) + Math.pow(this.mouseY - this.y, 2));
      if (dist > 50){
        dist = 50;
      }
      this.x += speed * Math.cos(moveAngle) * dt * dist/50;
      this.y += speed * Math.sin(moveAngle) * dt * dist/50;
    }
    if (this.x < this.radius) {
      this.x = this.radius;
    }
    if (this.y < this.radius) {
      this.y = this.radius;
    }
    if (this.x > 1600 - this.radius) {
      this.x = 1600 - this.radius;
    }
    if (this.y > 900 - this.radius) {
      this.y = 900 - this.radius;
    }
  }
  getUpdatePack() {
    const pack = {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y)
    }
    if (this.lastName != this.name) {
      this.lastName = this.name;
      pack.name = this.name;
    }
    if (this.lastDead != this.dead){
      this.lastDead = this.dead;
      pack.dead = this.dead;
    }
    return pack;
  }
  getInitPack() {
    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      id: this.id,
      name: this.name,
      dead: this.dead
    }
  }
  static getAllInitPack(players) {
    let pack = [];
    for (let i of Object.keys(players)) {
      pack.push(players[i].getInitPack());
    }
    return pack;
  }
}

let enemyInitPacks = [];

class Enemy {
  constructor(id, speed, radius, type) {
    this.type = type;
    let rand = Math.random();
    if (rand < 0.25){
      this.x = 0;
      this.y = Math.random() * 900;
      if (this.type == "icicle"){
        this.xv = speed / 1000;
        this.yv = speed / 1000;
      }
    }
    else if (rand <= 0.5){
      this.x = 1600;
      this.y = Math.random() * 900;
      if (this.type == "icicle"){
        this.xv = speed / 1000;
        this.yv = -speed / 1000;
      }
    }
    else if (rand <= 0.75){
      this.y = 0;
      this.x = Math.random() * 1600;
      if (this.type == "icicle"){
        this.yv = -speed / 1000;
        this.xv = speed / 1000;
      }
    }
    else{
      this.y = 900;
      this.x = Math.random() * 1600;
      if (this.type == "icicle"){
        this.yv = -speed / 1000;
        this.xv = -speed / 1000;
      }
    }
    if (this.type == "border"){
      this.x = 0;
      this.y = 0;
      this.path = 0;
    }
    if (this.type == "switch"){
      if (Math.random() < 0.5){
        this.switchType = true;
      }
      else{
        this.switchType = false;
      }
      this.lastSwitchType = this.switchType;
      this.switchTimer = 3000;
    }
    if (this.type != "icicle"){
      this.id = id;
      speed /= 1000;
      this.angle = Math.random() * 6.28318530718;
      this.xv = Math.cos(this.angle) * speed;
      this.yv = Math.sin(this.angle) * speed;
    }
    else{
      this.id = id;
      this.noMoveTime = Math.random() * 4000;
    }
    this.speed = speed;
    this.radius = radius
    this.lastRadius = this.radius;
    this.baseRadius = this.radius;
    this.radiusCooldown = 1500;
    this.radiusChange = true;
    enemyInitPacks.push(this.getInitPack());
  }
  update(dt) {
    if (this.type == "switch"){
      this.switchTimer -= dt;
      if (this.switchTimer < 0){
        this.switchType = !this.switchType;
        this.switchTimer = 3000;
      }
    }
    if (this.type == "sizing"){
      this.radiusCooldown -= dt;
      if (this.radiusCooldown <= 0){
        this.radiusChange = !this.radiusChange;
        this.radiusCooldown = 1500;
        if (this.radiusChange == true){
          this.radius = this.baseRadius;
        }
      }
      if (this.radiusChange){
        this.radius += this.baseRadius/1000 * dt;
      }
      else{
        this.radius -= this.baseRadius/1000 * dt;
      }
    }
    if (this.type == "border"){
      if (this.path == 0){
        this.x += this.speed * dt;
      }
      if (this.path == 1){
        this.y += this.speed * dt;
      }
      if (this.path == 2){
        this.x -= this.speed * dt;
      }
      if (this.path == 3){
        this.y -= this.speed * dt;
      }
      if (this.x > 1600 - this.radius){
        this.path = 1;
        this.x = 1600 - this.radius;
      }
      if (this.y > 900 - this.radius){
        this.path = 2;
        this.y = 900 - this.radius;
      }
      if (this.x < this.radius){
        this.x = this.radius;
        this.path = 3;
      }
      if (this.y < this.radius){
        this.y = this.radius;
        this.path = 0;
      }
    }
    else{
    if (this.type == "normal" || this.type == "switch" | this.type == "liquid" || this.type == "sizing"){
    this.x += this.xv * dt;
    this.y += this.yv * dt;
    }
    else if (this.type == "icicle"){
      this.noMoveTime -= dt;
      if (this.noMoveTime < 0){
        this.x += this.xv * dt;
        this.y += this.yv * dt;
      }
    }
    else if (this.type == "dasher"){
      this.x += this.xv * dt * (Math.sin(Date.now()/900) + 1)
      this.y += this.yv * dt * (Math.sin(Date.now()/900) + 1)
    }
    if (this.x < this.radius) {
      this.x = this.radius;
      this.xv *= -1;
      this.noMoveTime = 500 + Math.random() * 800;
    }
    if (this.y < this.radius) {
      this.y = this.radius;
      this.yv *= -1;
      this.noMoveTime = 500 + Math.random() * 800;
    }
    if (this.x > 1600 - this.radius) {
      this.x = 1600 - this.radius;
      this.xv *= -1;
      this.noMoveTime = 500 + Math.random() * 800;
    }
    if (this.y > 900 - this.radius) {
      this.y = 900 - this.radius;
      this.yv *= -1;
      this.noMoveTime = 500 + Math.random() * 800;
    }
    }
    let killer = true;
    if (this.switchType != undefined){
      if (this.switchType == false){
        killer = false;
      }
    }
    if (this.type == "liquid"){
      this.alreadyMoved = false;
    }
    if (killer){
    for (let i of Object.keys(players)) {
      const player = players[i];
      let dist = Math.sqrt(Math.pow(player.x - this.x, 2) + Math.pow(player.y - this.y, 2));
      if (dist < player.radius + this.radius) {
        player.dead = true;
      }
      if (this.type == "liquid" && this.alreadyMoved == false){
        if (dist < player.radius + this.radius + 170 && player.dead == false){
          this.x += this.xv * dt * 4;
          this.y += this.yv * dt * 4;
          this.alreadyMoved = true;
        }
      }
    }
    }

  }
  getInitPack() {
    let pack = {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      radius: this.radius,
      type: this.type
    }
    if (this.switchType != undefined){
      pack.switchType = this.switchType;
    }
    return pack;
  }
  getUpdatePack() {
    let pack = {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y)
    }
    if (this.switchType != this.lastSwitchType){
      this.lastSwitchType = this.switchType;
      pack.switchType = this.switchType;
    }
    if (this.lastRadius != this.radius){
      this.lastRadius = this.radius;
      pack.radius = Math.trunc(this.radius);
    }
    return pack;
  }
  static getAllInitPack(enemies) {
    let pack = [];
    for (let i of Object.keys(enemies)) {
      pack.push(enemies[i].getInitPack());
    }
    return pack;
  }

}


/*
let enemyId = createId();

for(let enemyC = 0; enemyC < 10; enemyC++){
  enemyId = createId();
  enemies[enemyId] = new Enemy(enemyId, 500, 30);
}
*/

function spawnEnemy(type, count, size, speed){
  for(let e = 0; e < count; e++){
    let enemyId = createId();
    enemies[enemyId] = new Enemy(enemyId, speed, size, type);
  } 
}
function spawnWave(wave){
  if (wave == 1){
    waveTime = 10;
    spawnEnemy("normal", 10, 30, 350);
  }
  else if (wave == 2){
    waveTime = 15;
    spawnEnemy("normal", 20, 30, 350);
  }
  else if (wave == 3){
    waveTime = 15;
    spawnEnemy("normal", 10, 30, 350);
    spawnEnemy("dasher", 10, 30, 350);
  }
  else if (wave == 4){
    waveTime = 15;
    spawnEnemy("normal", 6, 30, 400);
    spawnEnemy("dasher", 6, 30, 400);
    spawnEnemy("normal", 5, 60, 250);
    spawnEnemy("dasher", 5, 60, 250);
  }
  else if (wave == 5){
    waveTime = 20;
    spawnEnemy("normal", 90, 15, 150);
  }
  else if (wave == 6){
    waveTime = 20;
    spawnEnemy("normal", 50, 15, 150);
    spawnEnemy("dasher", 50, 15, 100);
    
  }
  else if (wave == 7){
    waveTime = 20;
    spawnEnemy("dasher", 50, 25, 200);
  }
  else if (wave == 8){
    waveTime = 20;
    spawnEnemy("switch", 50, 25, 300);
  }
  else if (wave == 9){
    waveTime = 20;
    spawnEnemy("switch", 20, 15, 150);
    spawnEnemy("normal", 20, 25, 500);
    
  }
  else if (wave == 10){
    waveTime = 30;
    spawnEnemy("switch", 35, 25, 250);
    spawnEnemy("normal", 15, 25, 150);
    spawnEnemy("normal", 4, 70, 200);
    spawnEnemy("dasher", 4, 70, 200);
    
  }
  else if (wave == 11){
    waveTime = 15;
    spawnEnemy("icicle", 50, 15, 300);
  }
  else if (wave == 12){
    waveTime = 15;
    spawnEnemy("icicle", 30, 20, 300);
    spawnEnemy("normal", 10, 20, 300);
    spawnEnemy("normal", 10, 30, 200);
    spawnEnemy("normal", 10, 40, 100);
    
  }
  else if (wave == 13){
    waveTime = 20;
    spawnEnemy("liquid", 30, 25, 100);
    
  }
  else if (wave == 14){
    waveTime = 20;
    spawnEnemy("icicle", 30, 15, 300);
    spawnEnemy("liquid", 25, 30, 60);
    
  }
  else if (wave == 15){
    waveTime = 20;
    spawnEnemy("liquid", 15, 30, 200);
    
  }
  else if (wave == 16){
    waveTime = 25;
    spawnEnemy("normal", 25, 15, 100);
    spawnEnemy("dasher", 25, 15, 100);
    spawnEnemy("switch", 25, 15, 100);
    spawnEnemy("icicle", 25, 15, 100);
    spawnEnemy("liquid", 25, 15, 40);
    
  }
  else if (wave == 17){
    waveTime = 25;
    spawnEnemy("normal", 50, 15, 100);
    spawnEnemy("liquid", 10, 25, 300);
    
  }
  else if (wave == 18){
    waveTime = 25;
    spawnEnemy("normal", 30, 25, 400);
    
  }
  else if (wave == 19){
    waveTime = 25;
    spawnEnemy("dasher", 30, 22, 150);
    spawnEnemy("switch", 30, 22, 150);
  }
  else if (wave == 20){
    waveTime = 40;
    spawnEnemy("icicle", 18, 20, 300);
    spawnEnemy("icicle", 18, 25, 200);
    spawnEnemy("icicle", 18, 30, 100);
    spawnEnemy("liquid", 2, 70, 40);
    spawnEnemy("liquid", 20, 25, 60);
    spawnEnemy("icicle", 1, 70, 80);
  }
  else if (wave == 21){
    waveTime = 20;
    spawnEnemy("sizing", 30, 25, 200);
  }
  else if (wave == 22){
    waveTime = 20;
    spawnEnemy("sizing", 20, 40, 200);
    spawnEnemy("normal", 20, 40, 200);
  }
  else if (wave == 23){
    waveTime = 30;
    spawnEnemy("sizing", 20, 20, 400);
    spawnEnemy("switch", 30, 20, 200);
  }
  else if (wave == 24){
    waveTime = 40;
    spawnEnemy("sizing", 15, 20, 100);
    spawnEnemy("icicle", 15, 25, 300);
    spawnEnemy("liquid", 15, 15, 50);
    spawnEnemy("dasher", 25, 15, 100);
    
  }
  else if (wave == 25){
    waveTime = 90;
    spawnEnemy("normal", 40, 30, 500);
    
  }
  else if (wave == 26){
    waveTime = Infinity;
    spawnEnemy("normal", 600, 200, 1000);
    
  }

  if (wave > 2){
    spawnEnemy("border", 1, 20, 300);
    spawnEnemy("border", 1, 30, 500);
    spawnEnemy("border", 1, 40, 700);
    spawnEnemy("border", 1, 20, 900);
    spawnEnemy("border", 1, 30, 1100);
    spawnEnemy("border", 1, 40, 1300);
    spawnEnemy("border", 1, 20, 400);
    spawnEnemy("border", 1, 30, 600);
    spawnEnemy("border", 1, 40, 800);
    spawnEnemy("border", 1, 20, 1000);
    spawnEnemy("border", 1, 30, 1200);
    spawnEnemy("border", 1, 40, 1400);
    
  }
  
}

wss.on("connection", ws => {
  // player opens new tab
  const clientId = createId();
  let player;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data)
      if (msg.type == "name") {
        if (player == undefined){
        let newPlayer = new Player(clientId, ws);
        newPlayer.name = String(msg.name);
        if (msg.name == null || msg.name == "") {
          newPlayer.name = "Guest";
        }
        const initPack = newPlayer.getInitPack();
        for (let i of Object.keys(players)) {
          players[i].ws.send(JSON.stringify({
            type: "join",
            pack: initPack,
          }))
        }
        players[clientId] = newPlayer;
        player = players[clientId];

        const enemyInitPacks = Enemy.getAllInitPack(enemies);
        const initPacks = Player.getAllInitPack(players);
        ws.send(JSON.stringify({
          type: "init",
          pack: initPacks,
          enemyPack: enemyInitPacks,
          waveTime: Math.trunc(waveTime),
          wave: wave,
          inWave: inWave
        }))
        }
      }
      if (msg.type == "mouse"){
        player.mouseX = msg.mouse[0];
        player.mouseY = msg.mouse[1];
      }
      if (msg.type == "mouseMove"){
        player.mouseMove = msg.move;
      }
      if (msg.type == "keys") {
        player.input = msg.keys;
      }
    } catch (err) {

    }
  })
  ws.on('close', () => {
    if (players[clientId] != undefined){
    for(let i of Object.keys(players)){
      players[i].ws.send(JSON.stringify({
        type: "leave",
        id: clientId
      }))
    }
    delete players[clientId];
    }
    //player leaves
  })
})


const server = app.listen(3000);
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, socket => {
    wss.emit('connection', socket, request);
  });
});

function update(delta) {
  const packs = [];
  const enemyPacks = [];
  let updated = false;
  let alive = false;
  for (let i of Object.keys(players)) {
    updated = true;
    players[i].update(delta);
    packs.push(players[i].getUpdatePack())
    if (players[i].dead == false){
      alive = true;
    }
  }
  if (!updated) {
    enemies = {};
    players = {};
    wave = 0 //0;
    waveTime = 20; //15;
    inWave = false;
  } else {
    waveTime -= delta / 1000;
    if (waveTime < 0){
      waveTime = 5;
      inWave = !inWave;
      if (inWave){
        wave ++;
        spawnWave(wave);
      }
      else{
        enemies = {};
        for(let i of Object.keys(players)){
          players[i].ws.send(JSON.stringify({
            type: "waveOver"
          }))
        }
      }
    }
    if (Math.trunc(waveTime) != lastWaveTime){
      lastWaveTime = Math.trunc(waveTime);
      for(let i of Object.keys(players)){
        players[i].ws.send(JSON.stringify({
          type: "time",
          waveTime: Math.trunc(waveTime) + 1,
          inWave: inWave,
          wave: wave
        }))
      }
    }

    
    for (let i of Object.keys(enemies)) {
      enemies[i].update(delta);
      enemyPacks.push(enemies[i].getUpdatePack());
    }
    if (enemyInitPacks.length != 0) {
      for (let i of Object.keys(players)) {
        players[i].ws.send(JSON.stringify({
          type: "newEnemy",
          pack: enemyInitPacks
        }))
      }
      enemyInitPacks = [];
    }
    for (let i of Object.keys(players)) {
      players[i].ws.send(JSON.stringify({
        type: "update",
        pack: packs,
        enemyPack: enemyPacks
      }))
    }
  }
  if (!alive){
    for(let i of Object.keys(players)){
      players[i].ws.close(1000);
    }
  }
}
let lastTime = 0;
setInterval(() => {
  let delta = ms() - lastTime;
  lastTime = ms();
  update(delta)
}, 1000 / 45);


console.log("Game Running")