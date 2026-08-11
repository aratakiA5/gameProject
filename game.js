const characters = [
  {id:1,name:'レイナ',role:'斬撃 / 主力',icon:'⚔',power:128,lv:1},
  {id:2,name:'シエル',role:'術式 / 範囲',icon:'✧',power:116,lv:1},
  {id:3,name:'アデル',role:'守護 / 防御',icon:'◆',power:108,lv:1},
  {id:4,name:'ノア',role:'支援 / 加速',icon:'◇',power:102,lv:1},
  {id:5,name:'カリン',role:'射撃 / 会心',icon:'➶',power:121,lv:1},
  {id:6,name:'ミレイ',role:'治癒 / 回復',icon:'✚',power:99,lv:1}
];

const stages = [
  {name:'星屑の回廊',enemy:'星蝕ウルフ',flavor:'星の残滓に侵食された群れの先導個体。',power:320,reward:35},
  {name:'蒼晶坑道',enemy:'晶殻ゴーレム',flavor:'鉱脈の魔力を取り込み続ける古代兵器。',power:430,reward:45},
  {name:'忘却庭園',enemy:'夢喰いの花',flavor:'甘い幻覚で旅人を惑わせる巨大植物。',power:550,reward:55},
  {name:'月影祭壇',enemy:'月輪の騎士',flavor:'主を失ってなお祭壇を守り続ける騎士。',power:680,reward:70},
  {name:'星界中枢',enemy:'虚星竜アステル',flavor:'遺跡最深部で眠る星界の守護竜。',power:830,reward:100}
];

let selected=[]; let selectedForTrain=null; let unlocked=1; let currentStage=0; let crystal=120; let expedition=0; let clears=0; let trained=0;
const $=id=>document.getElementById(id);

function renderRoster(){
  $('roster').innerHTML=characters.map(c=>`<article class="character ${selected.includes(c.id)?'selected':''}" data-id="${c.id}"><div class="portrait">${c.icon}</div><h3>${c.name} <small>Lv.${c.lv}</small></h3><p>${c.role}</p><span class="power">戦力 ${c.power}</span></article>`).join('');
  document.querySelectorAll('.character').forEach(el=>el.onclick=()=>toggleCharacter(Number(el.dataset.id)));
}
function toggleCharacter(id){
  selectedForTrain=id;
  if(selected.includes(id)) selected=selected.filter(x=>x!==id); else if(selected.length<4) selected.push(id);
  render();
}
function partyPower(){ return characters.filter(c=>selected.includes(c.id)).reduce((s,c)=>s+c.power,0); }
function renderStages(){
  $('stages').innerHTML=stages.map((s,i)=>`<div class="stage ${i>=unlocked?'locked':''} ${i===currentStage?'active':''}" data-stage="${i}"><strong>第${i+1}層</strong><small>${s.name}</small><small>推奨 ${s.power}</small></div>`).join('');
  document.querySelectorAll('.stage:not(.locked)').forEach(el=>el.onclick=()=>{currentStage=Number(el.dataset.stage);render();});
}
function render(){
  renderRoster(); renderStages();
  const s=stages[currentStage];
  $('stageName').textContent=`第${currentStage+1}層・${s.name}`; $('difficulty').textContent=`推奨戦力 ${s.power}`; $('enemyName').textContent=s.enemy; $('enemyFlavor').textContent=s.flavor; $('enemyPower').textContent=s.power;
  $('partyCount').textContent=`${selected.length} / 4`; $('partyPower').textContent=partyPower(); $('crystal').textContent=crystal; $('expedition').textContent=expedition;
  $('missionClear').textContent=`${Math.min(clears,1)} / 1`; $('missionTrain').textContent=`${Math.min(trained,1)} / 1`;
  $('battleBtn').disabled=selected.length===0; $('trainBtn').disabled=!selectedForTrain||crystal<20;
}
$('battleBtn').onclick=()=>{
  const s=stages[currentStage], p=partyPower();
  const supportBonus=selected.some(id=>characters.find(c=>c.id===id).role.includes('支援'))?1.08:1;
  const healBonus=selected.some(id=>characters.find(c=>c.id===id).role.includes('治癒'))?1.06:1;
  const effective=Math.round(p*supportBonus*healBonus*(.92+Math.random()*.18));
  if(effective>=s.power){
    clears++; crystal+=s.reward; expedition+=10*(currentStage+1); if(currentStage===unlocked-1&&unlocked<stages.length) unlocked++;
    $('battleLog').innerHTML=`<strong>遠征成功。</strong> ${s.enemy}を撃破。遺晶 +${s.reward} / 遠征Pt +${10*(currentStage+1)}${unlocked>currentStage+1?'。次の階層が解放されました。':''}`;
  } else {
    expedition+=2; $('battleLog').innerHTML=`<strong>遠征失敗。</strong> 有効戦力 ${effective}。編成や育成を見直すと突破しやすくなります。遠征Pt +2`;
  }
  render();
};
$('trainBtn').onclick=()=>{
  if(!selectedForTrain||crystal<20)return; const c=characters.find(x=>x.id===selectedForTrain); crystal-=20; c.lv++; c.power+=18+Math.floor(Math.random()*8); trained++;
  $('battleLog').innerHTML=`${c.name}をLv.${c.lv}へ強化しました。現在の戦力は ${c.power}。`;
  render();
};
render();
