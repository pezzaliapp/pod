const content = document.getElementById('content');
const screenTitle = document.getElementById('screenTitle');
const audio = document.getElementById('audio');
const fileInput = document.getElementById('fileInput');
const installBtn = document.getElementById('installBtn');
const pickLabel = document.querySelector('.filepick');

let tracks = [];
let view = 'home';
let selected = 0;
let current = -1;
let playing = false;
let deferredPrompt = null;
let objectUrls = [];
let renderQueued = false;

const homeItems = ['Brani', 'Ora in riproduzione', 'Casuale', 'Info'];
const audioExt = /\.(mp3|m4a|aac|wav|ogg|oga|flac|webm)$/i;
const MAX_VISIBLE = 60; // evita blocchi se vengono selezionati molti brani insieme

function fmt(seconds){
  if(!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds/60);
  const s = Math.floor(seconds%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}
function cleanName(name){
  return String(name || 'Brano').replace(/\.[^.]+$/, '').replace(/[_-]+/g,' ').trim() || 'Brano senza titolo';
}
function escapeHtml(s){
  return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function queueRender(){
  if(renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(()=>{ renderQueued = false; render(); });
}
function setView(next){
  view = next;
  selected = 0;
  queueRender();
}
function visibleTrackWindow(){
  if(tracks.length <= MAX_VISIBLE) return {start:0, end:tracks.length};
  let start = Math.max(0, selected - Math.floor(MAX_VISIBLE/2));
  let end = Math.min(tracks.length, start + MAX_VISIBLE);
  start = Math.max(0, end - MAX_VISIBLE);
  return {start, end};
}
function renderMenu(title, items, offset = 0){
  screenTitle.textContent = title;
  content.innerHTML = `<ul class="menu">${items.map((it,i)=>{
    const realIndex = i + offset;
    const active = realIndex === selected;
    return `<li class="${active?'active':''}" data-index="${realIndex}"><span>${escapeHtml(it.label)}</span>${it.meta?`<small>${escapeHtml(it.meta)}</small>`:'›'}</li>`;
  }).join('')}</ul>`;
}
function render(){
  try {
    if(view==='home') {
      return renderMenu('Musica', homeItems.map(x=>({label:x, meta:x==='Brani' && tracks.length ? String(tracks.length) : ''})));
    }
    if(view==='tracks'){
      if(!tracks.length){
        screenTitle.textContent='Brani';
        content.innerHTML='<div class="empty">Nessun brano caricato<div class="hint">Tocca “Aggiungi musica” e seleziona uno o più file MP3/audio.</div></div>';
        return;
      }
      const win = visibleTrackWindow();
      const rows = tracks.slice(win.start, win.end).map((t,i)=>({
        label: t.title,
        meta: (i + win.start) === current ? '▶' : ''
      }));
      renderMenu(`Brani ${selected+1}/${tracks.length}`, rows, win.start);
      return;
    }
    if(view==='now') return renderNow();
    if(view==='info'){
      screenTitle.textContent='Info';
      content.innerHTML='<div class="empty">Pod Classic<div class="hint">PWA locale ispirata ai vecchi lettori MP3. Non è un prodotto Apple né usa marchi ufficiali.</div></div>';
      return;
    }
  } catch(err) {
    console.error(err);
    screenTitle.textContent='Errore';
    content.innerHTML='<div class="empty">La schermata si è bloccata<div class="hint">Premi MENU e riprova con pochi brani alla volta.</div></div>';
  }
}
function renderNow(){
  screenTitle.textContent='In riproduzione';
  const t = tracks[current];
  if(!t){
    content.innerHTML='<div class="empty">Nessun brano<div class="hint">Carica musica e scegli un brano.</div></div>';
    return;
  }
  content.innerHTML = `<div class="now"><div class="track-title">${escapeHtml(t.title)}</div><div class="artist">File locale</div><div>${playing?'▶':'❚❚'}</div><div class="progress"><div class="bar" id="bar"></div></div><div class="time"><span id="cur">${fmt(audio.currentTime)}</span><span id="dur">${fmt(audio.duration)}</span></div><div id="msg" class="hint"></div></div>`;
  updateProgress();
}
function choose(){
  if(view==='home'){
    const item=homeItems[selected];
    if(item==='Brani') setView('tracks');
    else if(item==='Ora in riproduzione') setView('now');
    else if(item==='Casuale') shufflePlay();
    else if(item==='Info') setView('info');
    return;
  }
  if(view==='tracks' && tracks[selected]) playIndex(selected);
  else if(view==='now') togglePlay();
}
function back(){
  if(view==='home') return;
  view='home';
  selected=0;
  queueRender();
}
function move(delta){
  const len = view==='home'?homeItems.length:view==='tracks'?tracks.length:0;
  if(!len) return;
  selected = (selected + delta + len) % len;
  queueRender();
}
async function playIndex(i){
  if(!tracks[i]) return;
  current = i;
  view = 'now';
  playing = false;
  queueRender();
  try {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio.src = tracks[i].url;
    audio.load();
    await audio.play();
    playing = true;
  } catch(err) {
    playing = false;
    const msg = document.getElementById('msg');
    if(msg) msg.textContent = 'Premi ▶ per avviare. Alcuni browser bloccano l’autoplay.';
  }
  queueRender();
}
async function togglePlay(){
  if(current<0 && tracks.length) return playIndex(0);
  if(!audio.src && tracks[current]) audio.src = tracks[current].url;
  if(!audio.src) return;
  try {
    if(audio.paused){ await audio.play(); playing=true; }
    else { audio.pause(); playing=false; }
  } catch(err) {
    playing=false;
    const msg = document.getElementById('msg');
    if(msg) msg.textContent = 'Impossibile avviare questo file audio.';
  }
  queueRender();
}
function next(){ if(!tracks.length)return; playIndex(current<0?0:(current+1)%tracks.length); }
function prev(){ if(!tracks.length)return; playIndex(current<=0?tracks.length-1:current-1); }
function shufflePlay(){ if(!tracks.length){setView('tracks');return;} playIndex(Math.floor(Math.random()*tracks.length)); }
function updateProgress(){
  const bar=document.getElementById('bar'), cur=document.getElementById('cur'), dur=document.getElementById('dur');
  if(!bar) return;
  const pct = audio.duration ? (audio.currentTime/audio.duration)*100 : 0;
  bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if(cur) cur.textContent=fmt(audio.currentTime);
  if(dur) dur.textContent=fmt(audio.duration);
}
function addFiles(fileList){
  try {
    const files = Array.from(fileList || []);
    let added = 0;
    for(const f of files){
      if(!f || !(String(f.type).startsWith('audio/') || audioExt.test(f.name))) continue;
      const url = URL.createObjectURL(f);
      objectUrls.push(url);
      tracks.push({title: cleanName(f.name), url, size: f.size || 0});
      added++;
    }
    fileInput.value = '';
    view='tracks';
    if(added) selected = Math.max(0, tracks.length - added);
    queueRender();
  } catch(err) {
    console.error(err);
    screenTitle.textContent='Errore import';
    content.innerHTML='<div class="empty">Non riesco a importare i brani<div class="hint">Prova con MP3 standard e seleziona pochi file alla volta.</div></div>';
  }
}
fileInput.addEventListener('change', e=>addFiles(e.target.files));
['dragenter','dragover'].forEach(type=>pickLabel?.addEventListener(type, e=>{e.preventDefault(); pickLabel.classList.add('drag')}));
['dragleave','drop'].forEach(type=>pickLabel?.addEventListener(type, e=>{e.preventDefault(); pickLabel.classList.remove('drag')}));
pickLabel?.addEventListener('drop', e=>addFiles(e.dataTransfer.files));

audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('loadedmetadata', updateProgress);
audio.addEventListener('ended', next);
audio.addEventListener('play',()=>{playing=true; updateProgress();});
audio.addEventListener('pause',()=>{playing=false; updateProgress();});
audio.addEventListener('error',()=>{
  playing=false;
  const msg = document.getElementById('msg');
  if(msg) msg.textContent='File non riproducibile da questo browser.';
});

document.getElementById('btnSelect').addEventListener('click', choose);
document.getElementById('btnMenu').addEventListener('click', back);
document.getElementById('btnNext').addEventListener('click', next);
document.getElementById('btnPrev').addEventListener('click', prev);
document.getElementById('btnPlay').addEventListener('click', togglePlay);

const wheel=document.getElementById('wheel');
let lastAngle=null, accum=0;
function angle(e){
  const r=wheel.getBoundingClientRect();
  const p=e.touches?.[0]||e;
  const x=p.clientX-r.left-r.width/2;
  const y=p.clientY-r.top-r.height/2;
  return Math.atan2(y,x);
}
function onMove(e){
  if(lastAngle===null)return;
  const a=angle(e); let d=a-lastAngle;
  if(d>Math.PI)d-=2*Math.PI;
  if(d<-Math.PI)d+=2*Math.PI;
  accum+=d; lastAngle=a;
  if(Math.abs(accum)>0.36){ move(accum>0?1:-1); accum=0; }
}
wheel.addEventListener('pointerdown',e=>{lastAngle=angle(e); try{wheel.setPointerCapture(e.pointerId)}catch(_){}});
wheel.addEventListener('pointermove',onMove);
wheel.addEventListener('pointerup',()=>{lastAngle=null;accum=0});
wheel.addEventListener('pointercancel',()=>{lastAngle=null;accum=0});

window.addEventListener('beforeinstallprompt', e=>{e.preventDefault();deferredPrompt=e;installBtn.hidden=false});
installBtn.addEventListener('click', async()=>{ if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;installBtn.hidden=true;} });
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }
window.addEventListener('beforeunload',()=>objectUrls.forEach(u=>URL.revokeObjectURL(u)));
render();
