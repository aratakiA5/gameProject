const SAVE_KEY='seikai-corner-idle-v1';
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rand=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;

const baseCharacters=[
  {id:1,name:'レイナ',role:'主力',icon:'⚔',power:128,lv:1},
  {id:2,name:'シエル',role:'術式',icon:'✧',power:116,lv:1},
  {id:3,name:'アデル',role:'守護',icon:'◆',power:108,lv:1},
  {id:4,name:'ノア',role:'支援',icon:'◇',power:102,lv:1},
  {id:5,name:'カリン',role:'射撃',icon:'➶',power:121,lv:1},
  {id:6,name:'ミレイ',role:'治癒',icon:'✚',power:99,lv:1}
];

const areas=[
  {name:'星屑の回廊',enemies:['星蝕ウルフ','星屑スライム','廃都バット'],boss:'晶牙フェンリル'},
  {name:'蒼晶坑道',enemies:['晶殻ゴーレム','蒼鉱ワーム','坑道ミミック'],boss:'鉱王タイタス'},
  {name:'忘却庭園',enemies:['夢喰いの花','霧羽モス','古樹の番人'],boss:'夢花女王エルシア'},
  {name:'月影祭壇',enemies:['月輪の騎士','影走り','祭壇の魔像'],boss:'月蝕騎士ノクス'},
  {name:'星界中枢',enemies:['星骸兵','虚空の眼','中枢守護機'],boss:'虚星竜アステル'}
];

const buildingDefs={
  mine:{name:'遺晶採掘所',icon:'⛏',desc:'時間経過で遺晶を生産',effect:lv=>`+${lv*2} ◆/分`},
  barracks:{name:'訓練所',icon:'⚔',desc:'遠征隊の攻撃力を上昇',effect:lv=>`攻撃 +${lv*4}%`},
  infirmary:{name:'治療院',icon:'✚',desc:'遠征隊の最大HPを上昇',effect:lv=>`HP +${lv*5}%`},
  workshop:{name:'工房',icon:'⚙',desc:'敵撃破時の遺晶報酬を増加',effect:lv=>`報酬 +${lv*5}%`},
  observatory:{name:'観測塔',icon:'🔭',desc:'遠征支援で攻撃とHPを少し強化',effect:lv=>`攻撃/HP +${lv*2}%`},
  garden:{name:'星花園',icon:'✿',desc:'少量の遺晶を生産',effect:lv=>`+${lv} ◆/分`}
};

let state=loadState();
let characters=state.characters;
let party=[];
let enemy=null;
let paused=false;
let expanded=false;
let battleToken=0;
let resourceBuffer=0;

function freshState(){
  return{
    characters:baseCharacters.map(x=>({...x})),
    selected:[1,2,3,6],crystal:120,expedition:0,area:0,wave:1,kills:0,
    buildings:{mine:0,barracks:0,infirmary:0,workshop:0,observatory:0,garden:0},
    lastResourceTs:Date.now()
  };
}

function loadState(){
  try{
    const raw=JSON.parse(localStorage.getItem(SAVE_KEY));
    if(!raw)return freshState();
    const fresh=freshState();
    const loaded={...fresh,...raw};
    loaded.buildings={...fresh.buildings,...(raw.buildings||{})};
    loaded.characters=baseCharacters.map(base=>({...base,...(raw.characters||[]).find(c=>c.id===base.id)}));
    return loaded;
  }catch{return freshState();}
}

function save(){state.characters=characters;state.lastResourceTs=Date.now();localStorage.setItem(SAVE_KEY,JSON.stringify(state));}
function selectedCharacters(){return characters.filter(c=>state.selected.includes(c.id));}
function buildingLevel(key){return state.buildings[key]||0;}
function baseLevel(){return 1+Object.values(state.buildings).reduce((a,b)=>a+b,0);}
function incomePerMinute(){return buildingLevel('mine')*2+buildingLevel('garden');}
function attackBonus(){return buildingLevel('barracks')*.04+buildingLevel('observatory')*.02;}
function hpBonus(){return buildingLevel('infirmary')*.05+buildingLevel('observatory')*.02;}
function rewardBonus(){return buildingLevel('workshop')*.05;}
function buildingCost(key){const lv=buildingLevel(key);return 45+lv*45+Math.floor(lv*lv*8);}

function applyOfflineIncome(){
  const last=Number(state.lastResourceTs)||Date.now();
  const seconds=Math.min(8*60*60,Math.max(0,(Date.now()-last)/1000));
  const amount=Math.floor(seconds*incomePerMinute()/60);
  if(amount>0){state.crystal+=amount;setTimeout(()=>appendLog(`拠点の放置生産：◆${amount} を回収`),0);}
  state.lastResourceTs=Date.now();
}

function maxHpFor(c){return Math.round(c.power*(c.role==='守護'?5.8:4.4)*(1+hpBonus()));}
function createParty(){return selectedCharacters().map(c=>({...c,maxHp:maxHpFor(c),hp:maxHpFor(c),buff:1}));}
function living(){return party.filter(c=>c.hp>0);}
function area(){return areas[state.area%areas.length];}
function enemyScale(){return 1+(state.area*.34)+((state.wave-1)*.065);}

function spawnEnemy(){
  const boss=state.wave===10;
  const a=area();
  const name=boss?a.boss:a.enemies[(state.wave-1)%a.enemies.length];
  const base=220*enemyScale();
  const power=Math.round(base*(boss?1.42:1));
  const maxHp=Math.round(power*(boss?5.7:4.2));
  enemy={name,power,maxHp,hp:maxHp,boss,icon:boss?'♛':['👾','✦','◈'][(state.wave-1)%3]};
  renderBattlefield();
}

function renderAll(){
  $('crystal').textContent=state.crystal;
  $('expedition').textContent=state.expedition;
  $('waveLabel').textContent=`${state.wave} / 10`;
  $('areaLabel').textContent=area().name;
  renderRoster();renderTrain();renderVillage();renderBattlefield();
}

function renderRoster(){
  $('roster').innerHTML=characters.map(c=>`<div class="character ${state.selected.includes(c.id)?'selected':''}" data-id="${c.id}"><b>${c.icon} ${c.name}</b><small>Lv.${c.lv} / ${c.role} / 戦力 ${c.power}</small></div>`).join('');
  document.querySelectorAll('.character').forEach(el=>el.onclick=()=>{
    const id=Number(el.dataset.id);
    if(state.selected.includes(id)){if(state.selected.length>1)state.selected=state.selected.filter(x=>x!==id);}else if(state.selected.length<4)state.selected.push(id);
    save();renderRoster();appendLog('編成を変更。次の戦闘から反映されます。');
  });
}

function renderTrain(){
  $('trainList').innerHTML=characters.map(c=>`<div class="train-row"><div><b>${c.icon} ${c.name} Lv.${c.lv}</b><span>戦力 ${c.power} / 強化費 ◆${trainCost(c)}</span></div><button data-train="${c.id}" ${state.crystal<trainCost(c)?'disabled':''}>強化</button></div>`).join('');
  document.querySelectorAll('[data-train]').forEach(btn=>btn.onclick=()=>train(Number(btn.dataset.train)));
}
function trainCost(c){return 20+(c.lv-1)*8;}
function train(id){
  const c=characters.find(x=>x.id===id),cost=trainCost(c);if(state.crystal<cost)return;
  state.crystal-=cost;c.lv++;c.power+=18+rand(0,7);save();renderAll();appendLog(`${c.name}をLv.${c.lv}へ強化。戦力 ${c.power}。`);
}

function renderVillage(){
  $('baseLevel').textContent=`Lv.${baseLevel()}`;
  $('incomeRate').textContent=incomePerMinute();
  $('atkBonus').textContent=`+${Math.round(attackBonus()*100)}%`;
  $('hpBonus').textContent=`+${Math.round(hpBonus()*100)}%`;
  const built=Object.entries(buildingDefs).filter(([key])=>buildingLevel(key)>0);
  const plots=[];
  plots.push(`<div class="plot"><div><div class="building">🏰</div><small>中央拠点 Lv.${baseLevel()}</small></div></div>`);
  built.forEach(([key,def])=>plots.push(`<div class="plot"><div><div class="building">${def.icon}</div><small>${def.name}<br>Lv.${buildingLevel(key)}</small></div></div>`));
  while(plots.length<8)plots.push('<div class="plot empty"><div><div class="building">＋</div><small>空き地</small></div></div>');
  $('villageMap').innerHTML=plots.slice(0,8).join('');
  $('buildingList').innerHTML=Object.entries(buildingDefs).map(([key,def])=>{
    const lv=buildingLevel(key),cost=buildingCost(key);
    return `<div class="building-row"><div><b>${def.icon} ${def.name} ${lv?`Lv.${lv}`:'未建設'}</b><span>${def.desc}</span><small>${lv?def.effect(lv):'建設すると効果が発生'}</small></div><button data-building="${key}" ${state.crystal<cost?'disabled':''}>${lv?'強化':'建設'} ◆${cost}</button></div>`;
  }).join('');
  document.querySelectorAll('[data-building]').forEach(btn=>btn.onclick=()=>upgradeBuilding(btn.dataset.building));
}

function upgradeBuilding(key){
  const cost=buildingCost(key);if(state.crystal<cost)return;
  const was=buildingLevel(key);state.crystal-=cost;state.buildings[key]=was+1;
  save();renderAll();appendLog(`${buildingDefs[key].icon} ${buildingDefs[key].name}を${was?'強化':'建設'}。Lv.${was+1}`);
}

function renderBattlefield(){
  if(!party.length)party=createParty();
  $('partyField').innerHTML=party.map(c=>`<div id="ally-${c.id}" class="unit ${c.hp<=0?'dead':''}"><div class="sprite">${c.icon}</div><span class="unit-name">${c.name}</span><div class="unit-hp"><i style="width:${Math.max(0,c.hp/c.maxHp*100)}%"></i></div></div>`).join('');
  if(enemy){
    $('enemyField').innerHTML=`<div id="enemyUnit" class="unit enemy"><div class="sprite">${enemy.icon}</div><span class="unit-name">${enemy.boss?'BOSS ':''}${enemy.name}</span><div class="unit-hp"><i style="width:${Math.max(0,enemy.hp/enemy.maxHp*100)}%"></i></div></div>`;
    $('enemyName').textContent=(enemy.boss?'BOSS / ':'')+enemy.name;
    $('enemyHpText').textContent=`${Math.max(0,Math.round(enemy.hp))} / ${enemy.maxHp}`;
    $('enemyHpBar').style.width=`${Math.max(0,enemy.hp/enemy.maxHp*100)}%`;
  }
}

function updateUnitHp(id){const unit=party.find(c=>c.id===id),el=$(`ally-${id}`);if(!unit||!el)return;el.querySelector('.unit-hp i').style.width=`${Math.max(0,unit.hp/unit.maxHp*100)}%`;if(unit.hp<=0)el.classList.add('dead');}
function updateEnemyHp(){if(!enemy)return;$('enemyHpText').textContent=`${Math.max(0,Math.round(enemy.hp))} / ${enemy.maxHp}`;$('enemyHpBar').style.width=`${Math.max(0,enemy.hp/enemy.maxHp*100)}%`;const bar=document.querySelector('#enemyUnit .unit-hp i');if(bar)bar.style.width=`${Math.max(0,enemy.hp/enemy.maxHp*100)}%`;}
function animate(id,cls='attacking'){const el=$(id);if(!el)return;el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),240);}
function floatText(text){const el=$('floatText');el.textContent=text;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
function appendLog(msg){const log=$('battleLog');if(!log)return;const row=document.createElement('div');row.innerHTML=msg;log.appendChild(row);while(log.children.length>80)log.removeChild(log.firstChild);log.scrollTop=log.scrollHeight;}

async function allyTurn(actor,token){
  if(token!==battleToken||paused||actor.hp<=0||!enemy||enemy.hp<=0)return;
  if(actor.role==='治癒'){
    const target=[...living()].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if(target&&target.hp/target.maxHp<.72){const heal=Math.min(target.maxHp-target.hp,Math.round(actor.power*(.78+Math.random()*.24)));target.hp+=heal;animate(`ally-${actor.id}`);updateUnitHp(target.id);floatText(`+${heal} HP`);appendLog(`✚ ${actor.name} → ${target.name}を${heal}回復`);return;}
  }
  if(actor.role==='支援'){living().forEach(x=>x.buff=1.2);animate(`ally-${actor.id}`);floatText('ATK UP');appendLog(`◇ ${actor.name} → 味方を強化`);return;}
  let multi=.58+Math.random()*.28;if(actor.role==='主力')multi+=.18;if(actor.role==='術式')multi+=.1;
  let critical=false;if(actor.role==='射撃'&&Math.random()<.32){multi*=1.7;critical=true;}
  const dmg=Math.max(1,Math.round(actor.power*multi*actor.buff*(1+attackBonus())));actor.buff=1;enemy.hp-=dmg;
  animate(`ally-${actor.id}`);setTimeout(()=>animate('enemyUnit','hit'),100);updateEnemyHp();floatText(`${critical?'CRIT ':''}-${dmg}`);appendLog(`${actor.icon} ${actor.name} → ${enemy.name} ${dmg}ダメージ`);
}

async function enemyTurn(token){
  if(token!==battleToken||paused||!enemy||enemy.hp<=0||!living().length)return;
  const tank=living().find(c=>c.role==='守護');const target=tank&&Math.random()<.65?tank:living()[rand(0,living().length-1)];
  let dmg=Math.round(enemy.power*(.10+Math.random()*.055));if(target.role==='守護')dmg=Math.round(dmg*.65);target.hp-=dmg;
  animate('enemyUnit');setTimeout(()=>animate(`ally-${target.id}`,'hit'),100);updateUnitHp(target.id);floatText(`-${dmg}`);appendLog(`◆ ${enemy.name} → ${target.name} ${dmg}ダメージ`);
}

async function battleLoop(){
  while(true){
    if(paused){await sleep(250);continue;}
    if(!enemy){party=createParty();spawnEnemy();appendLog(`WAVE ${state.wave}：${enemy.name} 出現`);}
    const token=++battleToken;let rounds=0;
    while(enemy&&enemy.hp>0&&living().length&&rounds<40&&token===battleToken){
      if(paused){await sleep(250);continue;}
      for(const actor of party){if(enemy.hp<=0||paused||token!==battleToken)break;await allyTurn(actor,token);await sleep(520);}
      if(enemy.hp<=0||paused||token!==battleToken)continue;
      await enemyTurn(token);await sleep(650);rounds++;
    }
    if(token!==battleToken)continue;
    if(enemy&&enemy.hp<=0)await victory();else if(!living().length||rounds>=40)await defeat();
    await sleep(850);
  }
}

async function victory(){
  const wasBoss=enemy.boss;
  const baseReward=Math.round(8+enemy.power*.055)+(wasBoss?25:0);
  const reward=Math.round(baseReward*(1+rewardBonus()));
  state.crystal+=reward;state.expedition+=wasBoss?15:3;state.kills++;
  appendLog(`<b>${enemy.name}撃破！</b> ◆${reward} 獲得`);$('statusText').textContent=`撃破数 ${state.kills} / 自動遠征中`;
  if(wasBoss){state.wave=1;state.area=(state.area+1)%areas.length;appendLog(`<b>AREA CLEAR</b> → ${area().name}`);}else state.wave++;
  enemy=null;party=createParty();save();renderAll();
}

async function defeat(){appendLog('<b>全滅。</b> 3秒後に再出撃します。');$('statusText').textContent='再編成中...';enemy=null;party=createParty();renderBattlefield();await sleep(3000);$('statusText').textContent='遠征中...';}

function resourceLoop(){
  let last=Date.now();
  setInterval(()=>{
    const now=Date.now(),sec=(now-last)/1000;last=now;
    resourceBuffer+=incomePerMinute()*sec/60;
    const gain=Math.floor(resourceBuffer);
    if(gain>0){resourceBuffer-=gain;state.crystal+=gain;$('crystal').textContent=state.crystal;renderTrain();renderVillage();}
  },1000);
  setInterval(save,15000);
}

$('expandBtn').onclick=()=>{expanded=!expanded;$('gameWindow').classList.toggle('expanded',expanded);$('expandBtn').textContent=expanded?'▼':'▲';};
$('pauseBtn').onclick=()=>{paused=!paused;$('gameWindow').classList.toggle('paused',paused);$('pauseBtn').textContent=paused?'▶':'Ⅱ';$('statusText').textContent=paused?'一時停止中':'遠征中...';};
document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.tab,.tab-content').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$(`${btn.dataset.tab}Tab`).classList.add('active');});
$('resetBtn').onclick=()=>{if(confirm('セーブデータを初期化しますか？')){localStorage.removeItem(SAVE_KEY);location.reload();}};

applyOfflineIncome();
party=createParty();spawnEnemy();renderAll();appendLog('自動遠征を開始しました。');battleLoop();resourceLoop();
