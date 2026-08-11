const WORLD_SAVE_KEY='seikai-corner-idle-v1';
const WORLD_COLS=18;
const WORLD_ROWS=10;
const worldBuildingDefs={
  mine:{name:'遺晶採掘所',icon:'⛏'},
  barracks:{name:'訓練所',icon:'⚔'},
  infirmary:{name:'治療院',icon:'✚'},
  workshop:{name:'工房',icon:'⚙'},
  observatory:{name:'観測塔',icon:'🔭'},
  garden:{name:'星花園',icon:'✿'}
};
const worldSlots={base:[7,4],mine:[4,5],barracks:[9,5],infirmary:[6,6],workshop:[11,6],observatory:[8,2],garden:[3,7]};
let lastWorldSnapshot='';

function readWorldState(){
  try{return JSON.parse(localStorage.getItem(WORLD_SAVE_KEY))||{};}catch{return {};}
}
function worldLevel(buildings){return 1+Object.values(buildings||{}).reduce((a,b)=>a+(Number(b)||0),0);}
function worldIncome(buildings){return (Number(buildings?.mine)||0)*2+(Number(buildings?.garden)||0);}
function cellIndex(x,y){return y*WORLD_COLS+x;}
function buildWorldGrid(){
  const grid=document.getElementById('worldGrid');
  if(!grid)return;
  const cells=[];
  for(let y=0;y<WORLD_ROWS;y++){
    for(let x=0;x<WORLD_COLS;x++){
      let terrain='';
      if((y===4||y===5)&&x>1&&x<15)terrain=' path';
      if((x===7||x===8)&&y>1&&y<9)terrain=' path';
      if((x>14&&y<3)||(x<2&&y>7))terrain=' water';
      cells.push(`<div class="world-cell${terrain}" data-cell="${cellIndex(x,y)}"></div>`);
    }
  }
  grid.innerHTML=cells.join('');
}
function placeEntity(x,y,html,extra=''){
  const grid=document.getElementById('worldGrid');
  if(!grid)return;
  const cell=grid.querySelector(`[data-cell="${cellIndex(x,y)}"]`);
  if(!cell)return;
  cell.innerHTML=`<div class="world-entity ${extra}">${html}</div>`;
}
function renderWorld(){
  const data=readWorldState();
  const buildings=data.buildings||{};
  const snapshot=JSON.stringify(buildings);
  if(snapshot===lastWorldSnapshot)return;
  lastWorldSnapshot=snapshot;
  buildWorldGrid();
  const level=worldLevel(buildings);
  placeEntity(...worldSlots.base,`<span class="icon">🏰</span><b>中央拠点</b><small>Lv.${level}</small>`,'base');
  Object.entries(worldBuildingDefs).forEach(([key,def])=>{
    const lv=Number(buildings[key])||0;
    if(!lv)return;
    const [x,y]=worldSlots[key];
    placeEntity(x,y,`<span class="icon">${def.icon}</span><b>${def.name}</b><small>Lv.${lv}</small>`);
  });
  const built=Object.values(buildings).filter(v=>Number(v)>0).length;
  const baseEl=document.getElementById('worldBaseLevel');
  const incomeEl=document.getElementById('worldIncome');
  const countEl=document.getElementById('worldBuildingCount');
  if(baseEl)baseEl.textContent=`Lv.${level}`;
  if(incomeEl)incomeEl.textContent=`${worldIncome(buildings)} ◆/分`;
  if(countEl)countEl.textContent=`${built} / 6`;
}

buildWorldGrid();
renderWorld();
setInterval(renderWorld,1000);
window.addEventListener('resize',()=>{lastWorldSnapshot='';renderWorld();});
