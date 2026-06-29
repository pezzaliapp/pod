# Pod + Radio — note di integrazione

Questi file aggiungono a **Pod** la funzione **Radio** ispirata a *Onda*, mantenendo
l'interfaccia a ghiera. Una radio è solo un URL audio: usa lo stesso `<audio>` di Pod.

## File
- `app.js` — versione di Pod con la voce di menu "Radio", la vista radio e l'API
  `window.Pod` su cui si aggancia il modulo radio.
- `radio.js` — il modulo radio (stazioni demo + ricerca Radio Browser + HLS). Espone
  `window.PodRadio`.
- `index.html` — aggiunge hls.js, il `<div id="toast">` e include `radio.js` dopo `app.js`.
- `styles-radio-additions.css` — da **appendere** al tuo `styles.css` (toast + indicatore LIVE).

## Come usarlo
1. Sostituisci `app.js` e `index.html` con questi.
2. Aggiungi `radio.js` nella root del repo.
3. Appendi il contenuto di `styles-radio-additions.css` al tuo `styles.css`.
4. In `sw.js` aumenta il nome della cache (es. `pod-v2`) e aggiungi `radio.js` alla lista
   dei file in cache, così l'aggiornamento arriva ai dispositivi già installati.

## Come funziona la UI radio
- Menu → **Radio**: lista delle stazioni (demo all'avvio).
- Prima voce **"🔍 Cerca radio…"**: apre un prompt, cerca su Radio Browser e aggiorna la lista.
- Selezione di una stazione → parte lo stream e si apre "In onda" (con indicatore LIVE).
- Le radio non hanno "brano successivo": i tasti ◀◀ ▶▶ restano per i brani locali.

## Limiti onesti (gli stessi di Onda)
- **Stream HTTP su sito HTTPS**: i browser li bloccano (mixed content). Online vedrai solo
  stream HTTPS; le voci marcate `·HTTP` non partono.
- **HLS** (`.m3u8`): serve hls.js (incluso) e che la radio consenta il CORS.
- Radio Browser è collaborativo: alcune emittenti possono mancare o avere stream non aggiornati.

## Spotify / Apple Music / Amazon Music — perché NON sono qui
Non è possibile "caricare i brani" di questi servizi in un player proprio: l'audio è protetto
da DRM e non riproducibile in un `<audio>`.

- **Spotify**: solo via *Web Playback SDK* (account Premium, login OAuth, app registrata).
  Puoi controllare la riproduzione e leggere i metadati, ma non estrarre l'audio.
- **Apple Music**: *MusicKit JS* richiede Apple Developer Program e un developer token JWT
  che non puoi esporre in una PWA statica.
- **Amazon Music**: nessun SDK pubblico di riproduzione per terze parti.

Alternativa realistica: **deep link** che aprono l'app ufficiale sul brano/playlist
(`spotify:`, `https://music.apple.com/...`, `https://music.amazon.it/...`).
