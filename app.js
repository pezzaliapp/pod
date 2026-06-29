'use strict';

const $ = (id) => document.getElementById(id);
const audio = $('audio');
const content = $('content');
const title = $('screenTitle');
const fileInput = $('fileInput');
const installBtn = $('installBtn');
const toastEl = $('toast');

let tracks = [];
let view = 'menu';
let stack = [];
let selected = 0;
let current = -1;
let deferredPrompt = null;
let lastAngle = null;
let wheelAccumulator = 0;
let externalNow = null; // quando suona una radio (sorgente esterna ai "tracks")

const mainMenu = [
  { label: 'Brani', action: () => openSongs() },
  { label: 'Radio', action: () => openRadio() },
  { label: 'In riproduzione', action: () => openNow() },
  { label: 'Aggiungi musica', action: () => fileInput.click() },
  { label: 'Istruzioni', action: () => openHelp() }
];

function safeName(file) {
  return (file.name || 'Brano').replace(/\.[^.]+$/, '');
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function setTitle(t) { title.textContent = t; }

function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function renderList(items, header) {
  setTitle(header);
  content.innerHTML = '';
  const ul = document.createElement('ul');
  ul.className = 'list';
  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = i === selected ? 'active' : '';
    const span = document.createElement('span');
    span.textContent = item.label;
    const arrow = document.createElement('span');
    arrow.textContent = item.arrow === false ? '' : '›';
    li.append(span, arrow);
    li.addEventListener('click', () => { selected = i; render(); select(); });
    ul.appendChild(li);
  });
  content.appendChild(ul);
  scrollSelectedIntoView();
}

// Tiene la voce selezionata dentro l'area visibile dello schermo,
// scorrendo SOLO il contenitore .content (mai la pagina).
function scrollSelectedIntoView() {
  const li = content.querySelector('li.active');
  if (!li) return;
  const cRect = content.getBoundingClientRect();
  const liRect = li.getBoundingClientRect();
  if (liRect.top < cRect.top) {
    content.scrollTop -= (cRect.top - liRect.top);
  } else if (liRect.bottom > cRect.bottom) {
    content.scrollTop += (liRect.bottom - cRect.bottom);
  }
}

function render() {
  if (view === 'menu') renderList(mainMenu, 'Menu');
  if (view === 'songs') {
    const items = tracks.map((t, i) => ({ label: t.title || `Brano ${i + 1}`, arrow: false }));
    if (!items.length) {
      setTitle('Brani');
      content.innerHTML = '<div class="empty">Nessun brano caricato.<br>Premi "Aggiungi musica" e seleziona uno o più MP3.</div>';
    } else renderList(items, `Brani ${tracks.length}`);
  }
  if (view === 'radio') {
    const items = window.PodRadio ? window.PodRadio.items() : [];
    if (!items.length) {
      setTitle('Radio');
      content.innerHTML = '<div class="empty">Modulo radio non caricato.</div>';
    } else {
      // prima voce virtuale: "Cerca radio…"
      renderList([{ label: '🔍 Cerca radio…', arrow: false }].concat(items), `Radio ${items.length}`);
    }
  }
  if (view === 'now') renderNow();
  if (view === 'help') renderHelp();
}

function push(nextView) { stack.push(view); view = nextView; selected = 0; render(); }
function back() {
  if (view === 'now') { view = stack.pop() || 'menu'; render(); return; }
  if (stack.length) { view = stack.pop(); selected = 0; render(); }
  else { view = 'menu'; selected = 0; render(); }
}
function openSongs() { push('songs'); }
function openRadio() { if (window.PodRadio) window.PodRadio.resetDemo(); push('radio'); }
function openNow() { push('now'); }
function openHelp() { push('help'); }

function select() {
  if (view === 'menu') return mainMenu[selected]?.action();
  if (view === 'songs') return playTrack(selected);
  if (view === 'radio') {
    if (selected === 0) { // "Cerca radio…"
      const q = window.prompt('Cerca una radio (nome):', '');
      if (q && window.PodRadio) window.PodRadio.search(q.trim());
      return;
    }
    return window.PodRadio && window.PodRadio.select(selected - 1);
  }
  if (view === 'now') return togglePlay();
  if (view === 'help') return back();
}

function move(delta) {
  let max = 0;
  if (view === 'menu') max = mainMenu.length;
  if (view === 'songs') max = tracks.length;
  if (view === 'radio') max = (window.PodRadio ? window.PodRadio.count() : 0) + 1; // +1 per "Cerca"
  if (view === 'now' || view === 'help') return;
  if (!max) return;
  selected = (selected + delta + max) % max;
  render();
}

async function playTrack(index) {
  const t = tracks[index];
  if (!t) return;
  externalNow = null;
  current = index;
  audio.pause();
  audio.src = t.url;
  audio.currentTime = 0;
  view = 'now';
  stack = ['menu', 'songs'];
  render();
  try { await audio.play(); } catch (err) { renderNow('Premi Play per avviare'); }
}

async function togglePlay() {
  if (externalNow) { // radio in corso
    try { if (audio.paused) await audio.play(); else audio.pause(); }
    catch (e) { renderNow('Tocca di nuovo Play'); }
    renderNow();
    return;
  }
  if (current < 0 && tracks.length) current = 0;
  if (current < 0) return;
  if (!audio.src) audio.src = tracks[current].url;
  try {
    if (audio.paused) await audio.play(); else audio.pause();
  } catch (err) {
    renderNow('Tocca di nuovo Play');
  }
  renderNow();
}

function nextTrack() {
  if (externalNow) return; // le radio non hanno "prossimo brano"
  if (!tracks.length) return;
  const next = current < 0 ? 0 : (current + 1) % tracks.length;
  playTrack(next);
}

function prevTrack() {
  if (externalNow) return;
  if (!tracks.length) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const prev = current < 0 ? 0 : (current - 1 + tracks.length) % tracks.length;
  playTrack(prev);
}

function renderNow(msg = '') {
  // sorgente radio
  if (externalNow) {
    setTitle(audio.paused ? 'In pausa' : 'In onda');
    content.innerHTML = `
      <div class="now">
        <div class="cover radio"></div>
        <div class="track-title"></div>
        <div class="track-meta"></div>
        <div class="live-dot">● LIVE</div>
        <div class="small">${msg || (audio.paused ? 'Premi Play o il centro' : 'In diretta')}</div>
      </div>`;
    content.querySelector('.track-title').textContent = externalNow.title;
    content.querySelector('.track-meta').textContent = externalNow.meta || 'Radio';
    return;
  }
  setTitle(audio.paused ? 'In pausa' : 'Ora suona');
  const t = tracks[current];
  if (!t) {
    content.innerHTML = '<div class="empty">Nessun brano in riproduzione.</div>';
    return;
  }
  const dur = audio.duration || 0;
  const cur = audio.currentTime || 0;
  const pct = dur ? Math.min(100, (cur / dur) * 100) : 0;
  content.innerHTML = `
    <div class="now">
      <div class="cover"></div>
      <div class="track-title"></div>
      <div class="track-meta"></div>
      <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
      <div class="time"><span>${formatTime(cur)}</span><span>${formatTime(dur)}</span></div>
      <div class="small">${msg || (audio.paused ? 'Premi Play o il centro' : 'In riproduzione')}</div>
    </div>`;
  content.querySelector('.track-title').textContent = t.title;
  content.querySelector('.track-meta').textContent = t.type || 'Audio locale';
}

function renderHelp() {
  setTitle('Istruzioni');
  content.innerHTML = '<div class="small">1. Premi Aggiungi musica.<br>2. Seleziona MP3/audio.<br>3. Entra in Brani.<br>4. Premi centro sul brano.<br><br>Radio: entra in "Radio", scegli una stazione o "Cerca radio…".<br><br>Per PWA usa https://GitHub Pages o un server locale. Evita file://.</div>';
}

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg)$/i.test(f.name));
  files.forEach(file => {
    tracks.push({ title: safeName(file), file, url: URL.createObjectURL(file), type: file.type || 'audio' });
  });
  fileInput.value = '';
  view = 'songs';
  stack = ['menu'];
  selected = Math.max(0, tracks.length - files.length);
  render();
});

$('btnMenu').addEventListener('click', back);
$('btnSelect').addEventListener('click', select);
$('btnPlay').addEventListener('click', togglePlay);
$('btnNext').addEventListener('click', nextTrack);
$('btnPrev').addEventListener('click', prevTrack);

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') move(1);
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') move(-1);
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
  if (e.key === 'Escape' || e.key === 'Backspace') back();
});

audio.addEventListener('timeupdate', () => { if (view === 'now' && !externalNow) renderNow(); });
audio.addEventListener('ended', nextTrack);
audio.addEventListener('play', () => { if (view === 'now') renderNow(); });
audio.addEventListener('pause', () => { if (view === 'now') renderNow(); });
audio.addEventListener('error', () => { if (view === 'now') renderNow('Formato/stream non supportato'); });

function angleFromEvent(ev, el) {
  const r = el.getBoundingClientRect();
  const x = ev.clientX - (r.left + r.width / 2);
  const y = ev.clientY - (r.top + r.height / 2);
  return Math.atan2(y, x) * 180 / Math.PI;
}

const wheel = $('wheel');
wheel.addEventListener('pointerdown', (e) => { wheel.setPointerCapture(e.pointerId); lastAngle = angleFromEvent(e, wheel); wheelAccumulator = 0; });
wheel.addEventListener('pointermove', (e) => {
  if (lastAngle === null) return;
  const a = angleFromEvent(e, wheel);
  let diff = a - lastAngle;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  wheelAccumulator += diff;
  lastAngle = a;
  if (Math.abs(wheelAccumulator) > 22) {
    move(wheelAccumulator > 0 ? 1 : -1);
    wheelAccumulator = 0;
  }
});
wheel.addEventListener('pointerup', () => { lastAngle = null; });
wheel.addEventListener('pointercancel', () => { lastAngle = null; });

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installBtn.hidden = false; });
installBtn.addEventListener('click', async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.hidden = true; });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

/* ---------------------------------------------------------
   API esposta al modulo radio.js (window.PodRadio lo usa)
   --------------------------------------------------------- */
window.Pod = {
  audio,
  toastNow: toast,
  setExternalNow(info) { externalNow = info; current = -1; view = 'now'; stack = ['menu', 'radio']; render(); },
  rerenderRadio() { if (view === 'radio') { selected = 0; render(); } }
};

render();
