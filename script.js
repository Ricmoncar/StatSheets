// ============================================================
// DATA
// ============================================================
const STORAGE_KEY = 'statsheets_v1';
const SEEN_TRAITS_KEY = 'statsheets_seen_traits';
let characters = [];
let folders = [];
let _sidebarSearch = '';
function filterSidebar(val) {
  _sidebarSearch = (val || '').toLowerCase().trim();
  renderSidebar();
}
let seenTraits = [];
let _encStatusMap = {}; // keyed by UPPERCASE status name → { color, desc }

// ── NARA rainbow ─────────────────────────────────────────────
const _NARA_RE = /^NARA!+$/;
function _isNara(c) { return !!(c && c.name && _NARA_RE.test(c.name)); }
let _naraCurrentColor = '#ffb3ba';
let _naraRafId = null, _naraRafT = 0, _naraRafPrevTs = 0;

function _naraHsl(t) {
  const hue = ((t * 50) % 360 + 360) % 360; // 50°/s → ~7.2 s per full cycle
  return `hsl(${hue.toFixed(1)},80%,78%)`;
}

function _injectNaraStyles() {
  if (document.getElementById('nara-styles')) return;
  const stops = [
    [0,'#ffb3ba'],[14,'#ffd4a8'],[28,'#feffa8'],
    [42,'#b8ffc9'],[57,'#a8d8ff'],[71,'#d4b3ff'],
    [85,'#ffb3f0'],[100,'#ffb3ba'],
  ];
  const kfText   = stops.map(([p,c])=>`${p}%{color:${c}}`).join(' ');
  const kfBorder = stops.map(([p,c])=>`${p}%{border-color:${c}}`).join(' ');
  const kfBg     = stops.map(([p,c])=>`${p}%{background-color:${c}}`).join(' ');
  const kfAll    = stops.map(([p,c])=>`${p}%{color:${c};border-color:${c}}`).join(' ');
  const s = document.createElement('style');
  s.id = 'nara-styles';
  s.textContent = `
@keyframes naraRbwText{${kfText}}
@keyframes naraRbwBorder{${kfBorder}}
@keyframes naraRbwBg{${kfBg}}
@keyframes naraRbwAll{${kfAll}}
.nara-rainbow{animation:naraRbwText 2.5s linear infinite!important;color:unset!important;}
.nara-rainbow-border{animation:naraRbwBorder 2.5s linear infinite!important;}
.nara-rainbow-band{animation:naraRbwBg 2.5s linear infinite!important;-webkit-mask-image:linear-gradient(90deg,black 60%,transparent 100%);mask-image:linear-gradient(90deg,black 60%,transparent 100%);}
.nara-rainbow-dot{animation:naraRbwBg 2.5s linear infinite!important;}
.nara-rainbow-all{animation:naraRbwAll 2.5s linear infinite!important;}
`;
  document.head.appendChild(s);
}

function _naraRafTick(ts) {
  if (!_naraRafPrevTs) _naraRafPrevTs = ts;
  _naraRafT += (ts - _naraRafPrevTs) / 1000;
  _naraRafPrevTs = ts;
  const col = _naraHsl(_naraRafT);
  _naraCurrentColor = col;

  const cv = document.getElementById('char-view');
  if (cv) cv.style.setProperty('--char-color', col);

  document.querySelectorAll('[data-nara-color]').forEach(el => { el.style.color = col; });
  document.querySelectorAll('[data-nara-border]').forEach(el => { el.style.borderColor = col; });
  document.querySelectorAll('[data-nara-fill]').forEach(el => { el.setAttribute('fill', col); });

  const bar = document.getElementById('theme-bar');
  if (bar && bar.dataset.naraBar) bar.style.setProperty('--bar-accent', col);
  const barChar = document.getElementById('theme-bar-char');
  if (barChar && barChar.dataset.naraColor) barChar.style.color = col;

  _naraRafId = requestAnimationFrame(_naraRafTick);
}

function _startNaraRaf() {
  _injectNaraStyles();
  _naraRafPrevTs = 0;
  if (!_naraRafId) _naraRafId = requestAnimationFrame(_naraRafTick);
}

function _stopNaraRaf() {
  if (_naraRafId) { cancelAnimationFrame(_naraRafId); _naraRafId = null; }
  const cv = document.getElementById('char-view');
  if (cv) cv.style.removeProperty('--char-color');
}
// ─────────────────────────────────────────────────────────────

// ── BIZZY bee pattern ─────────────────────────────────────────
const _BIZZY_RE = /^Bizzy$/i;
function _isBizzy(c) { return !!(c && c.name && _BIZZY_RE.test(c.name)); }

let _bizzyRafId = null, _bizzyRafT = 0, _bizzyRafPrev = 0;
let _bizzySmoothedLevel = 0;
let _bizzyIsPlaying = false;
let _bizzyAudioListening = false;
// ─────────────────────────────────────────────────────────────

let currentId = null;
let editingId = null;
let previewAnim = null;
let bgAnim = null;
let editorAnim = null;
let _editorForms = [];
let _formUploadIdx = null;

// ============================================================
// FIREBASE
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBRtoLzS--wz_6sD4rWMgzcwZnHVHUBNdg",
  authDomain: "statsheets-3668d.firebaseapp.com",
  projectId: "statsheets-3668d",
  storageBucket: "statsheets-3668d.firebasestorage.app",
  messagingSenderId: "558910483943",
  appId: "1:558910483943:web:c468342f15569a4cf0e142"
};

let db = null;
try {
  firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.firestore();
  // Offline persistence: writes hit local cache instantly, so snapshots
  // always reflect your own changes immediately even before server confirms
  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented')
      console.warn('Persistence error:', err);
  });
} catch (e) { console.error('Firebase init failed:', e); }

// Track our own writes so onSnapshot doesn't re-render the screen we already updated
let _lastSaveId = null;
let _lastSaveTime = 0;
const SELF_WRITE_WINDOW = 8000; // ms

function loadData() { characters = []; } // no-op — data comes from Firestore

function _stripUndefined(obj) {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'number' && !isFinite(obj)) return 0;
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(item => _stripUndefined(item));
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, _stripUndefined(v)])
  );
}

// Migrate any character data that may have been written in an old format.
// Old perfectSoulData.history was Array<Array> (Firestore-illegal); new format is Array<{souls:[]}>.
function _migrateCharacter(c) {
  if (c.perfectSoulData && Array.isArray(c.perfectSoulData.history)) {
    let dirty = false;
    c.perfectSoulData.history = c.perfectSoulData.history.map(entry => {
      if (Array.isArray(entry)) { dirty = true; return { souls: entry }; }
      return entry;
    });
    if (dirty) setTimeout(() => saveData(c), 0); // defer until after onSnapshot rebuilds characters[]
  }
  return c;
}

function saveData(charObj) {
  const c = charObj || characters.find(x => x.id === currentId);
  if (!c || !db) return;
  _lastSaveId = c.id;
  _lastSaveTime = Date.now();
  // Keep local array in sync optimistically
  const idx = characters.findIndex(x => x.id === c.id);
  if (idx >= 0) characters[idx] = c; else characters.push(c);
  db.collection('characters').doc(c.id).set(_stripUndefined(c)).catch(err => {
    console.error('Firestore write error:', err);
    notify('SAVE FAILED', 'err');
  });
}

// One-time migration from localStorage → Firestore (runs if Firestore is empty)
let _migrated = false;
async function migrateLocalStorage() {
  if (_migrated || !db) return;
  _migrated = true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const local = JSON.parse(stored);
    if (!local?.length) return;
    const snap = await db.collection('characters').limit(1).get();
    if (!snap.empty) return; // Firestore already has data — skip
    const batch = db.batch();
    local.forEach((c, i) => {
      if (!c.createdAt) c.createdAt = Date.now() + i;
      batch.set(db.collection('characters').doc(c.id), c);
    });
    await batch.commit();
    localStorage.removeItem(STORAGE_KEY);
    notify('DATA MIGRATED TO CLOUD', 'ok');
  } catch (e) { console.error('Migration error:', e); }
}

function loadSeenTraits() {
  try { seenTraits = JSON.parse(localStorage.getItem(SEEN_TRAITS_KEY)) || []; }
  catch { seenTraits = []; }
}
function saveSeenTraits() {
  try { localStorage.setItem(SEEN_TRAITS_KEY, JSON.stringify(seenTraits)); }
  catch (e) { console.warn("localStorage not available:", e); }
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ============================================================
// CURSOR
// ============================================================
// Handle custom cursor tracking immediately
function updateCursor(e) {
  const c = document.getElementById('cursor');
  if (c) {
    c.style.left = e.clientX + 'px';
    c.style.top = e.clientY + 'px';
  }
}
document.addEventListener('mousemove', updateCursor);

// ============================================================
// MOBILE DRAWER
// ============================================================
function toggleDrawer() { document.body.classList.toggle('drawer-open'); }
function closeDrawer() { document.body.classList.remove('drawer-open'); }

// ============================================================
// SOUND ENGINE
// ============================================================
const SOUNDS_PATH = 'sounds/';
let _hoverCooldown = false;

// ── Global SFX volume (persisted to localStorage) ────────────
let _sfxVolume = parseFloat(localStorage.getItem('sfx_volume') ?? '1');
let _sfxMuted  = localStorage.getItem('sfx_muted') === '1';

function playSound(name, { rate = 1, volume = 1 } = {}) {
  try {
    if (_sfxMuted) return;
    const audio = new Audio(SOUNDS_PATH + name + '.mp3');
    audio.volume = Math.max(0, Math.min(1, volume * _sfxVolume));
    audio.playbackRate = Math.max(0.1, Math.min(4, rate));
    audio.play().catch(() => { });
    return audio;
  } catch (e) { }
}

function setSfxVolume(val) {
  _sfxVolume = Math.max(0, Math.min(100, val)) / 100;
  localStorage.setItem('sfx_volume', _sfxVolume);
  const lbl = document.getElementById('sfx-vol-label');
  if (lbl) lbl.textContent = Math.round(_sfxVolume * 100);
  _sfxUpdateIcon();
}

function toggleSfxMute() {
  _sfxMuted = !_sfxMuted;
  localStorage.setItem('sfx_muted', _sfxMuted ? '1' : '0');
  _sfxUpdateIcon();
}

function _sfxUpdateIcon() {
  const btn  = document.getElementById('sfx-mute-btn');
  const svg  = document.getElementById('sfx-icon');
  const w1   = document.getElementById('sfx-wave1');
  const w2   = document.getElementById('sfx-wave2');
  if (!btn) return;
  const vol = _sfxMuted ? 0 : _sfxVolume;
  btn.textContent = _sfxMuted ? '🔇' : (vol < 0.4 ? '🔉' : '🔊');
  if (w1) w1.style.display = vol === 0 ? 'none' : '';
  if (w2) w2.style.display = vol < 0.4 ? 'none' : '';
}

function toggleSfxPanel() {
  const panel = document.getElementById('sfx-panel');
  if (!panel) return;
  panel.classList.toggle('open');
}

// Close panel when clicking outside
document.addEventListener('click', e => {
  const wrap = document.getElementById('sfx-ctrl-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('sfx-panel')?.classList.remove('open');
  }
});

// Apply persisted values to UI on load
document.addEventListener('DOMContentLoaded', () => {
  const slider = document.getElementById('sfx-vol-slider');
  if (slider) slider.value = Math.round(_sfxVolume * 100);
  _sfxUpdateIcon();
  const lbl = document.getElementById('sfx-vol-label');
  if (lbl) lbl.textContent = Math.round(_sfxVolume * 100);

  _themeAudio = document.getElementById('theme-audio');
  if (_themeAudio) {
    _themeAudio.loop = false; // Handled manually so startAt is respected on every loop
    _themeAudio.addEventListener('ended', _onThemeEnded);
  }
  _initThemeBarHover();
});

function playClick() {
  playSound('click', { rate: 0.9 + Math.random() * 0.3, volume: 0.4 });
}

function playHover() {
  if (_hoverCooldown) return;
  _hoverCooldown = true;
  playSound('hover', { rate: 0.9 + Math.random() * 0.3, volume: 0.45 });
  setTimeout(() => { _hoverCooldown = false; }, 55);
}

// ============================================================
// THEME MUSIC PLAYER (per-character MP3 themes via Cloudinary)
// ============================================================
let _themeAudio = null;
let _themeCurrentCharId = null;   // whose theme is playing right now
let _themeCurrentSong = null;     // cache of the song object currently being played
let _themeVolume = 20;            // 0-100
let _themePaused = false;
const _themeReloadKeys = new Set();
let _themeFadeTimer = null;
let _themeBarAutoHideTimer = null; // slides bar to peeked after 1.5 s
let _themeBarLeaveTimer    = null; // hides bar again after mouse leaves
let _themePendingKey       = null; // set when play() is blocked by autoplay policy
const _themeTimestamps = new Map(); // charId -> seconds (session-only)
const THEME_MAX_MB = 20;

const CLOUDINARY_CLOUD = 'dhlik6lkn';
const CLOUDINARY_PRESET = 'statsheets';

// ── Helpers ───────────────────────────────────────────────────
function _fmtTime(s) {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

function _onThemeEnded() {
  if (!_themeCurrentSong || !_themeCurrentCharId) return;
  const startAt = _themeCurrentSong.startAt || 0;
  _themeAudio.currentTime = startAt;
  _themeAudio.play().catch(() => {});
}

// ── Crossfade helpers ────────────────────────────────────────
function _themeFadeOut(onDone) {
  clearInterval(_themeFadeTimer);
  let vol = _themeAudio.volume;
  if (vol <= 0) { if (onDone) onDone(); return; }
  const step = vol / 16; // ~16 steps × 50ms = 800ms
  _themeFadeTimer = setInterval(() => {
    vol -= step;
    if (vol <= 0) {
      clearInterval(_themeFadeTimer);
      _themeAudio.volume = 0;
      if (onDone) onDone();
    } else {
      _themeAudio.volume = vol;
    }
  }, 50);
}

function _themeFadeIn() {
  clearInterval(_themeFadeTimer);
  _themeAudio.volume = 0;
  const target = _themeVolume / 100;
  let vol = 0;
  const step = target / 16;
  _themeFadeTimer = setInterval(() => {
    vol += step;
    if (vol >= target) {
      clearInterval(_themeFadeTimer);
      _themeAudio.volume = target;
    } else {
      _themeAudio.volume = vol;
    }
  }, 50);
}

// ── Form theme helpers ────────────────────────────────────────
// Returns the theme song for a specific form index (0 = base)
function _getFormTheme(c, formIdx) {
  if (!c) return null;
  if (formIdx === 0) return (c.info && c.info.themeSong) || null;
  const af = (c.altForms || [])[formIdx - 1];
  return (af && af.themeSong) || null;
}

// Returns a unique timestamp key for charId + formIdx
function _tsKey(charId, formIdx) { return charId + ':' + (formIdx || 0); }

// ── Core API ─────────────────────────────────────────────────
function playThemeForCharacter(charId, overrideSong = null) {
  const c = characters.find(x => x.id === charId);
  const formIdx = c ? (c.activeFormIdx || 0) : 0;
  const key = _tsKey(charId, formIdx);

  // If no override and we're playing this same track, use the cached song to avoid stale data from Firestore
  let song = overrideSong;
  if (!song) {
    // Check if this is the currently playing track
    if (_themeCurrentCharId === key && _themeCurrentSong) {
      console.log('[THEME] Using cached song for currently playing track');
      song = _themeCurrentSong;
    } else {
      song = _getFormTheme(c, formIdx);
    }
  }

  console.log('[THEME] playThemeForCharacter called:', { charId, formIdx, overrideSong, usingCached: (!overrideSong && _themeCurrentCharId === key), songFromChar: _getFormTheme(c, formIdx) });

  if (!song || !song.url) {
    // No theme for this form — fade out if we were playing something else
    if (_themeCurrentCharId) {
      _themeTimestamps.set(_themeCurrentCharId, _themeAudio.currentTime);
      _themeFadeOut(() => { _themeAudio.pause(); _themeCurrentCharId = null; _themeCurrentSong = null; _hideThemeBar(); });
    }
    return;
  }

  // Save old position
  if (_themeCurrentCharId && _themeCurrentCharId !== key) {
    _themeTimestamps.set(_themeCurrentCharId, _themeAudio.currentTime);
  }

  const startAt = _themeTimestamps.has(key) ? _themeTimestamps.get(key) : (song.startAt || 0);
  _themeCurrentCharId = key;
  _themeCurrentSong = song;  // Cache the song being played
  _themePaused = false;
  const forceReload = _themeReloadKeys.has(key);

  const doLoad = () => {
    // Only cache-bust after a fresh upload — otherwise let the browser cache the file
    // so repeat visits to the same character start playing instantly.
    const isFreshUpload = _themeReloadKeys.has(key);
    if (isFreshUpload) _themeReloadKeys.delete(key);

    _themeAudio.pause();
    _themeAudio.currentTime = 0;
    _themeAudio.src = '';

    const newUrl = isFreshUpload
      ? song.url + (song.url.includes('?') ? '&' : '?') + '_v=' + Date.now()
      : song.url;

    _themeAudio.src = newUrl;
    _themeAudio.dataset.trackKey = key;
    _themeAudio.dataset.trackUrl = song.url;
    _themeAudio.load();
    _themeAudio.currentTime = startAt;
    _themeAudio.play().catch(err => {
      // Browser autoplay policy blocks play before any user interaction.
      // Store the key so the first click/keydown retries it.
      if (err && err.name === 'NotAllowedError') {
        _themePendingKey = key;
        // Show ▶ + pulse so the user knows music is waiting for interaction
        const pp = document.getElementById('theme-bar-playpause');
        if (pp) pp.innerHTML = '▶';
        const eq = document.getElementById('theme-bar-eq');
        if (eq) eq.classList.add('paused');
        const bar = document.getElementById('theme-bar');
        if (bar) { bar.classList.add('autoplay-blocked'); bar.title = 'Click anywhere to start music'; }
      }
    });
    _themeFadeIn();
  };

  if (!_themeAudio.paused) _themeFadeOut(doLoad);
  else doLoad();

  const formLabel = formIdx === 0 ? '' : ` · ${(c.altForms[formIdx - 1].name || 'FORM ' + formIdx).toUpperCase()}`;
  _showThemeBar(song.name || 'UNTITLED', (c.name || '') + formLabel, c.color);
}

// ── Background preloader ──────────────────────────────────────
// Creates real Audio objects with preload='metadata' so the browser actually
// fills its audio buffer — far more effective than a fetch for reducing playback lag.
// We keep the objects alive in a Map so GC doesn't drop them before they finish.
const _themePreloadCache = new Set();   // URLs already preloaded this session
const _themePreloadAudios = new Map();  // url → Audio — keep-alive references
let _themePreloadQueue = [];
let _themePreloadTimer = null;

function _preloadThemes(charList) {
  const urls = [];
  charList.forEach(c => {
    const base = c.info && c.info.themeSong && c.info.themeSong.url;
    if (base && !_themePreloadCache.has(base)) urls.push(base);
    (c.altForms || []).forEach(f => {
      const alt = f && f.themeSong && f.themeSong.url;
      if (alt && !_themePreloadCache.has(alt)) urls.push(alt);
    });
  });
  if (!urls.length) return;
  // Put new URLs at the front of the queue
  _themePreloadQueue = [...new Set([...urls, ..._themePreloadQueue])];
  _kickPreloadQueue();
}

function _kickPreloadQueue() {
  if (_themePreloadTimer || !_themePreloadQueue.length) return;
  _themePreloadTimer = setTimeout(() => {
    _themePreloadTimer = null;
    const url = _themePreloadQueue.shift();
    if (!url || _themePreloadCache.has(url)) { _kickPreloadQueue(); return; }
    _themePreloadCache.add(url);
    // Real Audio element — browser primes its audio pipeline, not just HTTP cache
    const a = new Audio();
    a.preload = 'metadata'; // downloads header + usually first few seconds
    a.src = url;
    _themePreloadAudios.set(url, a); // prevent GC
    _kickPreloadQueue();
  }, 500); // 500 ms stagger — fast enough to preload all chars in ~10 s
}

function toggleThemePlayback() {
  if (!_themeCurrentCharId) return;
  const eq = document.getElementById('theme-bar-eq');
  if (!_themeAudio.paused) {
    _themeTimestamps.set(_themeCurrentCharId, _themeAudio.currentTime);
    _themeAudio.pause();
    _themePaused = true;
    document.getElementById('theme-bar-playpause').innerHTML = '&#9654;';
    if (eq) eq.classList.add('paused');
  } else {
    _themeAudio.play().catch(() => {});
    _themePaused = false;
    document.getElementById('theme-bar-playpause').innerHTML = '⏸';
    if (eq) eq.classList.remove('paused');
  }
}

function setThemeVolume(vol) {
  _themeVolume = Math.max(0, Math.min(100, vol));
  _themeAudio.volume = _themeVolume / 100;
  const slider = document.getElementById('theme-bar-volume');
  if (slider) slider.style.setProperty('--val', _themeVolume + '%');
  const lbl = document.getElementById('theme-bar-vol-label');
  if (lbl) lbl.textContent = Math.round(_themeVolume);
}

// ── Render the MUSIC tab content ─────────────────────────────
let _themeUploadFormIdx = 0; // which form the next file pick targets

function _themeFormCard(c, formIdx) {
  const label = formIdx === 0 ? 'BASE' : ((c.altForms[formIdx - 1].name || 'FORM ' + formIdx).toUpperCase());
  const song  = _getFormTheme(c, formIdx);
  const key   = _tsKey(c.id, formIdx);
  const playing = (_themeCurrentCharId === key && !_themeAudio.paused && !_themePaused);

  if (song && song.url) {
    const startFmt = _fmtTime(song.startAt || 0);
    return (
      `<div class="theme-tab-form-row">` +
        `<span class="theme-tab-form-label">${_esc(label)}</span>` +
        `<div class="theme-tab-song">` +
          `<div class="theme-tab-song-icon">♫</div>` +
          `<div class="theme-tab-song-details">` +
            `<div class="theme-tab-song-name">${_esc(song.name || 'UNTITLED')}</div>` +
            `<div class="theme-tab-start-row">` +
              `<span class="theme-tab-start-lbl">START</span>` +
              `<input class="theme-tab-start-inp" value="${startFmt}" placeholder="0:00"` +
                ` onchange="parseAndSetThemeStart(${formIdx},this.value)"` +
                ` onclick="this.select()" title="Type a time (M:SS or seconds)"/>` +
              `<button class="btn sm" onclick="captureThemeStart(${formIdx})" title="Set to current playback position">⊙ NOW</button>` +
            `</div>` +
          `</div>` +
          `<div class="theme-tab-song-controls">` +
            `<button class="btn sm" onclick="toggleThemePlayback();renderThemeTab();">${playing ? '⏸ PAUSE' : '▶ PLAY'}</button>` +
            `<button class="btn sm" onclick="openThemeFilePicker(${formIdx})">✎ CHANGE</button>` +
            `<button class="btn sm danger" onclick="clearThemeSong(${formIdx})">✕ REMOVE</button>` +
          `</div>` +
        `</div>` +
      `</div>`
    );
  } else {
    return (
      `<div class="theme-tab-form-row">` +
        `<span class="theme-tab-form-label">${_esc(label)}</span>` +
        `<div class="theme-tab-form-empty">` +
          `<span class="theme-tab-form-none">♪ no theme</span>` +
          `<button class="btn sm accent" onclick="openThemeFilePicker(${formIdx})">+ UPLOAD MP3</button>` +
        `</div>` +
      `</div>`
    );
  }
}

// ── Start-time controls ───────────────────────────────────────
function captureThemeStart(formIdx) {
  const key = _tsKey(currentId, formIdx);
  if (_themeCurrentCharId !== key) {
    notify('PLAY THIS TRACK FIRST TO SET A START POINT', 'err');
    return;
  }
  const t = Math.round(_themeAudio.currentTime * 10) / 10;
  setThemeStartAt(formIdx, t);
}

function parseAndSetThemeStart(formIdx, val) {
  let s = 0;
  val = (val || '').trim();
  if (val.includes(':')) {
    const parts = val.split(':');
    s = (parseInt(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
  } else {
    s = parseFloat(val) || 0;
  }
  setThemeStartAt(formIdx, Math.max(0, s));
}

function setThemeStartAt(formIdx, seconds) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const song = _getFormTheme(c, formIdx);
  if (!song) return;
  song.startAt = seconds;
  // Keep the cached live song in sync so the loop handler uses the new time
  if (_themeCurrentSong && _themeCurrentSong.url === song.url) {
    _themeCurrentSong.startAt = seconds;
  }
  // Clear the session timestamp so the next play starts from the new startAt
  _themeTimestamps.delete(_tsKey(c.id, formIdx));
  saveData(c);
  renderThemeTab();
  notify('START SET: ' + _fmtTime(seconds), 'ok');
}

function renderThemeTab() {
  const container = document.getElementById('theme-tab-content');
  if (!container) return;
  const c = characters.find(x => x.id === currentId);
  if (!c) return;

  const forms = c.altForms || [];
  const allIdx = [0, ...forms.map((_, i) => i + 1)];

  container.innerHTML =
    `<div class="theme-tab-forms">` +
      allIdx.map(i => _themeFormCard(c, i)).join('') +
    `</div>` +
    `<div class="theme-tab-limit" style="padding:8px 18px;">Max ${THEME_MAX_MB} MB per file · auto-plays on character/form switch</div>`;
}

// ── Upload / clear ───────────────────────────────────────────
function openThemeFilePicker(formIdx) {
  if (!currentId) return;
  _themeUploadFormIdx = formIdx || 0;
  document.getElementById('theme-file-input').click();
}

async function onThemeFileSelected(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;

  if (file.size > THEME_MAX_MB * 1024 * 1024) {
    notify(`File too large — max ${THEME_MAX_MB} MB`, 'err');
    return;
  }

  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const formIdx = _themeUploadFormIdx;
  // Make public_id unique per upload to avoid CDN/resource caching serving older bytes.
  const publicIdBase = formIdx === 0 ? `themes/${c.id}` : `themes/${c.id}_${formIdx}`;
  const publicId = publicIdBase + '_' + Date.now();

  notify('Uploading theme...', 'ok');
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY_PRESET);
    form.append('resource_type', 'video');
    form.append('public_id', publicId);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`,
      { method: 'POST', body: form }
    );
    if (!res.ok) throw new Error('Upload failed: ' + res.status);
    const data = await res.json();
    const url = data.secure_url + (data.secure_url.includes('?') ? '&' : '?') + 'v=' + Date.now();
    const songData = { url, name: file.name.replace(/\.[^/.]+$/, '') };

    // Capture previous song (if any) before overwriting — useful for verification
    const prevSong = _getFormTheme(c, formIdx);

    console.log('[UPLOAD] New theme uploaded:', { url: data.secure_url, cachebustedUrl: url, songData, prevSong });

    if (formIdx === 0) {
      c.info = c.info || {};
      c.info.themeSong = songData;
    } else {
      c.altForms = c.altForms || [];
      c.altForms[formIdx - 1] = c.altForms[formIdx - 1] || {};
      c.altForms[formIdx - 1].themeSong = songData;
    }

    _themeTimestamps.delete(_tsKey(c.id, formIdx));
    // Force a reload when this form's theme is replaced.
    _themeReloadKeys.add(_tsKey(c.id, formIdx));
    // Save immediately
    saveData(c);
    // Play immediately if this is the active form, passing the new song directly
    if ((c.activeFormIdx || 0) === formIdx) {
      console.log('[UPLOAD] Playing new theme immediately:', songData);
      playThemeForCharacter(c.id, songData);
    }
    renderThemeTab();
    notify('Theme set!', 'ok');

    // --- Diagnostic verification: fetch uploaded URL (and previous URL) and log SHA-256 hashes ---
    try {
      async function fetchHash(u) {
        try {
          const probeUrl = u + (u.includes('?') ? '&' : '?') + '_dbg=' + Date.now();
          const r = await fetch(probeUrl, { cache: 'no-store' });
          const ab = await r.arrayBuffer();
          const hashBuf = await crypto.subtle.digest('SHA-256', ab);
          const hex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('');
          console.log('[VERIFY] Fetch', probeUrl, 'status', r.status, 'size', ab.byteLength, 'sha256', hex);
          return { status: r.status, size: ab.byteLength, hash: hex };
        } catch (e) {
          console.error('[VERIFY] fetch failed for', u, e);
          return null;
        }
      }

      const newInfo = await fetchHash(songData.url);
      if (prevSong && prevSong.url) {
        const prevInfo = await fetchHash(prevSong.url);
        if (newInfo && prevInfo && newInfo.hash === prevInfo.hash) {
          console.warn('[VERIFY] Uploaded file bytes equal to previous file — CDN or upload may not have updated resource.');
        }
      }
    } catch (e) {
      console.error('[VERIFY] Verification failed', e);
    }
  } catch (e) {
    notify('Upload failed: ' + (e.message || e), 'err');
  }
}

function clearThemeSong(formIdx) {
  formIdx = formIdx || 0;
  const c = characters.find(x => x.id === currentId);
  if (!c) return;

  const key = _tsKey(c.id, formIdx);
  if (_themeCurrentCharId === key) {
    _themeFadeOut(() => { _themeAudio.pause(); _themeAudio.src = ''; });
    _themeCurrentCharId = null;
    _themeCurrentSong = null;
    _themePaused = false;
    _hideThemeBar();
  }

  if (formIdx === 0) {
    if (c.info) delete c.info.themeSong;
  } else {
    if (c.altForms && c.altForms[formIdx - 1]) delete c.altForms[formIdx - 1].themeSong;
  }

  _themeTimestamps.delete(key);
  saveData(c);
  renderThemeTab();
}

// ── Theme bar UI (mini-player — only visible while something is playing) ──────
function _showThemeBar(title, charName, charColor) {
  document.getElementById('theme-bar-title').textContent = title;
  const charEl = document.getElementById('theme-bar-char');
  charEl.textContent = charName;
  const _isNaraBar = _NARA_RE.test(charName || '');
  if (_isNaraBar) { charEl.dataset.naraColor = '1'; charEl.style.color = ''; }
  else { delete charEl.dataset.naraColor; charEl.style.color = charColor || '#888'; }
  document.getElementById('theme-bar-playpause').innerHTML = '⏸';
  // Sync slider + vol label
  const slider = document.getElementById('theme-bar-volume');
  if (slider) {
    slider.value = _themeVolume;
    slider.style.setProperty('--val', _themeVolume + '%');
  }
  const lbl = document.getElementById('theme-bar-vol-label');
  if (lbl) lbl.textContent = Math.round(_themeVolume);
  // Accent colour from character
  const bar = document.getElementById('theme-bar');
  if (_isNaraBar) { bar.dataset.naraBar = '1'; }
  else { delete bar.dataset.naraBar; bar.style.setProperty('--bar-accent', charColor || 'var(--accent-yellow)'); }
  // Equalizer running
  const eq = document.getElementById('theme-bar-eq');
  if (eq) eq.classList.remove('paused');
  // Show bar, then auto-slide to peek after 1.5 s
  bar.classList.remove('peeked');
  bar.classList.add('visible');
  clearTimeout(_themeBarAutoHideTimer);
  if (!window.matchMedia('(max-width: 700px)').matches) {
    _themeBarAutoHideTimer = setTimeout(() => {
      if (!bar.matches(':hover')) {
        bar.classList.remove('visible');
        bar.classList.add('peeked');
      }
    }, 1500);
  }
}

function _hideThemeBar() {
  clearTimeout(_themeBarAutoHideTimer);
  clearTimeout(_themeBarLeaveTimer);
  const bar = document.getElementById('theme-bar');
  if (!bar) return;
  bar.classList.remove('visible', 'peeked');
  const playpause = document.getElementById('theme-bar-playpause');
  if (playpause) playpause.innerHTML = '&#9654;';
  const eq = document.getElementById('theme-bar-eq');
  if (eq) eq.classList.add('paused');
}

function _initThemeBarHover() {
  const bar = document.getElementById('theme-bar');
  if (!bar) return;
  bar.addEventListener('mouseenter', () => {
    clearTimeout(_themeBarLeaveTimer);
    clearTimeout(_themeBarAutoHideTimer);
    bar.classList.add('visible');
    bar.classList.remove('peeked');
  });
  bar.addEventListener('mouseleave', () => {
    if (window.matchMedia('(max-width: 700px)').matches) return;
    _themeBarLeaveTimer = setTimeout(() => {
      if (bar.classList.contains('visible')) {
        bar.classList.remove('visible');
        bar.classList.add('peeked');
      }
    }, 700);
  });

  document.addEventListener('mousemove', e => {
    if (window.matchMedia('(max-width: 700px)').matches) return;
    if (!bar.classList.contains('peeked')) return;
    const bottomDistance = window.innerHeight - e.clientY;
    if (bottomDistance <= 80) {
      clearTimeout(_themeBarLeaveTimer);
      clearTimeout(_themeBarAutoHideTimer);
      bar.classList.add('visible');
      bar.classList.remove('peeked');
    }
  });
}

// ── Autoplay unlock: retry the blocked track on first user interaction ───────
function _unlockAutoplay() {
  if (!_themePendingKey) return;
  _themePendingKey = null;
  // Just resume whatever is loaded — if the user clicked a different character,
  // viewChar → playThemeForCharacter will fire in the same gesture's bubble phase
  // and handle switching cleanly. We only need to unlock the audio context here.
  _themeAudio.play().catch(() => {});
  const eq = document.getElementById('theme-bar-eq');
  if (eq) eq.classList.remove('paused');
  const pp = document.getElementById('theme-bar-playpause');
  if (pp) pp.innerHTML = '⏸';
  const bar = document.getElementById('theme-bar');
  if (bar) { bar.classList.remove('autoplay-blocked'); bar.title = ''; }
}
['click', 'keydown', 'touchstart', 'mousedown'].forEach(type => {
  document.addEventListener(type, _unlockAutoplay, { capture: true, passive: true });
});

// ── Pause when the user switches to another tab / minimises ──────────────────
document.addEventListener('visibilitychange', () => {
  if (document.hidden && _themeCurrentCharId && !_themeAudio.paused) {
    _themeTimestamps.set(_themeCurrentCharId, _themeAudio.currentTime);
    _themeAudio.pause();
    _themePaused = true;
    const pp = document.getElementById('theme-bar-playpause');
    if (pp) pp.innerHTML = '&#9654;';
    const eq = document.getElementById('theme-bar-eq');
    if (eq) eq.classList.add('paused');
  }
});

// Dismiss the mini-player without removing the theme assignment
function stopThemeMini() {
  clearInterval(_themeFadeTimer);
  if (_themeCurrentCharId) _themeTimestamps.set(_themeCurrentCharId, _themeAudio.currentTime);
  _themeAudio.pause();
  _themePaused = true;
  _themeCurrentCharId = null;
  _themeCurrentSong = null;
  _hideThemeBar();
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function notify(msg, type = 'ok') {
  const wrap = document.getElementById('notif');
  const el = document.createElement('div');
  el.className = 'notif-item ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ============================================================
// CONFIRM
// ============================================================
let confirmResolve = null;
function confirm2(msg) {
  return new Promise(res => {
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('confirm-overlay').classList.add('open');
    confirmResolve = res;
  });
}
document.getElementById('confirm-yes').onclick = () => {
  document.getElementById('confirm-overlay').classList.remove('open');
  if (confirmResolve) confirmResolve(true);
};
document.getElementById('confirm-no').onclick = () => {
  document.getElementById('confirm-overlay').classList.remove('open');
  if (confirmResolve) confirmResolve(false);
};

// ============================================================
// COLOR PRESETS
// ============================================================
const PRESETS = [
  '#ffff00', '#ff0000', '#00ff80', '#00ffff', '#ff8000', '#ff80ff',
  '#8000ff', '#ffffff', '#0080ff', '#ff4040', '#80ff00', '#40ffff',
  '#ff6600', '#cc00cc', '#00cc66', '#6666ff'
];
function buildSwatches() {
  const wrap = document.getElementById('color-swatches');
  if (!wrap) return;
  wrap.innerHTML = '';
  PRESETS.forEach(c => {
    const s = document.createElement('div');
    s.className = 'swatch';
    s.style.background = c;
    s.title = c;
    s.onclick = () => {
      document.getElementById('e-color').value = c;
      wrap.querySelectorAll('.swatch').forEach(x => x.classList.remove('active'));
      s.classList.add('active');
    };
    wrap.appendChild(s);
  });
}

// ============================================================
// STAT SEGMENTS HELPER  (prestige-tier-aware)
// ============================================================
const SEG_COUNT = 20;
// Base maximums per stat (one full bar = these values)
const STAT_BASE_MAX = { hp: 999, atk: 99, def: 99, mag: 99, spd: 99, iq: 150 };
// Hard caps matching the power level reference (Mountain Level top)
const STAT_HARD_MAX = { hp: 1250, atk: 300, def: 300, mag: 300, spd: 300, iq: 500 };

const statAnimators = {};

// Helper to show breakdown for main stats
function buildStatBreakdownTooltip(c, stat) {
  const baseVal = c.stats[stat] || 0;
  const items = (c.inventory || []).filter(i => i.equipped);

  // Calculate item bonus
  let itemBonus = 0;
  let itemLines = '';
  items.forEach(item => {
    let sub = 0;
    (item.mods || []).forEach(m => {
      if (m.stat === stat) {
        if (m.op === 'add') sub += parseFloat(m.value) || 0;
        if (m.op === 'sub') sub -= parseFloat(m.value) || 0;
        // mul is trickier because it's multiplicative, but we can approximate it as a delta from base
      }
    });
    if (sub !== 0) {
      itemBonus += sub;
      itemLines += `<div class='tt-line'><span class='tt-stat'>${item.name}</span><span class='tt-val'>${sub > 0 ? '+' : ''}${sub}</span></div>`;
    }
  });

  // Calculate trait/passive bonus by comparing snapshots
  const baseWithItems = JSON.parse(JSON.stringify(c));
  baseWithItems.traits = []; // Remove traits
  const effWithItems = _origGetEffectiveStats(baseWithItems);

  const fullEff = getEffectiveStats(c);
  const traitBonus = fullEff[stat] - effWithItems[stat];

  let traitLines = '';
  if (Math.abs(traitBonus) > 0.5) {
    traitLines = `<div class='tt-line'><span class='tt-stat'>TRAITS/PASSIVES</span><span class='tt-val'>${traitBonus > 0 ? '+' : ''}${Math.round(traitBonus)}</span></div>`;
  }

  let html = `<div class='tt-header-main'>${stat.toUpperCase()} BREAKDOWN</div>`;
  html += `<div class='tt-line'><span class='tt-stat'>BASE</span><span class='tt-val'>${baseVal}</span></div>`;
  if (itemLines) html += itemLines;
  if (traitLines) html += traitLines;
  html += `<div class='tt-breakdown'><div class='tt-line'><span class='tt-stat'>TOTAL</span><span class='tt-val'>${fullEff[stat]}</span></div></div>`;

  return html;
}

function renderStatSegs(val, key, speed = 0.3) {
  if (!statAnimators[key]) {
    statAnimators[key] = { current: val, target: val, frame: null, speed: speed };
  }
  const state = statAnimators[key];
  state.target = val;
  state.speed = speed;

  const animate = () => {
    const diff = state.target - state.current;
    if (Math.abs(diff) < 0.1) {
      state.current = state.target;
      state.frame = null;
    } else {
      state.current += diff * state.speed;
      state.frame = requestAnimationFrame(animate);
    }
    _renderStatSegsFrame(state.current, key);
  };

  if (state.frame) {
    cancelAnimationFrame(state.frame);
    state.frame = null;
  }

  if (state.current === state.target) {
    _renderStatSegsFrame(state.current, key);
  } else {
    animate();
  }
}

function _renderStatSegsFrame(val, key) {
  const baseMax = STAT_BASE_MAX[key];
  if (!baseMax) return;
  const tier = Math.floor((val - 1) / baseMax);
  const valInTier = ((val - 1) % baseMax) + 1;
  const pct = valInTier / baseMax * 100;
  const exactFilled = Math.max(0, Math.min(100, pct)) / 100 * SEG_COUNT;
  const fullFilled = Math.floor(exactFilled);

  const tierEl1 = document.getElementById(`tier-disp-${key}`);
  const tierEl2 = document.getElementById(`e-tier-disp-${key}`);
  const tierText = tier > 0 ? `[T${tier}]` : '';
  if (tierEl1) tierEl1.textContent = tierText;
  if (tierEl2) tierEl2.textContent = tierText;

  const targets = [
    document.getElementById(`stat-segs-${key}`),
    document.getElementById(`e-${key}-segs`)
  ].filter(t => !!t);

  targets.forEach(wrap => {
    // Initialize if empty or old DOM structure
    if (wrap.children.length !== SEG_COUNT || !wrap.children[0].classList.contains('stat-seg-wrap')) {
      wrap.innerHTML = Array.from({ length: SEG_COUNT }, (_, i) =>
        `<div class="stat-seg-wrap" style="--i: ${i}; flex: 1; position: relative;">
           <div class="stat-seg ghost-bg" style="position:absolute; inset:0;"></div>
           <div class="stat-seg fill-fg" style="position:absolute; inset:0; z-index:1; transition: background 0.2s, filter 0.2s;"></div>
         </div>`
      ).join('');
    }

    for (let i = 0; i < SEG_COUNT; i++) {
      const segWrap = wrap.children[i];
      const bg = segWrap.children[0];
      const fg = segWrap.children[1];

      let fillPct = 0;
      if (i < fullFilled) fillPct = 100;
      else if (i === fullFilled) fillPct = (exactFilled - fullFilled) * 100;

      const isPeak = (i === Math.ceil(exactFilled) - 1) && exactFilled > 0;
      const isOn = fillPct > 0;

      bg.className = `stat-seg ghost-bg ${key}`;
      fg.className = `stat-seg fill-fg ${key}`;

      fg.style.clipPath = `polygon(0 0, ${fillPct}% 0, ${fillPct}% 100%, 0 100%)`;

      if (tier === 0) {
        // Base tier: classic on/off behavior
        if (isOn) fg.classList.add(isPeak ? 'peak' : 'on');
      } else {
        // Prestige tiers: stack on top of the previous tier's solid color
        if (isOn) {
          fg.classList.add(isPeak ? 'peak' : 'on', `tier-${Math.min(tier, 25)}`);
        }
        // Background shows the SOLID color of the previous tier
        bg.classList.add('on');
        if (tier > 1) bg.classList.add(`tier-${Math.min(tier - 1, 25)}`);
      }
    }
  });
}

// ============================================================
// STAT DISPLAY
// ============================================================
// ============================================================
// POWER LEVEL AUTO-CALC
// ============================================================
const PL_TIERS = [
  { label: 'BELOW HUMAN', short: '< HUMAN', color: '#555555' },
  { label: 'HUMAN', short: 'HUMAN', color: '#888888' },
  { label: 'ATHLETE', short: 'ATHLETE', color: '#88ccff' },
  { label: 'STREET', short: 'STREET', color: '#88ffaa' },
  { label: 'WALL', short: 'WALL', color: '#ffff88' },
  { label: 'BUILDING', short: 'BUILDING', color: '#ffcc44' },
  { label: 'CITY', short: 'CITY', color: '#ff8844' },
  { label: 'MOUNTAIN', short: 'MOUNTAIN', color: '#ff4444' },
  { label: 'ISLAND', short: 'ISLAND', color: '#ff2200' },
  { label: 'COUNTRY', short: 'COUNTRY', color: '#ff0088' },
  { label: 'CONTINENT', short: 'CONTINENT', color: '#dd00dd' },
  { label: 'PLANETARY', short: 'PLANETARY', color: '#aa00ff' },
  { label: 'STELLAR', short: 'STELLAR', color: '#6600ff' },
  { label: 'GALACTIC', short: 'GALACTIC', color: '#0044ff' },
  { label: 'UNIVERSAL', short: 'UNIVERSAL', color: '#00aaff' },
  { label: 'MULTIVERSAL', short: 'MULTI', color: '#00ffee' },
  { label: 'OMNIVERSAL', short: 'OMNI', color: '#ffffff' },
];
// Minimum value to reach each tier (matches the power level reference modal exactly)
const PL_THRESHOLDS = {
  hp: [1, 25, 50, 100, 225, 350, 500, 850, 1300, 2200, 3500, 6000, 12000, 25000, 55000, 120000, 300000],
  atk: [1, 5, 15, 30, 50, 70, 125, 200, 275, 400, 600, 900, 1500, 3000, 6000, 12000, 25000],
  def: [1, 5, 15, 30, 50, 70, 125, 200, 275, 400, 600, 900, 1500, 3000, 6000, 12000, 25000],
  mag: [1, 5, 15, 30, 50, 70, 125, 200, 275, 400, 600, 900, 1500, 3000, 6000, 12000, 25000],
  spd: [1, 5, 15, 30, 50, 70, 125, 200, 275, 400, 600, 900, 1500, 3000, 6000, 12000, 25000],
  iq:  [1, 10, 30, 50, 80, 110, 140, 175, 210, 250, 300, 350, 400, 440, 470, 490, 500],
};

function getStatPL(stat, value) {
  const thresholds = PL_THRESHOLDS[stat] || PL_THRESHOLDS.atk;
  let tier = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value >= thresholds[i]) tier = i;
  }
  return tier;
}

function getCharOverallPL(c) {
  const STATS = ['hp', 'atk', 'def', 'mag', 'spd'];
  const eff = getEffectiveStats(c);
  let total = 0;
  STATS.forEach(stat => { total += getStatPL(stat, eff[stat] || 0); });
  return PL_TIERS[Math.min(Math.floor(total / STATS.length), PL_TIERS.length - 1)];
}

function updateCharPLBadge(c) {
  const el = document.getElementById('cv-pl-badge');
  if (!el || !c) return;
  const tier = getCharOverallPL(c);
  const isTop = tier.short === 'OMNI';
  el.innerHTML = `<span class="cv-pl-label${isTop ? ' cv-pl-omni' : ''}" style="color:${tier.color};">${tier.label} LEVEL</span>`;
}

function updateEditorPowerLevels() {
  const STATS = ['hp', 'atk', 'def', 'mag', 'spd'];
  let total = 0;
  STATS.forEach(stat => {
    const input = document.getElementById('e-' + stat);
    if (!input) return;
    const tierIdx = getStatPL(stat, parseInt(input.value) || 0);
    total += tierIdx;
    const tier = PL_TIERS[tierIdx];
    const badge = document.getElementById('e-pl-' + stat);
    if (badge) { badge.textContent = tier.short; badge.style.color = tier.color; }
  });
  const overall = PL_TIERS[Math.floor(total / STATS.length)];
  const overallEl = document.getElementById('e-overall-pl');
  if (overallEl) overallEl.innerHTML = `OVERALL &nbsp;<span style="color:${overall.color};letter-spacing:1px;">${overall.label}</span>`;
}

function updateStatDisplay(stat) {
  const map = {
    hp: { disp: 'hp-val-disp', segs: 'e-hp-segs' },
    atk: { disp: 'atk-val-disp', segs: 'e-atk-segs' },
    def: { disp: 'def-val-disp', segs: 'e-def-segs' },
    mag: { disp: 'mag-val-disp', segs: 'e-mag-segs' },
    spd: { disp: 'spd-val-disp', segs: 'e-spd-segs' },
    iq:  { disp: 'iq-val-disp',  segs: 'e-iq-segs' }
  };
  const m = map[stat];
  const input = document.getElementById('e-' + stat);
  if (!input) return;
  const val = parseInt(input.value);
  document.getElementById(m.disp).textContent = val;
  document.getElementById('e-' + stat + '-num').value = val;
  renderStatSegs(val, stat, 1);
  updateEditorPowerLevels();
}

function syncStat(stat, val) {
  const el = document.getElementById('e-' + stat);
  if (!el) return;
  const max = el.max;
  const v = Math.min(max, Math.max(1, parseInt(val) || 1));
  el.value = v;
  updateStatDisplay(stat);
}

function adjustStat(stat, delta) {
  const el = document.getElementById('e-' + stat);
  if (!el) return;
  const v = parseInt(el.value) + delta;
  syncStat(stat, v);
}

// ============================================================
// AVATAR
// ============================================================
let currentAvatarDataURL = null;

// Compress/resize an image dataURL to fit within maxSide × maxSide at the given JPEG quality.
// Returns a Promise that resolves to the compressed dataURL.
function compressImage(dataURL, maxSide = 512, quality = 0.82) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        if (width >= height) { height = Math.round(height * maxSide / width); width = maxSide; }
        else { width = Math.round(width * maxSide / height); height = maxSide; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataURL); // fallback: keep original
    img.src = dataURL;
  });
}

function triggerImgUpload() { document.getElementById('avatar-file').click(); }

function handleImgUpload(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    currentAvatarDataURL = await compressImage(e.target.result, 512, 0.82);
    renderAvatarZone();
  };
  reader.readAsDataURL(file);
}

function clearAvatar() {
  currentAvatarDataURL = null;
  const fileInput = document.getElementById('avatar-file');
  if (fileInput) fileInput.value = '';
  renderAvatarZone();
}

function renderAvatarZone() {
  const zone = document.getElementById('avatar-zone');
  if (!zone) return;
  if (currentAvatarDataURL) {
    zone.innerHTML = `<input type="file" id="avatar-file" accept="image/*" onchange="handleImgUpload(event)"/><img src="${currentAvatarDataURL}" alt=""/>`;
  } else {
    zone.innerHTML = `
      <input type="file" id="avatar-file" accept="image/*" onchange="handleImgUpload(event)"/>
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;">
        <rect x="12" y="2"  width="8"  height="8"  fill="currentColor"/>
        <rect x="10" y="10" width="12" height="10" fill="currentColor"/>
        <rect x="8"  y="20" width="6"  height="8"  fill="currentColor"/>
        <rect x="18" y="20" width="6"  height="8"  fill="currentColor"/>
      </svg>
      <span>UPLOAD</span>`;
  }
}

// ============================================================
// PATTERN SYSTEM
// ============================================================
const PATTERN_DEFS = {
  none: { label: 'None', params: [] },
  bizzy_bees: { label: "Bizzy's Hive", params: [] },
  checkerboard: {
    label: 'Animated Checkerboard',
    params: [
      { id: 'size', label: 'Square Size', type: 'range', min: 8, max: 128, step: 4, default: 32 },
      { id: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 3, step: 0.1, default: 0.5 },
      { id: 'dir', label: 'Direction', type: 'select', options: ['right', 'left', 'down', 'up', 'diagonal'], default: 'diagonal' },
      { id: 'color1', label: 'Color A', type: 'color', default: '#ffffff' },
      { id: 'color2', label: 'Color B', type: 'color', default: '#000000' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.3 },
    ]
  },
  scrolling_lines: {
    label: 'Scrolling Lines',
    params: [
      { id: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 20, step: 1, default: 2 },
      { id: 'gap', label: 'Gap', type: 'range', min: 2, max: 80, step: 2, default: 16 },
      { id: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 5, step: 0.1, default: 1 },
      { id: 'angle', label: 'Angle (deg)', type: 'range', min: 0, max: 180, step: 5, default: 45 },
      { id: 'color', label: 'Color', type: 'color', default: '#ffffff' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.2 },
    ]
  },
  matrix_rain: {
    label: 'Matrix Rain',
    params: [
      { id: 'speed', label: 'Fall Speed', type: 'range', min: 0.2, max: 5, step: 0.2, default: 1.5 },
      { id: 'density', label: 'Density', type: 'range', min: 1, max: 40, step: 1, default: 12 },
      { id: 'size', label: 'Char Size', type: 'range', min: 8, max: 32, step: 2, default: 14 },
      { id: 'color', label: 'Color', type: 'color', default: '#00ff00' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.3 },
    ]
  },
  bouncing_diamonds: {
    label: 'Bouncing Diamonds',
    params: [
      { id: 'count', label: 'Count', type: 'range', min: 1, max: 30, step: 1, default: 8 },
      { id: 'size', label: 'Size', type: 'range', min: 10, max: 100, step: 5, default: 30 },
      { id: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 3, step: 0.1, default: 0.8 },
      { id: 'color', label: 'Color', type: 'color', default: '#ffff00' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.25 },
      { id: 'rotate', label: 'Rotate', type: 'select', options: ['yes', 'no'], default: 'yes' },
    ]
  },
  pulse_rings: {
    label: 'Pulse Rings',
    params: [
      { id: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 3, step: 0.1, default: 0.8 },
      { id: 'count', label: 'Ring Count', type: 'range', min: 1, max: 8, step: 1, default: 4 },
      { id: 'color', label: 'Color', type: 'color', default: '#ffffff' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 0.8, step: 0.05, default: 0.2 },
      { id: 'thick', label: 'Thickness', type: 'range', min: 1, max: 10, step: 1, default: 2 },
    ]
  },
  static_noise: {
    label: 'Static Noise',
    params: [
      { id: 'speed', label: 'Flicker', type: 'range', min: 1, max: 60, step: 1, default: 15 },
      { id: 'size', label: 'Pixel Size', type: 'range', min: 1, max: 12, step: 1, default: 3 },
      { id: 'density', label: 'Density', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.4 },
      { id: 'color', label: 'Color', type: 'color', default: '#ffffff' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 0.8, step: 0.05, default: 0.15 },
    ]
  },
  falling_pixels: {
    label: 'Falling Pixels',
    params: [
      { id: 'count', label: 'Count', type: 'range', min: 5, max: 200, step: 5, default: 60 },
      { id: 'size', label: 'Pixel Size', type: 'range', min: 2, max: 20, step: 1, default: 6 },
      { id: 'speed', label: 'Speed', type: 'range', min: 0.5, max: 8, step: 0.5, default: 2 },
      { id: 'color', label: 'Color', type: 'color', default: '#ffffff' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.25 },
    ]
  },
  scanwave: {
    label: 'Scan Wave',
    params: [
      { id: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 5, step: 0.1, default: 0.8 },
      { id: 'thickness', label: 'Thickness', type: 'range', min: 2, max: 40, step: 2, default: 10 },
      { id: 'color', label: 'Color', type: 'color', default: '#00ffff' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 0.8, step: 0.05, default: 0.2 },
      { id: 'dir', label: 'Direction', type: 'select', options: ['down', 'up', 'right', 'left'], default: 'down' },
    ]
  },
  crosshatch: {
    label: 'Animated Crosshatch',
    params: [
      { id: 'size', label: 'Cell Size', type: 'range', min: 8, max: 80, step: 4, default: 24 },
      { id: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 4, step: 0.1, default: 0.5 },
      { id: 'color', label: 'Color', type: 'color', default: '#ffffff' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 0.8, step: 0.05, default: 0.2 },
    ]
  },
  heartbeat: {
    label: 'Heartbeat / ECG',
    params: [
      { id: 'speed', label: 'BPM', type: 'range', min: 30, max: 200, step: 5, default: 80 },
      { id: 'color', label: 'Color', type: 'color', default: '#ff0000' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.4 },
      { id: 'thick', label: 'Line Width', type: 'range', min: 1, max: 6, step: 1, default: 2 },
    ]
  },
  twinkling_stars: {
    label: 'Twinkling Stars',
    params: [
      { id: 'count', label: 'Count', type: 'range', min: 20, max: 300, default: 100 },
      { id: 'speed', label: 'Twinkle Speed', type: 'range', min: 0.1, max: 5, step: 0.1, default: 1 },
      { id: 'color', label: 'Color', type: 'color', default: '#ffffff' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.1, max: 1, step: 0.1, default: 0.5 },
    ]
  },
  glitch_grid: {
    label: 'Glitch Grid',
    params: [
      { id: 'size', label: 'Cell Size', type: 'range', min: 10, max: 100, default: 40 },
      { id: 'speed', label: 'Glitch Freq', type: 'range', min: 0.1, max: 10, default: 2 },
      { id: 'color', label: 'Color', type: 'color', default: '#00ff80' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.1, max: 0.8, step: 0.05, default: 0.2 },
    ]
  },
  neural_network: {
    label: 'Neural Network',
    params: [
      { id: 'count', label: 'Node Count', type: 'range', min: 10, max: 100, step: 5, default: 40 },
      { id: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 3, step: 0.1, default: 0.5 },
      { id: 'color', label: 'Color', type: 'color', default: '#ffffff' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 0.8, step: 0.05, default: 0.3 },
    ]
  },
  cyber_circuitry: {
    label: 'Cyber Circuitry',
    params: [
      { id: 'density', label: 'Density', type: 'range', min: 1, max: 15, step: 1, default: 6 },
      { id: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 3, step: 0.1, default: 1 },
      { id: 'color', label: 'Color', type: 'color', default: '#00ffaa' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 0.8, step: 0.05, default: 0.3 },
    ]
  },
  digital_vortex: {
    label: 'Digital Vortex',
    params: [
      { id: 'speed', label: 'Rotation', type: 'range', min: 0.1, max: 5, step: 0.1, default: 1 },
      { id: 'color', label: 'Color', type: 'color', default: '#ff00ff' },
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.05, max: 0.8, step: 0.05, default: 0.25 },
    ]
  }
};


let patternParams = {};

function onPatternChange() {
  const type = document.getElementById('e-pattern').value;
  patternParams = {}; // Reset settings only when manually picking a NEW pattern type
  buildPatternParams(type);
  startPreviewAnim(type);
  applyEditorTheme();
}

function buildPatternParams(type) {
  const def = PATTERN_DEFS[type];
  if (!def) return;
  const wrap = document.getElementById('pattern-params');
  if (!wrap) return;
  wrap.innerHTML = '';

  // Only reset global params to defaults if they are empty (brand new character)
  // or if we are switching to a new type (handled by onPatternChange).
  // If we're opening an existing character, patternParams will already be populated.
  if (Object.keys(patternParams).length === 0) {
    def.params.forEach(p => { patternParams[p.id] = p.default; });
  }

  if (!def.params.length) return;

  const grp = document.createElement('div');
  grp.className = 'param-group';
  grp.innerHTML = '<div class="param-group-title">PARAMETERS</div>';
  const grid = document.createElement('div');
  grid.className = 'params-grid';

  def.params.forEach(p => {
    const fld = document.createElement('div');
    fld.className = 'field';
    const cur = patternParams[p.id];

    if (p.type === 'range') {
      fld.innerHTML = `
        <label>${p.label} <span id="ppv-${p.id}">${cur}</span></label>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step || 1}" value="${cur}"
          oninput="patternParams['${p.id}']=+this.value;document.getElementById('ppv-${p.id}').textContent=this.value;startPreviewAnim(document.getElementById('e-pattern').value)"/>`;
    } else if (p.type === 'color') {
      fld.innerHTML = `
        <label>${p.label}</label>
        <input type="color" value="${cur}"
          oninput="patternParams['${p.id}']=this.value;startPreviewAnim(document.getElementById('e-pattern').value)"/>`;
    } else if (p.type === 'select') {
      const opts = p.options.map(o => `<option value="${o}"${o === cur ? ' selected' : ''}>${o.toUpperCase()}</option>`).join('');
      fld.innerHTML = `
        <label>${p.label}</label>
        <select onchange="patternParams['${p.id}']=this.value;startPreviewAnim(document.getElementById('e-pattern').value)">${opts}</select>`;
    }
    grid.appendChild(fld);
  });

  grp.appendChild(grid);
  wrap.appendChild(grp);
}

// ============================================================
// PATTERN RENDERERS
// ============================================================
/* ── Shared bee renderer ─────────────────────────────────────── */
function _bzBeeAt(ctx, b, W, H, t) {
  const sd  = b * 2.399, PI2 = Math.PI * 2;
  const cx0 = W * (0.15 + 0.7 * ((sd * 1.618) % 1));
  const cy0 = H * (0.2  + 0.6 * ((sd * 2.399) % 1));
  const fx1 = 0.31+(b%4)*0.07, fy1 = 0.27+(b%3)*0.08;
  const fx2 = 0.17+(b%3)*0.05, fy2 = 0.13+(b%4)*0.04;
  const ph1 = sd*Math.PI, ph2 = sd*1.732;
  const bx  = cx0+Math.sin(t*fx1*PI2+ph1)*W*0.11+Math.cos(t*fx2*PI2+ph2)*W*0.06;
  const by  = cy0+Math.cos(t*fy1*PI2+ph1)*H*0.09+Math.sin(t*fy2*PI2+ph2)*H*0.05;
  const dt  = 0.06;
  const bx2 = cx0+Math.sin((t+dt)*fx1*PI2+ph1)*W*0.11+Math.cos((t+dt)*fx2*PI2+ph2)*W*0.06;
  const by2 = cy0+Math.cos((t+dt)*fy1*PI2+ph1)*H*0.09+Math.sin((t+dt)*fy2*PI2+ph2)*H*0.05;
  const ang = Math.atan2(by2-by, bx2-bx);
  const wf  = Math.abs(Math.sin(t*22+b*1.57));
  const ws  = 4.5+wf*3.5;
  ctx.save();
  ctx.translate(bx, by); ctx.rotate(ang); ctx.scale(0.78+(sd%0.28), 0.78+(sd%0.28));
  ctx.globalAlpha = 0.28+wf*0.13; ctx.fillStyle = '#cce8ff';
  ctx.beginPath(); ctx.ellipse(-2,-ws,9.5,4,-0.35,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 4,-ws,7,3,0.35,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( 1,ws*0.7,6,2.2,0.3,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0,0,10,6,0,0,Math.PI*2); ctx.clip();
  ctx.fillStyle='#ffcc00'; ctx.fillRect(-12,-8,24,16);
  ctx.fillStyle='rgba(8,3,0,0.78)';
  ctx.fillRect(-8,-8,3.5,16); ctx.fillRect(-1,-8,3.5,16); ctx.fillRect(6,-8,3.5,16);
  ctx.restore();
  ctx.strokeStyle='rgba(90,45,0,0.38)'; ctx.lineWidth=0.6;
  ctx.beginPath(); ctx.ellipse(0,0,10,6,0,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#160c00'; ctx.beginPath(); ctx.arc(-13.5,0,4.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#3a2000'; ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(14,-1.5); ctx.lineTo(14,1.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(12,6,0,0.82)'; ctx.lineWidth=0.7;
  ctx.beginPath(); ctx.moveTo(-16,-2); ctx.quadraticCurveTo(-22,-11,-19,-15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-16,-2); ctx.quadraticCurveTo(-27,-9,-24,-13); ctx.stroke();
  ctx.fillStyle='#160c00';
  ctx.beginPath(); ctx.arc(-19,-15,1.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(-24,-13,1.6,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ── Bizzy overlay + audio + RAF ─────────────────────────────── */
function _bizzyConnectAudio() {
  // IMPORTANT: We deliberately do NOT use createMediaElementSource here.
  // That API permanently hijacks the audio element and, combined with CORS
  // restrictions on Cloudinary URLs, causes the element to output silence
  // forever — breaking playback for every character visited after Bizzy.
  // Instead we track play/pause state via events and simulate the pulse.
  if (_bizzyAudioListening) return;
  _bizzyAudioListening = true;
  const audio = window._themeAudio || document.getElementById('theme-audio');
  if (!audio) return;
  audio.addEventListener('play',  () => { _bizzyIsPlaying = true;  });
  audio.addEventListener('pause', () => { _bizzyIsPlaying = false; });
  audio.addEventListener('ended', () => { _bizzyIsPlaying = false; });
  _bizzyIsPlaying = !!(audio && !audio.paused);
}

function _bizzyGetLevel() {
  // Simulate musical energy variation using playback position.
  // Multiple overlapping sinusoids at different rates approximate
  // the feel of music without any audio API access.
  if (!_bizzyIsPlaying || !window._themeAudio) return 0;
  const t = _themeAudio.currentTime || 0;
  return Math.max(0, Math.min(1,
    0.50 + Math.sin(t * 6.28) * 0.24
         + Math.sin(t * 9.42) * 0.14
         + Math.sin(t * 3.77) * 0.18
  ));
}

function _bizzyPulseColor(c) {
  const cv = document.getElementById('char-view'); if (!cv||!c?.color) return;
  const hex = c.color.replace('#','');
  if (hex.length!==6) return;
  const r=parseInt(hex.slice(0,2),16), g=parseInt(hex.slice(2,4),16), b=parseInt(hex.slice(4,6),16);
  let bright;
  if (_bizzyIsPlaying) {
    const lvl = _bizzyGetLevel();
    _bizzySmoothedLevel = _bizzySmoothedLevel*0.78 + lvl*0.22;
    bright = 0.65 + _bizzySmoothedLevel * 0.75;
  } else {
    // Gentle breathing when no music
    bright = 0.78 + Math.sin(_bizzyRafT * 1.8) * 0.22;
  }
  const pr=Math.min(255,Math.round(r*bright));
  const pg=Math.min(255,Math.round(g*bright));
  const pb=Math.min(255,Math.round(b*bright));
  cv.style.setProperty('--char-color', `rgb(${pr},${pg},${pb})`);
}

function _bizzyRafTick(ts) {
  const c = typeof characters!=='undefined' ? characters.find(x=>x.id===currentId) : null;
  if (!_isBizzy(c)) { _stopBizzyRaf(); return; }
  if (!_bizzyRafPrev) _bizzyRafPrev = ts;
  _bizzyRafT += (ts - _bizzyRafPrev) / 1000;
  _bizzyRafPrev = ts;
  _bizzyPulseColor(c);
  // Draw escaped bees on overlay canvas
  const ov = document.getElementById('bizzy-bee-overlay');
  if (ov) {
    const cvEl = document.getElementById('char-view');
    const nw = cvEl ? cvEl.offsetWidth : 0, nh = cvEl ? cvEl.scrollHeight : 0;
    if (nw>0 && nh>0 && (ov.width!==nw||ov.height!==nh)) { ov.width=nw; ov.height=nh; }
    if (ov.width>0 && ov.height>0) {
      const ctx = ov.getContext('2d');
      ctx.clearRect(0, 0, ov.width, ov.height);
      _bzBeeAt(ctx, 3, ov.width, ov.height, _bizzyRafT);
      _bzBeeAt(ctx, 4, ov.width, ov.height, _bizzyRafT);
    }
  }
  _bizzyRafId = requestAnimationFrame(_bizzyRafTick);
}

function _startBizzyRaf() {
  _bizzyConnectAudio();
  let ov = document.getElementById('bizzy-bee-overlay');
  if (!ov) {
    ov = document.createElement('canvas');
    ov.id = 'bizzy-bee-overlay';
    ov.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;';
    const cv = document.getElementById('char-view');
    if (cv) { cv.style.position='relative'; cv.appendChild(ov); }
  }
  _bizzyRafPrev = 0;
  if (!_bizzyRafId) _bizzyRafId = requestAnimationFrame(_bizzyRafTick);
}

function _stopBizzyRaf() {
  if (_bizzyRafId) { cancelAnimationFrame(_bizzyRafId); _bizzyRafId = null; }
  const ov = document.getElementById('bizzy-bee-overlay'); if (ov) ov.remove();
  // Restore the char's actual color
  const c = typeof characters!=='undefined' ? characters.find(x=>x.id===currentId) : null;
  const cv = document.getElementById('char-view');
  if (cv && c?.color) cv.style.setProperty('--char-color', c.color);
}

/* ── Bizzy's Hive ─────────────────────────────────────────────
   Animated bee pattern: honeycomb grid, honey drips, flying bees,
   drifting pollen. Triggered whenever _isBizzy(currentChar) is true.
──────────────────────────────────────────────────────────────── */
function _drawBizzyPattern(canvas, ctx, W, H, t) {
  ctx.clearRect(0, 0, W, H);

  // ── Honeycomb (flat-top hexagons) ─────────────────────────────
  const R   = 20;                        // center → vertex radius
  const csx = R * 1.5;                   // column x-spacing
  const csy = R * Math.sqrt(3);          // row y-spacing
  for (let col = -1; col * csx < W + csx; col++) {
    for (let row = -1; row * csy < H + csy; row++) {
      const cx = col * csx;
      const cy = row * csy + (col & 1 ? csy * 0.5 : 0);
      const ph = (Math.sin(t * 0.55 + col * 0.71 + row * 1.13) + 1) * 0.5;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        i === 0
          ? ctx.moveTo(cx + R * 0.87 * Math.cos(a), cy + R * 0.87 * Math.sin(a))
          : ctx.lineTo(cx + R * 0.87 * Math.cos(a), cy + R * 0.87 * Math.sin(a));
      }
      ctx.closePath();
      ctx.fillStyle   = `rgba(210,115,0,${(0.10  + ph * 0.22 ).toFixed(3)})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(235,155,0,${(0.22  + ph * 0.32 ).toFixed(3)})`;
      ctx.lineWidth   = 0.9;
      ctx.stroke();
    }
  }

  // ── Honey drips ───────────────────────────────────────────────
  for (let d = 0; d < 6; d++) {
    const sd  = d * 1.618;
    const drx = ((sd * 2.236) % 1) * W;
    const cyc = 5 + sd % 3;
    const ph  = ((t * (0.35 + sd % 0.3)) % cyc) / cyc;
    const dy  = ph * (H + 48) - 48;
    const len = 18 + (sd % 12);
    const r   = 3.5 + (sd % 2.5);
    const al  = 0.10 + (sd * 0.07) % 0.09;
    if (dy > -(len + 10) && dy < H + len) {
      ctx.beginPath();
      ctx.moveTo(drx, dy - len);
      ctx.bezierCurveTo(drx + r, dy - len * 0.5, drx + r, dy, drx, dy + len * 0.28);
      ctx.bezierCurveTo(drx - r, dy, drx - r, dy - len * 0.5, drx, dy - len);
      ctx.fillStyle = `rgba(215,145,0,${al.toFixed(3)})`;
      ctx.fill();
    }
  }

  // ── Flying bees (bees 0-2 stay in the pattern background) ────
  for (let b = 0; b < 3; b++) _bzBeeAt(ctx, b, W, H, t);

  // ── Pollen particles ─────────────────────────────────────────
  for (let p = 0; p < 28; p++) {
    const sd   = p * 0.618;
    const px   = ((sd * 2.73) % 1) * W;
    const spd  = 18 + (sd % 12);
    const py   = ((H - (t * spd + sd * H) % (H + 16) + H + 16)) % (H + 16);
    const drift= Math.sin(t * 0.7 + sd * 6.28) * 14;
    const r    = 1.2 + (sd % 1) * 1.8;
    const al   = 0.15 + (sd % 0.22);
    ctx.fillStyle = `rgba(255,210,20,${al.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(px + drift, py, r, 0, Math.PI*2); ctx.fill();
    const grd = ctx.createRadialGradient(px+drift, py, 0, px+drift, py, r*3.5);
    grd.addColorStop(0, `rgba(255,220,40,${(al*0.25).toFixed(3)})`);
    grd.addColorStop(1, 'rgba(255,200,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(px+drift, py, r*3.5, 0, Math.PI*2); ctx.fill();
  }
}

function drawPattern(canvas, type, params, t) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Special: Bizzy's bee pattern — always overrides stored type
  if (type === 'bizzy_bees') { _drawBizzyPattern(canvas, ctx, W, H, t); return; }

  // Static noise: handle BEFORE clearRect — skip frames cost only a drawImage
  if (type === 'static_noise') {
    const spd = params.speed || 15;
    const sz = params.size || 4;
    const alpha = params.opacity || 0.15;
    const color = params.color || '#ffffff';
    const density = params.density || 0.35;

    // Create texture if missing or settings changed
    if (!canvas._noiseTex || canvas._noiseColor !== color || canvas._noiseSize !== sz || canvas._noiseDensity !== density) {
      canvas._noiseTex = document.createElement('canvas');
      const s = 400; // Small fixed tile size
      canvas._noiseTex.width = s; canvas._noiseTex.height = s;
      const nctx = canvas._noiseTex.getContext('2d');
      nctx.fillStyle = color;
      for (let y = 0; y < s; y += sz) {
        for (let x = 0; x < s; x += sz) {
          if (Math.random() < density) {
            nctx.globalAlpha = 0.4 + Math.random() * 0.6;
            nctx.fillRect(x, y, sz, sz);
          }
        }
      }
      canvas._noiseColor = color; canvas._noiseSize = sz; canvas._noiseDensity = density;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = alpha;

    // Animate by picking random offsets every frame
    const s = 400;
    const offX = Math.floor(Math.random() * s);
    const offY = Math.floor(Math.random() * s);

    // Draw tiled texture (very fast)
    for (let x = -offX; x < W; x += s) {
      for (let y = -offY; y < H; y += s) {
        ctx.drawImage(canvas._noiseTex, x, y);
      }
    }
    ctx.globalAlpha = 1;
    return;
  }

  ctx.clearRect(0, 0, W, H);
  if (type === 'none') return;
  const alpha = params.opacity || 0.25;

  if (type === 'checkerboard') {
    const sz = params.size || 32, spd = params.speed || 0.5, dir = params.dir || 'diagonal';
    const c1 = params.color1 || '#ffffff', c2 = params.color2 || '#000000';

    if (!canvas._checkPat || canvas._checkC1 !== c1 || canvas._checkC2 !== c2 || canvas._checkSz !== sz) {
      const pcan = document.createElement('canvas');
      pcan.width = sz * 2; pcan.height = sz * 2;
      const pctx = pcan.getContext('2d');
      pctx.fillStyle = c1; pctx.fillRect(0, 0, sz, sz); pctx.fillRect(sz, sz, sz, sz);
      pctx.fillStyle = c2; pctx.fillRect(sz, 0, sz, sz); pctx.fillRect(0, sz, sz, sz);
      canvas._checkPat = ctx.createPattern(pcan, 'repeat');
      canvas._checkC1 = c1; canvas._checkC2 = c2; canvas._checkSz = sz;
    }

    let ox = 0, oy = 0;
    if (dir === 'right') ox = (t * spd * 60) % (sz * 2);
    else if (dir === 'left') ox = -(t * spd * 60) % (sz * 2);
    else if (dir === 'down') oy = (t * spd * 60) % (sz * 2);
    else if (dir === 'up') oy = -(t * spd * 60) % (sz * 2);
    else if (dir === 'diagonal') { ox = (t * spd * 60) % (sz * 2); oy = (t * spd * 60) % (sz * 2); }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(ox, oy);
    ctx.fillStyle = canvas._checkPat;
    ctx.fillRect(-sz * 2, -sz * 2, W + sz * 4, H + sz * 4);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  else if (type === 'scrolling_lines') {
    const th = params.thickness || 2, gap = params.gap || 16, spd = params.speed || 1, angle = (params.angle || 45) * Math.PI / 180;
    const color = params.color || '#ffffff';
    const total = th + gap;

    if (!canvas._linePat || canvas._lineC !== color || canvas._lineTh !== th || canvas._lineGap !== gap) {
      const pcan = document.createElement('canvas');
      pcan.width = total; pcan.height = 10;
      const pctx = pcan.getContext('2d');
      pctx.fillStyle = color; pctx.fillRect(0, 0, th, 10);
      canvas._linePat = ctx.createPattern(pcan, 'repeat');
      canvas._lineC = color; canvas._lineTh = th; canvas._lineGap = gap;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(angle);
    ctx.translate(-W, -H); // Cover enough area
    const offset = (t * spd * 60) % total;
    ctx.translate(offset, 0);
    ctx.fillStyle = canvas._linePat;
    ctx.fillRect(0, 0, W * 2.5, H * 2.5);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  else if (type === 'matrix_rain') {
    const size = params.size || 14, spd = params.speed || 3, color = params.color || '#00ff00';
    // Reinit if size changed or not initialized
    if (!canvas._matrixCols || canvas._matrixW !== W || canvas._matrixH !== H) {
      const cols = Math.ceil(W / size) + 1;
      canvas._matrixCols = Array.from({ length: cols }, (_, i) => ({ x: i * size, y: Math.random() * H, speed: 0.5 + Math.random() }));
      canvas._matrixBuf = document.createElement('canvas');
      canvas._matrixBuf.width = W; canvas._matrixBuf.height = H;
      canvas._matrixW = W; canvas._matrixH = H;
    }
    const bctx = canvas._matrixBuf.getContext('2d');
    bctx.fillStyle = 'rgba(0,0,0,0.08)'; bctx.fillRect(0, 0, W, H);
    bctx.fillStyle = color; bctx.font = size + 'px monospace';
    // Use density to control spawn rate/visibility, not total columns
    const density = params.density || 12;
    canvas._matrixCols.forEach(col => {
      if (Math.random() * 40 < density) {
        bctx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96 | 0), col.x, col.y);
      }
      col.y += size * col.speed * spd * 0.06;
      if (col.y > H + size) col.y = -size;
    });
    ctx.globalAlpha = alpha; ctx.drawImage(canvas._matrixBuf, 0, 0, W, H); ctx.globalAlpha = 1;
  }
  else if (type === 'bouncing_diamonds') {
    if (!canvas._diamonds) canvas._diamonds = Array.from({ length: 30 }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, r: 0 }));
    const count = params.count || 8, size = params.size || 30, spd = params.speed || 1.5;
    const color = params.color || '#ffff00', doRotate = params.rotate !== 'no';
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2;
    canvas._diamonds.slice(0, count).forEach(d => {
      d.x += d.vx * spd; d.y += d.vy * spd;
      if (d.x < 0 || d.x > W) d.vx *= -1; if (d.y < 0 || d.y > H) d.vy *= -1;
      if (doRotate) d.r += 0.02;
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.r);
      ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size, 0); ctx.lineTo(0, size); ctx.lineTo(-size, 0); ctx.closePath(); ctx.stroke();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
  else if (type === 'pulse_rings') {
    const spd = params.speed || 0.8, count = params.count || 4, color = params.color || '#ffffff', thick = params.thick || 2;
    // Pre-render one high-quality ring to a buffer if not exists or color changed
    if (!canvas._ringBuf || canvas._ringColor !== color || canvas._ringThick !== thick) {
      canvas._ringBuf = document.createElement('canvas');
      const s = 512; // High res ring template
      canvas._ringBuf.width = s; canvas._ringBuf.height = s;
      const bctx = canvas._ringBuf.getContext('2d');
      bctx.strokeStyle = color; bctx.lineWidth = Math.max(1, thick * (s / Math.max(W, H)));
      bctx.beginPath(); bctx.arc(s / 2, s / 2, s / 2 - 10, 0, 6.284); bctx.stroke();
      canvas._ringColor = color; canvas._ringThick = thick;
    }

    const maxR = Math.max(W, H) * 0.8;
    const centerX = W / 2, centerY = H / 2;

    for (let i = 0; i < count; i++) {
      const phase = ((t * spd * 0.5 + i / count) % 1);
      if (phase <= 0.01) continue;
      const r = phase * maxR;
      ctx.globalAlpha = alpha * (1 - phase);
      const drawS = r * 2;
      ctx.drawImage(canvas._ringBuf, centerX - r, centerY - r, drawS, drawS);
    }
    ctx.globalAlpha = 1;
  }
  else if (type === 'static_noise') { /* handled above */ }
  else if (type === 'falling_pixels') {
    if (!canvas._pixels) canvas._pixels = Array.from({ length: 200 }, () => ({ x: Math.random() * W, y: Math.random() * H, vy: 0.5 + Math.random() * 1.5, size: 0, hueOff: Math.random() * 360 }));
    const count = params.count || 60, size = params.size || 6, spd = params.speed || 2, color = params.color || '#ffffff';
    const _naraPixels = _isNara(characters.find(x => x.id === currentId));
    ctx.globalAlpha = alpha;
    if (!_naraPixels) ctx.fillStyle = color;
    canvas._pixels.slice(0, count).forEach(p => {
      p.y += p.vy * spd;
      if (p.y > H + size) { p.y = -size; p.x = Math.random() * W; }
      if (_naraPixels) {
        const hue = ((_naraRafT * 50 + p.hueOff) % 360 + 360) % 360;
        ctx.fillStyle = `hsl(${hue.toFixed(1)},80%,78%)`;
      }
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), size, size);
    });
    ctx.globalAlpha = 1;
  }
  else if (type === 'scanwave') {
    const spd = params.speed || 2, thick = params.thickness || 10, color = params.color || '#00ffff', dir = params.dir || 'down';
    const period = (dir === 'down' || dir === 'up') ? H : W;
    const pos = (t * spd * 100) % period;
    const grad = (dir === 'down' || dir === 'up') ? ctx.createLinearGradient(0, pos - thick * 2, 0, pos + thick * 2) : ctx.createLinearGradient(pos - thick * 2, 0, pos + thick * 2, 0);
    grad.addColorStop(0, 'transparent'); grad.addColorStop(0.4, 'transparent');
    grad.addColorStop(0.5, color);
    grad.addColorStop(0.6, 'transparent'); grad.addColorStop(1, 'transparent');
    ctx.globalAlpha = alpha; ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  else if (type === 'crosshatch') {
    const sz = params.size || 24, spd = params.speed || 0.5, color = params.color || '#ffffff';

    if (!canvas._hatchPat || canvas._hatchC !== color || canvas._hatchSz !== sz) {
      const pcan = document.createElement('canvas');
      pcan.width = sz; pcan.height = sz;
      const pctx = pcan.getContext('2d');
      pctx.strokeStyle = color; pctx.lineWidth = 1;
      pctx.beginPath(); pctx.moveTo(0, 0); pctx.lineTo(sz, 0); pctx.stroke();
      pctx.beginPath(); pctx.moveTo(0, 0); pctx.lineTo(0, sz); pctx.stroke();
      canvas._hatchPat = ctx.createPattern(pcan, 'repeat');
      canvas._hatchC = color; canvas._hatchSz = sz;
    }

    const offset = (t * spd * 30) % sz;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(offset, offset);
    ctx.fillStyle = canvas._hatchPat;
    ctx.fillRect(-sz, -sz, W + sz * 2, H + sz * 2);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  else if (type === 'heartbeat') {
    const bpm = params.speed || 80, color = params.color || '#ff0000', thick = params.thick || 2;
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = thick;

    const cycleW = 400;
    const scrollSpd = (bpm / 60) * cycleW;
    const worldOffset = t * scrollSpd;
    const mid = H / 2;

    const getIntensity = (idx) => {
      const s = Math.sin(idx * 1.543) * 1000;
      return 0.7 + (s - Math.floor(s)) * 0.6;
    };

    // Sharper profile [px, py_ratio]
    const profile = [[0.18, 0], [0.20, -0.08], [0.22, 0], [0.30, 0], [0.32, -0.45], [0.35, 0.22], [0.38, 0], [0.55, -0.12], [0.65, 0]];

    ctx.beginPath();
    const step = 6; // Larger step for more "polygonal" sharp look
    for (let x = 0; x <= W + step; x += step) {
      const worldX = worldOffset + x;
      const pulseIdx = Math.floor(worldX / cycleW);
      const xInPulse = worldX % cycleW;
      const xRatio = xInPulse / cycleW;

      // Jagged deterministic baseline (no curves)
      const noiseBase = Math.sin(Math.floor(worldX / 15) * 789.123);
      const yOff = (noiseBase - Math.floor(noiseBase)) * 6 - 3;

      const intensity = getIntensity(pulseIdx);
      let spikeY = 0;
      for (let i = 0; i < profile.length - 1; i++) {
        const p1 = profile[i], p2 = profile[i + 1];
        if (xRatio >= p1[0] && xRatio <= p2[0]) {
          const segmentPct = (xRatio - p1[0]) / (p2[0] - p1[0]);
          spikeY = (p1[1] + (p2[1] - p1[1]) * segmentPct) * H * intensity;
          break;
        }
      }

      const finalY = mid + yOff + spikeY;
      if (x === 0) ctx.moveTo(x, finalY);
      else ctx.lineTo(x, finalY);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  else if (type === 'twinkling_stars') {
    // Use pre-placed stars with ImageData for performance
    if (!canvas._stars || canvas._starsW !== W || canvas._starsH !== H) {
      canvas._stars = Array.from({ length: 300 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        s: Math.random() * 2.5 + 0.5, p: Math.random() * Math.PI * 2
      }));
      canvas._starsW = W; canvas._starsH = H;
    }
    const count = Math.min(params.count || 100, 300);
    const spd = params.speed || 1, color = params.color || '#ffffff';
    ctx.save();
    canvas._stars.slice(0, count).forEach(s => {
      const bright = (Math.sin(t * spd * 3 + s.p) + 1) / 2;
      ctx.globalAlpha = alpha * bright;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  else if (type === 'glitch_grid') {
    const sz = params.size || 40, spd = params.speed || 2, color = params.color || '#00ff80';

    if (!canvas._glitchPat || canvas._glitchC !== color || canvas._glitchSz !== sz) {
      const pcan = document.createElement('canvas');
      pcan.width = sz; pcan.height = sz;
      const pctx = pcan.getContext('2d');
      pctx.strokeStyle = color; pctx.lineWidth = 1; pctx.globalAlpha = 0.5;
      pctx.strokeRect(0, 0, sz, sz);
      canvas._glitchPat = ctx.createPattern(pcan, 'repeat');
      canvas._glitchC = color; canvas._glitchSz = sz;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = canvas._glitchPat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Throttled glitches
    if (!canvas._glitchTick) canvas._glitchTick = 0;
    canvas._glitchTick++;
    if (canvas._glitchTick % 4 === 0) {
      ctx.fillStyle = color;
      const count = Math.floor((W * H) / (sz * sz * 20)) * spd;
      for (let i = 0; i < count; i++) {
        const x = Math.random() * W, y = Math.random() * H;
        ctx.globalAlpha = alpha * 1.5;
        ctx.fillRect(x, y, sz, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
  else if (type === 'neural_network') {
    const count = params.count || 40, spd = params.speed || 0.5, color = params.color || '#ffffff';
    if (!canvas._nodes || canvas._nodes.length !== 100) {
      canvas._nodes = Array.from({ length: 100 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5), vy: (Math.random() - 0.5)
      }));
    }
    ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    const active = canvas._nodes.slice(0, count);
    active.forEach(n => {
      n.x = (n.x + n.vx * spd + W) % W;
      n.y = (n.y + n.vy * spd + H) % H;
      ctx.beginPath(); ctx.arc(n.x, n.y, 2, 0, 6.28); ctx.fill();
    });
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = active[i].x - active[j].x, dy = active[i].y - active[j].y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 150 * 150) {
          ctx.globalAlpha = Math.min(1, alpha * (1 - Math.sqrt(distSq) / 150) * 1.5);
          ctx.beginPath(); ctx.moveTo(active[i].x, active[i].y); ctx.lineTo(active[j].x, active[j].y); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
  else if (type === 'cyber_circuitry') {
    const dens = params.density || 6, spd = params.speed || 1, color = params.color || '#00ffaa';
    if (!canvas._circuits) {
      canvas._circuits = Array.from({ length: 15 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        len: 0, maxLen: 50 + Math.random() * 150, dir: Math.floor(Math.random() * 4)
      }));
    }
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2;
    canvas._circuits.slice(0, dens).forEach(c => {
      ctx.beginPath(); ctx.moveTo(c.x, c.y);
      const move = spd * 2;
      if (c.dir === 0) c.x += move; else if (c.dir === 1) c.x -= move;
      else if (c.dir === 2) c.y += move; else c.y -= move;
      ctx.lineTo(c.x, c.y); ctx.stroke();
      c.len += move;
      if (c.len > c.maxLen || c.x < 0 || c.x > W || c.y < 0 || c.y > H) {
        if (Math.random() < 0.3) {
          c.dir = (c.dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
          c.len = 0; c.maxLen = 50 + Math.random() * 150;
        } else {
          c.x = Math.random() * W; c.y = Math.random() * H;
          c.len = 0; c.dir = Math.floor(Math.random() * 4);
        }
      }
      ctx.fillStyle = color; ctx.fillRect(c.x - 2, c.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
  }
  else if (type === 'digital_vortex') {
    const spd = params.speed || 1, color = params.color || '#ff00ff';
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = 2;
    const count = 15;
    const maxS = Math.max(W, H) * 1.2;
    for (let i = 0; i < count; i++) {
      const rot = t * spd * 0.15 + (i / count) * Math.PI * 2;
      const size = ((t * spd * 120 + i * (maxS / count)) % maxS);
      ctx.save();
      ctx.rotate(rot);
      ctx.globalAlpha = alpha * (1 - size / maxS); // Fade out as they get bigger
      ctx.strokeRect(-size / 2, -size / 2, size, size);
      if (i % 3 === 0) {
        ctx.fillStyle = color;
        ctx.fillRect(size / 2 - 5, -size / 2 - 5, 10, 10);
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}


// ============================================================
// ANIMATION LOOPS
// ============================================================
function startPreviewAnim(type) {
  if (previewAnim) cancelAnimationFrame(previewAnim);
  const canvas = document.getElementById('pattern-preview-canvas');
  if (!canvas) return;
  const wrap = document.getElementById('pattern-preview-wrap');
  if (!wrap) return;
  canvas.width = wrap.offsetWidth || 400;
  canvas.height = wrap.offsetHeight || 150;
  canvas._matrixCols = null; canvas._matrixW = 0; canvas._diamonds = null;
  canvas._pixels = null; canvas._stars = null; canvas._starsW = 0;
  canvas._noiseFrame = 0; canvas._noiseBuf = null;
  const params = Object.assign({}, patternParams);
  // Merge with defaults
  const def = PATTERN_DEFS[type];
  if (def) def.params.forEach(p => { if (params[p.id] === undefined) params[p.id] = p.default; });
  const t0 = performance.now();
  function frame(now) {
    drawPattern(canvas, type, params, (now - t0) / 1000);
    previewAnim = requestAnimationFrame(frame);
  }
  previewAnim = requestAnimationFrame(frame);
}

function startBgAnim(type, params) {
  if (bgAnim) cancelAnimationFrame(bgAnim);
  const canvas = document.getElementById('pattern-canvas');
  if (!canvas) return;
  canvas.width = canvas.parentElement.offsetWidth;
  canvas.height = canvas.parentElement.offsetHeight;
  canvas._matrixCols = null; canvas._matrixW = 0; canvas._diamonds = null; canvas._pixels = null; canvas._stars = null; canvas._noiseFrame = 0; canvas._noiseBuf = null;
  if (type === 'none' || !type) return;
  const targetFps = 60;
  if (targetFps === 0) return;
  const frameMs = 1000 / targetFps;
  const t0 = performance.now();
  let lastFrame = -Infinity;
  function frame(now) {
    if (now - lastFrame >= frameMs) {
      lastFrame = now;
      drawPattern(canvas, type, params, (now - t0) / 1000);
    }
    bgAnim = requestAnimationFrame(frame);
  }
  bgAnim = requestAnimationFrame(frame);
}

function stopBgAnim() {
  if (bgAnim) cancelAnimationFrame(bgAnim);
  bgAnim = null;
  const c = document.getElementById('pattern-canvas');
  if (c) {
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  }
}

// ============================================================
// SIDEBAR
// ============================================================
function buildCharEntry(c, contextFolderId) {
  const el = document.createElement('div');
  const isDraft = !!c.isPlaceholder;
  el.className = 'char-entry' + (c.id === currentId ? ' active' : '');
  if (isDraft) el.style.cssText = 'border-left:2px dashed #444;opacity:0.6;';

  const _naraChar = !isDraft && _isNara(c);
  if (_naraChar) {
    _injectNaraStyles();
    el.style.borderLeft = '3px solid';
    el.classList.add('nara-rainbow-border');
  }
  const avatarHTML = c.avatar
    ? `<div class="char-avatar-small${_naraChar ? ' nara-rainbow-border' : ''}"><img src="${c.avatar}"/></div>`
    : _naraChar
      ? `<div class="char-avatar-small nara-rainbow-all"><svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;width:18px;height:18px;"><rect x="12" y="2" width="8" height="8" fill="currentColor"/><rect x="10" y="10" width="12" height="10" fill="currentColor"/><rect x="8" y="20" width="6" height="8" fill="currentColor"/><rect x="18" y="20" width="6" height="8" fill="currentColor"/></svg></div>`
      : `<div class="char-avatar-small" style="color:${isDraft ? '#555' : c.color};"><svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;width:18px;height:18px;"><rect x="12" y="2" width="8" height="8" fill="currentColor"/><rect x="10" y="10" width="12" height="10" fill="currentColor"/><rect x="8" y="20" width="6" height="8" fill="currentColor"/><rect x="18" y="20" width="6" height="8" fill="currentColor"/></svg></div>`;

  const nameHtml = isDraft
    ? `<span style="color:#555;">${c.name}</span>&nbsp;<span style="font-size:6px;color:#444;">[DRAFT]</span>`
    : _naraChar
      ? `<span class="nara-rainbow">${c.name || 'UNNAMED'}</span>`
      : `<span style="color:${c.color}">${c.name || 'UNNAMED'}</span>`;

  const tagsHtml = (c.tags && c.tags.length)
    ? `<div class="char-entry-tags">${c.tags.map(t => `<span class="char-tag">${t}</span>`).join('')}</div>`
    : '';

  el.innerHTML = `
    ${avatarHTML}
    <div class="char-entry-info">
      <div class="char-entry-name">${nameHtml}</div>
      ${tagsHtml}
    </div>
    ${isDraft ? '' : `<button class="char-chat-btn" title="Open chat" onclick="event.stopPropagation();openCharChat('${c.id}')"><svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="12" height="12"><path d="M2 2h12v9H9l-3 3v-3H2V2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></button>`}`;

  el.addEventListener('contextmenu', e => openCharContextMenu(e, c.id));

  el.addEventListener('click', () => {
    closeDrawer();
    if (isDraft) showEditor(c.id);
    else { playSound('characterchange', { volume: 0.7 }); viewChar(c.id); }
  });

  // Drag and drop
  el.setAttribute('draggable', 'true');
  el.dataset.charId = c.id;
  el.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', c.id);
    e.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => el.classList.remove('dragging'));
  el.addEventListener('dragover', e => {
    e.preventDefault();
    document.querySelectorAll('.char-entry').forEach(x => x.classList.remove('drag-over'));
    el.classList.add('drag-over');
  });
  el.addEventListener('drop', e => {
    e.preventDefault();
    document.querySelectorAll('.char-entry').forEach(x => x.classList.remove('drag-over', 'dragging'));
    const fromId = e.dataTransfer.getData('text/plain');
    const toId = c.id;
    if (fromId === toId) return;
    const arr = [...characters];
    const fromIdx = arr.findIndex(x => x.id === fromId);
    const toIdx = arr.findIndex(x => x.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = arr.splice(fromIdx, 1);
    // If dropped into a folder context, assign that folder
    if (contextFolderId !== null) moved.folderId = contextFolderId;
    else moved.folderId = null;
    const insertAt = arr.findIndex(x => x.id === toId);
    arr.splice(insertAt, 0, moved);
    arr.forEach((ch, i) => { ch.order = i; });
    characters = arr;
    renderSidebar();
    arr.forEach(ch => db.collection('characters').doc(ch.id).update({ order: ch.order, folderId: ch.folderId || null }).catch(() => { }));
  });

  return el;
}

function renderSidebar() {
  const list = document.getElementById('char-list');
  if (!list) return;
  list.innerHTML = '';

  // Search mode: flat filtered list, no folder grouping
  if (_sidebarSearch) {
    const q = _sidebarSearch;
    const filtered = characters.filter(c => c.name?.toLowerCase().includes(q));
    if (!filtered.length) {
      list.innerHTML = '<div style="padding:16px;font-size:8px;color:#333;letter-spacing:1px;text-align:center;">-- NO RESULTS --</div>';
      return;
    }
    filtered.forEach(c => list.appendChild(buildCharEntry(c, c.folderId || null)));
    return;
  }

  if (!characters.length && !folders.length) {
    list.innerHTML = '<div style="padding:16px;font-size:8px;color:#333;letter-spacing:1px;text-align:center;line-height:2;">-- EMPTY --</div>';
    return;
  }

  // --- FOLDERS ---
  folders.forEach(folder => {
    const folderChars = characters.filter(c => c.folderId === folder.id);
    const folderEl = document.createElement('div');
    folderEl.className = 'folder-group';

    const isCollapsed = folder.collapsed;
    folderEl.innerHTML = `
      <div class="folder-header" style="border-left: 3px solid ${folder.color};" onclick="toggleFolder('${folder.id}')">
        <span class="folder-toggle">${isCollapsed ? '▶' : '▼'}</span>
        <span class="folder-name" style="color:${folder.color};">${folder.name}</span>
        <span class="folder-count" style="color:#555;">(${folderChars.length})</span>
        <div class="folder-actions" onclick="event.stopPropagation()">
          <button class="btn icon-btn" title="Edit folder" onclick="openFolderModal('${folder.id}')">&#9998;</button>
          <button class="btn icon-btn danger" title="Delete folder" onclick="deleteFolder('${folder.id}')">&#x2715;</button>
        </div>
      </div>
      <div class="folder-contents" ${isCollapsed ? 'style="display:none;"' : ''} id="folder-${folder.id}-contents">
      </div>
    `;
    list.appendChild(folderEl);

    const contents = folderEl.querySelector('.folder-contents');
    folderChars.forEach(c => {
      contents.appendChild(buildCharEntry(c, folder.id));
    });

    // Make folder header + contents drop targets (for dragging chars INTO this folder)
    const header = folderEl.querySelector('.folder-header');
    [header, contents].forEach(zone => {
      zone.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
        folderEl.classList.add('folder-drag-over');
      });
      zone.addEventListener('dragleave', e => {
        if (!folderEl.contains(e.relatedTarget)) folderEl.classList.remove('folder-drag-over');
      });
      zone.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        folderEl.classList.remove('folder-drag-over');
        document.querySelectorAll('.char-entry').forEach(x => x.classList.remove('drag-over', 'dragging'));
        const fromId = e.dataTransfer.getData('text/plain');
        const ch = characters.find(x => x.id === fromId);
        if (!ch || ch.folderId === folder.id) return;
        ch.folderId = folder.id;
        saveData(ch);
        renderSidebar();
      });
    });
  });

  // --- UNGROUPED ---
  const ungrouped = characters.filter(c => !c.folderId);
  ungrouped.forEach(c => {
    list.appendChild(buildCharEntry(c, null));
  });
}

// ============================================================
// FOLDER MANAGEMENT
// ============================================================
let _folderModalId = null;

function openFolderModal(folderId) {
  _folderModalId = folderId || null;
  const existing = folderId ? folders.find(f => f.id === folderId) : null;
  const titleEl = document.getElementById('folder-modal-title');
  const nameEl = document.getElementById('folder-modal-name');
  const colorEl = document.getElementById('folder-modal-color');
  if (!nameEl) return; // utilities page doesn't have the modal
  if (titleEl) titleEl.textContent = existing ? 'EDIT FOLDER' : 'NEW FOLDER';
  nameEl.value = existing?.name || '';
  const color = existing?.color || '#4a9eff';
  colorEl.value = color;
  updateFolderSwatches(color);
  document.getElementById('folder-modal-overlay').classList.add('open');
  document.getElementById('folder-modal').classList.add('open');
  nameEl.onkeydown = e => { if (e.key === 'Enter') saveFolderModal(); if (e.key === 'Escape') closeFolderModal(); };
  setTimeout(() => nameEl.focus(), 30);
}

function closeFolderModal() {
  const ov = document.getElementById('folder-modal-overlay');
  const md = document.getElementById('folder-modal');
  if (ov) ov.classList.remove('open');
  if (md) md.classList.remove('open');
}

function saveFolderModal() {
  const name = (document.getElementById('folder-modal-name')?.value || '').trim() || 'New Folder';
  const color = document.getElementById('folder-modal-color')?.value || '#4a9eff';
  if (!db) { closeFolderModal(); return; }
  if (_folderModalId) {
    db.collection('folders').doc(_folderModalId).update({ name, color });
  } else {
    db.collection('folders').add({ name, color, collapsed: false, order: folders.length });
  }
  closeFolderModal();
}

function updateFolderSwatches(color) {
  document.querySelectorAll('.folder-swatch').forEach(s => {
    s.classList.toggle('selected', s.dataset.color?.toLowerCase() === color?.toLowerCase());
  });
}

function pickFolderSwatch(el) {
  const color = el.dataset.color;
  const colorEl = document.getElementById('folder-modal-color');
  if (colorEl) colorEl.value = color;
  updateFolderSwatches(color);
}

function deleteFolder(folderId) {
  if (!confirm('Delete this folder? Characters inside will become ungrouped.')) return;
  characters.filter(c => c.folderId === folderId).forEach(c => {
    c.folderId = null;
    saveData(c);
  });
  db.collection('folders').doc(folderId).delete();
}

function toggleFolder(folderId) {
  const f = folders.find(x => x.id === folderId);
  if (!f) return;
  db.collection('folders').doc(folderId).update({ collapsed: !f.collapsed });
}

function assignToFolder(charId, folderId) {
  const c = characters.find(x => x.id === charId);
  if (!c) return;
  c.folderId = folderId || null;
  saveData(c);
  renderSidebar();
}

// ============================================================
// CHARACTER CONTEXT MENU (right-click)
// ============================================================
let _ctxCharId = null;

function openCharContextMenu(e, charId) {
  e.preventDefault();
  e.stopPropagation();
  _ctxCharId = charId;
  const menu = document.getElementById('char-context-menu');
  if (!menu) return;
  const c = characters.find(x => x.id === charId);
  if (!c) return;

  // Show/hide Edit for placeholder drafts
  const editItem = document.getElementById('ctx-edit');
  if (editItem) editItem.style.display = c.isPlaceholder ? 'none' : '';

  // Populate folder list
  const folderSection = document.getElementById('ctx-folder-section');
  const folderList = document.getElementById('ctx-folder-list');
  if (folderSection) folderSection.style.display = folders.length ? '' : 'none';
  if (folderList) {
    folderList.innerHTML = [
      `<div class="ctx-item ctx-folder-opt" onclick="ctxMoveToFolder(null)">&#x2014; NO FOLDER</div>`,
      ...folders.map(f => `<div class="ctx-item ctx-folder-opt" style="color:${f.color}" onclick="ctxMoveToFolder('${f.id}')">${f.name}${c.folderId === f.id ? ' &#10003;' : ''}</div>`)
    ].join('');
  }

  // Position at cursor, flip if too close to edge
  menu.style.left = '-9999px';
  menu.style.top = '-9999px';
  menu.classList.add('open');
  requestAnimationFrame(() => {
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const x = (e.clientX + mw > window.innerWidth) ? e.clientX - mw : e.clientX;
    const y = (e.clientY + mh > window.innerHeight) ? e.clientY - mh : e.clientY;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  });
}

function closeCharContextMenu() {
  const menu = document.getElementById('char-context-menu');
  if (menu) menu.classList.remove('open');
  _ctxCharId = null;
}

function ctxEdit() {
  const id = _ctxCharId;
  closeCharContextMenu();
  if (!id) return;
  const c = characters.find(x => x.id === id);
  if (!c) return;
  c.isPlaceholder ? showEditor(id) : editChar(id);
}

function ctxDelete() {
  const id = _ctxCharId;
  closeCharContextMenu();
  if (id) deleteChar(id);
}

function ctxMoveToFolder(folderId) {
  const id = _ctxCharId;
  closeCharContextMenu();
  if (id) assignToFolder(id, folderId);
}

function ctxDuplicate() {
  const id = _ctxCharId;
  closeCharContextMenu();
  if (!id) return;
  const src = characters.find(x => x.id === id);
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = genId();
  copy.createdAt = Date.now();
  copy.order = characters.reduce((m, c) => Math.max(m, c.order ?? 0), 0) + 1;
  copy.isPlaceholder = false;
  // Find a unique name: "Name (1)", "Name (2)", etc.
  const base = src.name.replace(/ \(\d+\)$/, '');
  let n = 1;
  while (characters.some(c => c.name === `${base} (${n})`)) n++;
  copy.name = `${base} (${n})`;
  characters.push(copy);
  saveData(copy);
  renderSidebar();
  notify(`"${copy.name}" CREATED`, 'ok');
}

// Close context menu on any outside click
document.addEventListener('click', () => closeCharContextMenu());

// ============================================================
// VIEW
// ============================================================
function viewChar(id) {
  currentId = id;
  loadPity();
  const c = characters.find(x => x.id === id);
  if (!c) return;

  // Clear cached trait tooltips so they rebuild for the new character
  document.querySelectorAll('.trait-chip[data-trait][data-tooltip]').forEach(chip => {
    delete chip.dataset.tooltip;
  });

  document.getElementById('empty-state').style.display = 'none';
  const cv = document.getElementById('char-view');
  if (!cv.classList.contains('active')) {
    // First reveal — play the entry animation (doesn't scroll reset because
    // the view wasn't taking up any space before).
    cv.classList.add('active');
  }
  // When already visible, skip the remove→reflow→add cycle entirely.
  // That cycle briefly sets display:none which collapses page height and
  // resets scroll. Content updates in-place instead.

  document.getElementById('editor').classList.remove('active');
  if (previewAnim) cancelAnimationFrame(previewAnim);

  // Resolve active form avatar (falls back to base avatar if alt form has none)
  const _cvFormIdx = c.activeFormIdx || 0;
  const _cvAltForm = _cvFormIdx > 0 ? (c.altForms || [])[_cvFormIdx - 1] : null;
  const _cvAvatar = (_cvAltForm && _cvAltForm.avatar) ? _cvAltForm.avatar : c.avatar;

  const avatarEl = document.getElementById('cv-avatar');
  const _naraMode = _isNara(c);
  if (_cvAvatar) {
    avatarEl.innerHTML = `<img src="${_cvAvatar}"/>`;
  } else if (_naraMode) {
    avatarEl.innerHTML = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;width:56px;height:56px;">
      <rect x="12" y="2" width="8" height="8" data-nara-fill="1"/>
      <rect x="10" y="10" width="12" height="10" data-nara-fill="1"/>
      <rect x="8" y="20" width="6" height="8" data-nara-fill="1"/>
      <rect x="18" y="20" width="6" height="8" data-nara-fill="1"/>
    </svg>`;
  } else {
    avatarEl.innerHTML = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;width:56px;height:56px;">
      <rect x="12" y="2" width="8" height="8" fill="${c.color}"/>
      <rect x="10" y="10" width="12" height="10" fill="${c.color}"/>
      <rect x="8" y="20" width="6" height="8" fill="${c.color}"/>
      <rect x="18" y="20" width="6" height="8" fill="${c.color}"/>
    </svg>`;
  }
  if (_naraMode) {
    avatarEl.dataset.naraBorder = '1';
    avatarEl.style.borderColor = '';
  } else {
    delete avatarEl.dataset.naraBorder;
    avatarEl.style.borderColor = c.color;
  }

  const cvNameEl = document.getElementById('cv-name');
  cvNameEl.textContent = c.name || 'UNNAMED';
  if (_naraMode) {
    cvNameEl.dataset.naraColor = '1';
    cvNameEl.style.color = '';
  } else {
    delete cvNameEl.dataset.naraColor;
    cvNameEl.style.color = c.color;
  }
  renderFormSwitcher(c);
  updateCharPLBadge(c);
  renderRadarChart(c);
  const mbn = document.getElementById('mobile-char-name');
  if (mbn) {
    mbn.textContent = c.name || 'UNNAMED';
    if (_naraMode) { mbn.dataset.naraColor = '1'; mbn.style.color = ''; }
    else { delete mbn.dataset.naraColor; mbn.style.color = c.color || '#fff'; }
  }
  updateGoldDisplay(c);

  const bioText = document.getElementById('cv-bio-text');
  if (c.bio && c.bio.trim() !== '') {
    bioText.textContent = c.bio;
    bioText.style.display = 'block';
  } else {
    bioText.style.display = 'none';
  }

  // Populate INFO tab fields
  const _info = c.info || {};
  const nameTitleEl = document.getElementById('cv-info-name-title');
  if (nameTitleEl) nameTitleEl.textContent = c.name || '???';
  const _setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  _setVal('cv-info-owner', _info.owner);
  _setVal('cv-info-age', _info.age);
  _setVal('cv-info-pronouns', _info.pronouns);
  _setVal('cv-info-race', _info.race);
  _setVal('cv-info-height', _info.height);
  _setVal('cv-info-origin', _info.origin);
  _setVal('cv-info-occupation', _info.occupation);
  _setVal('cv-info-affiliation', _info.affiliation);
  _setVal('cv-info-personality', _info.personality);
  _setVal('cv-info-goals', _info.goals);
  _setVal('cv-info-fears', _info.fears);
  _setVal('cv-info-bio', _info.bio);
  _setVal('cv-info-notes', _info.notes);
  // If field has content → show preview; if empty → show edit
  ['personality', 'goals', 'fears', 'bio', 'notes'].forEach(k => {
    const wrap = document.getElementById('info-md-' + k);
    if (!wrap) return;
    const ta = wrap.querySelector('textarea');
    const pv = wrap.querySelector('.info-md-rendered');
    const btn = wrap.querySelector('.info-md-btn');
    if (_info[k] && _info[k].trim()) {
      pv.innerHTML = renderMarkdown(_info[k]);
      pv.style.display = '';
      ta.style.display = 'none';
      if (btn) btn.textContent = '✎ EDIT';
      wrap.dataset.mode = 'preview';
    } else {
      pv.style.display = 'none';
      pv.innerHTML = '';
      ta.style.display = '';
      if (btn) btn.textContent = '▶ PREVIEW';
      wrap.dataset.mode = 'edit';
    }
  });
  // Render media link rows
  renderInfoLinks('soundtrack');
  renderInfoLinks('voiceclaims');
  // Owner subtitle in stats tab
  const ownerDisp = document.getElementById('cv-info-owner-display');
  if (ownerDisp) {
    ownerDisp.textContent = _info.owner ? 'BY ' + _info.owner.toUpperCase() : '';
    ownerDisp.style.display = _info.owner ? '' : 'none';
  }

  // Set color on the view root for all panels to inherit
  if (_naraMode) { _startNaraRaf(); _stopBizzyRaf(); }
  else if (_isBizzy(c)) { _stopNaraRaf(); _startBizzyRaf(); }
  else { _stopNaraRaf(); _stopBizzyRaf(); document.getElementById('char-view').style.setProperty('--char-color', c.color); }
  const statsEl = document.getElementById('cv-stats');
  const effStats = getEffectiveStats(c);

  const stats = [
    { key: 'hp', label: 'HP', icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: var(--accent-green);"><path d="M5 9L1 5A2.5 2.5 0 0 1 5 2 2.5 2.5 0 0 1 9 5Z" fill="currentColor"/></svg>` },
    { key: 'atk', label: 'ATK', icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: var(--accent-red);"><path d="M2 8l1 1 6-6-1-1-6 6zM1 9l2-1-1-1-1 2z" fill="currentColor"/></svg>` },
    { key: 'def', label: 'DEF', icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: var(--accent-blue);"><path d="M1 2v4c0 3 4 3.5 4 3.5s4-.5 4-3.5V2l-4-1-4 1z" fill="currentColor"/></svg>` },
    { key: 'mag', label: 'MAG', icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: #ff44ff;"><path d="M5 1l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill="currentColor"/></svg>` },
    { key: 'spd', label: 'SPD', icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: var(--accent-yellow);"><path d="M6 0L2 5H5L4 10L9 4H5Z" fill="currentColor"/></svg>` },
    { key: 'iq',  label: 'IQ',  icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: #00bbcc;"><path d="M4 2C3 2 2 3 2 4.5c0 1 .5 2 1.5 2.5C3 8.5 4 8.5 5 8.5c1 0 2 0 1.5-1.5C7.5 6.5 8 5.5 8 4.5 8 3 7 2 6 2c-.5 0-1 .2-1 .5C5 2.2 4.5 2 4 2zm1 .5V8M3.5 4C4 3.5 4.5 3.6 4.5 4.1M5.5 4C6 3.5 6.5 3.6 6.5 4.1M3.5 5.7C4 5.2 4.5 5.3 4.5 5.8M5.5 5.7C6 5.2 6.5 5.3 6.5 5.8" fill="none" stroke="currentColor" stroke-width="0.75" stroke-linecap="round"/></svg>` },
  ];
  statsEl.innerHTML = stats.map(s => {
    const baseVal = c.stats[s.key] || 0;
    const effVal = effStats[s.key];
    const diff = effVal - baseVal;
    let diffHtml = '';
    if (diff !== 0) {
      const tooltip = buildStatBreakdownTooltip(c, s.key);
      const sign = diff > 0 ? '+' : '';
      const cls = diff > 0 ? 'pos' : 'neg';
      diffHtml = `<span class="eff-stat-diff ${cls}" data-tooltip="${tooltip}">(${sign}${diff})</span>`;
    }

    return `<div class="stat-row">
      <div class="stat-label" style="display:flex;align-items:center;">
        ${s.icon}${s.label}
        <span id="tier-disp-${s.key}" style="margin-left:6px; font-size:8px; font-weight:bold; color:var(--accent-cyan); letter-spacing:1px;"></span>
      </div>
      <div class="stat-segs" id="stat-segs-${s.key}"></div>
      <div class="stat-val">${effVal}${diffHtml}</div>
    </div>`;
  }).join('');

  // Fill segments after DOM is ready
  stats.forEach(s => renderStatSegs(effStats[s.key], s.key));

  renderSubstatsDisplay(c, effStats);

  const styleEl = document.getElementById('cv-pattern-info');
  const ptype = _isBizzy(c) ? 'bizzy_bees' : (c.pattern?.type || 'none');
  const pdef = PATTERN_DEFS[ptype];
  styleEl.innerHTML = `<div style="font-size:9px;letter-spacing:2px;margin-bottom:14px;line-height:1.8;">PATTERN: <span class="text-yellow">${pdef?.label || 'None'}</span></div>`;
  if (ptype !== 'none' && ptype !== 'bizzy_bees' && pdef) {
    const pp = c.pattern?.params || {};
    pdef.params.forEach(p => {
      const v = pp[p.id] !== undefined ? pp[p.id] : p.default;
      styleEl.innerHTML += `<div style="font-size:8px;letter-spacing:1px;margin-bottom:6px;color:#666;">${p.label}: <span style="color:#ccc;">${v}</span></div>`;
    });
  }

  stopBgAnim();
  if (ptype !== 'none') startBgAnim(ptype, c.pattern?.params || {});

  renderInventory(c);
  renderTraitsDisplay(c);
  renderSidebar();
}

function openRollHistory() {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  renderRollHistory(c);
  document.getElementById('roll-history-overlay').classList.add('open');
  document.getElementById('roll-history-modal').classList.add('open');
}
function closeRollHistory() {
  document.getElementById('roll-history-overlay')?.classList.remove('open');
  document.getElementById('roll-history-modal')?.classList.remove('open');
}

function renderRollHistory(c) {
  const wrap = document.getElementById('cv-roll-history');
  if (!wrap) return;
  const hist = c.traitHistory || [];
  if (!hist.length) {
    wrap.innerHTML = `<div style="padding:16px;font-size:8px;color:#444;text-align:center;letter-spacing:1px;">NO ROLLS YET</div>`;
    return;
  }
  const RAR_COLOR = { common: 'var(--rar-common-fg)', rare: 'var(--rar-rare-fg)', epic: 'var(--rar-epic-fg)', legendary: 'var(--rar-legendary-fg)', mythic: 'var(--rar-mythic-fg)', hexxed: 'var(--rar-hexxed-fg)' };
  wrap.innerHTML = hist.map(h => {
    const d = new Date(h.ts);
    const ds = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `<div class="history-row">
      <span class="history-rar" style="color:${RAR_COLOR[h.rarity] || '#aaa'}">${(h.rarity || '').toUpperCase()}</span>
      <span class="history-name">${h.name}</span>
      <span class="history-date">${ds}</span>
    </div>`;
  }).join('');
}

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-stats').style.display      = tab === 'stats'     ? '' : 'none';
  document.getElementById('tab-style').style.display      = tab === 'style'     ? '' : 'none';
  document.getElementById('tab-info').style.display       = tab === 'info'      ? '' : 'none';
  document.getElementById('tab-music').style.display      = tab === 'music'     ? '' : 'none';
  document.getElementById('tab-abilities').style.display  = tab === 'abilities' ? '' : 'none';
  if (tab === 'music')     renderThemeTab();
  if (tab === 'abilities') renderAbilitiesTab();
}

// Jump to a tab by name — used by the mini-player bar click
function switchTabById(tab) {
  const btn = document.getElementById('tab-btn-' + tab);
  if (btn) switchTab(tab, btn);
}

let _infoSaveTimer = null;
function saveInfoField(key, val) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.info = c.info || {};
  c.info[key] = val;
  // Update owner subtitle in stats tab live
  if (key === 'owner') {
    const el = document.getElementById('cv-info-owner-display');
    if (el) { el.textContent = val ? 'BY ' + val.toUpperCase() : ''; el.style.display = val ? '' : 'none'; }
  }
  clearTimeout(_infoSaveTimer);
  _infoSaveTimer = setTimeout(() => saveData(c), 600);
}

function inlineMarkdown(raw) {
  // Escape HTML first so user content can't inject tags
  let s = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
  s = s.replace(/`(.+?)`/g, '<code>$1</code>');
  return s;
}

function renderMarkdown(raw) {
  if (!raw || !raw.trim()) return '<span style="opacity:0.2;font-size:7px;letter-spacing:1px;">— empty —</span>';
  const lines = raw.split('\n');
  let html = '', inList = false;
  for (const line of lines) {
    if (/^### /.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h5>${inlineMarkdown(line.slice(4))}</h5>`; continue; }
    if (/^## /.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h4>${inlineMarkdown(line.slice(3))}</h4>`; continue; }
    if (/^# /.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${inlineMarkdown(line.slice(2))}</h3>`; continue; }
    if (/^> /.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`; continue; }
    if (/^---+$/.test(line.trim())) { if (inList) { html += '</ul>'; inList = false; } html += '<hr>'; continue; }
    if (/^[-*] /.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inlineMarkdown(line.slice(2))}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    if (!line.trim()) { html += '<br>'; continue; }
    html += `<p>${inlineMarkdown(line)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}

function toggleInfoPreview(key) {
  const wrap = document.getElementById('info-md-' + key);
  if (!wrap) return;
  const textarea = wrap.querySelector('textarea');
  const preview = wrap.querySelector('.info-md-rendered');
  const btn = wrap.querySelector('.info-md-btn');
  if (wrap.dataset.mode !== 'preview') {
    preview.innerHTML = renderMarkdown(textarea.value);
    preview.style.display = '';
    textarea.style.display = 'none';
    btn.textContent = '✎ EDIT';
    wrap.dataset.mode = 'preview';
  } else {
    preview.style.display = 'none';
    textarea.style.display = '';
    textarea.focus();
    btn.textContent = '▶ PREVIEW';
    wrap.dataset.mode = 'edit';
  }
}

// ============================================================
// INFO TAB — media links
// ============================================================
function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getPlatformIcon(url) {
  if (!url) return `<svg width="18" height="18" viewBox="0 0 12 12" fill="none" stroke="#333" stroke-width="1.2"><path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8"/><path d="M8 1h3v3M11 1 6 6" stroke-linecap="round"/></svg>`;
  if (/youtu\.?be/.test(url))
    return `<svg width="18" height="18" viewBox="0 0 12 12"><rect width="12" height="12" rx="2" fill="#ff0000"/><polygon points="5,4 5,8 9,6" fill="white"/></svg>`;
  if (/spotify/.test(url))
    return `<svg width="18" height="18" viewBox="0 0 12 12"><circle cx="6" cy="6" r="6" fill="#1db954"/><path d="M3.5 4.5c1.5-.7 3.5-.6 5 .3M3.5 6.2c1.2-.5 2.8-.5 4 .3M3.5 7.9c.9-.4 2.1-.4 3 .2" stroke="white" stroke-width="0.9" stroke-linecap="round" fill="none"/></svg>`;
  return `<svg width="18" height="18" viewBox="0 0 12 12" fill="none" stroke="#555" stroke-width="1.2"><path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8"/><path d="M8 1h3v3M11 1 6 6" stroke-linecap="round"/></svg>`;
}

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function renderInfoLinks(key) {
  const container = document.getElementById('info-links-' + key);
  if (!container) return;
  const c = characters.find(x => x.id === currentId);
  const links = (c && c.info && c.info[key]) || [];
  container.innerHTML = '';
  links.forEach((link, idx) => {
    const entry = document.createElement('div');
    entry.className = 'info-link-entry';
    const hasUrl = !!link.url;
    const vid = getYouTubeId(link.url);
    const row = document.createElement('div');
    row.className = 'info-link-row';
    row.innerHTML =
      `<input type="text" class="info-link-title" placeholder="Title (optional)..." value="${_esc(link.title)}" oninput="updateInfoLink('${key}',${idx},'title',this.value)">` +
      `<a class="info-link-platform" href="${_esc(link.url) || '#'}" target="_blank" rel="noopener" tabindex="${hasUrl ? '0' : '-1'}" style="pointer-events:${hasUrl ? 'auto' : 'none'}">${getPlatformIcon(link.url)}</a>` +
      `<input type="text" class="info-link-url" placeholder="YouTube or Spotify URL..." value="${_esc(link.url)}" oninput="updateInfoLink('${key}',${idx},'url',this.value)">` +
      `<input type="text" class="info-link-note" placeholder="add a note..." value="${_esc(link.note)}" oninput="updateInfoLink('${key}',${idx},'note',this.value)">` +
      (vid ? `<button class="info-link-play" onclick="playInfoLink('${key}',${idx})">▶ PLAY</button>` : '') +
      `<a class="info-link-open" href="${_esc(link.url) || '#'}" target="_blank" rel="noopener" style="opacity:${hasUrl ? '0.55' : '0.15'};pointer-events:${hasUrl ? 'auto' : 'none'}" title="Open in new tab">↗</a>` +
      `<button class="info-link-remove" onclick="removeInfoLink('${key}',${idx})" title="Remove">×</button>`;
    const player = document.createElement('div');
    player.className = 'info-link-player';
    player.style.display = 'none';
    entry.appendChild(row);
    entry.appendChild(player);
    container.appendChild(entry);
  });
}

function playInfoLink(key, idx) {
  const container = document.getElementById('info-links-' + key);
  if (!container) return;
  const entries = container.querySelectorAll('.info-link-entry');
  const entry = entries[idx];
  if (!entry) return;
  const player = entry.querySelector('.info-link-player');
  const btn = entry.querySelector('.info-link-play');
  if (!player) return;
  if (player.dataset.active === '1') {
    player.innerHTML = '';
    player.style.display = 'none';
    player.dataset.active = '0';
    if (btn) btn.textContent = '▶ PLAY';
  } else {
    const c = characters.find(x => x.id === currentId);
    const link = c && c.info && c.info[key] && c.info[key][idx];
    const vid = link && getYouTubeId(link.url);
    if (!vid) return;
    player.innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?autoplay=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    player.style.display = '';
    player.dataset.active = '1';
    if (btn) btn.textContent = '■ STOP';
  }
}

function addInfoLink(key) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.info = c.info || {};
  c.info[key] = c.info[key] || [];
  c.info[key].push({ title: '', url: '', note: '' });
  renderInfoLinks(key);
  const container = document.getElementById('info-links-' + key);
  if (container) { const ins = container.querySelectorAll('.info-link-title'); if (ins.length) ins[ins.length - 1].focus(); }
  saveData(c);
}

function removeInfoLink(key, idx) {
  const c = characters.find(x => x.id === currentId);
  if (!c || !c.info || !c.info[key]) return;
  c.info[key].splice(idx, 1);
  renderInfoLinks(key);
  saveData(c);
}

function updateInfoLink(key, idx, field, val) {
  const c = characters.find(x => x.id === currentId);
  if (!c || !c.info || !c.info[key] || !c.info[key][idx]) return;
  c.info[key][idx][field] = val;
  if (field === 'url') {
    const container = document.getElementById('info-links-' + key);
    if (container) {
      const entries = container.querySelectorAll('.info-link-entry');
      const entry = entries[idx];
      if (entry) {
        const row = entry.querySelector('.info-link-row');
        const iconLink = row.querySelector('.info-link-platform');
        iconLink.innerHTML = getPlatformIcon(val);
        iconLink.href = val || '#';
        iconLink.style.pointerEvents = val ? 'auto' : 'none';
        iconLink.tabIndex = val ? 0 : -1;
        const openBtn = row.querySelector('.info-link-open');
        openBtn.href = val || '#';
        openBtn.style.opacity = val ? '0.55' : '0.15';
        openBtn.style.pointerEvents = val ? 'auto' : 'none';
        // Add/remove play button based on whether URL is YouTube
        const vid = getYouTubeId(val);
        let playBtn = row.querySelector('.info-link-play');
        if (vid && !playBtn) {
          playBtn = document.createElement('button');
          playBtn.className = 'info-link-play';
          playBtn.textContent = '▶ PLAY';
          playBtn.onclick = () => playInfoLink(key, idx);
          openBtn.before(playBtn);
        } else if (!vid && playBtn) {
          const player = entry.querySelector('.info-link-player');
          if (player) { player.innerHTML = ''; player.style.display = 'none'; player.dataset.active = '0'; }
          playBtn.remove();
        }
      }
    }
  }
  clearTimeout(_infoSaveTimer);
  _infoSaveTimer = setTimeout(() => saveData(c), 600);
}

// ============================================================
// ALTERNATE FORMS — view-side
// ============================================================
// Sync just the avatar element to whichever form is active (used on remote updates)
function _syncAvatarEl(c) {
  const idx = c.activeFormIdx || 0;
  const af = idx > 0 ? (c.altForms || [])[idx - 1] : null;
  const src = (af && af.avatar) ? af.avatar : c.avatar;
  const el = document.getElementById('cv-avatar');
  if (!el) return;
  const _saeNara = _isNara(c);
  if (_saeNara) { el.dataset.naraBorder = '1'; el.style.borderColor = ''; }
  else { delete el.dataset.naraBorder; el.style.borderColor = c.color; }
  if (src) {
    el.innerHTML = `<img src="${src}"/>`;
  } else if (_saeNara) {
    el.innerHTML = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;width:56px;height:56px;">
      <rect x="12" y="2" width="8" height="8" data-nara-fill="1"/>
      <rect x="10" y="10" width="12" height="10" data-nara-fill="1"/>
      <rect x="8"  y="20" width="6" height="8"  data-nara-fill="1"/>
      <rect x="18" y="20" width="6" height="8"  data-nara-fill="1"/>
    </svg>`;
  } else {
    el.innerHTML = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;width:56px;height:56px;">
      <rect x="12" y="2" width="8" height="8" fill="${c.color}"/>
      <rect x="10" y="10" width="12" height="10" fill="${c.color}"/>
      <rect x="8"  y="20" width="6" height="8"  fill="${c.color}"/>
      <rect x="18" y="20" width="6" height="8"  fill="${c.color}"/>
    </svg>`;
  }
}

function renderFormSwitcher(c) {
  const wrap = document.getElementById('cv-form-switcher');
  if (!wrap) return;
  const forms = c.altForms || [];
  if (!forms.length) { wrap.innerHTML = ''; return; }
  const active = c.activeFormIdx || 0;
  const all = [{ name: 'BASE' }, ...forms];
  wrap.innerHTML = all.map((f, i) => {
    const label = i === 0 ? 'BASE' : (f.name || `FORM ${i}`);
    return `<button class="btn sm form-chip${i === active ? ' form-chip-active' : ''}" onclick="switchForm(${i})">${label}</button>`;
  }).join('');
}

function switchForm(idx) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.activeFormIdx = idx;
  saveData(c);
  viewChar(c.id);
}

// ============================================================
// ALTERNATE FORMS — editor-side
// ============================================================

// Build a full substats object from a partial source; coerceNumbers=true rounds to numbers
function _fullSubstats(src, coerce) {
  const s = src || {};
  const n = coerce ? (v => +v || 0) : (v => v || 0);
  return {
    heal_pow: n(s.heal_pow),
    crit_rate: n(s.crit_rate),
    crit_dmg: n(s.crit_dmg),
    status_res: n(s.status_res),
    dexterity: n(s.dexterity),
    resilience: n(s.resilience),
    true_dmg: n(s.true_dmg),
    lifesteal: n(s.lifesteal),
    cooldown_red: n(s.cooldown_red),
  };
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Form stats cap at COUNTRY level (PL_THRESHOLDS index 9)
const _FORM_STAT_MAX = { hp: 2200, atk: 400, def: 400, mag: 400, spd: 400, iq: 500 };

function syncFormStat(formIdx, key, val) {
  const max = _FORM_STAT_MAX[key] || 9999;
  const v = Math.min(max, Math.max(1, parseInt(val) || 1));
  if (!_editorForms[formIdx]) return;
  _editorForms[formIdx].stats[key] = v;

  const slider = document.getElementById(`fslider-${formIdx}-${key}`);
  const numEl = document.getElementById(`fnum-${formIdx}-${key}`);
  const dispEl = document.getElementById(`fdisp-${formIdx}-${key}`);
  const plEl = document.getElementById(`fpl-${formIdx}-${key}`);

  if (slider && +slider.value !== v) slider.value = v;
  if (numEl && +numEl.value !== v) numEl.value = v;
  if (dispEl) dispEl.textContent = v;
  if (plEl) {
    const t = PL_TIERS[getStatPL(key, v)];
    plEl.textContent = t.short;
    plEl.style.color = t.color;
  }
  updateFormStatBar(formIdx, key, v);
  updateFormOverallPL(formIdx);
}

function updateFormOverallPL(formIdx) {
  const f = _editorForms[formIdx];
  const el = document.getElementById(`foverall-pl-${formIdx}`);
  if (!f || !el) return;
  let total = 0;
  ['hp', 'atk', 'def', 'mag', 'spd'].forEach(s => { total += getStatPL(s, +f.stats[s] || 0); });
  const tier = PL_TIERS[Math.min(Math.floor(total / 5), PL_TIERS.length - 1)];
  el.innerHTML = `OVERALL &nbsp;<span style="color:${tier.color};letter-spacing:1px;">${tier.label}</span>`;
}

const _FORM_STAT_DEFS = [
  {
    key: 'hp', label: 'HP', color: 'var(--accent-green)',
    icon: `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 9L1 5A2.5 2.5 0 0 1 5 2 2.5 2.5 0 0 1 9 5Z" fill="var(--accent-green)"/></svg>`
  },
  {
    key: 'atk', label: 'ATK', color: 'var(--accent-red)',
    icon: `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 8l1 1 6-6-1-1-6 6zM1 9l2-1-1-1-1 2z" fill="var(--accent-red)"/></svg>`
  },
  {
    key: 'def', label: 'DEF', color: 'var(--accent-blue)',
    icon: `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 2v4c0 3 4 3.5 4 3.5s4-.5 4-3.5V2l-4-1-4 1z" fill="var(--accent-blue)"/></svg>`
  },
  {
    key: 'mag', label: 'MAG', color: '#ff44ff',
    icon: `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill="#ff44ff"/></svg>`
  },
  {
    key: 'spd', label: 'SPD', color: 'var(--accent-yellow)',
    icon: `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M6 0L2 5H5L4 10L9 4H5Z" fill="var(--accent-yellow)"/></svg>`
  },
  {
    key: 'iq', label: 'IQ', color: '#00bbcc',
    icon: `<svg width="10" height="10" viewBox="0 0 10 10"><path d="M4 2C3 2 2 3 2 4.5c0 1 .5 2 1.5 2.5C3 8.5 4 8.5 5 8.5c1 0 2 0 1.5-1.5C7.5 6.5 8 5.5 8 4.5 8 3 7 2 6 2c-.5 0-1 .2-1 .5C5 2.2 4.5 2 4 2zm1 .5V8M3.5 4C4 3.5 4.5 3.6 4.5 4.1M5.5 4C6 3.5 6.5 3.6 6.5 4.1" fill="none" stroke="#00bbcc" stroke-width="0.75" stroke-linecap="round"/></svg>`
  },
];

// Render a static segmented stat bar as HTML (used for form cards)
function _formStatBarHTML(val, key) {
  const baseMax = STAT_BASE_MAX[key];
  if (!baseMax) return '';
  const v = Math.max(1, +val || 1);
  const tier = Math.floor((v - 1) / baseMax);
  const valInTier = ((v - 1) % baseMax) + 1;
  const exactFilled = Math.max(0, Math.min(100, valInTier / baseMax * 100)) / 100 * SEG_COUNT;
  const fullFilled = Math.floor(exactFilled);
  return Array.from({ length: SEG_COUNT }, (_, i) => {
    let fillPct = i < fullFilled ? 100 : (i === fullFilled ? (exactFilled - fullFilled) * 100 : 0);
    const isPeak = (i === Math.ceil(exactFilled) - 1) && exactFilled > 0;
    const isOn = fillPct > 0;
    let fgCls = `stat-seg fill-fg ${key}${isOn ? (isPeak ? ' peak' : ' on') : ''}${tier > 0 && isOn ? ` tier-${Math.min(tier, 25)}` : ''}`;
    let bgCls = `stat-seg ghost-bg ${key}${tier > 0 ? ' on' : ''}`;
    const clip = `polygon(0 0,${fillPct}% 0,${fillPct}% 100%,0 100%)`;
    return `<div class="stat-seg-wrap" style="--i:${i};flex:1;position:relative;"><div class="${bgCls}" style="position:absolute;inset:0;"></div><div class="${fgCls}" style="position:absolute;inset:0;z-index:1;clip-path:${clip};"></div></div>`;
  }).join('');
}

// Update one form's stat bar in-place without re-rendering the whole card
function updateFormStatBar(formIdx, key, val) {
  const el = document.getElementById(`fbar-${formIdx}-${key}`);
  if (el) el.innerHTML = _formStatBarHTML(+val || 1, key);
}

function renderEditorForms() {
  const wrap = document.getElementById('e-forms-list');
  const addBtn = document.getElementById('add-form-btn');
  const countEl = document.getElementById('forms-count');
  if (!wrap) return;
  if (countEl) countEl.textContent = `(${_editorForms.length}/4)`;
  if (addBtn) addBtn.disabled = _editorForms.length >= 4;

  if (!_editorForms.length) {
    wrap.innerHTML = `<div style="color:#3a3a3a;font-size:8px;letter-spacing:1px;padding:10px 0 4px;">NO ALTERNATE FORMS YET.</div>`;
    return;
  }

  wrap.innerHTML = _editorForms.map((f, i) => {
    const av = f.avatar
      ? `<img src="${f.avatar}" style="width:100%;height:100%;object-fit:cover;display:block;">`
      : `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="width:52px;height:52px;opacity:0.3;">
          <rect x="12" y="2" width="8" height="8" fill="currentColor"/>
          <rect x="10" y="10" width="12" height="10" fill="currentColor"/>
          <rect x="8"  y="20" width="6" height="8" fill="currentColor"/>
          <rect x="18" y="20" width="6" height="8" fill="currentColor"/>
         </svg>`;

    const statRows = _FORM_STAT_DEFS.map(s => {
      const v = +f.stats[s.key] || 1;
      const max = _FORM_STAT_MAX[s.key];
      const tier = PL_TIERS[getStatPL(s.key, v)];
      return `<div class="form-stat-block">
        <label class="form-stat-lbl">
          ${s.icon}
          <span style="color:${s.color};margin-left:5px;">${s.label}</span>
          &nbsp;<span id="fdisp-${i}-${s.key}" style="color:#fff;">${v}</span>
          <span id="fpl-${i}-${s.key}" class="stat-pl-badge" style="color:${tier.color};">${tier.short}</span>
        </label>
        <div class="flex-row" style="gap:6px;margin-top:5px;">
          <input type="range" min="1" max="${max}" value="${v}" id="fslider-${i}-${s.key}"
            oninput="syncFormStat(${i},'${s.key}',this.value)" style="flex:1;"/>
          <input type="number" value="${v}" min="1" max="${max}" id="fnum-${i}-${s.key}"
            oninput="syncFormStat(${i},'${s.key}',this.value)"
            class="stat-num-input" style="width:72px;text-align:right;"/>
          <button class="btn sm" onclick="syncFormStat(${i},'${s.key}',+document.getElementById('fnum-${i}-${s.key}').value+1)">+</button>
          <button class="btn sm" onclick="syncFormStat(${i},'${s.key}',+document.getElementById('fnum-${i}-${s.key}').value-1)">-</button>
        </div>
        <div class="stat-segs mt-8" id="fbar-${i}-${s.key}">${_formStatBarHTML(v, s.key)}</div>
      </div>`;
    }).join('');

    return `<div class="form-editor-card">
      <div class="form-editor-header">
        <span>FORM ${i + 1}</span>
        <button class="btn sm danger" onclick="removeEditorForm(${i})">&#x2715; REMOVE</button>
      </div>
      <div class="form-editor-body">

        <div class="form-top-row">
          <div class="form-avatar-col">
            <div class="form-avatar-zone" onclick="triggerFormImgUpload(${i})">
              ${av}
              <div class="form-avatar-overlay">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
                  <rect x="1" y="5" width="14" height="10" rx="1"/>
                  <circle cx="8" cy="10" r="3"/>
                  <path d="M5 5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"/>
                </svg>
              </div>
            </div>
            ${f.avatar ? `<button class="btn sm" onclick="clearFormAvatar(${i})" style="margin-top:5px;width:100%;font-size:6px;letter-spacing:0;">CLEAR</button>` : ''}
          </div>
          <div class="form-name-col">
            <label style="font-size:7px;letter-spacing:2px;color:#444;display:block;margin-bottom:5px;">FORM NAME</label>
            <input type="text" value="${escHtml(f.name || '')}" maxlength="20"
              placeholder="e.g. Awakened, Final Boss..."
              oninput="_editorForms[${i}].name=this.value"
              class="form-name-input"/>
            <div style="font-size:7px;letter-spacing:1px;color:#333;margin-top:10px;line-height:1.8;">
              Traits &amp; passive abilities<br>are shared across all forms.
            </div>
          </div>
        </div>

        <div class="form-stats-section">
          ${statRows}
          <div id="foverall-pl-${i}" class="form-overall-pl"></div>
        </div>

        <div class="form-substats-grid">
          ${[
        { key: 'heal_pow', label: 'HEAL POW', color: '#88ff88', min: 0, max: 999, step: 1 },
        { key: 'crit_rate', label: 'CRIT RATE', color: '#ff8888', min: 0, max: 100, step: 0.1 },
        { key: 'crit_dmg', label: 'CRIT DMG', color: '#cc2222', min: 0, max: 999, step: 1 },
        { key: 'status_res', label: 'STATUS RES', color: '#00ccaa', min: 0, max: 100, step: 0.1 },
        { key: 'dexterity', label: 'DEX', color: '#ffff88', min: 0, max: 100, step: 0.1 },
        { key: 'resilience', label: 'RESILIENCE', color: '#8844cc', min: 0, max: 100, step: 0.1 },
        { key: 'true_dmg', label: 'TRUE DMG', color: '#ffffff', min: 0, max: 999, step: 1 },
        { key: 'lifesteal', label: 'LIFESTEAL', color: '#aa2222', min: 0, max: 100, step: 0.1 },
        { key: 'cooldown_red', label: 'CDR', color: '#00aaff', min: 0, max: 100, step: 0.1 },
      ].map(ss => `
            <div class="form-substat-cell">
              <label style="font-size:6px;letter-spacing:1px;color:${ss.color};">${ss.label} (%)</label>
              <input type="number" value="${+(f.substats[ss.key] || 0).toFixed(2)}"
                min="${ss.min}" max="${ss.max}" step="${ss.step}"
                oninput="_editorForms[${i}].substats.${ss.key}=+this.value||0"
                class="stat-num-input" style="width:100%;margin-top:4px;font-size:8px;"/>
            </div>`).join('')}
        </div>

      </div>
    </div>`;
  }).join('');
  // Seed the overall PL displays (DOM must exist first)
  _editorForms.forEach((_, i) => updateFormOverallPL(i));
}

function addEditorForm() {
  if (_editorForms.length >= 4) return;
  _editorForms.push({
    name: '',
    avatar: null,
    stats: { hp: 50, atk: 10, def: 10, mag: 10, spd: 10, iq: 50 },
    substats: _fullSubstats()
  });
  renderEditorForms();
}

function removeEditorForm(idx) {
  _editorForms.splice(idx, 1);
  renderEditorForms();
}

function clearFormAvatar(idx) {
  _editorForms[idx].avatar = null;
  renderEditorForms();
}

function triggerFormImgUpload(idx) {
  _formUploadIdx = idx;
  document.getElementById('form-avatar-file').click();
}

function handleFormAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file || _formUploadIdx === null) return;
  const idx = _formUploadIdx;
  _formUploadIdx = null;
  const reader = new FileReader();
  reader.onload = async e => {
    if (_editorForms[idx]) {
      _editorForms[idx].avatar = await compressImage(e.target.result, 512, 0.82);
      renderEditorForms();
    }
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

// ============================================================
// CHARACTER TAGS
// ============================================================
let _editorTags = [];

function renderEditorTags() {
  const wrap = document.getElementById('e-tags-display');
  if (!wrap) return;
  wrap.innerHTML = _editorTags.map((t, i) =>
    `<span class="editor-tag">${t}<button class="editor-tag-remove" onclick="removeEditorTag(${i})" title="Remove">×</button></span>`
  ).join('');
}

function addEditorTag() {
  const input = document.getElementById('e-tags-input');
  if (!input) return;
  const val = input.value.trim();
  if (!val || _editorTags.includes(val) || _editorTags.length >= 8) return;
  _editorTags.push(val);
  input.value = '';
  renderEditorTags();
}

function removeEditorTag(i) {
  _editorTags.splice(i, 1);
  renderEditorTags();
}

// ============================================================
// EDITOR
// ============================================================
function showEditor(id) {
  // Delete placeholder drafts when starting a brand-new character
  if (!id) {
    const had = characters.some(c => c.isPlaceholder);
    characters = characters.filter(c => !c.isPlaceholder);
    if (had) { renderSidebar(); }
  }

  editingId = id;
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('char-view').classList.remove('active');
  document.getElementById('editor').classList.add('active');
  patternParams = {};
  buildColorWheelSwatches();

  if (id) {
    const c = characters.find(x => x.id === id);
    document.getElementById('editor-title').textContent = c.isPlaceholder ? 'RESUME DRAFT' : 'EDIT CHARACTER';
    document.getElementById('e-name').value = c.name === 'UNTITLED' ? '' : (c.name || '');
    document.getElementById('e-bio').value = c.bio || '';
    document.getElementById('e-color').value = c.color || '#ffff00';
    updateColorWheel(c.color || '#ffff00');
    document.getElementById('e-hp').value = c.stats.hp;
    document.getElementById('e-atk').value = c.stats.atk;
    document.getElementById('e-def').value = c.stats.def;
    document.getElementById('e-mag').value = c.stats.mag;
    document.getElementById('e-spd').value = c.stats.spd;
    document.getElementById('e-iq').value = c.stats.iq || 50;

    document.getElementById('e-heal_pow').value = c.substats?.heal_pow || 0;
    document.getElementById('e-crit_rate').value = c.substats?.crit_rate || 0;
    document.getElementById('e-crit_dmg').value = c.substats?.crit_dmg || 0;
    document.getElementById('e-status_res').value = c.substats?.status_res || 0;
    document.getElementById('e-dexterity').value = c.substats?.dexterity || 0;
    document.getElementById('e-resilience').value = c.substats?.resilience || 0;
    document.getElementById('e-true_dmg').value = c.substats?.true_dmg || 0;
    document.getElementById('e-lifesteal').value = c.substats?.lifesteal || 0;
    document.getElementById('e-cooldown_red').value = c.substats?.cooldown_red || 0;

    syncStat('hp', c.stats.hp);
    syncStat('iq', c.stats.iq || 50);
    document.getElementById('e-spd').value = c.stats.spd;
    currentAvatarDataURL = c.avatar || null;
    _editorTags = [...(c.tags || [])];
    renderEditorTags();
    _editorForms = (c.altForms || []).map(f => ({
      name: f.name || '',
      avatar: f.avatar || null,
      stats: { hp: f.stats?.hp || 50, atk: f.stats?.atk || 10, def: f.stats?.def || 10, mag: f.stats?.mag || 10, spd: f.stats?.spd || 10, iq: f.stats?.iq || 50 },
      substats: _fullSubstats(f.substats),
      themeSong: f.themeSong || null,
    }));
    renderEditorForms();
    const ptype = c.pattern?.type || 'none';
    document.getElementById('e-pattern').value = ptype;
    patternParams = Object.assign({}, c.pattern?.params || {});
    buildPatternParams(ptype);
    if (ptype !== 'none') startPreviewAnim(ptype);
  } else {
    document.getElementById('editor-title').textContent = 'NEW CHARACTER';
    document.getElementById('e-name').value = '';
    document.getElementById('e-color').value = '#ffff00';
    updateColorWheel('#ffff00');
    ['e-hp', 'e-atk', 'e-def', 'e-mag', 'e-spd', 'e-iq'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.value = [50, 10, 10, 10, 10, 50][i];
    });

    document.getElementById('e-heal_pow').value = 0;
    document.getElementById('e-crit_rate').value = 0;
    document.getElementById('e-crit_dmg').value = 0;
    document.getElementById('e-status_res').value = 0;
    document.getElementById('e-dexterity').value = 0;
    document.getElementById('e-resilience').value = 0;
    document.getElementById('e-true_dmg').value = 0;
    document.getElementById('e-lifesteal').value = 0;
    document.getElementById('e-cooldown_red').value = 0;

    currentAvatarDataURL = null;
    _editorTags = [];
    renderEditorTags();
    _editorForms = [];
    renderEditorForms();
    document.getElementById('e-pattern').value = 'none';
    buildPatternParams('none');
  }
  renderAvatarZone();
  ['hp', 'atk', 'def', 'mag', 'spd', 'iq'].forEach(updateStatDisplay);
  stopBgAnim();

  const edCanvas = document.getElementById('editor-pattern-canvas');
  if (edCanvas) {
    edCanvas.style.display = 'block';
    startEditorBgAnim(edCanvas);
  }
  applyEditorTheme();
}

function startEditorBgAnim(canvas) {
  if (editorAnim) cancelAnimationFrame(editorAnim);
  let lastW = 0, lastH = 0;
  const t0 = performance.now();
  function frame(now) {
    if (!document.getElementById('editor').classList.contains('active')) {
      canvas.style.display = 'none';
      editorAnim = null;
      return;
    }
    // Only resize when viewport actually changes
    if (window.innerWidth !== lastW || window.innerHeight !== lastH) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      lastW = canvas.width; lastH = canvas.height;
      // Reset pattern state after resize
      canvas._matrixCols = null; canvas._matrixW = 0;
      canvas._diamonds = null; canvas._pixels = null;
      canvas._stars = null; canvas._starsW = 0;
      canvas._noiseFrame = 0; canvas._noiseBuf = null;
    }
    const type = document.getElementById('e-pattern').value;
    const def = PATTERN_DEFS[type];
    const merged = {};
    if (def) def.params.forEach(p => { merged[p.id] = patternParams[p.id] !== undefined ? patternParams[p.id] : p.default; });
    Object.assign(merged, patternParams);
    drawPattern(canvas, type, merged, (now - t0) / 1000);
    editorAnim = requestAnimationFrame(frame);
  }
  editorAnim = requestAnimationFrame(frame);
}

function applyEditorTheme() {
  const color = document.getElementById('e-color')?.value || '#ffff00';
  document.querySelectorAll('#editor .panel').forEach(p => {
    p.style.borderColor = color;
    p.style.boxShadow = `0 0 18px ${color}33`;
  });
  const title = document.getElementById('editor-title');
  if (title) title.style.color = color;
  const pTitle = document.querySelectorAll('#editor .panel-title');
  pTitle.forEach(t => t.style.color = color);
}

function updateColorWheel(val) {
  const preview = document.getElementById('color-wheel-preview');
  const label = document.getElementById('color-hex-label');
  const ring = document.getElementById('color-wheel-ring');
  if (preview) preview.style.background = val;
  if (label) label.textContent = val.toUpperCase();
  if (ring) {
    ring.style.setProperty('--wheel-color', val);
    ring.style.boxShadow = `0 0 0 4px ${val}, 0 0 28px ${val}44`;
  }
  // Update active swatch
  document.querySelectorAll('.color-wheel-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color === val.toLowerCase());
  });
  applyEditorTheme();
}

function buildColorWheelSwatches() {
  const SOUL_COLORS = [
    '#ff0000', '#00ffff', '#ff8000', '#0080ff', '#ff80ff', '#00ff00', '#ffff00',
    '#ffffff', '#ff4444', '#44ffaa'
  ];
  const wrap = document.getElementById('cw-swatches');
  if (!wrap) return;
  wrap.innerHTML = '';
  SOUL_COLORS.forEach(c => {
    const s = document.createElement('div');
    s.className = 'color-wheel-swatch';
    s.dataset.color = c;
    s.style.background = c;
    s.title = c;
    s.onclick = () => {
      document.getElementById('e-color').value = c;
      updateColorWheel(c);
    };
    wrap.appendChild(s);
  });
}


function editChar(id) { showEditor(id); }
function editCurrent() { if (currentId) showEditor(currentId); }

function saveAsPlaceholder() {
  const name = document.getElementById('e-name').value.trim() || 'UNTITLED';
  const ptype = document.getElementById('e-pattern').value;
  const pdef = PATTERN_DEFS[ptype];
  const pp = Object.assign({}, patternParams);
  if (pdef) pdef.params.forEach(p => { if (pp[p.id] === undefined) pp[p.id] = p.default; });
  const char = {
    id: genId(), name,
    bio: document.getElementById('e-bio').value.trim(),
    color: document.getElementById('e-color').value,
    avatar: currentAvatarDataURL,
    isPlaceholder: true,
    stats: {
      hp: +document.getElementById('e-hp').value,
      atk: +document.getElementById('e-atk').value,
      def: +document.getElementById('e-def').value,
      mag: +document.getElementById('e-mag').value,
      spd: +document.getElementById('e-spd').value,
      iq: +document.getElementById('e-iq').value,
    },
    substats: {
      heal_pow: parseFloat(document.getElementById('e-heal_pow').value) || 0,
      crit_rate: parseFloat(document.getElementById('e-crit_rate').value) || 0,
      crit_dmg: parseFloat(document.getElementById('e-crit_dmg').value) || 0,
      status_res: parseFloat(document.getElementById('e-status_res').value) || 0,
      dexterity: parseFloat(document.getElementById('e-dexterity').value) || 0,
      resilience: parseFloat(document.getElementById('e-resilience').value) || 0,
      true_dmg: parseFloat(document.getElementById('e-true_dmg').value) || 0,
      lifesteal: parseFloat(document.getElementById('e-lifesteal').value) || 0,
      cooldown_red: parseFloat(document.getElementById('e-cooldown_red').value) || 0
    },
    pattern: { type: ptype, params: pp },
    inventory: []
  };
  characters.push(char);
  // Drafts are local-only (not synced to Firestore)
  notify('DRAFT SAVED. CLICK IT TO RESUME', 'ok');
  return char.id;
}

function cancelEditor() {
  if (previewAnim) cancelAnimationFrame(previewAnim);
  document.getElementById('editor').classList.remove('active');

  // New character cancelled → save placeholder draft
  const editingChar = editingId ? characters.find(x => x.id === editingId) : null;
  if (!editingId) {
    saveAsPlaceholder();
    renderSidebar();
    _returnToTitle();
    return;
  }
  // Editing a placeholder → just leave it, go back to title
  if (editingChar?.isPlaceholder) {
    renderSidebar();
    _returnToTitle();
    return;
  }
  // Editing a real character → discard, return to it
  if (currentId) viewChar(currentId);
  else if (characters.filter(c => !c.isPlaceholder).length)
    viewChar(characters.filter(c => !c.isPlaceholder)[0].id);
  else _returnToTitle();
}

function _returnToTitle() {
  stopBgAnim();
  const real = characters.filter(c => !c.isPlaceholder);
  if (real.length) viewChar(real[0].id);
  else {
    document.getElementById('char-view').classList.remove('active');
    document.getElementById('empty-state').style.display = '';
  }
}

function saveCharacter() {
  const name = document.getElementById('e-name').value.trim();
  if (!name) { notify('NAME REQUIRED!', 'err'); return; }
  const ptype = document.getElementById('e-pattern').value;
  const pdef = PATTERN_DEFS[ptype];
  if (pdef) pdef.params.forEach(p => { if (patternParams[p.id] === undefined) patternParams[p.id] = p.default; });

  const existing = editingId ? (characters.find(x => x.id === editingId) || {}) : {};
  const char = {
    id: editingId || genId(),
    createdAt: existing.createdAt || Date.now(),
    name,
    bio: document.getElementById('e-bio').value.trim(),
    color: document.getElementById('e-color').value,
    avatar: currentAvatarDataURL,
    isPlaceholder: false,
    stats: {
      hp: +document.getElementById('e-hp').value,
      atk: +document.getElementById('e-atk').value,
      def: +document.getElementById('e-def').value,
      mag: +document.getElementById('e-mag').value,
      spd: +document.getElementById('e-spd').value,
      iq: +document.getElementById('e-iq').value,
    },
    substats: {
      heal_pow: parseFloat(document.getElementById('e-heal_pow').value) || 0,
      crit_rate: parseFloat(document.getElementById('e-crit_rate').value) || 0,
      crit_dmg: parseFloat(document.getElementById('e-crit_dmg').value) || 0,
      status_res: parseFloat(document.getElementById('e-status_res').value) || 0,
      dexterity: parseFloat(document.getElementById('e-dexterity').value) || 0,
      resilience: parseFloat(document.getElementById('e-resilience').value) || 0,
      true_dmg: parseFloat(document.getElementById('e-true_dmg').value) || 0,
      lifesteal: parseFloat(document.getElementById('e-lifesteal').value) || 0,
      cooldown_red: parseFloat(document.getElementById('e-cooldown_red').value) || 0
    },
    pattern: { type: ptype, params: Object.assign({}, patternParams) },
    inventory: existing.inventory || [],
    traits: existing.traits || [],
    shimmyfulTraits: existing.shimmyfulTraits || [],
    traitTriggers: existing.traitTriggers || {},
    traitStacks: existing.traitStacks || {},
    dualityState: existing.dualityState || {},
    traitHistory: existing.traitHistory || [],
    folderId: existing.folderId || null,
    order: existing.order ?? null,
    gold: existing.gold ?? 0,
    goldHistory: existing.goldHistory || [],
    pity: existing.pity ?? 0,
    tags: [..._editorTags],
    altForms: _editorForms.map(f => ({
      name: f.name || '',
      avatar: f.avatar || null,
      stats: { hp: +f.stats.hp || 1, atk: +f.stats.atk || 1, def: +f.stats.def || 1, mag: +f.stats.mag || 1, spd: +f.stats.spd || 1, iq: +f.stats.iq || 50 },
      substats: _fullSubstats(f.substats, true),
      ...(f.themeSong ? { themeSong: f.themeSong } : {}),
    })),
    activeFormIdx: existing.activeFormIdx || 0,
    info: existing.info || {},
    missingNoRolls: existing.missingNoRolls,
    thousandDoorsAccum: existing.thousandDoorsAccum,
    thousandDoorsHistory: existing.thousandDoorsHistory,
    drunkStats: existing.drunkStats,
    drunkCount: existing.drunkCount,
    perfectSoulData: existing.perfectSoulData,
  };

  if (editingId) {
    characters[characters.findIndex(x => x.id === editingId)] = char;
    notify('CHARACTER UPDATED', 'ok');
  } else {
    characters.push(char);
    notify('CHARACTER SAVED', 'ok');
  }

  saveData(char);
  playSound('save');
  if (char.name.toLowerCase() === 'gaster') setTimeout(() => playSound('gaster', { volume: 0.9 }), 300);
  if (previewAnim) cancelAnimationFrame(previewAnim);
  currentId = char.id; editingId = null;
  renderSidebar(); viewChar(char.id);
}

async function deleteChar(id) {
  const c = characters.find(x => x.id === id);
  const ok = await confirm2(`DELETE "${c.name}"?\n\nThis cannot be undone.`);
  if (!ok) return;
  playSound('delete');
  // Update local state immediately for snappy UI
  characters = characters.filter(x => x.id !== id);
  notify('DELETED', 'err');
  if (currentId === id) {
    currentId = null; stopBgAnim();
    if (characters.length) viewChar(characters[0].id);
    else {
      document.getElementById('char-view').classList.remove('active');
      document.getElementById('editor').classList.remove('active');
      document.getElementById('empty-state').style.display = '';
    }
  }
  renderSidebar();
  if (!characters.length) randomizeHeart();
  // Delete from Firestore (onSnapshot will confirm)
  if (db) db.collection('characters').doc(id).delete().catch(err => {
    console.error('Firestore delete error:', err);
    notify('DELETE FAILED', 'err');
  });
}
async function deleteCurrent() { if (currentId) deleteChar(currentId); }

function randomizeHeart() {
  const colors = [
    '#ff0000', // Red — Determination
    '#64a4ecff', // Aqua — Patience
    '#f7912bff', // Orange — Bravery
    '#001affff', // Blue — Integrity
    '#7338e0ff', // Purple — Perseverance
    '#21da21ff', // Green — Kindness
    '#ffff00', // Yellow — Justice
  ];
  const solid = document.getElementById('heart-solid');
  const overlay = document.getElementById('heart-split-overlay');
  if (!solid) return;

  if (Math.random() < 0.01) {
    // 1% chance: split soul (Blue/Orange)
    solid.style.display = 'none';
    if (overlay) overlay.style.display = '';
  } else {
    const c = colors[Math.floor(Math.random() * colors.length)];
    solid.setAttribute('fill', c);
    solid.style.display = '';
    if (overlay) overlay.style.display = 'none';
  }
}



// ============================================================
// POWER LEVEL MODAL
// ============================================================
function openPowerModal() {
  document.getElementById('power-modal-overlay').classList.add('open');
  document.getElementById('power-modal').classList.add('open');
}
function closePowerModal() {
  document.getElementById('power-modal-overlay').classList.remove('open');
  document.getElementById('power-modal').classList.remove('open');
}

// Lazy trait-chip tooltip: compute on first hover, not at render time.
// Runs in capture phase so data-tooltip is set before the display handler reads it.
document.addEventListener('mouseover', function (e) {
  const chip = e.target.closest('.trait-chip[data-trait]');
  if (!chip || chip.dataset.tooltip !== undefined) return;
  const key = chip.dataset.trait;
  const c = characters.find(x => x.id === currentId);
  if (c) chip.dataset.tooltip = buildTraitTooltip(c, key);
}, true);

// Lazy tier-chip tooltip: show character stats on hover.
document.addEventListener('mouseover', function (e) {
  const chip = e.target.closest('.tier-chip');
  if (!chip || chip.dataset.tooltip !== undefined) return;
  chip.dataset.tooltip = buildTierChipTooltip(chip.dataset.charId);
}, true);

// Global Tooltip
(function initGlobalTooltip() {
  const tooltip = document.getElementById('global-tooltip');
  if (!tooltip) return;

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    tooltip.innerHTML = target.getAttribute('data-tooltip');
    tooltip.style.display = 'block';
  });

  document.addEventListener('mousemove', (e) => {
    if (tooltip.style.display === 'block') {
      let x = e.clientX + 15;
      let y = e.clientY + 15;
      const rect = tooltip.getBoundingClientRect();
      if (x + rect.width > window.innerWidth - 10) {
        x = e.clientX - rect.width - 15;
      }
      if (y + rect.height > window.innerHeight - 10) {
        y = window.innerHeight - rect.height - 10;
      }
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    tooltip.style.display = 'none';
  });

  // On touch devices mouseleave never fires — hide on any subsequent tap
  document.addEventListener('touchstart', () => {
    tooltip.style.display = 'none';
  }, { passive: true });
})();

// ============================================================
// UTILITIES LOGIC
// ============================================================

function togglePanel(contentId, chevronId) {
  const content = document.getElementById(contentId);
  const chevron = document.getElementById(chevronId);
  if (!content || !chevron) return;

  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed');
    chevron.style.transform = 'rotate(0deg)';
  } else {
    content.classList.add('collapsed');
    chevron.style.transform = 'rotate(-90deg)';
  }
}

function rollDice() {
  const sides = parseInt(document.getElementById('u-dice-sides').value) || 20;
  const cube = document.getElementById('dice-cube');
  const container = cube?.parentElement;
  const overlay = document.getElementById('dice-overlay');
  const faces = ['f-front', 'f-back', 'f-right', 'f-left', 'f-top', 'f-bottom'];

  if (!cube || !container || !overlay) return;

  playSound('diceroll', { rate: 0.95 + Math.random() * 0.1, volume: 0.9 });

  // Enter Cinematic Mode
  overlay.classList.add('active');
  container.classList.add('cinematic');
  cube.classList.remove('land', 'tier-low', 'tier-mid', 'tier-high', 'tier-max');
  cube.classList.add('tumble');

  // Ease-out scramble: starts fast (~50ms gaps), stretches to ~400ms by the end
  const duration = 2200; // total roll duration in ms
  const minInterval = 45; // fastest scramble gap (ms) — start of roll
  const maxInterval = 380; // slowest scramble gap (ms) — just before landing

  const startTime = performance.now();
  let lastFlip = startTime;
  let finished = false;

  function scrambleFrame(now) {
    if (finished) return;

    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1); // 0→1
    // Cubic ease-out: slow acceleration of the gap size
    const eased = 1 - Math.pow(1 - progress, 3);
    const flipGap = minInterval + eased * (maxInterval - minInterval);

    // Scramble faces at the eased rate
    if (now - lastFlip >= flipGap) {
      faces.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = Math.floor(Math.random() * sides) + 1;
      });
      lastFlip = now;
    }

    if (progress >= 1) {
      finished = true;
      cube.classList.remove('tumble');

      const finalResult = Math.floor(Math.random() * sides) + 1;
      document.getElementById('f-front').textContent = finalResult;

      // Determine Tier
      const pct = finalResult / sides;
      let tier = 'tier-mid';
      if (finalResult === sides) tier = 'tier-max';
      else if (pct >= 0.75) tier = 'tier-high';
      else if (pct <= 0.25) tier = 'tier-low';

      cube.classList.add('land', tier);

      faces.slice(1).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
      });

      if (finalResult === sides) playSound('max', { volume: 0.9 });
      else if (finalResult === 1) playSound('minimum', { volume: 0.9 });
      else playSound('rolldone', { rate: 0.7 + (pct * 0.8), volume: 0.85 });

      notify('DICE ROLLED: ' + finalResult);
      return;
    }

    requestAnimationFrame(scrambleFrame);
  }

  requestAnimationFrame(scrambleFrame);
}

function dismissDice() {
  const overlay = document.getElementById('dice-overlay');
  const cube = document.getElementById('dice-cube');
  const container = cube?.parentElement;
  if (overlay) overlay.classList.remove('active');
  if (container) container.classList.remove('cinematic');
}

function rollCrit() {
  const chance = parseFloat(document.getElementById('u-crit-chance').value) || 0;
  const extraMult = parseFloat(document.getElementById('u-crit-extra').value) || 1;
  const resEl = document.getElementById('crit-result');
  const detEl = document.getElementById('crit-detail');
  const symbols = ['#', '?', '!', 'X', 'O', '&'];

  playSound('diceroll', { rate: 1.1 + Math.random() * 0.1, volume: 0.75 });
  resEl.classList.remove('result-impact', 'is-crit');
  resEl.style.color = '';
  resEl.classList.add('dice-rolling');
  detEl.textContent = 'CALCULATING...';

  let ticks = 0;
  const interval = setInterval(() => {
    if (Math.random() > 0.4) {
      resEl.textContent = (1.5 + Math.random() * 0.5).toFixed(2);
    } else {
      resEl.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    }

    ticks++;
    if (ticks > 40) { // Increased duration
      clearInterval(interval);
      resEl.classList.remove('dice-rolling');
      resEl.classList.add('result-impact');

      const rolled = Math.random() * 100;
      if (rolled <= chance) {
        const baseCrit = 1.5 + Math.random() * 0.5;
        const total = (baseCrit * extraMult).toFixed(2);
        resEl.textContent = 'CRIT!';
        resEl.classList.add('is-crit');
        detEl.textContent = `Base: x${baseCrit.toFixed(2)} | Extra: x${extraMult} | FINAL: x${total}`;
        playSound('max', { rate: 1.15, volume: 0.8 });
        notify('CRITICAL HIT!', 'err');
      } else {
        resEl.textContent = 'MISS';
        resEl.style.color = '#555';
        detEl.textContent = 'Normal Damage (x1.00)';
        playSound('minimum', { rate: 0.9, volume: 0.65 });
      }
    }
  }, 50);
}

// ============================================================
// STATUS EFFECT ROLLER
// ============================================================
let _srType     = 'ALL';
let _srStatuses = [];   // loaded from Firestore
let _srRolling  = false;

const SR_TYPE_COLORS = { BUFF:'#44ff88', DEBUFF:'#ff4444', NEUTRAL:'#aaaaaa', PASSIVE:'#cc99ff', UNIQUE:'#ffcc44' };
const SR_SHAPES = ['circle','diamond','hexagon','triangle','star','teardrop','rounded-square','square'];

function srInit() {
  if (!db) return;
  db.collection('enc').doc('data').onSnapshot(snap => {
    const d = snap.data() || {};
    _srStatuses = d.statuses || [];
    srUpdatePoolLabel();
    // Populate status map for trait description coloring
    _encStatusMap = {};
    (_srStatuses || []).forEach(s => {
      if (s.name) _encStatusMap[s.name.toUpperCase()] = { color: s.color || '#ffdd00', desc: s.desc || '', name: s.name };
    });
  }, () => {});
}

function srSetType(type) {
  _srType = type;
  document.querySelectorAll('.sr-type-btn').forEach(b => {
    b.classList.toggle('sr-type-active', b.dataset.type === type);
  });
  srUpdatePoolLabel();
}

function srPool() {
  if (_srType === 'ALL') return _srStatuses;
  return _srStatuses.filter(s => (s.type || 'NEUTRAL') === _srType);
}

function srUpdatePoolLabel() {
  const lbl = document.getElementById('sr-pool-label');
  if (!lbl) return;
  const pool = srPool();
  lbl.textContent = `${pool.length} STATUS EFFECT${pool.length !== 1 ? 'S' : ''} IN POOL`;
}

function rollStatusEffect() {
  if (_srRolling) return;
  const pool = srPool();
  if (!pool.length) { notify('No status effects in pool!', 'err'); return; }

  _srRolling = true;
  const btn = document.getElementById('sr-roll-btn');
  if (btn) btn.disabled = true;

  const resultEl = document.getElementById('sr-result');
  const innerEl  = document.getElementById('sr-result-inner');
  const nameEl   = document.getElementById('sr-name');
  const badgeEl  = document.getElementById('sr-badge');
  const descEl   = document.getElementById('sr-desc');
  const orbEl    = document.getElementById('sr-orb');

  resultEl.style.display = 'block';
  descEl.textContent = '';
  innerEl.classList.add('sr-scrambling');

  if (typeof playSound === 'function') playSound('diceroll', { rate: 0.9 + Math.random() * 0.2, volume: 0.7 });

  // Fixed 55ms interval, 40 ticks (~2.2s) — identical pattern to rollCrit
  let ticks = 0;
  let skipNext = 0; // how many ticks to hold the current preview (slows apparent speed)

  const interval = setInterval(() => {
    ticks++;

    if (ticks > 40) {
      clearInterval(interval);
      innerEl.classList.remove('sr-scrambling');

      const final = pool[Math.floor(Math.random() * pool.length)];
      const ftc = SR_TYPE_COLORS[final.type || 'NEUTRAL'] || '#aaa';
      nameEl.textContent = final.name || '???';
      nameEl.style.color = final.color || '#ccc';
      badgeEl.textContent = final.type || 'NEUTRAL';
      badgeEl.style.color = ftc;
      badgeEl.style.borderColor = ftc + '66';
      descEl.textContent = final.desc || '';
      orbEl.style.setProperty('--status-col', final.color || '#aaa');
      srSetOrbShape(orbEl, final.shape || 'circle');
      innerEl.style.borderColor = (final.color || '#aaa') + '66';
      innerEl.style.background  = (final.color || '#aaa') + '10';

      if (typeof playSound === 'function') playSound('rolldone', { rate: 0.8, volume: 0.8 });
      notify('STATUS EFFECT: ' + (final.name || '???'));
      if (btn) btn.disabled = false;
      _srRolling = false;
      return;
    }

    // Slow down the visible scramble near the end (hold same entry for extra ticks)
    const progress = ticks / 40;
    const holdChance = Math.pow(progress, 2); // 0→1 as ticks increase
    if (Math.random() < holdChance) return;  // skip visual update → feels slower

    const preview = pool[Math.floor(Math.random() * pool.length)];
    const tc = SR_TYPE_COLORS[preview.type || 'NEUTRAL'] || '#aaa';
    nameEl.textContent = preview.name || '???';
    nameEl.style.color = preview.color || '#ccc';
    badgeEl.textContent = preview.type || 'NEUTRAL';
    badgeEl.style.color = tc;
    badgeEl.style.borderColor = tc + '66';
    orbEl.style.setProperty('--status-col', preview.color || '#aaa');
    srSetOrbShape(orbEl, preview.shape || 'circle');
    innerEl.style.borderColor = (preview.color || '#aaa') + '44';
    innerEl.style.background  = (preview.color || '#aaa') + '06';
  }, 55);
}

function srSetOrbShape(orbEl, shape) {
  SR_SHAPES.forEach(s => orbEl.classList.remove('sr-shape-' + s));
  orbEl.classList.add('sr-shape-' + (shape || 'circle'));
  // Diamond/teardrop need the wrapper to not clip; reset transform on orb-wrap
  const wrap = document.getElementById('sr-orb-wrap');
  if (wrap) {
    wrap.style.overflow = (shape === 'diamond' || shape === 'teardrop') ? 'visible' : 'hidden';
  }
}

// ============================================================
// SUGGESTION BOX
// ============================================================
let _selectedSuggRarity = 'common';

function pickSuggRarity(rar) {
  _selectedSuggRarity = rar;
  document.querySelectorAll('.sugg-rar-btn').forEach(b => {
    b.classList.toggle('sugg-rar-active', b.dataset.rar === rar);
  });
}

const SUGG_RAR_COLORS = {
  common: { fg: '#c0c0c0', border: '#6a6a6a', bg: '#111111' },
  rare: { fg: '#4aa9ff', border: '#1f73d4', bg: '#05111f' },
  epic: { fg: '#c98bff', border: '#8a3fff', bg: '#12071f' },
  legendary: { fg: '#ffe14a', border: '#ffae00', bg: '#1e1500' },
  mythic: { fg: '#ffd86a', border: '#ff6a00', bg: '#1c0800' },
  hexxed: { fg: '#c46aff', border: '#5400a0', bg: '#08000f' },
  duality: { fg: '#88c8ff', border: '#1a3080', bg: '#03040e' },
  determined: { fg: '#ff3333', border: '#880000', bg: '#040000' },
};

function submitSuggestion() {
  if (!db) return;
  const name = (document.getElementById('sugg-name')?.value || '').trim();
  const desc = (document.getElementById('sugg-desc')?.value || '').trim();
  const effect = (document.getElementById('sugg-effect')?.value || '').trim();
  const submitter = (document.getElementById('sugg-submitter')?.value || '').trim();
  const status = document.getElementById('suggestion-status');

  if (!name) { if (status) status.textContent = 'TRAIT NAME IS REQUIRED.'; return; }
  if (!desc) { if (status) status.textContent = 'PLEASE DESCRIBE WHAT IT DOES.'; return; }

  const doc = {
    name, rarity: _selectedSuggRarity,
    desc,
    effect: effect || null,
    submitter: submitter || null,
    createdAt: Date.now(),
    votes: 0,
  };

  db.collection('suggestions').add(doc)
    .then(() => {
      ['sugg-name', 'sugg-desc', 'sugg-effect', 'sugg-submitter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      pickSuggRarity('common');
      if (status) {
        status.style.color = '#44ff88';
        status.textContent = 'SUGGESTION SUBMITTED!';
        setTimeout(() => { status.textContent = ''; status.style.color = '#555'; }, 3500);
      }
      loadSuggestions();
    })
    .catch(() => {
      if (status) { status.style.color = '#ff4444'; status.textContent = 'FAILED TO SUBMIT.'; }
    });
}

function voteSuggestion(id) {
  if (!db) return;
  const VOTED_KEY = 'sugg_voted_v1';
  let voted = [];
  try { voted = JSON.parse(localStorage.getItem(VOTED_KEY)) || []; } catch { }
  if (voted.includes(id)) { notify('ALREADY VOTED', 'err'); return; }

  db.collection('suggestions').doc(id).update({
    votes: firebase.firestore.FieldValue.increment(1)
  }).then(() => {
    voted.push(id);
    localStorage.setItem(VOTED_KEY, JSON.stringify(voted));
    loadSuggestions();
  });
}

function loadSuggestions() {
  if (!db) return;
  const list = document.getElementById('suggestion-list');
  if (!list) return;

  let voted = [];
  try { voted = JSON.parse(localStorage.getItem('sugg_voted_v1')) || []; } catch { }

  db.collection('suggestions').orderBy('createdAt', 'desc').limit(40).get()
    .then(snap => {
      if (snap.empty) {
        list.innerHTML = '<div style="font-size:8px;color:#333;padding:8px 0;letter-spacing:1px;">NO SUGGESTIONS YET — BE THE FIRST.</div>';
        return;
      }

      // Sort by votes desc client-side, preserve date-desc within same vote count
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.votes || 0) - (a.votes || 0) || b.createdAt - a.createdAt);

      list.innerHTML =
        `<div style="font-size:8px;color:#444;letter-spacing:2px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #1a1a1a;">SUGGESTIONS (${docs.length})</div>` +
        docs.map(s => {
          const c = SUGG_RAR_COLORS[s.rarity] || SUGG_RAR_COLORS.common;
          const date = new Date(s.createdAt).toLocaleDateString();
          const hasVoted = voted.includes(s.id);
          const rar = (s.rarity || 'common').toUpperCase();

          return `<div class="sugg-card" style="border-color:${c.border};background:${c.bg};">
            <div class="sugg-card-header">
              <span class="sugg-rar-tag" style="color:${c.fg};border-color:${c.border};">${rar}</span>
              <span class="sugg-card-name" style="color:${c.fg};">${s.name}</span>
              <button class="sugg-vote-btn${hasVoted ? ' voted' : ''}" onclick="voteSuggestion('${s.id}')" title="${hasVoted ? 'Already voted' : 'Upvote this trait'}">
                ▲&thinsp;<span class="sugg-vote-count">${s.votes || 0}</span>
              </button>
            </div>
            <div class="sugg-card-desc">${s.desc}</div>
            ${s.effect ? `<div class="sugg-card-effect"><span class="sugg-effect-label">STAT IDEA</span>${s.effect}</div>` : ''}
            <div class="sugg-card-footer">
              <span style="color:#444;">${s.submitter ? '— ' + s.submitter : '— Anonymous'}</span>
              <span style="color:#333;">${date}</span>
            </div>
          </div>`;
        }).join('');
    });
}

function submitGeneralSuggestion() {
  if (!db) return;
  const text = (document.getElementById('gen-sugg-text')?.value || '').trim();
  const status = document.getElementById('gen-sugg-status');
  if (!text) { if (status) status.textContent = 'WRITE SOMETHING FIRST.'; return; }
  db.collection('general_suggestions').add({ text, createdAt: Date.now() })
    .then(() => {
      const el = document.getElementById('gen-sugg-text');
      if (el) el.value = '';
      if (status) {
        status.style.color = '#44ff88';
        status.textContent = 'SUBMITTED!';
        setTimeout(() => { status.textContent = ''; status.style.color = '#555'; }, 3000);
      }
      loadGeneralSuggestions();
    })
    .catch(() => { if (status) { status.style.color = '#ff4444'; status.textContent = 'FAILED.'; } });
}

function loadGeneralSuggestions() {
  if (!db) return;
  const list = document.getElementById('gen-suggestion-list');
  if (!list) return;
  db.collection('general_suggestions').orderBy('createdAt', 'desc').limit(20).get()
    .then(snap => {
      if (snap.empty) { list.innerHTML = '<div style="font-size:8px;color:#333;letter-spacing:1px;">NONE YET.</div>'; return; }
      list.innerHTML = '<div style="font-size:8px;color:#444;letter-spacing:2px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #1a1a1a;">RECENT</div>' +
        snap.docs.map(d => {
          const data = d.data();
          const date = new Date(data.createdAt).toLocaleDateString();
          return `<div style="padding:9px 12px;margin-bottom:8px;border:1px solid #1e1e1e;border-left:2px solid #2a2a2a;font-size:8px;line-height:1.7;color:#888;">${data.text}<div style="color:#333;font-size:7px;margin-top:6px;letter-spacing:1px;">${date}</div></div>`;
        }).join('');
    });
}

// ============================================================
// RADAR CHART
// ============================================================
function _hexToRgb(hex) {
  const h = (hex || '#888888').replace('#', '');
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toggleRadarChart() {
  const wrap = document.getElementById('cv-radar-wrap');
  const btn = document.getElementById('btn-radar');
  if (!wrap) return;
  const nowVisible = wrap.style.display !== 'none';
  wrap.style.display = nowVisible ? 'none' : 'block';
  if (btn) btn.classList.toggle('radar-active', !nowVisible);
  if (!nowVisible) {
    const c = characters.find(x => x.id === currentId);
    if (c) renderRadarChart(c);
  }
}

// Animated radar state — tracks interpolated effective stat values per character
const _radarAnim = { charId: null, current: null, target: null, frame: null };
const RADAR_KEYS = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'];

function renderRadarChart(c) {
  const svg = document.getElementById('cv-radar-svg');
  const wrap = document.getElementById('cv-radar-wrap');
  if (!svg || !c || wrap?.style.display === 'none') return;

  const eff = getEffectiveStats(c);
  const target = {};
  RADAR_KEYS.forEach(k => { target[k] = eff[k] || 0; });

  // On character switch, snap immediately (no slide from wrong character's values)
  if (_radarAnim.charId !== c.id) {
    _radarAnim.charId = c.id;
    _radarAnim.current = { ...target };
    _radarAnim.target = { ...target };
    if (_radarAnim.frame) { cancelAnimationFrame(_radarAnim.frame); _radarAnim.frame = null; }
    _drawRadarFrame(svg, c, _radarAnim.current);
    return;
  }

  _radarAnim.target = target;
  if (_radarAnim.frame) cancelAnimationFrame(_radarAnim.frame);

  const tick = () => {
    let settled = true;
    RADAR_KEYS.forEach(k => {
      const diff = _radarAnim.target[k] - _radarAnim.current[k];
      if (Math.abs(diff) < 0.05) {
        _radarAnim.current[k] = _radarAnim.target[k];
      } else {
        _radarAnim.current[k] += diff * 0.1; // ease-out lerp
        settled = false;
      }
    });
    _drawRadarFrame(svg, c, _radarAnim.current);
    _radarAnim.frame = settled ? null : requestAnimationFrame(tick);
  };
  _radarAnim.frame = requestAnimationFrame(tick);
}

function _drawRadarFrame(svg, c, effVals) {
  const LBLS = ['HP', 'ATK', 'DEF', 'MAG', 'SPD', 'IQ'];
  const COLS = { hp: '#44dd77', atk: '#ff4444', def: '#4499ff', mag: '#ff44ff', spd: '#ffcc00', iq: '#00bbcc' };
  const HMAX = STAT_HARD_MAX;

  // cy=155 gives headroom above the chart for stats that overflow the outer ring
  const cx = 150, cy = 155, R = 95;
  const step = (Math.PI * 2) / RADAR_KEYS.length;
  const a0 = -Math.PI / 2;

  const angle = i => a0 + step * i;
  const cartesian = (i, frac) => [
    cx + Math.cos(angle(i)) * R * frac,
    cy + Math.sin(angle(i)) * R * frac,
  ];
  const pts = arr => arr.map(p => p.join(',')).join(' ');

  // Outer ring = Mountain Level cap (STAT_HARD_MAX).
  // Below the cap: sqrt curve so weaker characters aren't invisibly tiny —
  //   athlete-level (~5% of cap) appears at ~22% of the ring rather than 5%.
  //   Mountain-level still hits the ring exactly.
  // Past the cap: log2-compressed so the shape grows but slows down fast.
  const rawNorm = RADAR_KEYS.map(k => effVals[k] / HMAX[k]);
  const norm = rawNorm.map(v => {
    if (v <= 0) return 0;
    if (v <= 1.0) return Math.sqrt(v);
    return Math.min(1.0 + 0.35 * Math.log2(v), 1.5);
  });

  // ── Grid rings ──────────────────────────────────────────────
  const rings = [0.25, 0.5, 0.75, 1.0].map(f => {
    const p = pts(RADAR_KEYS.map((_, i) => cartesian(i, f)));
    const edge = f === 1.0;
    return `<polygon points="${p}" fill="none" stroke="${edge ? '#252525' : '#181818'}" stroke-width="${edge ? 1 : 0.5}" stroke-dasharray="${edge ? 'none' : '2 3'}"/>`;
  }).join('');

  // ── Axis spokes ─────────────────────────────────────────────
  const spokes = RADAR_KEYS.map((_, i) => {
    const [x, y] = cartesian(i, 1.05);
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#1c1c1c" stroke-width="1"/>`;
  }).join('');

  // ── Polygons ────────────────────────────────────────────────
  const polyPts = pts(norm.map((v, i) => cartesian(i, v)));
  const [r, g, b] = _hexToRgb(c.color || '#888888');

  // ── Vertex dots ─────────────────────────────────────────────
  const dots = norm.map((v, i) => {
    const [dx, dy] = cartesian(i, v);
    return `<circle cx="${dx}" cy="${dy}" r="3.5" fill="${COLS[RADAR_KEYS[i]]}" stroke="#000" stroke-width="1"/>`;
  }).join('');

  // ── Labels (static positions — don't animate) ───────────────
  const labelR = 1.26;
  const labels = RADAR_KEYS.map((k, i) => {
    const [lx, ly] = cartesian(i, labelR);
    const anchor = lx < cx - 8 ? 'end' : lx > cx + 8 ? 'start' : 'middle';
    const pct = Math.round(rawNorm[i] * 100); // 100% = Mountain Level cap
    const overflowing = rawNorm[i] > 1.005; // above the outer ring (beyond Mountain Level)
    return `
      <text x="${lx}" y="${ly - 5}" text-anchor="${anchor}" dominant-baseline="middle"
        font-family="inherit" font-size="8" letter-spacing="1.5" fill="${COLS[k]}" font-weight="bold">${LBLS[i]}</text>
      <text x="${lx}" y="${ly + 6}" text-anchor="${anchor}" dominant-baseline="middle"
        font-family="inherit" font-size="6.5" letter-spacing="0.5" fill="${overflowing ? COLS[k] : '#444'}">${overflowing ? '▲' : ''}${pct}%</text>`;
  }).join('');

  svg.innerHTML = rings + spokes +
    `<polygon points="${polyPts}" fill="none" stroke="rgba(${r},${g},${b},0.15)" stroke-width="4" stroke-linejoin="round"/>` +
    `<polygon points="${polyPts}" fill="rgba(${r},${g},${b},0.15)" stroke="rgba(${r},${g},${b},0.85)" stroke-width="1.5" stroke-linejoin="round"/>` +
    dots +
    `<circle cx="${cx}" cy="${cy}" r="2" fill="#2a2a2a"/>` +
    labels;
}

// ============================================================
// INVENTORY SYSTEM
// ============================================================
const ITEM_ICONS = {
  // WEAPONS
  sword: '🗡️', greatsword: '⚔️', dagger: '🔪', bow: '🏹', axe: '🪓', spear: '🔱', staff: '🦯', wand: '🪄',
  gun: '🔫', bomb: '💣', boomerang: '🪃', hammer: '⚒️', mace: '🔨', club: '🏏', flail: '⛓️', trident: '🔱',
  crossbow: '🎯', slingshot: '🏹', katana: '⚔️', rapier: '🗡️', saber: '🗡️', pickaxe: '⛏️', mattock: '⛏️', scythe: '⚱️',

  // ARMOR
  shield: '🛡️', helmet: '🪖', chestplate: '👕', boots: '👢', gloves: '🧤', ring: '💍', necklace: '📿', cape: '🧣',
  coat: '🥼', tie: '👔', dress: '👗', shorts: '🩳', socks: '🧦', shoes: '🥾', hat: '🧢', tophat: '🎩', crown: '👑',
  pants: '👖', kimono: '👘', sari: '🥻', vest: '🦺', armor: '⛓️', breastplate: '🛡️', gauntlets: '🤐', leggings: '👖',
  pauldrons: '🪖', greaves: '🦵', sabatons: '👢', vambraces: '💪', gorget: '👔', cuirass: '🛡️',
  wintercoat: '🧥', ballet: '🩰', sandals: '🩴', heels: '👠', flats: '👡', loafers: '👞', sneakers: '👟',
  backpack: '🎒', luggage: '🧳', glasses: '👓', sunglasses: '🕶️', goggles: '🥽', mask: '😷', visor: '👀',

  // MAGIC
  book: '📖', scroll: '📜', orb: '🔮', gem: '💎', crystal: '💠', talisman: '🧿', grimoire: '📚', rune: '⚡',
  amulet: '💎', charm: '🪬', hex: '✨', totem: '🪵', urn: '🏺', hourglass: '⏳', candle: '🕯️', lamp: '🪔',
  blood: '🩸', dna: '🧬', star: '⭐', moon: '🌙', sun: '☀️', lightning: '⚡', flame: '🔥', frost: '❄️',

  // CONSUMABLES
  potion: '🧪', elixir: '🍷', apple: '🍎', meat: '🍖', herb: '🌿', bread: '🍞', cheese: '🧀', mana_potion: '🟦',
  health_potion: '🟥', mushroom: '🍄', fish: '🐟', sushi: '🍣', riceball: '🍙', dumpling: '🥟', chicken: '🍗',
  burger: '🍔', pizza: '🍕', fries: '🍟', beer: '🍺', tea: '🍵', coffee: '☕', juice: '🧃', wine: '🍇',
  soup: '🍲', salad: '🥗', egg: '🥚', bacon: '🥓', donut: '🍩', cake: '🍰', candy: '🍬', chocolate: '🍫',

  // MISC
  skull: '💀', key: '🗝️', coin: '🪙', map: '🗺️', bone: '🦴', compass: '🧭', gear: '⚙️', cog: '⚙️',
  brick: '🧱', wood: '🪵', bell: '🔔', magnet: '🧲', eye: '👁️', brain: '🧠', tooth: '🦷', trophy: '🏆',
  medal: '🥇', badge: '🏅', flask: '🧴', lantern: '🏮', trap: '🪤', net: '🥅', cage: '🪤', chain: '⛓️',
  lock: '🔒', padlock: '🔐', chest: '📦', box: '📫', barrel: '🛢️', urn: '🏺', vial: '🧪', feather: '🪶',
  shell: '🐚', ticket: '🎫', dice: '🎲', card: '🎴', rose: '🌹', star: '✨', pearl: '💠'
};

const ICON_CATEGORIES = [
  { label: 'WEAPONS', keys: ['sword', 'greatsword', 'dagger', 'bow', 'axe', 'spear', 'staff', 'wand', 'gun', 'bomb', 'boomerang', 'hammer', 'mace', 'club', 'flail', 'trident', 'crossbow', 'slingshot', 'katana', 'rapier', 'saber', 'pickaxe', 'mattock', 'scythe'] },
  { label: 'ARMOR', keys: ['shield', 'helmet', 'chestplate', 'boots', 'gloves', 'ring', 'necklace', 'cape', 'coat', 'tie', 'dress', 'shorts', 'socks', 'shoes', 'hat', 'tophat', 'crown', 'pants', 'kimono', 'sari', 'vest', 'armor', 'breastplate', 'gauntlets', 'leggings', 'pauldrons', 'greaves', 'sabatons', 'vambraces', 'gorget', 'cuirass', 'wintercoat', 'ballet', 'sandals', 'heels', 'flats', 'loafers', 'sneakers', 'backpack', 'luggage', 'glasses', 'sunglasses', 'goggles', 'mask', 'visor'] },
  { label: 'MAGIC', keys: ['book', 'scroll', 'orb', 'gem', 'crystal', 'talisman', 'grimoire', 'rune', 'amulet', 'charm', 'hex', 'totem', 'urn', 'hourglass', 'candle', 'lamp', 'blood', 'dna', 'star', 'moon', 'sun', 'lightning', 'flame', 'frost'] },
  { label: 'CONSUMABLES', keys: ['potion', 'elixir', 'apple', 'meat', 'herb', 'bread', 'cheese', 'mana_potion', 'health_potion', 'mushroom', 'fish', 'sushi', 'riceball', 'dumpling', 'chicken', 'burger', 'pizza', 'fries', 'beer', 'tea', 'coffee', 'juice', 'wine', 'soup', 'salad', 'egg', 'bacon', 'donut', 'cake', 'candy', 'chocolate'] },
  { label: 'MISC', keys: ['skull', 'key', 'coin', 'map', 'bone', 'compass', 'gear', 'cog', 'brick', 'wood', 'bell', 'magnet', 'eye', 'brain', 'tooth', 'trophy', 'medal', 'badge', 'flask', 'lantern', 'trap', 'net', 'cage', 'chain', 'lock', 'padlock', 'chest', 'box', 'barrel', 'urn', 'vial', 'feather', 'shell', 'ticket', 'dice', 'card', 'rose', 'star', 'pearl'] }
];

let currentItemIcon = null;
let currentItemIconImage = null;
let editingItemId = null;

function getEffectiveStats(c) {
  // If an alternate form is active, use its stats/substats as the base
  const _activeFormIdx = c.activeFormIdx || 0;
  const _activeAltForm = _activeFormIdx > 0 ? (c.altForms || [])[_activeFormIdx - 1] : null;
  const base = { ...(_activeAltForm ? _activeAltForm.stats : c.stats) };
  const subBase = (_activeAltForm ? _activeAltForm.substats : null) || c.substats || {
    heal_pow: 0, crit_rate: 0, crit_dmg: 0,
    status_res: 0, dexterity: 0, resilience: 0,
    true_dmg: 0, lifesteal: 0, cooldown_red: 0
  };

  // For base characters, locked substats are always 0 (they're fully derived from main stats).
  // For alt forms, the user can set them freely — those values become the starting base.
  if (!_activeAltForm) {
    const lockedSubstats = ['crit_rate', 'crit_dmg', 'status_res', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'];
    lockedSubstats.forEach(key => subBase[key] = 0);
  }

  const items = (c.inventory || []).filter(i => i.equipped);

  const adds = { hp: 0, atk: 0, def: 0, mag: 0, spd: 0, iq: 0, heal_pow: 0, crit_rate: 0, crit_dmg: 0, status_res: 0, dexterity: 0, resilience: 0, true_dmg: 0, lifesteal: 0, cooldown_red: 0 };
  const muls = { hp: 1, atk: 1, def: 1, mag: 1, spd: 1, iq: 1, heal_pow: 1, crit_rate: 1, crit_dmg: 1, status_res: 1, dexterity: 1, resilience: 1, true_dmg: 1, lifesteal: 1, cooldown_red: 1 };

  items.forEach(item => {
    (item.mods || []).forEach(m => {
      const v = parseFloat(m.value) || 0;
      if (m.op === 'add') adds[m.stat] += v;
      if (m.op === 'sub') adds[m.stat] -= v;
      if (m.op === 'mul') muls[m.stat] *= v;
      if (m.op === 'div') { if (v !== 0) muls[m.stat] /= v; }
    });
  });

  let effHp = Math.max(1, Math.round((base.hp + adds.hp) * muls.hp));
  let effAtk = Math.max(1, Math.round((base.atk + adds.atk) * muls.atk));
  let effDef = Math.max(1, Math.round((base.def + adds.def) * muls.def));
  let effMag = Math.max(1, Math.round((base.mag + adds.mag) * muls.mag));
  let effSpd = Math.max(1, Math.round((base.spd + adds.spd) * muls.spd));
  let effIq  = Math.max(1, Math.round(((base.iq || 50) + adds.iq) * muls.iq));

  let rawCritRate = subBase.crit_rate + ((effAtk / 20) * 0.3);
  let cappedBaseCritRate = Math.min(rawCritRate, 80);

  let rawStatusRes = subBase.status_res + ((effDef / 20) * 1);
  let cappedBaseStatusRes = Math.min(rawStatusRes, 50);

  let baseHealPow = subBase.heal_pow + ((effMag / 15) * 5);
  let baseDex = subBase.dexterity + ((effSpd / 10) * 0.5);
  let baseResilience = subBase.resilience + ((effHp / 100) * 0.2);

  let baseTrueDmg = subBase.true_dmg + ((effHp / 300) * 1);
  let baseLifesteal = subBase.lifesteal + ((effDef / 100) * 1);
  let rawCooldownRed = subBase.cooldown_red + ((effSpd / 20) * 1);
  let cappedBaseCooldownRed = Math.min(rawCooldownRed, 40);

  let effHealPow = (baseHealPow + adds.heal_pow) * muls.heal_pow;
  let effCritRate = (cappedBaseCritRate + adds.crit_rate) * muls.crit_rate;
  let finalCritDmg = (subBase.crit_dmg + ((effAtk / 50) * 1) + (effCritRate * 0.1) + adds.crit_dmg) * muls.crit_dmg;
  let effStatusRes = (cappedBaseStatusRes + adds.status_res) * muls.status_res;
  let effDex = (baseDex + adds.dexterity) * muls.dexterity;
  let effResilience = (baseResilience + adds.resilience) * muls.resilience;
  let effTrueDmg = (baseTrueDmg + adds.true_dmg) * muls.true_dmg;
  let effLifesteal = (baseLifesteal + adds.lifesteal) * muls.lifesteal;
  let effCooldownRed = (cappedBaseCooldownRed + adds.cooldown_red) * muls.cooldown_red;

  effResilience = Math.min(effResilience, 50);

  // Handle Paradox trait: swap highest and lowest main stats
  const hasPaRadox = c.traits && c.traits.includes('paradox');
  if (hasPaRadox) {
    const mainStats = [
      { name: 'hp', val: effHp },
      { name: 'atk', val: effAtk },
      { name: 'def', val: effDef },
      { name: 'mag', val: effMag },
      { name: 'spd', val: effSpd }
    ];
    const sorted = [...mainStats].sort((a, b) => a.val - b.val);
    const lowest = sorted[0].name;
    const highest = sorted[4].name;
    
    // Swap the values
    const tempVal = { hp: effHp, atk: effAtk, def: effDef, mag: effMag, spd: effSpd }[lowest];
    const swapVal = { hp: effHp, atk: effAtk, def: effDef, mag: effMag, spd: effSpd }[highest];
    
    if (lowest === 'hp') effHp = swapVal;
    else if (lowest === 'atk') effAtk = swapVal;
    else if (lowest === 'def') effDef = swapVal;
    else if (lowest === 'mag') effMag = swapVal;
    else if (lowest === 'spd') effSpd = swapVal;
    
    if (highest === 'hp') effHp = tempVal;
    else if (highest === 'atk') effAtk = tempVal;
    else if (highest === 'def') effDef = tempVal;
    else if (highest === 'mag') effMag = tempVal;
    else if (highest === 'spd') effSpd = tempVal;
  }

  // Handle Glitch trait: apply stored random multipliers to all stats
  const hasGlitch = c.traits && c.traits.includes('glitch');
  if (hasGlitch && c.glitchRolls) {
    effHp = Math.max(1, Math.round(effHp * c.glitchRolls.hp));
    effAtk = Math.max(1, Math.round(effAtk * c.glitchRolls.atk));
    effDef = Math.max(1, Math.round(effDef * c.glitchRolls.def));
    effMag = Math.max(1, Math.round(effMag * c.glitchRolls.mag));
    effSpd = Math.max(1, Math.round(effSpd * c.glitchRolls.spd));
  }

  return {
    hp: effHp, atk: effAtk, def: effDef, mag: effMag, spd: effSpd, iq: effIq,
    heal_pow: effHealPow, crit_rate: effCritRate, crit_dmg: finalCritDmg,
    status_res: effStatusRes, dexterity: effDex, resilience: effResilience,
    true_dmg: effTrueDmg, lifesteal: effLifesteal, cooldown_red: effCooldownRed
  };
}

function renderSubstatsDisplay(c, effStats) {
  const subStatsEl = document.getElementById('cv-substats');
  if (!subStatsEl) return;

  const subStats = [
    { key: 'heal_pow', label: 'HEAL POWER', color: '#88ff88', icon: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M4 1h2v3h3v2H6v3H4V6H1V4h3z" fill="currentColor"/></svg>', title: 'Base +5% per 15 MAG. No max.' },
    { key: 'crit_rate', label: 'CRIT CHANCE', color: '#ff8888', icon: '<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="5" cy="5" r="1.5" fill="currentColor"/></svg>', title: 'Base +0.3% per 20 ATK. Max 80% without items.' },
    { key: 'crit_dmg', label: 'EXTRA CRIT DMG', color: '#cc0000', icon: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 0l1.5 3.5L10 5l-3.5 1.5L5 10l-1.5-3.5L0 5l3.5-1.5z" fill="currentColor"/></svg>', title: 'Base +1% per 50 ATK. +0.1% per 1% Crit Chance.' },
    { key: 'status_res', label: 'STATUS RES', color: '#00ccaa', icon: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 2v4c0 3 4 3.5 4 3.5s4-.5 4-3.5V2l-4-1z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M5 4l1 1-1 1-1-1z" fill="currentColor"/></svg>', title: 'Base +1% per 20 DEF. Max 50% without items.' },
    { key: 'dexterity', label: 'DEXTERITY', color: '#ffff88', icon: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 8c1-2 4-2 6-4-1 2-4 2-6 4z" fill="currentColor"/><circle cx="8" cy="2" r="1" fill="currentColor"/></svg>', title: 'Base +0.5% per 10 SPEED. Combat speed, weaving, dodging.' },
    { key: 'resilience', label: 'RESILIENCE', color: '#8800cc', icon: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 9L1 5A2.5 2.5 0 0 1 5 2 2.5 2.5 0 0 1 9 5Z" fill="none" stroke="currentColor" stroke-width="1"/><rect x="4" y="3" width="2" height="4" fill="currentColor"/></svg>', title: 'Chance to survive with 1 hp. +0.20% resilience per 100 HP. Max 50%.' },
    { key: 'true_dmg', label: 'TRUE DAMAGE', color: '#ffffff', icon: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 0 L10 5 L5 10 L0 5 Z" fill="currentColor"/></svg>', title: 'Ignores defense. +1% true damage per 300 HP.' },
    { key: 'lifesteal', label: 'LIFESTEAL', color: '#aa0000', icon: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 0 Q5 5 2 7 A3 3 0 0 0 8 7 Q5 5 5 0 Z" fill="currentColor"/></svg>', title: 'Heal from damage dealt. +1% lifesteal per 100 DEF.' },
    { key: 'cooldown_red', label: 'COOLDOWN RED.', color: '#00aaff', icon: '<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" stroke-width="1"/><path d="M5 2 L5 5 L7 7" fill="none" stroke="currentColor" stroke-width="1"/></svg>', title: 'Reduces skill cooldowns. +1% CDR per 20 SPEED. Max 40% without items.' },
  ];

  // Sanity: base 80 for perfectsoul owners (−5/soul), 100 otherwise. Items can add/subtract.
  const _hasPerfectSoul = c.traits && c.traits.includes('perfectsoul');
  let _sanityItemDelta = 0;
  let _sanityItemLines = '';
  (c.inventory || []).filter(i => i.equipped).forEach(item => {
    (item.mods || []).forEach(m => {
      if (m.stat !== 'sanity') return;
      const v = parseFloat(m.value) || 0;
      let d = 0;
      if (m.op === 'add') d = v;
      if (m.op === 'sub') d = -v;
      if (d !== 0) {
        _sanityItemDelta += d;
        _sanityItemLines += `<div style='margin-top:2px'><span style='color:#aaa;'>${item.name}:</span> ${d > 0 ? '+' : ''}${d}</div>`;
      }
    });
  });
  let sanityExtra = '';
  if (_hasPerfectSoul || _sanityItemDelta !== 0) {
    const souls = (_hasPerfectSoul && c.perfectSoulData && c.perfectSoulData.souls) ? c.perfectSoulData.souls.length : 0;
    const sanityBase = _hasPerfectSoul ? (80 - souls * 5) : 100;
    const sanity = sanityBase + _sanityItemDelta;
    const sanityColor = sanity < 0 ? '#cc4444' : sanity <= 30 ? '#cc8844' : '#aaaaaa';
    let sanityTipBody = `<div style='color:#dd88ff;font-weight:bold;margin-bottom:4px;'>SANITY</div>`;
    if (_hasPerfectSoul) sanityTipBody += `<div style='margin-bottom:6px;'>Base 80. -5 per absorbed soul.</div>`;
    else sanityTipBody += `<div style='margin-bottom:6px;'>Base 100.</div>`;
    if (_sanityItemLines) sanityTipBody += `<div style='color:var(--accent-cyan);margin-bottom:4px;border-bottom:1px solid #333;padding-bottom:4px;'>ITEM MODIFIERS</div>${_sanityItemLines}`;
    const sanityTip = sanityTipBody.replace(/"/g, '&quot;');
    sanityExtra = `<div style="display:flex; justify-content:space-between; align-items:center; font-size: 9px; letter-spacing: 1px; border-bottom: 1px solid #222; padding-bottom: 4px;" data-tooltip="${sanityTip}"><span style="color: #dd88ff; font-weight: bold; display:flex; align-items:center;"><span style="opacity: 0.8; margin-right: 4px;"><svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="4" r="3" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="3.5" cy="3.5" r="0.7" fill="currentColor"/><circle cx="6.5" cy="3.5" r="0.7" fill="currentColor"/><path d="M3.5 5.5 Q5 6.5 6.5 5.5" fill="none" stroke="currentColor" stroke-width="0.8"/><line x1="5" y1="7" x2="5" y2="9" stroke="currentColor" stroke-width="1"/></svg></span> SANITY</span><span style="color: ${sanityColor}; text-align:right;">${sanity}</span></div>`;
  }

  subStatsEl.innerHTML = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">` + subStats.map(s => {
    // The base input value entered by user, not the scaled base
    // Force locked substats to 0 for display consistency
    let baseVal = c.substats ? (c.substats[s.key] || 0) : 0;
    if (['crit_rate', 'crit_dmg', 'status_res', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'].includes(s.key)) baseVal = 0;

    const effVal = effStats[s.key] || 0;

    // Calculate "pure scaled" stat (keep all items, but strip direct modifiers for this specific substat)
    const noDirectC = JSON.parse(JSON.stringify(c));
    if (noDirectC.inventory) {
      noDirectC.inventory.forEach(i => {
        i.mods = (i.mods || []).filter(m => m.stat !== s.key);
      });
    }
    const pureScaled = getEffectiveStats(noDirectC)[s.key];
    const fromStats = pureScaled - baseVal;

    // Calculate breakdown per item (only for DIRECT modifiers)
    let itemBreakdown = '';
    const equipped = c.inventory ? c.inventory.filter(i => i.equipped) : [];
    equipped.forEach(item => {
      const tempC = JSON.parse(JSON.stringify(c));
      const idx = tempC.inventory.findIndex(i => i.id === item.id);
      if (idx !== -1) {
        // Strip only the direct modifier for this substat to see its isolated impact
        tempC.inventory[idx].mods = (tempC.inventory[idx].mods || []).filter(m => m.stat !== s.key);
        const statsWithoutDirectItem = getEffectiveStats(tempC);
        const diffFromThisItem = effVal - statsWithoutDirectItem[s.key];

        if (Math.abs(diffFromThisItem) > 0.009) {
          const sign = diffFromThisItem > 0 ? '+' : '';
          itemBreakdown += `<div style='margin-top:2px'><span style='color:#aaa;'>${item.name}:</span> ${sign}${diffFromThisItem.toFixed(1)}%</div>`;
        }
      }
    });

    const totalDiff = effVal - baseVal;

    let tooltipBody = '';
    if (Math.abs(fromStats) > 0.05) {
      const sign = fromStats > 0 ? '+' : '';
      tooltipBody += `<div style='color:var(--accent-yellow);margin-bottom:4px;border-bottom:1px solid #333;padding-bottom:4px;'>STAT SCALING</div>`;
      tooltipBody += `<div style='margin-bottom:8px;'><span style='color:#aaa;'>From Stats:</span> <span style='color:#fff'>${sign}${fromStats.toFixed(1)}%</span></div>`;
    }

    if (itemBreakdown !== '') {
      tooltipBody += `<div style='color:var(--accent-cyan);margin-bottom:4px;border-bottom:1px solid #333;padding-bottom:4px;'>ITEM BONUSES</div>${itemBreakdown}`;
    }

    let diffHtml = '';
    if (Math.abs(totalDiff) > 0.05) {
      const sign = totalDiff > 0 ? '+' : '';
      const colorClass = totalDiff > 0 ? 'pos' : 'neg';
      diffHtml = ` <span class="eff-stat-diff ${colorClass}" data-tooltip="${tooltipBody.replace(/"/g, '&quot;')}">${sign}${totalDiff.toFixed(1)}</span>`;
    }

    const rowTooltip = `<div style='color:${s.color};font-weight:bold;margin-bottom:4px;'>${s.label}</div>${s.title}`;

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; font-size: 9px; letter-spacing: 1px; border-bottom: 1px solid #222; padding-bottom: 4px;" data-tooltip="${rowTooltip.replace(/"/g, '&quot;')}">
        <span style="color: ${s.color}; font-weight: bold; display:flex; align-items:center;">
          <span style="opacity: 0.8; margin-right: 4px;">${s.icon}</span> ${s.label}
        </span>
        <span style="color: #fff; text-align:right;">${effVal.toFixed(1)}%${diffHtml}</span>
      </div>
    `;
  }).join('') + sanityExtra + `</div>`;
}

function renderInventory(c) {
  const wrap = document.getElementById('cv-inventory');
  if (!wrap) return;
  const inv = c.inventory || [];
  if (inv.length === 0) {
    wrap.innerHTML = `<div style="font-size:9px; color:#555; letter-spacing:1px; grid-column:1/-1; text-align:center; padding:30px;">NO ITEMS IN INVENTORY</div>`;
    return;
  }

  wrap.innerHTML = inv.map(i => {
    let hash = 0;
    const k = i.icon || 'sword';
    for (let x = 0; x < k.length; x++) hash = k.charCodeAt(x) + ((hash << 5) - hash);
    const hc = `hsl(${Math.abs(hash) % 360}, 80%, 60%)`;

    let iconHtml = '';
    if (i.iconImage) iconHtml = `<img src="${i.iconImage}"/>`;
    else if (i.icon && ITEM_ICONS[i.icon]) iconHtml = `<span class="emoji-icon">${ITEM_ICONS[i.icon]}</span>`;
    else iconHtml = `?`;

    const modsHtml = (i.mods || []).map(m => {
      let sign = '';
      if (m.op === 'add') sign = '+';
      if (m.op === 'sub') sign = '-';
      if (m.op === 'mul') sign = 'x';
      if (m.op === 'div') sign = '/';
      return `<div class="inv-mod-tag ${m.op}">${m.stat.toUpperCase()} ${sign}${m.value}</div>`;
    }).join('');

    const passivesHtml = (i.passives || []).filter(Boolean).map(p =>
      `<div class="inv-passive-tag">${p}</div>`
    ).join('');

    const _invNaraCol = _isNara(c) ? _naraCurrentColor : c.color;
    return `<div class="inv-card ${i.equipped ? 'equipped' : ''}" style="--char-color: ${_invNaraCol}; --hc: ${hc}">
      <div class="inv-card-icon">${iconHtml}</div>
      <div class="inv-card-info">
        <div class="inv-card-name"${i.equipped ? (_isNara(c) ? ' class="nara-rainbow"' : ` style="color:${c.color}"`) : ''}>${i.name || 'Unnamed Item'}</div>
        <div class="inv-card-desc">${i.desc || ''}</div>
        <div class="inv-mod-tags">${modsHtml}</div>
        ${passivesHtml ? `<div class="inv-passive-tags">${passivesHtml}</div>` : ''}
      </div>
      <button class="btn sm ${i.equipped ? 'accent' : ''} equip-btn-abs" onclick="toggleEquip('${i.id}')">${i.equipped ? 'UNEQUIP' : 'EQUIP'}</button>
      <div class="inv-card-actions-abs">
        <button class="btn sm icon-btn" onclick="copyItem('${i.id}')" title="Copy item">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="3" y="3" width="6" height="7" fill="none" stroke="currentColor" stroke-width="1"/><rect x="1" y="1" width="6" height="7" fill="none" stroke="currentColor" stroke-width="1"/><rect x="1" y="1" width="6" height="7" fill="currentColor" opacity="0.15"/></svg>
        </button>
        <button class="btn sm icon-btn" onclick="openItemEditor('${c.id}', '${i.id}')" title="Edit">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M7 1l2 2-6 6H1V7L7 1z" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="6" y="0" width="3" height="3" fill="currentColor" rx="0.5"/></svg>
        </button>
        <button class="btn sm danger icon-btn" onclick="deleteItem('${i.id}')" title="Delete">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="3" width="8" height="1" fill="currentColor"/><rect x="3" y="1" width="4" height="1" fill="currentColor"/><path d="M2 4l1 6h4l1-6" fill="none" stroke="currentColor" stroke-width="1"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function toggleEquip(itemId) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const item = c.inventory.find(i => i.id === itemId);
  if (item) {
    item.equipped = !item.equipped;
    playSound('equip', { rate: item.equipped ? 1.05 : 0.88, volume: 0.85 });
    saveData(c);
    renderInventory(c);
    updateLiveStats(c);
    // Trait tooltips are lazily cached — invalidate so the next hover recomputes
    // with the new item stats included in getEffectiveStats
    document.querySelectorAll('.trait-chip[data-trait]').forEach(chip => {
      delete chip.dataset.tooltip;
    });
  }
}

function updateLiveStats(c) {
  const effStats = getEffectiveStats(c);
  const _afIdx = c.activeFormIdx || 0;
  const _af = _afIdx > 0 ? (c.altForms || [])[_afIdx - 1] : null;
  const _baseStats = _af ? _af.stats : c.stats;
  const stats = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'];
  stats.forEach(key => {
    const baseVal = _baseStats[key] || 0;
    const effVal = effStats[key];
    const diff = effVal - baseVal;
    let diffHtml = '';
    if (diff !== 0) {
      const tooltip = buildStatBreakdownTooltip(c, key);
      const sign = diff > 0 ? '+' : '';
      const cls = diff > 0 ? 'pos' : 'neg';
      diffHtml = `<span class="eff-stat-diff ${cls}" data-tooltip="${tooltip}">(${sign}${diff})</span>`;
    }

    const row = document.getElementById(`stat-segs-${key}`)?.parentElement;
    if (row) {
      const valEl = row.querySelector('.stat-val');
      if (valEl) valEl.innerHTML = `${effVal}${diffHtml}`;
    }

    // 0.05 speed gives a slower, dramatic fill when equipping items!
    renderStatSegs(effVal, key, 0.05);
  });

  renderSubstatsDisplay(c, effStats);
  updateCharPLBadge(c);
  renderRadarChart(c);
}

function deleteItem(itemId) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  if (!confirm("Delete this item?")) return;
  playSound('delete');
  c.inventory = c.inventory.filter(i => i.id !== itemId);
  saveData(c);
  viewChar(currentId);
}

let _copiedItem = null;

function copyItem(itemId) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const item = c.inventory.find(i => i.id === itemId);
  if (!item) return;
  _copiedItem = JSON.parse(JSON.stringify(item));
  notify(`"${item.name}" COPIED`, 'ok');
  const btn = document.getElementById('paste-item-btn');
  if (btn) { btn.style.display = ''; btn.textContent = `PASTE "${item.name}"`; }
}

function pasteItem() {
  if (!_copiedItem) return;
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const newItem = { ...JSON.parse(JSON.stringify(_copiedItem)), id: genId(), equipped: false };
  if (!c.inventory) c.inventory = [];
  c.inventory.push(newItem);
  saveData(c);
  renderInventory(c);
  updateLiveStats(c);
  notify(`"${newItem.name}" PASTED`, 'ok');
}

function buildIconPicker() {
  const wrap = document.getElementById('ie-icon-picker');
  if (!wrap) return;
  wrap.innerHTML = ICON_CATEGORIES.map(cat => `
    <div class="icon-cat-title">${cat.label}</div>
    <div class="icon-picker-grid">
      ${cat.keys.map(k => {
    let hash = 0;
    for (let i = 0; i < k.length; i++) hash = k.charCodeAt(i) + ((hash << 5) - hash);
    const hc = `hsl(${Math.abs(hash) % 360}, 80%, 60%)`;
    return `<button type="button" class="icon-btn-item ${currentItemIcon === k ? 'active' : ''}" style="--hc: ${hc}" onclick="pickIcon('${k}')" data-icon="${k}" title="${k}"><span class="emoji-icon">${ITEM_ICONS[k]}</span></button>`;
  }).join('')}
    </div>
  `).join('');
}

function pickIcon(key) {
  currentItemIcon = key;
  currentItemIconImage = null; // Clear custom image
  document.querySelectorAll('.icon-btn-item').forEach(el => {
    el.classList.toggle('active', el.dataset.icon === key);
  });
  document.getElementById('ie-selected-icon-name').textContent = key.toUpperCase();
}

function handleItemIconUpload(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentItemIconImage = e.target.result;
    currentItemIcon = null;
    document.querySelectorAll('.icon-btn-item').forEach(el => el.classList.remove('active'));
    document.getElementById('ie-selected-icon-name').textContent = 'CUSTOM UPLOAD';
  };
  reader.readAsDataURL(file);
}

function renderModRows(mods) {
  const list = document.getElementById('ie-mods-list');
  const empty = document.getElementById('ie-mods-empty');
  if (!list || !empty) return;

  if (!mods || mods.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = mods.map((m, idx) => `
    <div class="mod-row" data-idx="${idx}">
      <select class="mod-stat" value="${m.stat}">
        <option value="hp" ${m.stat === 'hp' ? 'selected' : ''}>HP</option>
        <option value="atk" ${m.stat === 'atk' ? 'selected' : ''}>ATK</option>
        <option value="def" ${m.stat === 'def' ? 'selected' : ''}>DEF</option>
        <option value="mag" ${m.stat === 'mag' ? 'selected' : ''}>MAG</option>
        <option value="spd" ${m.stat === 'spd' ? 'selected' : ''}>SPD</option>
        <option value="iq" ${m.stat === 'iq' ? 'selected' : ''}>IQ</option>
        <option value="heal_pow" ${m.stat === 'heal_pow' ? 'selected' : ''}>HEALING POW (%)</option>
        <option value="crit_rate" ${m.stat === 'crit_rate' ? 'selected' : ''}>CRIT CHANCE (%)</option>
        <option value="crit_dmg" ${m.stat === 'crit_dmg' ? 'selected' : ''}>CRIT DMG (%)</option>
        <option value="status_res" ${m.stat === 'status_res' ? 'selected' : ''}>STATUS RES (%)</option>
        <option value="dexterity" ${m.stat === 'dexterity' ? 'selected' : ''}>DEXTERITY (%)</option>
        <option value="resilience" ${m.stat === 'resilience' ? 'selected' : ''}>RESILIENCE (%)</option>
        <option value="true_dmg" ${m.stat === 'true_dmg' ? 'selected' : ''}>TRUE DAMAGE (%)</option>
        <option value="lifesteal" ${m.stat === 'lifesteal' ? 'selected' : ''}>LIFESTEAL (%)</option>
        <option value="cooldown_red" ${m.stat === 'cooldown_red' ? 'selected' : ''}>COOLDOWN RED. (%)</option>
        <option value="sanity" ${m.stat === 'sanity' ? 'selected' : ''}>SANITY</option>
      </select>
      <select class="mod-op" value="${m.op}">
        <option value="add" ${m.op === 'add' ? 'selected' : ''}>Add (+)</option>
        <option value="sub" ${m.op === 'sub' ? 'selected' : ''}>Subtract (-)</option>
        <option value="mul" ${m.op === 'mul' ? 'selected' : ''}>Multiply (x)</option>
        <option value="div" ${m.op === 'div' ? 'selected' : ''}>Divide (/)</option>
      </select>
      <input type="number" step="0.1" class="mod-val" value="${m.value}">
      <button class="btn sm danger" onclick="removeModRow(${idx})">✕</button>
    </div>
  `).join('');
}

function getModsFromUI() {
  const rows = Array.from(document.querySelectorAll('#ie-mods-list .mod-row'));
  return rows.map(r => ({
    stat: r.querySelector('.mod-stat').value,
    op: r.querySelector('.mod-op').value,
    value: parseFloat(r.querySelector('.mod-val').value) || 0
  }));
}

function addModRow() {
  const mods = getModsFromUI();
  mods.push({ stat: 'atk', op: 'add', value: 10 });
  renderModRows(mods);
}

function removeModRow(idx) {
  const mods = getModsFromUI();
  mods.splice(idx, 1);
  renderModRows(mods);
}

// ── Passives ─────────────────────────────────────────────────
function renderPassiveRows(passives) {
  const list  = document.getElementById('ie-passives-list');
  const empty = document.getElementById('ie-passives-empty');
  if (!list) return;
  list.innerHTML = passives.map((p, idx) => {
    const safe = p.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return `<div class="passive-row">
      <input type="text" class="passive-input" value="${safe}"
             placeholder="e.g. This sword makes u very big" maxlength="140">
      <button class="btn sm danger" onclick="removePassiveRow(${idx})">✕</button>
    </div>`;
  }).join('');
  if (empty) empty.style.display = passives.length === 0 ? '' : 'none';
}

function getPassivesFromUI() {
  return Array.from(document.querySelectorAll('#ie-passives-list .passive-input'))
    .map(i => i.value.trim()).filter(Boolean);
}

function addPassiveRow() {
  const passives = getPassivesFromUI();
  passives.push('');
  renderPassiveRows(passives);
  const inputs = document.querySelectorAll('#ie-passives-list .passive-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function removePassiveRow(idx) {
  const passives = getPassivesFromUI();
  passives.splice(idx, 1);
  renderPassiveRows(passives);
}

function openItemEditor(charId, itemId) {
  if (!charId) return;
  const c = characters.find(x => x.id === charId);
  if (!c) return;

  editingItemId = itemId || null;
  const item = itemId ? c.inventory.find(i => i.id === itemId) : null;

  document.getElementById('ie-title').textContent = item ? 'EDIT ITEM' : 'NEW ITEM';
  document.getElementById('ie-name').value = item ? (item.name || '') : '';
  document.getElementById('ie-desc').value = item ? (item.desc || '') : '';

  currentItemIcon = item ? (item.icon || 'sword') : 'sword';
  currentItemIconImage = item ? (item.iconImage || null) : null;

  document.getElementById('ie-img-upload').value = '';
  document.getElementById('ie-selected-icon-name').textContent = currentItemIconImage ? 'CUSTOM UPLOAD' : currentItemIcon.toUpperCase();

  buildIconPicker();
  renderModRows(item ? (item.mods || []) : []);
  renderPassiveRows(item ? (item.passives || []) : []);

  document.getElementById('item-editor-overlay').classList.add('open');
}

function closeItemEditor() {
  document.getElementById('item-editor-overlay').classList.remove('open');
  editingItemId = null;
}

function saveItem() {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;

  const name = document.getElementById('ie-name').value.trim();
  if (!name) { notify('Item needs a name!', 'err'); return; }

  const item = {
    id: editingItemId || genId(),
    name: name,
    desc: document.getElementById('ie-desc').value.trim(),
    icon: currentItemIcon,
    iconImage: currentItemIconImage,
    mods: getModsFromUI(),
    passives: getPassivesFromUI(),
    equipped: false
  };

  if (!c.inventory) c.inventory = [];

  if (editingItemId) {
    const idx = c.inventory.findIndex(i => i.id === editingItemId);
    if (idx >= 0) {
      item.equipped = c.inventory[idx].equipped;
      c.inventory[idx] = item;
    }
  } else {
    c.inventory.push(item);
  }

  saveData(c);
  playSound('save');
  closeItemEditor();
  viewChar(currentId);
  notify('ITEM SAVED', 'ok');
}

// STAT CHECKER
const CHECKER_STATS = {
  hp: { base: 100, add: 0, mult: 1, div: 1, max: 1250 },
  atk: { base: 10, add: 0, mult: 1, div: 1, max: 300 },
  def: { base: 10, add: 0, mult: 1, div: 1, max: 300 },
  mag: { base: 10, add: 0, mult: 1, div: 1, max: 300 },
  spd: { base: 10, add: 0, mult: 1, div: 1, max: 300 }
};

function buildStatChecker() {
  const wrap = document.getElementById('stat-checker-rows');
  if (!wrap) return;
  wrap.innerHTML = '';

  ['hp', 'atk', 'def', 'mag', 'spd'].forEach(key => {
    const s = CHECKER_STATS[key];
    const row = document.createElement('div');
    row.className = 'stat-checker-row';
    row.innerHTML = `
      <div class="field">
        <label>${key.toUpperCase()} BASE: <span id="u-${key}-base-val">${s.base}</span></label>
        <input type="range" min="1" max="${s.max}" value="${s.base}" oninput="updateCheckerBase('${key}', this.value)"/>
        <div class="stat-segs mt-8" id="u-${key}-base-segs"></div>
      </div>
      
      <div class="checker-math-grid">
        <div class="field">
          <label>ADD (+)</label>
          <input type="number" value="${s.add}" oninput="updateCheckerMath('${key}', 'add', this.value)"/>
        </div>
        <div class="field">
          <label>MULT (x)</label>
          <input type="number" step="0.1" value="${s.mult}" oninput="updateCheckerMath('${key}', 'mult', this.value)"/>
        </div>
        <div class="field">
          <label>DIV (/)</label>
          <input type="number" step="0.1" value="${s.div}" oninput="updateCheckerMath('${key}', 'div', this.value)"/>
        </div>
      </div>
      
      <div>
        <span class="result-segs-label">MODIFIED RESULT: <span id="u-${key}-res-val" style="color:#fff"></span></span>
        <div class="stat-segs mt-4" id="u-${key}-res-segs"></div>
      </div>
    `;
    wrap.appendChild(row);
    renderCheckerBars(key);
  });

  // Append substat wrapper
  const subWrap = document.createElement('div');
  subWrap.id = 'stat-checker-substats';
  wrap.appendChild(subWrap);
  updateCheckerSubstats();
}

function updateCheckerBase(key, val) {
  CHECKER_STATS[key].base = +val;
  const disp = document.getElementById(`u-${key}-base-val`);
  if (disp) disp.textContent = val;
  renderCheckerBars(key);
}

function updateCheckerMath(key, part, val) {
  CHECKER_STATS[key][part] = parseFloat(val) || 0;
  renderCheckerBars(key);
}

function renderCheckerBars(key) {
  const s = CHECKER_STATS[key];
  const final = Math.max(0, (s.base + s.add) * s.mult / (s.div || 1));
  const resValEl = document.getElementById(`u-${key}-res-val`);
  if (resValEl) resValEl.textContent = Math.round(final);

  renderCheckerSegment(key, s.base, `u-${key}-base-segs`, true);
  renderCheckerSegment(key, final, `u-${key}-res-segs`, false);

  if (typeof updateCheckerSubstats === 'function') updateCheckerSubstats();
}

function updateCheckerSubstats() {
  const getFinal = (key) => {
    const s = CHECKER_STATS[key];
    if (!s) return 0;
    return Math.max(0, Math.round((s.base + s.add) * s.mult / (s.div || 1)));
  };

  const effHp = getFinal('hp');
  const effAtk = getFinal('atk');
  const effDef = getFinal('def');
  const effMag = getFinal('mag');
  const effSpd = getFinal('spd');

  let rawCritRate = Math.min((effAtk / 20) * 0.3, 80);
  let rawStatusRes = Math.min((effDef / 20) * 1, 50);
  let baseHealPow = ((effMag / 15) * 5);
  let baseDex = ((effSpd / 10) * 0.5);
  let baseResilience = Math.min(((effHp / 100) * 0.2), 50);
  let finalCritDmg = ((effAtk / 50) * 1) + (rawCritRate * 0.1);
  let baseTrueDmg = ((effHp / 300) * 1);
  let baseLifesteal = ((effDef / 100) * 1);
  let rawCooldownRed = Math.min(((effSpd / 20) * 1), 40);

  const el = document.getElementById('stat-checker-substats');
  if (!el) return;

  const critFromAtk = (effAtk / 50) * 1;
  const critFromRate = rawCritRate * 0.1;

  el.innerHTML = `
    <div style="margin-top: 24px; padding: 16px; background: rgba(0,0,0,0.4); border-top: 1px solid #333;">
      <div style="font-size: 10px; color: var(--accent-yellow); margin-bottom: 12px; letter-spacing: 2px;">DERIVED SUBSTATS</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 8px; letter-spacing: 1px;">
        <div style="border-bottom: 1px solid #222; padding-bottom: 4px; cursor: help;" 
             data-tooltip="ATK Scaling: +${rawCritRate.toFixed(1)}% (from ${effAtk} ATK). Max 80%.">
          <span style="color:#aaa">CRIT CHANCE:</span> <span style="color:#fff">${rawCritRate.toFixed(1)}%</span>
        </div>
        <div style="border-bottom: 1px solid #222; padding-bottom: 4px; cursor: help;" 
             data-tooltip="ATK Scaling: +${critFromAtk.toFixed(1)}% | Crit Rate Bonus: +${critFromRate.toFixed(1)}%.">
          <span style="color:#aaa">CRIT DMG:</span> <span style="color:#fff">${finalCritDmg.toFixed(1)}%</span>
        </div>
        <div style="border-bottom: 1px solid #222; padding-bottom: 4px; cursor: help;" 
             data-tooltip="MAG Scaling: +${baseHealPow.toFixed(1)} (from ${effMag} MAG).">
          <span style="color:#aaa">HEAL POWER:</span> <span style="color:#fff">+${baseHealPow.toFixed(1)}</span>
        </div>
        <div style="border-bottom: 1px solid #222; padding-bottom: 4px; cursor: help;" 
             data-tooltip="DEF Scaling: +${rawStatusRes.toFixed(1)}% (from ${effDef} DEF). Max 50%.">
          <span style="color:#aaa">STATUS RES:</span> <span style="color:#fff">${rawStatusRes.toFixed(1)}%</span>
        </div>
        <div style="border-bottom: 1px solid #222; padding-bottom: 4px; cursor: help;" 
             data-tooltip="SPD Scaling: +${baseDex.toFixed(1)}% (from ${effSpd} SPD).">
          <span style="color:#aaa">DEXTERITY:</span> <span style="color:#fff">${baseDex.toFixed(1)}%</span>
        </div>
        <div style="border-bottom: 1px solid #222; padding-bottom: 4px; cursor: help;" 
             data-tooltip="HP Scaling: +${baseResilience.toFixed(1)}% (from ${effHp} HP). Max 50%.">
          <span style="color:#aaa">RESILIENCE:</span> <span style="color:#fff">${baseResilience.toFixed(1)}%</span>
        </div>
        <div style="border-bottom: 1px solid #222; padding-bottom: 4px; cursor: help;" 
             data-tooltip="HP Scaling: +${baseTrueDmg.toFixed(1)}% (from ${effHp} HP).">
          <span style="color:#aaa">TRUE DAMAGE:</span> <span style="color:#fff">${baseTrueDmg.toFixed(1)}%</span>
        </div>
        <div style="border-bottom: 1px solid #222; padding-bottom: 4px; cursor: help;" 
             data-tooltip="DEF Scaling: +${baseLifesteal.toFixed(1)}% (from ${effDef} DEF).">
          <span style="color:#aaa">LIFESTEAL:</span> <span style="color:#fff">${baseLifesteal.toFixed(1)}%</span>
        </div>
        <div style="border-bottom: 1px solid #222; padding-bottom: 4px; cursor: help;" 
             data-tooltip="SPD Scaling: +${rawCooldownRed.toFixed(1)}% (from ${effSpd} SPD). Max 40%.">
          <span style="color:#aaa">COOLDOWN RED.:</span> <span style="color:#fff">${rawCooldownRed.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  `;
}

function renderCheckerSegment(key, val, containerId, isBase) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const baseMax = STAT_BASE_MAX[key] || 100;
  const tier = Math.floor((val - 1) / baseMax);
  const valInTier = ((val - 1) % baseMax) + 1;
  const pct = valInTier / baseMax * 100;
  const filled = Math.round(Math.max(0, Math.min(100, pct)) / 100 * SEG_COUNT);

  if (wrap.children.length !== SEG_COUNT) {
    wrap.innerHTML = Array.from({ length: SEG_COUNT }, (_, i) => `<div class="stat-seg ${key}" style="--i: ${i}"></div>`).join('');
  }

  for (let i = 0; i < SEG_COUNT; i++) {
    const seg = wrap.children[i];
    const isPeak = (i === filled - 1) && filled > 0;
    const isOn = i < filled;
    seg.className = `stat-seg ${key}`;
    if (isBase) seg.style.opacity = '0.3'; else seg.style.opacity = '1';

    if (tier <= 0) {
      if (isOn) seg.classList.add(isPeak ? 'peak' : 'on');
    } else {
      if (isOn) {
        seg.classList.add(isPeak ? 'peak' : 'on', `tier-${Math.min(tier, 25)}`);
      } else {
        seg.classList.add('on');
        if (tier > 0) {
          seg.classList.add('ghost');
          if (tier > 1) seg.classList.add(`tier-${Math.min(tier - 1, 25)}`);
        }
      }
    }
  }
}

// Auto-init checker if element exists
if (document.getElementById('stat-checker-rows')) {
  buildStatChecker();
}

// ============================================================
// ============================================================
// HOW TO ADD A NEW TRAIT
// ============================================================
//
// Quick template — paste inside the TRAITS object and fill in the fields:
//
//   traitKey: {
//     name: 'Display Name',    // text shown on the trait chip in the UI
//     rarity: 'common',        // controls chip color — see RARITIES below
//     desc: 'What it does.',   // short description shown on the chip / hover
//     passive: [],             // stat modifiers — always include, even if empty
//
//     // ── optional fields ──
//     notes: 'DM note.',       // extra note shown in the stat panel (no UI chip)
//     situational: [...],      // in-fight toggle buttons — see SITUATIONAL below
//     cultivation: {...},      // permanent stackable counter — see CULTIVATION
//     heavenly:   {...},       // duality traits only — heavenly form data
//     hellforged: {...},       // duality traits only — hellforged form data
//   },
//
// ── RARITIES ─────────────────────────────────────────────────────────────────
//   'common'     gray chip
//   'rare'       blue chip
//   'epic'       light purple chip
//   'legendary'  yellow / gold chip
//   'mythic'     orange / red gradient chip
//   'hexxed'     dark purple / black chip  (almost never rolled normally)
//   'duality'    split chip — requires both heavenly:{} and hellforged:{} blocks
//   'determined' special evolving heartbeat chip
//
// ── PASSIVE FORMAT ────────────────────────────────────────────────────────────
//   passive: [{ stat: 'atk', op: 'pct', value: 20 }]
//
//   op:
//     'add'  flat addition     (use for substats and flat HP/ATK/etc. numbers)
//     'pct'  % boost on a main stat   (+20% ATK → op:'pct', value:20)
//     'mul'  total multiplier         (x2 ATK → op:'mul', value:2)
//
//   main stat keys:
//     'hp'  'atk'  'def'  'mag'  'spd'
//     'all_main'   (targets HP + ATK + DEF + MAG + SPD together)
//
//   substat keys  (always use op:'add' for these):
//     'crit_rate'    'crit_dmg'     'lifesteal'    'heal_pow'
//     'true_dmg'     'cooldown_red' 'dexterity'    'resilience'
//     'status_res'   'all_sub'      (targets every substat at once)
//
//   derived passive — scales from another stat:
//     { op:'derived', stat:'atk', from:'hp', per:50, perValue:1, cap:200 }
//     → +1 ATK for every 50 HP, capped at +200 ATK.
//     Use perPct instead of perValue for percentage scaling.
//     cap is optional.
//
// ── SITUATIONAL (in-fight toggle buttons) ─────────────────────────────────────
//   situational: [
//     {
//       id:      'unique-key',           // MUST be unique across ALL traits
//       label:   'Button label',         // text on the toggle button
//       desc:    'Optional tooltip.',    // optional — shows on hover
//       passive: [{ stat:'atk', op:'pct', value:20 }],
//     },
//   ]
//   Multiple situational entries = multiple independent toggle buttons.
//
// ── CULTIVATION (permanent stackable counter) ─────────────────────────────────
//   cultivation: {
//     label:         'Kills',            // shown next to the +/- counter
//     perStack:      [{ stat:'crit_rate', op:'add', value:1 }],
//                    // passive array applied PER STACK (or a single object)
//     defaultStacks: 0,                  // stacks shown in UI on load
//     maxStacks:     500,                // UI enforces this cap
//   }
//
// ── DUALITY FORMAT ────────────────────────────────────────────────────────────
//   rarity: 'duality',
//   name: 'Default Name',  desc: 'Pre-choice description.',  passive: [...],
//   heavenly:   { name: 'Heavenly Name',   desc: '...', passive: [...] },
//   hellforged: { name: 'Hellforged Name', desc: '...', passive: [...] },
//   // situational: [...] is optional and shared between both sides
//
// ── NOTES ─────────────────────────────────────────────────────────────────────
//   notes:  shown in small text below the stat panel — use for DM rulings,
//           per-hit or per-kill mechanics, things that don't have a direct
//           stat value, or anything that needs a longer explanation.
//
// ============================================================


// ── TRAITS & SHIMMYFUL data now in traits.js (shared with encyclopedia) ──


// ============================================================
// TRAIT ROLES — used by the codex to group traits within each rarity
// Values: 'dps' | 'tank' | 'assassin' | 'support' | 'scaling' | 'utility'
// ============================================================
const TRAIT_ROLES = {
  // COMMON
  favored: 'dps', spicy: 'tank', sonic: 'assassin', flaming: 'dps',
  enchanted: 'support', steadfast: 'dps', bombastic: 'utility',
  counterfeit: 'utility', sticky: 'utility', tough: 'tank', hearty: 'tank',
  keen: 'dps', scholarly: 'support', lightfooted: 'assassin',
  regenerative: 'support', reckless: 'dps', ironclad: 'tank',
  precise: 'dps', glassjaw: 'dps', shocking: 'utility', wellfed: 'tank',
  caffeinated: 'assassin', stubborn: 'tank', nightowl: 'dps',
  headstrong: 'tank', resolute: 'tank', grounded: 'tank',
  // RARE
  assassin: 'assassin', executioner: 'dps', lethal: 'dps', toxic: 'dps',
  frostbite: 'dps', buff: 'dps', armored: 'tank', workhorse: 'support',
  shielding: 'tank', saving: 'utility', voided: 'utility', legday: 'assassin',
  shrinkray: 'utility', vital: 'tank', swiftstrike: 'assassin',
  spellweaver: 'support', lifeline: 'support', weakpoint: 'dps',
  berserker: 'dps', bulwark: 'tank', overdrive: 'dps', solo: 'scaling',
  packhunter: 'dps', laststand: 'tank', opportunist: 'dps',
  momentum: 'dps', adrenaline: 'dps', secondwind: 'tank',
  mending: 'support', fortify: 'tank', evasion: 'assassin',
  warcry: 'support', bubbly: 'utility',
  // EPIC
  economic: 'utility', pyromaniac: 'dps', prime: 'dps', overflowing: 'support',
  vampiric: 'tank', solar: 'assassin', gambler: 'dps', deferred: 'dps',
  trueT: 'dps', heavyhitter: 'dps', clothesline: 'support', dawn: 'tank',
  warmup: 'utility', colossus: 'tank', archmage: 'support', phantom: 'assassin',
  juggernaut: 'tank', irongiant: 'tank', spellblade: 'dps', reaper: 'dps',
  onslaught: 'dps', absorbent: 'tank', mirror: 'tank', echo: 'dps',
  timebomb: 'dps', overdose: 'dps', shieldbreak: 'dps', warden: 'support',
  empower: 'support', commander: 'support', second_skin: 'tank', blitz: 'dps',
  siphon: 'dps', double_tap: 'dps', sentinel: 'tank', pressure_pt: 'dps',
  deadweight: 'dps', chain: 'dps', war_drum: 'support', overclock: 'support',
  shadowstrike: 'assassin', piles_of_bones: 'scaling', spite: 'dps',
  exposed: 'dps', vitalsiphon: 'tank', corepiercer: 'dps', desperate: 'support',
  rampage: 'dps', bounty: 'scaling', kinetic: 'assassin',
  // LEGENDARY
  godly: 'dps', rct: 'support', gluttonous: 'scaling', cultivation: 'scaling',
  cursed: 'dps', angelic: 'support', ryoiki: 'tank', celestial: 'tank',
  temporal: 'utility', spiritual: 'support', circle: 'support', bigbrain: 'tank',
  giant: 'dps', goliath: 'dps', allin: 'dps', thornwall: 'tank',
  apex_pred: 'dps', ironvow: 'scaling', soulforge: 'scaling', final_stand: 'dps',
  thousandcuts: 'dps', eternal_flame: 'tank', entropy: 'dps',
  phantom_step: 'assassin', apex_hunger: 'scaling', reapers_mark: 'dps',
  parasite: 'dps', forsaken: 'dps', twin_fangs: 'dps', condemned: 'dps',
  warpath: 'scaling', blood_frenzy: 'dps', voidborn: 'dps', martyr: 'support',
  hex_eater: 'tank', phantom_pain: 'dps', guillotine: 'dps',
  doppelganger: 'utility', sundering: 'dps', necromancer: 'utility',
  debt_collector: 'dps', black_hole: 'dps', thundergod: 'dps',
  conqueror: 'scaling', soul_link: 'support', bloodrage: 'dps',
  chrono_break: 'utility', cannibal: 'scaling', bulwark_aura: 'support',
  war_priest: 'support', vanguard: 'tank', last_rites: 'support',
  resonance: 'support', mentor: 'support', self_sacrifice: 'support',
  bodyguard: 'support', rallying_cry: 'support', hexbinder: 'utility',
  disruptor: 'support', nemesis: 'dps', lonewolf: 'scaling',
  catastrophe: 'utility', life_support: 'support', schism: 'scaling',
  find_your_spark: 'scaling',
  // MYTHIC
  adaptation: 'tank', acclrsorc: 'support', brave: 'utility', bloodlust: 'dps',
  allforyou: 'support', glasscannon: 'dps', magical: 'support', nesting: 'tank',
  lucifer: 'dps', zoe: 'support', vengeance: 'dps', raidboss: 'tank',
  honored_one: 'dps', transcendence: 'utility', world_ender: 'dps',
  paradox: 'utility', usurper: 'utility', sovereign: 'tank', void_emperor: 'utility',
  plague_bearer: 'dps', abyss_walker: 'tank', mythbreaker: 'utility',
  legacy: 'support', ultrakill: 'dps', disturbing_peace: 'scaling',
  soul_eater: 'scaling', unrelentless_hunger: 'dps',
  // HEXXED
  hx_shadow: 'assassin', hx_royal: 'dps', hx_shrink: 'utility', hx_void: 'utility',
  hx_econ: 'utility', hx_pyro: 'dps', hx_vamp: 'dps', hx_solar: 'assassin',
  hx_gamble: 'dps', hx_defer: 'dps', hx_true: 'dps', hx_heavy: 'dps',
  hx_dusk: 'tank', hx_gymbro: 'utility', hx_godly: 'dps', hx_cult: 'scaling',
  hx_cursed: 'dps', hx_angel: 'support', hx_ryoiki: 'tank', hx_temp: 'utility',
  hx_spirit: 'support', hx_giant: 'dps', hx_goliath: 'dps', hx_adapt: 'tank',
  hx_blood: 'dps', hx_glass: 'dps', hx_magic: 'support', hx_nest: 'tank',
  hx_veng: 'dps', hx_raid: 'tank', hx_sticky: 'utility', hx_spicy: 'tank',
  hx_armor: 'tank',
  // COMMON (lol)
  killingedge: 'dps', ironskin: 'tank', carnivore: 'dps', happyhour: 'support',
  energized: 'dps', manasurge: 'utility', armorshred: 'dps', gatheringspeed: 'assassin',
  poisontrail: 'dps', toughitout: 'tank', boneplating: 'tank', quickdraw: 'dps',
  battlescar: 'tank', nimble: 'assassin', arcaneedge: 'dps', triumph: 'support',
  perseverance: 'support',
  // RARE (lol)
  voracity: 'assassin', hemorrhage: 'dps', nighthunter: 'assassin', doublestrike: 'dps',
  flurry: 'dps', martialcadence: 'dps', spikedshell: 'tank', eternalhunger: 'scaling',
  fleetoffoot: 'assassin', livingvengeance: 'dps', lovetap: 'assassin', clockworkwindup: 'dps',
  voidstone: 'tank', guerrillawarfare: 'assassin', mortalwill: 'dps', triumphantroar: 'support',
  deadlyvenom: 'dps', salvation: 'support', blaze: 'dps', hailofblades: 'dps',
  // EPIC (lol)
  noxianmight: 'dps', divineascent: 'dps', pitgrit: 'tank', reignofanger: 'dps',
  deathbringstance: 'dps', arcaneburstcharge: 'dps', brittleapply: 'utility',
  fervorofbattle: 'scaling', shepherdofsouls: 'support', petricite: 'dps',
  berserkerrage: 'dps', markofthestorm: 'utility', runicblade: 'dps',
  organicdeconstruct: 'dps', sunlightmark: 'support', presstheattack: 'dps',
  whiplash: 'assassin', phaserush: 'assassin', graspundying: 'scaling',
  electrocute: 'dps', darkharvestlol: 'scaling',
  // LEGENDARY (lol)
  duelistsdance: 'dps', damnation: 'scaling', kindredmark: 'scaling',
  crimsonpact: 'scaling', mirageform: 'utility', wayofwanderer: 'dps',
  ionianfervor: 'tank', unseenpredator: 'assassin', contemptweak: 'dps',
  deathbydegrees: 'dps', wayofhunter: 'dps', darkinrebirth: 'tank',
  shatteredtime: 'utility', livingforge: 'utility', undyinggrasp: 'tank',
  // MYTHIC (lol)
  lastingspoils: 'scaling', icathiansurprise: 'dps', gloryindeath: 'dps',
  feast: 'scaling', ravonoushunger: 'scaling', bloodfeud: 'dps',
  eclipsecycle: 'assassin', voidrift: 'dps', chronorift: 'tank',
  celestialopp: 'scaling', deathmarklol: 'dps', infiniteduress: 'dps',
  // HEXXED (lol)
  blightedquill: 'dps', feastofflesh: 'scaling', fracturelol: 'dps',
  palecascade: 'dps', corruptedfervor: 'dps', crimsontide: 'dps',
  darkres: 'dps', deathscaress: 'tank',
  // DUALITY (lol)
  hunterhunted: 'scaling', daybreaknight: 'scaling',
  // SUPPORT / UTILITY (lol)
  moonstonemending: 'support',
  eyeofthestorm: 'support',
  warmhugs: 'support',
  ardentcenser: 'support',
  pixswatch: 'support',
  rewind: 'utility',
  timewarp: 'utility',
  tidecallersblessing: 'support',
  focusedresolve: 'utility',
  mikaelscleanse: 'support',
  zekesconvergence: 'support',
  whimsy: 'utility',
  powerchord: 'support',
  starcall: 'support',
  cozycampfire: 'support',
  mantra: 'support',
  equinox: 'utility',
  wildgrowth: 'support',
  wish: 'support',
  crescendo: 'support',
  monsoon: 'support',
  bailout: 'support',
  hostiletakeover: 'utility',
  tidalwave: 'utility',
  chronoshift: 'support',
  cosmicradiance: 'support',
  temperedfate: 'utility',
  attached: 'support',
  girlyopscurse: 'utility',
  gamblersruin: 'utility', envy: 'utility', deadmanshand: 'utility',
  symbiote: 'support', ouroboros: 'scaling',
  // TBoI-inspired
  oddmushroom: 'dps', spoonbender: 'dps', bloodylust: 'dps',
  holymantle: 'tank', whoreofbabylon: 'dps', missingno: 'utility',
  goathead: 'utility', sacredheart: 'scaling',
  // Gambling traits
  luckypenny: 'utility', bust: 'dps', snakeeyes: 'dps',
  jackpot: 'scaling', devilsbargain: 'dps', russianroulette: 'dps',
  // Story/thematic mythics
  thousanddoors: 'scaling', anotherandanother: 'utility', lovesick: 'support',
  godslayer: 'scaling', sentafteryou: 'dps', steelwillfix: 'scaling',
  letthestage: 'dps', wontexist: 'utility', iamgonnawin: 'scaling',
  unbroken: 'tank', themoss: 'dps', harbingerruin: 'dps', revived: 'scaling',
  // Story/thematic duality
  redemptionretribution: 'support', warandglory: 'dps',
  // Story/thematic legendary
  emotionless: 'utility', reinforcecrew: 'support', goodluckboys: 'support',
  holywar: 'support', wegotthenumbers: 'support', hailname: 'utility',
  onlyatraitor: 'dps', partypooper: 'dps', turningpoint: 'assassin',
  keepup: 'assassin', wartrivial: 'scaling', perfectsoul: 'scaling',
  lotuswaters: 'utility', reekofdisease: 'dps', megalostrikeback: 'dps',
  engarde: 'dps', killingspree: 'scaling', armyofshurima: 'support',
  ialwayscomeback: 'scaling', thefinalact: 'dps', truehero: 'scaling',
  breakunbreakable: 'dps', itwasutile: 'tank', absoluteterritory: 'dps',
  ifeelmonster: 'dps', nothereyou: 'support', woetothee: 'dps',
  paralyzer: 'dps', stillstanding: 'tank', willsurvive: 'utility',
  banquet: 'support', raciallymotivated: 'dps', jolly: 'utility',
  spooky: 'utility', anarchy: 'utility', yourearly: 'dps',
  // Story/thematic hexxed
  lavenderwaters: 'dps', killthesun: 'dps', shimmyfuloverlord: 'dps',
  replaceallemotions: 'scaling',
  // Story/thematic epic
  ascendedtogether: 'utility', overlooked: 'dps', soreloser: 'dps',
  toottoo: 'dps', tillicollapse: 'tank',
};
const ROLE_ORDER = ['dps', 'tank', 'assassin', 'support', 'scaling', 'utility'];
const ROLE_LABELS = { dps: 'DPS', tank: 'TANK', assassin: 'ASSASSIN', support: 'SUPPORT', scaling: 'SCALING', utility: 'UTILITY' };

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic', 'hexxed', 'duality', 'determined'];
const RARITY_LABEL = { common: 'COMMON', rare: 'RARE', epic: 'EPIC', legendary: 'LEGENDARY', mythic: 'MYTHIC', hexxed: 'HEXXED', duality: 'DUALITY', determined: 'DETERMINED' };
const RARITY_WEIGHTS = { common: 60, rare: 30, epic: 18.4, legendary: 1.5, mythic: 0.13, hexxed: 0.02, duality: 0.01, determined: 0.005 };
const PITY_WEIGHTS = { common: 0, rare: 0, epic: 0, legendary: 68.9, mythic: 25, hexxed: 1, duality: 5, determined: 0.1 };


// ── SHIMMYFUL data now in traits.js ──


function isShimmyful(c, key) {
  return !!(c.shimmyfulTraits && c.shimmyfulTraits.includes(key));
}

// Returns the shimmyful definition for a key (picks correct table by rarity)
function getShimmyfulDef(key) {
  const rarity = TRAITS[key]?.rarity;
  if (rarity === 'legendary') return SHIMMYFUL_LEGENDARY_TRAITS[key];
  if (rarity === 'mythic') return SHIMMYFUL_MYTHIC_TRAITS[key];
  if (rarity === 'epic') return SHIMMYFUL_EPIC_TRAITS[key];
  if (rarity === 'rare') return SHIMMYFUL_RARE_TRAITS[key];
  return SHIMMYFUL_TRAITS[key];
}

// Returns the best display/passive definition for a character's trait
function getTraitDef(c, key) {
  if (isShimmyful(c, key)) {
    const sd = getShimmyfulDef(key);
    if (sd) return sd;
  }
  return TRAITS[key];
}

function rollRarity(weights) {
  const w = weights || RARITY_WEIGHTS;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, wt] of Object.entries(w)) {
    if (r < wt) return k;
    r -= wt;
  }
  return Object.keys(w).find(k => w[k] > 0) || 'common';
}

// ── Status-effect colouring helpers ────────────────────────────
function _escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _applyCharName(text, c) {
  return (text || '').replace(/\[NAME\]/g, (c && c.name) ? c.name : '?');
}
function _renderDescWithStatuses(rawDesc) {
  if (!rawDesc) return '';
  const statusNames = Object.keys(_encStatusMap).sort((a, b) => b.length - a.length);
  if (!statusNames.length) return _escHtml(rawDesc);
  const parts = statusNames.map(n => '\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
  const combined = new RegExp('(' + parts.join('|') + ')', 'gi');
  let result = '', lastIndex = 0, match;
  combined.lastIndex = 0;
  while ((match = combined.exec(rawDesc)) !== null) {
    result += _escHtml(rawDesc.slice(lastIndex, match.index));
    const nameKey = Object.keys(_encStatusMap).find(k => k === match[0].toUpperCase());
    if (nameKey) {
      const info = _encStatusMap[nameKey];
      const color = info.color || '#ffdd00';
      const tipDesc = _escHtml(info.desc || '');
      result += `<span class="status-pill" style="color:${color};cursor:pointer;text-decoration:underline dotted;" data-sdesc="${tipDesc}">${_escHtml(match[0])}</span>`;
    } else {
      result += _escHtml(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }
  result += _escHtml(rawDesc.slice(lastIndex));
  return result;
}
// ───────────────────────────────────────────────────────────────

function rollOneTrait(rarityOverride, weights) {
  const rarity = rarityOverride || rollRarity(weights);
  const pool = Object.entries(TRAITS).filter(([k, t]) => t.rarity === rarity);
  if (!pool.length) return rollOneTrait('common');
  // Small unseen bias: unseen traits get ~1.5x weight
  const UNSEEN_MULT = 1.5;
  const weighted = [];
  pool.forEach(([k]) => {
    const w = seenTraits.includes(k) ? 1 : UNSEEN_MULT;
    weighted.push({ key: k, w });
  });
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const { key, w } of weighted) {
    if (r < w) return key;
    r -= w;
  }
  return weighted[weighted.length - 1].key;
}

function rollHand(isPityRoll) {
  const weights = isPityRoll ? PITY_WEIGHTS : null;
  const seen = new Set();
  const hand = [];
  let tries = 0;
  while (hand.length < 3 && tries < 50) {
    const k = rollOneTrait(null, weights);
    if (!seen.has(k)) {
      seen.add(k);
      const _r = TRAITS[k]?.rarity;
      const shimmyful = (_r === 'common' && Math.random() < 0.01) || (_r === 'legendary' && Math.random() < 0.05) || (_r === 'mythic' && Math.random() < 0.10) || (_r === 'rare' && Math.random() < 0.01) || (_r === 'epic' && Math.random() < 0.01);
      hand.push({ key: k, shimmyful });
    }
    tries++;
  }
  return hand;
}

// ============================================================
// GOLD / TREASURY
// ============================================================
function formatGold(n) {
  const v = Math.round(n);
  return (v < 0 ? '-' : '') + Math.abs(v).toLocaleString();
}

function updateGoldDisplay(c) {
  const amtEl = document.getElementById('cv-gold-amount');
  if (!amtEl) return;
  const gold = c.gold || 0;
  amtEl.textContent = formatGold(gold);
  amtEl.style.color = gold < 0 ? '#ff4444' : '';
}

function openGoldManager() {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.gold = c.gold || 0;
  c.goldHistory = c.goldHistory || [];
  renderGoldManager(c);
  document.getElementById('gold-overlay').classList.add('open');
  document.getElementById('gold-modal').classList.add('open');
}

function closeGoldManager() {
  document.getElementById('gold-overlay').classList.remove('open');
  document.getElementById('gold-modal').classList.remove('open');
}

function transactGold(direction) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const raw = parseFloat(document.getElementById('gold-input').value);
  if (isNaN(raw) || raw <= 0) { notify('ENTER A VALID AMOUNT', 'err'); return; }
  const amount = Math.floor(raw);
  const note = document.getElementById('gold-note').value.trim();

  const current = c.gold || 0;
  c.gold = current + direction * amount;
  c.goldHistory = c.goldHistory || [];
  c.goldHistory.unshift({
    amount: direction * amount,
    note: note || (direction > 0 ? 'Added' : 'Removed'),
    ts: Date.now(),
    balance: c.gold
  });
  if (c.goldHistory.length > 200) c.goldHistory.length = 200;

  saveData(c);
  playSound('save', { rate: direction > 0 ? 1.1 : 0.9, volume: 0.8 });
  renderGoldManager(c);
  updateGoldDisplay(c);
  document.getElementById('gold-input').value = '';
  document.getElementById('gold-note').value = '';
}

function renderGoldManager(c) {
  const gold = c.gold || 0;
  const balEl = document.getElementById('gold-balance-amount');
  balEl.textContent = formatGold(gold) + ' G';
  balEl.style.color = gold < 0 ? '#ff4444' : '';
  const list = document.getElementById('gold-history-list');
  const history = c.goldHistory || [];
  if (!history.length) {
    list.innerHTML = '<div class="gold-no-history">NO TRANSACTIONS YET</div>';
    return;
  }
  list.innerHTML = history.map(tx => {
    const sign = tx.amount >= 0 ? '+' : '-';
    const cls = tx.amount >= 0 ? 'pos' : 'neg';
    const d = new Date(tx.ts);
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="gold-tx ${cls}">
        <div class="gold-tx-amount ${cls}">${sign}${formatGold(tx.amount)} G</div>
        <div class="gold-tx-note">${tx.note}</div>
        <div class="gold-tx-meta">${date} ${time}<br>${formatGold(tx.balance)} G bal.</div>
      </div>`;
  }).join('');
}

// ============================================================
// PITY SYSTEM
// ============================================================
let traitPity = 0;

function loadPity() {
  const c = characters.find(x => x.id === currentId);
  traitPity = c ? Math.max(0, Math.min(100, c.pity || 0)) : 0;
}
function savePity() {
  const c = characters.find(x => x.id === currentId);
  if (c) { c.pity = traitPity; saveData(c); }
}

function updatePityDisplay() {
  const countEl = document.getElementById('pity-count');
  const fillEl = document.getElementById('pity-fill');
  if (!countEl) return;
  countEl.textContent = traitPity;
  countEl.style.color = traitPity >= 100 ? '#ffe14a' : traitPity >= 75 ? '#c98bff' : '#888';
  if (fillEl) {
    fillEl.style.width = Math.min(traitPity, 100) + '%';
    fillEl.classList.toggle('at-max', traitPity >= 100);
  }
}

// ============================================================
// TRAIT EFFECT APPLICATION (extends getEffectiveStats)
// ============================================================
function getActiveTraits(c) {
  return (c.traits || []).map(key => ({ key, def: TRAITS[key] })).filter(x => x.def);
}

function buildTraitPassives(c) {
  // Returns a flat array of passive entries that are CURRENTLY active.
  const out = [];
  const triggers = c.traitTriggers || {};
  const stacks = c.traitStacks || {};
  getActiveTraits(c).forEach(({ key, def }) => {
    // DUALITY — use heavenly or hellforged passive set based on current state
    if (def.rarity === 'duality') {
      const state = (c.dualityState || {})[key] || 'heavenly';
      const sd = def[state] || def;
      (sd.passive || []).forEach(p => out.push({ ...p, _src: key }));
      // Also process situational passives for duality traits!
      (sd.situational || def.situational || []).forEach(sit => {
        const isHeavenlySit = sit.label.startsWith('HEAVENLY');
        const isHellforgedSit = sit.label.startsWith('HELLFORGED');

        if (state === 'heavenly' && isHellforgedSit) return;
        if (state === 'hellforged' && isHeavenlySit) return;

        if (triggers[key + ':' + sit.id]) {
          (sit.passive || []).forEach(p => out.push({ ...p, _src: key + ':' + sit.id }));
        }
      });
      return;
    }
    // DETERMINATION — MERCYFUL grants stat passives; check forced state override first
    if (key === 'determination') {
      const forced = (stacks['determination:state'] || '');
      const kills_ = (stacks['determination:kills'] || 0);
      const spares_ = (stacks['determination:spares'] || 0);
      const deaths_ = (stacks['determination:deaths'] || 0);
      const detState = forced || (kills_ >= 10 ? 'hatred' : spares_ >= 10 ? 'mercyful' : 'determined');
      if (detState === 'mercyful') {
        out.push({ stat: 'heal_pow', op: 'pct', value: 900, _src: key });
        out.push({ stat: 'def', op: 'pct', value: 900, _src: key });
      } else if (detState === 'determined') {
        if (kills_ > 0) {
          out.push({ stat: 'all_main', op: 'mul', value: Math.min(10, Math.pow(1.5, kills_)), _src: key });
        }
        if (spares_ > 0) {
          out.push({ stat: 'heal_pow', op: 'add', value: 5 * spares_, _src: key });
          out.push({ stat: 'def', op: 'pct', value: 5 * spares_, _src: key });
        }
        if (deaths_ > 0) {
          out.push({ stat: 'all_main', op: 'mul', value: Math.pow(0.99, deaths_), _src: key });
        }
      }
      return;
    }
    // MISSING NO. — apply stored random stat multipliers
    if (key === 'missingno') {
      const rolls = c.missingNoRolls;
      if (rolls) {
        ['hp', 'atk', 'def', 'mag', 'spd'].forEach(s => {
          if (rolls[s] != null) out.push({ stat: s, op: 'mul', value: rolls[s], _src: key });
        });
      }
      return;
    }
    // AT THOUSAND DOORS — apply compounded permanent stat multipliers
    if (key === 'thousanddoors') {
      const accum = c.thousandDoorsAccum;
      if (accum) {
        Object.entries(accum).forEach(([s, v]) => {
          if (v != null && v !== 1) out.push({ stat: s, op: 'mul', value: v, _src: key });
        });
      }
      return;
    }
    // ANOTHER, AND ANOTHER — apply stored randomized stats (rerolled on button press)
    if (key === 'anotherandanother') {
      const drunk = c.drunkStats;
      if (drunk) {
        if (drunk.atk != null) out.push({ stat: 'atk', op: 'mul', value: drunk.atk, _src: key });
        if (drunk.mag != null) out.push({ stat: 'mag', op: 'mul', value: drunk.mag, _src: key });
        if (drunk.def != null) out.push({ stat: 'def', op: 'mul', value: drunk.def, _src: key });
        if (drunk.hp != null) out.push({ stat: 'hp', op: 'mul', value: drunk.hp, _src: key });
      }
      // still fall through to pick up the 15-drink situational button
    }
    // I WANT A PERFECT SOUL — apply absorbed soul stats as flat additions
    if (key === 'perfectsoul') {
      const data = c.perfectSoulData;
      if (data && data.souls && data.souls.length) {
        const totals = { hp: 0, atk: 0, def: 0, mag: 0, spd: 0 };
        data.souls.forEach(soul => {
          const s = soul.stats || {};
          Object.keys(totals).forEach(k => { totals[k] += (s[k] || 0); });
        });
        Object.entries(totals).forEach(([stat, val]) => {
          if (val > 0) out.push({ stat, op: 'add', value: Math.round(val), _src: key });
        });
      }
      return;
    }
    // Use shimmyful passive overrides if applicable (works for both common and legendary shimmy)
    const _shimDef = isShimmyful(c, key) ? getShimmyfulDef(key) : null;
    const activeDef = _shimDef || def;
    (activeDef.passive || []).forEach(p => out.push({ ...p, _src: key }));
    (activeDef.situational || def.situational || []).forEach(sit => {
      if (triggers[key + ':' + sit.id]) {
        (sit.passive || []).forEach(p => out.push({ ...p, _src: key + ':' + sit.id }));
      }
    });
    if (def.cultivation) {
      const n = stacks[key] != null ? stacks[key] : (def.cultivation.defaultStacks || 0);
      if (n > 0) {
        const perArr = Array.isArray(def.cultivation.perStack)
          ? def.cultivation.perStack
          : (def.cultivation.perStack ? [def.cultivation.perStack] : []);
        perArr.forEach(per => {
          out.push({ ...per, value: per.value * n, _src: key + ':cult' });
        });
      }
    }
  });
  return out;
}

function applyMainStatPassive(stat, p, addMap, pctMap, mulMap, baseSnapshot, derivedAdd) {
  if (p.op === 'add') addMap[stat] = (addMap[stat] || 0) + p.value;
  else if (p.op === 'pct') pctMap[stat] = (pctMap[stat] || 0) + p.value;
  else if (p.op === 'mul') mulMap[stat] = (mulMap[stat] || 1) * p.value;
}

// Patch existing getEffectiveStats: inject trait passives as synthetic item
// mods so derived substat scaling (e.g. heal_pow from MAG) inherits trait boosts.
const _origGetEffectiveStats = getEffectiveStats;
const MAIN_STATS = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'];
const SUB_STATS = ['heal_pow', 'crit_rate', 'crit_dmg', 'status_res', 'dexterity', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'];

function _traitPassivesToMods(passives) {
  const expanded = [];
  passives.forEach(p => {
    if (p.op === 'derived') return; // handled later
    // resilience is hard-capped at 50% inside orig; handle it in the post-pass instead.
    if (p.stat === 'resilience') return;
    const stats = p.stat === 'all_main' ? MAIN_STATS : p.stat === 'all_sub' ? SUB_STATS : [p.stat];
    stats.forEach(stat => {
      if (p.op === 'add') {
        expanded.push({ stat, op: 'add', value: p.value });
      } else if (p.op === 'pct') {
        expanded.push({ stat, op: 'mul', value: 1 + p.value / 100 });
      } else if (p.op === 'mul') {
        expanded.push({ stat, op: 'mul', value: p.value });
      }
    });
  });
  return expanded;
}

getEffectiveStats = function (c) {
  if (!c.traits || !c.traits.length) return _origGetEffectiveStats(c);

  const passives = buildTraitPassives(c);
  const traitMods = _traitPassivesToMods(passives);

  // Clone the character and add a synthetic "TRAITS" item carrying all passive mods.
  const clone = JSON.parse(JSON.stringify(c));
  clone.inventory = clone.inventory || [];
  if (traitMods.length) {
    clone.inventory.push({ id: '_traits_synth', name: '__TRAITS__', mods: traitMods, equipped: true });
  }

  let out = _origGetEffectiveStats(clone);

  // Apply derived bonuses (scale off final main stats).
  passives.filter(p => p.op === 'derived').forEach(p => {
    const fromVal = out[p.from] != null ? out[p.from] : 0;
    if (MAIN_STATS.includes(p.stat)) {
      if (p.perPct != null) {
        // perPct on a main stat = percentage multiplier (e.g. +0.6% ATK per 1 DEF)
        const pctBonus = Math.floor(fromVal / (p.per || 1)) * p.perPct;
        out[p.stat] = Math.max(1, Math.round(out[p.stat] * (1 + pctBonus / 100)));
      } else {
        let bonus = Math.floor(fromVal / (p.per || 1)) * (p.perValue || 0);
        if (p.cap) bonus = Math.min(bonus, p.cap);
        out[p.stat] = Math.max(1, Math.round(out[p.stat] + bonus));
      }
    } else if (SUB_STATS.includes(p.stat)) {
      const pct = Math.floor(fromVal / (p.per || 1)) * (p.perPct || p.perValue || 0);
      out[p.stat] = (out[p.stat] || 0) + pct;
    }
  });

  // Resilience: apply trait add/mul on top of orig (orig hard-caps at 50%, traits bypass that).
  let resAdd = 0, resMul = 1;
  passives.forEach(p => {
    if (p.stat !== 'resilience') return;
    if (p.op === 'add') resAdd += p.value;
    else if (p.op === 'pct') resAdd += p.value;
    else if (p.op === 'mul') resMul *= p.value;
  });
  if (resAdd !== 0 || resMul !== 1) {
    out.resilience = Math.min(100, (out.resilience + resAdd) * resMul);
  }

  return out;
};

// ============================================================
// RENDER TRAITS IN CHARACTER VIEW
// ============================================================
function renderTraitsDisplay(c) {
  const wrap = document.getElementById('cv-traits');
  if (!wrap) return;
  const traits = (c.traits || []);
  const cultivationBtn = document.getElementById('btn-cultivation');

  // Hide / show cultivation button
  let hasCultivation = traits.some(k => TRAITS[k]?.cultivation);
  if (cultivationBtn) cultivationBtn.style.display = hasCultivation ? '' : 'none';

  if (!traits.length) {
    wrap.innerHTML = '<div class="traits-empty">NO TRAITS</div>';
    return;
  }

  wrap.innerHTML = traits.map(key => {
    const t = TRAITS[key];
    if (!t) return '';
    const rarity = t.rarity;
    // DUALITY — heavenly/hellforged toggle chip
    if (rarity === 'duality') {
      const duState = (c.dualityState || {})[key] || 'heavenly';
      const duDef = t[duState] || t;
      const duLabel = duState === 'heavenly' ? 'HEAVENLY' : 'HELLFORGED';
      const sitButtons = renderTraitSituationals(c, key);
      return `
        <div class="trait-chip rar-duality duality-${duState}" data-trait="${key}">
          <div class="trait-chip-rarity">${duLabel}</div>
          <div class="trait-chip-name">${_escHtml(_applyCharName(duDef.name, c))}</div>
          <div class="trait-chip-desc">${_renderDescWithStatuses(_applyCharName(duDef.desc, c))}</div>
          ${sitButtons}
          <div class="duality-toggle-row">
            <button class="duality-toggle" onclick="toggleDuality('${key}',event)" title="Switch between HEAVENLY and HELLFORGED">☯</button>
          </div>
          <button class="trait-chip-remove" onclick="removeTrait('${key}', event)" title="Remove trait">✕</button>
        </div>`;
    }
    // DETERMINATION — evolving chip with state buttons + counters
    if (key === 'determination') {
      const stacks_ = c.traitStacks || {};
      const kills = stacks_['determination:kills'] || 0;
      const deaths = stacks_['determination:deaths'] || 0;
      const spares = stacks_['determination:spares'] || 0;
      const forced = stacks_['determination:state'] || '';
      // Forced state takes priority, then counter thresholds
      const state = forced || (kills >= 10 ? 'hatred' : spares >= 10 ? 'mercyful' : 'determined');
      let chipClass = 'rar-determined';
      let rarLabel = 'DETERMINED';
      let dispName = 'Determination';
      let dispDesc = t.desc;
      if (state === 'hatred') {
        chipClass += ' det-hatred'; rarLabel = 'HATRED'; dispName = 'HATRED';
        dispDesc = 'Absorb every defeated enemy: permanently add all their non-HP main stats to yours for the rest of that fight. Lose -1% HP per absorb. Revive infinitely with no stat loss.';
      } else if (state === 'mercyful') {
        chipClass += ' det-mercyful'; rarLabel = 'MERCYFUL'; dispName = 'MERCYFUL';
        dispDesc = 'Revive infinitely without losing stats. x10 Heal Power, x10 DEF. Healing received is divided by 5.';
      }
      return `
        <div class="trait-chip ${chipClass}" data-trait="${key}">
          <div class="trait-chip-rarity">${rarLabel}</div>
          <div class="trait-chip-name">${_escHtml(dispName)}</div>
          <div class="trait-chip-desc">${_renderDescWithStatuses(dispDesc)}</div>
          <div class="det-state-btns">
            <button class="btn sm det-state-btn${state === 'hatred' ? ' det-state-active' : ''}" onclick="setDeterminationState('${key}','hatred',event)">⚔ HATRED</button>
            <button class="btn sm det-state-btn${state === 'determined' ? ' det-state-active' : ''}" onclick="setDeterminationState('${key}','determined',event)">♥ RESET</button>
            <button class="btn sm det-state-btn${state === 'mercyful' ? ' det-state-active' : ''}" onclick="setDeterminationState('${key}','mercyful',event)">✦ MERCYFUL</button>
          </div>
          <div class="det-counters">
            <div class="det-counter">
              <span class="det-label">DEFEATS: ${deaths}</span>
              <button class="btn sm det-btn" onclick="adjustDetermination('${key}','deaths',1,event)">+</button>
              <button class="btn sm det-btn" onclick="adjustDetermination('${key}','deaths',-1,event)">-</button>
            </div>
            <div class="det-counter">
              <span class="det-label">KILLS: ${kills}/10</span>
              <button class="btn sm det-btn" onclick="adjustDetermination('${key}','kills',1,event)">+</button>
              <button class="btn sm det-btn" onclick="adjustDetermination('${key}','kills',-1,event)">-</button>
            </div>
            <div class="det-counter">
              <span class="det-label">SPARES: ${spares}/10</span>
              <button class="btn sm det-btn" onclick="adjustDetermination('${key}','spares',1,event)">+</button>
              <button class="btn sm det-btn" onclick="adjustDetermination('${key}','spares',-1,event)">-</button>
            </div>
          </div>
          <button class="trait-chip-remove" onclick="removeTrait('${key}', event)" title="Remove trait">✕</button>
        </div>`;
    }
    const shimmyDef = isShimmyful(c, key) ? getShimmyfulDef(key) : null;
    const isLegShimmy = shimmyDef && rarity === 'legendary';
    const isMythicShimmy = shimmyDef && rarity === 'mythic';
    const isEpicShimmy = shimmyDef && rarity === 'epic';
    const isRareShimmy = shimmyDef && rarity === 'rare';
    const displayDef = shimmyDef || t;
    const sitButtons = renderTraitSituationals(c, key);
    return `
      <div class="trait-chip rar-${rarity}${shimmyDef ? ' shimmyful' : ''}${isLegShimmy ? ' shimmy-leg' : ''}${isMythicShimmy ? ' shimmy-mythic' : ''}${isEpicShimmy ? ' shimmy-epic' : ''}${isRareShimmy ? ' shimmy-rare' : ''}" data-trait="${key}">
        ${shimmyDef ? `<div class="shimmy-star${isLegShimmy ? ' shimmy-leg-star' : ''}${isMythicShimmy ? ' shimmy-mythic-star' : ''}${isEpicShimmy ? ' shimmy-epic-star' : ''}${isRareShimmy ? ' shimmy-rare-star' : ''}">` + (isLegShimmy ? '★' : '✦') + '</div>' : ''}
        <div class="trait-chip-rarity">${RARITY_LABEL[rarity]}</div>
        <div class="trait-chip-name">${_escHtml(_applyCharName(displayDef.name, c))}</div>
        <div class="trait-chip-desc">${_renderDescWithStatuses(_applyCharName(displayDef.desc, c))}</div>
        ${sitButtons}
        <button class="trait-chip-remove" onclick="removeTrait('${key}', event)" title="Remove trait">✕</button>
      </div>`;
  }).join('');
}

function renderTraitSituationals(c, key) {
  // MISSING NO. — custom reroll button instead of normal situationals
  if (key === 'missingno') {
    const rolls = c.missingNoRolls;
    let rollDisplay = '';
    if (rolls) {
      const parts = ['hp', 'atk', 'def', 'mag', 'spd'].map(s => `${s.toUpperCase()} x${(rolls[s] ?? 1).toFixed(2)}`).join(' &nbsp; ');
      rollDisplay = `<div style="font-size:7px;color:#aaa;letter-spacing:1px;margin-bottom:4px;">${parts}</div>`;
    }
    return `<div class="trait-triggers">${rollDisplay}<button class="trait-trigger-btn" onclick="rollMissingNo(event)" data-tooltip="Randomize all stats between x0.5–x3 (x0.25–x5.5 for SHIMMYFUL). Simulates the start-of-battle chaos roll.">&#9889; REROLL STATS</button></div>`;
  }
  // GLITCH — custom reroll button
  if (key === 'glitch') {
    const rolls = c.glitchRolls;
    const shimmy = isShimmyful(c, key);
    const maxVal = shimmy ? 30 : 20;
    let rollDisplay = '';
    if (rolls) {
      const parts = ['hp', 'atk', 'def', 'mag', 'spd'].map(s => `${s.toUpperCase()} x${(rolls[s] ?? 1).toFixed(2)}`).join(' &nbsp; ');
      rollDisplay = `<div style="font-size:7px;color:#aaa;letter-spacing:1px;margin-bottom:4px;">${parts}</div>`;
    }
    return `<div class="trait-triggers">${rollDisplay}<button class="trait-trigger-btn" onclick="rollGlitch(event)" data-tooltip="Randomize all stats between x0.01–x${maxVal}. Simulates a round-start Glitch roll.">&#9889; REROLL STATS</button></div>`;
  }
  // AT THOUSAND DOORS — custom ROLL ENCOUNTER button
  if (key === 'thousanddoors') {
    const accum = c.thousandDoorsAccum || {};
    const shimmy = isShimmyful(c, key);
    let display = '';
    const TDSTATS = ['hp', 'atk', 'def', 'mag', 'spd'];
    if (Object.keys(accum).length > 0) {
      const parts = TDSTATS.map(s => {
        const v = accum[s] || 1;
        return `${s.toUpperCase()} x${v.toFixed(2)}`;
      }).join(' &nbsp; ');
      display = `<div style="font-size:7px;color:#aaa;letter-spacing:1px;margin-bottom:4px;">${parts}</div>`;
    }
    const hasAccum = Object.values(accum).some(v => v !== 1);
    const hasHistory = c.thousandDoorsHistory && c.thousandDoorsHistory.length > 0;
    const undoBtn = hasHistory ? `<button class="trait-trigger-btn" onclick="undoThousandDoors(event)" data-tooltip="Undo the last roll.">&#8592; UNDO</button>` : '';
    const resetBtn = hasAccum ? `<button class="trait-trigger-btn" onclick="resetThousandDoors(event)" data-tooltip="Reset all stat multipliers back to x1.00.">&#8635; RESET</button>` : '';
    return `<div class="trait-triggers">${display}<button class="trait-trigger-btn" onclick="rollThousandDoors(event)" data-tooltip="Roll a random stat multiplier for a random stat. Results compound and are permanent.">&#9889; ROLL ENCOUNTER</button>${undoBtn}${resetBtn}</div>`;
  }
  // ANOTHER, AND ANOTHER — custom reroll ATK/MAG and DEF/HP buttons
  if (key === 'anotherandanother') {
    const drunk = c.drunkStats || {};
    let display = '';
    if (Object.keys(drunk).length > 0) {
      const parts = ['atk', 'mag', 'def', 'hp'].map(s => {
        const v = drunk[s];
        return v != null ? `${s.toUpperCase()} x${v.toFixed(2)}` : '';
      }).filter(Boolean).join(' &nbsp; ');
      display = `<div style="font-size:7px;color:#aaa;letter-spacing:1px;margin-bottom:4px;">${parts}</div>`;
    }
    // Also show the 15-drink toggle button from situationals
    const t = getTraitDef(c, key);
    const triggers = c.traitTriggers || {};
    let sitBtns = '';
    if (t && t.situational) {
      sitBtns = t.situational.filter(sit => sit.passive && sit.passive.length > 0).map(sit => {
        const id = key + ':' + sit.id;
        const on = !!triggers[id];
        return `<button class="trait-trigger-btn ${on ? 'on' : ''}" onclick="toggleTraitTrigger('${id}', event)">&#9889; ${sit.label}${on ? ' ON' : ''}</button>`;
      }).join('');
    }
    return `<div class="trait-triggers">${display}<button class="trait-trigger-btn" onclick="rollAnotherandAnother('atkmag', event)" data-tooltip="Randomize ATK and MAG (bias toward lower values). Simulates landing a hit.">&#9889; REROLL ATK/MAG</button><button class="trait-trigger-btn" onclick="rollAnotherandAnother('defhp', event)" data-tooltip="Randomize DEF and HP (bias toward lower values). Simulates taking a hit.">&#9889; REROLL DEF/HP</button>${sitBtns}</div>`;
  }
  // I WANT A PERFECT SOUL — soul absorber
  if (key === 'perfectsoul') {
    const data = c.perfectSoulData || { souls: [], history: [] };
    const souls = data.souls || [];
    const shimmy = isShimmyful(c, key);

    // SVG icons used in buttons
    const svgBolt   = `<svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><path d="M6.5 1L2 6h3.5L4 10 9 5H5.5z"/></svg>`;
    const svgUndo   = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v3h3"/><path d="M3 5A4 4 0 1 0 5 2"/></svg>`;
    const svgReset  = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5.5A3.5 3.5 0 0 1 9 3"/><path d="M9 5.5A3.5 3.5 0 0 1 2 8"/><path d="M7 1.5l2 1.5-2 1.5"/><path d="M4 9.5L2 8l2-1.5"/></svg>`;
    const svgChevD  = `<svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 3l3.5 3 3.5-3"/></svg>`;
    const svgChevU  = `<svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 6l3.5-3 3.5 3"/></svg>`;
    const statColors = { hp: 'ps-soul-stat-hp', atk: 'ps-soul-stat-atk', def: 'ps-soul-stat-def', mag: 'ps-soul-stat-mag', spd: 'ps-soul-stat-spd' };

    // Soul list toggle button + collapsible list
    let soulList = '';
    if (souls.length > 0) {
      const chevron = _psSoulListOpen ? svgChevU : svgChevD;
      const rows = souls.map((s, i) => {
        const statSpans = ['hp','atk','def','mag','spd']
          .filter(k => s.stats && s.stats[k])
          .map(k => `<span class="${statColors[k]}">+${Math.round(s.stats[k])} ${k.toUpperCase()}</span>`)
          .join('');
        return `<div class="ps-soul-row"><span class="ps-soul-index">#${i+1}</span><span class="ps-soul-name">&#9670; ${s.name || '?'}</span><span class="ps-soul-pct">(${s.pct}%)</span><span class="ps-soul-stats">${statSpans}</span><button class="ps-soul-remove-btn" data-idx="${i}" onclick="removePerfectSoul(+this.dataset.idx, event)" data-tooltip="Remove this soul.">&#10005;</button></div>`;
      }).join('');
      const listHtml = _psSoulListOpen ? `<div class="ps-soul-list">${rows}</div>` : '';
      soulList = `<div class="ps-souls-toggle-wrap"><button class="trait-trigger-btn ps-souls-toggle-btn" onclick="togglePsSoulList(event)">SOULS ABSORBED (${souls.length}) ${chevron}</button>${listHtml}</div>`;
    }

    // Character picker header
    const sel = _psSelectedChar ? (typeof characters !== 'undefined' ? characters : []).find(x => x.name === _psSelectedChar) : null;
    let pickerHeader;
    if (sel) {
      const ts = sel.stats || {};
      pickerHeader = `<div class="ps-selected-char" onclick="togglePsPicker(event)"><span class="ps-char-dot" style="background:${sel.color||'#888'};"></span><span class="ps-sel-name">${sel.name}</span><span class="ps-sel-stats">HP ${ts.hp||0} · ATK ${ts.atk||0} · DEF ${ts.def||0} · MAG ${ts.mag||0} · SPD ${ts.spd||0}</span><button class="ps-clear-btn" onclick="clearPsChar(event)">&#10005;</button></div>`;
    } else {
      pickerHeader = `<button class="ps-select-btn" onclick="togglePsPicker(event)">+ SELECT CHARACTER &#9660;</button>`;
    }

    // Picker dropdown (when open) — use data-name + this.dataset.name to avoid quote-escaping bugs in onclick
    let pickerDropdown = '';
    if (_psPickerOpen) {
      const charRows = (typeof characters !== 'undefined' ? characters : []).map(ch => {
        const ts = ch.stats || {};
        const isSel = ch.name === _psSelectedChar;
        const safeName = (ch.name || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
        return `<div class="ps-char-row${isSel ? ' selected' : ''}" data-name="${safeName}" onclick="selectPsChar(this.dataset.name, event)"><span class="ps-char-dot" style="background:${ch.color||'#888'};"></span><span class="ps-char-name-lbl">${ch.name||'?'}</span><span class="ps-char-stats-lbl">HP ${ts.hp||0} · ATK ${ts.atk||0} · DEF ${ts.def||0} · MAG ${ts.mag||0} · SPD ${ts.spd||0}</span></div>`;
      }).join('');
      pickerDropdown = `<div class="ps-picker-dropdown"><input type="text" class="ps-search-input" placeholder="SEARCH..." oninput="filterPsPicker(this.value)" autocomplete="off"/><div class="ps-picker-list" id="ps-picker-list" onwheel="event.stopPropagation()">${charRows}</div></div>`;
    }

    const hasHistory = data.history && data.history.length > 0;
    const hasSouls = souls.length > 0;
    const rangeHint = shimmy ? '55–90%' : '40–80%';
    const undoBtn = hasHistory ? `<button class="trait-trigger-btn" onclick="undoPerfectSoul(event)" data-tooltip="Undo the last absorption.">${svgUndo} UNDO</button>` : '';
    const resetBtn = hasSouls ? `<button class="trait-trigger-btn" onclick="resetPerfectSoul(event)" data-tooltip="Remove all absorbed souls.">${svgReset} RESET</button>` : '';
    return `<div class="trait-triggers ps-panel">${soulList}<div class="ps-picker-wrap">${pickerHeader}${pickerDropdown}</div><div class="ps-action-row"><button class="trait-trigger-btn" onclick="absorbPerfectSoul(event)" data-tooltip="Roll ${rangeHint} of the selected character's stats and absorb permanently.">${svgBolt} ABSORB SOUL</button>${undoBtn}${resetBtn}</div></div>`;
  }
  const t = getTraitDef(c, key);
  if (!t || !t.situational || !t.situational.length) return '';
  const triggers = c.traitTriggers || {};
  let pool = t.situational;

  // If it's a duality trait, filter situationals based on the current duality state
  const baseDef = TRAITS[key];
  if (baseDef && baseDef.rarity === 'duality') {
    const duState = (c.dualityState || {})[key] || 'heavenly';
    if (duState === 'heavenly') {
      pool = pool.filter(sit => sit.label.startsWith('HEAVENLY'));
    } else {
      pool = pool.filter(sit => sit.label.startsWith('HELLFORGED'));
    }
  }

  const buttons = pool
    .filter(sit => sit.passive && sit.passive.length > 0)
    .map(sit => {
      const id = key + ':' + sit.id;
      const on = !!triggers[id];
      const emoji = key === 'hunterhunted' ? '' : '&#9889; ';
      return `<button class="trait-trigger-btn ${on ? 'on' : ''}" onclick="toggleTraitTrigger('${id}', event)" data-tooltip="${(sit.desc || 'Toggle this scenario to preview your stats.')}">${emoji}${sit.label}${on ? ' ON' : ''}</button>`;
    }).join('');
  if (!buttons) return '';
  return `<div class="trait-triggers">${buttons}</div>`;
}

function buildTraitTooltip(c, key) {
  const baseDef = TRAITS[key];
  if (!baseDef) return '';
  const t = getTraitDef(c, key);
  const rarity = baseDef.rarity;

  // Show concrete stat deltas this trait contributes RIGHT NOW.
  const baseNoTrait = JSON.parse(JSON.stringify(c));
  baseNoTrait.traits = (baseNoTrait.traits || []).filter(k => k !== key);
  const withTrait = c;
  const a = _origGetEffectiveStats(baseNoTrait); // raw base
  // To isolate THIS trait's effect, build full eff with and without
  const fullWith = getEffectiveStats(withTrait);
  const fullWithout = getEffectiveStats(baseNoTrait);

  const MAIN = ['hp', 'atk', 'def', 'mag', 'spd'];
  const SUB = ['heal_pow', 'crit_rate', 'crit_dmg', 'status_res', 'dexterity', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'];
  const labels = { hp: 'HP', atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD', heal_pow: 'Heal Power', crit_rate: 'Crit Chance', crit_dmg: 'Crit DMG', status_res: 'Status Res', dexterity: 'Dexterity', resilience: 'Resilience', true_dmg: 'True DMG', lifesteal: 'Lifesteal', cooldown_red: 'CDR' };

  let lines = '';
  MAIN.concat(SUB).forEach(s => {
    const diff = fullWith[s] - fullWithout[s];
    if (Math.abs(diff) > 0.05) {
      const sign = diff > 0 ? '+' : '';
      const cls = diff > 0 ? 'tt-pos' : 'tt-neg';
      const suffix = SUB.includes(s) ? '%' : '';
      lines += `<div class='tt-line'><span class='tt-stat'>${labels[s]}</span><span class='${cls}'>${sign}${diff.toFixed(SUB.includes(s) ? 1 : 0)}${suffix}</span></div>`;
    }
  });

  let extras = '';
  if (t.situational?.length) extras += `<div class='tt-extra'>⚡ Has ${t.situational.length} situational trigger${t.situational.length > 1 ? 's' : ''}.</div>`;
  if (t.cultivation) extras += `<div class='tt-extra'>📈 Cultivates: ${t.cultivation.label}.</div>`;
  if (t.notes) extras += `<div class='tt-note'>${t.notes}</div>`;
  if (!lines) lines = `<div class='tt-note'>No direct stat change while passive. See description.</div>`;

  return `<div class='tt-header rar-${rarity}'>${RARITY_LABEL[rarity]} • ${t.name}</div><div class='tt-desc'>${t.desc}</div><div class='tt-breakdown'>${lines}</div>${extras}`;
}

function rollMissingNo(ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const shimmy = isShimmyful(c, 'missingno');
  const STATS = ['hp', 'atk', 'def', 'mag', 'spd'];
  const rolls = {};
  if (shimmy) {
    STATS.forEach(s => { rolls[s] = Math.round((0.25 + Math.random() * (5.5 - 0.25)) * 100) / 100; });
    rolls[STATS[Math.floor(Math.random() * STATS.length)]] = 3.0;
  } else {
    STATS.forEach(s => { rolls[s] = Math.round((0.5 + Math.random() * (3.0 - 0.5)) * 100) / 100; });
  }
  c.missingNoRolls = rolls;
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function rollGlitch(ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const shimmy = isShimmyful(c, 'glitch');
  const maxVal = shimmy ? 30 : 20;
  const STATS = ['hp', 'atk', 'def', 'mag', 'spd'];
  const rolls = {};
  STATS.forEach(s => { rolls[s] = Math.round((0.01 + Math.random() * (maxVal - 0.01)) * 100) / 100; });
  c.glitchRolls = rolls;
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function rollThousandDoors(ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const shimmy = isShimmyful(c, 'thousanddoors');
  const STATS = ['hp', 'atk', 'def', 'mag', 'spd'];
  const s = STATS[Math.floor(Math.random() * STATS.length)];
  // shimmyful: 0.5-2.5 with slight positive bias; base: 0.75-1.75
  let mult;
  if (shimmy) {
    const raw = 0.5 + Math.random() * 2.0;
    mult = Math.random() < 0.3 ? raw + 0.3 : raw; // slight positive bias
    mult = Math.max(0.5, Math.min(2.5, mult));
  } else {
    mult = 0.75 + Math.random() * 1.0;
  }
  mult = Math.round(mult * 100) / 100;
  c.thousandDoorsAccum = c.thousandDoorsAccum || {};
  c.thousandDoorsHistory = c.thousandDoorsHistory || [];
  c.thousandDoorsHistory.push({ ...c.thousandDoorsAccum });
  if (c.thousandDoorsHistory.length > 20) c.thousandDoorsHistory.shift();
  c.thousandDoorsAccum[s] = Math.round(((c.thousandDoorsAccum[s] || 1) * mult) * 100) / 100;
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function undoThousandDoors(ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c || !c.thousandDoorsHistory || !c.thousandDoorsHistory.length) return;
  c.thousandDoorsAccum = c.thousandDoorsHistory.pop();
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function resetThousandDoors(ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.thousandDoorsHistory = c.thousandDoorsHistory || [];
  if (c.thousandDoorsAccum && Object.keys(c.thousandDoorsAccum).length) {
    c.thousandDoorsHistory.push({ ...c.thousandDoorsAccum });
    if (c.thousandDoorsHistory.length > 20) c.thousandDoorsHistory.shift();
  }
  c.thousandDoorsAccum = {};
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function rollAnotherandAnother(type, ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const shimmy = isShimmyful(c, 'anotherandanother');
  const maxVal = shimmy ? 15.0 : 10.0;
  c.drunkStats = c.drunkStats || {};
  // bias toward lower values: use Math.pow(Math.random(), 2) to skew low
  const randStat = () => Math.round((0.1 + Math.pow(Math.random(), 2) * (maxVal - 0.1)) * 100) / 100;
  if (type === 'atkmag') {
    c.drunkStats.atk = randStat();
    c.drunkStats.mag = randStat();
  } else {
    c.drunkStats.def = randStat();
    c.drunkStats.hp = randStat();
  }
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

let _psSelectedChar = null;
let _psPickerOpen = false;
let _psSoulListOpen = false;

function togglePsPicker(ev) {
  if (ev) ev.stopPropagation();
  _psPickerOpen = !_psPickerOpen;
  const c = characters.find(x => x.id === currentId);
  if (c) renderTraitsDisplay(c);
}

function togglePsSoulList(ev) {
  if (ev) ev.stopPropagation();
  _psSoulListOpen = !_psSoulListOpen;
  const c = characters.find(x => x.id === currentId);
  if (c) renderTraitsDisplay(c);
}

function filterPsPicker(val) {
  const q = (val || '').toLowerCase();
  const listEl = document.getElementById('ps-picker-list');
  if (!listEl) return;
  listEl.querySelectorAll('.ps-char-row').forEach(row => {
    row.style.display = (row.dataset.name || '').toLowerCase().includes(q) ? '' : 'none';
  });
}

function selectPsChar(name, ev) {
  if (ev) ev.stopPropagation();
  _psSelectedChar = name;
  _psPickerOpen = false;
  const c = characters.find(x => x.id === currentId);
  if (c) renderTraitsDisplay(c);
}

function clearPsChar(ev) {
  if (ev) ev.stopPropagation();
  _psSelectedChar = null;
  _psPickerOpen = false;
  const c = characters.find(x => x.id === currentId);
  if (c) renderTraitsDisplay(c);
}

function absorbPerfectSoul(ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  if (!_psSelectedChar) { notify('SELECT A CHARACTER FIRST', 'err'); return; }
  const target = characters.find(x => x.name === _psSelectedChar);
  if (!target) { notify('CHARACTER NOT FOUND', 'err'); return; }
  const shimmy = isShimmyful(c, 'perfectsoul');
  const pct = shimmy
    ? Math.round(55 + Math.random() * 35)
    : Math.round(40 + Math.random() * 40);
  const ts = target.stats || {};
  const absorbed = {
    hp:  Math.round((ts.hp  || 0) * pct / 100),
    atk: Math.round((ts.atk || 0) * pct / 100),
    def: Math.round((ts.def || 0) * pct / 100),
    mag: Math.round((ts.mag || 0) * pct / 100),
    spd: Math.round((ts.spd || 0) * pct / 100),
  };
  c.perfectSoulData = c.perfectSoulData || { souls: [], history: [] };
  c.perfectSoulData.history = c.perfectSoulData.history || [];
  c.perfectSoulData.history.push({ souls: JSON.parse(JSON.stringify(c.perfectSoulData.souls || [])) });
  if (c.perfectSoulData.history.length > 20) c.perfectSoulData.history.shift();
  c.perfectSoulData.souls = c.perfectSoulData.souls || [];
  c.perfectSoulData.souls.push({ name: _psSelectedChar, pct, stats: absorbed });
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function undoPerfectSoul(ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c || !c.perfectSoulData || !c.perfectSoulData.history || !c.perfectSoulData.history.length) return;
  c.perfectSoulData.souls = (c.perfectSoulData.history.pop() || {}).souls || [];
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function resetPerfectSoul(ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.perfectSoulData = c.perfectSoulData || { souls: [], history: [] };
  c.perfectSoulData.history = c.perfectSoulData.history || [];
  if (c.perfectSoulData.souls && c.perfectSoulData.souls.length) {
    c.perfectSoulData.history.push({ souls: JSON.parse(JSON.stringify(c.perfectSoulData.souls)) });
    if (c.perfectSoulData.history.length > 20) c.perfectSoulData.history.shift();
  }
  c.perfectSoulData.souls = [];
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function removePerfectSoul(idx, ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c || !c.perfectSoulData || !c.perfectSoulData.souls) return;
  if (idx < 0 || idx >= c.perfectSoulData.souls.length) return;
  c.perfectSoulData.history = c.perfectSoulData.history || [];
  c.perfectSoulData.history.push({ souls: JSON.parse(JSON.stringify(c.perfectSoulData.souls)) });
  if (c.perfectSoulData.history.length > 20) c.perfectSoulData.history.shift();
  c.perfectSoulData.souls.splice(idx, 1);
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function toggleTraitTrigger(triggerKey, ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.traitTriggers = c.traitTriggers || {};
  c.traitTriggers[triggerKey] = !c.traitTriggers[triggerKey];
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function removeTrait(key, ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.traits = (c.traits || []).filter(k => k !== key);
  c.shimmyfulTraits = (c.shimmyfulTraits || []).filter(k => k !== key);
  if (c.dualityState) delete c.dualityState[key];
  if (key === 'missingno') delete c.missingNoRolls;
  if (key === 'glitch') delete c.glitchRolls;
  if (key === 'thousanddoors') { delete c.thousandDoorsAccum; delete c.thousandDoorsHistory; }
  if (key === 'perfectsoul') delete c.perfectSoulData;
  if (key === 'anotherandanother') { delete c.drunkStats; delete c.drunkCount; }
  playSound('delete');
  // Clean up triggers/stacks for removed trait
  if (c.traitTriggers) {
    Object.keys(c.traitTriggers).forEach(tk => { if (tk.startsWith(key + ':')) delete c.traitTriggers[tk]; });
  }
  if (c.traitStacks) {
    delete c.traitStacks[key];
    delete c.traitStacks[key + ':kills'];
    delete c.traitStacks[key + ':deaths'];
    delete c.traitStacks[key + ':spares'];
  }
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
  // Hide tooltip so it doesn't get stuck to the mouse
  const tt = document.getElementById('global-tooltip');
  if (tt) tt.style.display = 'none';
  notify('TRAIT REMOVED', 'err');
}

// ============================================================
// TRAIT CODEX
// ============================================================
function openTraitCodex() {
  const body = document.getElementById('trait-codex-body');
  body.innerHTML = RARITY_ORDER.map(rar => {
    const allOfRarity = Object.entries(TRAITS).filter(([k, t]) => t.rarity === rar);
    const seenOfRarity = allOfRarity.filter(([k, t]) => seenTraits.includes(k));
    const countTotal = allOfRarity.length;
    const countSeen = seenOfRarity.length;

    // DUALITY — glitching title, entries show both heavenly and hellforged sides
    if (rar === 'duality') {
      return `
        <div class="codex-section rar-duality">
          <div class="codex-section-title">
            <span class="codex-rar-tag duality-split-tag" data-h="HEAVENLY (${countSeen}/${countTotal})" data-hf="HELLFORGED (${countSeen}/${countTotal})">HELLFORGED (${countSeen}/${countTotal})</span>
            <span class="codex-rar-chance">${RARITY_WEIGHTS[rar]}% chance</span>
          </div>
          <div class="codex-list">
            ${seenOfRarity.map(([k, t]) => `
              <div class="codex-entry rar-duality codex-duality-entry">
                <div class="codex-duality-side heavenly-side">
                  <div class="codex-duality-label">HEAVENLY</div>
                  <div class="codex-entry-name" style="color:#88c8ff">${t.heavenly?.name || t.name}</div>
                  <div class="codex-entry-desc" style="color:#4a7abf">${t.heavenly?.desc || t.desc}</div>
                </div>
                <div class="codex-duality-divider">☯</div>
                <div class="codex-duality-side hellforged-side">
                  <div class="codex-duality-label">HELLFORGED</div>
                  <div class="codex-entry-name" style="color:#ffd04a">${t.hellforged?.name || t.name}</div>
                  <div class="codex-entry-desc" style="color:#cc9930">${t.hellforged?.desc || t.desc}</div>
                </div>
              </div>
            `).join('')}
            ${countSeen === 0 ? `<div style="font-size:8px;color:#444;padding:8px;">NOTHING UNLOCKED YET</div>` : ''}
          </div>
        </div>`;
    }

    // DETERMINED — pulsing section with evolution path display
    if (rar === 'determined') {
      return `
        <div class="codex-section rar-determined det-codex-section">
          <div class="codex-section-title">
            <span class="codex-rar-tag rar-determined det-codex-tag">DETERMINED (${countSeen}/${countTotal})</span>
            <span class="codex-rar-chance">${RARITY_WEIGHTS[rar]}% chance</span>
          </div>
          <div class="codex-list">
            ${seenOfRarity.map(([k, t]) => `
              <div class="codex-entry rar-determined det-codex-entry">
                <div class="codex-entry-name">${t.name}</div>
                <div class="codex-entry-desc">${t.desc}</div>
                <div class="det-codex-paths">
                  <div class="det-codex-path hatred-path">
                    <span class="det-path-label">10 KILLS</span>
                    <span class="det-path-arrow">→</span>
                    <span class="det-path-name hatred-name">HATRED</span>
                  </div>
                  <div class="det-codex-path mercyful-path">
                    <span class="det-path-label">10 SPARES</span>
                    <span class="det-path-arrow">→</span>
                    <span class="det-path-name mercyful-name">MERCYFUL</span>
                  </div>
                </div>
              </div>
            `).join('')}
            ${countSeen === 0 ? `<div class="det-codex-empty">NOTHING UNLOCKED YET</div>` : ''}
          </div>
        </div>`;
    }

    // Group seen traits by role
    const byRole = {};
    ROLE_ORDER.forEach(r => { byRole[r] = []; });
    seenOfRarity.forEach(([k, t]) => {
      const role = TRAIT_ROLES[k] || 'utility';
      byRole[role].push([k, t]);
    });
    const groupedHtml = ROLE_ORDER.flatMap(role => {
      const entries = byRole[role];
      if (!entries.length) return [];
      return [
        `<div class="codex-role-sep">${ROLE_LABELS[role]}</div>`,
        ...entries.map(([k, t]) => `
          <div class="codex-entry rar-${rar}">
            <div class="codex-entry-name">${t.name}</div>
            <div class="codex-entry-desc">${t.desc}</div>
          </div>`)
      ];
    }).join('');

    return `
      <div class="codex-section rar-${rar}">
        <div class="codex-section-title">
          <span class="codex-rar-tag rar-${rar}">${RARITY_LABEL[rar]} (${countSeen}/${countTotal})</span>
          <span class="codex-rar-chance">${RARITY_WEIGHTS[rar]}% chance</span>
        </div>
        <div class="codex-list">
          ${groupedHtml}
          ${countSeen === 0 ? `<div style="font-size:8px; color:#444; padding:8px;">NOTHING UNLOCKED YET</div>` : ''}
        </div>
      </div>`;
  }).join('');
  document.getElementById('trait-codex-overlay').classList.add('open');
  document.getElementById('trait-codex-modal').classList.add('open');
}
function closeTraitCodex() {
  document.getElementById('trait-codex-overlay').classList.remove('open');
  document.getElementById('trait-codex-modal').classList.remove('open');
}

// ============================================================
// TRAIT ROLL (gambling)
// ============================================================
let currentHand = null;
let _rollInProgress = false;  // prevents stacking multiple concurrent rolls
let _autoRollMode = false;
let _autoRollStopRarity = 'legendary'; // rare | epic | legendary | mythic
let _autoRollStopShimmy = true;

const _AR_RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4, hexxed: 99, duality: 99, determined: 99 };

function _arIsStop(handItem) {
  const rar = (TRAITS[handItem.key]?.rarity || '').toLowerCase();
  if (rar === 'hexxed' || rar === 'duality' || rar === 'determined') return true;
  if (handItem.shimmyful && _autoRollStopShimmy) return true;
  // unknown non-empty rarity → treat as above mythic so nothing exotic gets skipped
  const rank = rar ? (_AR_RARITY_RANK[rar] ?? 99) : 0;
  return rank >= (_AR_RARITY_RANK[_autoRollStopRarity] ?? 3);
}

function toggleAutoRoll() {
  _autoRollMode = !_autoRollMode;
  const btn = document.getElementById('auto-roll-btn');
  if (btn) {
    btn.textContent = _autoRollMode ? 'AUTO: ON' : 'AUTO: OFF';
    btn.classList.toggle('accent', _autoRollMode);
  }
  const settings = document.getElementById('auto-roll-settings');
  if (settings) settings.style.display = _autoRollMode ? 'flex' : 'none';
}

function setAutoRollRarity(rar) {
  _autoRollStopRarity = rar;
  document.querySelectorAll('.ar-rar-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.rar === rar);
  });
}

function toggleAutoRollShimmy() {
  _autoRollStopShimmy = !_autoRollStopShimmy;
  const btn = document.getElementById('ar-shimmy-btn');
  if (btn) btn.classList.toggle('active', _autoRollStopShimmy);
}

function rollTraits() {
  if (!currentId) { notify('SELECT A CHARACTER FIRST', 'err'); return; }
  if (_rollInProgress) return;
  _rollInProgress = true;

  // Pity: increment, cap at 100, check if this is the pity roll
  traitPity = Math.min(traitPity + 1, 100);
  const isPityRoll = traitPity >= 100;
  savePity();

  const overlay = document.getElementById('trait-roll-overlay');
  const title = document.getElementById('roll-phase-title');
  const sub = document.getElementById('roll-phase-sub');
  const actions = document.getElementById('roll-phase-actions');
  const cardsWrap = document.getElementById('trait-hand-cards');

  if (isPityRoll) {
    title.textContent = 'PITY ROLL!';
    sub.textContent = 'Guaranteed legendary or better.';
  } else {
    title.textContent = 'DRAWING YOUR HAND...';
    sub.innerHTML = '&nbsp;';
  }
  overlay.classList.add('open');
  // Disable REROLL during animation so you can't stack rolls; AUTO + CANCEL stay live
  const rerollBtn = document.getElementById('reroll-hand-btn');
  if (rerollBtn) rerollBtn.disabled = true;
  // Keep the settings strip in sync with autoroll state
  const arSettingsEl = document.getElementById('auto-roll-settings');
  if (arSettingsEl) arSettingsEl.style.display = _autoRollMode ? 'flex' : 'none';
  updatePityDisplay();
  playSound('dicealt', { rate: 0.9 + Math.random() * 0.15, volume: 0.75 });

  currentHand = rollHand(isPityRoll);

  // Pre-calculate final pity after this roll (applied after animation)
  let finalPity = traitPity;
  if (isPityRoll) {
    finalPity = 0;
  } else {
    const rarities = currentHand.map(h => TRAITS[h.key].rarity);
    if (rarities.includes('hexxed')) {
      finalPity = 0;
    } else if (rarities.includes('mythic')) {
      finalPity = Math.max(0, traitPity - 80);
    } else if (rarities.includes('legendary')) {
      finalPity = Math.max(0, traitPity - 25);
    }
  }

  const allKeys = Object.keys(TRAITS);

  // Build 3 rolling placeholder cards
  cardsWrap.innerHTML = '';
  const cardEls = currentHand.map(() => {
    const div = document.createElement('div');
    div.className = 'hand-card rolling';
    div.innerHTML = `
      <div class="hand-card-rarity">???</div>
      <div class="hand-card-name">---</div>
      <div class="hand-card-desc"></div>
      <div class="hand-card-cta">CLICK TO TAKE</div>
    `;
    cardsWrap.appendChild(div);
    return div;
  });

  // Cycle each card's content at slightly different rates
  let _popCooldown = false;
  const timers = cardEls.map((card, i) =>
    setInterval(() => {
      const k = allKeys[Math.floor(Math.random() * allKeys.length)];
      const t = TRAITS[k];
      card.querySelector('.hand-card-rarity').textContent = RARITY_LABEL[t.rarity];
      card.querySelector('.hand-card-name').textContent = t.name;
      card.querySelector('.hand-card-desc').innerHTML = _renderDescWithStatuses(t.desc);
      if (!_popCooldown) {
        _popCooldown = true;
        playSound('pop', { rate: 0.85 + Math.random() * 0.35, volume: 0.12 });
        setTimeout(() => { _popCooldown = false; }, 75);
      }
    }, 85 + i * 15)
  );

  // Lock each card staggered
  [1400, 1950, 2500].forEach((delay, i) => {
    setTimeout(() => {
      clearInterval(timers[i]);
      const handItem = currentHand[i];
      const key = handItem.key;
      const t = TRAITS[key];
      const card = cardEls[i];

      // Flash then reveal rarity (deal animation fires on class change)
      const _rollC = characters.find(x => x.id === currentId);
      card.style.filter = 'brightness(3)';
      card.className = `hand-card rar-${t.rarity}`;
      card.querySelector('.hand-card-rarity').textContent = RARITY_LABEL[t.rarity];
      card.querySelector('.hand-card-name').textContent = _applyCharName(t.name, _rollC);
      card.querySelector('.hand-card-desc').innerHTML = _renderDescWithStatuses(_applyCharName(t.desc, _rollC));
      card.querySelector('.hand-card-cta').style.visibility = 'hidden';

      // Pop on card lock-in, then rarity reveal sound
      playSound('pop', { rate: 0.9 + Math.random() * 0.2, volume: 0.85 });
      if (t.rarity === 'hexxed') playSound('hexxed', { volume: 0.9 });
      else if (t.rarity === 'mythic') playSound('mythic', { volume: 0.85 });
      else if (t.rarity === 'legendary') playSound('legendary', { volume: 0.8 });

      // SHIMMYFUL reveal — fires 400ms after the base reveal
      if (handItem.shimmyful) {
        setTimeout(() => {
          const isLegShimmy = t.rarity === 'legendary';
          const isMythicShimmy = t.rarity === 'mythic';
          const isEpicShimmy = t.rarity === 'epic';
          const isRareShimmy = t.rarity === 'rare';
          const sd = isLegShimmy ? SHIMMYFUL_LEGENDARY_TRAITS[key] : isMythicShimmy ? SHIMMYFUL_MYTHIC_TRAITS[key] : isEpicShimmy ? SHIMMYFUL_EPIC_TRAITS[key] : isRareShimmy ? SHIMMYFUL_RARE_TRAITS[key] : SHIMMYFUL_TRAITS[key];
          if (!sd) return;
          card.classList.add('shimmyful');
          if (isLegShimmy) card.classList.add('shimmy-leg');
          if (isMythicShimmy) card.classList.add('shimmy-mythic');
          if (isEpicShimmy) card.classList.add('shimmy-epic');
          if (isRareShimmy) card.classList.add('shimmy-rare');
          const _shimC = characters.find(x => x.id === currentId);
          card.querySelector('.hand-card-name').textContent = _applyCharName(sd.name, _shimC);
          card.querySelector('.hand-card-desc').innerHTML = _renderDescWithStatuses(_applyCharName(sd.desc, _shimC));
          // Update rarity label suffix
          const rarEl = card.querySelector('.hand-card-rarity');
          if (rarEl) rarEl.innerHTML = rarEl.textContent + (isLegShimmy ? ' <span style="color:#ffd84a">★</span>' : isMythicShimmy ? ' <span style="color:#ff8c00">✦</span>' : isEpicShimmy ? ' <span style="color:#c98bff">✦</span>' : isRareShimmy ? ' <span style="color:#4aa9ff">✦</span>' : ' <span style="color:#50ff8c">✦</span>');
          card.style.filter = 'brightness(2.8)';
          setTimeout(() => {
            card.style.transition = 'filter 0.5s ease';
            card.style.filter = '';
            setTimeout(() => { card.style.transition = ''; }, 520);
          }, 90);
          // Legendary shimmy: slow/deep sound (0.72x). Common shimmy: fast/bright (1.85x).
          playSound('legendary', { rate: isLegShimmy ? 0.72 : 1.85, volume: 0.9 });
        }, 400);
      }

      // Mark as seen
      if (!seenTraits.includes(key)) {
        seenTraits.push(key);
        saveSeenTraits();
      }
      setTimeout(() => {
        card.style.transition = 'filter 0.3s ease';
        card.style.filter = '';
        setTimeout(() => { card.style.transition = ''; }, 320);
      }, 60);

      if (i === 2) {
        // If any card is shimmyful, wait for the shimmy animation to finish
        // before making the hand interactive (so players don't miss it).
        // Shimmy fires at +400ms, flash+transition takes ~500ms → need ~900ms.
        // Add extra buffer so the glow is clearly visible before CTAs appear.
        const hasShimmy = currentHand.some(h => h.shimmyful);
        const interactDelay = hasShimmy ? 1600 : 380;
        setTimeout(() => {
          traitPity = finalPity;
          savePity();
          updatePityDisplay();
          title.textContent = 'YOUR TRAIT HAND';
          sub.textContent = isPityRoll ? 'Pity reset. Pick your trait.' : 'Pick one, or close to discard.';
          cardEls.forEach((c, ci) => {
            c.querySelector('.hand-card-cta').style.visibility = '';
            c.onclick = () => pickTraitFromHand(currentHand[ci]);
          });
          actions.style.display = '';
          if (rerollBtn) rerollBtn.disabled = false;
          _rollInProgress = false;
          const arSettings = document.getElementById('auto-roll-settings');
          if (arSettings) arSettings.style.display = _autoRollMode ? 'flex' : 'none';

          // ── Auto-roll check ──
          if (_autoRollMode) {
            const stopCards = currentHand.map((h, ci) => ({ h, ci, isStop: _arIsStop(h) }));
            const anyStop = stopCards.some(x => x.isStop);
            if (anyStop) {
              title.textContent = '★ NOTABLE ROLL';
              sub.textContent = 'Pick a card, or REROLL to skip.';
              stopCards.forEach(({ ci, isStop }) => {
                if (isStop) cardEls[ci].classList.add('auto-roll-new');
              });
            } else {
              title.textContent = 'AUTO-ROLLING...';
              sub.textContent = 'Nothing notable. Rolling again...';
              setTimeout(() => { if (_autoRollMode && !document.hidden) rollTraits(); }, 320);
            }
          }
        }, interactDelay);
      }
    }, delay);
  });
}

function toggleDuality(key, ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.dualityState = c.dualityState || {};
  const current = c.dualityState[key] || 'heavenly';
  const next = current === 'heavenly' ? 'hellforged' : 'heavenly';

  // Clear any active situational triggers for this trait when toggled
  if (c.traitTriggers) {
    Object.keys(c.traitTriggers).forEach(tk => {
      if (tk.startsWith(key + ':')) {
        delete c.traitTriggers[tk];
      }
    });
  }

  // Trigger the transition animation on the chip before re-rendering
  const chip = document.querySelector(`.trait-chip[data-trait="${key}"]`);
  if (chip) {
    const animClass = next === 'hellforged' ? 'duality-to-hell' : 'duality-to-heaven';
    chip.classList.add(animClass);
    setTimeout(() => {
      c.dualityState[key] = next;
      playSound('pop', { rate: next === 'hellforged' ? 0.65 : 1.35, volume: 0.85 });
      saveData(c);
      updateLiveStats(c);
      renderTraitsDisplay(c);
    }, 480);
  } else {
    c.dualityState[key] = next;
    saveData(c);
    updateLiveStats(c);
    renderTraitsDisplay(c);
  }
}

function adjustDetermination(key, counter, delta, ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.traitStacks = c.traitStacks || {};
  const stackKey = key + ':' + counter;
  const maxVal = (counter === 'kills' || counter === 'spares') ? 10 : 9999;
  c.traitStacks[stackKey] = Math.max(0, Math.min(maxVal, (c.traitStacks[stackKey] || 0) + delta));
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function setDeterminationState(key, state, ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.traitStacks = c.traitStacks || {};
  if (state === 'determined') {
    // Reset: clear forced override and counters
    delete c.traitStacks['determination:state'];
    c.traitStacks['determination:kills'] = 0;
    c.traitStacks['determination:deaths'] = 0;
    c.traitStacks['determination:spares'] = 0;
  } else {
    c.traitStacks['determination:state'] = state;
  }
  saveData(c);
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function rerollHand() {
  rollTraits();
}

function pickTraitFromHand(handItem) {
  const key = handItem.key;
  const shimmyful = !!handItem.shimmyful;
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.traits = c.traits || [];
  c.shimmyfulTraits = c.shimmyfulTraits || [];

  // "Bravest of the Brave" mythic: grants bonus traits
  if (key === 'brave') {
    c.traits = ['brave'];
    c.shimmyfulTraits = shimmyful ? ['brave'] : [];
    const seen = new Set(['brave']);
    if (shimmyful) {
      // Guaranteed 3 additional rare/epic traits — one is guaranteed epic.
      const epicPool = Object.entries(TRAITS).filter(([, t]) => t.rarity === 'epic').map(([k]) => k);
      const rareEpicPool = Object.entries(TRAITS).filter(([, t]) => t.rarity === 'rare' || t.rarity === 'epic').map(([k]) => k);

      // Roll 1 epic trait first
      let rolledEpic = false;
      while (!rolledEpic) {
        const k = epicPool[Math.floor(Math.random() * epicPool.length)];
        if (!seen.has(k)) {
          seen.add(k);
          c.traits.push(k);
          rolledEpic = true;
        }
      }

      // Roll 2 more rare/epic traits
      while (c.traits.length < 4) {
        const k = rareEpicPool[Math.floor(Math.random() * rareEpicPool.length)];
        if (!seen.has(k)) {
          seen.add(k);
          c.traits.push(k);
        }
      }
    } else {
      // Guaranteed 2 additional rare/epic traits
      const rareEpicPool = Object.entries(TRAITS).filter(([, t]) => t.rarity === 'rare' || t.rarity === 'epic').map(([k]) => k);
      while (c.traits.length < 3) {
        const k = rareEpicPool[Math.floor(Math.random() * rareEpicPool.length)];
        if (!seen.has(k)) {
          seen.add(k);
          c.traits.push(k);
        }
      }
    }
  } else if (key === 'girlyopscurse') {
    c.traits = ['girlyopscurse'];
    c.shimmyfulTraits = shimmyful ? ['girlyopscurse'] : [];
    const seen = new Set(['girlyopscurse']);
    const commonPool = Object.entries(TRAITS).filter(([, t]) => t.rarity === 'common').map(([k]) => k);
    const rarePool = Object.entries(TRAITS).filter(([, t]) => t.rarity === 'rare').map(([k]) => k);

    if (shimmyful) {
      // Gain 3 random common traits and 2 random rare traits. All bonus traits guaranteed shimmyful.
      while (seen.size < 4) {
        const k = commonPool[Math.floor(Math.random() * commonPool.length)];
        if (!seen.has(k)) {
          seen.add(k);
          c.traits.push(k);
          c.shimmyfulTraits.push(k);
        }
      }
      while (seen.size < 6) {
        const k = rarePool[Math.floor(Math.random() * rarePool.length)];
        if (!seen.has(k)) {
          seen.add(k);
          c.traits.push(k);
          c.shimmyfulTraits.push(k);
        }
      }
    } else {
      // Gain 2 random common traits and 1 random rare trait. Each bonus trait has a 25% chance of being shimmyful.
      while (seen.size < 3) {
        const k = commonPool[Math.floor(Math.random() * commonPool.length)];
        if (!seen.has(k)) {
          seen.add(k);
          c.traits.push(k);
          if (Math.random() < 0.25) {
            c.shimmyfulTraits.push(k);
          }
        }
      }
      while (seen.size < 4) {
        const k = rarePool[Math.floor(Math.random() * rarePool.length)];
        if (!seen.has(k)) {
          seen.add(k);
          c.traits.push(k);
          if (Math.random() < 0.25) {
            c.shimmyfulTraits.push(k);
          }
        }
      }
    }
  } else if (key === 'onlyatraitor') {
    c.traits = ['onlyatraitor'];
    c.shimmyfulTraits = shimmyful ? ['onlyatraitor'] : [];
    const seen = new Set(['onlyatraitor']);
    const legPool = Object.entries(TRAITS).filter(([, t]) => t.rarity === 'legendary').map(([k]) => k);
    const count = shimmyful ? 3 : 2;
    while (c.traits.length < count + 1) {
      const k = legPool[Math.floor(Math.random() * legPool.length)];
      if (!seen.has(k)) { seen.add(k); c.traits.push(k); }
    }
  } else if (key === 'woetothee') {
    c.traits = ['woetothee'];
    c.shimmyfulTraits = shimmyful ? ['woetothee'] : [];
    const seen = new Set(['woetothee']);
    const legShimmyPool = Object.keys(SHIMMYFUL_LEGENDARY_TRAITS).filter(k => k !== 'woetothee');
    const count = shimmyful ? 2 : 1;
    let added = 0;
    while (added < count) {
      const k = legShimmyPool[Math.floor(Math.random() * legShimmyPool.length)];
      if (!seen.has(k) && TRAITS[k]) {
        seen.add(k);
        c.traits.push(k);
        if (!c.shimmyfulTraits.includes(k)) c.shimmyfulTraits.push(k);
        added++;
      }
    }
  } else {
    c.traits = [key];
    c.shimmyfulTraits = shimmyful ? [key] : [];
    // Initialize duality state
    if (TRAITS[key]?.rarity === 'duality') {
      c.dualityState = c.dualityState || {};
      c.dualityState[key] = 'heavenly';
    }
    // Initialize determination counters
    if (key === 'determination') {
      c.traitStacks = c.traitStacks || {};
      c.traitStacks['determination:kills'] = 0;
      c.traitStacks['determination:deaths'] = 0;
      c.traitStacks['determination:spares'] = 0;
    }
  }

  // Reset triggers/stacks for the new selection
  c.traitTriggers = {};
  c.traitStacks = {};
  c.traits.forEach(k => {
    const t = TRAITS[k];
    if (t?.cultivation) c.traitStacks[k] = t.cultivation.defaultStacks || 0;
  });

  const tDef = TRAITS[key];
  if (tDef) {
    c.traitHistory = c.traitHistory || [];
    const _sd = shimmyful ? getShimmyfulDef(key) : null;
    const histName = _sd ? _sd.name : tDef.name;
    c.traitHistory.unshift({ key, name: histName, rarity: tDef.rarity, shimmyful, ts: Date.now() });
    if (c.traitHistory.length > 50) c.traitHistory.length = 50;
  }

  let updatedSeen = false;
  c.traits.forEach(k => {
    if (TRAITS[k] && !seenTraits.includes(k)) {
      seenTraits.push(k);
      updatedSeen = true;
    }
  });
  if (updatedSeen) saveSeenTraits();

  saveData(c);
  playSound('equip', { rate: 1.15, volume: 0.9 });
  closeTraitRoll();
  viewChar(currentId);
  const displayName = shimmyful && getShimmyfulDef(key) ? getShimmyfulDef(key).name : tDef.name;
  notify(`${RARITY_LABEL[tDef.rarity]}: ${displayName}!`, 'ok');
}

function closeTraitRoll(cancelled = false) {
  if (cancelled) playSound('cancel', { volume: 0.75 });
  document.getElementById('trait-roll-overlay').classList.remove('open');
  currentHand = null;
  _rollInProgress = false;
}

// ============================================================
// CULTIVATION / SCALING WINDOW
// ============================================================
function openCultivationWindow() {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const traits = (c.traits || []).filter(k => TRAITS[k]?.cultivation);
  if (!traits.length) { notify('NO SCALING TRAITS ACTIVE', 'err'); return; }
  const body = document.getElementById('cultivation-body');
  c.traitStacks = c.traitStacks || {};
  body.innerHTML = traits.map(key => {
    const t = getTraitDef(c, key);
    const cult = t.cultivation;
    const stacks = c.traitStacks[key] != null ? c.traitStacks[key] : (cult.defaultStacks || 0);
    const rarity = TRAITS[key].rarity;
    return `
      <div class="cult-block rar-${rarity}" data-key="${key}">
        <div class="cult-block-header">
          <span class="cult-tag rar-${rarity}">${RARITY_LABEL[rarity]}</span>
          <span class="cult-name">${t.name}</span>
        </div>
        <div class="cult-desc">${t.desc}</div>
        <div class="cult-controls">
          <div class="cult-stack-label">${cult.label}</div>
          <div class="cult-counter">
            <button class="btn sm" onclick="adjustStacks('${key}', -10)">--</button>
            <button class="btn sm" onclick="adjustStacks('${key}', -1)">-</button>
            <input type="number" class="cult-input" id="cult-input-${key}" value="${stacks}" min="0" max="${cult.maxStacks}" oninput="setStacks('${key}', this.value)">
            <button class="btn sm" onclick="adjustStacks('${key}', 1)">+</button>
            <button class="btn sm" onclick="adjustStacks('${key}', 10)">++</button>
          </div>
          <input type="range" class="cult-slider" min="0" max="${cult.maxStacks}" value="${stacks}" oninput="setStacks('${key}', this.value)">
        </div>
        <div class="cult-preview" id="cult-preview-${key}"></div>
      </div>`;
  }).join('');
  document.getElementById('cultivation-overlay').classList.add('open');
  document.getElementById('cultivation-modal').classList.add('open');
  refreshCultivationPreviews();
}
function closeCultivationWindow() {
  document.getElementById('cultivation-overlay').classList.remove('open');
  document.getElementById('cultivation-modal').classList.remove('open');
}
function adjustStacks(key, delta) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.traitStacks = c.traitStacks || {};
  const t = getTraitDef(c, key);
  const max = t.cultivation.maxStacks;
  const cur = c.traitStacks[key] != null ? c.traitStacks[key] : (t.cultivation.defaultStacks || 0);
  const next = Math.max(0, Math.min(max, cur + delta));
  c.traitStacks[key] = next;
  const input = document.getElementById('cult-input-' + key);
  if (input) input.value = next;
  const slider = document.querySelector(`.cult-block[data-key="${key}"] .cult-slider`);
  if (slider) slider.value = next;
  saveData(c);
  refreshCultivationPreviews();
  updateLiveStats(c);
  renderTraitsDisplay(c);
}
function setStacks(key, val) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const t = getTraitDef(c, key);
  const max = t.cultivation.maxStacks;
  const v = Math.max(0, Math.min(max, parseInt(val) || 0));
  c.traitStacks = c.traitStacks || {};
  c.traitStacks[key] = v;
  saveData(c);
  refreshCultivationPreviews();
  updateLiveStats(c);
  renderTraitsDisplay(c);
}
function refreshCultivationPreviews() {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const traits = (c.traits || []).filter(k => TRAITS[k]?.cultivation);
  const without = JSON.parse(JSON.stringify(c));
  without.traitStacks = {};
  const baseStats = getEffectiveStats(without);
  traits.forEach(key => {
    const single = JSON.parse(JSON.stringify(c));
    single.traits = [key];
    single.traitTriggers = {};
    const eff = getEffectiveStats(single);
    const stat = (k, label, suffix = '') => {
      const diff = eff[k] - _origGetEffectiveStats(without)[k];
      if (Math.abs(diff) < 0.5 && !suffix) return '';
      const sign = diff > 0 ? '+' : '';
      return `<div class='cult-stat-row'><span>${label}</span><span class='${diff > 0 ? "tt-pos" : "tt-neg"}'>${sign}${diff.toFixed(suffix ? 1 : 0)}${suffix}</span></div>`;
    };
    const subLabels = { heal_pow: 'HEAL PWR', crit_rate: 'CRIT RATE', crit_dmg: 'CRIT DMG', status_res: 'STATUS RES', dexterity: 'DEXTERITY', resilience: 'RESILIENCE', true_dmg: 'TRUE DMG', lifesteal: 'LIFESTEAL', cooldown_red: 'CDR' };
    const mainHtml = ['hp', 'atk', 'def', 'mag', 'spd', 'iq'].map(k => stat(k, k.toUpperCase())).join('');
    const subHtml = Object.keys(subLabels).map(k => stat(k, subLabels[k])).join('');
    const html = mainHtml + subHtml;
    const el = document.getElementById('cult-preview-' + key);
    if (el) el.innerHTML = `<div class='cult-preview-title'>SCALED STAT DELTA</div>${html || '<div class="cult-stat-row"><span>-</span><span>-</span></div>'}`;
  });
}

// ============================================================
// HOOK TRAIT RENDER INTO viewChar
// ============================================================
const _origViewChar = viewChar;
viewChar = function (id) {
  _origViewChar(id);
  const c = characters.find(x => x.id === id);
  if (c) renderTraitsDisplay(c);
  playThemeForCharacter(id);
  // Refresh music tab content if it's currently open
  if (document.getElementById('tab-music') &&
      document.getElementById('tab-music').style.display !== 'none') {
    renderThemeTab();
  }
  // Refresh abilities tab content if it's currently open
  if (document.getElementById('tab-abilities') &&
      document.getElementById('tab-abilities').style.display !== 'none') {
    renderAbilitiesTab();
  }
};
const _origUpdateLiveStats = updateLiveStats;
updateLiveStats = function (c) {
  _origUpdateLiveStats(c);
};

// ============================================================
// ABILITIES TAB
// ============================================================

let _abilityEditorIdx = null;        // null = new ability, number = editing existing
let _abilityEditorImageDataURL = null; // base64 image for current editor session

/* Type palette — bg/border/text + icon displayed on card and picker */
const AB_TYPE_COLORS = {
  ACTIVE:   { bg: 'rgba(0,255,255,0.06)',   border: 'rgba(0,255,255,0.3)',    text: '#00ffff', icon: '⚡︎', iconColor: '#ffffff' },
  PASSIVE:  { bg: 'rgba(160,80,255,0.07)',  border: 'rgba(160,80,255,0.35)',  text: '#cc99ff', icon: '◈',  iconColor: '#cc99ff' },
  REACTION: { bg: 'rgba(255,255,0,0.05)',   border: 'rgba(255,255,0,0.3)',    text: '#ffff44', icon: '↺',  iconColor: '#ffff44' },
  TOGGLE:   { bg: 'rgba(0,255,128,0.05)',   border: 'rgba(0,255,128,0.3)',    text: '#00ff80', icon: '⇌',  iconColor: '#00ff80' },
  AURA:     { bg: 'rgba(40,120,255,0.06)',  border: 'rgba(40,120,255,0.32)',  text: '#5599ff', icon: '◎',  iconColor: '#5599ff' },
  ULTIMATE: { bg: 'rgba(255,80,0,0.08)',    border: 'rgba(255,100,0,0.4)',    text: '#ff8844', icon: '★',  iconColor: '#ffcc88' },
};

/* Render the whole abilities tab for the current character */
function renderAbilitiesTab() {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  renderAbilityCards(c);
  renderCharPassivesUI(c);
}

/* ── Ability Cards ─────────────────────────────────────────── */
function renderAbilityCards(c) {
  const list  = document.getElementById('abilities-list');
  const empty = document.getElementById('abilities-empty');
  if (!list) return;
  const abilities = c.abilities || [];
  if (abilities.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = abilities.map((ab, idx) => {
    const tc = AB_TYPE_COLORS[ab.type] || AB_TYPE_COLORS.ACTIVE;

    const metaItems = [
      ab.cost     && `<span class="ab-meta-item"><span class="ab-meta-label">COST</span><span class="ab-meta-value">${ab.cost}</span></span>`,
      ab.cd       && `<span class="ab-meta-item"><span class="ab-meta-label">CD</span><span class="ab-meta-value">${ab.cd}</span></span>`,
      ab.range    && `<span class="ab-meta-item"><span class="ab-meta-label">RANGE</span><span class="ab-meta-value">${ab.range}</span></span>`,
      ab.cast     && `<span class="ab-meta-item"><span class="ab-meta-label">CAST</span><span class="ab-meta-value">${ab.cast}</span></span>`,
      ab.dmg      && `<span class="ab-meta-item"><span class="ab-meta-label">DMG</span><span class="ab-meta-value">${ab.dmg}</span></span>`,
      ab.duration && `<span class="ab-meta-item"><span class="ab-meta-label">DUR</span><span class="ab-meta-value">${ab.duration}</span></span>`,
    ].filter(Boolean).join('');

    const tags = (ab.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const tagsHtml = tags.map(t => `<span class="ab-tag">${t}</span>`).join('');

    // Left visual: image if set, otherwise large type icon
    const visualHtml = ab.image
      ? `<div class="ab-card-visual"><img class="ab-card-img" src="${ab.image}" alt=""></div>`
      : `<div class="ab-card-visual ab-card-visual-icon" style="--ab-text:${tc.text};--ab-border:${tc.border};">
           <span class="ab-type-icon-lg" style="color:${tc.iconColor || tc.text}">${tc.icon}</span>
         </div>`;

    return `<div class="ab-card" style="--ab-bg:${tc.bg};--ab-border:${tc.border};--ab-text:${tc.text};animation-delay:${idx * 0.065}s">
      <div class="ab-card-main">
        ${visualHtml}
        <div class="ab-card-content">
          <div class="ab-card-top">
            <div class="ab-card-name">${ab.name || 'Unnamed'}</div>
            <span class="ab-type-badge">${tc.icon} ${ab.type || 'ACTIVE'}</span>
          </div>
          ${ab.desc     ? `<div class="ab-card-desc">${renderColorText(ab.desc)}</div>` : ''}
          ${metaItems   ? `<div class="ab-meta-row">${metaItems}</div>` : ''}
          ${tagsHtml    ? `<div class="ab-tags-row">${tagsHtml}</div>` : ''}
          ${ab.notes    ? `<div class="ab-card-notes">✦ ${renderColorText(ab.notes)}</div>` : ''}
          ${ab.req      ? `<div class="ab-card-req">⚠ <span class="ab-meta-label">REQ</span> ${renderColorText(ab.req)}</div>` : ''}
        </div>
      </div>
      <div class="ab-card-footer">
        <button class="btn sm" onclick="openAbilityEditor(${idx})">EDIT</button>
        <button class="btn sm danger" onclick="deleteAbility(${idx})">✕ DELETE</button>
      </div>
    </div>`;
  }).join('');
}

/* ── Type picker ────────────────────────────────────────────── */
function pickAbilityType(type) {
  document.getElementById('ae-type').value = type;
  const selected = AB_TYPE_COLORS[type] || AB_TYPE_COLORS.ACTIVE;
  document.querySelectorAll('.ae-type-btn').forEach(btn => {
    const t    = btn.dataset.type;
    const tc   = AB_TYPE_COLORS[t] || AB_TYPE_COLORS.ACTIVE;
    const isSel = t === type;
    btn.classList.toggle('selected', isSel);
    btn.style.color        = tc.text;
    btn.style.borderColor  = isSel ? tc.text        : tc.text + '33';
    btn.style.background   = isSel ? tc.text + '18' : 'transparent';
    btn.style.boxShadow    = isSel ? `0 0 14px ${tc.text}55, inset 0 0 8px ${tc.text}11` : '';
  });
}

/* ── Ability image ──────────────────────────────────────────── */
function handleAbilityImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { notify('NOT AN IMAGE', 'err'); return; }
  if (file.size > 5 * 1024 * 1024) { notify('IMAGE TOO LARGE (MAX 5 MB)', 'err'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    _abilityEditorImageDataURL = e.target.result;
    _renderAbilityImagePreview();
  };
  reader.readAsDataURL(file);
}

function _renderAbilityImagePreview() {
  const preview  = document.getElementById('ae-img-preview');
  const clearBtn = document.getElementById('ae-img-clear');
  if (!preview) return;
  if (_abilityEditorImageDataURL) {
    preview.innerHTML = `<img src="${_abilityEditorImageDataURL}" alt="Ability image">`;
    if (clearBtn) clearBtn.style.display = '';
  } else {
    preview.innerHTML = '<span class="ae-img-preview-empty">NO IMAGE</span>';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

function clearAbilityImage() {
  _abilityEditorImageDataURL = null;
  _renderAbilityImagePreview();
  const up = document.getElementById('ae-img-upload');
  if (up) up.value = '';
}

/* ── Ability Editor open / close / save / delete ─────────────── */
function openAbilityEditor(idx) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  _abilityEditorIdx = idx;
  const isEdit = (idx !== null && idx !== undefined);
  const ab     = isEdit ? ((c.abilities || [])[idx] || {}) : {};

  document.getElementById('ae-title').textContent = isEdit ? 'EDIT ABILITY' : 'NEW ABILITY';
  document.getElementById('ae-name').value         = ab.name     || '';
  document.getElementById('ae-desc').value         = ab.desc     || '';
  document.getElementById('ae-notes').value        = ab.notes    || '';
  document.getElementById('ae-cost').value         = ab.cost     || '';
  document.getElementById('ae-cd').value           = ab.cd       || '';
  document.getElementById('ae-range').value        = ab.range    || '';
  document.getElementById('ae-cast').value         = ab.cast     || '';
  document.getElementById('ae-tags').value         = ab.tags     || '';
  document.getElementById('ae-dmg').value          = ab.dmg      || '';
  document.getElementById('ae-duration').value     = ab.duration || '';
  document.getElementById('ae-req').value          = ab.req      || '';

  // Type picker
  pickAbilityType(ab.type || 'ACTIVE');

  // Image
  _abilityEditorImageDataURL = ab.image || null;
  _renderAbilityImagePreview();

  // Propagate char colour into the fixed-position modal
  const aeModal = document.getElementById('ability-editor-modal');
  if (aeModal) aeModal.style.setProperty('--char-color', _isNara(c) ? _naraCurrentColor : (c.color || '#888'));

  const overlay = document.getElementById('ability-editor-overlay');
  overlay.style.display = 'flex';
  // Animate modal in
  const modal = document.getElementById('ability-editor-modal');
  if (modal) { modal.style.animation = 'none'; void modal.offsetWidth; modal.style.animation = ''; }
  setTimeout(() => document.getElementById('ae-name').focus(), 80);
}

function closeAbilityEditor() {
  document.getElementById('ability-editor-overlay').style.display = 'none';
  _abilityEditorIdx = null;
  _abilityEditorImageDataURL = null;
  const up = document.getElementById('ae-img-upload');
  if (up) up.value = '';
}

function saveAbility() {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const name = document.getElementById('ae-name').value.trim();
  if (!name) { notify('ABILITY NEEDS A NAME', 'err'); return; }

  if (!c.abilities) c.abilities = [];
  const existingId = (_abilityEditorIdx !== null && _abilityEditorIdx !== undefined)
    ? ((c.abilities[_abilityEditorIdx] || {}).id || null)
    : null;

  const ab = {
    id:       existingId || Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name,
    type:     document.getElementById('ae-type').value,
    desc:     document.getElementById('ae-desc').value.trim(),
    notes:    document.getElementById('ae-notes').value.trim(),
    cost:     document.getElementById('ae-cost').value.trim(),
    cd:       document.getElementById('ae-cd').value.trim(),
    range:    document.getElementById('ae-range').value.trim(),
    cast:     document.getElementById('ae-cast').value.trim(),
    tags:     document.getElementById('ae-tags').value.trim(),
    dmg:      document.getElementById('ae-dmg').value.trim(),
    duration: document.getElementById('ae-duration').value.trim(),
    req:      document.getElementById('ae-req').value.trim(),
    image:    _abilityEditorImageDataURL || null,
  };

  if (_abilityEditorIdx !== null && _abilityEditorIdx !== undefined) {
    c.abilities[_abilityEditorIdx] = ab;
  } else {
    c.abilities.push(ab);
  }

  const wasEditing = (_abilityEditorIdx !== null && _abilityEditorIdx !== undefined);
  saveData(c);
  closeAbilityEditor();
  renderAbilityCards(c);
  notify(wasEditing ? 'ABILITY UPDATED' : 'ABILITY ADDED', 'ok');
}

function deleteAbility(idx) {
  const c = characters.find(x => x.id === currentId);
  if (!c || !c.abilities) return;
  c.abilities.splice(idx, 1);
  saveData(c);
  renderAbilityCards(c);
  notify('ABILITY REMOVED', 'ok');
}

/* ── Character Passives ───────────────────────────────────────── */
function renderCharPassivesUI(c) {
  const list  = document.getElementById('char-passives-list');
  const empty = document.getElementById('char-passives-empty');
  if (!list) return;
  const passives = c.charPassives || [];

  list.innerHTML = passives.map((p, idx) => {
    const safe = p.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return `<div class="char-passive-entry" style="animation-delay:${idx * 0.055}s">
      <div class="char-passive-gem">◆</div>
      <input type="text" class="char-passive-input" value="${safe}"
             placeholder="DESCRIBE PASSIVE TRAIT..." maxlength="200"
             onchange="saveCharPassives()">
      <button class="char-passive-del" onclick="removeCharPassiveRow(${idx})" title="Remove">✕</button>
    </div>`;
  }).join('');

  if (empty) empty.style.display = passives.length === 0 ? '' : 'none';
}

function addCharPassiveRow() {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  if (!c.charPassives) c.charPassives = [];
  c.charPassives.push('');
  saveData(c);
  renderCharPassivesUI(c);
  const inputs = document.querySelectorAll('#char-passives-list .char-passive-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function removeCharPassiveRow(idx) {
  const c = characters.find(x => x.id === currentId);
  if (!c || !c.charPassives) return;
  c.charPassives.splice(idx, 1);
  saveData(c);
  renderCharPassivesUI(c);
}

function saveCharPassives() {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.charPassives = Array.from(document.querySelectorAll('#char-passives-list .char-passive-input'))
    .map(i => i.value);
  saveData(c);
}

// Close ability editor on overlay background click
document.addEventListener('DOMContentLoaded', () => {
  const aeOverlay = document.getElementById('ability-editor-overlay');
  if (aeOverlay) {
    aeOverlay.addEventListener('click', e => {
      if (e.target === aeOverlay) closeAbilityEditor();
    });
  }
  initTextColorToolbar();
  _initStatusTooltip();
});

// ── Status-effect tooltip ──────────────────────────────────────
function _initStatusTooltip() {
  // Inject tooltip element + styles once
  if (document.getElementById('_status-tip')) return;
  const tip = document.createElement('div');
  tip.id = '_status-tip';
  tip.style.cssText = [
    'position:fixed',
    'display:none',
    'z-index:99999',
    'max-width:260px',
    'padding:7px 10px',
    'background:#1a1a2e',
    'border:1px solid #444',
    'border-radius:6px',
    'color:#ddd',
    'font-size:11px',
    'line-height:1.45',
    'pointer-events:none',
    'box-shadow:0 4px 18px rgba(0,0,0,0.7)',
    'white-space:pre-wrap',
    'word-break:break-word',
  ].join(';');
  document.body.appendChild(tip);

  document.addEventListener('mouseover', e => {
    const pill = e.target.closest?.('.status-pill');
    if (!pill) return;
    const desc = pill.dataset.sdesc || '';
    if (!desc) return;
    tip.textContent = desc;
    tip.style.display = 'block';
    _positionStatusTip(e, tip);
  });
  document.addEventListener('mousemove', e => {
    if (tip.style.display === 'none') return;
    if (!e.target.closest?.('.status-pill')) return;
    _positionStatusTip(e, tip);
  });
  document.addEventListener('mouseout', e => {
    const pill = e.target.closest?.('.status-pill');
    if (pill) tip.style.display = 'none';
  });
}
function _positionStatusTip(e, tip) {
  const margin = 12;
  let x = e.clientX + margin;
  let y = e.clientY + margin;
  const tw = tip.offsetWidth || 260;
  const th = tip.offsetHeight || 60;
  if (x + tw > window.innerWidth - 8) x = e.clientX - tw - margin;
  if (y + th > window.innerHeight - 8) y = e.clientY - th - margin;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}
// ──────────────────────────────────────────────────────────────

// ============================================================
// TEXT COLOR TOOLBAR
// ============================================================

let _tctTarget   = null;  // the textarea the selection came from
let _tctSelStart = 0;
let _tctSelEnd   = 0;

/* Parse [c=#hex]...[/c] markup into colored <span>s for rendering */
function renderColorText(raw) {
  if (!raw) return '';
  return String(raw).replace(
    /\[c=(#[0-9a-fA-F]{3,8})\]([\s\S]*?)\[\/c\]/g,
    (_, color, text) => `<span style="color:${color}">${text}</span>`
  );
}

function initTextColorToolbar() {
  // Show toolbar when text is selected inside textareas in the ability editor or passives list
  document.addEventListener('mouseup', e => {
    const tb = document.getElementById('text-color-toolbar');
    if (!tb) return;
    // If click was inside the toolbar itself, don't close it
    if (tb.contains(e.target)) return;

    const ta = e.target.closest('textarea');
    const editorBody  = document.getElementById('ability-editor-body');
    const passiveList = document.getElementById('char-passives-list');
    const inEditor  = editorBody  && editorBody.contains(ta);
    const inPassive = passiveList && passiveList.contains(ta);

    if (!ta || (!inEditor && !inPassive)) {
      hideTextColorToolbar();
      return;
    }

    const selLen = ta.selectionEnd - ta.selectionStart;
    if (selLen < 1) { hideTextColorToolbar(); return; }

    _tctTarget   = ta;
    _tctSelStart = ta.selectionStart;
    _tctSelEnd   = ta.selectionEnd;
    showTextColorToolbar(e.clientX, e.clientY);
  });

  // Also close on Escape or click outside
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideTextColorToolbar();
  });
  document.addEventListener('mousedown', e => {
    const tb = document.getElementById('text-color-toolbar');
    if (tb && !tb.contains(e.target)) hideTextColorToolbar();
  });
}

function showTextColorToolbar(x, y) {
  const tb = document.getElementById('text-color-toolbar');
  if (!tb) return;
  tb.style.display = 'flex';
  // Position above the cursor; clamp to viewport
  const w = tb.offsetWidth  || 220;
  const h = tb.offsetHeight || 80;
  let left = x - 8;
  let top  = y - h - 14;
  if (top  < 8) top  = y + 18;
  if (left + w > window.innerWidth  - 8) left = window.innerWidth  - w - 8;
  if (left < 8) left = 8;
  tb.style.left = left + 'px';
  tb.style.top  = top  + 'px';
}

function hideTextColorToolbar() {
  const tb = document.getElementById('text-color-toolbar');
  if (tb) tb.style.display = 'none';
  _tctTarget = null;
}

function applyTextColor(color) {
  if (!_tctTarget) return;
  const ta    = _tctTarget;
  const start = _tctSelStart;
  const end   = _tctSelEnd;
  const val   = ta.value;
  const sel   = val.substring(start, end);

  let replacement;
  if (color === null) {
    // Strip color markup from selection
    replacement = sel.replace(/\[c=#[0-9a-fA-F]{3,8}\]([\s\S]*?)\[\/c\]/g, '$1');
  } else {
    replacement = `[c=${color}]${sel}[/c]`;
  }

  ta.value = val.substring(0, start) + replacement + val.substring(end);
  ta.selectionStart = start;
  ta.selectionEnd   = start + replacement.length;
  // Fire change so saves pick up the edit
  ta.dispatchEvent(new Event('input',  { bubbles: true }));
  ta.dispatchEvent(new Event('change', { bubbles: true }));
  hideTextColorToolbar();
  ta.focus();
}

function applyTextColorCustom() {
  const inp = document.getElementById('tct-hex');
  if (!inp) return;
  const val = inp.value.trim();
  if (!/^#[0-9a-fA-F]{3,8}$/.test(val)) { notify('INVALID HEX COLOR', 'err'); return; }
  applyTextColor(val);
  inp.value = '';
}

// ============================================================
// INIT
// ============================================================
loadSeenTraits();
migrateLocalStorage();
srInit(); // populate _encStatusMap so status-pill coloring works on trait cards

const sidebarList = document.getElementById('char-list');
if (sidebarList && db) {
  sidebarList.innerHTML = '<div style="padding:20px;font-size:8px;color:#444;text-align:center;letter-spacing:2px;">CONNECTING...</div>';

  db.collection('characters').onSnapshot(snapshot => {
    characters = snapshot.docs
      .map(d => _migrateCharacter(d.data()))
      .sort((a, b) => {
        const ao = a.order != null ? a.order : (a.createdAt || 0);
        const bo = b.order != null ? b.order : (b.createdAt || 0);
        return ao - bo;
      });

    // Auto-discover seen traits from loaded characters
    let updatedSeen = false;
    characters.forEach(c => {
      (c.traits || []).forEach(k => {
        if (TRAITS[k] && !seenTraits.includes(k)) {
          seenTraits.push(k);
          updatedSeen = true;
        }
      });
    });
    if (updatedSeen) saveSeenTraits();

    renderSidebar();
    _preloadThemes(characters);

    const isSelf = (currentId === _lastSaveId && (Date.now() - _lastSaveTime < SELF_WRITE_WINDOW));

    if (currentId) {
      const c = characters.find(x => x.id === currentId);
      if (c) {
        if (!isSelf) {
          // Remote update — refresh the viewed character
          console.log('[FIRESTORE] Listener update (remote):', c.id, 'Theme:', c.info?.themeSong);
          updateGoldDisplay(c);
          updateLiveStats(c);
          renderTraitsDisplay(c);
          renderInventory(c);
          loadPity(); updatePityDisplay();
          // Keep form switcher + avatar in sync (another user may have switched forms)
          renderFormSwitcher(c);
          _syncAvatarEl(c);
        } else {
          console.log('[FIRESTORE] Listener update (self-write):', c.id, 'Theme:', c.info?.themeSong);
        }
      } else {
        // Character missing from snapshot — only treat as a real deletion
        // if it wasn't just saved by us (guards against pre-confirmation snapshots)
        if (currentId === _lastSaveId && Date.now() - _lastSaveTime < SELF_WRITE_WINDOW) return;
        currentId = null; stopBgAnim();
        document.getElementById('char-view').classList.remove('active');
        document.getElementById('editor').classList.remove('active');
        if (characters.length) viewChar(characters[0].id);
        else { document.getElementById('empty-state').style.display = ''; randomizeHeart(); }
      }
    } else if (characters.length) {
      document.getElementById('empty-state').style.display = 'none';
      viewChar(characters[0].id);
    } else {
      const emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.style.display = '';
      randomizeHeart();
    }
  }, err => {
    console.error('Firestore error:', err);
    notify('CONNECTION ERROR', 'err');
  });

  db.collection('folders').orderBy('order').onSnapshot(snap => {
    folders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSidebar();
  }, () => { });

} else if (sidebarList) {
  // No Firebase — silent localStorage fallback
  loadData();
  renderSidebar();
  if (characters.length) viewChar(characters[0].id);
  else { document.getElementById('empty-state').style.display = ''; randomizeHeart(); }
}

window.addEventListener('resize', () => {
  if (currentId && bgAnim) {
    const c = characters.find(x => x.id === currentId);
    const _rePtype = _isBizzy(c) ? 'bizzy_bees' : c?.pattern?.type;
    if (_rePtype && _rePtype !== 'none') { stopBgAnim(); startBgAnim(_rePtype, c?.pattern?.params || {}); }
  }
});

// ============================================================
// GLOBAL SOUND TRIGGERS
// ============================================================
// CHARACTER COMPARISON
// ============================================================
function openCompare() {
  const modal = document.getElementById('compare-modal');
  const overlay = document.getElementById('compare-modal-overlay');
  if (!modal) return;
  const opts = characters.filter(c => !c.isPlaceholder)
    .map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const sa = document.getElementById('compare-sel-a');
  const sb = document.getElementById('compare-sel-b');
  sa.innerHTML = `<option value="">--</option>` + opts;
  sb.innerHTML = `<option value="">--</option>` + opts;
  if (currentId) sa.value = currentId;
  overlay.classList.add('open');
  modal.classList.add('open');
  renderCompare();
}
function closeCompare() {
  document.getElementById('compare-modal-overlay')?.classList.remove('open');
  document.getElementById('compare-modal')?.classList.remove('open');
}
function renderCompare() {
  const aId = document.getElementById('compare-sel-a')?.value;
  const bId = document.getElementById('compare-sel-b')?.value;
  const out = document.getElementById('compare-content');
  if (!out) return;
  if (!aId || !bId || aId === bId) {
    out.innerHTML = `<div style="text-align:center;color:#444;font-size:8px;padding:24px;letter-spacing:1px;">SELECT TWO DIFFERENT CHARACTERS</div>`;
    return;
  }
  const a = characters.find(x => x.id === aId);
  const b = characters.find(x => x.id === bId);
  if (!a || !b) return;
  const ea = getEffectiveStats(a), eb = getEffectiveStats(b);
  const KEYS = ['hp', 'atk', 'def', 'mag', 'spd', 'iq', 'heal_pow', 'crit_rate', 'crit_dmg', 'status_res', 'dexterity', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'];
  const LABELS = { hp: 'HP', atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD', iq: 'IQ', heal_pow: 'HEAL POW', crit_rate: 'CRIT%', crit_dmg: 'CRIT DMG', status_res: 'STATUS RES', dexterity: 'DEX', resilience: 'RESIL', true_dmg: 'TRUE DMG', lifesteal: 'LIFESTEAL', cooldown_red: 'CDR' };
  const ICONS = {
    hp: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:var(--accent-green);flex-shrink:0"><path d="M5 9L1 5A2.5 2.5 0 0 1 5 2 2.5 2.5 0 0 1 9 5Z" fill="currentColor"/></svg>`,
    atk: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:var(--accent-red);flex-shrink:0"><path d="M2 8l1 1 6-6-1-1-6 6zM1 9l2-1-1-1-1 2z" fill="currentColor"/></svg>`,
    def: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:var(--accent-blue);flex-shrink:0"><path d="M1 2v4c0 3 4 3.5 4 3.5s4-.5 4-3.5V2l-4-1-4 1z" fill="currentColor"/></svg>`,
    mag: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#ff44ff;flex-shrink:0"><path d="M5 1l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill="currentColor"/></svg>`,
    spd: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:var(--accent-yellow);flex-shrink:0"><path d="M6 0L2 5H5L4 10L9 4H5Z" fill="currentColor"/></svg>`,
    iq:  `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#00bbcc;flex-shrink:0"><path d="M4 2C3 2 2 3 2 4.5c0 1 .5 2 1.5 2.5C3 8.5 4 8.5 5 8.5c1 0 2 0 1.5-1.5C7.5 6.5 8 5.5 8 4.5 8 3 7 2 6 2c-.5 0-1 .2-1 .5C5 2.2 4.5 2 4 2zm1 .5V8M3.5 4C4 3.5 4.5 3.6 4.5 4.1M5.5 4C6 3.5 6.5 3.6 6.5 4.1M3.5 5.7C4 5.2 4.5 5.3 4.5 5.8M5.5 5.7C6 5.2 6.5 5.3 6.5 5.8" fill="none" stroke="currentColor" stroke-width="0.75" stroke-linecap="round"/></svg>`,
    heal_pow: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#88ff88;flex-shrink:0"><path d="M4 1h2v3h3v2H6v3H4V6H1V4h3z" fill="currentColor"/></svg>`,
    crit_rate: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#ff8888;flex-shrink:0"><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" stroke-width="1"/><circle cx="5" cy="5" r="1.5" fill="currentColor"/></svg>`,
    crit_dmg: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#cc0000;flex-shrink:0"><path d="M5 0l1.5 3.5L10 5l-3.5 1.5L5 10l-1.5-3.5L0 5l3.5-1.5z" fill="currentColor"/></svg>`,
    status_res: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#00ccaa;flex-shrink:0"><path d="M1 2v4c0 3 4 3.5 4 3.5s4-.5 4-3.5V2l-4-1z" fill="none" stroke="currentColor" stroke-width="1"/><path d="M5 4l1 1-1 1-1-1z" fill="currentColor"/></svg>`,
    dexterity: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#ffff88;flex-shrink:0"><path d="M2 8c1-2 4-2 6-4-1 2-4 2-6 4z" fill="currentColor"/><circle cx="8" cy="2" r="1" fill="currentColor"/></svg>`,
    resilience: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#8800cc;flex-shrink:0"><path d="M5 9L1 5A2.5 2.5 0 0 1 5 2 2.5 2.5 0 0 1 9 5Z" fill="none" stroke="currentColor" stroke-width="1"/><rect x="4" y="3" width="2" height="4" fill="currentColor"/></svg>`,
    true_dmg: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#ffffff;flex-shrink:0"><path d="M5 0 L10 5 L5 10 L0 5 Z" fill="currentColor"/></svg>`,
    lifesteal: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#aa0000;flex-shrink:0"><path d="M5 0 Q5 5 2 7 A3 3 0 0 0 8 7 Q5 5 5 0 Z" fill="currentColor"/></svg>`,
    cooldown_red: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#00aaff;flex-shrink:0"><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" stroke-width="1"/><path d="M5 2 L5 5 L7 7" fill="none" stroke="currentColor" stroke-width="1"/></svg>`,
  };
  const globalMax = Math.max(...KEYS.flatMap(k => [+(ea[k] || 0), +(eb[k] || 0)]), 1);
  const rows = KEYS.map(k => {
    const va = +(ea[k] || 0).toFixed(1), vb = +(eb[k] || 0).toFixed(1);
    const pctA = Math.round((va / globalMax) * 100);
    const pctB = Math.round((vb / globalMax) * 100);
    const winA = va > vb, winB = vb > va;
    const barColorA = winA ? (_isNara(a) ? _naraCurrentColor : (a.color || '#4aff9e')) : '#333';
    const barColorB = winB ? (_isNara(b) ? _naraCurrentColor : (b.color || '#4aff9e')) : '#333';
    return `<div class="cmp-row">
      <div class="cmp-side-a">
        <span class="cmp-val ${winA ? 'cmp-win' : va < vb ? 'cmp-lose' : ''}">${va}</span>
        <div class="cmp-bar-wrap cmp-bar-a"><div class="cmp-bar" style="width:${pctA}%;background:${barColorA};"></div></div>
      </div>
      <div class="cmp-center">${ICONS[k] || ''}<span class="cmp-key">${LABELS[k]}</span></div>
      <div class="cmp-side-b">
        <div class="cmp-bar-wrap cmp-bar-b"><div class="cmp-bar" style="width:${pctB}%;background:${barColorB};"></div></div>
        <span class="cmp-val ${winB ? 'cmp-win' : vb < va ? 'cmp-lose' : ''}">${vb}</span>
      </div>
    </div>`;
  }).join('');
  out.innerHTML = `
    <div class="cmp-names">
      <span ${_isNara(a) ? 'class="nara-rainbow"' : `style="color:${a.color}"`}>${a.name}</span>
      <span class="cmp-vs">VS</span>
      <span ${_isNara(b) ? 'class="nara-rainbow"' : `style="color:${b.color}"`}>${b.name}</span>
    </div>
    <div class="cmp-rows">${rows}</div>`;
}

// ============================================================
// TIER LIST (utilities page)
// ============================================================
const TIER_DEFS = ['S', 'A', 'B', 'C', 'D', 'F'];
let _tierData = { S: [], A: [], B: [], C: [], D: [], F: [] };
let _tierLists = [];   // [{ id, name, S, A, B, C, D, F, createdAt }]
let _activeTierListId = null;

function buildTierChipTooltip(charId) {
  const c = characters.find(x => x.id === charId);
  if (!c) return '';
  const e = getEffectiveStats(c);
  const fmt = v => (v % 1 === 0 ? v : +v.toFixed(1));
  const main = [
    ['HP', e.hp, 'var(--accent-green)'],
    ['ATK', e.atk, 'var(--accent-red)'],
    ['DEF', e.def, 'var(--accent-blue)'],
    ['MAG', e.mag, '#ff44ff'],
    ['SPD', e.spd, 'var(--accent-yellow)'],
  ];
  const subs = [
    ['CRIT%', e.crit_rate, '#ff8888'],
    ['CRIT DMG', e.crit_dmg, '#cc0000'],
    ['HEAL POW', e.heal_pow, '#88ff88'],
    ['STATUS RES', e.status_res, '#00ccaa'],
    ['DEX', e.dexterity, '#ffff88'],
    ['RESIL', e.resilience, '#8800cc'],
    ['TRUE DMG', e.true_dmg, '#ffffff'],
    ['LIFESTEAL', e.lifesteal, '#aa0000'],
    ['CDR', e.cooldown_red, '#00aaff'],
  ].filter(([, v]) => v > 0);
  const RAR_COL = { common: 'var(--rar-common-fg)', rare: 'var(--rar-rare-fg)', epic: 'var(--rar-epic-fg)', legendary: 'var(--rar-legendary-fg)', mythic: 'var(--rar-mythic-fg)', hexxed: 'var(--rar-hexxed-fg)' };

  let html = `<div style="color:${c.color};font-size:9px;letter-spacing:1px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #222;">${c.name}</div>`;

  // Main stats
  html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;${subs.length ? 'margin-bottom:8px;' : ''}">`;
  main.forEach(([lbl, val, col]) => {
    html += `<div style="font-size:7px;letter-spacing:1px;"><span style="color:#555;">${lbl}:</span> <span style="color:${col};">${fmt(val)}</span></div>`;
  });
  html += '</div>';

  // Sub stats
  if (subs.length) {
    html += `<div style="border-top:1px solid #1a1a1a;padding-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;margin-bottom:8px;">`;
    subs.forEach(([lbl, val, col]) => {
      html += `<div style="font-size:7px;letter-spacing:1px;"><span style="color:#555;">${lbl}:</span> <span style="color:${col};">${fmt(val)}%</span></div>`;
    });
    html += '</div>';
  }

  // Traits
  const traitKeys = (c.traits || []).filter(k => TRAITS[k]);
  if (traitKeys.length) {
    html += `<div style="border-top:1px solid #1a1a1a;padding-top:7px;display:flex;flex-direction:column;gap:6px;">`;
    traitKeys.forEach(k => {
      const t = getTraitDef(c, k);
      const rarity = TRAITS[k].rarity;
      const col = RAR_COL[rarity] || '#aaa';
      html += `<div>
        <div style="color:${col};font-size:7px;letter-spacing:1px;margin-bottom:2px;">${(RARITY_LABEL[rarity] || rarity).toUpperCase()} — ${t.name}</div>
        <div style="color:#888;font-size:6px;letter-spacing:0.5px;line-height:1.5;">${t.desc}</div>
      </div>`;
    });
    html += '</div>';
  }

  return html;
}

function initTierList() {
  if (!document.getElementById('tier-list-wrap')) return;
  if (db) {
    // On utilities page there's no #char-list — spin up a dedicated characters listener.
    if (!document.getElementById('char-list')) {
      db.collection('characters').onSnapshot(snap => {
        characters = snap.docs.map(d => d.data()).sort((a, b) => {
          const ao = a.order != null ? a.order : (a.createdAt || 0);
          const bo = b.order != null ? b.order : (b.createdAt || 0);
          return ao - bo;
        });
        renderTierList();
        renderLeaderboard();
        if (typeof compatInit === 'function') compatInit();
        if (typeof nmtInit    === 'function') nmtInit();
      });
    }
    // Multi-list: listen to the whole tierlists collection
    db.collection('tierlists').orderBy('createdAt').onSnapshot(snap => {
      _tierLists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!_tierLists.length) { createTierList('MAIN'); return; }
      // Keep active id if still valid; otherwise default to first
      if (!_activeTierListId || !_tierLists.find(t => t.id === _activeTierListId)) {
        _activeTierListId = _tierLists[0].id;
      }
      const active = _tierLists.find(t => t.id === _activeTierListId);
      _tierData = { S: [], A: [], B: [], C: [], D: [], F: [], ...active };
      renderTierListTabs();
      renderTierList();
    });
    return;
  }
  // No Firebase — localStorage fallback (single list)
  try { const s = localStorage.getItem('tierlist_v1'); if (s) _tierData = { S: [], A: [], B: [], C: [], D: [], F: [], ...JSON.parse(s) }; } catch (e) { }
  if (!characters.length) { setTimeout(initTierList, 600); return; }
  renderTierList();
}

function saveTierList() {
  if (db && _activeTierListId) {
    db.collection('tierlists').doc(_activeTierListId).update({
      S: _tierData.S || [], A: _tierData.A || [], B: _tierData.B || [],
      C: _tierData.C || [], D: _tierData.D || [], F: _tierData.F || [],
    }).catch(err => console.error('TierList save:', err));
  } else if (!db) {
    localStorage.setItem('tierlist_v1', JSON.stringify(_tierData));
  }
}

function createTierList(name) {
  if (!db) return;
  const ref = db.collection('tierlists').doc();
  _activeTierListId = ref.id;
  ref.set({ name: name.toUpperCase(), S: [], A: [], B: [], C: [], D: [], F: [], createdAt: Date.now() })
    .catch(err => console.error('Create tier list:', err));
}

function switchTierList(id) {
  _activeTierListId = id;
  const list = _tierLists.find(t => t.id === id);
  _tierData = { S: [], A: [], B: [], C: [], D: [], F: [], ...(list || {}) };
  renderTierListTabs();
  renderTierList();
}

async function deleteTierList(id) {
  if (_tierLists.length <= 1) { notify('CANNOT DELETE THE LAST LIST', 'err'); return; }
  const ok = await confirm2('DELETE THIS TIER LIST?');
  if (!ok) return;
  if (_activeTierListId === id) {
    const other = _tierLists.find(t => t.id !== id);
    if (other) switchTierList(other.id);
  }
  db.collection('tierlists').doc(id).delete().catch(err => console.error('Delete tier list:', err));
}

function promptNewTierList() {
  const tabs = document.getElementById('tier-list-tabs');
  if (!tabs || tabs.querySelector('.tl-new-input')) return;
  const div = document.createElement('div');
  div.className = 'tl-tab tl-new-input';
  div.innerHTML = `<input id="tl-new-name" type="text" placeholder="NAME" maxlength="16"
    style="font-family:inherit;font-size:7px;background:transparent;color:#eee;border:none;outline:none;width:72px;letter-spacing:1px;text-transform:uppercase;"/>
    <button onclick="confirmNewTierList()" style="background:none;border:none;color:var(--accent-green);cursor:pointer;font-family:inherit;font-size:10px;padding:0 2px;">✓</button>
    <button onclick="this.closest('.tl-new-input').remove()" style="background:none;border:none;color:#555;cursor:pointer;font-family:inherit;font-size:10px;padding:0;">✕</button>`;
  // Insert before the + button (last child)
  tabs.insertBefore(div, tabs.lastElementChild);
  const inp = div.querySelector('#tl-new-name');
  inp.focus();
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') confirmNewTierList();
    if (e.key === 'Escape') div.remove();
  });
}

function confirmNewTierList() {
  const inp = document.getElementById('tl-new-name');
  if (!inp) return;
  const name = inp.value.trim();
  inp.closest('.tl-new-input').remove();
  if (name) createTierList(name);
}

function renameTierList(id, el) {
  const original = el.textContent;
  el.contentEditable = 'true';
  el.focus();
  const sel = window.getSelection(), range = document.createRange();
  range.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(range);
  const finish = () => {
    el.contentEditable = 'false';
    const newName = el.textContent.trim().toUpperCase() || original;
    el.textContent = newName;
    if (db && newName !== original) {
      db.collection('tierlists').doc(id).update({ name: newName }).catch(() => { });
    }
  };
  el.addEventListener('blur', finish, { once: true });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = original; el.blur(); }
  });
}

function renderTierListTabs() {
  const wrap = document.getElementById('tier-list-tabs');
  if (!wrap) return;
  wrap.innerHTML = _tierLists.map(t => `
    <div class="tl-tab${t.id === _activeTierListId ? ' active' : ''}" onclick="switchTierList('${t.id}')">
      <span class="tl-tab-name" ondblclick="event.stopPropagation();renameTierList('${t.id}',this)">${t.name}</span>
      ${_tierLists.length > 1
      ? `<button class="tl-tab-del" onclick="event.stopPropagation();deleteTierList('${t.id}')">&times;</button>`
      : ''}
    </div>`).join('') +
    `<button class="tl-tab-add" onclick="promptNewTierList()">+</button>`;
}

function renderTierList() {
  const wrap = document.getElementById('tier-list-wrap');
  if (!wrap) return;
  // Clear cached tooltips so re-renders pick up fresh stats
  wrap.querySelectorAll('.tier-chip[data-tooltip]').forEach(el => delete el.dataset.tooltip);
  const TIER_COLORS = { S: '#ff4a4a', A: '#ff884a', B: '#ffcc4a', C: '#4aff9e', D: '#4a9eff', F: '#888888' };
  const rankedIds = new Set(TIER_DEFS.flatMap(t => _tierData[t] || []));
  const unranked = characters.filter(c => !c.isPlaceholder && !rankedIds.has(c.id));
  wrap.innerHTML = TIER_DEFS.map(tier => `
    <div class="tier-row">
      <div class="tier-label" style="color:${TIER_COLORS[tier]};border-color:${TIER_COLORS[tier]};">${tier}</div>
      <div class="tier-slots" id="tier-slots-${tier}"
        onclick="placeTierChip('${tier}')"
        ondragover="event.preventDefault();this.classList.add('tier-drag-over')"
        ondragleave="this.classList.remove('tier-drag-over')"
        ondrop="dropOnTier(event,'${tier}')">
        ${(_tierData[tier] || []).map(id => tierChip(id, tier)).join('')}
      </div>
    </div>`).join('') +
    `<div class="tier-pool-label">UNRANKED</div>
    <div class="tier-pool" id="tier-pool"
      onclick="placeTierChip(null)"
      ondragover="event.preventDefault();this.classList.add('tier-drag-over')"
      ondragleave="this.classList.remove('tier-drag-over')"
      ondrop="dropOnTier(event,null)">
      ${unranked.map(c => tierChip(c.id, null)).join('')}
    </div>`;
}

let _selectedTierChip = null;

function selectTierChip(charId) {
  _selectedTierChip = (_selectedTierChip === charId) ? null : charId;
  document.querySelectorAll('.tier-chip').forEach(el => {
    el.classList.toggle('tier-chip-selected', el.dataset.charId === _selectedTierChip);
  });
}

function placeTierChip(tier) {
  if (!_selectedTierChip) return;
  const charId = _selectedTierChip;
  _selectedTierChip = null;
  TIER_DEFS.forEach(t => { _tierData[t] = (_tierData[t] || []).filter(id => id !== charId); });
  if (tier) { if (!_tierData[tier]) _tierData[tier] = []; _tierData[tier].push(charId); }
  saveTierList();
  renderTierList();
}

function tierChip(charId, tier) {
  const c = characters.find(x => x.id === charId);
  if (!c) return '';
  const av = c.avatar
    ? `<img src="${c.avatar}" style="width:22px;height:22px;object-fit:cover;"/>`
    : `<svg viewBox="0 0 32 32" style="width:22px;height:22px;"><rect x="12" y="2" width="8" height="8" fill="${c.color}"/><rect x="10" y="10" width="12" height="10" fill="${c.color}"/><rect x="8" y="20" width="6" height="8" fill="${c.color}"/><rect x="18" y="20" width="6" height="8" fill="${c.color}"/></svg>`;
  const isSelected = _selectedTierChip === charId;
  const t = tier ? `'${tier}'` : 'null';
  return `<div class="tier-chip${isSelected ? ' tier-chip-selected' : ''}" draggable="true" data-char-id="${charId}" title="${c.name}" style="border-color:${c.color}"
    onclick="event.stopPropagation();selectTierChip('${charId}')"
    ondragstart="event.dataTransfer.setData('text/plain','${charId}');this.classList.add('dragging')"
    ondragend="document.querySelectorAll('.chip-drop-before,.chip-drop-after').forEach(e=>e.classList.remove('chip-drop-before','chip-drop-after'));this.classList.remove('dragging')"
    ondragover="event.preventDefault();event.stopPropagation();chipDragOver(event,this)"
    ondragleave="this.classList.remove('chip-drop-before','chip-drop-after')"
    ondrop="event.stopPropagation();chipDrop(event,this,${t},'${charId}')">
    ${av}
    <span class="tier-chip-name" style="color:${c.color}">${c.name}</span>
  </div>`;
}

function chipDragOver(e, el) {
  const mid = el.getBoundingClientRect().left + el.offsetWidth / 2;
  if (e.clientX < mid) {
    el.classList.add('chip-drop-before');
    el.classList.remove('chip-drop-after');
  } else {
    el.classList.add('chip-drop-after');
    el.classList.remove('chip-drop-before');
  }
}

function chipDrop(e, el, tier, targetCharId) {
  e.preventDefault();
  el.classList.remove('chip-drop-before', 'chip-drop-after');
  const draggedId = e.dataTransfer.getData('text/plain');
  if (!draggedId || draggedId === targetCharId) return;
  const insertBefore = e.clientX < el.getBoundingClientRect().left + el.offsetWidth / 2;
  // Remove dragged from all tiers
  TIER_DEFS.forEach(t => { _tierData[t] = (_tierData[t] || []).filter(id => id !== draggedId); });
  if (tier) {
    const arr = _tierData[tier] = (_tierData[tier] || []);
    const idx = arr.indexOf(targetCharId);
    arr.splice(insertBefore ? idx : idx + 1, 0, draggedId);
  }
  saveTierList();
  renderTierList();
}

function dropOnTier(e, tier) {
  e.preventDefault();
  document.querySelectorAll('.tier-slots,.tier-pool').forEach(el => el.classList.remove('tier-drag-over'));
  const charId = e.dataTransfer.getData('text/plain');
  if (!charId) return;
  TIER_DEFS.forEach(t => { _tierData[t] = (_tierData[t] || []).filter(id => id !== charId); });
  if (tier) { if (!_tierData[tier]) _tierData[tier] = []; _tierData[tier].push(charId); }
  saveTierList();
  renderTierList();
}

// ============================================================
// STAT LEADERBOARD
// ============================================================
let _leaderboardStat = 'avg';
let _lbView = 'list';

function selectLeaderboardStat(stat, btn) {
  _leaderboardStat = stat;
  document.querySelectorAll('.lb-stat-btn').forEach(b => b.classList.remove('accent'));
  if (btn) btn.classList.add('accent');
  renderLeaderboard();
}

function setLbView(view, btn) {
  _lbView = view;
  document.querySelectorAll('.lb-view-btn').forEach(b => b.classList.remove('accent'));
  if (btn) btn.classList.add('accent');
  const statRow = document.getElementById('lb-stat-row');
  const axisRow = document.getElementById('lb-axis-row');
  // Show stat selector only when a single-stat chart is active
  const showStat = view === 'list' || view === 'bars' || view === 'radial';
  if (statRow) statRow.style.display = showStat ? 'flex' : 'none';
  if (axisRow) axisRow.style.display = 'none';
  renderLeaderboard();
}

const AVG_STATS = ['hp', 'atk', 'def', 'mag', 'spd'];
const _LB_STAT_LABELS = {
  avg:'BALANCED', hp:'HP', atk:'ATK', def:'DEF', mag:'MAG', spd:'SPD', iq:'IQ',
  heal_pow:'HEAL', crit_rate:'CRIT%', crit_dmg:'CRIT DMG',
  status_res:'STATUS RES', dexterity:'DEX', resilience:'RESIL',
  true_dmg:'TRUE DMG', lifesteal:'LIFESTEAL', cooldown_red:'CDR'
};

function getLeaderboardVal(c, stat) {
  const e = getEffectiveStats(c);
  if (stat === 'avg') {
    const vals = AVG_STATS.map(s => Math.max(e[s] || 0, 1));
    const geo = Math.pow(vals.reduce((p, v) => p * v, 1), 1 / vals.length);
    const iqBonus = Math.pow(Math.max(e.iq || 1, 1), 0.01);
    return geo * iqBonus;
  }
  return e[stat] || 0;
}

// ── Hover tooltip (pfp + stats) ───────────────────────────────
let _lbCharsForTip = [];

function _lbInitTooltip() {
  const wrap = document.getElementById('leaderboard-wrap');
  if (!wrap || wrap._lbTipInited) return;
  wrap._lbTipInited = true;
  wrap.addEventListener('mousemove', e => {
    const el = e.target.closest('[data-lb-char]');
    if (!el) { _lbHideTip(); return; }
    const c = _lbCharsForTip[+el.getAttribute('data-lb-char')];
    if (c) _lbShowTip(e, c);
  });
  wrap.addEventListener('mouseleave', _lbHideTip);
}

function _lbShowTip(e, c) {
  let tip = document.getElementById('lb-hover-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'lb-hover-tip';
    document.body.appendChild(tip);
  }
  const av = c.avatar
    ? `<img src="${c.avatar}" style="width:52px;height:52px;object-fit:cover;border:1px solid ${c.color||'#333'};display:block;margin-bottom:8px;">`
    : `<div style="width:52px;height:6px;background:${c.color||'#222'};margin-bottom:8px;"></div>`;
  const statRows = ['hp','atk','def','mag','spd','iq'].map(s => {
    const v = getLeaderboardVal(c, s);
    return `<div class="lb-tip-row"><span class="lb-tip-sl">${(_LB_STAT_LABELS[s]||s).toUpperCase()}</span><span class="lb-tip-sv" style="color:${c.color||'#aaa'}">${v.toFixed(0)}</span></div>`;
  }).join('');
  tip.innerHTML = `${av}<div class="lb-tip-name" style="color:${c.color||'#ccc'}">${_esc(c.name||'?')}</div>${statRows}`;
  tip.style.display = 'block';
  tip.style.borderColor = c.color || '#252535';
  const tx = e.clientX + 16, ty = e.clientY + 10;
  tip.style.left = Math.min(tx, window.innerWidth - 195) + 'px';
  tip.style.top  = Math.min(ty, window.innerHeight - 230) + 'px';
}

function _lbHideTip() {
  const tip = document.getElementById('lb-hover-tip');
  if (tip) tip.style.display = 'none';
}

function renderLeaderboard() {
  const wrap = document.getElementById('leaderboard-wrap');
  if (!wrap) return;
  const chars = characters.filter(c => !c.isPlaceholder);
  _lbCharsForTip = chars;
  _lbInitTooltip();
  if (!chars.length) {
    wrap.innerHTML = `<div style="text-align:center;color:#444;font-size:8px;padding:24px;letter-spacing:1px;">NO CHARACTERS</div>`;
    return;
  }
  if (_lbView === 'radar')  { _renderLbRadar(wrap, chars);  return; }
  if (_lbView === 'bars')   { _renderLbBars(wrap, chars);   return; }
  if (_lbView === 'radial') { _renderLbRadial(wrap, chars); return; }
  if (_lbView === 'lines')  { _renderLbLines(wrap, chars);  return; }
  _renderLbList(wrap, chars);
}

// ── List (default) ────────────────────────────────────────────
function _renderLbList(wrap, chars) {
  const stat = _leaderboardStat;
  const ranked = chars
    .map(c => ({ c, val: +getLeaderboardVal(c, stat).toFixed(1) }))
    .sort((a, b) => b.val - a.val);
  const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];
  const isSub = ['heal_pow','crit_rate','crit_dmg','status_res','dexterity','resilience','true_dmg','lifesteal','cooldown_red'].includes(stat);
  wrap.innerHTML = ranked.map(({ c, val }, i) => {
    const av = c.avatar
      ? `<img src="${c.avatar}" style="width:28px;height:28px;object-fit:cover;border:1px solid ${c.color};flex-shrink:0;">`
      : `<svg viewBox="0 0 32 32" style="width:28px;height:28px;flex-shrink:0;"><rect x="12" y="2" width="8" height="8" fill="${c.color}"/><rect x="10" y="10" width="12" height="10" fill="${c.color}"/><rect x="8" y="20" width="6" height="8" fill="${c.color}"/><rect x="18" y="20" width="6" height="8" fill="${c.color}"/></svg>`;
    const fmtVal = (val % 1 === 0 ? val : val.toFixed(1)) + (isSub ? '%' : '');
    const rowBg = i < 3 ? `background:${(RANK_COLORS[i] || '#2a2a2a')}11;` : '';
    return `<div class="lb-row" style="${rowBg}">
      <span class="lb-rank" style="color:${RANK_COLORS[i] || '#333'}">#${i + 1}</span>
      ${av}
      <span class="lb-name" style="color:${c.color}">${c.name}</span>
      <span class="lb-val">${fmtVal}</span>
    </div>`;
  }).join('');
}

// ── Radar / Spider web ────────────────────────────────────────
// Capped at 15 chars (top by avg), percentile rank normalization, no SVG filter
function _renderLbRadar(wrap, chars) {
  const STATS  = ['hp','atk','def','mag','spd','iq'];
  const LBLS   = STATS.map(s => _LB_STAT_LABELS[s] || s.toUpperCase());
  const CAP    = 15;
  const all    = [...chars].sort((a,b) => getLeaderboardVal(b,'avg') - getLeaderboardVal(a,'avg'));
  const subset = all.slice(0, CAP);          // top-15 only for readability
  const capped = chars.length > CAP;
  const W = 520, H = 360, cx = W/2, cy = H/2, R = 134;
  const N = STATS.length;
  const ang = i => -Math.PI/2 + (2*Math.PI*i)/N;
  const n = subset.length;

  // Percentile rank within the shown subset
  const rankOf = {};
  STATS.forEach(s => {
    const sorted = [...subset].sort((a,b) => getLeaderboardVal(a,s) - getLeaderboardVal(b,s));
    rankOf[s] = new Map(sorted.map((c,i) => [c, n > 1 ? i/(n-1) : 0.5]));
  });
  const pct = (s, c) => rankOf[s].get(c) ?? 0.5;

  // Rings + spokes
  let bg = '';
  [0.25, 0.5, 0.75, 1].forEach(t => {
    const pts = STATS.map((_,i) => `${(cx+R*t*Math.cos(ang(i))).toFixed(1)},${(cy+R*t*Math.sin(ang(i))).toFixed(1)}`);
    bg += `<polygon points="${pts.join(' ')}" fill="${t===1?'none':'rgba(255,255,255,0.01)'}" stroke="${t===1?'#1c1c2a':'#0d0d18'}" stroke-width="${t===1?1.2:0.6}"/>`;
  });
  STATS.forEach((_,i) => {
    bg += `<line x1="${cx}" y1="${cy}" x2="${(cx+R*Math.cos(ang(i))).toFixed(1)}" y2="${(cy+R*Math.sin(ang(i))).toFixed(1)}" stroke="#0e0e18" stroke-width="0.7"/>`;
  });
  LBLS.forEach((lbl, i) => {
    const lx = cx + (R+18)*Math.cos(ang(i));
    const ly = cy + (R+18)*Math.sin(ang(i));
    const anchor = Math.cos(ang(i)) > 0.1 ? 'start' : Math.cos(ang(i)) < -0.1 ? 'end' : 'middle';
    const maxVal = Math.max(...subset.map(c => getLeaderboardVal(c, STATS[i])));
    bg += `<text x="${lx.toFixed(1)}" y="${(ly+2).toFixed(1)}" text-anchor="${anchor}" fill="#252535" font-size="7.5" letter-spacing="1.5">${lbl}</text>`;
    bg += `<text x="${lx.toFixed(1)}" y="${(ly+11).toFixed(1)}" text-anchor="${anchor}" fill="#181826" font-size="6">${maxVal.toFixed(0)}</text>`;
  });

  // No SVG filter — too slow with many elements
  const polys = subset.map(c => {
    const origIdx = chars.indexOf(c);
    const pts = STATS.map((s, i) => {
      const r = pct(s, c) * R;
      return `${(cx + r*Math.cos(ang(i))).toFixed(1)},${(cy + r*Math.sin(ang(i))).toFixed(1)}`;
    });
    const col = c.color || '#888';
    return `<polygon points="${pts.join(' ')}" fill="${col}" fill-opacity="0.08" stroke="${col}" stroke-width="1.1" stroke-opacity="0.65" data-lb-char="${origIdx}" style="cursor:pointer"/>`;
  }).join('');

  const note = capped ? `<text x="${W/2}" y="${H-4}" text-anchor="middle" fill="#1a1a26" font-size="6" letter-spacing="1">TOP ${CAP} BY AVG · ${chars.length} TOTAL</text>` : '';

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="lb-chart-svg">
    <rect width="${W}" height="${H}" fill="#050508"/>
    ${bg}${polys}${note}
  </svg>`;
}

// ── Horizontal bars ───────────────────────────────────────────
function _renderLbBars(wrap, chars) {
  const stat   = _leaderboardStat;
  const sorted = [...chars].sort((a,b) => getLeaderboardVal(b,stat) - getLeaderboardVal(a,stat));
  const maxVal = Math.max(...sorted.map(c => getLeaderboardVal(c, stat)), 1);
  const W = 520, rowH = 16;
  const pad = { l: 112, r: 56, t: 14, b: 10 };
  const H  = pad.t + sorted.length * rowH + pad.b;
  const pw = W - pad.l - pad.r;

  const defs = `<defs>
    <filter id="lb-bar-glow" x="-5%" y="-80%" width="115%" height="260%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  const MEDALS = ['🥇','🥈','🥉'];
  const rows = sorted.map((c, i) => {
    const origIdx = chars.indexOf(c);
    const val = getLeaderboardVal(c, stat);
    const bw  = Math.max((val/maxVal)*pw, 1);
    const y   = pad.t + i*rowH;
    const col = c.color || '#888';
    const stripe = i%2===0 ? `<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="rgba(255,255,255,0.007)"/>` : '';
    const rnk = i < 3 ? MEDALS[i] : `#${i+1}`;
    return `${stripe}<g data-lb-char="${origIdx}" style="cursor:pointer">
    <rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent"/>
    <text x="5" y="${y+rowH/2+2.5}" fill="#1c1c2c" font-size="${i<3?8:7}">${rnk}</text>
    <text x="${pad.l-5}" y="${y+rowH/2+2.5}" text-anchor="end" fill="${col}" font-size="7.5" opacity="0.9">${_esc((c.name||'?').substring(0,13))}</text>
    <rect x="${pad.l}" y="${y+3.5}" width="${bw}" height="${rowH-7}" fill="${col}" fill-opacity="0.78" rx="2" filter="url(#lb-bar-glow)"/>
    <line x1="${pad.l}" y1="${y+3.5}" x2="${pad.l+bw}" y2="${y+3.5}" stroke="${col}" stroke-width="1.5" stroke-opacity="0.55"/>
    <text x="${pad.l+bw+5}" y="${y+rowH/2+2.5}" fill="${col}" font-size="7" opacity="0.7">${val.toFixed(1)}</text>
    </g>`;
  }).join('');

  const sLbl = _LB_STAT_LABELS[stat] || stat;
  // No inner scroll container — just extend the page naturally, scroll like everything else
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="lb-chart-svg">
    ${defs}
    <rect width="${W}" height="${H}" fill="#050508"/>
    <text x="${W/2}" y="${pad.t-1}" text-anchor="middle" fill="#1c1c2c" font-size="7" letter-spacing="2">${_esc(sLbl)}</text>
    ${rows}
  </svg>`;
}

// ── Radial / Sunburst ─────────────────────────────────────────
function _renderLbRadial(wrap, chars) {
  const stat   = _leaderboardStat;
  const sorted = [...chars].sort((a,b) => getLeaderboardVal(b,stat) - getLeaderboardVal(a,stat));
  const maxVal = Math.max(...sorted.map(c => getLeaderboardVal(c, stat)), 1);
  const W = 520, H = 420;
  const cx = W/2, cy = H/2;
  const innerR = 52, outerR = 196;
  const n = sorted.length;
  const TAU = 2*Math.PI;
  const gap = Math.min(0.032, TAU/n*0.1);

  const defs = `<defs>
    <filter id="lb-rd2-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

  const arcs = sorted.map((c, i) => {
    const origIdx = chars.indexOf(c);
    const val = getLeaderboardVal(c, stat);
    const t   = val/maxVal;
    const r   = innerR + t*(outerR-innerR);
    const a0  = -Math.PI/2 + (i/n)*TAU + gap/2;
    const a1  = -Math.PI/2 + ((i+1)/n)*TAU - gap/2;
    const la  = (a1-a0) > Math.PI ? 1 : 0;
    const col = c.color || '#888';
    const d = [
      `M ${(cx+innerR*Math.cos(a0)).toFixed(1)},${(cy+innerR*Math.sin(a0)).toFixed(1)}`,
      `L ${(cx+r*Math.cos(a0)).toFixed(1)},${(cy+r*Math.sin(a0)).toFixed(1)}`,
      `A ${r.toFixed(1)},${r.toFixed(1)} 0 ${la},1 ${(cx+r*Math.cos(a1)).toFixed(1)},${(cy+r*Math.sin(a1)).toFixed(1)}`,
      `L ${(cx+innerR*Math.cos(a1)).toFixed(1)},${(cy+innerR*Math.sin(a1)).toFixed(1)}`,
      `A ${innerR},${innerR} 0 ${la},0 ${(cx+innerR*Math.cos(a0)).toFixed(1)},${(cy+innerR*Math.sin(a0)).toFixed(1)} Z`
    ].join(' ');
    const halo = t > 0.85 ? `<path d="${d}" fill="${col}" fill-opacity="0.1" filter="url(#lb-rd2-glow)"/>` : '';
    return `${halo}<path d="${d}" fill="${col}" fill-opacity="${(0.4+t*0.55).toFixed(2)}" stroke="${col}" stroke-width="0.4" stroke-opacity="0.25" data-lb-char="${origIdx}" style="cursor:pointer"/>`;
  }).join('');

  let rings = '';
  [0.33, 0.66, 1].forEach(t => {
    const r = innerR + t*(outerR-innerR);
    rings += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#0c0c18" stroke-width="${t===1?1.2:0.6}"/>`;
  });

  const sLbl = _LB_STAT_LABELS[stat] || stat;
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="lb-chart-svg">
    ${defs}
    <rect width="${W}" height="${H}" fill="#050508"/>
    ${rings}
    ${arcs}
    <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#07070e" stroke="#131320" stroke-width="1.5"/>
    <text x="${cx}" y="${cy+3}" text-anchor="middle" fill="#1e1e2e" font-size="7" letter-spacing="1.5">${_esc(sLbl)}</text>
  </svg>`;
}

// ── Parallel coordinates ──────────────────────────────────────
function _renderLbLines(wrap, chars) {
  const STATS = ['hp','atk','def','mag','spd','iq'];
  const LBLS  = STATS.map(s => _LB_STAT_LABELS[s] || s.toUpperCase());
  const W = 520, H = 300;
  const pad = { l: 38, r: 38, t: 42, b: 38 };
  const ph = H - pad.t - pad.b;

  const minV = {}, maxV = {};
  STATS.forEach(s => {
    const vs = chars.map(c => getLeaderboardVal(c, s));
    minV[s] = Math.min(...vs); maxV[s] = Math.max(...vs);
  });
  const axX = i => pad.l + (i/(STATS.length-1))*(W - pad.l - pad.r);
  const toY = (s, v) => pad.t + (1 - (v-minV[s]) / (maxV[s]-minV[s] || 1)) * ph;

  // Lines drawn behind axes
  const lines = chars.map((c, ci) => {
    const pts = STATS.map((s, i) => [axX(i), toY(s, getLeaderboardVal(c, s))]);
    let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i=1; i<pts.length; i++) d += ` L ${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
    const col = c.color || '#888';
    return `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.3" stroke-opacity="0.5" data-lb-char="${ci}" style="cursor:pointer"/>`;
  }).join('');

  // Dots where each line crosses each axis
  const dots = chars.map((c, ci) => STATS.map((s, i) => {
    const col = c.color || '#888';
    return `<circle cx="${axX(i).toFixed(1)}" cy="${toY(s,getLeaderboardVal(c,s)).toFixed(1)}" r="2.2" fill="${col}" fill-opacity="0.7" data-lb-char="${ci}" style="cursor:pointer"/>`;
  }).join('')).join('');

  // Axes on top
  let axes = '';
  STATS.forEach((s, i) => {
    const ax = axX(i);
    axes += `<line x1="${ax}" y1="${pad.t}" x2="${ax}" y2="${pad.t+ph}" stroke="#222232" stroke-width="1.5"/>`;
    axes += `<text x="${ax}" y="${pad.t-16}" text-anchor="middle" fill="#252538" font-size="7.5" letter-spacing="1.5">${LBLS[i]}</text>`;
    axes += `<text x="${ax}" y="${pad.t-5}" text-anchor="middle" fill="#181828" font-size="6.5">${maxV[s].toFixed(0)}</text>`;
    axes += `<text x="${ax}" y="${pad.t+ph+13}" text-anchor="middle" fill="#181828" font-size="6.5">${minV[s].toFixed(0)}</text>`;
    [0.25,0.5,0.75].forEach(t => {
      const ty = pad.t + t*ph;
      axes += `<line x1="${ax-3}" y1="${ty}" x2="${ax+3}" y2="${ty}" stroke="#1c1c2c" stroke-width="0.8"/>`;
    });
  });

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="lb-chart-svg">
    <rect width="${W}" height="${H}" fill="#050508"/>
    ${lines}
    ${dots}
    ${axes}
  </svg>`;
}

// ── [kept for potential future use] ──────────────────────────
// Returns [r,g,b] array — 7-stop vivid scale
function _lbHeatColor(t) {
  const stops = [
    [0,    [4,   4,  18]],
    [0.14, [20,  8,  95]],
    [0.3,  [0,  55, 210]],
    [0.48, [0,  178, 158]],
    [0.65, [25, 200,  30]],
    [0.82, [228,148,   0]],
    [1,    [238, 36,  10]]
  ];
  let i = 0;
  while (i < stops.length - 2 && t > stops[i+1][0]) i++;
  const [t0,c0] = stops[i], [t1,c1] = stops[i+1];
  const f = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
  return [
    Math.round(c0[1][0] + f*(c1[1][0]-c0[1][0])),
    Math.round(c0[1][1] + f*(c1[1][1]-c0[1][1])),
    Math.round(c0[1][2] + f*(c1[1][2]-c0[1][2]))
  ];
}

function _renderLbHeatmap(wrap, chars) {
  const stats  = [...AVG_STATS, 'avg'];
  const labels = [...AVG_STATS.map(s => _LB_STAT_LABELS[s]||s), 'AVG'];
  const ranges = {};
  stats.forEach(s => {
    const vs = chars.map(c => getLeaderboardVal(c, s));
    ranges[s] = { min: Math.min(...vs), max: Math.max(...vs) };
  });
  const sorted = [...chars].sort((a,b) => getLeaderboardVal(b,'avg') - getLeaderboardVal(a,'avg'));
  const MEDALS = ['🥇','🥈','🥉'];
  const ncols = stats.length;

  const header = `<div class="lb-hm-row lb-hm-header">
    <div class="lb-hm-char-col"></div>
    ${labels.map(l => `<div class="lb-hm-stat-hd">${l}</div>`).join('')}
  </div>`;

  const rows = sorted.map((c, ri) => {
    const dot = c.avatar
      ? `<img src="${c.avatar}" class="lb-hm-avatar" style="border-color:${c.color}">`
      : `<span class="lb-hm-dot" style="background:${c.color}"></span>`;
    const badge = ri < 3
      ? `<span class="lb-hm-medal">${MEDALS[ri]}</span>`
      : `<span class="lb-hm-rank">#${ri+1}</span>`;
    const cells = stats.map((s, ci) => {
      const val = getLeaderboardVal(c, s);
      const rg  = ranges[s];
      const t   = rg.max === rg.min ? 0.5 : (val - rg.min) / (rg.max - rg.min);
      const [cr,cg,cb] = _lbHeatColor(t);
      const bg   = `rgb(${cr},${cg},${cb})`;
      const glow = `inset 0 0 18px rgba(${cr},${cg},${cb},0.4), 0 0 6px rgba(${cr},${cg},${cb},0.25)`;
      const tc   = t > 0.4 ? `rgba(255,255,255,${0.65+t*0.35})` : `rgba(140,140,165,0.7)`;
      const delay = (ri * ncols + ci) * 15;
      return `<div class="lb-hm-cell" style="background:${bg};color:${tc};box-shadow:${glow};animation-delay:${delay}ms" title="${_LB_STAT_LABELS[s]||s}: ${val.toFixed(1)}">${val.toFixed(0)}</div>`;
    }).join('');
    return `<div class="lb-hm-row" style="border-left:2.5px solid ${c.color||'#222'}">
      <div class="lb-hm-char-col">${badge}${dot}<span class="lb-hm-name" style="color:${c.color||'#888'}">${_esc((c.name||'?').substring(0,10))}</span></div>
      ${cells}
    </div>`;
  }).join('');

  // Gradient legend bar
  const gradStops = Array.from({length:7}, (_,i) => {
    const t = i/6; const [r,g,b] = _lbHeatColor(t);
    return `rgb(${r},${g},${b}) ${(t*100).toFixed(0)}%`;
  }).join(',');
  const legend = `<div class="lb-hm-legend">
    <span class="lb-hm-legend-lbl">LOW</span>
    <div class="lb-hm-legend-bar" style="background:linear-gradient(to right,${gradStops})"></div>
    <span class="lb-hm-legend-lbl">HIGH</span>
  </div>`;

  wrap.innerHTML = `<div class="lb-heatmap">${header}${rows}${legend}</div>`;
}

// ── Scatter / Bubble ──────────────────────────────────────────
function _renderLbScatterBubble(wrap, chars, isBubble) {
  const xStat = document.getElementById('lb-x-sel')?.value || 'atk';
  const yStat = document.getElementById('lb-y-sel')?.value || 'def';
  const zStat = isBubble ? (document.getElementById('lb-z-sel')?.value || 'hp') : null;
  const W = 520, H = 350;
  const pad = { l: 56, r: 28, t: 34, b: 54 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

  const data = chars.map(c => ({
    c,
    x: getLeaderboardVal(c, xStat),
    y: getLeaderboardVal(c, yStat),
    z: zStat ? getLeaderboardVal(c, zStat) : 1
  }));
  const xs = data.map(d=>d.x), ys = data.map(d=>d.y), zs = data.map(d=>d.z);
  const xMin=Math.min(...xs), xMax=Math.max(...xs);
  const yMin=Math.min(...ys), yMax=Math.max(...ys);
  const zMin=Math.min(...zs), zMax=Math.max(...zs);
  // Edge padding so dots don't clip
  const xPd = (xMax-xMin)*0.1||8, yPd = (yMax-yMin)*0.1||8;
  const x0=xMin-xPd, x1=xMax+xPd, y0=yMin-yPd, y1=yMax+yPd;
  const toX = v => pad.l + ((v-x0)/(x1-x0))*pw;
  const toY = v => pad.t + (1-(v-y0)/(y1-y0))*ph;
  const toR = z => isBubble ? 9+(zMax===zMin?0:(z-zMin)/(zMax-zMin))*22 : 7;

  // Median divider positions
  const medX = [...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
  const medY = [...ys].sort((a,b)=>a-b)[Math.floor(ys.length/2)];
  const qx = toX(medX), qy = toY(medY);

  // Subtle grid lines
  let grid = '';
  const NT = 5;
  for (let i=0; i<=NT; i++) {
    const t = i/NT;
    const gx = pad.l + t*pw, gy = pad.t + t*ph;
    const xv = x0+t*(x1-x0), yv = y1-t*(y1-y0);
    grid += `<line x1="${gx}" y1="${pad.t}" x2="${gx}" y2="${pad.t+ph}" stroke="#0d0d14" stroke-width="1"/>`;
    grid += `<line x1="${pad.l}" y1="${gy}" x2="${pad.l+pw}" y2="${gy}" stroke="#0d0d14" stroke-width="1"/>`;
    grid += `<text x="${gx}" y="${pad.t+ph+17}" text-anchor="middle" fill="#2d2d42" font-size="8">${xv.toFixed(0)}</text>`;
    grid += `<text x="${pad.l-7}" y="${gy+3}" text-anchor="end" fill="#2d2d42" font-size="8">${yv.toFixed(0)}</text>`;
  }

  // SVG filters
  const defs = `<defs>
    <filter id="lb-sc-glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="lb-sc-halo" x="-120%" y="-120%" width="340%" height="340%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur"/>
      <feMergeNode in="blur"/>
    </filter>
  </defs>`;

  // Quadrant label helper
  const xLbl = _LB_STAT_LABELS[xStat]||xStat, yLbl = _LB_STAT_LABELS[yStat]||yStat;
  const qLabels = `
    <text x="${pad.l+4}" y="${pad.t+11}" fill="#1c1c2c" font-size="6.5" letter-spacing="0.5">↙ LOW ${xLbl} · HIGH ${yLbl}</text>
    <text x="${pad.l+pw-4}" y="${pad.t+11}" text-anchor="end" fill="#1c1c2c" font-size="6.5" letter-spacing="0.5">HIGH ${xLbl} · HIGH ${yLbl} ↘</text>
    <text x="${pad.l+4}" y="${pad.t+ph-5}" fill="#1c1c2c" font-size="6.5" letter-spacing="0.5">↖ LOW ${xLbl} · LOW ${yLbl}</text>
    <text x="${pad.l+pw-4}" y="${pad.t+ph-5}" text-anchor="end" fill="#1c1c2c" font-size="6.5" letter-spacing="0.5">HIGH ${xLbl} · LOW ${yLbl} ↗</text>`;

  // Dots
  const dots = data.map(({c,x,y,z}) => {
    const cx=toX(x), cy=toY(y), r=toR(z), col=c.color||'#888';
    const tip = `${_esc(c.name)}: ${_LB_STAT_LABELS[xStat]}=${x.toFixed(1)} / ${_LB_STAT_LABELS[yStat]}=${y.toFixed(1)}${isBubble?` / ${_LB_STAT_LABELS[zStat]}=${z.toFixed(1)}`:''}`;
    const lbl = `<text x="${cx}" y="${cy-r-5}" text-anchor="middle" fill="${col}" font-size="7.5" opacity="0.88">${_esc((c.name||'').substring(0,8))}</text>`;
    if (isBubble) {
      return `<circle cx="${cx}" cy="${cy}" r="${r+6}" fill="${col}" fill-opacity="0.06" filter="url(#lb-sc-halo)"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" fill-opacity="0.15" stroke="${col}" stroke-width="1.5" stroke-opacity="0.65" filter="url(#lb-sc-glow)"><title>${tip}</title></circle>
      ${lbl}`;
    }
    return `<circle cx="${cx}" cy="${cy}" r="${r+3}" fill="${col}" fill-opacity="0.12" filter="url(#lb-sc-halo)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" fill-opacity="0.92" filter="url(#lb-sc-glow)"><title>${tip}</title></circle>
    ${lbl}`;
  }).join('');

  const zNote = isBubble ? `<text x="${W-16}" y="18" text-anchor="end" fill="#282838" font-size="7.5" letter-spacing="1.5">⬤ SIZE = ${_LB_STAT_LABELS[zStat]||zStat}</text>` : '';

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="lb-chart-svg">
    ${defs}
    <rect width="${W}" height="${H}" fill="#050508"/>
    ${grid}
    <line x1="${qx}" y1="${pad.t}" x2="${qx}" y2="${pad.t+ph}" stroke="#222232" stroke-width="1.5" stroke-dasharray="5,4"/>
    <line x1="${pad.l}" y1="${qy}" x2="${pad.l+pw}" y2="${qy}" stroke="#222232" stroke-width="1.5" stroke-dasharray="5,4"/>
    <rect x="${pad.l}" y="${pad.t}" width="${pw}" height="${ph}" fill="none" stroke="#18182a" stroke-width="1"/>
    ${qLabels}
    <text x="${pad.l+pw/2}" y="${H-7}" text-anchor="middle" fill="#404058" font-size="9" letter-spacing="2.5">${xLbl}</text>
    <text x="11" y="${pad.t+ph/2}" text-anchor="middle" fill="#404058" font-size="9" letter-spacing="2.5" transform="rotate(-90,11,${pad.t+ph/2})">${yLbl}</text>
    ${zNote}
    ${dots}
  </svg>`;
}

// ── Distribution curve ────────────────────────────────────────
function _renderLbDistribution(wrap, chars) {
  const stat = _leaderboardStat;
  const W = 520, H = 308;
  const pad = { l: 46, r: 24, t: 28, b: 66 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;

  const data = chars.map(c => ({ c, v: getLeaderboardVal(c, stat) }));
  const vs = data.map(d=>d.v);
  const vMin=Math.min(...vs), vMax=Math.max(...vs), vRange=vMax-vMin||1;
  const N = Math.min(10, Math.max(4, Math.ceil(chars.length / 2)));
  const bins = Array.from({length:N}, ()=>[]);
  data.forEach(d => {
    const bi = Math.min(N-1, Math.floor((d.v-vMin)/vRange*N));
    bins[bi].push(d);
  });
  const maxCount = Math.max(...bins.map(b=>b.length), 1);
  const bw = pw / N;
  const toH  = n  => (n/maxCount)*ph;
  const toVX = v  => pad.l + ((v-vMin)/vRange)*pw;

  // Per-bar gradient defs
  let defs = '<defs>\n';
  let bars = '';
  bins.forEach((bin, i) => {
    const t  = bin.length/maxCount;
    const bx = pad.l + i*bw + bw/2;
    const x  = pad.l + i*bw + 1.5;
    const h  = toH(bin.length), y = pad.t+ph-h;
    const g  = Math.round(170 + t*80), b2 = Math.round(155 + t*90);
    const topCol = `rgb(0,${g},${b2})`;
    defs += `<linearGradient id="lb-bg${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${topCol}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${topCol}" stop-opacity="0.08"/>
    </linearGradient>\n`;
    if (h > 0) {
      bars += `<rect x="${x}" y="${y}" width="${bw-3}" height="${h}" fill="url(#lb-bg${i})" rx="2"/>`;
      // Bright cap line at top
      bars += `<line x1="${x}" y1="${y}" x2="${x+bw-3}" y2="${y}" stroke="${topCol}" stroke-width="2" stroke-opacity="0.95" stroke-linecap="round"/>`;
      bars += `<text x="${bx}" y="${y-6}" text-anchor="middle" fill="${topCol}" font-size="8" opacity="0.7">${bin.length}</text>`;
    }
    const tickV = vMin + i*(vRange/N);
    bars += `<text x="${bx}" y="${pad.t+ph+15}" text-anchor="middle" fill="#2c2c42" font-size="7.5">${tickV.toFixed(0)}</text>`;
  });

  // Horizontal guide lines
  let guides = '';
  for (let gi=1; gi<=Math.min(maxCount,5); gi++) {
    const gy = pad.t + ph - (gi/maxCount)*ph;
    guides += `<line x1="${pad.l}" y1="${gy}" x2="${pad.l+pw}" y2="${gy}" stroke="#0e0e18" stroke-width="0.8"/>`;
    guides += `<text x="${pad.l-5}" y="${gy+3}" text-anchor="end" fill="#252535" font-size="7">${gi}</text>`;
  }

  // Catmull-Rom → cubic bezier smooth curve
  const pts = bins.map((bin,i) => [pad.l + i*bw + bw/2, pad.t+ph - toH(bin.length)]);
  let curvePath = '';
  if (pts.length > 1) {
    const ext = [[pts[0][0]*2-pts[1][0], pts[0][1]], ...pts, [pts[pts.length-1][0]*2-pts[pts.length-2][0], pts[pts.length-1][1]]];
    let pd = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    let ad = `M ${pts[0][0].toFixed(1)},${(pad.t+ph).toFixed(1)} L ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i=0; i<pts.length-1; i++) {
      const [p0,p1,p2,p3] = [ext[i],ext[i+1],ext[i+2],ext[i+3]];
      const cp1x = p1[0]+(p2[0]-p0[0])/6, cp1y = p1[1]+(p2[1]-p0[1])/6;
      const cp2x = p2[0]-(p3[0]-p1[0])/6, cp2y = p2[1]-(p3[1]-p1[1])/6;
      const seg = ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
      pd += seg; ad += seg;
    }
    ad += ` L ${pts[pts.length-1][0].toFixed(1)},${(pad.t+ph).toFixed(1)} Z`;

    defs += `<linearGradient id="lb-cfill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,210,195,0.22)"/>
      <stop offset="100%" stop-color="rgba(0,210,195,0)"/>
    </linearGradient>
    <filter id="lb-cglow" x="-25%" y="-100%" width="150%" height="300%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="lb-ddot" x="-120%" y="-120%" width="340%" height="340%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;

    curvePath = `<path d="${ad}" fill="url(#lb-cfill)"/>
    <path d="${pd}" fill="none" stroke="rgba(0,205,188,0.8)" stroke-width="2.5" stroke-linecap="round" filter="url(#lb-cglow)"/>`;
    curvePath += pts.map(([px,py]) =>
      `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="rgba(0,225,205,0.9)" filter="url(#lb-cglow)"/>`
    ).join('');
  }
  defs += '</defs>';

  // Character dot timeline at bottom
  const dotLineY = pad.t + ph + 44;
  const charDots = data.map(({c,v}) => {
    const cx = toVX(v);
    return `<circle cx="${cx.toFixed(1)}" cy="${dotLineY}" r="4.5" fill="${c.color||'#888'}" fill-opacity="0.9" filter="url(#lb-ddot)"><title>${_esc(c.name)}: ${v.toFixed(1)}</title></circle>`;
  }).join('');

  const sLbl = _LB_STAT_LABELS[stat]||stat;

  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="lb-chart-svg">
    ${defs}
    <rect width="${W}" height="${H}" fill="#050508"/>
    ${guides}
    ${bars}
    ${curvePath}
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+ph}" stroke="#18182a" stroke-width="1"/>
    <line x1="${pad.l}" y1="${pad.t+ph}" x2="${pad.l+pw}" y2="${pad.t+ph}" stroke="#18182a" stroke-width="1"/>
    <line x1="${pad.l}" y1="${dotLineY}" x2="${pad.l+pw}" y2="${dotLineY}" stroke="#12121e" stroke-width="1"/>
    ${charDots}
    <text x="${pad.l+pw/2}" y="${H-4}" text-anchor="middle" fill="#404058" font-size="9" letter-spacing="2.5">${_esc(sLbl)}</text>
    <text x="10" y="${pad.t+ph/2}" text-anchor="middle" fill="#353550" font-size="8" transform="rotate(-90,10,${pad.t+ph/2})">COUNT</text>
    <text x="${pad.l-5}" y="${pad.t+5}" text-anchor="end" fill="#252535" font-size="7.5">${maxCount}</text>
  </svg>`;
}

// ============================================================
// Click sound on all interactive elements (capture phase so nothing is missed)
document.addEventListener('click', (e) => {
  const t = e.target.closest(
    'button, .btn, .swatch, .icon-btn-item, .pl-tier, [data-tooltip]'
  );
  if (t && !t.closest('.char-entry')) playClick();
}, true);

// Hover sound on interactive + decorative elements
const _HOVER_SEL = [
  'button', '.btn', '.swatch', '.trait-chip', '.hand-card:not(.rolling)',
  '.char-entry', '.icon-btn-item', '.codex-entry', '.inventory-item',
  '.gold-tx', '.pl-tier', '.stat-row', '.panel-title', '.notif-item',
  '.cult-block', '[data-tooltip]'
].join(', ');
document.addEventListener('mouseover', (e) => {
  if (e.target.closest(_HOVER_SEL)) playHover();
});

// ============================================================
// HEIGHT CHART
// ============================================================
let _hcData = { entries: [] };
let _hcSelectedId = null;
let _hcUnit = 'cm';
let _hcUnsub = null;
let _hcDrag = null;
let _hcDragged = false;
let _hcSaveT = null;
let _hcZoom = 1.0;
let _hcPanX = 0;
let _hcPanDrag = null;
let _hcListenersAdded = false;

const HC_SILHOUETTE = `<svg viewBox="0 0 24 60" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="5" r="4.5" fill="currentColor"/>
  <rect x="7" y="10" width="10" height="22" rx="3" fill="currentColor"/>
  <rect x="3.5" y="12" width="3" height="19" rx="1.5" fill="currentColor"/>
  <rect x="17.5" y="12" width="3" height="19" rx="1.5" fill="currentColor"/>
  <rect x="7.5" y="32" width="3.5" height="22" rx="0.5" fill="currentColor"/>
  <rect x="13" y="32" width="3.5" height="22" rx="0.5" fill="currentColor"/>
  <ellipse cx="9.25" cy="57" rx="4" ry="3" fill="currentColor"/>
  <ellipse cx="14.75" cy="57" rx="4" ry="3" fill="currentColor"/>
</svg>`;

let _hcCanvasW = 0; // actual rendered canvas width, set by renderHeightChart

// ── Touch/mouse coordinate helper ────────────────────────────
function _hcEvtX(e) {
  if (e.touches && e.touches.length)        return e.touches[0].clientX;
  if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientX;
  return e.clientX;
}

// Global pan/drag-reorder listeners (attached once, shared by mouse + touch)
function _hcOnMove(e) {
  if (!_hcPanDrag && !_hcDrag) return;
  if (e.cancelable) e.preventDefault(); // block browser scroll/zoom while interacting
  const cx = _hcEvtX(e);
  if (_hcPanDrag) {
    const dx = cx - _hcPanDrag.startX;
    const maxPan = Math.max(0, _hcCanvasW - _hcPanDrag.stageW);
    _hcPanX = Math.max(0, Math.min(maxPan, _hcPanDrag.startPanX - dx));
    const canvas = document.getElementById('hc-canvas');
    if (canvas) canvas.style.transform = `translateX(${-_hcPanX}px)`;
  }
  if (_hcDrag) {
    // Activate drag after 6px of movement
    if (!_hcDrag.active && Math.abs(cx - _hcDrag.startX) > 6) {
      _hcDrag.active = true;
      _hcDragged = true;
      const dragWrap = document.querySelector(`.hc-char-wrap[data-id="${_hcDrag.id}"]`);
      if (dragWrap) dragWrap.classList.add('hc-dragging');
    }
    if (_hcDrag.active) {
      const stage = document.getElementById('hc-stage');
      const ruler = document.getElementById('hc-ruler');
      if (!stage) return;
      const stageRect = stage.getBoundingClientRect();
      const rulerW = ruler ? ruler.offsetWidth : 48;
      const cursorX = (cx - stageRect.left - rulerW) + _hcPanX;
      const n = _hcData.entries.length;
      const cw = _hcCanvasW || stage.clientWidth;
      const positions = _hcData.entries.map((_, i) => n > 1 ? ((i + 1) / (n + 1)) * cw : cw / 2);
      // Determine insert index: how many positions is cursor to the right of
      let insertIdx = 0;
      for (let i = 0; i < positions.length; i++) {
        if (cursorX > positions[i]) insertIdx = i + 1;
      }
      _hcDrag.insertIdx = insertIdx;
      // Show drop indicator between slots
      let ind = document.getElementById('hc-drop-indicator');
      const canvas = document.getElementById('hc-canvas');
      if (!ind && canvas) {
        ind = document.createElement('div');
        ind.id = 'hc-drop-indicator';
        canvas.appendChild(ind);
      }
      if (ind) {
        let xPx;
        if (positions.length === 0) { xPx = cw / 2; }
        else if (insertIdx === 0) { xPx = positions[0] * 0.5; }
        else if (insertIdx >= positions.length) { xPx = (positions[positions.length - 1] + cw) * 0.5; }
        else { xPx = (positions[insertIdx - 1] + positions[insertIdx]) * 0.5; }
        ind.style.left = xPx + 'px';
        ind.style.display = 'block';
      }
    }
  }
}
function _hcOnUp() {
  if (_hcPanDrag) {
    _hcPanDrag = null;
    const s = document.getElementById('hc-stage');
    if (s) s.classList.remove('panning');
  }
  if (_hcDrag) {
    if (_hcDrag.active) {
      // Clean up drag visuals
      document.querySelectorAll('.hc-char-wrap.hc-dragging').forEach(w => w.classList.remove('hc-dragging'));
      const ind = document.getElementById('hc-drop-indicator');
      if (ind) ind.style.display = 'none';
      // Reorder if dropped in a new position
      const entries = _hcData.entries;
      const fromIdx = entries.findIndex(e => e.id === _hcDrag.id);
      const toIdx = _hcDrag.insertIdx;
      if (fromIdx >= 0 && toIdx !== null && toIdx !== fromIdx && toIdx !== fromIdx + 1) {
        const [moved] = entries.splice(fromIdx, 1);
        const adjusted = toIdx > fromIdx ? toIdx - 1 : toIdx;
        entries.splice(adjusted, 0, moved);
        _hcPanToIdx(adjusted);
        _hcDebounceSave();
      }
      renderHeightChart();
    }
    _hcDrag = null;
  }
}
document.addEventListener('mousemove', _hcOnMove);
document.addEventListener('mouseup',   _hcOnUp);
document.addEventListener('touchmove', _hcOnMove, { passive: false });
document.addEventListener('touchend',  _hcOnUp);

function _hcSetupListeners() {
  if (_hcListenersAdded) return;
  _hcListenersAdded = true;
  const stage = document.getElementById('hc-stage');
  if (!stage) return;

  stage.addEventListener('wheel', function (e) {
    if (document.getElementById('hc-modal').style.display !== 'flex') return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    _hcZoom = Math.max(0.2, Math.min(3.0, _hcZoom * factor));
    const lbl = document.getElementById('hc-zoom-label');
    if (lbl) lbl.textContent = Math.round(_hcZoom * 100) + '%';
    renderHeightChart();
  }, { passive: false });

  // Pinch-to-zoom on touch
  let _hcPinchDist0 = null;
  let _hcPinchZoom0 = null;
  stage.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      _hcPinchDist0 = Math.hypot(dx, dy);
      _hcPinchZoom0 = _hcZoom;
      _hcPanDrag = null; // cancel any pan in progress
    }
  }, { passive: true });
  stage.addEventListener('touchmove', function (e) {
    if (e.touches.length === 2 && _hcPinchDist0 !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      _hcZoom = Math.max(0.2, Math.min(3.0, _hcPinchZoom0 * (dist / _hcPinchDist0)));
      const lbl = document.getElementById('hc-zoom-label');
      if (lbl) lbl.textContent = Math.round(_hcZoom * 100) + '%';
      renderHeightChart();
    }
  }, { passive: false });
  stage.addEventListener('touchend', function (e) {
    if (e.touches.length < 2) { _hcPinchDist0 = null; _hcPinchZoom0 = null; }
  }, { passive: true });

  function _hcStartPan(clientX) {
    if (_hcDrag) {
      // Cancel any stale drag (e.g. finger lifted outside window)
      document.querySelectorAll('.hc-char-wrap.hc-dragging').forEach(w => w.classList.remove('hc-dragging'));
      const ind = document.getElementById('hc-drop-indicator');
      if (ind) ind.style.display = 'none';
      _hcDrag = null;
      return;
    }
    _hcPanDrag = { startX: clientX, startPanX: _hcPanX, stageW: stage.clientWidth };
    stage.classList.add('panning');
  }
  stage.addEventListener('mousedown', function (e) {
    _hcStartPan(e.clientX);
    e.preventDefault();
  });
  stage.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) { // single-finger pan only
      _hcStartPan(e.touches[0].clientX);
      e.preventDefault();
    }
  }, { passive: false });
}

function hcAdjustZoom(delta) {
  _hcZoom = Math.max(0.2, Math.min(3.0, _hcZoom + delta));
  const lbl = document.getElementById('hc-zoom-label');
  if (lbl) lbl.textContent = Math.round(_hcZoom * 100) + '%';
  renderHeightChart();
}

function openHeightChart() {
  document.getElementById('hc-overlay').style.display = 'block';
  document.getElementById('hc-modal').style.display = 'flex';
  document.getElementById('hc-btn-cm').classList.toggle('active', _hcUnit === 'cm');
  document.getElementById('hc-btn-in').classList.toggle('active', _hcUnit === 'in');
  _hcSetupListeners();
  _hcSubscribe();
}

function closeHeightChart() {
  document.getElementById('hc-overlay').style.display = 'none';
  document.getElementById('hc-modal').style.display = 'none';
  if (_hcUnsub) { _hcUnsub(); _hcUnsub = null; }
}

function _hcSubscribe() {
  if (_hcUnsub) _hcUnsub();
  if (!db) return;
  _hcUnsub = db.collection('heightchart').doc('main').onSnapshot(snap => {
    _hcData = snap.exists ? snap.data() : { entries: [] };
    if (!_hcData.entries) _hcData.entries = [];
    renderHeightChart();
  });
}

function _hcSave() {
  if (!db) return;
  db.collection('heightchart').doc('main').set(_hcData).catch(e => console.error('HC save error', e));
}

function _hcDebounceSave() {
  clearTimeout(_hcSaveT);
  _hcSaveT = setTimeout(_hcSave, 500);
}

function setHCUnit(unit) {
  _hcUnit = unit;
  document.getElementById('hc-btn-cm').classList.toggle('active', unit === 'cm');
  document.getElementById('hc-btn-in').classList.toggle('active', unit === 'in');
  if (_hcSelectedId) _hcPopulateEditPanel(_hcSelectedId);
  renderHeightChart();
}

function _hcCmToIn(cm) { return +(cm / 2.54).toFixed(1); }
function _hcInToCm(inch) { return +(inch * 2.54).toFixed(1); }
function _hcFmtHeight(cm) {
  if (_hcUnit === 'cm') return Math.round(cm) + 'cm';
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inPart = Math.round(totalIn % 12);
  return ft + "'" + inPart + '"';
}
function _hcMaxCm() {
  if (!_hcData.entries.length) return 220;
  const max = Math.max(..._hcData.entries.map(e => e.heightCm || 0));
  return Math.max(220, Math.ceil((max + 25) / 10) * 10);
}

function renderHeightChart() {
  const stage = document.getElementById('hc-stage');
  const canvas = document.getElementById('hc-canvas');
  const ruler = document.getElementById('hc-ruler');
  const charsEl = document.getElementById('hc-chars');
  if (!stage || !ruler || !charsEl || !canvas) return;

  const stageH = stage.clientHeight || 440;
  const stageW = stage.clientWidth || 900;
  const FLOOR_H = 36; // matches CSS #hc-floor height
  const chartH = Math.max(60, stageH - FLOOR_H);
  const maxCm = _hcMaxCm();
  const pxPerCm = (chartH / maxCm) * _hcZoom;

  // Expand canvas width with zoom so sprites never overlap
  const n0 = _hcData.entries.length;
  const maxHeightPx = n0 ? Math.max(..._hcData.entries.map(e => (e.heightCm || 170) * pxPerCm)) : 200;
  const minSlot = Math.max(70, maxHeightPx * 0.38);
  const canvasW = Math.max(stageW, n0 > 1 ? (n0 + 1) * minSlot : stageW);
  _hcCanvasW = canvasW;
  canvas.style.width = canvasW + 'px';
  canvas.style.right = 'auto';
  canvas.style.transform = `translateX(${-_hcPanX}px)`;

  // ── Ruler & grid lines ──
  ruler.innerHTML = '';
  stage.querySelectorAll('.hc-grid-line').forEach(e => e.remove());
  ruler.style.position = 'relative';
  ruler.style.height = stageH + 'px';

  const shownMaxCm = chartH / pxPerCm;
  const interval = shownMaxCm > 600 ? 100 : shownMaxCm > 300 ? 50 : shownMaxCm > 150 ? 25 : 10;
  for (let h = 0; h <= shownMaxCm + interval; h += interval) {
    const yPx = stageH - FLOOR_H - h * pxPerCm;
    if (yPx > stageH - FLOOR_H + 2) continue;
    if (yPx < -2) break;
    const isMajor = h % (interval * 2) === 0;

    // Ruler tick
    const tick = document.createElement('div');
    tick.className = 'hc-tick' + (isMajor ? ' major' : '');
    tick.style.cssText = `position:absolute; top:${yPx}px; right:0; left:0; height:1px; display:flex; align-items:center; justify-content:flex-end; padding-right:8px;`;
    const lbl = document.createElement('span');
    lbl.className = 'hc-tick-label';
    lbl.textContent = _hcUnit === 'cm' ? h : _hcFmtHeight(h);
    tick.appendChild(lbl);
    ruler.appendChild(tick);

    // Grid line across stage (above the floor)
    const gl = document.createElement('div');
    gl.className = 'hc-grid-line' + (isMajor ? ' major' : '');
    gl.style.cssText = `bottom:${FLOOR_H + h * pxPerCm}px;`;
    stage.appendChild(gl);
  }

  // ── Character sprites ──
  charsEl.innerHTML = '';

  const n = _hcData.entries.length;
  _hcData.entries.forEach((entry, idx) => {
    const cm = entry.heightCm || 170;
    const charHeightPx = cm * pxPerCm;
    const xPx = (n > 1 ? ((idx + 1) / (n + 1)) * canvasW : canvasW / 2) + (entry.xOffset || 0) * _hcZoom;
    const isSelected = entry.id === _hcSelectedId;

    const wrap = document.createElement('div');
    wrap.className = 'hc-char-wrap' + (isSelected ? ' selected' : '');
    wrap.style.left = xPx + 'px';
    wrap.style.height = charHeightPx + 'px';
    wrap.dataset.id = entry.id;
    wrap.style.setProperty('--hc-char-color', entry.color || '#555');

    wrap.addEventListener('mousedown', e => {
      e.stopPropagation(); // prevent pan on stage
      _hcDrag = { id: entry.id, startIdx: idx, startX: e.clientX, active: false, insertIdx: null };
      _hcDragged = false;
    });
    wrap.addEventListener('touchstart', e => {
      e.stopPropagation(); // prevent pan on stage
      if (e.touches.length === 1) {
        _hcDrag = { id: entry.id, startIdx: idx, startX: e.touches[0].clientX, active: false, insertIdx: null };
        _hcDragged = false;
      }
    }, { passive: true });
    wrap.addEventListener('click', () => { if (!_hcDragged) hcSelectEntry(entry.id); });

    const anchor = document.createElement('div');
    anchor.className = 'hc-anchor';

    // Name tag (above sprite)
    const nameTag = document.createElement('div');
    nameTag.className = 'hc-char-name-tag';
    nameTag.style.bottom = (charHeightPx + 8) + 'px';
    nameTag.textContent = entry.name || '???';
    anchor.appendChild(nameTag);

    // Aura atmospheric layer (behind sprite)
    const _HC_AURA_DUR = { blaze:1.4, shadow:2.8, void:2.2, ghost:3.4, crimson:2.2, haze:6.0, static:0.18, neon:1.5, reaper:4.0, soft:4.0 };
    const _auraDel = entry.aura ? `-${(_hcHash(entry.id, 97) * (_HC_AURA_DUR[entry.aura] || 2.0)).toFixed(2)}s` : '0s';
    if (entry.aura) {
      wrap.dataset.aura = entry.aura;
      const auraEl = document.createElement('div');
      auraEl.className = `hc-aura-el hc-aura-${entry.aura}`;
      const aW = charHeightPx * 0.8;
      const aH = charHeightPx * 1.25;
      auraEl.style.cssText = `width:${aW}px;height:${aH}px;animation-delay:${_auraDel};`;
      anchor.appendChild(auraEl);
      // Particles: blaze rises, crimson drips down
      if (entry.aura === 'blaze' || entry.aura === 'crimson') {
        for (let p = 0; p < 4; p++) {
          const pt = document.createElement('div');
          pt.className = `hc-aura-particle hc-ap-${entry.aura}`;
          const lPct = 15 + _hcHash(entry.id, p * 3) * 70;
          const dur  = (1.1 + _hcHash(entry.id, p * 3 + 1) * 1.6).toFixed(2);
          const del  = (_hcHash(entry.id, p * 3 + 2) * 2.0).toFixed(2);
          // crimson starts near top of character and drips down; blaze starts at feet
          const botPct = entry.aura === 'crimson'
            ? 60 + _hcHash(entry.id, p + 20) * 30
            : 5  + _hcHash(entry.id, p + 12) * 18;
          pt.style.cssText = `left:${lPct}%;bottom:${botPct}%;animation-duration:${dur}s;animation-delay:-${del}s;`;
          auraEl.appendChild(pt);
        }
      }
    } else {
      delete wrap.dataset.aura;
    }

    // Sprite or silhouette
    const _spriteUrl = entry.spriteUrl || entry.spriteBase64 || null;
    if (_spriteUrl) {
      // Kick off background bounds re-detection for legacy base64 sprites only (GIF URLs skip this)
      if (entry.spriteBase64) _hcMaybeRedetectBounds(entry);
      const topF = entry.spriteTopFrac != null ? entry.spriteTopFrac : 0;
      const botF = entry.spriteBotFrac != null ? entry.spriteBotFrac : 1;
      const fracH = Math.max(0.01, botF - topF);
      const fullH = charHeightPx / fracH;
      // shift image down so its visible feet (at botF of image) sit on ground
      const bottomOffset = (1 - botF) * fullH;

      const img = document.createElement('img');
      img.src = _spriteUrl;
      img.className = 'hc-char-sprite';
      img.style.height = fullH + 'px';
      img.style.bottom = (-bottomOffset) + 'px';
      img.style.animationDelay = _auraDel;
      img.draggable = false;
      anchor.appendChild(img);
    } else {
      const silDiv = document.createElement('div');
      silDiv.innerHTML = HC_SILHOUETTE;
      const svg = silDiv.firstElementChild;
      svg.setAttribute('class', 'hc-char-svg');
      svg.style.height = charHeightPx + 'px';
      svg.style.color = entry.color || '#888';
      svg.style.animationDelay = _auraDel;
      anchor.appendChild(svg);
    }

    // Height tag (below ground)
    const htTag = document.createElement('div');
    htTag.className = 'hc-char-ht-tag';
    htTag.textContent = _hcFmtHeight(cm);
    anchor.appendChild(htTag);

    // Order arrows (only on selected character)
    if (isSelected) {
      if (idx > 0) {
        const lb = document.createElement('button');
        lb.className = 'hc-order-btn hc-order-left';
        lb.textContent = '←';
        lb.addEventListener('click', e => { e.stopPropagation(); hcMoveEntry(entry.id, -1); });
        anchor.appendChild(lb);
      }
      if (idx < n - 1) {
        const rb = document.createElement('button');
        rb.className = 'hc-order-btn hc-order-right';
        rb.textContent = '→';
        rb.addEventListener('click', e => { e.stopPropagation(); hcMoveEntry(entry.id, 1); });
        anchor.appendChild(rb);
      }
    }

    wrap.appendChild(anchor);
    charsEl.appendChild(wrap);
  });
}

// Deterministic hash for stable particle positions (seed = entry id + index)
function _hcHash(str, n) {
  let h = (n + 1) * 2654435769;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 2654435769);
  return ((h >>> 0) % 10000) / 10000;
}

// 'soft' is excluded from the cycle — it has its own DEFAULT button
const HC_AURAS = [null, 'blaze', 'shadow', 'void', 'ghost', 'crimson', 'haze', 'static', 'neon', 'reaper'];
// dot color shown on the AURA button when an aura is active (soft uses entry.color dynamically)
const HC_AURA_DOT = { blaze:'#ff6020', shadow:'#9030d0', void:'#5010a0', ghost:'#b0d0ff', crimson:'#cc0015', haze:'#ff80ff', static:'#aaa', neon:'#f0f0f0', reaper:'#220000' };

function hcCycleAura() {
  const entry = _hcData.entries.find(e => e.id === _hcSelectedId);
  if (!entry) return;
  const idx = HC_AURAS.indexOf(entry.aura);
  entry.aura = HC_AURAS[(idx + 1) % HC_AURAS.length];
  _hcSyncAuraBtn(entry);
  renderHeightChart();
  _hcDebounceSave();
}

function _hcSyncAuraBtn(entry) {
  const btn = document.getElementById('hc-aura-cycle-btn');
  if (!btn) return;
  const isSoft = entry.aura === 'soft';
  // DEFAULT button: active when soft aura is on
  const defBtn = document.getElementById('hc-aura-default-btn');
  if (defBtn) defBtn.classList.toggle('active', isSoft);
  // Cycle AURA button: active for any non-soft aura
  const dot = (!isSoft && entry.aura) ? (HC_AURA_DOT[entry.aura] || null) : null;
  btn.innerHTML = dot
    ? `AURA <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${dot};vertical-align:middle;margin-left:3px;box-shadow:0 0 4px ${dot};"></span>`
    : 'AURA';
  btn.classList.toggle('active', !!(entry.aura && !isSoft));
  const clearBtn = document.getElementById('hc-aura-clear-btn');
  if (clearBtn) clearBtn.style.display = entry.aura ? 'inline-flex' : 'none';
}

function hcSetSoftAura() {
  const entry = _hcData.entries.find(e => e.id === _hcSelectedId);
  if (!entry) return;
  entry.aura = entry.aura === 'soft' ? null : 'soft'; // toggle
  _hcSyncAuraBtn(entry);
  renderHeightChart();
  _hcDebounceSave();
}

function hcClearAura() {
  const entry = _hcData.entries.find(e => e.id === _hcSelectedId);
  if (!entry) return;
  entry.aura = null;
  _hcSyncAuraBtn(entry);
  renderHeightChart();
  _hcDebounceSave();
}

function hcAddEntry() {
  const id = (typeof genId === 'function') ? genId() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  const entry = { id, name: 'CHARACTER', heightCm: 170, color: '#aaaaaa', spriteBase64: null, spriteUrl: null, spriteTopFrac: 0, spriteBotFrac: 1, aura: null };
  _hcData.entries.push(entry);
  _hcSelectedId = id;
  _hcSave();
  renderHeightChart();
  _hcPopulateEditPanel(id);
}

function hcMoveEntry(id, dir) {
  const idx = _hcData.entries.findIndex(e => e.id === id);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= _hcData.entries.length) return;
  const tmp = _hcData.entries[idx];
  _hcData.entries[idx] = _hcData.entries[newIdx];
  _hcData.entries[newIdx] = tmp;
  _hcPanToIdx(newIdx); // camera follows
  _hcDebounceSave();
  renderHeightChart();
}

// Pan the canvas so the character at `idx` is centred in the stage viewport
function _hcPanToIdx(idx) {
  const stage = document.getElementById('hc-stage');
  if (!stage) return;
  const n = _hcData.entries.length;
  const cw = _hcCanvasW || stage.clientWidth;
  const stageW = stage.clientWidth;
  const entry = _hcData.entries[idx];
  const xOff = (entry ? (entry.xOffset || 0) : 0) * _hcZoom;
  const xPx = (n > 1 ? ((idx + 1) / (n + 1)) * cw : cw / 2) + xOff;
  const maxPan = Math.max(0, cw - stageW);
  _hcPanX = Math.max(0, Math.min(maxPan, xPx - stageW / 2));
}

function hcSortByHeight() {
  _hcData.entries.sort((a, b) => (a.heightCm || 0) - (b.heightCm || 0));
  _hcSave();
  renderHeightChart();
}

function hcSelectEntry(id) {
  _hcSelectedId = id;
  _hcPopulateEditPanel(id);
  renderHeightChart();
}

function _hcPopulateEditPanel(id) {
  const entry = _hcData.entries.find(e => e.id === id);
  if (!entry) return;
  // Show sidebar edit panel, hide empty state
  document.getElementById('hc-sidebar-empty').style.display = 'none';
  const panel = document.getElementById('hc-edit-panel');
  panel.style.display = 'flex';
  // Color bar
  const bar = document.getElementById('hc-char-color-bar');
  if (bar) bar.style.background = entry.color || '#555';
  // Fields
  document.getElementById('hc-edit-name').value = entry.name || '';
  const hVal = _hcUnit === 'cm' ? Math.round(entry.heightCm) : _hcCmToIn(entry.heightCm);
  document.getElementById('hc-edit-height').value = hVal;
  document.getElementById('hc-height-label').textContent = 'HEIGHT (' + _hcUnit.toUpperCase() + ')';
  const col = entry.color || '#aaaaaa';
  document.getElementById('hc-edit-color').value = col;
  const hexEl = document.getElementById('hc-color-hex');
  if (hexEl) hexEl.textContent = col;
  document.getElementById('hc-clear-btn').style.display = (entry.spriteBase64 || entry.spriteUrl) ? 'inline-block' : 'none';
  // X offset slider
  const xOffSlider = document.getElementById('hc-edit-xoffset');
  if (xOffSlider) {
    xOffSlider.value = entry.xOffset || 0;
    const xOffVal = document.getElementById('hc-xoffset-val');
    if (xOffVal) xOffVal.textContent = (entry.xOffset || 0) > 0 ? '+' + (entry.xOffset || 0) : (entry.xOffset || 0);
  }
  _hcSyncAuraBtn(entry);
  // Crop sliders (only when sprite is set)
  const cropSec = document.getElementById('hc-crop-section');
  if (cropSec) {
    const hasSprite = !!(entry.spriteBase64 || entry.spriteUrl);
    cropSec.style.display = hasSprite ? 'flex' : 'none';
    if (hasSprite) {
      const topPct = Math.round((entry.spriteTopFrac || 0) * 100);
      document.getElementById('hc-crop-top').value = topPct;
      document.getElementById('hc-crop-top-val').textContent = topPct + '%';
    }
  }
}

function hcUpdateCrop(field, val) {
  const entry = _hcData.entries.find(e => e.id === _hcSelectedId);
  if (!entry) return;
  const frac = val / 100;
  if (field === 'top') {
    entry.spriteTopFrac = Math.min(frac, (entry.spriteBotFrac != null ? entry.spriteBotFrac : 1) - 0.01);
    document.getElementById('hc-crop-top-val').textContent = val + '%';
  }
  renderHeightChart();
  _hcDebounceSave();
}

function hcOpenImportPicker() {
  const win = document.getElementById('hc-import-win');
  if (!win) return;
  win.style.display = 'flex';
  document.getElementById('hc-import-search').value = '';
  renderHCImportList();
}

function hcCloseImportPicker() {
  const win = document.getElementById('hc-import-win');
  if (win) win.style.display = 'none';
}

function renderHCImportList() {
  const list = document.getElementById('hc-import-list');
  if (!list) return;
  const q = (document.getElementById('hc-import-search').value || '').toLowerCase().trim();
  const pool = (typeof characters !== 'undefined' && characters) ? characters : [];
  const filtered = q ? pool.filter(c => (c.name || '').toLowerCase().includes(q)) : pool;
  if (!filtered.length) {
    list.innerHTML = '<div class="hc-imp-empty">' + (q ? 'NO MATCH' : 'NO CHARACTERS LOADED') + '</div>';
    return;
  }
  const addedIds = new Set(_hcData.entries.map(e => e.rosterId).filter(Boolean));
  list.innerHTML = filtered.map(c => {
    const already = addedIds.has(c.id);
    const dot = c.color || '#666';
    const name = (c.name || c.id || '???').replace(/&/g,'&amp;').replace(/</g,'&lt;');
    return `<div class="hc-imp-row${already ? ' hc-imp-already' : ''}" data-id="${c.id}" onclick="hcImportChar(this.dataset.id)">
      <span class="hc-imp-dot" style="background:${dot};"></span>
      <span class="hc-imp-name">${name}</span>
      ${already ? '<span class="hc-imp-tag">ADDED</span>' : ''}
    </div>`;
  }).join('');
}

function hcImportChar(rosterId) {
  const c = (typeof characters !== 'undefined' && characters) ? characters.find(x => x.id === rosterId) : null;
  if (!c) return;
  // If already on chart, just select and close
  const existing = _hcData.entries.find(e => e.rosterId === rosterId);
  if (existing) {
    hcSelectEntry(existing.id);
    hcCloseImportPicker();
    return;
  }
  const id = (typeof genId === 'function') ? genId() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  const entry = {
    id, rosterId,
    name: c.name || 'CHARACTER',
    heightCm: 170,
    color: c.color || '#aaaaaa',
    spriteBase64: null, spriteUrl: null, spriteTopFrac: 0, spriteBotFrac: 1
  };
  _hcData.entries.push(entry);
  _hcSelectedId = id;
  _hcSave();
  renderHeightChart();
  _hcPopulateEditPanel(id);
  renderHCImportList(); // refresh badges
}

function hcUpdateField(field, val) {
  const entry = _hcData.entries.find(e => e.id === _hcSelectedId);
  if (!entry) return;
  if (field === 'heightInput') {
    if (!val || isNaN(val) || val <= 0) return;
    entry.heightCm = _hcUnit === 'cm' ? val : _hcInToCm(val);
  } else {
    entry[field] = val;
  }
  if (field === 'color') {
    const bar = document.getElementById('hc-char-color-bar');
    if (bar) bar.style.background = val;
    const hexEl = document.getElementById('hc-color-hex');
    if (hexEl) hexEl.textContent = val;
  }
  renderHeightChart();
  _hcDebounceSave();
}

function hcDeleteEntry() {
  if (!_hcSelectedId) return;
  _hcData.entries = _hcData.entries.filter(e => e.id !== _hcSelectedId);
  _hcSelectedId = null;
  document.getElementById('hc-edit-panel').style.display = 'none';
  document.getElementById('hc-sidebar-empty').style.display = 'flex';
  _hcSave();
  renderHeightChart();
}

function hcTriggerUpload() {
  if (!_hcSelectedId) return;
  const inp = document.getElementById('hc-sprite-file');
  inp.value = '';
  inp.click();
}

function hcClearSprite() {
  const entry = _hcData.entries.find(e => e.id === _hcSelectedId);
  if (!entry) return;
  entry.spriteBase64 = null;
  entry.spriteUrl = null;
  entry.spriteTopFrac = 0;
  entry.spriteBotFrac = 1;
  document.getElementById('hc-clear-btn').style.display = 'none';
  _hcSave();
}

async function hcHandleSprite(ev) {
  const file = ev.target.files[0];
  if (!file || !_hcSelectedId) return;
  const entry = _hcData.entries.find(e => e.id === _hcSelectedId);
  if (!entry) return;

  // GIFs: upload directly to Cloudinary to preserve animation (canvas would destroy it)
  if (file.type === 'image/gif') {
    if (typeof notify === 'function') notify('UPLOADING GIF...', 'ok');
    try {
      // 1. Read the file locally so we can detect bounds from frame 0 via canvas
      const dataUrl = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = e => resolve(e.target.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      // 2. Detect bounds from first frame drawn to canvas
      const bounds = await new Promise((resolve) => {
        const img = new Image();
        img.onload = function () {
          const analyseW = Math.min(img.naturalWidth, 600);
          const analyseH = Math.round(img.naturalHeight * (analyseW / img.naturalWidth));
          const ac = document.createElement('canvas');
          ac.width = analyseW; ac.height = analyseH;
          ac.getContext('2d').drawImage(img, 0, 0, analyseW, analyseH);
          const px = ac.getContext('2d').getImageData(0, 0, analyseW, analyseH).data;
          let topRow = analyseH, botRow = -1;
          for (let y = 0; y < analyseH; y++) {
            for (let x = 0; x < analyseW; x++) {
              if (px[(y * analyseW + x) * 4 + 3] > 16) {
                if (y < topRow) topRow = y;
                if (y > botRow) botRow = y;
              }
            }
          }
          if (botRow < 0) { topRow = 0; botRow = analyseH - 1; }
          resolve({ topFrac: topRow / analyseH, botFrac: (botRow + 1) / analyseH });
        };
        img.onerror = () => resolve({ topFrac: 0, botFrac: 1 });
        img.src = dataUrl;
      });

      // 3. Upload the original file to Cloudinary
      const form = new FormData();
      form.append('file', file);
      form.append('upload_preset', CLOUDINARY_PRESET);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
        { method: 'POST', body: form }
      );
      if (!res.ok) throw new Error('Upload failed: ' + res.status);
      const data = await res.json();
      if (!data.secure_url) throw new Error((data.error && data.error.message) || 'No URL returned');

      entry.spriteBase64 = null;
      entry.spriteUrl = data.secure_url;
      entry.spriteTopFrac = bounds.topFrac;
      entry.spriteBotFrac = bounds.botFrac;
      _hcSave();
      renderHeightChart();
      if (_hcSelectedId === entry.id) _hcPopulateEditPanel(entry.id);
      if (typeof notify === 'function') notify('GIF UPLOADED', 'ok');
    } catch (err) {
      console.error('[hcHandleSprite GIF]', err);
      if (typeof notify === 'function') notify('GIF UPLOAD FAILED', 'err');
    }
    return;
  }

  // Non-GIF: canvas compress + auto-detect bounds
  const reader = new FileReader();
  reader.onload = function (re) {
    const img = new Image();
    img.onload = function () {
      // 1. Analyze bounds on original (max 600x1200 analysis canvas for perf)
      const analyseW = Math.min(img.naturalWidth, 600);
      const analyseH = Math.round(img.naturalHeight * (analyseW / img.naturalWidth));
      const ac = document.createElement('canvas');
      ac.width = analyseW; ac.height = analyseH;
      ac.getContext('2d').drawImage(img, 0, 0, analyseW, analyseH);
      const px = ac.getContext('2d').getImageData(0, 0, analyseW, analyseH).data;

      let topRow = analyseH, botRow = -1;
      for (let y = 0; y < analyseH; y++) {
        for (let x = 0; x < analyseW; x++) {
          if (px[(y * analyseW + x) * 4 + 3] > 16) {
            if (y < topRow) topRow = y;
            if (y > botRow) botRow = y;
          }
        }
      }
      if (botRow < 0) { topRow = 0; botRow = analyseH - 1; }
      const topFrac = topRow / analyseH;
      const botFrac = (botRow + 1) / analyseH;

      // 2. Resize for storage: max 200px wide, preserve aspect
      const maxW = 200;
      const ratio = Math.min(1, maxW / img.naturalWidth);
      const sw = Math.round(img.naturalWidth * ratio);
      const sh = Math.round(img.naturalHeight * ratio);
      const rc = document.createElement('canvas');
      rc.width = sw; rc.height = sh;
      rc.getContext('2d').drawImage(img, 0, 0, sw, sh);
      const base64 = rc.toDataURL('image/png');

      entry.spriteBase64 = base64;
      entry.spriteUrl = null;
      entry.spriteTopFrac = topFrac;
      entry.spriteBotFrac = botFrac;
      _hcSave();
      renderHeightChart();
      if (_hcSelectedId === entry.id) _hcPopulateEditPanel(entry.id);
      if (typeof notify === 'function') notify('SPRITE UPLOADED', 'ok');
    };
    img.src = re.target.result;
  };
  reader.readAsDataURL(file);
}

// Auto-detects sprite bounds for legacy entries (uploaded before auto-detection existed).
// Only runs on entries where spriteBotFrac is exactly 1 (the default).
function _hcMaybeRedetectBounds(entry) {
  if (!entry || !entry.spriteBase64) return;
  // Only re-scan if the bottom fraction is still the default (1), meaning it was
  // never properly auto-detected. Entries uploaded after the detection was added
  // will have a botFrac < 1 already and don't need this.
  if (entry.spriteBotFrac !== 1 && entry.spriteTopFrac !== 0) return;
  if (entry._hcBoundsChecked) return; // avoid repeat scans per session
  entry._hcBoundsChecked = true;

  const img = new Image();
  img.onload = function () {
    const analyseW = Math.min(img.naturalWidth, 300);
    const analyseH = Math.round(img.naturalHeight * (analyseW / img.naturalWidth));
    const ac = document.createElement('canvas');
    ac.width = analyseW; ac.height = analyseH;
    ac.getContext('2d').drawImage(img, 0, 0, analyseW, analyseH);
    const px = ac.getContext('2d').getImageData(0, 0, analyseW, analyseH).data;

    let topRow = analyseH, botRow = -1;
    for (let y = 0; y < analyseH; y++) {
      for (let x = 0; x < analyseW; x++) {
        if (px[(y * analyseW + x) * 4 + 3] > 16) {
          if (y < topRow) topRow = y;
          if (y > botRow) botRow = y;
        }
      }
    }
    if (botRow < 0) return; // fully opaque or can't detect — leave as-is

    const topFrac = topRow / analyseH;
    const botFrac = (botRow + 1) / analyseH;

    // Only update if there's a meaningful difference
    const changed =
      Math.abs(botFrac - (entry.spriteBotFrac || 1)) > 0.005 ||
      Math.abs(topFrac - (entry.spriteTopFrac || 0)) > 0.005;
    if (changed) {
      entry.spriteTopFrac = topFrac;
      entry.spriteBotFrac = botFrac;
      _hcDebounceSave();
      renderHeightChart();
    }
  };
  img.src = entry.spriteBase64;
}

// One-time helper: run giveJukoShimmyfulMissingNo() from the browser console to patch Juko's data in Firestore.
window.giveJukoShimmyfulMissingNo = async function () {
  const snap = await db.collection('characters').where('name', '==', 'Juko!').get();
  if (snap.empty) { console.warn('No character named Juko found.'); return; }
  for (const doc of snap.docs) {
    const d = doc.data();
    const traits = Array.from(new Set([...(d.traits || []), 'missingno']));
    const shimmy = Array.from(new Set([...(d.shimmyfulTraits || []), 'missingno']));
    await db.collection('characters').doc(doc.id).update({ traits, shimmyfulTraits: shimmy });
    console.log(`Patched ${doc.id} (${d.name}): traits=${JSON.stringify(traits)}, shimmyful=${JSON.stringify(shimmy)}`);
  }
  console.log('Done. Refresh the page to see changes.');
};

// ============================================================
// CHARACTER CHAT
// ============================================================
let _chatRecipId  = null;   // character whose inbox we're viewing
let _chatFilterId = null;   // sender filter (null = show all)
let _chatUnsub    = null;   // Firestore realtime listener

function openCharChat(charId) {
  _chatRecipId  = charId;
  _chatFilterId = null;
  const recip = characters.find(c => c.id === charId);
  if (!recip) return;

  const modal   = document.getElementById('char-chat-modal');
  const overlay = document.getElementById('char-chat-overlay');
  if (!modal) return;

  // Header
  const dot  = document.getElementById('chat-recip-dot');
  const name = document.getElementById('chat-recip-name');
  if (dot)  { dot.style.background = recip.color || '#888'; dot.style.boxShadow = `0 0 8px ${recip.color || '#888'}88`; }
  if (name) { name.textContent = recip.name || 'UNNAMED'; name.style.color = recip.color || '#fff'; }

  // Populate sender selector
  const sel    = document.getElementById('chat-sender-sel');
  const others = characters.filter(c => c.id !== charId && !c.isPlaceholder);
  if (sel) {
    sel.innerHTML = `<option value="">-- WHO IS TYPING? --</option>` +
      others.map(c => `<option value="${c.id}">${c.name || 'UNNAMED'}</option>`).join('');
  }

  overlay.classList.add('open');
  modal.classList.add('open');

  // Set up realtime listener on this character's document
  if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
  if (db) {
    _chatUnsub = db.collection('characters').doc(charId).onSnapshot(snap => {
      const data = snap.data() || {};
      _renderChatConvList(data.chats || {});
      _renderChatMessages(data.chats || {});
    }, () => {});
  } else {
    const c = characters.find(x => x.id === charId);
    _renderChatConvList(c?.chats || {});
    _renderChatMessages(c?.chats || {});
  }
}

function closeCharChat() {
  _chatRecipId  = null;
  _chatFilterId = null;
  if (_chatUnsub) { _chatUnsub(); _chatUnsub = null; }
  document.getElementById('char-chat-overlay')?.classList.remove('open');
  document.getElementById('char-chat-modal')?.classList.remove('open');
}

function setChatSender(val) { /* select is read on send */ }

function setChatFilter(senderId) {
  _chatFilterId = senderId || null;
  // Update active state in sidebar
  document.querySelectorAll('.chat-conv-item').forEach(el => {
    el.classList.toggle('active', el.dataset.sid === (_chatFilterId || ''));
  });
  // Re-render with new filter using latest data from DB
  if (!_chatRecipId) return;
  if (db) {
    db.collection('characters').doc(_chatRecipId).get()
      .then(snap => _renderChatMessages((snap.data() || {}).chats || {}))
      .catch(() => {
        const c = characters.find(x => x.id === _chatRecipId);
        _renderChatMessages(c?.chats || {});
      });
  } else {
    const c = characters.find(x => x.id === _chatRecipId);
    _renderChatMessages(c?.chats || {});
  }
}

function _renderChatConvList(chats) {
  const list = document.getElementById('chat-conv-list');
  if (!list) return;

  const totalCount = Object.values(chats).reduce((s, arr) => s + (arr?.length || 0), 0);

  let html = `<button class="chat-conv-item${!_chatFilterId ? ' active' : ''}" data-sid="" onclick="setChatFilter(null)">
    <span class="chat-conv-dot" style="background:#555"></span>
    <span class="chat-conv-name">ALL</span>
    <span class="chat-conv-count">${totalCount}</span>
  </button>`;

  Object.entries(chats).forEach(([sid, msgs]) => {
    if (!msgs?.length) return;
    const sender = characters.find(c => c.id === sid);
    const col = sender?.color || '#888';
    const nm  = sender?.name  || 'UNKNOWN';
    html += `<button class="chat-conv-item${_chatFilterId === sid ? ' active' : ''}" data-sid="${sid}" onclick="setChatFilter('${sid}')">
      <span class="chat-conv-dot" style="background:${col};box-shadow:0 0 4px ${col}88"></span>
      <span class="chat-conv-name" style="color:${col}">${nm}</span>
      <span class="chat-conv-count">${msgs.length}</span>
    </button>`;
  });

  list.innerHTML = html;
}

function _renderChatMessages(chats) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  // Build flat sorted list, respecting filter
  const all = [];
  Object.entries(chats).forEach(([sid, msgs]) => {
    if (_chatFilterId && sid !== _chatFilterId) return;
    const sender = characters.find(c => c.id === sid);
    (msgs || []).forEach(m => all.push({ ...m, senderId: sid, sender }));
  });
  all.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  if (!all.length) {
    container.innerHTML = `<div class="chat-empty">NO MESSAGES YET<span>SELECT A CHARACTER BELOW AND START TYPING</span></div>`;
    return;
  }

  container.innerHTML = all.map(m => {
    const nm  = m.sender?.name  || 'UNKNOWN';
    const col = m.sender?.color || '#888';
    const d   = new Date(m.ts || 0);
    const time = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
                 d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const txt = (m.text || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return `<div class="chat-msg">
      <div class="chat-msg-header">
        <span class="chat-msg-dot" style="background:${col};box-shadow:0 0 5px ${col}66"></span>
        <span class="chat-msg-sender" style="color:${col}">${nm}</span>
        <span class="chat-msg-time">${time}</span>
      </div>
      <div class="chat-msg-text">${txt}</div>
    </div>`;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function sendChatMsg() {
  const senderId = (document.getElementById('chat-sender-sel')?.value || '').trim();
  const input    = document.getElementById('chat-msg-input');
  const text     = (input?.value || '').trim();

  if (!senderId) { notify('SELECT WHO IS TYPING FIRST', 'err'); return; }
  if (!text)     { return; }
  if (!_chatRecipId || !db) return;

  const msg = { text, ts: Date.now() };

  // Use arrayUnion for atomic append — won't clobber other senders' messages
  db.collection('characters').doc(_chatRecipId).update({
    [`chats.${senderId}`]: firebase.firestore.FieldValue.arrayUnion(msg)
  }).catch(() => {
    // Field doesn't exist yet — fall back to merge update
    const recip    = characters.find(c => c.id === _chatRecipId);
    const existing = recip?.chats?.[senderId] || [];
    db.collection('characters').doc(_chatRecipId).update({
      chats: { ...(recip?.chats || {}), [senderId]: [...existing, msg] }
    });
  });

  if (input) { input.value = ''; input.focus(); }
}

// ── Encyclopedia mobile drawer ──────────────────────────────────────────────
function toggleMobileToC() {
  const panel    = document.getElementById('enc-left');
  const backdrop = document.getElementById('enc-mobile-backdrop');
  if (!panel) return;
  const open = panel.classList.toggle('open');
  if (backdrop) {
    if (open) backdrop.classList.add('open');
    else      backdrop.classList.remove('open');
  }
}