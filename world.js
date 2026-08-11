const WORLD_SAVE_KEY='seikai-corner-idle-v1';
const EXPLORE_SAVE_KEY='seikai-exploration-v1';
const WORLD_COLS=18;
const WORLD_ROWS=10;
const BASE_POS={x:7,y:4};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const worldBuildingDefs={
  mine:{name:'遺晶採掘所',icon:'⛏'},barracks:{name:'訓練所',icon:'⚔'},infirmary:{name:'治療院',icon:'✚'},
  workshop:{name:'工房',icon:'⚙'},observatory:{name:'観測塔',icon:'🔭'},garden:{name:'星花園',icon:'✿'}
};
const worldSlots={base:[7,4],mine:[4,5],barracks:[9,5],infirmary:[6,6],workshop:[11,6],observatory:[8,2],garden:[3,7]};
const terrainDefs={
  plains:{icon:'·',name:'平原',research:1,category:'地形',desc:'比較的安全で見通しの良い土地。探検隊の中継地点として利用しやすい。'},
  forest:{icon:'♣',name:'星霧の森',research:2,category:'地形',desc:'淡い星霧に包まれた森林。未知の植物や小動物が数多く確認される。'},
  mineral:{icon:'◆',name:'鉱脈',research:3,category:'資源',desc:'遺晶反応を含む鉱床。拠点の発展に利用できる可能性がある。'},
  ruins:{icon:'⌂',name:'古代遺跡',research:5,category:'遺構',desc:'旧文明の構造物。内部には記録や装置が残されていることがある。'},
  danger:{icon:'!',name:'危険地帯',research:4,category:'危険',desc:'敵性反応や不安定な星界現象が観測される地域。十分な準備が必要。'},
  water:{icon:'≈',name:'水域',research:2,category:'地形',desc:'星界エネルギーを含んだ水域。進行を妨げるが独自の生態系を持つ。'}
};
const enemyDefs={
  plains:['原野スライム','星角ラビット'],forest:['霧牙ウルフ','森影モス'],mineral:['鉱殻ワーム','晶石ゴーレム'],
  ruins:['遺跡ガーディアン','古代ドローン'],danger:['虚界ハウンド','星蝕獣'],water:['水晶クラブ','蒼泡スライム']
};
const DEX_ORDER=['plains','forest','mineral','ruins','danger','water'];

function readWorldState(){try{return JSON.parse(localStorage.getItem(WORLD_SAVE_KEY))||{};}catch{return {};}}
function worldLevel(buildings){return 1+Object.values(buildings||{}).reduce((a,b)=>a+(Number(b)||0),0);}
function cellIndex(x,y){return y*WORLD_COLS+x;}
function keyOf(x,y){return `${x},${y}`;}
function adjacent(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;}
function distanceFromBase(x,y){return Math.abs(x-BASE_POS.x)+Math.abs(y-BASE_POS.y);}

function freshExplore(){return{discovered:{[keyOf(BASE_POS.x,BASE_POS.y)]:'base'},explorer:{...BASE_POS},research:0,findings:0,dex:{},dexCounts:{},wins:0,losses:0};}
function loadExplore(){try{const raw=JSON.parse(localStorage.getItem(EXPLORE_SAVE_KEY));if(!raw)return freshExplore();const f=freshExplore();return{...f,...raw,discovered:{...f.discovered,...(raw.discovered||{})},dex:{...(raw.dex||{})},dexCounts:{...(raw.dexCounts||{})}};}catch{return freshExplore();}}
function saveExplore(){localStorage.setItem(EXPLORE_SAVE_KEY,JSON.stringify(explore));}
let explore=loadExplore();
let expedition={hp:0,maxHp:0,target:null,enemies:[],enemyIndex:0,battling:false};
let autoRunning=true;

function terrainAt(x,y){
  if(x===BASE_POS.x&&y===BASE_POS.y)return'base';
  const h=Math.abs(((x+11)*92837111)^((y+7)*689287499)^((x*y+3)*283923481));const r=h%100;
  if((x>14&&y<3)||(x<2&&y>7))return'water';if(r<42)return'plains';if(r<65)return'forest';if(r<79)return'mineral';if(r<89)return'ruins';if(r<96)return'danger';return'water';
}
function builtCells(){const data=readWorldState(),buildings=data.buildings||{},out=new Map();Object.entries(worldBuildingDefs).forEach(([key,def])=>{const lv=Number(buildings[key])||0;if(!lv)return;const [x,y]=worldSlots[key];out.set(keyOf(x,y),{...def,lv});if(!explore.discovered[keyOf(x,y)])explore.discovered[keyOf(x,y)]=terrainAt(x,y);});return out;}
function registerDex(type){if(!terrainDefs[type])return false;const isNew=!explore.dex[type];explore.dex[type]=true;explore.dexCounts[type]=(Number(explore.dexCounts[type])||0)+1;return isNew;}

function partyStats(){
  const data=readWorldState();const chars=data.characters||[];const ids=data.selected||[1,2,3,6];const selected=chars.filter(c=>ids.includes(c.id));
  const rawPower=selected.reduce((s,c)=>s+(Number(c.power)||100),0)||420;
  const b=data.buildings||{};const atk=1+(Number(b.barracks)||0)*.04+(Number(b.observatory)||0)*.02;
  const hp=1+(Number(b.infirmary)||0)*.05+(Number(b.observatory)||0)*.02;
  return{power:Math.round(rawPower*atk),maxHp:Math.round(rawPower*5.5*hp)};
}
function resetExpeditionHp(){const s=partyStats();expedition.maxHp=s.maxHp;expedition.hp=s.maxHp;}
function frontierCells(){
  const result=[];
  Object.keys(explore.discovered).forEach(key=>{const [x,y]=key.split(',').map(Number);[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{const nx=x+dx,ny=y+dy,nk=keyOf(nx,ny);if(nx>=0&&nx<WORLD_COLS&&ny>=0&&ny<WORLD_ROWS&&!explore.discovered[nk]&&!result.some(p=>p.x===nx&&p.y===ny))result.push({x:nx,y:ny});});});
  return result;
}
function chooseNextTarget(){
  const frontier=frontierCells();if(!frontier.length)return null;
  frontier.sort((a,b)=>{const da=Math.abs(a.x-explore.explorer.x)+Math.abs(a.y-explore.explorer.y),db=Math.abs(b.x-explore.explorer.x)+Math.abs(b.y-explore.explorer.y);return da-db||distanceFromBase(a.x,a.y)-distanceFromBase(b.x,b.y);});
  return frontier[0];
}
function createEnemies(x,y){
  const terrain=terrainAt(x,y),names=enemyDefs[terrain]||['未知の敵'];const dist=distanceFromBase(x,y);const count=2+((x*7+y*11)%3);
  return Array.from({length:count},(_,i)=>{const power=Math.round((92+dist*20)*(1+i*.08)*(terrain==='danger'?1.25:terrain==='ruins'?1.12:1));return{name:names[(x+y+i)%names.length],power,maxHp:Math.round(power*3.7),hp:Math.round(power*3.7)};});
}

function buildWorldGrid(){
  const grid=document.getElementById('worldGrid');if(!grid)return;const buildings=builtCells(),cells=[];
  for(let y=0;y<WORLD_ROWS;y++)for(let x=0;x<WORLD_COLS;x++){
    const key=keyOf(x,y),known=explore.discovered[key],terrain=known&&known!=='base'?known:'',target=expedition.target&&expedition.target.x===x&&expedition.target.y===y;
    const classes=['world-cell'];if(!known)classes.push('unknown');if(known==='base')classes.push('base-cell');if(terrain)classes.push(terrain);if(target)classes.push('auto-target');
    let inside='';if(terrainDefs[terrain])inside+=`<span class="terrain-mark" title="${terrainDefs[terrain].name}">${terrainDefs[terrain].icon}</span>`;
    if(x===BASE_POS.x&&y===BASE_POS.y)inside+=`<div class="world-entity base"><span class="icon">🏰</span><b>中央拠点</b><small>Lv.${worldLevel(readWorldState().buildings||{})}</small></div>`;
    const building=buildings.get(key);if(building)inside+=`<div class="world-entity"><span class="icon">${building.icon}</span><b>${building.name}</b><small>Lv.${building.lv}</small></div>`;
    if(explore.explorer.x===x&&explore.explorer.y===y)inside+=`<span class="explorer" title="探検隊">🧭</span>`;
    if(target&&expedition.enemies.length){const alive=expedition.enemies.filter(e=>e.hp>0).length;inside+=`<span class="map-enemy" title="敵部隊">👾 ${alive}</span>`;}
    cells.push(`<div class="${classes.join(' ')}" data-x="${x}" data-y="${y}">${inside}</div>`);
  }
  grid.innerHTML=cells.join('');updateWorldHeader();renderDex();updateExpeditionHud();
}
function updateWorldHeader(){
  const discovered=Object.keys(explore.discovered).length,data=readWorldState(),registered=DEX_ORDER.filter(k=>explore.dex[k]).length;
  const pairs=[['worldBaseLevel',`Lv.${worldLevel(data.buildings||{})}`],['worldExploreCount',`${discovered} / ${WORLD_COLS*WORLD_ROWS}`],['worldResearch',explore.research],['worldDexCount',`${registered} / ${DEX_ORDER.length}`]];
  pairs.forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v;});
}
function updateExpeditionHud(){
  const status=document.getElementById('exploreStatus'),hint=document.getElementById('exploreHint');if(!status||!hint)return;
  const hp=`HP ${Math.max(0,Math.round(expedition.hp))} / ${expedition.maxHp}`;
  if(expedition.target&&expedition.enemies.length){const enemy=expedition.enemies[expedition.enemyIndex],alive=expedition.enemies.filter(e=>e.hp>0).length;status.textContent=`AUTO探索：${terrainDefs[terrainAt(expedition.target.x,expedition.target.y)].name} / 敵 ${alive}体`;hint.textContent=`${hp}${enemy&&enemy.hp>0?` / ${enemy.name} HP ${Math.max(0,enemy.hp)}/${enemy.maxHp}`:''}`;}
  else{status.textContent='AUTO探索：次の未踏領域を探索中';hint.textContent=hp;}
}

function renderDex(){
  const grid=document.getElementById('dexGrid');if(!grid)return;const registered=DEX_ORDER.filter(k=>explore.dex[k]).length;
  const progress=document.getElementById('dexProgressText'),bar=document.getElementById('dexProgressBar');if(progress)progress.textContent=`${registered} / ${DEX_ORDER.length}`;if(bar)bar.style.width=`${registered/DEX_ORDER.length*100}%`;
  grid.innerHTML=DEX_ORDER.map(key=>{const d=terrainDefs[key],open=!!explore.dex[key],count=Number(explore.dexCounts[key])||0;return `<button type="button" class="dex-card ${open?'':'locked'}" data-dex="${key}" ${open?'':'disabled'}><span class="dex-icon">${open?d.icon:'？'}</span><span><b>${open?d.name:'？？？'}</b><small>${open?`${d.category} / 発見 ${count}回`:'未発見'}</small></span></button>`;}).join('');
  grid.querySelectorAll('[data-dex]:not([disabled])').forEach(btn=>btn.addEventListener('click',()=>showDexDetail(btn.dataset.dex)));
}
function showDexDetail(key){const d=terrainDefs[key];if(!d||!explore.dex[key])return;const detail=document.getElementById('dexDetail');if(detail)detail.innerHTML=`<b>${d.icon} ${d.name}</b><br>${d.desc}<br><br>分類：${d.category}<br>累計発見：${Number(explore.dexCounts[key])||0}回<br>基本調査資料：+${d.research}`;}
function setExploreMessage(title,hint=''){const a=document.getElementById('exploreStatus'),b=document.getElementById('exploreHint');if(a)a.textContent=title;if(b)b.textContent=hint;}

function conquerTarget(){
  const {x,y}=expedition.target,terrain=terrainAt(x,y),def=terrainDefs[terrain],isNew=registerDex(terrain);
  explore.discovered[keyOf(x,y)]=terrain;explore.explorer={x,y};explore.research+=def.research;explore.findings++;explore.wins++;
  saveExplore();setExploreMessage(`${def.icon} ${def.name}を制圧。領域拡大！`,`${isNew?'図鑑に新規登録 / ':''}調査資料 +${def.research}`);
  expedition.target=null;expedition.enemies=[];expedition.enemyIndex=0;expedition.battling=false;buildWorldGrid();
}
async function loseExpedition(){
  explore.losses++;explore.explorer={...BASE_POS};saveExplore();expedition.target=null;expedition.enemies=[];expedition.enemyIndex=0;expedition.battling=false;
  setExploreMessage('探検隊敗北。拠点へ撤退','3秒後に再出撃します');buildWorldGrid();await sleep(3000);resetExpeditionHp();buildWorldGrid();
}
async function fightTarget(){
  expedition.battling=true;
  for(let i=0;i<expedition.enemies.length;i++){
    expedition.enemyIndex=i;const enemy=expedition.enemies[i];
    while(enemy.hp>0&&expedition.hp>0){
      const stats=partyStats();const allyDmg=Math.max(1,Math.round(stats.power*(.16+Math.random()*.08)));enemy.hp-=allyDmg;buildWorldGrid();await sleep(520);
      if(enemy.hp<=0)break;
      const enemyDmg=Math.max(1,Math.round(enemy.power*(.16+Math.random()*.07)));expedition.hp-=enemyDmg;buildWorldGrid();await sleep(520);
    }
    if(expedition.hp<=0){await loseExpedition();return false;}
  }
  conquerTarget();return true;
}
async function autoExploreLoop(){
  resetExpeditionHp();
  while(autoRunning){
    if(expedition.battling){await sleep(250);continue;}
    const target=chooseNextTarget();
    if(!target){setExploreMessage('全領域の調査が完了しました','新たな地域の追加を待っています');await sleep(2000);continue;}
    expedition.target=target;expedition.enemies=createEnemies(target.x,target.y);buildWorldGrid();setExploreMessage('探検隊が未踏領域へ進軍','敵部隊を全滅させると領域が開放されます');await sleep(900);
    await fightTarget();await sleep(900);
  }
}
function returnBase(){explore.explorer={...BASE_POS};expedition.target=null;expedition.enemies=[];expedition.battling=false;resetExpeditionHp();saveExplore();setExploreMessage('手動帰還しました','AUTO探索を拠点から再開します');buildWorldGrid();}
function openDex(){const p=document.getElementById('dexPanel');if(p){p.classList.add('open');p.setAttribute('aria-hidden','false');renderDex();}}
function closeDex(){const p=document.getElementById('dexPanel');if(p){p.classList.remove('open');p.setAttribute('aria-hidden','true');}}

const returnBtn=document.getElementById('returnBaseBtn');if(returnBtn)returnBtn.addEventListener('click',returnBase);
const dexBtn=document.getElementById('dexBtn');if(dexBtn)dexBtn.addEventListener('click',openDex);
const dexCloseBtn=document.getElementById('dexCloseBtn');if(dexCloseBtn)dexCloseBtn.addEventListener('click',closeDex);
Object.values(explore.discovered).forEach(type=>{if(terrainDefs[type]){explore.dex[type]=true;if(!explore.dexCounts[type])explore.dexCounts[type]=1;}});
saveExplore();buildWorldGrid();autoExploreLoop();setInterval(updateWorldHeader,1200);window.addEventListener('resize',buildWorldGrid);
