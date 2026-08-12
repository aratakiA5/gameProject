const DEMON_SAVE_KEY='seikai-demon-faction-v1';
const DEMON_BASE={x:16,y:8};

function freshDemonState(){return{territory:{[`${DEMON_BASE.x},${DEMON_BASE.y}`]:'castle'},castleLevel:1,power:420,research:0,materials:0,scout:{...DEMON_BASE},contact:false,lastTick:Date.now(),expansions:0};}
function loadDemonState(){try{const raw=JSON.parse(localStorage.getItem(DEMON_SAVE_KEY));return raw?{...freshDemonState(),...raw,territory:{...freshDemonState().territory,...(raw.territory||{})}}:freshDemonState();}catch{return freshDemonState();}}
function saveDemonState(){demonState.lastTick=Date.now();localStorage.setItem(DEMON_SAVE_KEY,JSON.stringify(demonState));}
let demonState=loadDemonState();

function demonKey(x,y){return `${x},${y}`;}
function demonInBounds(x,y){return x>=0&&x<WORLD_COLS&&y>=0&&y<WORLD_ROWS;}
function demonAdjacentCells(x,y){return[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:x+dx,y:y+dy})).filter(p=>demonInBounds(p.x,p.y));}
function demonFrontier(){
  const out=[];
  Object.keys(demonState.territory).forEach(k=>{const [x,y]=k.split(',').map(Number);demonAdjacentCells(x,y).forEach(p=>{const key=demonKey(p.x,p.y);if(demonState.territory[key])return;if(explore.discovered[key])return;if(!out.some(v=>v.x===p.x&&v.y===p.y))out.push(p);});});
  return out;
}
function demonTouchesPlayer(){
  return Object.keys(demonState.territory).some(k=>{const [x,y]=k.split(',').map(Number);return demonAdjacentCells(x,y).some(p=>!!explore.discovered[demonKey(p.x,p.y)]);});
}
function demonGrowthStep(){
  const frontier=demonFrontier();
  demonState.contact=demonTouchesPlayer();
  if(frontier.length){
    frontier.sort((a,b)=>Math.abs(a.x-BASE_POS.x)+Math.abs(a.y-BASE_POS.y)-(Math.abs(b.x-BASE_POS.x)+Math.abs(b.y-BASE_POS.y)));
    const target=frontier[Math.floor(Math.random()*Math.min(3,frontier.length))];
    const terrain=terrainAt(target.x,target.y);
    demonState.territory[demonKey(target.x,target.y)]=terrain;
    demonState.scout={...target};demonState.expansions++;
    demonState.research+=terrainDefs[terrain]?.research||1;
    demonState.materials+=1+(terrain==='mineral'?2:terrain==='ruins'?2:0);
    demonState.power+=8+(terrain==='danger'?6:terrain==='ruins'?4:0);
  }
  if(demonState.expansions>0&&demonState.expansions%8===0){demonState.castleLevel=1+Math.floor(demonState.expansions/8);demonState.power+=25;}
  saveDemonState();decorateDemonWorld();
}
function applyDemonOfflineGrowth(){
  const elapsed=Math.min(60*60,Math.max(0,(Date.now()-(Number(demonState.lastTick)||Date.now()))/1000));
  const steps=Math.min(12,Math.floor(elapsed/20));
  for(let i=0;i<steps;i++)demonGrowthStep();
}

function decorateDemonWorld(){
  const grid=document.getElementById('worldGrid');if(!grid)return;
  Object.keys(demonState.territory).forEach(k=>{
    const [x,y]=k.split(',').map(Number);const cell=grid.querySelector(`[data-x="${x}"][data-y="${y}"]`);if(!cell)return;
    cell.classList.add('demon-cell');
    if(x===DEMON_BASE.x&&y===DEMON_BASE.y){cell.innerHTML+=`<div class="demon-castle"><span class="icon">🏯</span><b>魔王城</b><small>Lv.${demonState.castleLevel}</small></div>`;}
    else cell.innerHTML+=`<span class="demon-flag">魔</span>`;
    if(demonState.scout.x===x&&demonState.scout.y===y)cell.innerHTML+=`<span class="demon-scout" title="魔王軍探索隊">🦇</span>`;
    if(demonAdjacentCells(x,y).some(p=>!!explore.discovered[demonKey(p.x,p.y)]))cell.classList.add('demon-contact');
  });
  const frontier=demonFrontier();frontier.forEach(p=>{const cell=grid.querySelector(`[data-x="${p.x}"][data-y="${p.y}"]`);if(cell)cell.classList.add('demon-frontier');});
  renderDemonStatus();
}
function renderDemonStatus(){
  let el=document.getElementById('demonStatus');
  if(!el){el=document.createElement('div');el.id='demonStatus';el.className='demon-status';document.querySelector('.desktop-space')?.appendChild(el);}
  const count=Object.keys(demonState.territory).length;
  const progress=Math.min(100,count/(WORLD_COLS*WORLD_ROWS)*100);
  el.innerHTML=`<b>魔王軍勢力</b><span>魔王城 Lv.${demonState.castleLevel} / 戦力 ${demonState.power}</span><span>領土 ${count}マス / 資源 ${demonState.materials} / 研究 ${demonState.research}</span><span>${demonState.contact?'⚠ プレイヤー勢力と接触':'未接触 / 自動探索中'}</span><div class="demon-progress"><i style="width:${progress}%"></i></div>`;
}

const originalWorldRenderer=buildWorldGrid;
buildWorldGrid=function(){originalWorldRenderer();setTimeout(decorateDemonWorld,0);};

const originalPlayerFrontier=frontierCells;
frontierCells=function(){return originalPlayerFrontier().filter(p=>!demonState.territory[demonKey(p.x,p.y)]);};

applyDemonOfflineGrowth();decorateDemonWorld();
setInterval(demonGrowthStep,6500);
setInterval(renderDemonStatus,1200);
