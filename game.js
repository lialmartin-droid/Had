(()=>{
"use strict";

const byId=id=>document.getElementById(id);
const canvas=byId("game");
const ctx=canvas.getContext("2d");
const scoreEl=byId("score");
const highEl=byId("high");
const middleHud=byId("middleHud");
const levelEl=byId("level");
const overlay=byId("overlay");
const pauseButton=byId("pause");
const messageEl=byId("gameMessage");
const comboEl=byId("combo");

const COLS=30;
const ROWS=27;
const CELL=canvas.width/COLS;
const STATS_KEY="nokiaSnakeStatsV8";
const VALID_MODES=["classic","survival","time","daily"];

const FOOD_TYPES={
  apple:{points:10,growth:1,message:"+10"},
  gold:{points:50,growth:2,message:"ZLATÉ SOUSTO +50"},
  slow:{points:20,growth:1,message:"ZPOMALENÍ NA 6 S"},
  double:{points:20,growth:1,message:"DVOJNÁSOBNÉ BODY"}
};

const THEMES=[
  {name:"ZELENÝ DISPLEJ",top:"#aabd7d",bottom:"#8fa667",grid:"#40502d18",ink:"#24331a",obstacle:"#52633b"},
  {name:"BAREVNÝ TELEFON",top:"#a9d39a",bottom:"#73a985",grid:"#28523b1c",ink:"#183928",obstacle:"#435e4c"},
  {name:"POUŠŤ",top:"#e0c57d",bottom:"#bd8d4d",grid:"#6e451d1a",ink:"#573118",obstacle:"#73513a"},
  {name:"LED",top:"#b9e3ea",bottom:"#72afc3",grid:"#24556d1c",ink:"#17475c",obstacle:"#527f91"},
  {name:"NEON",top:"#17243c",bottom:"#301747",grid:"#5ee8d62b",ink:"#72ffe2",obstacle:"#744694"}
];

const DEFAULT_STATS={
  games:0,
  totalFood:0,
  longest:1,
  bestCombo:1,
  bestFoodRun:0,
  totalSeconds:0,
  high:0,
  daily:{date:"",high:0}
};

function readJSON(key,fallback){
  try{
    const value=JSON.parse(localStorage.getItem(key));
    return value&&typeof value==="object"?value:fallback;
  }catch{
    return fallback;
  }
}

function saveValue(key,value){
  try{localStorage.setItem(key,value)}catch{}
}

let stats={...DEFAULT_STATS,...readJSON(STATS_KEY,{})};
stats.daily={...DEFAULT_STATS.daily,...(stats.daily||{})};

let high=Math.max(
  Number(localStorage.getItem("nokiaSnakeHigh")||0),
  Number(stats.high||0)
);
let highAtStart=high;
let colorA=localStorage.getItem("snakeColorA")||"#21a83f";
let colorB=localStorage.getItem("snakeColorB")||"#d3b832";
let selectedMode=localStorage.getItem("nokiaSnakeMode")||"classic";
if(!VALID_MODES.includes(selectedMode))selectedMode="classic";

let snake=[];
let direction={x:1,y:0};
let nextDirection={x:1,y:0};
let turnReady=true;
let food=null;
let obstacles=[];
let obstacleStage=0;
let score=0;
let foodCount=0;
let level=1;
let combo=1;
let bestComboRun=1;
let lastEatAt=0;
let growQueue=0;
let run=false;
let paused=false;
let moveTimer=0;
let clockTimer=0;
let messageTimer=0;
let comboTimer=0;
let timeLeft=120000;
let lastClockAt=0;
let runElapsed=0;
let slowUntil=0;
let doubleUntil=0;
let random=Math.random;

highEl.textContent=high;
byId("colorA").value=colorA;
byId("colorB").value=colorB;
byId("dailyLabel").textContent=formatToday();

function todayKey(){
  const d=new Date();
  const year=d.getFullYear();
  const month=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${year}-${month}-${day}`;
}

function formatToday(){
  const d=new Date();
  return `${d.getDate()}. ${d.getMonth()+1}. · stejná mapa`;
}

function hashString(text){
  let hash=2166136261;
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return hash>>>0;
}

function mulberry32(seed){
  return ()=>{
    let t=seed+=0x6d2b79f5;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return((t^t>>>14)>>>0)/4294967296;
  };
}

function saveStats(){
  stats.high=high;
  saveValue(STATS_KEY,JSON.stringify(stats));
  saveValue("nokiaSnakeHigh",String(high));
}

function shade(hex,amount){
  const clean=hex.replace("#","");
  const expanded=clean.length===3?clean.split("").map(v=>v+v).join(""):clean;
  const value=parseInt(expanded,16);
  const r=Math.max(0,Math.min(255,(value>>16)+amount));
  const g=Math.max(0,Math.min(255,((value>>8)&255)+amount));
  const b=Math.max(0,Math.min(255,(value&255)+amount));
  return `rgb(${r},${g},${b})`;
}

function resetState(){
  stopTimers();
  snake=[{x:15,y:13,pulse:0}];
  direction={x:1,y:0};
  nextDirection={...direction};
  turnReady=true;
  obstacles=[];
  obstacleStage=0;
  score=0;
  foodCount=0;
  level=1;
  combo=1;
  bestComboRun=1;
  lastEatAt=0;
  growQueue=0;
  paused=false;
  timeLeft=120000;
  runElapsed=0;
  slowUntil=0;
  doubleUntil=0;
  random=selectedMode==="daily"?mulberry32(hashString(todayKey())):Math.random;
  scoreEl.textContent="0";
  pauseButton.textContent="PAUZA";
  placeFood(true);
  updateHud();
  draw();
}

function startGame(){
  highAtStart=high;
  resetState();
  run=true;
  stats.games+=1;
  saveStats();
  overlay.classList.add("hidden");
  overlay.classList.remove("game-over");
  updateHud();
  lastClockAt=performance.now();
  clockTimer=setInterval(updateClock,125);
  flashMessage({
    classic:"KLASIKA",
    survival:"SURVIVAL · PŘEKÁŽKY OD 5 SOUST",
    time:"ČASOVKA · 2:00",
    daily:"DENNÍ VÝZVA"
  }[selectedMode]);
  scheduleMove();
}

function stopTimers(){
  clearTimeout(moveTimer);
  clearInterval(clockTimer);
  clearTimeout(messageTimer);
  clearTimeout(comboTimer);
  moveTimer=0;
  clockTimer=0;
}

function currentDelay(){
  const base=Math.max(selectedMode==="time"?145:125,420-(level-1)*30);
  return performance.now()<slowUntil?Math.round(base*1.42):base;
}

function scheduleMove(){
  clearTimeout(moveTimer);
  if(!run||paused)return;
  moveTimer=setTimeout(()=>{
    tick();
    if(run&&!paused)scheduleMove();
  },currentDelay());
}

function updateClock(){
  const now=performance.now();
  if(!run){
    lastClockAt=now;
    return;
  }
  if(paused){
    lastClockAt=now;
    return;
  }

  const elapsed=Math.max(0,now-lastClockAt);
  lastClockAt=now;
  runElapsed+=elapsed;

  if(selectedMode==="time"){
    timeLeft=Math.max(0,timeLeft-elapsed);
    updateHud();
    if(timeLeft<=0)gameOver("ČAS VYPRŠEL");
  }
}

function tick(){
  if(!run||paused)return;

  direction={...nextDirection};
  turnReady=true;

  const head={
    x:(snake[0].x+direction.x+COLS)%COLS,
    y:(snake[0].y+direction.y+ROWS)%ROWS,
    pulse:0
  };
  const eats=food&&head.x===food.x&&head.y===food.y;
  const keepsTail=eats||growQueue>0;
  const collisionBody=keepsTail?snake:snake.slice(0,-1);

  if(collisionBody.some(part=>part.x===head.x&&part.y===head.y)){
    gameOver("NARAZIL JSI DO SEBE");
    return;
  }

  if(obstacles.some(block=>block.x===head.x&&block.y===head.y)){
    gameOver("NARAZIL JSI");
    return;
  }

  snake.unshift(head);
  if(eats){
    consumeFood();
  }else if(growQueue>0){
    growQueue-=1;
  }else{
    snake.pop();
  }

  snake.forEach(part=>{part.pulse=Math.max(0,(part.pulse||0)-.22)});
  stats.longest=Math.max(stats.longest,snake.length);
  draw();
}

function consumeFood(){
  const eaten=food;
  const config=FOOD_TYPES[eaten.type];
  const now=performance.now();

  combo=lastEatAt&&now-lastEatAt<=3300?Math.min(5,combo+1):1;
  lastEatAt=now;
  bestComboRun=Math.max(bestComboRun,combo);
  stats.bestCombo=Math.max(stats.bestCombo,combo);

  if(eaten.type==="slow")slowUntil=now+6000;
  if(eaten.type==="double")doubleUntil=now+8000;

  const doubleActive=now<doubleUntil?2:1;
  const gained=config.points*combo*doubleActive;
  score+=gained;
  foodCount+=1;
  growQueue+=Math.max(0,config.growth-1);
  snake[0].pulse=1;
  food=null;

  stats.totalFood+=1;
  stats.bestFoodRun=Math.max(stats.bestFoodRun,foodCount);
  scoreEl.textContent=score;

  if(score>high){
    high=score;
    highEl.textContent=high;
  }

  if(combo>1)showCombo(combo,doubleActive);
  if(eaten.type!=="apple"){
    flashMessage(config.message);
  }else if(combo>1){
    flashMessage(`KOMBO ${combo}× · +${gained}`);
  }

  const nextLevel=1+Math.floor(foodCount/7);
  if(nextLevel!==level){
    level=nextLevel;
    flashMessage(`ÚROVEŇ ${level} · ${currentTheme().name}`);
  }

  maybeAddObstacles();
  placeFood(false);
  updateHud();
  saveStats();
}

function chooseFoodType(){
  if(foodCount<3)return"apple";
  const roll=random();
  if(roll<.70)return"apple";
  if(roll<.82)return"gold";
  if(roll<.92)return"slow";
  return"double";
}

function placeFood(forceApple){
  for(let attempt=0;attempt<1800;attempt++){
    const candidate={
      x:Math.floor(random()*COLS),
      y:Math.floor(random()*ROWS),
      type:forceApple?"apple":chooseFoodType()
    };
    const occupied=snake.some(part=>part.x===candidate.x&&part.y===candidate.y)||
      obstacles.some(block=>block.x===candidate.x&&block.y===candidate.y);
    if(!occupied){
      food=candidate;
      return;
    }
  }

  if(run)gameOver("VYHRÁL JSI");
}

function maybeAddObstacles(){
  if(selectedMode!=="survival"&&selectedMode!=="daily")return;
  const step=selectedMode==="daily"?4:5;
  const targetStage=Math.floor(foodCount/step);

  while(obstacleStage<targetStage&&obstacles.length<24){
    obstacleStage+=1;
    const wanted=obstacleStage%3===0?3:2;
    let created=0;

    for(let attempt=0;attempt<600&&created<wanted;attempt++){
      const block={x:Math.floor(random()*COLS),y:Math.floor(random()*ROWS)};
      const distance=Math.abs(block.x-snake[0].x)+Math.abs(block.y-snake[0].y);
      const occupied=distance<5||
        snake.some(part=>part.x===block.x&&part.y===block.y)||
        obstacles.some(existing=>existing.x===block.x&&existing.y===block.y);
      if(!occupied){
        obstacles.push(block);
        created+=1;
      }
    }
    flashMessage("PŘIBYLY PŘEKÁŽKY");
  }
}

function currentTheme(){
  return THEMES[Math.min(THEMES.length-1,level-1)];
}

function updateHud(){
  if(selectedMode==="time"&&run){
    const totalSeconds=Math.ceil(timeLeft/1000);
    const minutes=Math.floor(totalSeconds/60);
    const seconds=String(totalSeconds%60).padStart(2,"0");
    middleHud.firstChild.textContent="ČAS ";
    levelEl.textContent=`${minutes}:${seconds}`;
  }else{
    middleHud.firstChild.textContent="ÚROVEŇ ";
    levelEl.textContent=String(level);
  }
}

function showCombo(value,multiplier){
  clearTimeout(comboTimer);
  comboEl.textContent=multiplier>1?`KOMBO ${value}× · BODY 2×`:`KOMBO ${value}×`;
  comboEl.classList.add("show");
  comboTimer=setTimeout(()=>comboEl.classList.remove("show"),1700);
}

function flashMessage(text){
  clearTimeout(messageTimer);
  messageEl.textContent=text;
  messageEl.classList.add("show");
  messageTimer=setTimeout(()=>messageEl.classList.remove("show"),1550);
}

function gameOver(title){
  if(!run)return;
  run=false;
  clearTimeout(moveTimer);
  clearInterval(clockTimer);
  clearTimeout(comboTimer);

  const isRecord=score>highAtStart;
  high=Math.max(high,score);
  highEl.textContent=high;
  stats.longest=Math.max(stats.longest,snake.length);
  stats.bestCombo=Math.max(stats.bestCombo,bestComboRun);
  stats.bestFoodRun=Math.max(stats.bestFoodRun,foodCount);
  stats.totalSeconds+=Math.floor(runElapsed/1000);

  if(selectedMode==="daily"){
    const date=todayKey();
    if(stats.daily.date!==date)stats.daily={date,high:0};
    stats.daily.high=Math.max(stats.daily.high,score);
  }

  saveStats();
  updateStatsView();

  byId("overTitle").textContent=title;
  byId("finalScore").textContent=score;
  byId("newRecord").textContent=isRecord?"NOVÝ REKORD!":`REKORD ${high}`;
  byId("finalLength").textContent=snake.length;
  byId("finalFood").textContent=foodCount;
  byId("finalCombo").textContent=`${bestComboRun}×`;

  pauseButton.textContent="PAUZA";
  overlay.classList.remove("hidden");
  overlay.classList.add("game-over");
  showView("over");
}

function setDirection(name){
  if(!run||paused||!turnReady)return;
  const directions={
    up:{x:0,y:-1},
    down:{x:0,y:1},
    left:{x:-1,y:0},
    right:{x:1,y:0}
  };
  const candidate=directions[name];
  if(!candidate)return;
  if(candidate.x===-direction.x&&candidate.y===-direction.y)return;
  if(candidate.x===direction.x&&candidate.y===direction.y)return;
  nextDirection=candidate;
  turnReady=false;
}

function togglePause(){
  if(!run){
    startGame();
    return;
  }
  paused=!paused;
  pauseButton.textContent=paused?"POKRAČOVAT":"PAUZA";
  if(paused){
    clearTimeout(moveTimer);
    draw();
    drawPause();
  }else{
    lastClockAt=performance.now();
    draw();
    scheduleMove();
  }
}

function currentMission(){
  if(stats.bestFoodRun<10){
    return{text:"Sněz 10 soust v jedné hře",current:stats.bestFoodRun,target:10};
  }
  if(stats.longest<25){
    return{text:"Vypěstuj hada dlouhého 25 dílků",current:stats.longest,target:25};
  }
  if(stats.bestCombo<4){
    return{text:"Dosáhni komba 4×",current:stats.bestCombo,target:4};
  }
  const target=Math.ceil((stats.totalFood+1)/100)*100;
  return{text:`Sněz celkem ${target} soust`,current:stats.totalFood,target};
}

function updateStatsView(){
  byId("statGames").textContent=stats.games;
  byId("statFood").textContent=stats.totalFood;
  byId("statLength").textContent=stats.longest;
  byId("statCombo").textContent=`${stats.bestCombo}×`;
  const mission=currentMission();
  byId("missionText").textContent=mission.text;
  byId("missionProgress").style.width=`${Math.min(100,mission.current/mission.target*100)}%`;
}

function showView(name){
  document.querySelectorAll(".menu-view").forEach(view=>{
    view.classList.toggle("active",view.dataset.view===name);
  });
  document.querySelectorAll(".tab").forEach(tab=>{
    tab.classList.toggle("active",tab.dataset.target===name);
  });
  if(name!=="over")overlay.classList.remove("game-over");
  if(name==="stats")updateStatsView();
}

function openMenu(){
  stopTimers();
  run=false;
  paused=false;
  overlay.classList.remove("hidden","game-over");
  showView("play");
  resetState();
}

function draw(){
  drawBackground();
  drawObstacles();
  drawFood();
  drawBody();
  drawHead();
  drawActiveEffects();
}

function drawBackground(){
  const theme=currentTheme();
  const gradient=ctx.createLinearGradient(0,0,0,canvas.height);
  gradient.addColorStop(0,theme.top);
  gradient.addColorStop(1,theme.bottom);
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  ctx.strokeStyle=theme.grid;
  ctx.lineWidth=1;
  ctx.beginPath();
  for(let x=0;x<=canvas.width;x+=CELL){
    ctx.moveTo(x+.5,0);
    ctx.lineTo(x+.5,canvas.height);
  }
  for(let y=0;y<=canvas.height;y+=CELL){
    ctx.moveTo(0,y+.5);
    ctx.lineTo(canvas.width,y+.5);
  }
  ctx.stroke();

  if(level>=5){
    ctx.strokeStyle="#64ffe022";
    ctx.lineWidth=2;
    for(let y=3;y<canvas.height;y+=7){
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(canvas.width,y);
      ctx.stroke();
    }
  }
}

function drawObstacles(){
  if(!obstacles.length)return;
  const theme=currentTheme();
  for(const block of obstacles){
    const px=block.x*CELL+1.5;
    const py=block.y*CELL+1.5;
    const size=CELL-3;
    const gradient=ctx.createLinearGradient(px,py,px+size,py+size);
    gradient.addColorStop(0,shade(theme.obstacle,42));
    gradient.addColorStop(.55,theme.obstacle);
    gradient.addColorStop(1,shade(theme.obstacle,-45));
    ctx.fillStyle=gradient;
    ctx.fillRect(px,py,size,size);
    ctx.strokeStyle=shade(theme.obstacle,-65);
    ctx.lineWidth=1.3;
    ctx.strokeRect(px+.5,py+.5,size-1,size-1);
    ctx.strokeStyle="#fff4";
    ctx.beginPath();
    ctx.moveTo(px+3,py+4);
    ctx.lineTo(px+size-3,py+3);
    ctx.stroke();
  }
}

function drawFood(){
  if(!food)return;
  const cx=food.x*CELL+CELL/2;
  const cy=food.y*CELL+CELL/2;
  const radius=CELL*.40;

  ctx.save();
  if(food.type==="apple"){
    ctx.shadowColor="rgba(255,255,255,.72)";
    ctx.shadowBlur=CELL*.25;
    const gradient=ctx.createRadialGradient(cx-radius*.35,cy-radius*.38,1,cx,cy,radius);
    gradient.addColorStop(0,"#fff7b0");
    gradient.addColorStop(.18,"#ff6d55");
    gradient.addColorStop(.55,"#e12819");
    gradient.addColorStop(1,"#681006");
    ctx.fillStyle=gradient;
    ctx.beginPath();
    ctx.arc(cx,cy,radius,0,Math.PI*2);
    ctx.fill();
    ctx.shadowBlur=0;
    ctx.strokeStyle="#24130d";
    ctx.lineWidth=1.4;
    ctx.stroke();
  }else if(food.type==="gold"){
    ctx.shadowColor="#ffe55f";
    ctx.shadowBlur=8;
    const gradient=ctx.createRadialGradient(cx-2,cy-2,1,cx,cy,radius);
    gradient.addColorStop(0,"#fffbd0");
    gradient.addColorStop(.45,"#ffd437");
    gradient.addColorStop(1,"#a86405");
    ctx.fillStyle=gradient;
    ctx.beginPath();
    for(let i=0;i<8;i++){
      const angle=-Math.PI/2+i*Math.PI/4;
      const r=i%2===0?radius:radius*.58;
      const px=cx+Math.cos(angle)*r;
      const py=cy+Math.sin(angle)*r;
      i?ctx.lineTo(px,py):ctx.moveTo(px,py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle="#784000";
    ctx.stroke();
  }else if(food.type==="slow"){
    ctx.shadowColor="#dffcff";
    ctx.shadowBlur=7;
    ctx.fillStyle="#45b8dd";
    ctx.beginPath();
    ctx.arc(cx,cy,radius,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle="#154f78";
    ctx.stroke();
    ctx.strokeStyle="#fff";
    ctx.lineWidth=1.2;
    for(let i=0;i<3;i++){
      const angle=i*Math.PI/3;
      ctx.beginPath();
      ctx.moveTo(cx-Math.cos(angle)*radius*.62,cy-Math.sin(angle)*radius*.62);
      ctx.lineTo(cx+Math.cos(angle)*radius*.62,cy+Math.sin(angle)*radius*.62);
      ctx.stroke();
    }
  }else{
    ctx.shadowColor="#f2b7ff";
    ctx.shadowBlur=8;
    ctx.fillStyle="#9b3fbc";
    ctx.beginPath();
    ctx.arc(cx,cy,radius,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle="#401054";
    ctx.stroke();
    ctx.fillStyle="#fff";
    ctx.font="900 8px Arial";
    ctx.textAlign="center";
    ctx.textBaseline="middle";
    ctx.fillText("2×",cx,cy+.4);
  }
  ctx.restore();
}

function drawBody(){
  if(snake.length<2)return;
  const thickness=1+Math.min(.18,(snake.length-1)*.006);

  for(let i=snake.length-1;i>=1;i--){
    const part=snake[i];
    const previous=snake[i-1];
    const dx=Math.abs(part.x-previous.x);
    const dy=Math.abs(part.y-previous.y);
    if(dx+dy===1){
      ctx.strokeStyle=i%2===0?colorA:colorB;
      ctx.lineWidth=CELL*.58*thickness;
      ctx.lineCap="round";
      ctx.beginPath();
      ctx.moveTo(part.x*CELL+CELL/2,part.y*CELL+CELL/2);
      ctx.lineTo(previous.x*CELL+CELL/2,previous.y*CELL+CELL/2);
      ctx.stroke();
    }
  }

  for(let i=snake.length-1;i>=1;i--)drawPart(snake[i],i,thickness);
}

function drawPart(part,index,thickness){
  const base=index%2===0?colorA:colorB;
  const cx=part.x*CELL+CELL/2;
  const cy=part.y*CELL+CELL/2;
  const pulse=1+(part.pulse||0)*.32;
  const radius=CELL*.38*thickness*pulse;
  const gradient=ctx.createRadialGradient(cx-radius*.3,cy-radius*.3,1,cx,cy,radius);
  gradient.addColorStop(0,shade(base,55));
  gradient.addColorStop(.55,base);
  gradient.addColorStop(1,shade(base,-65));
  ctx.fillStyle=gradient;
  ctx.beginPath();
  ctx.arc(cx,cy,radius,0,Math.PI*2);
  ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,.28)";
  ctx.lineWidth=1;
  ctx.stroke();
}

function drawHead(){
  if(!snake.length)return;
  const head=snake[0];
  const cx=head.x*CELL+CELL/2;
  const cy=head.y*CELL+CELL/2;
  const angle=Math.atan2(direction.y,direction.x);
  const thickness=1+Math.min(.15,(snake.length-1)*.005);
  const pulse=1+(head.pulse||0)*.16;
  const rx=CELL*.57*thickness*pulse;
  const ry=CELL*.44*thickness*pulse;

  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(angle);
  const gradient=ctx.createRadialGradient(-rx*.2,-ry*.2,1,0,0,rx);
  gradient.addColorStop(0,shade(colorA,55));
  gradient.addColorStop(.6,colorA);
  gradient.addColorStop(1,shade(colorA,-70));
  ctx.fillStyle=gradient;
  ctx.beginPath();
  ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);
  ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,.35)";
  ctx.lineWidth=1;
  ctx.stroke();

  ctx.fillStyle="#f5f2d5";
  for(const side of[-1,1]){
    ctx.beginPath();
    ctx.arc(rx*.22,side*ry*.48,CELL*.10,0,Math.PI*2);
    ctx.fill();
  }
  ctx.fillStyle="#10120e";
  for(const side of[-1,1]){
    ctx.beginPath();
    ctx.arc(rx*.27,side*ry*.48,CELL*.052,0,Math.PI*2);
    ctx.fill();
  }

  ctx.strokeStyle="#b51d22";
  ctx.lineWidth=1.2;
  ctx.beginPath();
  ctx.moveTo(rx*.82,0);
  ctx.lineTo(rx*1.18,0);
  ctx.lineTo(rx*1.35,-CELL*.09);
  ctx.moveTo(rx*1.18,0);
  ctx.lineTo(rx*1.35,CELL*.09);
  ctx.stroke();
  ctx.restore();
}

function drawActiveEffects(){
  const now=performance.now();
  const effects=[];
  if(now<slowUntil)effects.push(`ZPOM ${Math.ceil((slowUntil-now)/1000)}s`);
  if(now<doubleUntil)effects.push(`BODY 2× ${Math.ceil((doubleUntil-now)/1000)}s`);
  if(!effects.length)return;

  const theme=currentTheme();
  ctx.save();
  ctx.font="900 9px Courier New";
  ctx.textAlign="left";
  ctx.textBaseline="bottom";
  ctx.fillStyle=theme.ink;
  ctx.fillText(effects.join(" · "),6,canvas.height-5);
  ctx.restore();
}

function drawPause(){
  const theme=currentTheme();
  ctx.save();
  ctx.fillStyle="#172014aa";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=level>=5?"#72ffe2":"#d5e4b1";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.font="900 28px Courier New";
  ctx.fillText("PAUZA",canvas.width/2,canvas.height/2-8);
  ctx.font="900 11px Courier New";
  ctx.fillText("TLAČÍTKEM POKRAČUJ",canvas.width/2,canvas.height/2+21);
  ctx.strokeStyle=theme.ink;
  ctx.restore();
}

function renderSnakePreview(){
  const preview=byId("snakePreview");
  preview.replaceChildren();
  for(let i=0;i<7;i++){
    const segment=document.createElement("span");
    segment.className="preview-segment"+(i===0?" preview-head":"");
    segment.style.left=`${32+(6-i)*30}px`;
    const base=i%2===0?colorA:colorB;
    segment.style.background=`radial-gradient(circle at 30% 25%,${shade(base,55)},${base} 58%,${shade(base,-60)})`;
    if(i===0){
      const eye=document.createElement("i");
      eye.className="preview-eye";
      segment.appendChild(eye);
    }
    preview.appendChild(segment);
  }
}

document.querySelectorAll("[data-d]").forEach(button=>{
  button.addEventListener("pointerdown",event=>{
    event.preventDefault();
    setDirection(button.dataset.d);
  });
});

document.addEventListener("keydown",event=>{
  const key=event.key.toLowerCase();
  const map={
    arrowup:"up",w:"up",
    arrowdown:"down",s:"down",
    arrowleft:"left",a:"left",
    arrowright:"right",d:"right"
  };
  if(map[key]){
    event.preventDefault();
    setDirection(map[key]);
  }else if(key===" "||key==="p"){
    event.preventDefault();
    togglePause();
  }
});

let swipeStart=null;
byId("playfield").addEventListener("pointerdown",event=>{
  swipeStart={x:event.clientX,y:event.clientY};
});
byId("playfield").addEventListener("pointerup",event=>{
  if(!swipeStart)return;
  const dx=event.clientX-swipeStart.x;
  const dy=event.clientY-swipeStart.y;
  swipeStart=null;
  if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
  setDirection(Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"));
});
byId("playfield").addEventListener("pointercancel",()=>{swipeStart=null});

document.querySelectorAll(".mode").forEach(button=>{
  button.classList.toggle("selected",button.dataset.mode===selectedMode);
  button.addEventListener("click",()=>{
    selectedMode=button.dataset.mode;
    saveValue("nokiaSnakeMode",selectedMode);
    document.querySelectorAll(".mode").forEach(item=>{
      item.classList.toggle("selected",item===button);
    });
    resetState();
  });
});

document.querySelectorAll(".tab").forEach(button=>{
  button.addEventListener("click",()=>showView(button.dataset.target));
});

byId("start").addEventListener("click",startGame);
byId("again").addEventListener("click",startGame);
byId("backToMenu").addEventListener("click",openMenu);
byId("restart").addEventListener("click",startGame);
pauseButton.addEventListener("click",togglePause);

byId("colorA").addEventListener("input",event=>{
  colorA=event.target.value;
  saveValue("snakeColorA",colorA);
  renderSnakePreview();
  draw();
});
byId("colorB").addEventListener("input",event=>{
  colorB=event.target.value;
  saveValue("snakeColorB",colorB);
  renderSnakePreview();
  draw();
});

document.querySelectorAll(".preset").forEach(button=>{
  button.addEventListener("click",()=>{
    colorA=button.dataset.a;
    colorB=button.dataset.b;
    byId("colorA").value=colorA;
    byId("colorB").value=colorB;
    saveValue("snakeColorA",colorA);
    saveValue("snakeColorB",colorB);
    renderSnakePreview();
    draw();
  });
});

document.addEventListener("visibilitychange",()=>{
  if(document.hidden&&run&&!paused)togglePause();
});

window.addEventListener("pagehide",saveStats);

if("serviceWorker"in navigator&&/^https?:$/.test(location.protocol)){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}

updateStatsView();
renderSnakePreview();
resetState();
})();
