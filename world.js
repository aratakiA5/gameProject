const WORLD_SAVE_KEY='seikai-corner-idle-v1';
const EXPLORE_SAVE_KEY='seikai-exploration-v1';
const WORLD_COLS=18;
const WORLD_ROWS=10;
const BASE_POS={x:7,y:4};

const worldBuildingDefs={
  mine:{name:'遺晶採掘所',icon:'⛏'},
  barracks:{name:'訓練所',icon:'⚔'},
  infirmary:{name:'治療院',icon:'✚'},
  workshop:{name:'工房',icon:'⚙'},
  observatory:{name:'観測塔',icon:'🔭'},
  garden:{name:'星花園',icon:'✿'}
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
const DEX_ORDER=['plains','forest','mineral','ruins','danger','water'];

function readWorldState(){try{return JSON.parse(localStorage.getItem(WORLD_SAVE_KEY))||{};}catch{return {};}}
function worldLevel(buildings){return 1+Object.values(buildings||{}).reduce((a,b)=>a+(Number(b)||0),0);}
function cellIndex(x,y){return y*WORLD_COLS+x;}
function keyOf(x,y){return `${x},${y}`;}
function adjacent(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1;}

function freshExplore(){return{discovered:{[keyOf(BASE_POS.x,BASE_POS.y)]:'base'},explorer:{...BASE_POS},research:0,findings:0,dex:{},dexCounts:{}};}
function loadExplore(){
  try{
    const raw=JSON.parse(localStorage.getItem(EXPLORE_SAVE_KEY));
    if(!raw)return freshExplore();
    const fresh=freshExplore();
    return{...fresh,...raw,discovered:{...fresh.discovered,...(raw.discovered||{})},dex:{...(raw.dex||{})},dexCounts:{...(raw.dexCounts||{})}};
  }catch{return freshExplore();}
}
function saveExplore(){localStorage.setItem(EXPLORE_SAVE_KEY,JSON.stringify(explore));}
let explore=loadExplore();

function terrainAt(x,y){
  if(x===BASE_POS.x&&y===BASE_POS.y)return'base';
  const h=Math.abs(((x+11)*92837111)^((y+7)*689287499)^((x*y+3)*283923481));
  const r=h%100;
  if((x>14&&y<3)||(x<2&&y>7))return'water';
  if(r<42)return'plains';
  if(r<65)return'forest';
  if(r<79)return'mineral';
  if(r<89)return'ruins';
  if(r<96)return'danger';
  return'water';
}

function builtCells(){
  const data=readWorldState(),buildings=data.buildings||{};
  const out=new Map();
  Object.entries(worldBuildingDefs).forEach(([key,def])=>{
    const lv=Number(buildings[key])||0;if(!lv)return;
    const [x,y]=worldSlots[key];out.set(keyOf(x,y),{...def,lv});
    if(!explore.discovered[keyOf(x,y)])explore.discovered[keyOf(x,y)]=terrainAt(x,y);
  });
  return out;
}

function isReachable(x,y){
  if(explore.discovered[keyOf(x,y)])return false;
  return adjacent(explore.explorer,{x,y});
}

function registerDex(type){
  if(!terrainDefs[type])return false;
  const isNew=!explore.dex[type];
  explore.dex[type]=true;
  explore.dexCounts[type]=(Number(explore.dexCounts[type])||0)+1;
  return isNew;
}

function buildWorldGrid(){
  const grid=document.getElementById('worldGrid');if(!grid)return;
  const buildings=builtCells();
  const cells=[];
  for(let y=0;y<WORLD_ROWS;y++){
    for(let x=0;x<WORLD_COLS;x++){
      const key=keyOf(x,y),known=explore.discovered[key],reachable=isReachable(x,y);
      const terrain=known&&known!=='base'?known:'';
      const classes=['world-cell'];
      if(!known)classes.push('unknown');
      if(reachable)classes.push('reachable');
      if(known==='base')classes.push('base-cell');
      if(terrain)classes.push(terrain);
      let inside='';
      if(terrainDefs[terrain])inside+=`<span class="terrain-mark" title="${terrainDefs[terrain].name}">${terrainDefs[terrain].icon}</span>`;
      if(x===BASE_POS.x&&y===BASE_POS.y)inside+=`<div class="world-entity base"><span class="icon">🏰</span><b>中央拠点</b><small>Lv.${worldLevel(readWorldState().buildings||{})}</small></div>`;
      const building=buildings.get(key);
      if(building)inside+=`<div class="world-entity"><span class="icon">${building.icon}</span><b>${building.name}</b><small>Lv.${building.lv}</small></div>`;
      if(explore.explorer.x===x&&explore.explorer.y===y)inside+=`<span class="explorer" title="探検隊">🧭</span>`;
      cells.push(`<div class="${classes.join(' ')}" data-x="${x}" data-y="${y}" data-cell="${cellIndex(x,y)}">${inside}</div>`);
    }
  }
  grid.innerHTML=cells.join('');
  grid.querySelectorAll('.world-cell').forEach(cell=>cell.addEventListener('click',()=>onCellClick(Number(cell.dataset.x),Number(cell.dataset.y))));
  updateWorldHeader();renderDex();
}

function updateWorldHeader(){
  const discovered=Object.keys(explore.discovered).length;
  const data=readWorldState();
  const lv=worldLevel(data.buildings||{});
  const registered=DEX_ORDER.filter(k=>explore.dex[k]).length;
  const baseEl=document.getElementById('worldBaseLevel');
  const countEl=document.getElementById('worldExploreCount');
  const researchEl=document.getElementById('worldResearch');
  const dexEl=document.getElementById('worldDexCount');
  if(baseEl)baseEl.textContent=`Lv.${lv}`;
  if(countEl)countEl.textContent=`${discovered} / ${WORLD_COLS*WORLD_ROWS}`;
  if(researchEl)researchEl.textContent=explore.research;
  if(dexEl)dexEl.textContent=`${registered} / ${DEX_ORDER.length}`;
}

function renderDex(){
  const grid=document.getElementById('dexGrid');if(!grid)return;
  const registered=DEX_ORDER.filter(k=>explore.dex[k]).length;
  const progress=document.getElementById('dexProgressText');
  const bar=document.getElementById('dexProgressBar');
  if(progress)progress.textContent=`${registered} / ${DEX_ORDER.length}`;
  if(bar)bar.style.width=`${registered/DEX_ORDER.length*100}%`;
  grid.innerHTML=DEX_ORDER.map(key=>{
    const def=terrainDefs[key],open=!!explore.dex[key],count=Number(explore.dexCounts[key])||0;
    return `<button type="button" class="dex-card ${open?'':'locked'}" data-dex="${key}" ${open?'':'disabled'}><span class="dex-icon">${open?def.icon:'？'}</span><span><b>${open?def.name:'？？？'}</b><small>${open?`${def.category} / 発見 ${count}回`:'未発見'}</small></span></button>`;
  }).join('');
  grid.querySelectorAll('[data-dex]:not([disabled])').forEach(btn=>btn.addEventListener('click',()=>showDexDetail(btn.dataset.dex)));
}

function showDexDetail(key){
  const def=terrainDefs[key];if(!def||!explore.dex[key])return;
  const count=Number(explore.dexCounts[key])||0;
  const detail=document.getElementById('dexDetail');
  if(detail)detail.innerHTML=`<b>${def.icon} ${def.name}</b><br>${def.desc}<br><br>分類：${def.category}<br>累計発見：${count}回<br>基本調査資料：+${def.research}`;
}

function setExploreMessage(title,hint='隣接する未踏マスをクリックして調査'){const a=document.getElementById('exploreStatus'),b=document.getElementById('exploreHint');if(a)a.textContent=title;if(b)b.textContent=hint;}

function discoverCell(x,y){
  const terrain=terrainAt(x,y),def=terrainDefs[terrain];
  explore.discovered[keyOf(x,y)]=terrain;
  explore.explorer={x,y};
  explore.research+=def.research;
  explore.findings++;
  const isNew=registerDex(terrain);
  saveExplore();
  setExploreMessage(`${def.icon} ${def.name}を発見 / 調査資料 +${def.research}${isNew?' / 図鑑に新規登録！':''}`);
  buildWorldGrid();
  if(isNew){const detail=document.getElementById('dexDetail');if(detail)detail.innerHTML=`<b>NEW! ${def.icon} ${def.name}</b><br>${def.desc}`;}
}

function onCellClick(x,y){
  const key=keyOf(x,y),known=explore.discovered[key];
  if(!known){
    if(isReachable(x,y))discoverCell(x,y);
    else setExploreMessage('そこにはまだ到達できません','探検隊に隣接する光ったマスから調査してください');
    return;
  }
  if(x===explore.explorer.x&&y===explore.explorer.y)return;
  if(adjacent(explore.explorer,{x,y})){
    explore.explorer={x,y};saveExplore();
    const name=known==='base'?'中央拠点':terrainDefs[known]?.name||'調査済み地域';
    setExploreMessage(`${name}へ移動`);
    buildWorldGrid();
  }else setExploreMessage('調査済みですが離れています','隣接マスをたどるか「拠点へ帰還」を使えます');
}

function returnBase(){explore.explorer={...BASE_POS};saveExplore();setExploreMessage('探検隊が拠点へ帰還しました');buildWorldGrid();}
function openDex(){const panel=document.getElementById('dexPanel');if(panel){panel.classList.add('open');panel.setAttribute('aria-hidden','false');renderDex();}}
function closeDex(){const panel=document.getElementById('dexPanel');if(panel){panel.classList.remove('open');panel.setAttribute('aria-hidden','true');}}

const returnBtn=document.getElementById('returnBaseBtn');if(returnBtn)returnBtn.addEventListener('click',returnBase);
const dexBtn=document.getElementById('dexBtn');if(dexBtn)dexBtn.addEventListener('click',openDex);
const dexCloseBtn=document.getElementById('dexCloseBtn');if(dexCloseBtn)dexCloseBtn.addEventListener('click',closeDex);

Object.values(explore.discovered).forEach(type=>{if(terrainDefs[type]){explore.dex[type]=true;if(!explore.dexCounts[type])explore.dexCounts[type]=1;}});
saveExplore();
buildWorldGrid();
setInterval(()=>{updateWorldHeader();},1200);
window.addEventListener('resize',buildWorldGrid);
