const enemyCatalog={
  '原野スライム':{icon:'🟢',terrain:'plains',desc:'平原に広く生息する小型生命体。刺激すると体当たりで反撃する。',drops:[['粘液核',55],['星砂',20]]},
  '星角ラビット':{icon:'🐇',terrain:'plains',desc:'額に星晶質の角を持つ俊敏な草食獣。',drops:[['星角片',45],['柔毛',30]]},
  '霧牙ウルフ':{icon:'🐺',terrain:'forest',desc:'星霧の森で群れを作る捕食者。霧の中から急襲する。',drops:[['霧牙',50],['獣皮',28]]},
  '森影モス':{icon:'🦋',terrain:'forest',desc:'星霧に擬態する大型の蛾。鱗粉には特殊な反応がある。',drops:[['星鱗粉',48],['薄羽',26]]},
  '鉱殻ワーム':{icon:'🪱',terrain:'mineral',desc:'鉱石を取り込んで硬い外殻を形成する地中生物。',drops:[['鉱殻片',52],['遺晶欠片',22]]},
  '晶石ゴーレム':{icon:'🗿',terrain:'mineral',desc:'鉱脈の星界エネルギーで動く岩石生命体。',drops:[['晶石核',42],['硬質鉱',30]]},
  '遺跡ガーディアン':{icon:'🛡',terrain:'ruins',desc:'古代遺跡を守る自律型守護機。現在も侵入者を排除する。',drops:[['古代装甲片',44],['記録チップ',18]]},
  '古代ドローン':{icon:'🛸',terrain:'ruins',desc:'旧文明の小型偵察機。長い年月を経ても稼働している。',drops:[['機械部品',50],['旧文明回路',20]]},
  '虚界ハウンド':{icon:'🐕',terrain:'danger',desc:'虚界反応に侵食された獣。通常個体より攻撃性が高い。',drops:[['虚界の牙',46],['暗色結晶',24]]},
  '星蝕獣':{icon:'👹',terrain:'danger',desc:'強い星蝕反応を帯びた危険個体。遠征隊にとって大きな脅威。',drops:[['星蝕核',36],['変異組織',24]]},
  '水晶クラブ':{icon:'🦀',terrain:'water',desc:'水域に棲む甲殻生物。外殻に水晶質を蓄積する。',drops:[['水晶殻',50],['澄水核',22]]},
  '蒼泡スライム':{icon:'🔵',terrain:'water',desc:'水中環境に適応したスライム。体内に星界水を保持する。',drops:[['蒼泡核',54],['星界水',25]]}
};
const ENEMY_DEX_ORDER=Object.keys(enemyCatalog);
let enemyDexMode='terrain';

function ensureEnemyDexData(){
  if(!explore.enemyDex)explore.enemyDex={};
}
function enemyEntry(name){
  ensureEnemyDexData();
  if(!explore.enemyDex[name])explore.enemyDex[name]={firstSeen:Date.now(),encounters:0,kills:0,drops:{}};
  return explore.enemyDex[name];
}
function registerEnemyEncounter(name){
  const isNew=!explore.enemyDex?.[name];
  const entry=enemyEntry(name);
  entry.encounters=(Number(entry.encounters)||0)+1;
  saveExplore();
  if(isNew)setExploreMessage(`NEW ENEMY：${name}`,'敵図鑑に初遭遇として登録しました');
}
function recordEnemyDefeat(name){
  const entry=enemyEntry(name);
  entry.kills=(Number(entry.kills)||0)+1;
  const meta=enemyCatalog[name];
  const obtained=[];
  if(meta)meta.drops.forEach(([item,chance])=>{
    if(Math.random()*100<chance){
      entry.drops[item]=(Number(entry.drops[item])||0)+1;
      obtained.push(item);
    }
  });
  saveExplore();
  if(obtained.length)setExploreMessage(`${name}撃破`,`${obtained.join(' / ')} を入手。敵図鑑を更新しました`);
}

const originalCreateEnemies=createEnemies;
createEnemies=function(x,y){
  const enemies=originalCreateEnemies(x,y);
  enemies.forEach(enemy=>{
    registerEnemyEncounter(enemy.name);
    let hp=enemy.hp;
    Object.defineProperty(enemy,'hp',{
      configurable:true,
      enumerable:true,
      get(){return hp;},
      set(value){
        const wasAlive=hp>0;
        hp=value;
        if(wasAlive&&hp<=0)recordEnemyDefeat(enemy.name);
      }
    });
  });
  return enemies;
};

const originalRenderDex=renderDex;
renderDex=function(){
  const grid=document.getElementById('dexGrid');
  if(!grid)return;
  document.querySelectorAll('.dex-switch-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.dexMode===enemyDexMode));
  if(enemyDexMode==='terrain'){
    originalRenderDex();
    const label=document.getElementById('dexProgressLabel');
    if(label)label.textContent='地形登録率';
    return;
  }
  ensureEnemyDexData();
  const registered=ENEMY_DEX_ORDER.filter(name=>explore.enemyDex[name]).length;
  const progress=document.getElementById('dexProgressText');
  const bar=document.getElementById('dexProgressBar');
  const label=document.getElementById('dexProgressLabel');
  if(label)label.textContent='敵登録率';
  if(progress)progress.textContent=`${registered} / ${ENEMY_DEX_ORDER.length}`;
  if(bar)bar.style.width=`${registered/ENEMY_DEX_ORDER.length*100}%`;
  grid.innerHTML=ENEMY_DEX_ORDER.map(name=>{
    const meta=enemyCatalog[name],entry=explore.enemyDex[name],open=!!entry;
    return `<button type="button" class="dex-card ${open?'':'locked'}" data-enemy-dex="${name}" ${open?'':'disabled'}><span class="dex-icon">${open?meta.icon:'？'}</span><span><b>${open?name:'？？？'}</b><small>${open?`遭遇 ${entry.encounters||0} / 撃破 ${entry.kills||0}`:'未遭遇'}</small></span></button>`;
  }).join('');
  grid.querySelectorAll('[data-enemy-dex]:not([disabled])').forEach(btn=>btn.addEventListener('click',()=>showEnemyDexDetail(btn.dataset.enemyDex)));
};

function showEnemyDexDetail(name){
  const meta=enemyCatalog[name],entry=explore.enemyDex?.[name];
  if(!meta||!entry)return;
  const detail=document.getElementById('dexDetail');
  const habitat=terrainDefs[meta.terrain]?.name||'不明';
  const firstSeen=entry.firstSeen?new Date(entry.firstSeen).toLocaleString('ja-JP'):'記録なし';
  const drops=meta.drops.map(([item,chance])=>`<div class="drop-row"><span>${item} <small>(${chance}%)</small></span><span>入手 ${Number(entry.drops?.[item])||0}</span></div>`).join('');
  if(detail)detail.innerHTML=`<b>${meta.icon} ${name}</b><br>${meta.desc}<br><br>生息地：${habitat}<br>初遭遇：${firstSeen}<br>遭遇数：${entry.encounters||0}<br>撃破数：${entry.kills||0}<br><br><b>ドロップ記録</b><div class="drop-list">${drops}</div>`;
}

const originalUpdateWorldHeader=updateWorldHeader;
updateWorldHeader=function(){
  originalUpdateWorldHeader();
  ensureEnemyDexData();
  const terrainCount=DEX_ORDER.filter(k=>explore.dex[k]).length;
  const enemyCount=ENEMY_DEX_ORDER.filter(k=>explore.enemyDex[k]).length;
  const el=document.getElementById('worldDexCount');
  if(el)el.textContent=`${terrainCount+enemyCount} / ${DEX_ORDER.length+ENEMY_DEX_ORDER.length}`;
};

document.querySelectorAll('[data-dex-mode]').forEach(btn=>btn.addEventListener('click',()=>{
  enemyDexMode=btn.dataset.dexMode;
  const detail=document.getElementById('dexDetail');
  if(detail)detail.textContent=enemyDexMode==='terrain'?'地形を選択すると詳細を確認できます。':'敵を選択すると初遭遇・撃破数・ドロップ記録を確認できます。';
  renderDex();
}));

ensureEnemyDexData();
saveExplore();
updateWorldHeader();
