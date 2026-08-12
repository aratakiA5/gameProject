const DEMON_SAVE_KEY='seikai-demon-faction-v1';
const DEMON_BASE={x:16,y:8};

function freshDemonState(){return{territory:{[`${DEMON_BASE.x},${DEMON_BASE.y}`]:'castle'},castleLevel:1,power:420,research:0,materials:0,scout:{...DEMON_BASE},contact:false,lastTick:Date.now(),expansions:0};}
function loadDemonState(){try{const raw=JSON.parse(localStorage.getItem(DEMON_SAVE_KEY));return raw?{...freshDemonState(),...raw,territory:{...freshDemonState().territory,...(raw.territory||{})}}:freshDemonState();}catch{return freshDemonState();}}
function saveDemonState(){demonState.lastTick=Date.now();localStorage.setItem(DEMON_SAVE_KEY,JSON.stringify(demonState));}
let demonState=loadDemonState();

function demonKey(x,y){return `${x},${y}`;}
function demonInBounds(x,y){return x>=0&&x<WORLD_COLS&&y>=0&&y<WORLD_ROWS;}
function demonAdjacentCells(x,y){return[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:x+dx,y:y+dy})).filter(p=>demonInBounds(p.x,p.y));}
function demonTouchesPlayer(){
  return Object.keys(demonState.territory).some(k=>{const [x,y]=k.split(',').map(Number);return demonAdjacentCells(x,y).some(p=>!!explore.discovered[demonKey(p.x,p.y)]);});
}

// 魔王勢力は現在休眠中。城と既存領土だけを世界に残し、自動探索・成長は行わない。
function decorateDemonWorld(){
  const grid=document.getElementById('worldGrid');if(!grid)return;
  demonState.contact=demonTouchesPlayer();
  Object.keys(demonState.territory).forEach(k=>{
    const [x,y]=k.split(',').map(Number);const cell=grid.querySelector(`[data-x="${x}"][data-y="${y}"]`);if(!cell)return;
    cell.classList.add('demon-cell');
    if(x===DEMON_BASE.x&&y===DEMON_BASE.y){cell.innerHTML+=`<div class="demon-castle"><span class="icon">🏯</span><b>魔王城</b><small>休眠中</small></div>`;}
    else cell.innerHTML+=`<span class="demon-flag">魔</span>`;
    if(demonAdjacentCells(x,y).some(p=>!!explore.discovered[demonKey(p.x,p.y)]))cell.classList.add('demon-contact');
  });
  renderDemonStatus();
}
function renderDemonStatus(){
  let el=document.getElementById('demonStatus');
  if(!el){el=document.createElement('div');el.id='demonStatus';el.className='demon-status';document.querySelector('.desktop-space')?.appendChild(el);}
  const count=Object.keys(demonState.territory).length;
  el.innerHTML=`<b>魔王勢力</b><span>魔王城 Lv.${demonState.castleLevel}</span><span>領域 ${count}マス</span><span>休眠中 — 現在は活動していません</span>`;
}

const originalWorldRenderer=buildWorldGrid;
buildWorldGrid=function(){originalWorldRenderer();setTimeout(decorateDemonWorld,0);};

const originalPlayerFrontier=frontierCells;
frontierCells=function(){return originalPlayerFrontier().filter(p=>!demonState.territory[demonKey(p.x,p.y)]);};

// 過去の魔王軍データは残すが、ロード中のオフライン成長や定期成長は停止する。
saveDemonState();
decorateDemonWorld();
setInterval(renderDemonStatus,3000);
