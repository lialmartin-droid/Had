(()=>{
const c=document.getElementById("game"),x=c.getContext("2d"),scoreE=document.getElementById("score"),highE=document.getElementById("high"),ov=document.getElementById("overlay");
const G=30,C=c.width/G;
let snake,dir,next,food,score=0,high=+(localStorage.nokiaSnakeHigh||0),run=false,paused=false,timer,speed=420;
let colorA=localStorage.snakeColorA||"#21a83f",colorB=localStorage.snakeColorB||"#d3b832";
const aI=document.getElementById("colorA"),bI=document.getElementById("colorB");
aI.value=colorA;bI.value=colorB;highE.textContent=high;

function shade(hex,amt){const n=parseInt(hex.slice(1),16),r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,((n>>8)&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));return `rgb(${r},${g},${b})`}
function reset(){snake=[{x:15,y:15,bulge:0},{x:14,y:15,bulge:0},{x:13,y:15,bulge:0},{x:12,y:15,bulge:0}];dir={x:1,y:0};next={...dir};score=0;speed=420;scoreE.textContent=0;placeFood();draw()}
function placeFood(){do{food={x:Math.floor(Math.random()*G),y:Math.floor(Math.random()*G)}}while(snake.some(p=>p.x===food.x&&p.y===food.y))}
function start(){reset();run=true;paused=false;ov.classList.add("hidden");document.getElementById("pause").textContent="PAUZA";loop()}
function loop(){clearInterval(timer);timer=setInterval(tick,speed)}
function tick(){if(!run||paused)return;dir=next;const h={x:(snake[0].x+dir.x+G)%G,y:(snake[0].y+dir.y+G)%G,bulge:0};const eat=h.x===food.x&&h.y===food.y,check=eat?snake:snake.slice(0,-1);if(check.some(p=>p.x===h.x&&p.y===h.y))return over();snake.unshift(h);if(eat){snake[0].bulge=1;score+=10;scoreE.textContent=score;placeFood();const ns=Math.max(115,420-Math.floor(score/50)*18);if(ns!==speed){speed=ns;loop()}}else snake.pop();draw()}
function over(){run=false;clearInterval(timer);if(score>high){high=score;localStorage.nokiaSnakeHigh=high;highE.textContent=high}ov.innerHTML=`<h1>KONEC</h1><p>Skóre: ${score}</p><p>Rekord: ${high}</p><button class="start" id="again">ZNOVU</button>`;ov.classList.remove("hidden");document.getElementById("again").onclick=start}
function draw(){const bg=x.createLinearGradient(0,0,0,c.height);bg.addColorStop(0,"#aabd7d");bg.addColorStop(1,"#8fa667");x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);drawFood();for(let i=snake.length-1;i>=0;i--)drawPart(snake[i],i);drawHead()}
function drawFood(){const cx=food.x*C+C/2,cy=food.y*C+C/2,r=C*.32,g=x.createRadialGradient(cx-r*.3,cy-r*.3,1,cx,cy,r);g.addColorStop(0,"#ff8068");g.addColorStop(.45,"#d82e20");g.addColorStop(1,"#72120c");x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.fill()}
function drawPart(p,i){const baseColor=i%2===0?colorA:colorB,cx=p.x*C+C/2,cy=p.y*C+C/2,r=C*.39*(p.bulge?1.48:1),g=x.createRadialGradient(cx-r*.3,cy-r*.3,1,cx,cy,r);g.addColorStop(0,shade(baseColor,55));g.addColorStop(.55,baseColor);g.addColorStop(1,shade(baseColor,-65));x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.fill();x.strokeStyle="rgba(0,0,0,.25)";x.stroke()}
function drawHead(){const h=snake[0],cx=h.x*C+C/2,cy=h.y*C+C/2,a=Math.atan2(dir.y,dir.x),rx=C*.57,ry=C*.44,g=x.createRadialGradient(-rx*.2,-ry*.2,1,0,0,rx);x.save();x.translate(cx,cy);x.rotate(a);g.addColorStop(0,shade(colorA,55));g.addColorStop(.6,colorA);g.addColorStop(1,shade(colorA,-70));x.fillStyle=g;x.beginPath();x.ellipse(0,0,rx,ry,0,0,Math.PI*2);x.fill();x.fillStyle="#f5f2d5";for(const sy of[-1,1]){x.beginPath();x.arc(rx*.22,sy*ry*.48,C*.10,0,Math.PI*2);x.fill()}x.fillStyle="#111";for(const sy of[-1,1]){x.beginPath();x.arc(rx*.27,sy*ry*.48,C*.052,0,Math.PI*2);x.fill()}x.strokeStyle="#b51d22";x.lineWidth=1.2;x.beginPath();x.moveTo(rx*.82,0);x.lineTo(rx*1.2,0);x.lineTo(rx*1.37,-C*.09);x.moveTo(rx*1.2,0);x.lineTo(rx*1.37,C*.09);x.stroke();x.restore()}
function setD(name){const d={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[name];if(!d||d.x===-dir.x&&d.y===-dir.y)return;next=d}
document.querySelectorAll("[data-d]").forEach(btn=>btn.onpointerdown=e=>{e.preventDefault();setD(btn.dataset.d)});
document.onkeydown=e=>{const k=e.key.toLowerCase();if(k==="arrowup"||k==="w")setD("up");if(k==="arrowdown"||k==="s")setD("down");if(k==="arrowleft"||k==="a")setD("left");if(k==="arrowright"||k==="d")setD("right")};
document.getElementById("start").onclick=start;document.getElementById("restart").onclick=start;document.getElementById("pause").onclick=()=>{if(!run)return start();paused=!paused;document.getElementById("pause").textContent=paused?"POKRAČOVAT":"PAUZA"};
aI.oninput=()=>{colorA=aI.value;localStorage.snakeColorA=colorA;draw()};bI.oninput=()=>{colorB=bI.value;localStorage.snakeColorB=colorB;draw()};
document.querySelectorAll(".preset").forEach(btn=>btn.onclick=()=>{colorA=btn.dataset.a;colorB=btn.dataset.b;aI.value=colorA;bI.value=colorB;localStorage.snakeColorA=colorA;localStorage.snakeColorB=colorB;draw()});
reset();
})();