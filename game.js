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

let selected=[];
let selectedForTrain=null;
let unlocked=1;
let currentStage=0;
let crystal=120;
let expedition=0;
let clears=0;
let trained=0;
let battling=false;

const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rand=(min,max)=>Math.floor(Math.random()*(max-min+1))+min;

function renderRoster(){
  $('roster').innerHTML=characters.map(c=>`<article class="character ${selected.includes(c.id)?'selected':''}" data-id="${c.id}"><div class="portrait">${c.icon}</div><h3>${c.name} <small>Lv.${c.lv}</small></h3><p>${c.role}</p><span class="power">戦力 ${c.power}</span></article>`).join('');
  document.querySelectorAll('.character').forEach(el=>el.onclick=()=>{
    if(!battling) toggleCharacter(Number(el.dataset.id));
  });
}

function toggleCharacter(id){
  selectedForTrain=id;
  if(selected.includes(id)) selected=selected.filter(x=>x!==id);
  else if(selected.length<4) selected.push(id);
  render();
}

function partyPower(){
  return characters.filter(c=>selected.includes(c.id)).reduce((s,c)=>s+c.power,0);
}

function renderStages(){
  $('stages').innerHTML=stages.map((s,i)=>`<div class="stage ${i>=unlocked?'locked':''} ${i===currentStage?'active':''}" data-stage="${i}"><strong>第${i+1}層</strong><small>${s.name}</small><small>推奨 ${s.power}</small></div>`).join('');
  document.querySelectorAll('.stage:not(.locked)').forEach(el=>el.onclick=()=>{
    if(!battling){
      currentStage=Number(el.dataset.stage);
      render();
    }
  });
}

function render(){
  renderRoster();
  renderStages();
  const s=stages[currentStage];
  $('stageName').textContent=`第${currentStage+1}層・${s.name}`;
  $('difficulty').textContent=`推奨戦力 ${s.power}`;
  $('enemyName').textContent=s.enemy;
  $('enemyFlavor').textContent=s.flavor;
  $('enemyPower').textContent=s.power;
  $('partyCount').textContent=`${selected.length} / 4`;
  $('partyPower').textContent=partyPower();
  $('crystal').textContent=crystal;
  $('expedition').textContent=expedition;
  $('missionClear').textContent=`${Math.min(clears,1)} / 1`;
  $('missionTrain').textContent=`${Math.min(trained,1)} / 1`;
  $('battleBtn').disabled=battling||selected.length===0;
  $('battleBtn').textContent=battling?'オート戦闘中...':'遠征開始';
  $('trainBtn').disabled=battling||!selectedForTrain||crystal<20;
}

function createBattleParty(){
  return characters
    .filter(c=>selected.includes(c.id))
    .map(c=>{
      const isTank=c.role.includes('守護');
      const maxHp=Math.round(c.power*(isTank?6.4:4.8));
      return {...c,maxHp,hp:maxHp,buff:1};
    });
}

function livingParty(party){
  return party.filter(c=>c.hp>0);
}

function hpText(unit){
  return `${Math.max(0,Math.round(unit.hp))}/${unit.maxHp}`;
}

function appendLog(message){
  const log=$('battleLog');
  log.innerHTML+=`<div>${message}</div>`;
  log.scrollTop=log.scrollHeight;
}

async function allyAction(actor,party,enemy,turn){
  if(actor.hp<=0||enemy.hp<=0) return;

  if(actor.role.includes('治癒')){
    const injured=livingParty(party).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
    if(injured && injured.hp/injured.maxHp<0.82){
      const heal=Math.round(actor.power*(0.8+Math.random()*0.25));
      const actual=Math.min(heal,injured.maxHp-injured.hp);
      injured.hp+=actual;
      appendLog(`✚ ${actor.name}が${injured.name}を回復。HP +${actual}（${hpText(injured)}）`);
      return;
    }
  }

  if(actor.role.includes('支援')){
    const allies=livingParty(party).filter(c=>c.id!==actor.id);
    if(allies.length){
      allies.forEach(c=>c.buff=1.18);
      appendLog(`◇ ${actor.name}が味方を支援。次の攻撃ダメージが上昇。`);
    }
  }

  let multiplier=0.62+Math.random()*0.28;
  if(actor.role.includes('主力')) multiplier+=0.16;
  if(actor.role.includes('会心') && Math.random()<0.32){
    multiplier*=1.65;
    appendLog(`➶ ${actor.name}の会心攻撃！`);
  }
  if(actor.role.includes('範囲')) multiplier+=0.08;

  const damage=Math.max(1,Math.round(actor.power*multiplier*actor.buff));
  actor.buff=1;
  enemy.hp-=damage;
  appendLog(`${actor.icon} ${actor.name}の攻撃。${enemy.name}に <strong>${damage}</strong> ダメージ（敵HP ${Math.max(0,enemy.hp)}/${enemy.maxHp}）`);
}

async function enemyAction(enemy,party,turn){
  const targets=livingParty(party);
  if(!targets.length||enemy.hp<=0) return;

  let target;
  const tank=targets.find(c=>c.role.includes('守護'));
  target=tank&&Math.random()<0.65?tank:targets[rand(0,targets.length-1)];

  let damage=Math.round(enemy.power*(0.12+Math.random()*0.07));
  if(target.role.includes('守護')) damage=Math.round(damage*0.68);

  if(turn%4===0){
    appendLog(`⚠ ${enemy.name}が強力な攻撃を放つ！`);
    damage=Math.round(damage*1.55);
  }

  target.hp-=damage;
  appendLog(`◆ ${enemy.name}の攻撃。${target.name}に <strong>${damage}</strong> ダメージ（HP ${hpText(target)}）`);
  if(target.hp<=0) appendLog(`— ${target.name}は戦闘不能になった。`);
}

async function startAutoBattle(){
  if(battling||selected.length===0) return;

  battling=true;
  render();

  const s=stages[currentStage];
  const party=createBattleParty();
  const enemy={
    name:s.enemy,
    power:s.power,
    maxHp:Math.round(s.power*4.1),
    hp:Math.round(s.power*4.1)
  };

  $('battleLog').innerHTML=`<div><strong>AUTO BATTLE START</strong></div><div>${s.enemy} HP ${enemy.hp} / ${enemy.maxHp}</div>`;
  await sleep(500);

  let turn=1;
  const maxTurns=30;

  while(livingParty(party).length&&enemy.hp>0&&turn<=maxTurns){
    appendLog(`<br><strong>TURN ${turn}</strong>`);

    for(const actor of party){
      if(enemy.hp<=0) break;
      await allyAction(actor,party,enemy,turn);
      await sleep(420);
    }

    if(enemy.hp<=0) break;
    await enemyAction(enemy,party,turn);
    await sleep(520);
    turn++;
  }

  if(enemy.hp<=0){
    clears++;
    crystal+=s.reward;
    expedition+=10*(currentStage+1);
    const newlyUnlocked=currentStage===unlocked-1&&unlocked<stages.length;
    if(newlyUnlocked) unlocked++;
    appendLog(`<br><strong>遠征成功。</strong> ${s.enemy}を撃破！ 遺晶 +${s.reward} / 遠征Pt +${10*(currentStage+1)}${newlyUnlocked?' / 次の階層が解放されました。':''}`);
  }else{
    expedition+=2;
    appendLog(`<br><strong>遠征失敗。</strong> パーティが全滅、または30ターン経過。遠征Pt +2`);
  }

  battling=false;
  render();
}

$('battleBtn').onclick=startAutoBattle;

$('trainBtn').onclick=()=>{
  if(battling||!selectedForTrain||crystal<20) return;
  const c=characters.find(x=>x.id===selectedForTrain);
  crystal-=20;
  c.lv++;
  c.power+=18+Math.floor(Math.random()*8);
  trained++;
  $('battleLog').innerHTML=`${c.name}をLv.${c.lv}へ強化しました。現在の戦力は ${c.power}。`;
  render();
};

render();
