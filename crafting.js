const CRAFT_SAVE_KEY='seikai-crafting-v1';

const equipmentDefs={
  starBlade:{name:'星鉄の剣',icon:'⚔️',slot:'weapon',atk:.10,hp:0,desc:'星鉄を鍛えた標準武器。探検隊の攻撃力を高める。',research:8,recipe:{'硬質鉱':2,'星角片':2}},
  mistBow:{name:'霧牙の弓',icon:'🏹',slot:'weapon',atk:.16,hp:0,desc:'霧牙と薄羽を組み合わせた軽量武器。',research:16,recipe:{'霧牙':3,'薄羽':2,'星鱗粉':2}},
  crystalArmor:{name:'晶石装甲',icon:'🛡️',slot:'armor',atk:0,hp:.16,desc:'晶石核を組み込んだ防護装備。',research:12,recipe:{'晶石核':2,'鉱殻片':3}},
  ancientArmor:{name:'古代守護装甲',icon:'🥋',slot:'armor',atk:.04,hp:.24,desc:'旧文明の装甲片と回路を再利用した高性能防具。',research:24,recipe:{'古代装甲片':3,'旧文明回路':2,'機械部品':3}},
  surveyCharm:{name:'星界調査章',icon:'🧿',slot:'accessory',atk:.05,hp:.06,desc:'探索データを補助する携行装置。',research:10,recipe:{'星砂':2,'記録チップ':1,'遺晶欠片':2}},
  eclipseCore:{name:'星蝕制御核',icon:'🔮',slot:'accessory',atk:.12,hp:.12,desc:'危険な星蝕核を安定化した上位装備。',research:30,recipe:{'星蝕核':2,'暗色結晶':2,'旧文明回路':2}}
};
const equipmentOrder=Object.keys(equipmentDefs);
const slotNames={weapon:'武器',armor:'防具',accessory:'装飾'};

function freshCraftState(){return{materials:{},developed:{},crafted:{},equipped:{weapon:null,armor:null,accessory:null},migratedDrops:false};}
function loadCraftState(){try{const raw=JSON.parse(localStorage.getItem(CRAFT_SAVE_KEY));const fresh=freshCraftState();return raw?{...fresh,...raw,materials:{...fresh.materials,...(raw.materials||{})},developed:{...(raw.developed||{})},crafted:{...(raw.crafted||{})},equipped:{...fresh.equipped,...(raw.equipped||{})}}:fresh;}catch{return freshCraftState();}}
let craftState=loadCraftState();
function saveCraft(){localStorage.setItem(CRAFT_SAVE_KEY,JSON.stringify(craftState));}

function materialCount(name){return Number(craftState.materials[name])||0;}
function addMaterial(name,count=1){craftState.materials[name]=materialCount(name)+count;saveCraft();renderCrafting();}
function consumeMaterials(recipe){Object.entries(recipe).forEach(([name,count])=>{craftState.materials[name]=Math.max(0,materialCount(name)-count);});}
function hasMaterials(recipe){return Object.entries(recipe).every(([name,count])=>materialCount(name)>=count);}
function materialNames(){const names=new Set(Object.keys(craftState.materials));if(typeof enemyCatalog!=='undefined')Object.values(enemyCatalog).forEach(meta=>meta.drops.forEach(([item])=>names.add(item)));return [...names].sort((a,b)=>a.localeCompare(b,'ja'));}
function currentResearch(){return typeof explore!=='undefined'?Number(explore.research)||0:0;}
function spendResearch(amount){if(typeof explore==='undefined'||currentResearch()<amount)return false;explore.research-=amount;if(typeof saveExplore==='function')saveExplore();if(typeof updateWorldHeader==='function')updateWorldHeader();return true;}

function migrateHistoricDrops(){
  if(craftState.migratedDrops||typeof explore==='undefined'||!explore.enemyDex)return;
  Object.values(explore.enemyDex).forEach(entry=>Object.entries(entry.drops||{}).forEach(([item,count])=>{craftState.materials[item]=materialCount(item)+(Number(count)||0);}));
  craftState.migratedDrops=true;saveCraft();
}

function recipeHtml(recipe){return Object.entries(recipe).map(([item,count])=>`<span class="recipe-item ${materialCount(item)>=count?'ready':'missing'}">${item} ${materialCount(item)}/${count}</span>`).join('');}
function equipmentBonusText(def){const parts=[];if(def.atk)parts.push(`攻撃 +${Math.round(def.atk*100)}%`);if(def.hp)parts.push(`HP +${Math.round(def.hp*100)}%`);return parts.join(' / ');}

function developEquipment(key){
  const def=equipmentDefs[key];if(!def||craftState.developed[key]||currentResearch()<def.research)return;
  if(!spendResearch(def.research))return;
  craftState.developed[key]=true;saveCraft();renderCrafting();
  if(typeof setExploreMessage==='function')setExploreMessage(`開発完了：${def.name}`,'鍛冶タブで素材を使って製作できます');
}
function forgeEquipment(key){
  const def=equipmentDefs[key];if(!def||!craftState.developed[key]||!hasMaterials(def.recipe))return;
  consumeMaterials(def.recipe);craftState.crafted[key]=(Number(craftState.crafted[key])||0)+1;saveCraft();renderCrafting();
  if(typeof setExploreMessage==='function')setExploreMessage(`鍛冶完了：${def.name}`,'装備タブから探検隊へ装備できます');
}
function equipItem(key){
  const def=equipmentDefs[key];if(!def||!(Number(craftState.crafted[key])>0))return;
  craftState.equipped[def.slot]=craftState.equipped[def.slot]===key?null:key;saveCraft();renderCrafting();
  if(typeof resetExpeditionHp==='function')resetExpeditionHp();if(typeof buildWorldGrid==='function')buildWorldGrid();
}
function totalEquipmentBonuses(){
  let atk=0,hp=0;Object.values(craftState.equipped).forEach(key=>{const d=equipmentDefs[key];if(d){atk+=d.atk||0;hp+=d.hp||0;}});return{atk,hp};
}

function renderMaterials(){
  const host=document.getElementById('materialList');if(!host)return;
  const names=materialNames();host.innerHTML=names.length?names.map(name=>`<div class="material-row"><span>◆ ${name}</span><b>${materialCount(name)}</b></div>`).join(''):'<div class="craft-empty">まだ素材を入手していません。敵を倒すと素材が増えます。</div>';
}
function renderDevelopment(){
  const host=document.getElementById('developmentList');if(!host)return;
  host.innerHTML=equipmentOrder.map(key=>{const d=equipmentDefs[key],done=!!craftState.developed[key];return `<div class="craft-row"><div><b>${d.icon} ${d.name}</b><span>${slotNames[d.slot]} / ${equipmentBonusText(d)}</span><small>${d.desc}</small></div><button data-develop="${key}" ${done||currentResearch()<d.research?'disabled':''}>${done?'開発済':'開発 '+d.research+'資料'}</button></div>`;}).join('');
  host.querySelectorAll('[data-develop]').forEach(btn=>btn.addEventListener('click',()=>developEquipment(btn.dataset.develop)));
}
function renderForge(){
  const host=document.getElementById('forgeList');if(!host)return;
  const developed=equipmentOrder.filter(k=>craftState.developed[k]);
  host.innerHTML=developed.length?developed.map(key=>{const d=equipmentDefs[key],can=hasMaterials(d.recipe);return `<div class="craft-row"><div><b>${d.icon} ${d.name}</b><span>${equipmentBonusText(d)} / 所持 ${Number(craftState.crafted[key])||0}</span><div class="recipe">${recipeHtml(d.recipe)}</div></div><button data-forge="${key}" ${can?'':'disabled'}>鍛冶</button></div>`;}).join(''):'<div class="craft-empty">先に「開発」で装備レシピを解放してください。</div>';
  host.querySelectorAll('[data-forge]').forEach(btn=>btn.addEventListener('click',()=>forgeEquipment(btn.dataset.forge)));
}
function renderEquipment(){
  const host=document.getElementById('equipmentList');if(!host)return;
  const crafted=equipmentOrder.filter(k=>(Number(craftState.crafted[k])||0)>0);
  const bonus=totalEquipmentBonuses();
  const summary=document.getElementById('equipmentBonus');if(summary)summary.textContent=`装備補正：攻撃 +${Math.round(bonus.atk*100)}% / HP +${Math.round(bonus.hp*100)}%`;
  host.innerHTML=crafted.length?crafted.map(key=>{const d=equipmentDefs[key],equipped=craftState.equipped[d.slot]===key;return `<div class="craft-row equipped-row ${equipped?'active':''}"><div><b>${d.icon} ${d.name}</b><span>${slotNames[d.slot]} / ${equipmentBonusText(d)}</span><small>所持 ${craftState.crafted[key]}${equipped?' / 装備中':''}</small></div><button data-equip="${key}">${equipped?'外す':'装備'}</button></div>`;}).join(''):'<div class="craft-empty">鍛冶で装備を製作するとここに表示されます。</div>';
  host.querySelectorAll('[data-equip]').forEach(btn=>btn.addEventListener('click',()=>equipItem(btn.dataset.equip)));
}
function renderCrafting(){
  const research=document.getElementById('craftResearch');if(research)research.textContent=currentResearch();
  renderMaterials();renderDevelopment();renderForge();renderEquipment();
}

function openCraftPanel(){const p=document.getElementById('craftPanel');if(p){p.classList.add('open');p.setAttribute('aria-hidden','false');renderCrafting();}}
function closeCraftPanel(){const p=document.getElementById('craftPanel');if(p){p.classList.remove('open');p.setAttribute('aria-hidden','true');}}
function switchCraftTab(tab){document.querySelectorAll('.craft-tab,.craft-content').forEach(el=>el.classList.remove('active'));document.querySelector(`.craft-tab[data-craft-tab="${tab}"]`)?.classList.add('active');document.getElementById(`${tab}Craft`)?.classList.add('active');renderCrafting();}

document.getElementById('craftBtn')?.addEventListener('click',openCraftPanel);
document.getElementById('craftCloseBtn')?.addEventListener('click',closeCraftPanel);
document.querySelectorAll('[data-craft-tab]').forEach(btn=>btn.addEventListener('click',()=>switchCraftTab(btn.dataset.craftTab)));

migrateHistoricDrops();

if(typeof recordEnemyDefeat==='function'){
  const craftingOriginalRecordEnemyDefeat=recordEnemyDefeat;
  recordEnemyDefeat=function(name){
    const before={...((explore.enemyDex?.[name]?.drops)||{})};
    craftingOriginalRecordEnemyDefeat(name);
    const after=explore.enemyDex?.[name]?.drops||{};
    Object.entries(after).forEach(([item,count])=>{const gained=(Number(count)||0)-(Number(before[item])||0);if(gained>0)addMaterial(item,gained);});
  };
}

if(typeof partyStats==='function'){
  const craftingOriginalPartyStats=partyStats;
  partyStats=function(){const stats=craftingOriginalPartyStats();const bonus=totalEquipmentBonuses();return{...stats,power:Math.round(stats.power*(1+bonus.atk)),maxHp:Math.round(stats.maxHp*(1+bonus.hp))};};
}

renderCrafting();
