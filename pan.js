const CAMERA_SAVE_KEY='seikai-camera-v1';
const viewport=document.getElementById('worldViewport');
const worldMap=document.getElementById('worldGrid');
let camera={x:0,y:0};
let dragging=false;
let dragStart={x:0,y:0};
let cameraStart={x:0,y:0};

function loadCamera(){
  try{
    const saved=JSON.parse(localStorage.getItem(CAMERA_SAVE_KEY));
    if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))camera=saved;
  }catch{}
}
function saveCamera(){localStorage.setItem(CAMERA_SAVE_KEY,JSON.stringify(camera));}
function clampCamera(){
  if(!viewport||!worldMap)return;
  const minX=Math.min(0,viewport.clientWidth-worldMap.offsetWidth);
  const minY=Math.min(0,viewport.clientHeight-worldMap.offsetHeight);
  camera.x=Math.max(minX,Math.min(0,camera.x));
  camera.y=Math.max(minY,Math.min(0,camera.y));
}
function applyCamera(){
  if(!worldMap)return;
  clampCamera();
  worldMap.style.transform=`translate3d(${camera.x}px,${camera.y}px,0)`;
}
function centerOnCell(x,y){
  if(!viewport||!worldMap)return;
  const cellW=worldMap.offsetWidth/18;
  const cellH=worldMap.offsetHeight/10;
  camera.x=viewport.clientWidth/2-(x+.5)*cellW;
  camera.y=viewport.clientHeight/2-(y+.5)*cellH;
  applyCamera();saveCamera();
}

if(viewport&&worldMap){
  loadCamera();
  if(!localStorage.getItem(CAMERA_SAVE_KEY))centerOnCell(7,4);else applyCamera();

  viewport.addEventListener('pointerdown',e=>{
    if(e.button!==undefined&&e.button!==0)return;
    dragging=true;
    dragStart={x:e.clientX,y:e.clientY};
    cameraStart={...camera};
    viewport.classList.add('dragging');
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove',e=>{
    if(!dragging)return;
    camera.x=cameraStart.x+(e.clientX-dragStart.x);
    camera.y=cameraStart.y+(e.clientY-dragStart.y);
    applyCamera();
  });
  const endDrag=e=>{
    if(!dragging)return;
    dragging=false;
    viewport.classList.remove('dragging');
    try{viewport.releasePointerCapture(e.pointerId);}catch{}
    saveCamera();
  };
  viewport.addEventListener('pointerup',endDrag);
  viewport.addEventListener('pointercancel',endDrag);
  window.addEventListener('resize',()=>{applyCamera();saveCamera();});
}

const centerBtn=document.getElementById('cameraCenterBtn');
if(centerBtn)centerBtn.addEventListener('click',()=>centerOnCell(7,4));
