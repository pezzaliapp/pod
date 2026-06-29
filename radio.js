'use strict';

/* =========================================================
   POD · radio.js
   Porta la logica radio di "Onda" dentro l'interfaccia a
   ghiera di Pod. Una radio è solo un URL audio: usa lo stesso
   elemento <audio> di Pod. Supporta stream diretti (mp3/aac)
   e HLS (.m3u8) via hls.js, più la ricerca su Radio Browser.

   COME SI AGGANCIA A POD (vedi note in fondo e nel README):
   - app.js espone le sue funzioni interne tramite window.Pod
   - questo file aggiunge la voce "Radio" al menu e le viste
   ========================================================= */

const RADIO_CONFIG = {
  rbBase: 'https://de1.api.radio-browser.info/json/stations/search?',
  demo: [
    { name: 'Radio Paradise',    genre: 'Eclectic Mix',        url: 'https://stream.radioparadise.com/mp3-128' },
    { name: 'RP Mellow Mix',     genre: 'Mellow · Chill',      url: 'https://stream.radioparadise.com/mellow-128' },
    { name: 'RP Rock Mix',       genre: 'Rock',                url: 'https://stream.radioparadise.com/rock-128' },
    { name: 'Groove Salad',      genre: 'Ambient · Downtempo', url: 'https://ice1.somafm.com/groovesalad-128-mp3' },
    { name: 'Secret Agent',      genre: 'Lounge · Spy Jazz',   url: 'https://ice1.somafm.com/secretagent-128-mp3' },
    { name: 'Lush',              genre: 'Vocal · Chill',       url: 'https://ice1.somafm.com/lush-128-mp3' },
    { name: 'Underground 80s',   genre: 'Synth · New Wave',    url: 'https://ice1.somafm.com/u80s-128-mp3' },
    { name: 'Indie Pop Rocks',   genre: 'Indie · Alt',         url: 'https://ice1.somafm.com/indiepop-128-mp3' },
    { name: 'Drone Zone',        genre: 'Atmospheric Ambient', url: 'https://ice1.somafm.com/dronezone-128-mp3' }
  ]
};

const HTTPS   = location.protocol === 'https:';
const isHls   = (u) => /\.m3u8(\?|$)/i.test(u || '');
const blocked = (u) => HTTPS && /^http:/i.test(u || ''); // mixed content su HTTPS

let stations    = RADIO_CONFIG.demo.slice();
let radioCurrent = -1;
let hls = null;

/* ---- riproduzione ---- */
function radioLoad(url, audio) {
  if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
  try { audio.pause(); } catch (e) {}
  audio.removeAttribute('src');
  audio.load();

  if (isHls(url)) {
    if (window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls();
      hls.loadSource(url);
      hls.attachMedia(audio);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => audio.play().catch(() => {}));
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = url; // Safari legge HLS nativamente
    } else {
      window.Pod.toastNow('HLS non supportato da questo browser');
      return false;
    }
  } else {
    audio.src = url;
  }
  return true;
}

async function playStation(index) {
  const st = stations[index];
  if (!st) return;
  if (blocked(st.url)) {
    window.Pod.toastNow('Stream HTTP non riproducibile online');
    return;
  }
  radioCurrent = index;
  const audio = window.Pod.audio;
  // segnala a Pod che la sorgente ora è una radio (titolo "In onda")
  window.Pod.setExternalNow({
    title: st.name,
    meta: st.genre || 'Radio',
    live: true
  });
  if (radioLoad(st.url, audio)) {
    try { await audio.play(); } catch (e) { window.Pod.toastNow('Premi Play per avviare'); }
  }
}

/* ---- ricerca Radio Browser ---- */
async function searchRadio(query) {
  const q = [];
  if (query) q.push('name=' + encodeURIComponent(query));
  q.push('hidebroken=true', 'order=clickcount', 'reverse=true', 'limit=40');
  try {
    const r = await fetch(RADIO_CONFIG.rbBase + q.join('&'), { headers: { Accept: 'application/json' } });
    let data = await r.json();
    const seen = new Set();
    data = data.filter(d => {
      const u = d.url_resolved || d.url || '';
      if (!u || seen.has(u)) return false;
      seen.add(u); return true;
    });
    if (HTTPS) data = data.filter(d => /^https:/i.test(d.url_resolved || d.url || ''));
    return data.slice(0, 30).map(d => ({
      name: (d.name || 'Radio').trim(),
      genre: [d.country, (d.tags || '').split(',').slice(0, 2).join(' · ')].filter(Boolean).join(' · '),
      url: d.url_resolved || d.url
    }));
  } catch (e) {
    return null; // fallback gestito dal chiamante
  }
}

/* ---- registrazione nel menu di Pod ---- */
window.PodRadio = {
  // lista per la vista "radio" (etichette pronte per renderList)
  items() {
    return stations.map((s, i) => ({
      label: s.name + (blocked(s.url) ? '  ·HTTP' : (isHls(s.url) ? '  ·HLS' : '')),
      arrow: false
    }));
  },
  count() { return stations.length; },
  select(index) { playStation(index); },
  // ricerca: aggiorna la lista e ridisegna
  async search(query) {
    const res = await searchRadio(query);
    if (res && res.length) {
      stations = res;
      window.Pod.toastNow('Trovate ' + res.length + ' radio');
    } else if (res === null) {
      stations = RADIO_CONFIG.demo.slice();
      window.Pod.toastNow('Ricerca non disponibile · radio demo');
    } else {
      window.Pod.toastNow('Nessuna radio trovata');
    }
    window.Pod.rerenderRadio();
  },
  resetDemo() { stations = RADIO_CONFIG.demo.slice(); }
};
