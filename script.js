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
  if (obj === null || typeof obj !== 'object') return obj;
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
    if (dirty) saveData(c); // write corrected format back to Firestore immediately
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

function playSound(name, { rate = 1, volume = 1 } = {}) {
  try {
    const audio = new Audio(SOUNDS_PATH + name + '.mp3');
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.playbackRate = Math.max(0.1, Math.min(4, rate));
    audio.play().catch(() => { });
    return audio;
  } catch (e) { }
}

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
const STAT_BASE_MAX = { hp: 999, atk: 99, def: 99, mag: 99, spd: 99 };
// Hard caps matching the power level reference (Mountain Level top)
const STAT_HARD_MAX = { hp: 1250, atk: 300, def: 300, mag: 300, spd: 300 };

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
          fg.classList.add(isPeak ? 'peak' : 'on', `tier-${Math.min(tier, 15)}`);
        }
        // Background shows the SOLID color of the previous tier
        bg.classList.add('on');
        if (tier > 1) bg.classList.add(`tier-${Math.min(tier - 1, 15)}`);
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
    spd: { disp: 'spd-val-disp', segs: 'e-spd-segs' }
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
      { id: 'opacity', label: 'Opacity', type: 'range', min: 0.1, max: 0.8, default: 0.2 },
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
function drawPattern(canvas, type, params, t) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

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
    if (!canvas._pixels) canvas._pixels = Array.from({ length: 200 }, () => ({ x: Math.random() * W, y: Math.random() * H, vy: 0.5 + Math.random() * 1.5, size: 0 }));
    const count = params.count || 60, size = params.size || 6, spd = params.speed || 2, color = params.color || '#ffffff';
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    canvas._pixels.slice(0, count).forEach(p => {
      p.y += p.vy * spd;
      if (p.y > H + size) { p.y = -size; p.x = Math.random() * W; }
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

  const avatarHTML = c.avatar
    ? `<div class="char-avatar-small"><img src="${c.avatar}"/></div>`
    : `<div class="char-avatar-small" style="color:${isDraft ? '#555' : c.color};">
        <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;width:18px;height:18px;"><rect x="12" y="2" width="8" height="8" fill="currentColor"/><rect x="10" y="10" width="12" height="10" fill="currentColor"/><rect x="8" y="20" width="6" height="8" fill="currentColor"/><rect x="18" y="20" width="6" height="8" fill="currentColor"/></svg>
      </div>`;

  const nameHtml = isDraft
    ? `<span style="color:#555;">${c.name}</span>&nbsp;<span style="font-size:6px;color:#444;">[DRAFT]</span>`
    : `<span style="color:${c.color}">${c.name || 'UNNAMED'}</span>`;

  const tagsHtml = (c.tags && c.tags.length)
    ? `<div class="char-entry-tags">${c.tags.map(t => `<span class="char-tag">${t}</span>`).join('')}</div>`
    : '';

  el.innerHTML = `
    ${avatarHTML}
    <div class="char-entry-info">
      <div class="char-entry-name">${nameHtml}</div>
      ${tagsHtml}
    </div>`;

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
  if (_cvAvatar) {
    avatarEl.innerHTML = `<img src="${_cvAvatar}"/>`;
  } else {
    avatarEl.innerHTML = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;width:56px;height:56px;">
      <rect x="12" y="2" width="8" height="8" fill="${c.color}"/>
      <rect x="10" y="10" width="12" height="10" fill="${c.color}"/>
      <rect x="8" y="20" width="6" height="8" fill="${c.color}"/>
      <rect x="18" y="20" width="6" height="8" fill="${c.color}"/>
    </svg>`;
  }
  avatarEl.style.borderColor = c.color;

  document.getElementById('cv-name').textContent = c.name || 'UNNAMED';
  document.getElementById('cv-name').style.color = c.color;
  renderFormSwitcher(c);
  updateCharPLBadge(c);
  renderRadarChart(c);
  const mbn = document.getElementById('mobile-char-name');
  if (mbn) { mbn.textContent = c.name || 'UNNAMED'; mbn.style.color = c.color || '#fff'; }
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
  document.getElementById('char-view').style.setProperty('--char-color', c.color);
  const statsEl = document.getElementById('cv-stats');
  const effStats = getEffectiveStats(c);

  const stats = [
    { key: 'hp', label: 'HP', icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: var(--accent-green);"><path d="M5 9L1 5A2.5 2.5 0 0 1 5 2 2.5 2.5 0 0 1 9 5Z" fill="currentColor"/></svg>` },
    { key: 'atk', label: 'ATK', icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: var(--accent-red);"><path d="M2 8l1 1 6-6-1-1-6 6zM1 9l2-1-1-1-1 2z" fill="currentColor"/></svg>` },
    { key: 'def', label: 'DEF', icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: var(--accent-blue);"><path d="M1 2v4c0 3 4 3.5 4 3.5s4-.5 4-3.5V2l-4-1-4 1z" fill="currentColor"/></svg>` },
    { key: 'mag', label: 'MAG', icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: #ff44ff;"><path d="M5 1l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill="currentColor"/></svg>` },
    { key: 'spd', label: 'SPD', icon: `<svg width="14" height="14" viewBox="0 0 10 10" style="margin-right:6px; flex-shrink: 0; color: var(--accent-yellow);"><path d="M6 0L2 5H5L4 10L9 4H5Z" fill="currentColor"/></svg>` },
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
  const ptype = c.pattern?.type || 'none', pdef = PATTERN_DEFS[ptype];
  styleEl.innerHTML = `<div style="font-size:9px;letter-spacing:2px;margin-bottom:14px;line-height:1.8;">PATTERN: <span class="text-yellow">${pdef?.label || 'None'}</span></div>`;
  if (ptype !== 'none' && pdef) {
    const pp = c.pattern?.params || {};
    pdef.params.forEach(p => {
      const v = pp[p.id] !== undefined ? pp[p.id] : p.default;
      styleEl.innerHTML += `<div style="font-size:8px;letter-spacing:1px;margin-bottom:6px;color:#666;">${p.label}: <span style="color:#ccc;">${v}</span></div>`;
    });
  }

  stopBgAnim();
  if (ptype !== 'none') startBgAnim(ptype, c.pattern?.params || {});

  renderInventory(c);
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
  document.getElementById('tab-stats').style.display = tab === 'stats' ? '' : 'none';
  document.getElementById('tab-style').style.display = tab === 'style' ? '' : 'none';
  document.getElementById('tab-info').style.display = tab === 'info' ? '' : 'none';
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
  el.style.borderColor = c.color;
  if (src) {
    el.innerHTML = `<img src="${src}"/>`;
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
const _FORM_STAT_MAX = { hp: 2200, atk: 400, def: 400, mag: 400, spd: 400 };

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
    let fgCls = `stat-seg fill-fg ${key}${isOn ? (isPeak ? ' peak' : ' on') : ''}${tier > 0 && isOn ? ` tier-${Math.min(tier, 15)}` : ''}`;
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
    stats: { hp: 50, atk: 10, def: 10, mag: 10, spd: 10 },
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
    document.getElementById('e-spd').value = c.stats.spd;
    currentAvatarDataURL = c.avatar || null;
    _editorTags = [...(c.tags || [])];
    renderEditorTags();
    _editorForms = (c.altForms || []).map(f => ({
      name: f.name || '',
      avatar: f.avatar || null,
      stats: { hp: f.stats?.hp || 50, atk: f.stats?.atk || 10, def: f.stats?.def || 10, mag: f.stats?.mag || 10, spd: f.stats?.spd || 10 },
      substats: _fullSubstats(f.substats)
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
    ['e-hp', 'e-atk', 'e-def', 'e-mag', 'e-spd'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.value = [50, 10, 10, 10, 10][i];
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
  ['hp', 'atk', 'def', 'mag', 'spd'].forEach(updateStatDisplay);
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
      stats: { hp: +f.stats.hp || 1, atk: +f.stats.atk || 1, def: +f.stats.def || 1, mag: +f.stats.mag || 1, spd: +f.stats.spd || 1 },
      substats: _fullSubstats(f.substats, true)
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
const RADAR_KEYS = ['hp', 'atk', 'def', 'mag', 'spd'];

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
  const LBLS = ['HP', 'ATK', 'DEF', 'MAG', 'SPD'];
  const COLS = { hp: '#44dd77', atk: '#ff4444', def: '#4499ff', mag: '#ff44ff', spd: '#ffcc00' };
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
  gun: '🔫', bomb: '💣', boomerang: '🪃', hammer: '⚒️',

  // ARMOR
  shield: '🛡️', helmet: '🪖', chestplate: '👕', boots: '👢', gloves: '🧤', ring: '💍', necklace: '📿', cape: '🧣',
  coat: '🥼', tie: '👔', dress: '👗', shorts: '🩳', socks: '🧦', shoes: '🥾', hat: '🧢', tophat: '🎩', crown: '👑',
  pants: '👖', kimono: '👘', sari: '🥻', vest: '🦺',
  wintercoat: '🧥', ballet: '🩰', sandals: '🩴', heels: '👠', flats: '👡', loafers: '👞', sneakers: '👟',
  backpack: '🎒', luggage: '🧳', glasses: '👓', sunglasses: '🕶️', goggles: '🥽',

  // MAGIC
  book: '📖', scroll: '📜', orb: '🔮', gem: '💎', crystal: '💠', talisman: '🧿',
  urn: '🏺', hourglass: '⏳', candle: '🕯️', lamp: '🪔', blood: '🩸', dna: '🧬',

  // CONSUMABLES
  potion: '🧪', elixir: '🍷', apple: '🍎', meat: '🍖', herb: '🌿', bread: '🍞', cheese: '🧀',
  mushroom: '🍄', fish: '🐟', sushi: '🍣', riceball: '🍙', dumpling: '🥟', chicken: '🍗',
  burger: '🍔', pizza: '🍕', fries: '🍟', beer: '🍺', tea: '🍵', coffee: '☕',

  // MISC
  skull: '💀', key: '🗝️', coin: '🪙', map: '🗺️', bone: '🦴', compass: '🧭', gear: '⚙️',
  brick: '🧱', wood: '🪵', bell: '🔔', magnet: '🧲', eye: '👁️', brain: '🧠', tooth: '🦷',
  feather: '🪶', shell: '🐚', ticket: '🎫'
};

const ICON_CATEGORIES = [
  { label: 'WEAPONS', keys: ['sword', 'greatsword', 'dagger', 'bow', 'axe', 'spear', 'staff', 'wand', 'gun', 'bomb', 'boomerang', 'hammer'] },
  { label: 'ARMOR', keys: ['shield', 'helmet', 'chestplate', 'boots', 'gloves', 'ring', 'necklace', 'cape', 'coat', 'tie', 'dress', 'shorts', 'socks', 'shoes', 'hat', 'tophat', 'crown', 'pants', 'kimono', 'sari', 'vest', 'wintercoat', 'ballet', 'sandals', 'heels', 'flats', 'loafers', 'sneakers', 'backpack', 'luggage', 'glasses', 'sunglasses', 'goggles'] },
  { label: 'MAGIC', keys: ['book', 'scroll', 'orb', 'gem', 'crystal', 'talisman', 'urn', 'hourglass', 'candle', 'lamp', 'blood', 'dna'] },
  { label: 'CONSUMABLES', keys: ['potion', 'elixir', 'apple', 'meat', 'herb', 'bread', 'cheese', 'mushroom', 'fish', 'sushi', 'riceball', 'dumpling', 'chicken', 'burger', 'pizza', 'fries', 'beer', 'tea', 'coffee'] },
  { label: 'MISC', keys: ['skull', 'key', 'coin', 'map', 'bone', 'compass', 'gear', 'brick', 'wood', 'bell', 'magnet', 'eye', 'brain', 'tooth', 'feather', 'shell', 'ticket'] }
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

  const adds = { hp: 0, atk: 0, def: 0, mag: 0, spd: 0, heal_pow: 0, crit_rate: 0, crit_dmg: 0, status_res: 0, dexterity: 0, resilience: 0, true_dmg: 0, lifesteal: 0, cooldown_red: 0 };
  const muls = { hp: 1, atk: 1, def: 1, mag: 1, spd: 1, heal_pow: 1, crit_rate: 1, crit_dmg: 1, status_res: 1, dexterity: 1, resilience: 1, true_dmg: 1, lifesteal: 1, cooldown_red: 1 };

  items.forEach(item => {
    (item.mods || []).forEach(m => {
      const v = parseFloat(m.value) || 0;
      if (m.op === 'add') adds[m.stat] += v;
      if (m.op === 'sub') adds[m.stat] -= v;
      if (m.op === 'mul') muls[m.stat] *= v;
      if (m.op === 'div') { if (v !== 0) muls[m.stat] /= v; }
    });
  });

  const effHp = Math.max(1, Math.round((base.hp + adds.hp) * muls.hp));
  const effAtk = Math.max(1, Math.round((base.atk + adds.atk) * muls.atk));
  const effDef = Math.max(1, Math.round((base.def + adds.def) * muls.def));
  const effMag = Math.max(1, Math.round((base.mag + adds.mag) * muls.mag));
  const effSpd = Math.max(1, Math.round((base.spd + adds.spd) * muls.spd));

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

  return {
    hp: effHp, atk: effAtk, def: effDef, mag: effMag, spd: effSpd,
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

    return `<div class="inv-card ${i.equipped ? 'equipped' : ''}" style="--char-color: ${c.color}; --hc: ${hc}">
      <div class="inv-card-icon">${iconHtml}</div>
      <div class="inv-card-info">
        <div class="inv-card-name" style="color: ${i.equipped ? c.color : 'var(--fg)'}">${i.name || 'Unnamed Item'}</div>
        <div class="inv-card-desc">${i.desc || ''}</div>
        <div class="inv-mod-tags">${modsHtml}</div>
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
  const stats = ['hp', 'atk', 'def', 'mag', 'spd'];
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
        seg.classList.add(isPeak ? 'peak' : 'on', `tier-${Math.min(tier, 15)}`);
      } else {
        seg.classList.add('on');
        if (tier > 0) {
          seg.classList.add('ghost');
          if (tier > 1) seg.classList.add(`tier-${Math.min(tier - 1, 15)}`);
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
// TRAITS SYSTEM
// ============================================================

// op: 'add' = additive (flat for main stats, percentage points for substats)
//     'pct' = +value% multiplicative on a main stat   (e.g. +15% ATK -> pct 15)
//     'mul' = total multiplier (x2 stats -> mul 2)
// stat: 'all_main' targets HP/ATK/DEF/MAG/SPD together.
// 'derived' passives are scaled (atk per hp, etc.)
const TRAITS = {
  // ============ COMMON (gray) ============
  favored: { name: 'Favored', rarity: 'common', desc: '+10% Crit Chance', passive: [{ stat: 'crit_rate', op: 'add', value: 10 }] },
  spicy: { name: 'Spicy', rarity: 'common', desc: '+5% Resilience', passive: [{ stat: 'resilience', op: 'add', value: 5 }] },
  sonic: { name: 'Sonic', rarity: 'common', desc: '+5% SPD, +5% Dexterity', passive: [{ stat: 'spd', op: 'pct', value: 5 }, { stat: 'dexterity', op: 'add', value: 5 }] },
  flaming: { name: 'Flaming', rarity: 'common', desc: '50% chance to BURN enemies on hit.', passive: [], notes: 'Status effect. No direct stat impact.' },
  enchanted: { name: 'Enchanted', rarity: 'common', desc: '+5% MAG, +5% Heal Power', passive: [{ stat: 'mag', op: 'pct', value: 5 }, { stat: 'heal_pow', op: 'add', value: 5 }] },
  steadfast: { name: 'Steadfast', rarity: 'common', desc: '+5% True Damage. Deal extra damage if enemy is blocking.', passive: [{ stat: 'true_dmg', op: 'add', value: 5 }], situational: [{ id: 'block', label: 'Enemy is BLOCKING', desc: 'Bonus damage vs blocking targets.', passive: [] }] },
  bombastic: { name: 'Bombastic', rarity: 'common', desc: 'Explosions caused by user are x2 bigger.', passive: [], notes: 'Cosmetic / scaling. No direct stat impact.' },
  counterfeit: { name: 'Counterfeit', rarity: 'common', desc: 'Shops are 10% cheaper.', passive: [], notes: 'Economy effect. No combat stat impact.' },
  sticky: { name: 'Sticky', rarity: 'common', desc: 'your fingers are sticky :)', passive: [], notes: 'Flavor trait.' },
  tough: { name: 'Tough', rarity: 'common', desc: '+5% DEF', passive: [{ stat: 'def', op: 'pct', value: 5 }] },
  hearty: { name: 'Hearty', rarity: 'common', desc: '+8% HP', passive: [{ stat: 'hp', op: 'pct', value: 8 }] },
  keen: { name: 'Keen', rarity: 'common', desc: '+5% ATK, +3% Crit Chance', passive: [{ stat: 'atk', op: 'pct', value: 5 }, { stat: 'crit_rate', op: 'add', value: 3 }] },
  scholarly: { name: 'Scholarly', rarity: 'common', desc: '+5% MAG, +5% Cooldown Reduction', passive: [{ stat: 'mag', op: 'pct', value: 5 }, { stat: 'cooldown_red', op: 'add', value: 5 }] },
  lightfooted: { name: 'Light-Footed', rarity: 'common', desc: '+8% SPD', passive: [{ stat: 'spd', op: 'pct', value: 8 }] },
  regenerative: { name: 'Regenerative', rarity: 'common', desc: '+8% Heal Power, +3% HP', passive: [{ stat: 'heal_pow', op: 'add', value: 8 }, { stat: 'hp', op: 'pct', value: 3 }] },
  reckless: { name: 'Reckless', rarity: 'common', desc: '+10% ATK, -5% DEF', passive: [{ stat: 'atk', op: 'pct', value: 10 }, { stat: 'def', op: 'pct', value: -5 }] },
  ironclad: { name: 'Ironclad', rarity: 'common', desc: '+8% DEF, -5% SPD', passive: [{ stat: 'def', op: 'pct', value: 8 }, { stat: 'spd', op: 'pct', value: -5 }] },
  precise: { name: 'Precise', rarity: 'common', desc: '+8% Crit Chance, -5% Crit Damage', passive: [{ stat: 'crit_rate', op: 'add', value: 8 }, { stat: 'crit_dmg', op: 'add', value: -5 }] },
  glassjaw: { name: 'Glass Jaw', rarity: 'common', desc: '+8% ATK, -5% Resilience', passive: [{ stat: 'atk', op: 'pct', value: 8 }, { stat: 'resilience', op: 'add', value: -5 }] },
  shocking: { name: 'Shocking', rarity: 'common', desc: 'Chance to SHOCK/STUN enemies on hit.', passive: [], notes: 'Status effect. No direct stat impact.' },
  wellfed: { name: 'Well-Fed', rarity: 'common', desc: '+5% HP, +3% Lifesteal', passive: [{ stat: 'hp', op: 'pct', value: 5 }, { stat: 'lifesteal', op: 'add', value: 3 }] },
  caffeinated: { name: 'Caffeinated', rarity: 'common', desc: '+5% SPD, +5% Cooldown Reduction', passive: [{ stat: 'spd', op: 'pct', value: 5 }, { stat: 'cooldown_red', op: 'add', value: 5 }] },
  stubborn: { name: 'Stubborn', rarity: 'common', desc: 'Extremely resistant to crowd control and intimidation.', passive: [], notes: 'Flavor trait.' },
  nightowl: { name: 'Night Owl', rarity: 'common', desc: '+5% ATK, +5% SPD in the dark or at night.', passive: [], situational: [{ id: 'nightowl-dark', label: 'It is dark / nighttime', passive: [{ stat: 'atk', op: 'pct', value: 5 }, { stat: 'spd', op: 'pct', value: 5 }] }] },
  headstrong: { name: 'Headstrong', rarity: 'common', desc: '+8% Status Resistance', passive: [{ stat: 'status_res', op: 'add', value: 8 }] },
  resolute: { name: 'Resolute', rarity: 'common', desc: '+5% Resilience. At ≤30% HP, gain +5% ATK.', passive: [{ stat: 'resilience', op: 'add', value: 5 }], situational: [{ id: 'res-low', label: 'Currently at ≤30% HP', passive: [{ stat: 'atk', op: 'pct', value: 5 }] }] },
  grounded: { name: 'Grounded', rarity: 'common', desc: '+5% DEF. Immune to knockback effects.', passive: [{ stat: 'def', op: 'pct', value: 5 }], notes: 'Knockback immunity is flavor. +5% DEF is the stat impact.' },

  // ============ RARE (blue) ============
  assassin: { name: 'Assassin', rarity: 'rare', desc: 'The higher enemy HP, the greater your damage (0%–30%).', passive: [], situational: [{ id: 'asn-max', label: 'Enemy at MAX HP', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'asn-half', label: 'Enemy at 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }] },
  executioner: { name: 'Executioner', rarity: 'rare', desc: 'The lower the enemy HP, the greater your damage (0%–30%).', passive: [], situational: [{ id: 'exe-low', label: 'Enemy at 0% HP threshold', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'exe-half', label: 'Enemy at 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }] },
  lethal: { name: 'Lethal', rarity: 'rare', desc: '+15% True Damage.', passive: [{ stat: 'true_dmg', op: 'add', value: 15 }] },
  toxic: { name: 'Toxic', rarity: 'rare', desc: 'Attacks POISON enemies.', passive: [], notes: 'Status effect. No direct stat impact.' },
  frostbite: { name: 'Frostbite', rarity: 'rare', desc: 'Attacks FREEZE enemies.', passive: [], notes: 'Status effect. No direct stat impact.' },
  buff: { name: 'Buff', rarity: 'rare', desc: '+15% ATK', passive: [{ stat: 'atk', op: 'pct', value: 15 }] },
  armored: { name: 'Armored', rarity: 'rare', desc: '+15% DEF', passive: [{ stat: 'def', op: 'pct', value: 15 }] },
  workhorse: { name: 'Workhorse', rarity: 'rare', desc: '+15% Cooldown Reduction', passive: [{ stat: 'cooldown_red', op: 'add', value: 15 }] },
  shielding: { name: 'Shielding', rarity: 'rare', desc: 'Start of fight: shield for 5% of HP. If a round passes at MAX HP, gain another. Stacks infinitely.', passive: [], situational: [{ id: 'shield-stack', label: 'Per shield stack (vs HP)', desc: 'Each stack = 5% HP as shield. Stat impact varies.', passive: [] }] },
  saving: { name: 'Saving Habits', rarity: 'rare', desc: 'Shops are 20% cheaper.', passive: [], notes: 'Economy effect. No combat stat impact.' },
  voided: { name: 'Voided', rarity: 'rare', desc: 'Attacks have a 5% chance to spawn black holes that pull and damage.', passive: [], notes: 'Proc effect. No direct stat impact.' },
  legday: { name: 'Leg Day', rarity: 'rare', desc: 'Big thighs. +15% SPD, +15% Dexterity', passive: [{ stat: 'spd', op: 'pct', value: 15 }, { stat: 'dexterity', op: 'add', value: 15 }] },
  shrinkray: { name: 'Shrink Ray', rarity: 'rare', desc: 'Damage shrinks enemies by 50% and reduces their DEF by 5%.', passive: [], notes: 'Affects enemy stats. No self stat impact.' },
  vital: { name: 'Vital', rarity: 'rare', desc: '+15% HP', passive: [{ stat: 'hp', op: 'pct', value: 15 }] },
  swiftstrike: { name: 'Swiftstrike', rarity: 'rare', desc: '+15% SPD, +10% Crit Chance', passive: [{ stat: 'spd', op: 'pct', value: 15 }, { stat: 'crit_rate', op: 'add', value: 10 }] },
  spellweaver: { name: 'Spellweaver', rarity: 'rare', desc: '+15% MAG, +10% Cooldown Reduction', passive: [{ stat: 'mag', op: 'pct', value: 15 }, { stat: 'cooldown_red', op: 'add', value: 10 }] },
  lifeline: { name: 'Lifeline', rarity: 'rare', desc: '+10% Lifesteal, +10% Heal Power', passive: [{ stat: 'lifesteal', op: 'add', value: 10 }, { stat: 'heal_pow', op: 'add', value: 10 }] },
  weakpoint: { name: 'Weakpoint', rarity: 'rare', desc: '+10% True Damage, +10% Crit Chance', passive: [{ stat: 'true_dmg', op: 'add', value: 10 }, { stat: 'crit_rate', op: 'add', value: 10 }] },
  berserker: { name: 'Berserker', rarity: 'rare', desc: '+25% ATK, -15% DEF', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'def', op: 'pct', value: -15 }] },
  bulwark: { name: 'Bulwark', rarity: 'rare', desc: '+20% DEF, -15% ATK', passive: [{ stat: 'def', op: 'pct', value: 20 }, { stat: 'atk', op: 'pct', value: -15 }] },
  overdrive: { name: 'Overdrive', rarity: 'rare', desc: '+20% ATK, -10% HP', passive: [{ stat: 'atk', op: 'pct', value: 20 }, { stat: 'hp', op: 'pct', value: -10 }] },
  solo: { name: 'Solo', rarity: 'rare', desc: '+20% all stats when fighting without allies.', passive: [], situational: [{ id: 'solo-alone', label: 'Fighting alone (no allies)', passive: [{ stat: 'all_main', op: 'pct', value: 20 }] }] },
  packhunter: { name: 'Pack Hunter', rarity: 'rare', desc: '+8% ATK per ally in the fight (up to +24%).', passive: [], situational: [{ id: 'pack-1', label: '1 ally in fight (+8% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 8 }] }, { id: 'pack-2', label: '2 allies in fight (+16% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 16 }] }, { id: 'pack-3', label: '3+ allies in fight (+24% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 24 }] }] },
  laststand: { name: 'Last Stand', rarity: 'rare', desc: 'At ≤25% HP: +20% ATK, +20% DEF.', passive: [], situational: [{ id: 'ls-low', label: 'Currently at ≤25% HP', passive: [{ stat: 'atk', op: 'pct', value: 20 }, { stat: 'def', op: 'pct', value: 20 }] }] },
  opportunist: { name: 'Opportunist', rarity: 'rare', desc: '+20% ATK vs enemies that are stunned, slowed, or poisoned.', passive: [], situational: [{ id: 'opp-cc', label: 'Enemy is stunned, slowed, or poisoned', passive: [{ stat: 'atk', op: 'pct', value: 20 }] }] },
  momentum: { name: 'Momentum', rarity: 'rare', desc: 'Each consecutive hit without taking damage: +5% ATK. Stacks up to 3x.', passive: [], situational: [{ id: 'mom-1', label: '1 hit streak (+5% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 5 }] }, { id: 'mom-2', label: '2 hit streak (+10% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'mom-3', label: '3+ hit streak (+15% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }] },
  adrenaline: { name: 'Adrenaline', rarity: 'rare', desc: 'Taking damage grants +10% ATK for 2 turns.', passive: [], situational: [{ id: 'adren-hit', label: 'Just took damage (+10% ATK for 2 turns)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }] },
  secondwind: { name: 'Second Wind', rarity: 'rare', desc: 'Once per fight, survive a killing blow at 1 HP.', passive: [], notes: 'Once-per-fight effect. No direct stat impact.' },
  mending: { name: 'Mending', rarity: 'rare', desc: '+15% Heal Power. Your heals restore 3% HP to yourself.', passive: [{ stat: 'heal_pow', op: 'add', value: 15 }], notes: 'Self-heal on cast is flavor/mechanic. Heal Power is the stat impact.' },
  fortify: { name: 'Fortify', rarity: 'rare', desc: 'After taking 3 hits in a row, gain +15% DEF.', passive: [], situational: [{ id: 'fort-3hit', label: 'Took 3 hits in a row (+15% DEF)', passive: [{ stat: 'def', op: 'pct', value: 15 }] }] },
  evasion: { name: 'Evasion', rarity: 'rare', desc: '+20% Dexterity', passive: [{ stat: 'dexterity', op: 'add', value: 20 }] },
  warcry: { name: 'Warcry', rarity: 'rare', desc: 'Once per fight, give all allies +15% ATK for 2 turns.', passive: [], notes: 'Support effect. No self stat impact.' },
  bubbly: { name: 'Bubbly', rarity: 'rare', desc: '50% chance on hit to encase enemy in a bubble, stunning them for 1 turn but making them untouchable.', passive: [], notes: 'Proc effect. Stuns but grants enemy temporary damage immunity.' },

  // ============ EPIC (light purple, pulse) ============
  economic: { name: 'Economic', rarity: 'epic', desc: 'Shops are 50% cheaper.', passive: [], notes: 'Economy effect. No combat stat impact.' },
  pyromaniac: { name: 'Pyromaniac', rarity: 'epic', desc: 'Explosions x4 bigger. Explosions BURN nearby enemies. Heal 5% HP per turn per BURNING enemy.', passive: [], situational: [{ id: 'pyro-3', label: '3 burning enemies (heal preview)', desc: 'Heal scales with HP.', passive: [] }] },
  prime: { name: 'Prime', rarity: 'epic', desc: '+20% ATK, +20% DEF', passive: [{ stat: 'atk', op: 'pct', value: 20 }, { stat: 'def', op: 'pct', value: 20 }] },
  overflowing: { name: 'Overflowing', rarity: 'epic', desc: '+30% Cooldown Reduction', passive: [{ stat: 'cooldown_red', op: 'add', value: 30 }] },
  vampiric: { name: 'Vampiric', rarity: 'epic', desc: '+25% Lifesteal', passive: [{ stat: 'lifesteal', op: 'add', value: 25 }] },
  solar: { name: 'Solar', rarity: 'epic', desc: '+35% SPD, +30% Dexterity', passive: [{ stat: 'spd', op: 'pct', value: 35 }, { stat: 'dexterity', op: 'add', value: 30 }] },
  gambler: { name: 'Gambler', rarity: 'epic', desc: '+30% Crit Chance, +15% Crit Damage', passive: [{ stat: 'crit_rate', op: 'add', value: 30 }, { stat: 'crit_dmg', op: 'add', value: 15 }] },
  deferred: { name: 'Deferred', rarity: 'epic', desc: '+45% ATK. Damage delivered over 3 turns.', passive: [{ stat: 'atk', op: 'pct', value: 45 }] },
  trueT: { name: 'True', rarity: 'epic', desc: '+40% True Damage', passive: [{ stat: 'true_dmg', op: 'add', value: 40 }] },
  heavyhitter: { name: 'Heavy Hitter', rarity: 'epic', desc: '+5 ATK per 50 HP. Capped at +300 ATK.', passive: [{ op: 'derived', stat: 'atk', from: 'hp', per: 50, perValue: 5, cap: 300 }] },
  clothesline: { name: 'Clothesline', rarity: 'epic', desc: 'Tether to an ally each fight. Laser scales with ATK, slows enemies by 10%.', passive: [], notes: 'Ally-tether effect. No self stat impact.' },
  dawn: { name: "Dawnbringer's Resolve", rarity: 'epic', desc: 'At ≤50% HP, recover 10% HP every turn until full.', passive: [], situational: [{ id: 'dawn-low', label: 'Currently at ≤50% HP', desc: 'Sustained healing.', passive: [] }] },
  warmup: { name: 'Warmup Routine', rarity: 'epic', desc: 'Spend first round exercising (cancels if hit). After: +20% all main stats. Can keep exercising indefinitely.', passive: [], situational: [{ id: 'warmup-done', label: 'Warmup completed', passive: [{ stat: 'all_main', op: 'pct', value: 20 }] }] },
  colossus: { name: 'Colossus', rarity: 'epic', desc: '+30% HP, +30% DEF', passive: [{ stat: 'hp', op: 'pct', value: 30 }, { stat: 'def', op: 'pct', value: 30 }] },
  archmage: { name: 'Archmage', rarity: 'epic', desc: '+35% MAG, +20% CDR, +20% Heal Power', passive: [{ stat: 'mag', op: 'pct', value: 35 }, { stat: 'cooldown_red', op: 'add', value: 20 }, { stat: 'heal_pow', op: 'add', value: 20 }] },
  phantom: { name: 'Phantom', rarity: 'epic', desc: '+30% SPD, +20% Dexterity, +20% Crit Chance', passive: [{ stat: 'spd', op: 'pct', value: 30 }, { stat: 'dexterity', op: 'add', value: 20 }, { stat: 'crit_rate', op: 'add', value: 20 }] },
  juggernaut: { name: 'Juggernaut', rarity: 'epic', desc: '+30% ATK, +20% HP, -15% SPD', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'hp', op: 'pct', value: 20 }, { stat: 'spd', op: 'pct', value: -15 }] },
  irongiant: { name: 'Iron Giant', rarity: 'epic', desc: '+8 DEF per 100 HP. The more HP you have, the tougher you get.', passive: [{ op: 'derived', stat: 'def', from: 'hp', per: 100, perValue: 8 }] },
  spellblade: { name: 'Spellblade', rarity: 'epic', desc: '+1 ATK per 3 MAG. Magic fuels your physical hits.', passive: [{ op: 'derived', stat: 'atk', from: 'mag', per: 3, perValue: 1 }] },
  reaper: { name: 'Reaper', rarity: 'epic', desc: 'Killing an enemy restores 25% HP.', passive: [], notes: 'Kill-trigger heal. No passive stat impact.' },
  onslaught: { name: 'Onslaught', rarity: 'epic', desc: 'Each consecutive attack turn without being hit: +5% ATK. Stacks up to 3x. Resets if you take damage.', passive: [], situational: [{ id: 'ons-1', label: '1 turn streak (+5% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 5 }] }, { id: 'ons-2', label: '2 turn streak (+10% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'ons-3', label: '3+ turn streak (+15% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }] },
  absorbent: { name: 'Absorbent', rarity: 'epic', desc: 'Each hit you take: +2% DEF for the rest of the fight. Resets between fights.', passive: [], situational: [{ id: 'abs-5', label: 'After 5 hits taken (+10% DEF)', passive: [{ stat: 'def', op: 'pct', value: 10 }] }, { id: 'abs-10', label: 'After 10 hits taken (+20% DEF)', passive: [{ stat: 'def', op: 'pct', value: 20 }] }] },
  mirror: { name: 'Mirror', rarity: 'epic', desc: 'Reflect 15% of all damage taken back at the attacker.', passive: [], notes: 'Damage reflection. No direct self stat impact.' },
  echo: { name: 'Echo', rarity: 'epic', desc: 'Every 3rd attack fires twice, hitting the same target again for full damage.', passive: [], notes: 'Attack multiplier. No direct stat impact.' },
  timebomb: { name: 'Time Bomb', rarity: 'epic', desc: 'Once per fight, mark an enemy. They take double damage on their next hit received.', passive: [], notes: 'One-shot debuff. No self stat impact.' },
  overdose: { name: 'Overdose', rarity: 'epic', desc: 'Being healed above max HP converts the excess into bonus ATK temporarily.', passive: [], situational: [{ id: 'od-active', label: 'Overhealed (bonus ATK active)', passive: [{ stat: 'atk', op: 'pct', value: 20 }] }] },
  shieldbreak: { name: 'Shield Breaker', rarity: 'epic', desc: '+30% ATK vs any enemy that has a shield or barrier active.', passive: [], situational: [{ id: 'sb-shielded', label: 'Enemy has a shield or barrier', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }] },
  warden: { name: 'Warden', rarity: 'epic', desc: 'When any ally drops below 30% HP, instantly shield them for 15% of your HP.', passive: [], notes: 'Ally-shield proc. No self stat impact.' },
  empower: { name: 'Empower', rarity: 'epic', desc: 'Buffs and heals you give allies are 50% stronger.', passive: [], notes: 'Support multiplier. No self stat impact.' },
  commander: { name: 'Commander', rarity: 'epic', desc: 'All allies gain +15% ATK while you are above 50% HP.', passive: [], situational: [{ id: 'cmd-up', label: 'You are above 50% HP (allies +15% ATK)', desc: 'Ally buff. No self stat impact.', passive: [] }] },
  second_skin: { name: 'Second Skin', rarity: 'epic', desc: '+20% DEF. The first hit you take each fight deals 0 damage.', passive: [{ stat: 'def', op: 'pct', value: 20 }], notes: 'First hit each fight is negated entirely.' },
  blitz: { name: 'Blitz', rarity: 'epic', desc: '+35% ATK, +25% Crit Chance, -25% DEF. Cannot use defensive abilities or skills.', passive: [{ stat: 'atk', op: 'pct', value: 35 }, { stat: 'crit_rate', op: 'add', value: 25 }, { stat: 'def', op: 'pct', value: -25 }], notes: 'Defensive abilities and skills are locked out.' },
  siphon: { name: 'Siphon', rarity: 'epic', desc: 'At the end of each round, drain 5% of the target\'s current HP as healing.', passive: [], situational: [{ id: 'sp-1', label: '1 round of drain (5% target HP healed)', desc: 'Calculate from target\'s current HP each round.', passive: [] }, { id: 'sp-3', label: '3 rounds of drain', desc: 'Applies every round.', passive: [] }] },
  double_tap: { name: 'Double Tap', rarity: 'epic', desc: 'After landing a kill, immediately make a bonus attack on the nearest enemy at +50% ATK.', passive: [], notes: 'Kill-triggered bonus hit. Does not chain on a second kill.' },
  sentinel: { name: 'Sentinel', rarity: 'epic', desc: '25% of all damage dealt to nearby allies is redirected to you instead. +15% DEF.', passive: [{ stat: 'def', op: 'pct', value: 15 }], notes: '25% of all incoming ally damage is redirected to you.' },
  pressure_pt: { name: 'Pressure Point', rarity: 'epic', desc: 'Every 3rd consecutive hit on the same target deals double damage and stuns them for 1 round.', passive: [], notes: 'Count hits per target. Every 3rd = x2 damage + 1 round stun. Counter resets on target switch.' },
  deadweight: { name: 'Deadweight', rarity: 'epic', desc: '+6% ATK per item currently equipped. More gear, more force.', passive: [], situational: [{ id: 'dw-2', label: '2 items equipped (+12% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 12 }] }, { id: 'dw-4', label: '4 items equipped (+24% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 24 }] }, { id: 'dw-6', label: '6 items equipped (+36% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 36 }] }, { id: 'dw-8', label: '8 items equipped (+48% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 48 }] }] },
  chain: { name: 'Chain', rarity: 'epic', desc: 'Every crit arcs to a second nearby enemy for 45% of the damage.', passive: [], notes: 'Crits bounce to the nearest other enemy for 45% of the original damage.' },
  war_drum: { name: 'War Drum', rarity: 'epic', desc: 'All allies passively gain +10% ATK. You gain an additional +5% ATK per ally that currently has any buff active.', passive: [], situational: [{ id: 'wd-1', label: '1 buffed ally (+5% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 5 }] }, { id: 'wd-2', label: '2 buffed allies (+10% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'wd-3', label: '3 buffed allies (+15% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }] },
  overclock: { name: 'Overclock', rarity: 'epic', desc: '+35% Cooldown Reduction. You take +20% more damage from all sources.', passive: [{ stat: 'cooldown_red', op: 'add', value: 35 }], notes: 'Trade-off: major CDR boost at the cost of increased damage taken.' },
  shadowstrike: { name: 'Shadowstrike', rarity: 'epic', desc: 'The first attack you make each fight ignores DEF entirely and deals True Damage equal to 25% of the target\'s current HP.', passive: [], notes: 'First attack each fight only. Bypasses all DEF and shields.' },
  grounded: { name: 'Grounded', rarity: 'epic', desc: 'Immune to knockback, displacement, and aerial effects. +20% DEF vs magic. +15% Status Resistance.', passive: [{ stat: 'status_res', op: 'add', value: 15 }], notes: 'Immune to all movement/displacement effects. +20% DEF specifically against magic damage.' },
  piles_of_bones: { name: 'Piles of Bones', rarity: 'epic', desc: '+1% Crit Chance and +1% Crit Damage per kill. Permanent.', passive: [], cultivation: { label: 'Kills', perStack: [{ stat: 'crit_rate', op: 'add', value: 1 }, { stat: 'crit_dmg', op: 'add', value: 1 }], defaultStacks: 0, maxStacks: 500 } },
  spite: { name: 'Spite', rarity: 'epic', desc: '+15% ATK per debuff or status effect currently active on you. The more they pile on, the worse an idea that was.', passive: [], situational: [{ id: 'sp-1', label: '1 debuff active (+15% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }, { id: 'sp-2', label: '2 debuffs active (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'sp-3', label: '3 debuffs active (+45% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 45 }] }, { id: 'sp-4', label: '4+ debuffs active (+60% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 60 }] }] },
  exposed: { name: 'Exposed', rarity: 'epic', desc: 'Your DEF is permanently 0. But on every attack turn you take, the target\'s DEF is also reduced to 0 for that hit. Mutually assured vulnerability.', passive: [{ stat: 'def', op: 'pct', value: -100 }], notes: 'DEF is set to 0. Strip all DEF items and buffs. On your attack turns, also zero the target\'s DEF for that hit.' },
  vitalsiphon: { name: 'Vital Siphon', rarity: 'epic', desc: '+1% Lifesteal per 40 DEF.', passive: [{ op: 'derived', stat: 'lifesteal', from: 'def', per: 40, perValue: 1 }] },
  corepiercer: { name: 'Core Piercer', rarity: 'epic', desc: '+1% True Damage per 20 ATK.', passive: [{ op: 'derived', stat: 'true_dmg', from: 'atk', per: 20, perValue: 1 }] },
  desperate: { name: 'Desperate Measures', rarity: 'epic', desc: 'At ≤40% HP: +40% MAG and +40% Cooldown Reduction.', passive: [], situational: [{ id: 'desperate-crisis', label: 'Currently at ≤40% HP', passive: [{ stat: 'mag', op: 'pct', value: 40 }, { stat: 'cooldown_red', op: 'add', value: 40 }] }] },
  rampage: { name: 'Rampage', rarity: 'epic', desc: 'Each enemy defeated in combat grants +15% ATK and +10% SPD for the rest of the fight (max 4x).', passive: [], situational: [{ id: 'rampage-1', label: '1 enemy defeated (+15% ATK, +10% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 15 }, { stat: 'spd', op: 'pct', value: 10 }] }, { id: 'rampage-4', label: '4+ enemies defeated (+60% ATK, +40% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'spd', op: 'pct', value: 40 }] }] },
  bounty: { name: 'Bounty Hunter', rarity: 'epic', desc: 'Each enemy defeated permanently grants +1 Dexterity (max 100 stacks).', passive: [], cultivation: { label: 'Enemies Defeated', perStack: [{ stat: 'dexterity', op: 'add', value: 1 }], defaultStacks: 0, maxStacks: 100 } },
  kinetic: { name: 'Kinetic Shielding', rarity: 'epic', desc: 'Taking damage grants +10% SPD and +10 Dexterity for 2 turns (max 3 stacks).', passive: [], situational: [{ id: 'kin-1', label: '1 stack active (+10% SPD, +10 Dexterity)', passive: [{ stat: 'spd', op: 'pct', value: 10 }, { stat: 'dexterity', op: 'add', value: 10 }] }, { id: 'kin-3', label: '3 stacks active (+30% SPD, +30 Dexterity)', passive: [{ stat: 'spd', op: 'pct', value: 30 }, { stat: 'dexterity', op: 'add', value: 30 }] }] },

  // ============ LEGENDARY (yellow, glow) ============
  godly: { name: 'Godly', rarity: 'legendary', desc: '+40% ATK, +40% DEF', passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }] },
  rct: { name: 'RCT', rarity: 'legendary', desc: '-15% HP. Each turn, heal 1% HP per 5 MAG (cap 20%).', passive: [{ stat: 'hp', op: 'pct', value: -15 }], situational: [{ id: 'rct-tick', label: 'Per-turn regen tick', desc: 'Healing scales with MAG.', passive: [] }] },
  gluttonous: { name: 'Gluttonous', rarity: 'legendary', desc: '+20% CDR. +5% ATK & +5% DEF per 10% CDR.', passive: [{ stat: 'cooldown_red', op: 'add', value: 20 }, { op: 'derived', stat: 'atk', from: 'cooldown_red', per: 10, perPct: 5 }, { op: 'derived', stat: 'def', from: 'cooldown_red', per: 10, perPct: 5 }] },
  cultivation: { name: 'Cultivation', rarity: 'legendary', desc: 'Every fight, +2% in every main stat. Permanent scaling.', passive: [], cultivation: { label: 'Fights Cultivated', perStack: { stat: 'all_main', op: 'pct', value: 2 }, defaultStacks: 10, maxStacks: 500 } },
  cursed: { name: 'Cursed', rarity: 'legendary', desc: 'Lower HP → higher damage (0%→+80%). Gain 10% Lifesteal at 20% HP.', passive: [], situational: [{ id: 'cursed-low', label: 'Currently at 20% HP', passive: [{ stat: 'atk', op: 'pct', value: 64 }, { stat: 'lifesteal', op: 'add', value: 10 }] }, { id: 'cursed-half', label: 'Currently at 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 40 }] }] },
  angelic: { name: 'Angelic', rarity: 'legendary', desc: '+100% Heal Power. Healing an ally heals you for 5% of the amount.', passive: [{ stat: 'heal_pow', op: 'add', value: 100 }] },
  ryoiki: { name: 'Ryoiki', rarity: 'legendary', desc: 'Start of fight: shield for 20% HP. If a round passes at MAX HP, +20% HP shield. Stacks infinitely.', passive: [], situational: [{ id: 'ryoiki-1', label: 'Per shield stack (vs HP)', desc: 'Each stack = 20% HP as shield.', passive: [] }] },
  celestial: { name: 'Celestial Body', rarity: 'legendary', desc: '+50% HP, +50% DEF. Converts vitality to offense: +1 ATK per 50 HP (cap +200 ATK).', passive: [{ stat: 'hp', op: 'pct', value: 50 }, { stat: 'def', op: 'pct', value: 50 }, { op: 'derived', stat: 'atk', from: 'hp', per: 50, perValue: 1, cap: 200 }] },
  temporal: { name: 'Temporal', rarity: 'legendary', desc: 'You get 2 turns per round.', passive: [], notes: 'Action economy. No direct stat impact.' },
  spiritual: { name: 'Spiritual', rarity: 'legendary', desc: '+50% Cooldown Reduction', passive: [{ stat: 'cooldown_red', op: 'add', value: 50 }] },
  circle: { name: 'Circle of Death', rarity: 'legendary', desc: 'Damage enemies when you heal. +5% Heal Power per 65 ATK.', passive: [{ op: 'derived', stat: 'heal_pow', from: 'atk', per: 65, perValue: 5 }] },
  bigbrain: { name: 'Big Brain', rarity: 'legendary', desc: 'Start of fight: shield worth 50% of MAG.', passive: [], notes: 'One-time shield. No passive stat impact.' },
  giant: { name: 'Giant Slayer', rarity: 'legendary', desc: 'Become tiny. Deal more damage the bigger your target is.', passive: [], situational: [{ id: 'gs-big', label: 'Target is HUGE', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }] },
  goliath: { name: 'Goliath', rarity: 'legendary', desc: 'Become big. Deal more damage the smaller your target is.', passive: [], situational: [{ id: 'go-small', label: 'Target is TINY', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }] },
  allin: { name: 'All In', rarity: 'legendary', desc: 'ATK x2, MAG x2. DEF is permanently set to 1.', passive: [{ stat: 'atk', op: 'pct', value: 100 }, { stat: 'mag', op: 'pct', value: 100 }], notes: 'DEF set to 1 -- remove all DEF items and buffs.' },
  thornwall: { name: 'Thornwall', rarity: 'legendary', desc: 'Reflect 35% of all damage taken back at the attacker as True Damage.', passive: [], notes: '35% of every hit you receive returns to the attacker as True Damage. Does not reduce damage received.' },
  apex_pred: {
    name: 'Apex Predator', rarity: 'legendary', desc: '+15% ATK and +10% True DMG per enemy in the fight. -10% DEF per ally.', passive: [], situational: [
      { id: 'ap-1e0a', label: '1 enemy, no allies', passive: [{ stat: 'atk', op: 'pct', value: 15 }, { stat: 'true_dmg', op: 'add', value: 10 }] },
      { id: 'ap-2e0a', label: '2 enemies, no allies', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'true_dmg', op: 'add', value: 20 }] },
      { id: 'ap-3e0a', label: '3 enemies, no allies', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'true_dmg', op: 'add', value: 30 }] },
      { id: 'ap-4e0a', label: '4 enemies, no allies', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'true_dmg', op: 'add', value: 40 }] },
      { id: 'ap-1e1a', label: '1 enemy, 1 ally', passive: [{ stat: 'atk', op: 'pct', value: 15 }, { stat: 'true_dmg', op: 'add', value: 10 }, { stat: 'def', op: 'pct', value: -10 }] },
      { id: 'ap-2e1a', label: '2 enemies, 1 ally', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'true_dmg', op: 'add', value: 20 }, { stat: 'def', op: 'pct', value: -10 }] },
      { id: 'ap-3e1a', label: '3 enemies, 1 ally', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'true_dmg', op: 'add', value: 30 }, { stat: 'def', op: 'pct', value: -10 }] },
      { id: 'ap-2e2a', label: '2 enemies, 2 allies', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'true_dmg', op: 'add', value: 20 }, { stat: 'def', op: 'pct', value: -20 }] },
    ]
  },
  ironvow: {
    name: 'Iron Vow', rarity: 'legendary', desc: 'Sacrifice one main stat permanently (set to 1). All other main stats gain +40%.', passive: [], situational: [
      { id: 'iv-hp', label: 'Vow: Sacrifice HP', passive: [{ stat: 'hp', op: 'pct', value: -99 }, { stat: 'atk', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }, { stat: 'mag', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }] },
      { id: 'iv-atk', label: 'Vow: Sacrifice ATK', passive: [{ stat: 'atk', op: 'pct', value: -99 }, { stat: 'hp', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }, { stat: 'mag', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }] },
      { id: 'iv-def', label: 'Vow: Sacrifice DEF', passive: [{ stat: 'def', op: 'pct', value: -99 }, { stat: 'hp', op: 'pct', value: 40 }, { stat: 'atk', op: 'pct', value: 40 }, { stat: 'mag', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }] },
      { id: 'iv-mag', label: 'Vow: Sacrifice MAG', passive: [{ stat: 'mag', op: 'pct', value: -99 }, { stat: 'hp', op: 'pct', value: 40 }, { stat: 'atk', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }] },
      { id: 'iv-spd', label: 'Vow: Sacrifice SPD', passive: [{ stat: 'spd', op: 'pct', value: -99 }, { stat: 'hp', op: 'pct', value: 40 }, { stat: 'atk', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: 40 }, { stat: 'mag', op: 'pct', value: 40 }] },
    ]
  },
  soulforge: { name: 'Soul Forge', rarity: 'legendary', desc: 'Sacrifice 200 HP (floor: 1 HP) to permanently gain +60% MAG. Stackable.', passive: [], cultivation: { label: 'HP Sacrifices Made', perStack: { stat: 'mag', op: 'pct', value: 60 }, defaultStacks: 0, maxStacks: 20 }, notes: 'Each stack costs 200 HP from your stat sheet.' },
  final_stand: { name: 'Final Stand', rarity: 'legendary', desc: 'When HP drops below 15%, all stats triple. Once per fight.', passive: [], situational: [{ id: 'fs-active', label: 'Below 15% HP -- Final Stand active', passive: [{ stat: 'atk', op: 'pct', value: 200 }, { stat: 'def', op: 'pct', value: 200 }, { stat: 'mag', op: 'pct', value: 200 }, { stat: 'spd', op: 'pct', value: 200 }] }] },
  thousandcuts: { name: 'Thousand Cuts', rarity: 'legendary', desc: 'Every attack hits 5 times for 1/5 damage each. Crit, lifesteal, and on-hit effects apply per hit.', passive: [], notes: 'Each attack becomes 5 micro-hits. All per-hit effects trigger on each one.' },
  eternal_flame: { name: 'Eternal Flame', rarity: 'legendary', desc: 'On death, revive once at 1 HP with all stats doubled for one round.', passive: [], notes: 'One-time revival per combat. Doubled stats last exactly one round.' },
  entropy: { name: 'Entropy', rarity: 'legendary', desc: 'Each hit deals bonus True Damage equal to 3% of the target\'s current HP.', passive: [], notes: 'True Damage per hit = 3% of target\'s current HP. Bypasses DEF. Scales with their health.' },
  phantom_step: { name: 'Phantom Step', rarity: 'legendary', desc: '+40% SPD, +30% Dexterity. Once per round, automatically negate one incoming attack.', passive: [{ stat: 'spd', op: 'pct', value: 40 }, { stat: 'dexterity', op: 'add', value: 30 }], notes: 'One free dodge per round. Declared after the attack is announced.' },
  apex_hunger: { name: 'Apex Hunger', rarity: 'legendary', desc: 'Every kill permanently grants +3% ATK for the campaign. Stacks forever.', passive: [], cultivation: { label: 'Enemies Slain', perStack: { stat: 'atk', op: 'pct', value: 3 }, defaultStacks: 0, maxStacks: 999 }, notes: 'Also grants +1% True DMG per kill. Track separately.' },
  reapers_mark: { name: "Reaper's Mark", rarity: 'legendary', desc: 'Every 4th attack automatically crits. That crit\'s damage is doubled on top of your normal crit multiplier.', passive: [], notes: 'Count hits. Every 4th is a guaranteed double-power crit.' },
  parasite: {
    name: 'Parasite', rarity: 'legendary', desc: 'Each round, drain 15% of the target\'s ATK and MAG, adding it to yours until combat ends.', passive: [], situational: [
      { id: 'par-1', label: '1 round drained (+15% of target ATK and MAG)', desc: 'Calculate from the target\'s current stats.', passive: [] },
      { id: 'par-3', label: '3 rounds drained (+45% of target ATK and MAG)', desc: 'Calculate from the target\'s current stats.', passive: [] },
      { id: 'par-5', label: '5 rounds drained (+75% of target ATK and MAG)', desc: 'Calculate from the target\'s current stats.', passive: [] },
    ]
  },
  forsaken: { name: 'Forsaken', rarity: 'legendary', desc: 'Cannot receive healing from allies. All self-healing is tripled. +30% Lifesteal.', passive: [{ stat: 'lifesteal', op: 'add', value: 30 }], notes: 'Ally heals have no effect. Self-heals and lifesteal-based recovery are tripled.' },
  twin_fangs: { name: 'Twin Fangs', rarity: 'legendary', desc: 'Every attack strikes twice. The second hit deals 65% of the first.', passive: [], notes: 'Each attack = 165% total damage across two hits. Both hits can crit and apply on-hit effects.' },
  condemned: { name: 'Condemned', rarity: 'legendary', desc: 'At the start of every fight, you have 5 rounds before you die. Until then, +60% to all stats.', passive: [], situational: [{ id: 'cond-active', label: 'Condemned -- rounds 1 through 5', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'def', op: 'pct', value: 60 }, { stat: 'mag', op: 'pct', value: 60 }, { stat: 'spd', op: 'pct', value: 60 }, { stat: 'hp', op: 'pct', value: 60 }] }] },
  warpath: {
    name: 'Warpath', rarity: 'legendary', desc: 'Each round that passes, gain +6% ATK and +6% SPD permanently for the rest of that fight.', passive: [], situational: [
      { id: 'wp-1', label: 'After round 1 (+6% ATK, +6% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 6 }, { stat: 'spd', op: 'pct', value: 6 }] },
      { id: 'wp-3', label: 'After round 3 (+18% ATK, +18% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 18 }, { stat: 'spd', op: 'pct', value: 18 }] },
      { id: 'wp-5', label: 'After round 5 (+30% ATK, +30% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'spd', op: 'pct', value: 30 }] },
      { id: 'wp-8', label: 'After round 8 (+48% ATK, +48% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 48 }, { stat: 'spd', op: 'pct', value: 48 }] },
    ]
  },
  blood_frenzy: {
    name: 'Blood Frenzy', rarity: 'legendary', desc: 'Each kill restores 25% HP and permanently stacks +8% ATK for the rest of the fight.', passive: [], situational: [
      { id: 'bf-1', label: '1 kill (+8% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 8 }] },
      { id: 'bf-3', label: '3 kills (+24% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 24 }] },
      { id: 'bf-5', label: '5 kills (+40% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 40 }] },
      { id: 'bf-8', label: '8 kills (+64% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 64 }] },
    ]
  },
  voidborn: { name: 'Voidborn', rarity: 'legendary', desc: '-20% HP. Immune to all status effects. Attacks ignore 25% of enemy DEF.', passive: [{ stat: 'hp', op: 'pct', value: -20 }, { stat: 'status_res', op: 'add', value: 100 }, { stat: 'true_dmg', op: 'add', value: 25 }] },
  martyr: { name: 'Martyr', rarity: 'legendary', desc: 'Once per fight, intercept a lethal hit aimed at an ally. Survive at 1 HP. Gain +50% ATK and +50% DEF until combat ends.', passive: [], situational: [{ id: 'mart-active', label: 'Martyrdom triggered (post-intercept)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'def', op: 'pct', value: 50 }] }] },
  hex_eater: { name: 'Hex Eater', rarity: 'legendary', desc: 'Every debuff applied to you is converted into an equivalent buff instead.', passive: [], notes: 'Attribute debuffs flip to self-buffs of equal magnitude.' },
  phantom_pain: { name: 'Phantom Pain', rarity: 'legendary', desc: 'Whenever you take damage, instantly deal 50% of that damage split across all enemies.', passive: [], notes: 'Does not reduce damage received. Triggers on every hit you take.' },
  ironclad: { name: 'Ironclad', rarity: 'legendary', desc: 'Immune to displacement and movement effects. Every point of DEF also adds 0.3% ATK.', passive: [{ op: 'derived', stat: 'atk', from: 'def', per: 1, perPct: 0.3 }], notes: 'Unstoppable. DEF directly synergizes with ATK.' },
  guillotine: { name: 'Guillotine', rarity: 'legendary', desc: 'If an enemy is at or below 20% HP when you attack, the hit is automatically lethal regardless of remaining HP.', passive: [], notes: 'Instant kill threshold: 20% HP. Works on any attack.' },
  doppelganger: { name: 'Doppelganger', rarity: 'legendary', desc: 'At the start of every fight, a copy of you appears with 50% of your stats. It fights for 3 rounds, then collapses.', passive: [], notes: 'Copy has 50% of all your stats. Lasts 3 rounds per fight.' },
  sundering: { name: 'Sundering', rarity: 'legendary', desc: 'Each hit permanently reduces the target\'s DEF by 4% for the rest of that fight. No cap.', passive: [], situational: [{ id: 'sun-3', label: '3 hits landed (-12% target DEF)', desc: 'Track hits on the same target.', passive: [] }, { id: 'sun-6', label: '6 hits landed (-24% target DEF)', desc: '', passive: [] }, { id: 'sun-10', label: '10 hits landed (-40% target DEF)', desc: '', passive: [] }] },
  necromancer: { name: 'Necromancer', rarity: 'legendary', desc: 'The first enemy you kill each fight rises as a thrall with 50% of their original stats, fighting for you.', passive: [], notes: 'One thrall per fight. Persists until end of combat or death.' },
  debt_collector: { name: 'Debt Collector', rarity: 'legendary', desc: 'All damage you take is stored silently. Once per fight, release it all as a single True Damage hit on any target.', passive: [], notes: 'Track all damage received. Release as one True Damage burst.' },
  black_hole: { name: 'Black Hole', rarity: 'legendary', desc: 'Each round, all enemies lose 5% to all stats. You gain 5% to all stats. Both stack per round.', passive: [], situational: [{ id: 'bh-1', label: 'After round 1 (you +5% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 5 }] }, { id: 'bh-3', label: 'After round 3 (you +15% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 15 }] }, { id: 'bh-5', label: 'After round 5 (you +25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }] },
  thundergod: { name: 'Thundergod', rarity: 'legendary', desc: 'At the start of every round, automatically deal True Damage equal to 30% of your ATK to all enemies simultaneously.', passive: [], notes: 'Round-start True Damage burst to all enemies. Scales with ATK.' },
  conqueror: { name: 'Conqueror', rarity: 'legendary', desc: 'Every combat encounter you survive permanently increases all main stats by 1% and all substats by +1. Stacks up to 100 victories.', passive: [], cultivation: { label: 'Victories', perStack: [{ stat: 'all_main', op: 'pct', value: 1 }, { stat: 'all_sub', op: 'add', value: 1 }], defaultStacks: 0, maxStacks: 100 } },
  soul_link: { name: 'Soul Link', rarity: 'legendary', desc: 'Bond to one ally. You share 50% of all buffs either of you receives, and split 30% of all damage either of you takes.', passive: [], notes: 'Choose one ally to bond with. Buff sharing and damage splitting apply both ways.' },
  bloodrage: { name: 'Bloodrage', rarity: 'legendary', desc: 'For every 10% of max HP lost, gain +6% ATK. At 10% HP remaining: +54% ATK.', passive: [], situational: [{ id: 'br-10', label: 'Lost 10% HP (+6% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 6 }] }, { id: 'br-30', label: 'Lost 30% HP (+18% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 18 }] }, { id: 'br-50', label: 'Lost 50% HP (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'br-70', label: 'Lost 70% HP (+42% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 42 }] }, { id: 'br-90', label: 'Lost 90% HP (+54% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 54 }] }] },
  chrono_break: { name: 'Chrono Break', rarity: 'legendary', desc: 'Once per fight, completely undo the last round. HP, positions, and actions revert as if it never happened.', passive: [], notes: 'One use per fight. Declared immediately after a round ends.' },
  cannibal: { name: 'Cannibal', rarity: 'legendary', desc: 'Upon killing an enemy, permanently gain 20% of their highest stat for the rest of that fight. Stacks per kill.', passive: [], situational: [{ id: 'can-1', label: '1 kill (+20% of that target\'s top stat)', desc: 'Calculate from the defeated enemy\'s highest stat.', passive: [] }, { id: 'can-3', label: '3 kills (20% per kill, stacking)', desc: 'Each kill uses that enemy\'s own highest stat.', passive: [] }] },
  bulwark_aura: { name: 'Bulwark Aura', rarity: 'legendary', desc: 'All allies passively gain +20% DEF and +15% Status Res. You receive no personal bonus.', passive: [], notes: '+20% DEF and +15% Status Res apply to your allies only, not yourself.' },
  war_priest: { name: 'War Priest', rarity: 'legendary', desc: 'Whenever you heal an ally, they also gain +10% ATK for the rest of that fight. Stacks per heal.', passive: [], notes: '+10% ATK applied to the healed ally per heal instance. Stacks with each additional heal.' },
  vanguard: { name: 'Vanguard', rarity: 'legendary', desc: '+30% DEF. 15% of all damage dealt to any ally is redirected to you instead.', passive: [{ stat: 'def', op: 'pct', value: 30 }], notes: '15% of all incoming ally damage is redirected to you.' },
  last_rites: { name: 'Last Rites', rarity: 'legendary', desc: 'When any ally is knocked out, they immediately revive at 40% HP. Once per ally per fight.', passive: [], notes: 'Revive triggers automatically on knockout. One use per ally per fight.' },
  resonance: { name: 'Resonance', rarity: 'legendary', desc: 'Your highest stat is mirrored to every ally at 30% of its value as a flat bonus.', passive: [], notes: 'Identify your highest stat and add 30% of its value as a flat bonus to every ally.' },
  mentor: { name: 'Mentor', rarity: 'legendary', desc: 'Each fight your party wins, choose one ally to permanently gain +2% in their highest stat.', passive: [], notes: 'Track wins separately. +2% to the chosen ally\'s highest stat per win -- applied to their sheet, not yours.' },
  self_sacrifice: { name: 'Sacrifice', rarity: 'legendary', desc: 'Voluntarily sacrifice yourself to fully restore one ally\'s HP and grant them +50% all stats for the rest of the fight.', passive: [], notes: 'You are knocked out upon activation. One use, voluntary, declared on your turn.' },
  bodyguard: { name: 'Bodyguard', rarity: 'legendary', desc: 'While you are alive, allies cannot be one-shot -- any lethal hit on an ally leaves them at 1 HP instead. Also choose one ally to grant +50% DEF to.', passive: [], notes: 'One-shot prevention is always active. +50% DEF applies to your designated ally.' },
  rallying_cry: { name: 'Rallying Cry', rarity: 'legendary', desc: 'When you take damage exceeding 30% of your max HP in a single hit, all allies gain +25% ATK for that round.', passive: [], notes: 'Triggers automatically on a qualifying hit. ATK buff lasts only the round it activates.' },
  hexbinder: { name: 'Hexbinder', rarity: 'legendary', desc: 'On hit, apply a random debuff to the enemy: -20% ATK, DEF, MAG, or SPD. Only one debuff active at a time.', passive: [], notes: 'Debuff is random each hit. Applying a new one replaces the previous.' },
  disruptor: { name: 'Disruptor', rarity: 'legendary', desc: 'Enemies targeting your allies have their ATK reduced by 25%.', passive: [], notes: '-25% ATK applied to any enemy whose declared target is one of your allies.' },
  nemesis: { name: 'Nemesis', rarity: 'legendary', desc: 'Designate one named character as your Nemesis. You deal x2 damage to them. Defeating your Nemesis permanently grants x1-x2 to all stats based on their power. The bond persists outside of fights.', passive: [], notes: 'Name your Nemesis on your sheet. x2 damage applies to them only. Stat multiplier on defeat is decided by the GM based on enemy strength (x1 minimum, x2 maximum).' },
  lonewolf: { name: 'Lone Wolf', rarity: 'legendary', desc: 'While fighting alone (no allies): x1.75 to ATK, DEF, MAG, and SPD. While in a party: all stats drop to x0.5.', passive: [], situational: [{ id: 'lw-solo', label: 'Fighting alone (x1.75 ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'mul', value: 1.75 }, { stat: 'def', op: 'mul', value: 1.75 }, { stat: 'mag', op: 'mul', value: 1.75 }, { stat: 'spd', op: 'mul', value: 1.75 }] }, { id: 'lw-party', label: 'In a party (x0.5 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 0.5 }] }] },
  catastrophe: { name: 'Catastrophe', rarity: 'legendary', desc: 'Every round, all combatants (allies, enemies, and yourself) take damage equal to your full ATK stat. Cannot be mitigated or reduced.', passive: [], notes: 'AoE True Damage pulse every round equal to your full ATK. Affects everyone in the fight, including allies and yourself.' },
  life_support: { name: 'Life Support', rarity: 'legendary', desc: 'Revive a knocked-out ally at the cost of 45% of your current HP (cannot drop you below 1 HP). Each ally revived permanently grants you +25% DEF and +25% SPD.', passive: [], cultivation: { label: 'Allies Revived', perStack: [{ stat: 'def', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 25 }], defaultStacks: 0, maxStacks: 10 }, notes: 'HP cost is 45% of your current HP at time of use. Cannot kill you.' },
  schism: { name: 'Schism', rarity: 'legendary', desc: '+2 ATK per 1% Heal Power you have.', passive: [{ op: 'derived', stat: 'atk', from: 'heal_pow', per: 1, perValue: 2 }] },
  find_your_spark: { name: 'Find Your Spark', rarity: 'legendary', desc: '+1 DEF per 1 SPD. +2 HP per 1 Dexterity.', passive: [{ op: 'derived', stat: 'def', from: 'spd', per: 1, perValue: 1 }, { op: 'derived', stat: 'hp', from: 'dexterity', per: 1, perValue: 2 }] },

  // ============ MYTHIC (gradient orange/yellow, sun) ============
  adaptation: { name: 'Adaptation', rarity: 'mythic', desc: 'Every hit from an enemy → +15% DEF vs that enemy. Stacks infinitely.', passive: [], situational: [{ id: 'adp-stk', label: 'Per stack vs an enemy', passive: [{ stat: 'def', op: 'pct', value: 15 }] }] },
  acclrsorc: { name: 'Accelerating Sorcery', rarity: 'mythic', desc: 'Each turn, +10% Cooldown Reduction.', passive: [], situational: [{ id: 'as-1', label: 'After 1 turn', passive: [{ stat: 'cooldown_red', op: 'add', value: 10 }] }, { id: 'as-3', label: 'After 3 turns', passive: [{ stat: 'cooldown_red', op: 'add', value: 30 }] }] },
  brave: { name: 'Bravest of the Brave', rarity: 'mythic', desc: 'On pick, guaranteed 2 additional rare/epic traits. You can hold 2 traits at once.', passive: [], notes: 'Meta. Grants 2 bonus rare/epic traits on pick.' },
  bloodlust: { name: 'Bloodlust', rarity: 'mythic', desc: '-5% HP per round, +100% Lifesteal. Each hit costs +2% HP but gains +5% Lifesteal.', passive: [{ stat: 'lifesteal', op: 'add', value: 100 }] },
  allforyou: { name: 'All for You!', rarity: 'mythic', desc: 'Heals & buffs given to allies are x2.5. Cannot heal/buff yourself.', passive: [], notes: 'Support multiplier. No self stat impact.' },
  glasscannon: { name: 'Glass Cannon', rarity: 'mythic', desc: '+200% ATK, -90% DEF, -80% HP', passive: [{ stat: 'atk', op: 'pct', value: 200 }, { stat: 'def', op: 'pct', value: -90 }, { stat: 'hp', op: 'pct', value: -80 }] },
  magical: { name: 'Magical Girl', rarity: 'mythic', desc: 'Transform on fight start: +15% all stats, +90% MAG.', passive: [{ stat: 'all_main', op: 'pct', value: 15 }, { stat: 'mag', op: 'pct', value: 90 }] },
  nesting: { name: 'Nesting Doll', rarity: 'mythic', desc: '3 revives. Lose -25% HP and -25% ATK per revive.', passive: [], situational: [{ id: 'nd-1', label: 'After 1 revive', passive: [{ stat: 'hp', op: 'pct', value: -25 }, { stat: 'atk', op: 'pct', value: -25 }] }, { id: 'nd-3', label: 'After 3 revives', passive: [{ stat: 'hp', op: 'pct', value: -75 }, { stat: 'atk', op: 'pct', value: -75 }] }] },
  lucifer: { name: "Lucifer's Champion", rarity: 'mythic', desc: "+20% all stats, +50% SPD, +50% Dex. Every attack stacks 3.5% HP/turn BURN. Kill Zoe's champion to obtain.", passive: [{ stat: 'all_main', op: 'pct', value: 20 }, { stat: 'spd', op: 'pct', value: 50 }, { stat: 'dexterity', op: 'add', value: 50 }] },
  zoe: { name: "Zoe's Champion", rarity: 'mythic', desc: "+20% all stats, +50% HP, +50% Heal Power. Heal mirror to self. Kill Lucifer's champion to obtain.", passive: [{ stat: 'all_main', op: 'pct', value: 20 }, { stat: 'hp', op: 'pct', value: 50 }, { stat: 'heal_pow', op: 'add', value: 50 }] },
  vengeance: { name: 'Vengeance', rarity: 'mythic', desc: 'Per ally dead: x2 stats. All allies dead: -80% DEF but x4 stats & +25% Lifesteal.', passive: [], situational: [{ id: 'vg-1', label: '1 ally down (x2 stats)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }, { id: 'vg-all', label: 'All allies down', passive: [{ stat: 'all_main', op: 'mul', value: 4 }, { stat: 'def', op: 'pct', value: -80 }, { stat: 'lifesteal', op: 'add', value: 25 }] }] },
  raidboss: { name: 'Raid Boss', rarity: 'mythic', desc: 'Skip first turn (chained, +90% DEF). After: x2 all stats.', passive: [], situational: [{ id: 'rb-t1', label: 'Turn 1 (chained)', passive: [{ stat: 'def', op: 'pct', value: 90 }] }, { id: 'rb-loose', label: 'After turn 1 (released)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }] },
  honored_one: { name: 'The Honored One', rarity: 'mythic', desc: 'If you are the last surviving ally: ATK x5 and MAG x5.', passive: [], situational: [{ id: 'ho-last', label: 'Last ally standing (ATK x5, MAG x5)', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }] }], notes: 'Triggers only when all other allies are eliminated.' },
  transcendence: { name: 'Transcendence', rarity: 'mythic', desc: 'Once per session: for one fight, all damage dealt x2 and all damage received is halved.', passive: [], notes: 'One-time activation per session. No permanent stat change.' },
  world_ender: { name: 'World Ender', rarity: 'mythic', desc: '+40% ATK, +40% True DMG. Your single strongest attack each fight bypasses all defenses.', passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'true_dmg', op: 'add', value: 40 }], notes: 'The highest-damage attack per fight ignores all DEF and resistances.' },
  paradox: { name: 'Paradox', rarity: 'mythic', desc: 'At the start of each fight, all your stats are inverted: your highest stat becomes your lowest, and vice versa.', passive: [], notes: 'Stat inversion applied at fight start each time. No fixed stat modifier.' },
  usurper: { name: 'Usurper', rarity: 'mythic', desc: 'At the start of each fight, steal the enemy\'s highest passive stat buff. They lose it; you gain it for the fight.', passive: [], notes: 'Passive buff theft at fight start. Effect scales with what the enemy has.' },
  sovereign: { name: 'Sovereign', rarity: 'mythic', desc: 'Immune to all debuffs and status effects. +30% all main stats.', passive: [{ stat: 'all_main', op: 'pct', value: 30 }, { stat: 'status_res', op: 'add', value: 100 }], notes: 'Full debuff immunity. Status Res shown as 100% (capped).' },
  void_emperor: { name: 'Void Emperor', rarity: 'mythic', desc: 'Once per fight, permanently set one enemy stat to 0 for the rest of the fight. Cannot target HP.', passive: [], notes: 'Valid targets: ATK, DEF, MAG, SPD. Effect is irreversible for that fight.' },
  plague_bearer: { name: 'Plague Bearer', rarity: 'mythic', desc: 'Every hit applies an unstackable plague to the enemy: -4% to all their stats until end of fight.', passive: [], notes: 'Plague is unstackable but refreshes on each hit. Applies to the target only.' },
  abyss_walker: { name: 'Abyss Walker', rarity: 'mythic', desc: '40% chance to phase through any incoming attack (take 0 damage). +25% all main stats.', passive: [{ stat: 'all_main', op: 'pct', value: 25 }], notes: '40% phase/dodge chance applies per incoming attack.' },
  mythbreaker: { name: 'Mythbreaker', rarity: 'mythic', desc: 'Nullify all legendary and mythic trait effects on enemies for the duration of the fight.', passive: [], notes: 'Suppresses enemy legendary and mythic traits. Does not affect hexxed traits.' },
  legacy: { name: 'Legacy', rarity: 'mythic', desc: 'Upon being knocked out in a fight, transfer 100% of your 3 highest stats to one chosen ally for the rest of that fight.', passive: [], notes: 'Activates on knockout only. Chosen ally receives your top 3 stat values as flat bonuses for that fight.' },
  ultrakill: { name: 'Ultrakill', rarity: 'mythic', desc: 'x3 ATK and x3 SPD. Both stats drop by 5% each turn. Killing an enemy immediately resets ATK and SPD to full and grants you an extra turn.', passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'spd', op: 'mul', value: 3 }], situational: [{ id: 'uk-t1', label: 'After turn 1 (-5% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -5 }, { stat: 'spd', op: 'pct', value: -5 }] }, { id: 'uk-t2', label: 'After turn 2 (-10% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -10 }, { stat: 'spd', op: 'pct', value: -10 }] }, { id: 'uk-t3', label: 'After turn 3 (-15% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -15 }, { stat: 'spd', op: 'pct', value: -15 }] }, { id: 'uk-t4', label: 'After turn 4 (-20% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -20 }, { stat: 'spd', op: 'pct', value: -20 }] }, { id: 'uk-t5', label: 'Turn 5+ (-25% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -25 }, { stat: 'spd', op: 'pct', value: -25 }] }], notes: 'Kill = ATK and SPD decay fully reset + gain an extra action immediately.' },
  disturbing_peace: { name: 'Disturbing The Peace', rarity: 'mythic', desc: 'x1.2 to ATK, MAG, and SPD per round (compounding). Each spare adds +x0.5 to the multiplier. With 3+ spares in a fight and 1 enemy left: buff locks at x3, +100% Heal Power, +100% True DMG.', passive: [], situational: [{ id: 'dp-r1', label: 'Round 1 (x1.2 ATK/MAG/SPD)', passive: [{ stat: 'atk', op: 'mul', value: 1.2 }, { stat: 'mag', op: 'mul', value: 1.2 }, { stat: 'spd', op: 'mul', value: 1.2 }] }, { id: 'dp-r2', label: 'Round 2 (x1.44)', passive: [{ stat: 'atk', op: 'mul', value: 1.44 }, { stat: 'mag', op: 'mul', value: 1.44 }, { stat: 'spd', op: 'mul', value: 1.44 }] }, { id: 'dp-r3', label: 'Round 3 (x1.73)', passive: [{ stat: 'atk', op: 'mul', value: 1.73 }, { stat: 'mag', op: 'mul', value: 1.73 }, { stat: 'spd', op: 'mul', value: 1.73 }] }, { id: 'dp-r6', label: 'Round 6 (x2.99)', passive: [{ stat: 'atk', op: 'mul', value: 2.99 }, { stat: 'mag', op: 'mul', value: 2.99 }, { stat: 'spd', op: 'mul', value: 2.99 }] }, { id: 'dp-spare1', label: '+1 spare stacked (+x0.5)', passive: [{ stat: 'atk', op: 'mul', value: 1.5 }, { stat: 'mag', op: 'mul', value: 1.5 }, { stat: 'spd', op: 'mul', value: 1.5 }] }, { id: 'dp-spare2', label: '+2 spares stacked (+x1.0)', passive: [{ stat: 'atk', op: 'mul', value: 2 }, { stat: 'mag', op: 'mul', value: 2 }, { stat: 'spd', op: 'mul', value: 2 }] }, { id: 'dp-mercy', label: 'MERCY JUDGMENT (3+ spares, 1 enemy left)', passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }, { stat: 'spd', op: 'mul', value: 3 }, { stat: 'heal_pow', op: 'add', value: 100 }, { stat: 'true_dmg', op: 'add', value: 100 }] }], notes: 'Round multiplier and spare multiplier combine. Mercy Judgment requires both conditions at once.' },
  soul_eater: { name: 'Soul Eater', rarity: 'mythic', desc: 'Each enemy you kill permanently transfers 5% of their highest stat to you. Track kills as stacks.', passive: [], cultivation: { label: 'Souls Devoured', perStack: [{ stat: 'all_main', op: 'add', value: 3 }], defaultStacks: 0, maxStacks: 999 }, notes: 'On each kill, identify the enemy\'s highest stat and transfer 5% of that value to your matching stat permanently. The +3/stack here is an approximation for the simulator — adjust stacks to reflect actual absorbed values.' },
  unrelentless_hunger: { name: 'Unrelentless Hunger', rarity: 'mythic', desc: 'x2 ATK per bleeding enemy. All your attacks inflict bleed for 3 turns. With 2+ bleeding enemies: x2 SPD.', passive: [], situational: [{ id: 'uh-1b', label: '1 enemy bleeding (x2 ATK)', passive: [{ stat: 'atk', op: 'mul', value: 2 }] }, { id: 'uh-2b', label: '2 enemies bleeding (x4 ATK + x2 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'spd', op: 'mul', value: 2 }] }, { id: 'uh-3b', label: '3 enemies bleeding (x6 ATK + x2 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 6 }, { stat: 'spd', op: 'mul', value: 2 }] }, { id: 'uh-4b', label: '4+ enemies bleeding (x8 ATK + x2 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 8 }, { stat: 'spd', op: 'mul', value: 2 }] }], notes: 'Every attack you make inflicts bleed on the target for 3 turns. Track active bleed counts.' },

  // ============ HEXXED (gradient dark purple/black, void) ============
  hx_shadow: { name: 'Shadow Assassin', rarity: 'hexxed', desc: 'Enemy at high HP → up to +200% damage. x1.75 when enemy doesn\'t see you.', passive: [], situational: [{ id: 'hxsa-max', label: 'Enemy at MAX HP', passive: [{ stat: 'atk', op: 'pct', value: 200 }] }, { id: 'hxsa-unseen', label: 'Enemy doesn\'t see you (x1.75)', passive: [{ stat: 'atk', op: 'mul', value: 1.75 }] }] },
  hx_royal: { name: 'Royal Executioner', rarity: 'hexxed', desc: 'Enemy at low HP → up to +200% damage. Execute enemies below 40% HP.', passive: [], situational: [{ id: 'hxre-low', label: 'Enemy at 0% threshold', passive: [{ stat: 'atk', op: 'pct', value: 200 }] }, { id: 'hxre-exec', label: 'Execute threshold (40% HP)', desc: 'Instant kill. No stat change.', passive: [] }] },
  hx_shrink: { name: 'Sci-Fi Shrink Ray', rarity: 'hexxed', desc: 'Damage shrinks enemies by 200% and reduces their DEF by 50%.', passive: [], notes: 'Affects enemy stats. No self stat impact.' },
  hx_void: { name: 'Abyssal Voided', rarity: 'hexxed', desc: '50% chance attacks spawn black holes. Trapped enemies lose their turn.', passive: [], notes: 'Proc effect. No direct stat impact.' },
  hx_econ: { name: 'Greedy Economic', rarity: 'hexxed', desc: 'Shops are 85% cheaper.', passive: [], notes: 'Economy effect. No combat stat impact.' },
  hx_pyro: { name: 'Manic Pyromaniac', rarity: 'hexxed', desc: 'Explosions x10 bigger. Apply BURN/POISON/BLEED/SLOW. Heal 20% HP/turn per BURNING enemy.', passive: [] },
  hx_vamp: { name: 'Ancient Vampiric', rarity: 'hexxed', desc: '+100% Lifesteal. Getting hit -10%. Hitting +10%.', passive: [{ stat: 'lifesteal', op: 'add', value: 100 }] },
  hx_solar: { name: 'Icarus Solar', rarity: 'hexxed', desc: '+80% SPD, +80% Dexterity. Nearby enemies slowed 30%.', passive: [{ stat: 'spd', op: 'pct', value: 80 }, { stat: 'dexterity', op: 'add', value: 80 }] },
  hx_gamble: { name: 'Idle Death Gambler', rarity: 'hexxed', desc: '+80% Crit Chance, +70% Crit Damage. Crits permanently increase ATK by +1%.', passive: [{ stat: 'crit_rate', op: 'add', value: 80 }, { stat: 'crit_dmg', op: 'add', value: 70 }], cultivation: { label: 'Permanent Crit Stacks', perStack: { stat: 'atk', op: 'pct', value: 1 }, defaultStacks: 0, maxStacks: 500 } },
  hx_defer: { name: 'Fractured Deferred', rarity: 'hexxed', desc: '+120% ATK. Damage in 2 turns. Targets lose 70% DEF.', passive: [{ stat: 'atk', op: 'pct', value: 120 }] },
  hx_true: { name: 'Vitriolic True', rarity: 'hexxed', desc: 'Completely ignore defense (100% True Damage).', passive: [{ stat: 'true_dmg', op: 'add', value: 100 }] },
  hx_heavy: { name: 'Heaviest of Heavy Hitter', rarity: 'hexxed', desc: '+1 ATK per 1 HP. No cap.', passive: [{ op: 'derived', stat: 'atk', from: 'hp', per: 1, perValue: 1 }] },
  hx_dusk: { name: "Duskbringer's Resolve", rarity: 'hexxed', desc: 'At ≤20% HP: instantly heal to full + x4 HP as shield.', passive: [], situational: [{ id: 'hxd-trig', label: 'Triggered (full heal + x4 HP shield)', passive: [] }] },
  hx_gymbro: { name: "Gymbro's Warmup Routine", rarity: 'hexxed', desc: 'Heavy exercise first round (cancels only if all enemies hit). After: +50% all stats. Restack each round.', passive: [], situational: [{ id: 'hxg-done', label: 'Warmup completed (+50% all)', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }, { id: 'hxg-2', label: 'Stacked twice (+100% all)', passive: [{ stat: 'all_main', op: 'pct', value: 100 }] }] },
  hx_godly: { name: 'Egotistic Godly', rarity: 'hexxed', desc: 'x2 ATK, x2 DEF. x4 all stats vs SPIRITS.', passive: [{ stat: 'atk', op: 'mul', value: 2 }, { stat: 'def', op: 'mul', value: 2 }], situational: [{ id: 'hxgd-spirit', label: 'Fighting a SPIRIT (x4 all)', passive: [{ stat: 'all_main', op: 'mul', value: 4 }] }] },
  hx_cult: { name: 'Soul Reaping Cultivation', rarity: 'hexxed', desc: 'Every fight, +5% in every main stat. Permanent scaling.', passive: [], cultivation: { label: 'Souls Reaped', perStack: { stat: 'all_main', op: 'pct', value: 5 }, defaultStacks: 10, maxStacks: 500 } },
  hx_cursed: { name: 'Undying Cursed', rarity: 'hexxed', desc: 'Lower HP → up to +200% damage. At 20% HP: 50% Lifesteal & 100% Resilience.', passive: [], situational: [{ id: 'hxc-20', label: 'At 20% HP', passive: [{ stat: 'atk', op: 'pct', value: 160 }, { stat: 'lifesteal', op: 'add', value: 50 }, { stat: 'resilience', op: 'add', value: 100 }] }, { id: 'hxc-50', label: 'At 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 100 }] }] },
  hx_angel: { name: 'Fallen Angelic', rarity: 'hexxed', desc: '+400% Heal Power. Healing mirrors fully. -20% Heal Power per hit taken.', passive: [{ stat: 'heal_pow', op: 'add', value: 400 }] },
  hx_ryoiki: { name: 'Overcharged Ryoiki', rarity: 'hexxed', desc: 'Start: shield = 100% HP. MAX HP round → +50% HP shield. +5% HP shield per attack.', passive: [], situational: [{ id: 'hxr-base', label: 'Base shield (100% HP)', desc: 'Shield only. No stat change.', passive: [] }] },
  hx_temp: { name: 'FTL Temporal', rarity: 'hexxed', desc: 'You get 3 turns per round.', passive: [], notes: 'Action economy. No direct stat impact.' },
  hx_spirit: { name: 'Mastered Spiritual', rarity: 'hexxed', desc: '+90% Cooldown Reduction. Repeated moves get x1.5 effectiveness.', passive: [{ stat: 'cooldown_red', op: 'add', value: 90 }] },
  hx_giant: { name: 'Colossus Slayer', rarity: 'hexxed', desc: 'Become microscopic. More damage the bigger your target.', passive: [], situational: [{ id: 'hxcs-huge', label: 'Target is COLOSSAL', passive: [{ stat: 'atk', op: 'pct', value: 200 }] }] },
  hx_goliath: { name: "Cappy's Goliath", rarity: 'hexxed', desc: 'Size x20. More damage the smaller your target.', passive: [], situational: [{ id: 'hxcg-tiny', label: 'Target is microscopic', passive: [{ stat: 'atk', op: 'pct', value: 200 }] }] },
  hx_adapt: { name: 'Unbound Adaptation', rarity: 'hexxed', desc: 'Hit by enemy → +50% DEF vs them. 4 hits → permanent immunity to that enemy.', passive: [], situational: [{ id: 'hxua-stk', label: 'Per stack vs an enemy', passive: [{ stat: 'def', op: 'pct', value: 50 }] }] },
  hx_blood: { name: 'Monstrous Bloodlust', rarity: 'hexxed', desc: '-10% HP/round. x3 Lifesteal. Hits +10% HP cost, lifesteal doubles. +5% Resilience.', passive: [{ stat: 'lifesteal', op: 'mul', value: 3 }, { stat: 'resilience', op: 'add', value: 5 }] },
  hx_glass: { name: 'Crystalized Glass Cannon', rarity: 'hexxed', desc: '+400% ATK, -100% DEF, -99% HP.', passive: [{ stat: 'atk', op: 'pct', value: 400 }, { stat: 'def', op: 'pct', value: -100 }, { stat: 'hp', op: 'pct', value: -99 }] },
  hx_magic: { name: 'Magical Girlypops', rarity: 'hexxed', desc: 'Whole party transforms: +20% all stats, x2 MAG.', passive: [{ stat: 'all_main', op: 'pct', value: 20 }, { stat: 'mag', op: 'mul', value: 2 }] },
  hx_nest: { name: 'Death-Defying Nesting Doll', rarity: 'hexxed', desc: '5 revives. -20% HP and -20% ATK per revive.', passive: [], situational: [{ id: 'hxnd-1', label: 'After 1 revive', passive: [{ stat: 'hp', op: 'pct', value: -20 }, { stat: 'atk', op: 'pct', value: -20 }] }, { id: 'hxnd-5', label: 'After 5 revives', passive: [{ stat: 'hp', op: 'pct', value: -100 }, { stat: 'atk', op: 'pct', value: -100 }] }] },
  hx_veng: { name: "Warlord's Vengeance", rarity: 'hexxed', desc: 'Per ally dead: x5 stats. All dead: lose all DEF, x10 all stats, +80% Lifesteal.', passive: [], situational: [{ id: 'hxv-1', label: '1 ally down (x5 stats)', passive: [{ stat: 'all_main', op: 'mul', value: 5 }] }, { id: 'hxv-all', label: 'All allies down', passive: [{ stat: 'all_main', op: 'mul', value: 10 }, { stat: 'def', op: 'mul', value: 0 }, { stat: 'lifesteal', op: 'add', value: 80 }] }] },
  hx_raid: { name: 'Final Raid Boss', rarity: 'hexxed', desc: 'Skip turn 1, immune to damage. After: x4 stats. Healing/buffs/shields on you x1.5. +50% Status Res.', passive: [], situational: [{ id: 'hxrb-loose', label: 'After turn 1 (released)', passive: [{ stat: 'all_main', op: 'mul', value: 4 }, { stat: 'status_res', op: 'add', value: 50 }] }] },
  hx_sticky: { name: 'Fingering Sticky', rarity: 'hexxed', desc: 'your fingers are very sticky :) also u get the sticky fingers stand.', passive: [], notes: 'Flavor / reference trait.' },
  hx_spicy: { name: 'Determined Spicy', rarity: 'hexxed', desc: '+90% Resilience (capped). Surviving on 1HP → x2 all stats infinitely.', passive: [{ stat: 'resilience', op: 'add', value: 90 }], situational: [{ id: 'hxds-1', label: 'Survived once on 1HP (x2 all)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }, { id: 'hxds-2', label: 'Survived twice on 1HP (x4 all)', passive: [{ stat: 'all_main', op: 'mul', value: 4 }] }] },
  hx_armor: { name: 'Full-Plate Armored', rarity: 'hexxed', desc: 'x10 DEF', passive: [{ stat: 'def', op: 'mul', value: 10 }] },

  // ============ DUALITY (heavenly/hellforged toggle) ============
  du_tank: {
    name: 'Divine Bulwark', rarity: 'duality',
    desc: 'Absorb all incoming party damage. Each hit heals you for 5% of the damage. +250% DEF.',
    passive: [{ stat: 'def', op: 'pct', value: 250 }],
    heavenly: { name: 'Divine Bulwark', desc: 'Absorb all incoming party damage. Each hit heals you for 5% of the damage. +250% DEF.', passive: [{ stat: 'def', op: 'pct', value: 250 }] },
    hellforged: { name: 'Infernal Bastion', desc: 'Every hit you take permanently stacks +5% DEF for that fight. No cap. +250% HP.', passive: [{ stat: 'hp', op: 'pct', value: 250 }] },
  },
  du_atk: {
    name: 'Radiant Strike', rarity: 'duality',
    desc: 'Every attack radiates to all adjacent enemies for 40% of the hit. Crits blind. +100% Crit Chance, +250% Crit Damage.',
    passive: [{ stat: 'crit_rate', op: 'add', value: 100 }, { stat: 'crit_dmg', op: 'add', value: 250 }],
    heavenly: { name: 'Radiant Strike', desc: 'Every attack radiates to all adjacent enemies for 40% of the hit. Crits blind. +100% Crit Chance, +250% Crit Damage.', passive: [{ stat: 'crit_rate', op: 'add', value: 100 }, { stat: 'crit_dmg', op: 'add', value: 250 }] },
    hellforged: { name: 'Soulreap', desc: "Every kill permanently grants +10% ATK for the campaign. Crits steal 20% of the target's remaining HP as True Damage. +250% ATK.", passive: [{ stat: 'atk', op: 'pct', value: 250 }] },
  },
  du_mag: {
    name: 'Celestial Surge', rarity: 'duality',
    desc: '+250% MAG. Your spells leave lingering auras that heal allies for 5% HP per round.',
    passive: [{ stat: 'mag', op: 'pct', value: 250 }],
    heavenly: { name: 'Celestial Surge', desc: '+250% MAG. Your spells leave lingering auras that heal allies for 5% HP per round.', passive: [{ stat: 'mag', op: 'pct', value: 250 }] },
    hellforged: { name: 'Infernal Grimoire', desc: "+250% MAG. Each spell permanently shreds 15% of the target's MAG for that fight.", passive: [{ stat: 'mag', op: 'pct', value: 250 }] },
  },
  du_heal: {
    name: 'Absolution', rarity: 'duality',
    desc: 'Overheals convert to shields. Healed allies become immune to the next debuff. +300% Heal Power.',
    passive: [{ stat: 'heal_pow', op: 'add', value: 300 }],
    heavenly: { name: 'Absolution', desc: 'Overheals convert to shields. Healed allies become immune to the next debuff applied to them. +300% Heal Power.', passive: [{ stat: 'heal_pow', op: 'add', value: 300 }] },
    hellforged: { name: 'Blood Tithe', desc: 'Sacrifice 10% of your HP to deal it as True Damage, then heal an ally for triple the sacrificed amount. +200% HP.', passive: [{ stat: 'hp', op: 'pct', value: 200 }] },
  },
  du_spd: {
    name: 'Ascent', rarity: 'duality',
    desc: '+250% SPD. You act twice every round. Auto-dodge the first attack each round. Attacks can never be blocked, parried, or evaded.',
    passive: [{ stat: 'spd', op: 'pct', value: 250 }],
    heavenly: { name: 'Ascent', desc: '+250% SPD. You act twice every round. Auto-dodge the first attack each round. Attacks can never be blocked, parried, or evaded.', passive: [{ stat: 'spd', op: 'pct', value: 250 }] },
    hellforged: { name: 'Death Sprint', desc: "+250% SPD. If your SPD exceeds the target's, the difference is dealt as bonus True Damage on every hit. Each enemy defeated permanently multiplies your SPD and DEX by 5 for the rest of that fight.", passive: [{ stat: 'spd', op: 'pct', value: 250 }] },
  },
  du_hybrid: {
    name: 'Covenant', rarity: 'duality',
    desc: 'Bond with one ally: share 75% of all stats between both of you. If either is defeated, the survivor gains x2 to all stats.',
    passive: [],
    heavenly: { name: 'Covenant', desc: 'Bond with one ally: share 75% of all stats between both of you. If either is defeated, the survivor gains x2 to all stats.', passive: [] },
    hellforged: { name: 'Devour', desc: 'Copy the trait of every enemy you kill and add it to yourself for the rest of that fight. Stacks infinitely.', passive: [] },
  },
  du_ruler: {
    name: 'Saviour', rarity: 'duality',
    desc: 'Grants ×2 HP and ×2 DEF to all party members. Each fallen ally increases everyone\'s DEF by +50% of your DEF. Party-wide +30 Resilience. If knocked out first: all allies gain +100% Heal Power. If last standing: HP fully regens and gain +20 Resilience.',
    passive: [{ stat: 'hp', op: 'pct', value: 100 }, { stat: 'def', op: 'pct', value: 100 }, { stat: 'resilience', op: 'add', value: 30 }],
    heavenly: {
      name: 'Saviour',
      desc: 'Grants ×2 HP and ×2 DEF to all party members. Each fallen ally increases everyone\'s DEF by +50% of your DEF. Party-wide +30 Resilience. If knocked out first: all allies gain +100% Heal Power. If last standing: HP fully regens and gain +20 Resilience.',
      passive: [{ stat: 'hp', op: 'pct', value: 100 }, { stat: 'def', op: 'pct', value: 100 }, { stat: 'resilience', op: 'add', value: 30 }],
    },
    hellforged: {
      name: 'Dictator',
      desc: '×2 all stats per surviving ally. Allies gain 50% of your ATK as bonus attack and ×2 Crit Chance. Each ally knocked out: −50% all non-HP stats. All allies down: stats reset, ATK & DEF ×4. If you fall first: all remaining allies gain ×2 ATK.',
      passive: [{ stat: 'all_main', op: 'mul', value: 2 }, { stat: 'crit_rate', op: 'add', value: 100 }],
    },
  },

  // ============ DETERMINED (evolving heartbeat) ============
  determination: {
    name: 'Determination', rarity: 'determined',
    desc: 'Revive infinitely in a fight, losing 1% main stats per defeat. Defeating enemies grants x1.5 current main stats permanently (max x10); at max: evolves to HATRED. Sparing enemies grants +5% Heal Power & +5% DEF per spare (max x10); at max: evolves to MERCYFUL.',
    passive: [],
    notes: 'Track defeats, kill stacks, and spare stacks on the chip. At 10 kills: HATRED. At 10 spares: MERCYFUL.',
  },

  // ============ LOL-INSPIRED: COMMON ============
  killingedge: { name: 'Killing Edge', rarity: 'common', desc: 'Deal +8% bonus damage to enemies below 30% HP.', passive: [], notes: 'Execute threshold bonus. +8% damage when target is below 30% HP.' },
  ironskin: { name: 'Iron Skin', rarity: 'common', desc: '+5 DEF. Passively reduce all physical damage taken by 5.', passive: [{ stat: 'def', op: 'add', value: 5 }] },
  carnivore: { name: 'Carnivore', rarity: 'common', desc: 'Restore 8 HP on every kill.', passive: [], notes: 'Restore 8 HP on each kill.' },
  happyhour: { name: 'Happy Hour', rarity: 'common', desc: '+5% Heal Power. Using a skill restores 3% of max HP.', passive: [{ stat: 'heal_pow', op: 'add', value: 5 }] },
  energized: { name: 'Energized', rarity: 'common', desc: 'Every 8th attack deals +50% ATK damage.', passive: [], notes: 'Attack counter passive. Every 8th hit is empowered.' },
  manasurge: { name: 'Mana Surge', rarity: 'common', desc: 'Every 5th attack restores a burst of energy.', passive: [], notes: 'Energy/mana restore on every 5th attack.' },
  armorshred: { name: 'Armor Shred', rarity: 'common', desc: 'Attacks reduce target DEF by 3% for 1 turn. Stacks up to 3x (max -9% DEF).', passive: [], notes: 'DEF debuff on target. Stacks up to 3x.' },
  gatheringspeed: { name: 'Gathering Speed', rarity: 'common', desc: 'Each attack adds a stack of speed (+2 SPD per stack, max 5). Stacks decay when not attacking.', passive: [{ stat: 'spd', op: 'add', value: 6 }], notes: 'SPD shown as average stack value.' },
  poisontrail: { name: 'Poison Trail', rarity: 'common', desc: 'Leave a toxic trail dealing 4 damage per turn to enemies who pass through it.', passive: [], notes: 'Environmental hazard. No direct stat bonus.' },
  toughitout: { name: 'Tough It Out', rarity: 'common', desc: 'After taking 3 hits, generate a shield equal to 8% max HP.', passive: [], notes: 'Shield triggered every 3 incoming hits.' },
  boneplating: { name: 'Bone Plating', rarity: 'common', desc: 'The first 3 hits received each combat deal 6 less damage.', passive: [], notes: 'Damage reduction on first 3 hits per combat.' },
  quickdraw: { name: 'Quick Draw', rarity: 'common', desc: 'Gain +10% ATK speed after skipping an action.', passive: [], notes: 'ATK speed bonus triggered by a turn with no attack.' },
  battlescar: { name: 'Battle Scar', rarity: 'common', desc: 'Gain +1 DEF permanently each time you are hit (max +10 per combat).', passive: [{ stat: 'def', op: 'add', value: 5 }], notes: 'DEF shown as average stack value (5).' },
  nimble: { name: 'Nimble', rarity: 'common', desc: 'Ignore unit collision. Take 4 less damage from all basic attacks.', passive: [{ stat: 'def', op: 'add', value: 4 }] },
  arcaneedge: { name: 'Arcane Edge', rarity: 'common', desc: 'After using any skill, the next attack deals bonus magic damage equal to 15% of MAG.', passive: [{ stat: 'mag', op: 'pct', value: 8 }], notes: 'Bonus magic hit after every skill use.' },
  triumph: { name: 'Triumph', rarity: 'common', desc: 'On kill, restore 12% of missing HP.', passive: [], notes: 'HP restore on kill. Scales with missing HP.' },
  perseverance: { name: 'Perseverance', rarity: 'common', desc: '+8% Heal Power. Begin regenerating HP rapidly after 2 turns out of combat.', passive: [{ stat: 'heal_pow', op: 'add', value: 8 }] },

  // ============ LOL-INSPIRED: RARE ============
  voracity: { name: 'Voracity', rarity: 'rare', desc: 'On kill or assist, reduce all cooldowns by 2 turns.', passive: [{ stat: 'cooldown_red', op: 'add', value: 8 }], notes: 'CDR burst on kill/assist.' },
  hemorrhage: { name: 'Hemorrhage', rarity: 'rare', desc: 'Attacks deal bleeding damage, stacking with every hit up to 5 stacks. Each stack adds +4 ATK as bleeding damage. At 5 stacks, the target is slowed for 1 turn.', passive: [], notes: 'Bleed stacks to 5. Slow at full stacks.' },
  nighthunter: { name: 'Night Hunter', rarity: 'rare', desc: 'Gain +15 SPD when moving directly toward a visible enemy.', passive: [{ stat: 'spd', op: 'add', value: 10 }], notes: '+15 SPD bonus when actively pursuing an enemy.' },
  doublestrike: { name: 'Double Strike', rarity: 'rare', desc: 'Every 7th attack on the same target strikes twice instantly.', passive: [], notes: 'Every 7th consecutive hit on same target = double hit.' },
  flurry: { name: 'Flurry', rarity: 'rare', desc: 'After casting a skill, the next 2 attacks deal +20% damage and cost no cooldown.', passive: [], notes: '+20% bonus on the 2 attacks immediately after a skill.' },
  martialcadence: { name: 'Martial Cadence', rarity: 'rare', desc: 'First attack on any new target deals bonus damage equal to 8% of their current HP.', passive: [], notes: '% current HP bonus on first hit per new target.' },
  spikedshell: { name: 'Spiked Shell', rarity: 'rare', desc: '15% of total DEF is added to ATK.', passive: [{ stat: 'atk', op: 'pct', value: 10 }], notes: 'DEF-to-ATK conversion. Passive shown as approximate bonus.' },
  eternalhunger: { name: 'Eternal Hunger', rarity: 'rare', desc: 'Lifesteal scales with missing HP. At 50% HP: +10% lifesteal. At 10% HP: +30% lifesteal.', passive: [{ stat: 'lifesteal', op: 'add', value: 10 }], situational: [{ id: 'eh-half', label: 'At 50% HP missing', passive: [{ stat: 'lifesteal', op: 'add', value: 10 }] }, { id: 'eh-low', label: 'At 10% HP missing', passive: [{ stat: 'lifesteal', op: 'add', value: 30 }] }] },
  fleetoffoot: { name: 'Fleet of Foot', rarity: 'rare', desc: 'Gain +12 SPD for 1 turn after a skill hits a target.', passive: [{ stat: 'spd', op: 'add', value: 8 }] },
  livingvengeance: { name: 'Living Vengeance', rarity: 'rare', desc: 'On kill: +20 ATK for 2 turns. On elite kill: +35 ATK for 2 turns.', passive: [], situational: [{ id: 'lv-kill', label: 'On kill (+20 ATK, 2 turns)', passive: [{ stat: 'atk', op: 'add', value: 20 }] }, { id: 'lv-elite', label: 'On elite kill (+35 ATK, 2 turns)', passive: [{ stat: 'atk', op: 'add', value: 35 }] }] },
  lovetap: { name: 'Love Tap', rarity: 'rare', desc: 'Attacks against a target not hit last turn deal +20% bonus damage.', passive: [], notes: '+20% damage on first contact with a target each turn cycle.' },
  clockworkwindup: { name: 'Clockwork Windup', rarity: 'rare', desc: 'Consecutive attacks on the same target deal increasing damage (+5% per hit, max +25%).', passive: [], situational: [{ id: 'cw-max', label: 'At 5 consecutive hits (+25% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 25 }] }] },
  voidstone: { name: 'Void Stone', rarity: 'rare', desc: 'Reduce all magic damage taken by 20%. Absorbed magic damage partially charges your next magical hit.', passive: [{ stat: 'status_res', op: 'add', value: 15 }], notes: '-20% magic damage taken. Charge mechanic on magic hits.' },
  guerrillawarfare: { name: 'Guerrilla Warfare', rarity: 'rare', desc: 'Standing still for 1 turn renders you invisible. First attack from stealth deals +40% damage.', passive: [], notes: 'Stealth on idle turn. +40% on break-stealth attack.' },
  mortalwill: { name: 'Mortal Will', rarity: 'rare', desc: 'Build charges from attacks and skills (max 5). At 5 charges, the next ability gains +30% damage and a bonus effect.', passive: [], notes: '5-charge stack system. Empowered next ability at full stacks.' },
  triumphantroar: { name: 'Triumphant Roar', rarity: 'rare', desc: 'When any nearby unit dies, restore 6% of max HP.', passive: [{ stat: 'heal_pow', op: 'add', value: 8 }], notes: 'HP regen triggered by any nearby death.' },
  deadlyvenom: { name: 'Deadly Venom', rarity: 'rare', desc: 'Attacks apply stacking poison (max 5 stacks). Each stack deals 2 true damage per turn.', passive: [{ stat: 'true_dmg', op: 'add', value: 5 }], notes: 'Stacking poison: 2 true damage per turn per stack.' },
  salvation: { name: 'Salvation', rarity: 'rare', desc: 'Gain +20 SPD when moving toward an ally below 30% HP.', passive: [{ stat: 'spd', op: 'add', value: 8 }], notes: '+20 SPD when rushing toward a low-HP ally.' },
  blaze: { name: 'Blaze', rarity: 'rare', desc: 'Skills ignite targets: deal 4% of their max HP as magic damage over 2 turns. Three ignite stacks on one target cause an explosion dealing 12% of their max HP.', passive: [], notes: 'DoT on skill hit. Triple-stack explosion.' },
  hailofblades: { name: 'Hail of Blades', rarity: 'rare', desc: 'Gain +60% ATK speed on the first 3 attacks of any combat encounter.', passive: [], notes: 'Burst ATK speed boost limited to first 3 attacks per combat.' },

  // ============ LOL-INSPIRED: EPIC ============
  noxianmight: { name: 'Noxian Might', rarity: 'epic', desc: 'When your Hemorrhage bleeding reaches 5 stacks on a target, gain +50% ATK for 2 turns.', passive: [], situational: [{ id: 'nm-active', label: 'Hemorrhage at 5 stacks (2 turns)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }] },
  divineascent: { name: 'Divine Ascent', rarity: 'epic', desc: 'Attacks build Zeal stacks (max 4). At 4 stacks, become Exalted for 1 turn: all attacks deal +25% damage and have 100% crit chance. Then stacks reset.', passive: [], situational: [{ id: 'da-exalted', label: 'While Exalted (1 turn, +25% ATK, 100% crit)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'crit_rate', op: 'add', value: 100 }] }] },
  pitgrit: { name: 'Pit Grit', rarity: 'epic', desc: 'Track all damage taken over 2 turns. Store 40% of that total as a shield that deploys when the damage stops.', passive: [], notes: 'Damage absorption shield. Scales with incoming damage.' },
  reignofanger: { name: 'Reign of Anger', rarity: 'epic', desc: 'Build Fury when hit. Above 50 Fury: gain +20% ATK and +10% lifesteal. Fury decays out of combat.', passive: [], situational: [{ id: 'roa-fury', label: 'Above 50 Fury (+20% ATK, +10% lifesteal)', passive: [{ stat: 'atk', op: 'pct', value: 20 }, { stat: 'lifesteal', op: 'add', value: 10 }] }] },
  deathbringstance: { name: 'Deathbringer Stance', rarity: 'epic', desc: 'Every 4th attack deals 8% of the target\'s max HP as bonus damage and heals you for the same amount.', passive: [], notes: 'Every 4th hit: % max HP bonus damage + self heal.' },
  arcaneburstcharge: { name: 'Arcane Burst', rarity: 'epic', desc: 'Between skill casts, attacks charge a burst counter. At 3 charges, the next skill deals +40% extra damage.', passive: [], notes: '3-attack charge counter between skill casts.' },
  brittleapply: { name: 'Brittle', rarity: 'epic', desc: 'Skills apply Brittle to targets. Attacks against Brittle targets deal +12% damage and briefly reduce their DEF.', passive: [], notes: 'Brittle mark applied by skills. Consumed by attacks for bonus damage.' },
  fervorofbattle: { name: 'Fervor of Battle', rarity: 'epic', desc: 'Hitting an enemy with a skill grants a Fervor stack (+3% ATK, max 8 stacks). Stacks decay out of combat.', passive: [], situational: [{ id: 'fob-max', label: 'At max Fervor (8 stacks, +24% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 24 }] }] },
  shepherdofsouls: { name: 'Shepherd of Souls', rarity: 'epic', desc: 'Every time a nearby enemy dies, a Spectral Ghoul spawns and fights alongside you for 3 turns.', passive: [], notes: 'Summons a ghoul ally on each nearby death. Lasts 3 turns.' },
  petricite: { name: 'Petricite Burst', rarity: 'epic', desc: 'Casting skills charges your weapon (max 2 charges). Charged attacks deal +25% magic damage in a small arc.', passive: [{ stat: 'mag', op: 'pct', value: 10 }], notes: 'Skill charges weapon. Charged AAs deal AoE magic damage.' },
  berserkerrage: { name: 'Berserker Rage', rarity: 'epic', desc: 'ATK speed scales inversely with HP. At full HP: normal. At 50% HP: +25% ATK speed. At 10% HP: +50% ATK speed.', passive: [], situational: [{ id: 'br-half', label: 'At 50% HP (+25% ATK speed)', passive: [{ stat: 'spd', op: 'pct', value: 15 }] }, { id: 'br-low', label: 'At 10% HP (+50% ATK speed)', passive: [{ stat: 'spd', op: 'pct', value: 35 }] }] },
  markofthestorm: { name: 'Mark of the Storm', rarity: 'epic', desc: 'Skills apply Storm Marks. At 3 marks on one target: they are stunned for 1 turn and marks are consumed.', passive: [], notes: '3 marks = stun for 1 turn. Marks applied by skills.' },
  runicblade: { name: 'Runic Blade', rarity: 'epic', desc: 'Each skill cast loads an empowered charge onto your weapon (max 3). Attacks spend charges for +15% ATK each.', passive: [], notes: 'Skill charges weapon with up to 3 empowered attacks.' },
  organicdeconstruct: { name: 'Organic Deconstruction', rarity: 'epic', desc: 'Hitting the same target with 3 different attack types (physical, magical, true) triggers a true damage explosion equal to 10% of their max HP.', passive: [{ stat: 'true_dmg', op: 'add', value: 8 }], notes: '3-type combo triggers a % max HP true damage explosion.' },
  sunlightmark: { name: 'Sunlight', rarity: 'epic', desc: 'Skills apply a Sunlight mark. The next ally attack on a marked target deals bonus light damage equal to 15% of your MAG.', passive: [{ stat: 'mag', op: 'pct', value: 8 }], notes: 'Support: ally attacks on your Sunlight-marked targets deal bonus damage.' },
  presstheattack: { name: 'Press the Attack', rarity: 'epic', desc: 'Hit an enemy 3 times in a row to expose them: they take +12% increased damage from all sources for 2 turns.', passive: [], notes: '3 consecutive hits = expose debuff on target for 2 turns.' },
  whiplash: { name: 'Whiplash', rarity: 'epic', desc: 'After dashing or being forcibly displaced, the next attack deals +35% damage.', passive: [], notes: '+35% damage on first attack after any displacement.' },
  phaserush: { name: 'Phase Rush', rarity: 'epic', desc: 'Hitting an enemy 3 times within the same turn grants +30 SPD and 75% slow resistance for 1 turn.', passive: [{ stat: 'spd', op: 'add', value: 10 }], situational: [{ id: 'pr-active', label: 'Phase Rush active (+30 SPD, 1 turn)', passive: [{ stat: 'spd', op: 'add', value: 30 }] }] },
  graspundying: { name: 'Grasp of the Undying', rarity: 'epic', desc: 'Every 2 turns, the next attack heals 6% of the target\'s max HP and permanently increases your max HP by 5.', passive: [{ stat: 'heal_pow', op: 'add', value: 12 }], notes: 'HP heal + permanent max HP growth every 2 turns.' },
  electrocute: { name: 'Electrocute', rarity: 'epic', desc: 'Hit an enemy with 3 separate attacks within the same turn to trigger a lightning strike dealing 40 + 30% ATK as magic damage.', passive: [], notes: '3-hit lightning trigger within one turn.' },
  darkharvestlol: { name: 'Dark Harvest', rarity: 'epic', desc: 'Killing low-HP enemies absorbs their essence. Permanently gain +2 true damage per stack. Stacks persist across fights.', passive: [{ stat: 'true_dmg', op: 'add', value: 5 }], notes: 'Stacking true damage on low-HP kills. Permanent stacks.' },

  // ============ LOL-INSPIRED: LEGENDARY ============
  duelistsdance: { name: "Duelist's Dance", rarity: 'legendary', desc: 'Four Vital Points appear on enemies. Striking one heals 5% max HP, grants +20 SPD for 1 turn, and deals +50% damage. All 4 Vitals refresh after they\'ve all been hit.', passive: [], notes: 'Vital cycle system. 5% heal + SPD + bonus damage per Vital hit.' },
  damnation: { name: 'Damnation', rarity: 'legendary', desc: 'Every enemy killed drops a Soul. Collect souls for permanent +3 ATK and +3 DEF each. No cap.', passive: [], cultivation: { label: 'Souls Collected', perStack: [{ stat: 'atk', op: 'add', value: 3 }, { stat: 'def', op: 'add', value: 3 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Permanent soul-stack +3 ATK and +3 DEF per kill.' },
  kindredmark: { name: 'Mark of the Kindred', rarity: 'legendary', desc: 'Designate a Hunt target. Each hunted enemy defeated permanently grants +15 to all stats. Marks renew each combat.', passive: [], cultivation: { label: 'Hunted Kills', perStack: [{ stat: 'all_main', op: 'add', value: 15 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Hunt target system. +15 all stats per marked kill. Permanent.' },
  crimsonpact: { name: 'Crimson Pact', rarity: 'legendary', desc: 'Every 30 HP = +1 MAG. Every 10 MAG = +15 HP. Both stats scale off each other dynamically.', passive: [{ op: 'derived', stat: 'mag', from: 'hp', per: 30, perValue: 1 }, { op: 'derived', stat: 'hp', from: 'mag', per: 10, perValue: 15 }], notes: 'HP/MAG dynamic conversion. Stats update whenever either is gained.' },
  mirageform: { name: 'Mirage Form', rarity: 'legendary', desc: 'When dropping below 25% HP, spawn a combat-capable decoy with 50% of your stats for 3 turns. It draws enemy attention and attacks.', passive: [], notes: 'Low-HP decoy summon. Decoy fights and taunts for 3 turns.' },
  wayofwanderer: { name: 'Way of the Wanderer', rarity: 'legendary', desc: 'Cannot critically strike normally. Instead, build Flow as you move. At full Flow, gain a shield equal to 15% max HP. All your crits deal 200% damage regardless of source.', passive: [{ stat: 'crit_dmg', op: 'add', value: 100 }], notes: 'No normal crits. Flow builds on movement. 200% crit damage.' },
  ionianfervor: { name: 'Ionian Fervor', rarity: 'legendary', desc: 'Hitting multiple enemies at once: +6% damage reduction per enemy hit (max 18%). Against a single target: attacks stack +4% ATK per hit (max 6 stacks).', passive: [], situational: [{ id: 'if-multi', label: 'Hitting 3+ enemies (-18% damage taken)', passive: [{ stat: 'def', op: 'pct', value: 18 }] }, { id: 'if-single', label: 'At 6 single-target stacks (+24% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 24 }] }] },
  unseenpredator: { name: 'Unseen Predator', rarity: 'legendary', desc: 'Striking from stealth or behind grants a Trophy stack (+5 ATK, +3 SPD). Stacks are permanent. Max 10.', passive: [], situational: [{ id: 'up-max', label: 'At max Trophies (10 stacks)', passive: [{ stat: 'atk', op: 'add', value: 50 }, { stat: 'spd', op: 'add', value: 30 }] }] },
  contemptweak: { name: 'Contempt for the Weak', rarity: 'legendary', desc: 'Attacks against enemies below 50% HP deal bonus true damage equal to 6% of their max HP.', passive: [{ stat: 'true_dmg', op: 'add', value: 6 }], notes: '% max HP true damage bonus on sub-50% enemies.' },
  deathbydegrees: { name: 'Death by Degrees', rarity: 'legendary', desc: 'Attacks deal bonus damage equal to 1.5% of the target\'s max HP. Heals you for half that amount.', passive: [{ stat: 'lifesteal', op: 'add', value: 5 }, { stat: 'true_dmg', op: 'add', value: 5 }], notes: '% max HP damage per hit + 50% lifesteal from it.' },
  wayofhunter: { name: 'Way of the Hunter', rarity: 'legendary', desc: 'Every other attack deals bonus magic damage equal to 60% of ATK. Physical and magical damage alternate with each hit.', passive: [{ stat: 'mag', op: 'pct', value: 30 }], notes: 'Alternating physical/magic on every other attack.' },
  darkinrebirth: { name: 'Darkin Rebirth', rarity: 'legendary', desc: 'On death, channel briefly then revive at 40% HP with +50% ATK for 3 turns. Once per encounter.', passive: [], situational: [{ id: 'dr-revive', label: 'Post-revive (+50% ATK for 3 turns)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }] },
  shatteredtime: { name: 'Shattered Time', rarity: 'legendary', desc: 'Each skill use reduces all cooldowns by 2 turns and grants a burst of +15 SPD.', passive: [{ stat: 'cooldown_red', op: 'add', value: 15 }, { stat: 'spd', op: 'add', value: 8 }] },
  livingforge: { name: 'Living Forge', rarity: 'legendary', desc: 'Can upgrade one item mid-combat. All attacks also apply Brittle to enemies. Brittle targets take +30% crit damage.', passive: [], notes: 'Item upgrade mid-fight + persistent Brittle on all attacks.' },
  undyinggrasp: { name: 'Undying Grasp', rarity: 'legendary', desc: 'When you would be killed, instantly enter Stasis: untargetable and immune for 1 turn. After Stasis, revive at 20% HP. Once per combat.', passive: [], notes: 'Once-per-combat death prevention. 1-turn Stasis + revive at 20% HP.' },

  // ============ LOL-INSPIRED: MYTHIC ============
  lastingspoils: { name: 'Lasting Spoils', rarity: 'mythic', desc: 'Every enemy defeated drops an essence. Permanently gain +6 ATK and +6 DEF per soul collected. No cap.', passive: [], cultivation: { label: 'Souls Collected', perStack: [{ stat: 'atk', op: 'add', value: 6 }, { stat: 'def', op: 'add', value: 6 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Permanent soul-stacking: +6 ATK and +6 DEF per kill.' },
  icathiansurprise: { name: 'Icathian Surprise', rarity: 'mythic', desc: 'On death, go dormant for an instant, then explode: deal true damage equal to 50% of your max HP to all nearby enemies.', passive: [], notes: 'Death explosion. AoE true damage equal to 50% max HP.' },
  gloryindeath: { name: 'Glory in Death', rarity: 'mythic', desc: 'On death, enter an undead rage for 3 turns: unlimited energy, deal 200% of normal damage, heal from all damage dealt. Cannot die until the 3 turns expire.', passive: [], situational: [{ id: 'gid-undead', label: 'While in undead rage (3 turns)', passive: [{ stat: 'atk', op: 'pct', value: 200 }, { stat: 'lifesteal', op: 'add', value: 100 }] }] },
  feast: { name: 'Feast', rarity: 'mythic', desc: 'On kill: permanently grow. Gain +20 HP, +5 ATK, +3 DEF, +3 MAG. No cap. You are what you eat.', passive: [], cultivation: { label: 'Kills', perStack: [{ stat: 'hp', op: 'add', value: 20 }, { stat: 'atk', op: 'add', value: 5 }, { stat: 'def', op: 'add', value: 3 }, { stat: 'mag', op: 'add', value: 3 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Permanent stat growth per kill. No max stacks.' },
  ravonoushunger: { name: 'Ravenous Hunger', rarity: 'mythic', desc: 'For every 10% HP missing: gain +5% ATK, +5% lifesteal, and +3% true damage. Scales continuously.', passive: [], situational: [{ id: 'rh-50', label: 'At 50% HP missing', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'lifesteal', op: 'add', value: 25 }, { stat: 'true_dmg', op: 'add', value: 15 }] }, { id: 'rh-90', label: 'At 90% HP missing', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'lifesteal', op: 'add', value: 45 }, { stat: 'true_dmg', op: 'add', value: 27 }] }] },
  bloodfeud: { name: 'Blood Feud', rarity: 'mythic', desc: 'Passively track the enemy dealing the most damage to you. Deal +25% damage to them and take -15% damage from them.', passive: [], notes: 'Auto-tracks highest-damage enemy. Bonus applies only vs that target.' },
  eclipsecycle: { name: 'Eclipse Cycle', rarity: 'mythic', desc: 'After being struck 3 times, become untargetable for 1 turn and reappear behind your attacker. 8-turn cooldown.', passive: [], notes: '3-hit trigger: 1-turn untargetable + reposition. 8-turn cooldown.' },
  voidrift: { name: 'Void Rift', rarity: 'mythic', desc: 'Every 4th skill tears a Void Rift: AoE magic damage equal to 15% of nearby enemies\' max HP, and silences them for 1 turn.', passive: [], notes: 'Every 4th skill cast: AoE % max HP damage + 1-turn silence.' },
  chronorift: { name: 'Chronorift', rarity: 'mythic', desc: 'When you would take lethal damage, rewind to your position and HP from 1 turn ago. Once per combat.', passive: [], notes: 'Once-per-combat lethal rewind to previous turn\'s HP state.' },
  celestialopp: { name: 'Celestial Opposition', rarity: 'mythic', desc: 'Passively alternate between SOLAR (+30% ATK, +30% SPD) and LUNAR (+30% DEF, +30% MAG) stances after each action. Switching is instant.', passive: [], situational: [{ id: 'co-solar', label: 'SOLAR stance (+30% ATK, +30% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'spd', op: 'pct', value: 30 }] }, { id: 'co-lunar', label: 'LUNAR stance (+30% DEF, +30% MAG)', passive: [{ stat: 'def', op: 'pct', value: 30 }, { stat: 'mag', op: 'pct', value: 30 }] }] },
  deathmarklol: { name: 'Deathmark', rarity: 'mythic', desc: 'Passively mark the highest-HP enemy. After 1 turn, they take true damage equal to 20% of all damage dealt to them during that turn. Refreshes on new targets.', passive: [], notes: 'Marks highest-HP enemy. Burst-back as true damage after 1 turn.' },
  infiniteduress: { name: 'Infinite Duress', rarity: 'mythic', desc: 'Lock onto the target you\'ve hit most this combat. They take +30% increased damage from you and your DEF bypass cannot be reduced.', passive: [], notes: 'Auto-tracks most-hit target. +30% damage and DEF bypass vs that target.' },

  // ============ LOL-INSPIRED: HEXXED ============
  blightedquill: { name: 'Blighted Quill', rarity: 'hexxed', desc: 'Attacks apply Blight (max 5 stacks). At 5 stacks: trigger true damage equal to 15% of the target\'s max HP. Side effect: 1 self-Blight stack per 8 of your own hits.', passive: [{ stat: 'true_dmg', op: 'add', value: 5 }], notes: 'Blight stacking vs target + self-blight side effect every 8 hits.' },
  feastofflesh: { name: 'Feast of Flesh', rarity: 'hexxed', desc: 'On kill, permanently devour the fallen: gain HP equal to 12% of their max HP (min +25), +12 ATK, +8 DEF, and +6 MAG. Every 5th kill, all future growth bonuses double permanently. No cap. You become unstoppable.', passive: [], cultivation: { label: 'Kills', perStack: [{ stat: 'hp', op: 'add', value: 25 }, { stat: 'atk', op: 'add', value: 12 }, { stat: 'def', op: 'add', value: 8 }, { stat: 'mag', op: 'add', value: 6 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Permanent scaling per kill. Every 5th kill: all growth doubles. No cap. HP gain uses minimum value (+25); actual gain is 12% of enemy max HP.' },
  fracturelol: { name: 'Fracture', rarity: 'hexxed', desc: 'Your attacks ignore all DEF. So do attacks made against you. DEF is nullified for both sides. In exchange, gain +40% ATK and +30% SPD.', passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 30 }], notes: 'DEF nullified on both sides. ATK/SPD granted as compensation.' },
  palecascade: { name: 'Pale Cascade', rarity: 'hexxed', desc: 'Passively orbit up to 5 protective orbs (start with 3). While at least 1 orb is active: +30% MAG and +30% ATK, plus an additional +5% per extra orb (max +50% MAG and +50% ATK at 5 orbs). Each orb absorbs 1 hit and heals 10% HP when broken. New orbs regenerate every 3 turns.', passive: [], situational: [{ id: 'pc-1orb', label: '1 orb active (+30% ATK, +30% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'mag', op: 'pct', value: 30 }] }, { id: 'pc-5orb', label: '5 orbs active (+50% ATK, +50% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }] }] },
  corruptedfervor: { name: 'Corrupted Fervor', rarity: 'hexxed', desc: 'Attacks stack Fervor (+5% ATK, +3% SPD per stack, max 10). At 10 stacks, CORRUPTION takes hold for 2 turns: +150% ATK, +20% lifesteal, all attacks deal true damage, but you attack the nearest unit regardless of alignment. After corruption ends: collapse. All stats drop 30% for 1 turn, then stacks reset.', passive: [], situational: [{ id: 'cf-building', label: 'At max Fervor (10 stacks, pre-corruption)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 30 }] }, { id: 'cf-corrupt', label: 'CORRUPTION active (2 turns)', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'lifesteal', op: 'add', value: 20 }, { stat: 'true_dmg', op: 'add', value: 100 }] }, { id: 'cf-collapse', label: 'Post-corruption collapse (1 turn)', passive: [{ stat: 'atk', op: 'pct', value: -30 }, { stat: 'def', op: 'pct', value: -30 }, { stat: 'spd', op: 'pct', value: -30 }] }] },
  crimsontide: { name: 'Crimson Tide', rarity: 'hexxed', desc: 'While you have 5 Hemorrhage bleeding stacks active on at least one enemy: gain +250% ATK. Hemorrhage also executes targets below 20% HP, but each execution costs 10% of your own max HP.', passive: [], situational: [{ id: 'ct-active', label: 'While 5 Hemorrhage stacks active (+250% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 250 }] }, { id: 'ct-execute', label: 'On execute (costs 10% own max HP)', passive: [] }] },
  darkres: { name: 'Dark Resonance', rarity: 'hexxed', desc: 'Your Blaze DoT burns you too. You and the ignited target both burn. Your burning state grants +15% ATK but constantly drains HP each turn.', passive: [{ stat: 'atk', op: 'pct', value: 15 }], notes: 'Mutual burning. ATK bonus while burning. Self HP drain per turn.' },
  deathscaress: { name: "Death's Caress", rarity: 'hexxed', desc: 'Build a massive shield over time while not attacking. When the shield is released or broken, it deals damage equal to its value to all nearby enemies. Cannot attack while building the shield.', passive: [], notes: 'Idle shield builder. Release or break = AoE burst equal to shield value.' },

  // ============ LOL-INSPIRED: DUALITY ============
  hunterhunted: {
    name: 'Hunter / Hunted', rarity: 'duality',
    desc: 'Every 3 turns survived in combat, permanently gain +7.5% to all stats for the rest of the encounter. Also, gain +5 HP and +5 DEF per turn. The longer the fight, the more overwhelming you become.',
    passive: [],
    heavenly: {
      name: 'Hunted',
      desc: 'Every 3 turns survived in combat, permanently gain +7.5% to all stats for the rest of the encounter. Also, gain +5 HP and +5 DEF per turn. The longer the fight, the more overwhelming you become.',
      passive: []
    },
    hellforged: {
      name: 'Hunter',
      desc: 'While actively in combat, gain +75 ATK. Each attack increases this gain by +5. If you spend a full round without attacking, lose 5% current HP.',
      passive: []
    },
    situational: [
      { id: 'hh-hunted3', label: 'HEAVENLY: After 3 turns (+7.5% all stats, +15 HP/DEF)', passive: [{ stat: 'all_main', op: 'pct', value: 7.5 }, { stat: 'hp', op: 'add', value: 15 }, { stat: 'def', op: 'add', value: 15 }] },
      { id: 'hh-hunted6', label: 'HEAVENLY: After 6 turns (+15% all stats, +30 HP/DEF)', passive: [{ stat: 'all_main', op: 'pct', value: 15 }, { stat: 'hp', op: 'add', value: 30 }, { stat: 'def', op: 'add', value: 30 }] },
      { id: 'hh-hunted10', label: 'HEAVENLY: After 10 turns (+25% all stats, +50 HP/DEF)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }, { stat: 'hp', op: 'add', value: 50 }, { stat: 'def', op: 'add', value: 50 }] },
      { id: 'hh-hunter', label: 'HELLFORGED: While attacking (+75 ATK)', passive: [{ stat: 'atk', op: 'add', value: 75 }] },
      { id: 'hh-hunter3', label: 'HELLFORGED: While attacking, 3 attacks (+90 ATK)', passive: [{ stat: 'atk', op: 'add', value: 90 }] },
      { id: 'hh-hunter5', label: 'HELLFORGED: While attacking, 5 attacks (+100 ATK)', passive: [{ stat: 'atk', op: 'add', value: 100 }] },
      { id: 'hh-hunter10', label: 'HELLFORGED: While attacking, 10 attacks (+125 ATK)', passive: [{ stat: 'atk', op: 'add', value: 125 }] }
    ],
  },
  daybreaknight: {
    name: 'Daybreak / Nightfall', rarity: 'duality',
    desc: 'Skills deal +30% damage in the first half of combat. ATK gradually fades as time passes.',
    passive: [],
    heavenly: {
      name: 'Daybreak',
      desc: 'Skills deal +30% damage in the first half of combat. ATK gradually fades as time passes.',
      passive: []
    },
    hellforged: {
      name: 'Nightfall',
      desc: 'Start weakened. Every 3 turns of combat, permanently gain +10% to all damage. Gets increasingly terrifying.',
      passive: []
    },
    situational: [{ id: 'dn-day', label: 'HEAVENLY: Early combat (+30% skill damage)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'dn-night3', label: 'HELLFORGED: After 3 turns (+10% all damage)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'dn-night9', label: 'HELLFORGED: After 9 turns (+30% all damage)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }],
  },
  // ============ LOL-INSPIRED: SUPPORT / UTILITY ============
  moonstonemending: { name: 'Moonstone Mending', rarity: 'rare', desc: 'Passively heals the most-injured ally for 5% max HP whenever any ally takes damage. Can trigger once per turn.', passive: [] },
  eyeofthestorm: { name: 'Eye of the Storm', rarity: 'rare', desc: 'Shield one ally for 20% max HP. While the shield holds, they gain +20% ATK.', passive: [] },
  warmhugs: { name: 'Warm Hugs', rarity: 'rare', desc: 'At the start of each turn, the ally with the lowest HP% receives a small shield worth 8% of their max HP.', passive: [] },
  ardentcenser: { name: 'Ardent Censer', rarity: 'rare', desc: 'Whenever you heal or shield an ally, they gain +20% ATK and +15% SPD for 2 turns.', passive: [], situational: [{ id: 'ac-active', label: 'Ally buffed by Ardent Censer (+20% ATK, +15% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 20 }, { stat: 'spd', op: 'pct', value: 15 }] }] },
  pixswatch: { name: "Pix's Watch", rarity: 'rare', desc: 'Shield one ally. Your companion Pix follows them, dealing minor magic damage (3% MAG) to every enemy that hits them.', passive: [] },
  rewind: { name: 'Rewind', rarity: 'rare', desc: 'Every 3 turns, reduce all your ability cooldowns by 1 turn.', passive: [] },
  timewarp: { name: 'Time Warp', rarity: 'rare', desc: 'Grant one ally +50% SPD for 2 turns, OR slow one enemy by 50% SPD for 2 turns. Choose each use.', passive: [] },
  tidecallersblessing: { name: "Tidecaller's Blessing", rarity: 'rare', desc: 'Empower one ally: their next 3 attacks each slow the target by 25% SPD and deal bonus magic damage (+15% MAG).', passive: [] },
  focusedresolve: { name: 'Focused Resolve', rarity: 'rare', desc: 'Tether to one enemy for 2 turns. They cannot flee. If the tether holds the full duration: root them for 1 turn and heal yourself for 20% HP.', passive: [] },
  mikaelscleanse: { name: "Mikael's Cleanse", rarity: 'rare', desc: 'Once per battle: remove all crowd control and status effects from one ally and heal them for 20% HP.', passive: [] },
  zekesconvergence: { name: "Zeke's Convergence", rarity: 'rare', desc: 'Bind to one ally. Enemies who attack them are slowed 30% SPD and take +15% increased damage from all sources.', passive: [] },
  whimsy: { name: 'Whimsy', rarity: 'epic', desc: 'Choose a mode before battle.\n\nPOLYMORPH: Transform one enemy into a harmless critter for 1 turn; they cannot act.\nEMPOWER: Grant one ally +50% SPD and +25% ATK for 2 turns.', passive: [] },
  powerchord: { name: 'Power Chord', rarity: 'epic', desc: 'Every 3rd ability activates a rotating Power Chord:\n♪ Hymn: +25% ATK to all allies for 2 turns.\n♪ Aria: Heal the most-hurt ally for 20% HP.\n♪ Celerity: +30% SPD to all allies for 1 turn.\nCycles endlessly.', passive: [] },
  starcall: { name: 'Starcall', rarity: 'epic', desc: 'Passively heal all allies for 5% max HP each turn. If any enemy is silenced, this healing doubles to 10% HP.', passive: [] },
  cozycampfire: { name: 'Cozy Campfire', rarity: 'epic', desc: 'Deploy a healing zone for 3 turns. Allies inside heal 8% HP per turn and gain +10% to all healing received.', passive: [] },
  mantra: { name: 'Mantra', rarity: 'epic', desc: 'Every 4th ability you cast is Mantra-empowered, doubling its effect: shields are larger, heals restore more, and debuffs last an extra turn.', passive: [] },
  equinox: { name: 'Equinox', rarity: 'epic', desc: 'Create a zone of silence for 2 turns. Enemies inside cannot use abilities.', passive: [] },
  wildgrowth: { name: 'Wild Growth', rarity: 'legendary', desc: 'Once per battle: instantly enlarge one ally. They gain +300 HP, knock back all nearby enemies, and gain +15% ATK for 2 turns.', passive: [] },
  wish: { name: 'Wish', rarity: 'legendary', desc: 'Once per battle: heal ALL allies for 80% max HP and remove one debuff from each.', passive: [] },
  crescendo: { name: 'Crescendo', rarity: 'legendary', desc: 'Once per battle: stun all enemies for 1 turn and restore 15% HP to all allies simultaneously.', passive: [] },
  monsoon: { name: 'Monsoon', rarity: 'legendary', desc: 'Once per battle: knock back all enemies and heal all allies for 20% HP per turn for 3 turns.', passive: [] },
  bailout: { name: 'Bailout', rarity: 'legendary', desc: 'Once per battle: grant an ally a second chance. If they die within the next 3 turns, they revive at 50% HP and go berserk (+75% ATK) for 2 turns before collapsing.', passive: [] },
  hostiletakeover: { name: 'Hostile Takeover', rarity: 'legendary', desc: 'Once per battle: one enemy goes berserk for 2 turns, forced to attack their own allies instead of yours.', passive: [] },
  tidalwave: { name: 'Tidal Wave', rarity: 'legendary', desc: 'Once per battle: knock up all enemies for 1 turn. Upon landing, they are slowed by 60% SPD and lose 50% DEX for 2 turns.', passive: [] },
  chronoshift: { name: 'Chronoshift', rarity: 'mythic', desc: 'When any ally (including yourself) would die, they instead survive at 50% HP and become invulnerable for 2 turns. This effect can trigger once per ally per battle. Every member of your team gets one second chance.', passive: [] },
  cosmicradiance: { name: 'Cosmic Radiance', rarity: 'mythic', desc: 'Once per battle: after a 1-turn channel, all allies become fully invulnerable for 3 turns. They cannot be hurt, debuffed, or displaced.', passive: [] },
  temperedfate: { name: 'Tempered Fate', rarity: 'mythic', desc: 'Once per battle: freeze every unit except yourself in stasis for 2 turns. Allies and enemies alike cannot act or take damage. Only you may move and act freely.', passive: [] },
  attached: { name: 'Attached', rarity: 'mythic', desc: 'At battle start, tether to the nearest ally. While attached: you cannot be targeted, and you passively grant them 75% of all your stats as bonus stats. You may still act and use abilities freely.\n\nIf your tether ally dies, you detach. Your DEF drops by 50% for 2 turns while you are vulnerable.', passive: [], situational: [{ id: 'att-vulnerable', label: 'Detached / Vulnerable (-50% DEF)', passive: [{ stat: 'def', op: 'pct', value: -50 }] }] },

  // ============ SPECIAL ============
  girlyopscurse: { name: "Girlypop's Curse", rarity: 'legendary', desc: "MAG is doubled (x2). Upon receiving this curse, gain 2 random common traits and 1 random rare trait. Those bonus traits each have a 25% chance of being shimmyful. Your character's gender is permanently reversed.", passive: [{ stat: 'mag', op: 'mul', value: 2 }], notes: "On pickup: roll 2 commons + 1 rare, each with 25% shimmy chance. Gender reversal is a permanent RP/flavor mechanic." },

  // ============ COMPLEX TRAITS ============
  gamblersruin:  { name: "Gambler's Ruin", rarity: 'rare', desc: 'Before each action, secretly roll a die. On an even result: +50% ATK and MAG for that action. On an odd result: +50% damage taken for that action.', passive: [], situational: [{ id: 'gr-lucky', label: 'Lucky Roll (even) — +50% ATK & MAG', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }] }, { id: 'gr-unlucky', label: 'Unlucky Roll (odd) — +50% damage taken (−50% DEF)', passive: [{ stat: 'def', op: 'pct', value: -50 }] }] },
  envy:          { name: 'Envy', rarity: 'epic', desc: 'Track the last stat buff any enemy used. You gain an identical bonus until they use a different one.', passive: [], notes: 'Mirrors the last stat buff used by any enemy. The copied bonus exactly matches their buff value and persists until they use a different one. Track manually.' },
  deadmanshand:  { name: "Dead Man's Hand", rarity: 'legendary', desc: 'Start each battle with 5 cards (random stat modifiers, positive and negative). Reveal one per turn in order.', passive: [], notes: 'At battle start, draw 5 cards. Each is a random stat modifier (positive or negative). Reveal one per turn in the order drawn.' },
  symbiote:      { name: 'Symbiote', rarity: 'legendary', desc: 'Bond with one ally at battle start. You both gain +30% HP and share a single HP pool. Any healing or damage either of you takes applies to the shared pool.', passive: [{ stat: 'hp', op: 'pct', value: 30 }], notes: 'Shared HP pool is RP-tracked. Both characters gain +30% HP at battle start.' },
  ouroboros:     { name: 'Ouroboros', rarity: 'epic', desc: 'On death, fully revive at 100% HP. Your ATK and DEF swap values. Your MAG and SPD swap values. This inverted state lasts for the rest of the battle.', passive: [], situational: [{ id: 'ouro-phase', label: 'Ouroboros Phase (revived — ATK/DEF and MAG/SPD swapped)', passive: [] }], notes: 'On death: revive at 100% HP, ATK swaps with DEF, MAG swaps with SPD. Swap is permanent for that battle.' },

  // ============ TBOI-INSPIRED ============
  oddmushroom:   { name: 'Odd Mushroom', rarity: 'common', desc: '+20% ATK but -15% SPD. You hit harder but move slower.', passive: [{ stat: 'atk', op: 'pct', value: 20 }, { stat: 'spd', op: 'pct', value: -15 }] },
  spoonbender:   { name: 'Spoon Bender', rarity: 'common', desc: 'Attacks home toward the enemy. +10% MAG and +15 Dexterity.', passive: [{ stat: 'mag', op: 'pct', value: 10 }, { stat: 'dexterity', op: 'add', value: 15 }] },
  bloodylust:    { name: 'Bloody Lust', rarity: 'rare', desc: 'Each hit you land permanently stacks +5 ATK for the rest of that battle. Resets on a new battle.', passive: [], situational: [{ id: 'bl-5', label: '5 hits landed (+25 ATK)', passive: [{ stat: 'atk', op: 'add', value: 25 }] }, { id: 'bl-10', label: '10 hits landed (+50 ATK)', passive: [{ stat: 'atk', op: 'add', value: 50 }] }, { id: 'bl-20', label: '20 hits landed (+100 ATK)', passive: [{ stat: 'atk', op: 'add', value: 100 }] }] },
  holymantle:    { name: 'Holy Mantle', rarity: 'rare', desc: 'Once per battle, the first hit that would damage you is completely nullified.', passive: [], situational: [{ id: 'hm-active', label: 'Holy Mantle active (shield up)', passive: [] }, { id: 'hm-broken', label: 'Holy Mantle consumed (shield gone)', passive: [] }] },
  whoreofbabylon:{ name: 'Whore of Babylon', rarity: 'epic', desc: 'When below 33% HP: automatically gain +50% ATK, +40% SPD, and -30% DEF. Activates and deactivates based on your HP.', passive: [], situational: [{ id: 'wob-active', label: 'Whore of Babylon active (below 33% HP)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 40 }, { stat: 'def', op: 'pct', value: -30 }] }] },
  missingno:     { name: 'Missing No.', rarity: 'epic', desc: 'At the start of each battle, all your stats are independently randomized between x0.5 and x3 of their base values. Your total power is unpredictable.', passive: [], notes: 'Each main stat (HP, ATK, DEF, MAG, SPD) is independently rolled between 0.5x and 3x base value at battle start. Reroll every battle.' },
  goathead:      { name: 'Goat Head', rarity: 'legendary', desc: 'At battle start: sacrifice 33% of your max HP to access a Devil Deal. Choose one revealed legendary or mythic trait that applies for this fight only.', passive: [], notes: 'Devil Deal: -33% HP to borrow one legendary or mythic trait for that battle. The borrowed trait is lost at battle end.' },
  sacredheart:   { name: 'Sacred Heart', rarity: 'mythic', desc: '+100% ATK and MAG. +50% HP. +35 Heal Power. All your attacks home and pierce through enemies.', passive: [{ stat: 'atk', op: 'pct', value: 100 }, { stat: 'mag', op: 'pct', value: 100 }, { stat: 'hp', op: 'pct', value: 50 }, { stat: 'heal_pow', op: 'add', value: 35 }] },

  // ============ GAMBLING TRAITS ============
  luckypenny:    { name: 'Lucky Penny', rarity: 'common', desc: 'Start each battle with a coin flip. Heads: +15% to all main stats. Tails: -10% to all main stats.', passive: [], situational: [{ id: 'lp-heads', label: 'Heads — +15% all main stats', passive: [{ stat: 'all_main', op: 'pct', value: 15 }] }, { id: 'lp-tails', label: 'Tails — -10% all main stats', passive: [{ stat: 'all_main', op: 'pct', value: -10 }] }], notes: 'Flip a coin at battle start. Toggle the matching button.' },
  bust:          { name: 'Bust', rarity: 'rare', desc: 'Every time you hit, roll a d6. On a 1: your ATK drops to 0 for that turn. On a 6: deal the hit twice.', passive: [], situational: [{ id: 'bust-1', label: 'Rolled a 1 — ATK is 0 this turn', passive: [{ stat: 'atk', op: 'mul', value: 0 }] }], notes: 'Roll d6 on each hit. 1 = ATK zeroed for 1 turn. 6 = hit twice. Toggle when you roll a 1, untoggle next turn.' },
  snakeeyes:     { name: 'Snake Eyes', rarity: 'rare', desc: '+30% ATK. Each attack, roll a d6. Rolling a 1 triggers a fumble: you miss and take 5% max HP damage.', passive: [{ stat: 'atk', op: 'pct', value: 30 }], notes: 'Roll d6 on each attack. 1 = fumble (miss + 5% max HP self-damage). +30% ATK always active.' },
  jackpot:       { name: 'Jackpot', rarity: 'epic', desc: 'On kill: roll 1d3. 1 = +20 ATK permanently. 2 = +20 DEF permanently. 3 = restore 30% HP.', passive: [], situational: [{ id: 'jp-atk1', label: '1x rolled 1 — +20 ATK', passive: [{ stat: 'atk', op: 'add', value: 20 }] }, { id: 'jp-atk2', label: '2x rolled 1 — +40 ATK', passive: [{ stat: 'atk', op: 'add', value: 40 }] }, { id: 'jp-atk3', label: '3x rolled 1 — +60 ATK', passive: [{ stat: 'atk', op: 'add', value: 60 }] }, { id: 'jp-def1', label: '1x rolled 2 — +20 DEF', passive: [{ stat: 'def', op: 'add', value: 20 }] }, { id: 'jp-def2', label: '2x rolled 2 — +40 DEF', passive: [{ stat: 'def', op: 'add', value: 40 }] }, { id: 'jp-def3', label: '3x rolled 2 — +60 DEF', passive: [{ stat: 'def', op: 'add', value: 60 }] }], notes: 'On kill, roll 1d3. Toggle the closest stack count for accumulated ATK/DEF rolls. Roll 3 = 30% HP restore (no button).' },
  devilsbargain: { name: "Devil's Bargain", rarity: 'legendary', desc: 'Triple your ATK and MAG (x3). At the end of each battle, one random stat (not ATK or MAG) is permanently cut by 10%.', passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }], notes: 'After each battle: one of HP/DEF/SPD/etc. is cut by -10% permanently. Track manually.' },
  russianroulette:{ name: 'Russian Roulette', rarity: 'legendary', desc: 'All your main stats are +65%. At the start of each turn, there is a 1-in-6 chance you take 50% of your max HP as true damage.', passive: [{ stat: 'all_main', op: 'pct', value: 65 }], notes: 'Start of each turn: roll d6. On a 1, take 50% max HP as true damage. +65% all main stats is always active.' },

  // ============ STORY / THEMATIC TRAITS ============
  // MYTHIC
  thousanddoors:   { name: 'At Thousand Doors, A Thousand Questions', rarity: 'mythic', desc: 'For every encounter, permanently increase or decrease a random stat by a random multiplier between x0.75 and x1.75. Effects compound and never reset.', passive: [], notes: 'Click ROLL ENCOUNTER after each fight. Results are permanent and compound.' },
  anotherandanother:{ name: 'Another, and another.', rarity: 'mythic', desc: 'Every hit you deal or receive counts as a drink. ATK and MAG are fully randomized (biased toward lower values, max ~1000) each time you hit. DEF and HP are fully randomized each time you get hit. At 15 drinks: -50% SPD, -50% DEX, +100% Crit Chance, +30% Resilience.', passive: [], situational: [{ id: 'aaa-15', label: '15 drinks (max) — -50% SPD, -50% DEX, +100% Crit, +30% Resil', passive: [{ stat: 'spd', op: 'pct', value: -50 }, { stat: 'dexterity', op: 'pct', value: -50 }, { stat: 'crit_rate', op: 'pct', value: 100 }, { stat: 'resilience', op: 'pct', value: 30 }] }], notes: 'Use the REROLL buttons to randomize stats on hit or when hit.' },
  lovesick:        { name: 'LOVESICK', rarity: 'mythic', desc: 'If you have a lover or partner, all healing toward them is multiplied by x50. You can no longer heal anyone else, including yourself.', passive: [], notes: 'x50 healing to designated partner only. Cannot heal self or any other ally.' },
  godslayer:       { name: 'God Slayer', rarity: 'mythic', desc: 'If fighting an enemy stronger than you, copy their 3 highest stats and add those values to your own matching stats for the fight.', passive: [], notes: 'When facing a stronger enemy: manually add their 3 highest stat values to your base stats for that fight.' },
  sentafteryou:    { name: 'If they sent me after you, then you must be forsaken.', rarity: 'mythic', desc: 'In a 1v1, the enemy\'s stats are permanently decreased by 75% for the duration of the fight.', passive: [], situational: [{ id: 'say-1v1', label: '1v1 active (enemy -75% all stats)', passive: [] }], notes: 'RP: in a 1v1, opponent suffers -75% all stats. No self stat impact.' },
  steelwillfix:    { name: 'Steel will fix all your flaws.', rarity: 'mythic', desc: 'Become metallic. x3 DEF, ATK and MAG. You can replace any character\'s current trait with this one. Gain x1.25 all stats per metallic alive. Upon creating 7 metallics, use the EVOLVE button to upgrade to the hexxed form.', passive: [{ stat: 'atk', op: 'mul', value: 3 }, { stat: 'def', op: 'mul', value: 3 }, { stat: 'mag', op: 'mul', value: 3 }], situational: [{ id: 'swf-1m', label: '1 metallic alive (x1.25 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }, { id: 'swf-2m', label: '2 metallics (x1.56 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 56 }] }, { id: 'swf-3m', label: '3 metallics (x1.95 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 95 }] }, { id: 'swf-4m', label: '4 metallics (x2.44 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 144 }] }, { id: 'swf-5m', label: '5 metallics (x3.05 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 205 }] }, { id: 'swf-6m', label: '6 metallics (x3.81 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 281 }] }] },
  replaceallemotions:{ name: 'Replace all your petty emotions.', rarity: 'hexxed', desc: 'Evolved metallic form. x5 DEF, ATK and MAG. Gain the ability to turn anyone metallic. Gain x2 all stats per metallic alive.', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }], situational: [{ id: 'rae-1m', label: '1 metallic alive (x2 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 100 }] }, { id: 'rae-2m', label: '2 metallics (x4 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 300 }] }, { id: 'rae-3m', label: '3 metallics (x8 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 700 }] }, { id: 'rae-4m', label: '4 metallics (x16 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 1500 }] }, { id: 'rae-5m', label: '5 metallics (x32 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 3100 }] }, { id: 'rae-6m', label: '6 metallics (x64 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 6300 }] }, { id: 'rae-7m', label: '7 metallics (x128 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 12700 }] }] },
  letthestage:     { name: 'Let the stage see who\'s greater!', rarity: 'mythic', desc: 'In a 1v1, both you and the enemy\'s stats are multiplied by x5. The winner permanently absorbs the loser\'s stats after the fight.', passive: [], situational: [{ id: 'lts-1v1', label: '1v1 active (x5 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 5 }] }] },
  wontexist:       { name: 'You won\'t exist anymore!', rarity: 'mythic', desc: 'Defeated enemies are permanently erased from existence. You gain dormant erasure powers.', passive: [], notes: 'RP mechanic. Defeated enemies cease to exist. Erasure abilities are DM-determined.' },
  iamgonnawin:     { name: 'I\'m gonna win.', rarity: 'mythic', desc: 'Upon receiving an attack that would knock you out, instead heal to 100% HP and drain all stats from your party members to yourself.', passive: [], notes: 'One-time per fight: survive a lethal hit at 100% HP and absorb all ally stats.' },
  unbroken:        { name: 'Unbroken', rarity: 'mythic', desc: 'You cannot take physical damage. Magical, true, and status damage still apply.', passive: [], notes: 'Physical damage immunity only.' },
  themoss:         { name: 'The Moss', rarity: 'mythic', desc: 'On-hit, apply MOSS to enemies. Affected enemies are slowly consumed, losing -5% HP and -10% DEF per turn. MOSS is only removed by water.', passive: [], notes: 'MOSS: -5% HP and -10% DEF per turn. Removed only by water. Stacks on each hit.' },
  harbingerruin:   { name: 'Harbinger of Ruin', rarity: 'mythic', desc: 'When hit, the attacker permanently loses 5% all non-HP stats. On-hit, apply RUIN: target loses 3% all non-HP stats per turn for 2 rounds (stacks up to 5). Upon defeating an enemy, they permanently lose 5% all stats.', passive: [], notes: 'Hit-reaction: permanent -5% all non-HP stats on attacker. RUIN: 3% per turn for 2 rounds, 5 stacks max.' },
  revived:         { name: 'REVIVED', rarity: 'mythic', desc: 'Once per campaign: upon fully dying, revive at 100% HP and permanently gain x2 all stats. After reviving, gain one random legendary trait.', passive: [], situational: [{ id: 'rev-active', label: 'REVIVED (x2 all stats, permanent)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }], notes: 'One-time per campaign. On death: 100% HP + x2 all stats permanently + random legendary trait.' },

  // DUALITY
  redemptionretribution: { name: 'Redemption / Retribution', rarity: 'duality', desc: 'HEAVENLY (Redemption): for every enemy spared, gain +10% Heal Power and +10% MAG. HELLFORGED (Retribution): for every enemy killed, gain +10% ATK and +10% Crit Damage.', passive: [], heavenly: { name: 'Redemption', desc: 'For every enemy spared, gain +10% Heal Power and +10% MAG.', passive: [] }, hellforged: { name: 'Retribution', desc: 'For every enemy killed, gain +10% ATK and +10% Crit Damage.', passive: [] }, situational: [{ id: 'rdr-spa1', label: 'HEAVENLY: 1 enemy spared (+10% Heal, +10% MAG)', passive: [{ stat: 'heal_pow', op: 'add', value: 10 }, { stat: 'mag', op: 'pct', value: 10 }] }, { id: 'rdr-spa3', label: 'HEAVENLY: 3 enemies spared (+30% Heal, +30% MAG)', passive: [{ stat: 'heal_pow', op: 'add', value: 30 }, { stat: 'mag', op: 'pct', value: 30 }] }, { id: 'rdr-spa5', label: 'HEAVENLY: 5 enemies spared (+50% Heal, +50% MAG)', passive: [{ stat: 'heal_pow', op: 'add', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }] }, { id: 'rdr-spa10', label: 'HEAVENLY: 10 enemies spared (+100% Heal, +100% MAG)', passive: [{ stat: 'heal_pow', op: 'add', value: 100 }, { stat: 'mag', op: 'pct', value: 100 }] }, { id: 'rdr-kll1', label: 'HELLFORGED: 1 enemy killed (+10% ATK, +10% Crit DMG)', passive: [{ stat: 'atk', op: 'pct', value: 10 }, { stat: 'crit_dmg', op: 'pct', value: 10 }] }, { id: 'rdr-kll3', label: 'HELLFORGED: 3 enemies killed (+30% ATK, +30% Crit DMG)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'crit_dmg', op: 'pct', value: 30 }] }, { id: 'rdr-kll5', label: 'HELLFORGED: 5 enemies killed (+50% ATK, +50% Crit DMG)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'crit_dmg', op: 'pct', value: 50 }] }, { id: 'rdr-kll10', label: 'HELLFORGED: 10 enemies killed (+100% ATK, +100% Crit DMG)', passive: [{ stat: 'atk', op: 'pct', value: 100 }, { stat: 'crit_dmg', op: 'pct', value: 100 }] }] },
  warandglory:     { name: 'War and Glory / Bold, Precise', rarity: 'duality', desc: 'HELLFORGED (War and Glory, Reinvention): 1 ATK = 1 True Damage, 1 True Damage = 1 Lifesteal, 1 Lifesteal = 1 Heal Power. HEAVENLY (Bold, Precise, Experimental): 1 DEF = +1 ATK, 2 ATK = +1 Resilience.', passive: [], heavenly: { name: 'Bold, Precise, Experimental', desc: '1 DEF = +1 ATK. 2 ATK = +1 Resilience.', passive: [{ op: 'derived', stat: 'atk', from: 'def', per: 1, perValue: 1 }, { op: 'derived', stat: 'resilience', from: 'atk', per: 2, perValue: 1 }] }, hellforged: { name: 'War and Glory, Reinvention', desc: '1 ATK = 1 True Damage. 1 True Damage = 1 Lifesteal. 1 Lifesteal = 1 Heal Power.', passive: [{ op: 'derived', stat: 'true_dmg', from: 'atk', per: 1, perValue: 1 }, { op: 'derived', stat: 'lifesteal', from: 'true_dmg', per: 1, perValue: 1 }, { op: 'derived', stat: 'heal_pow', from: 'lifesteal', per: 1, perValue: 1 }] }, situational: [] },

  // LEGENDARY
  emotionless:     { name: 'Emotionless', rarity: 'legendary', desc: 'Your character loses the capability of having emotions, but all substats are doubled (x2).', passive: [{ stat: 'heal_pow', op: 'pct', value: 100 }, { stat: 'crit_rate', op: 'pct', value: 100 }, { stat: 'crit_dmg', op: 'pct', value: 100 }, { stat: 'status_res', op: 'pct', value: 100 }, { stat: 'dexterity', op: 'pct', value: 100 }, { stat: 'resilience', op: 'pct', value: 100 }, { stat: 'true_dmg', op: 'pct', value: 100 }, { stat: 'lifesteal', op: 'pct', value: 100 }, { stat: 'cooldown_red', op: 'pct', value: 100 }] },
  reinforcecrew:   { name: 'What better time to reinforce our crew?', rarity: 'legendary', desc: 'When any ally drops to 50% HP, everyone in the party gains +50% DEF and an extra turn for one round.', passive: [], situational: [{ id: 'rc-trigger', label: 'Ally at 50% HP triggered (+50% DEF, extra turn)', passive: [{ stat: 'def', op: 'pct', value: 50 }] }], notes: 'Toggle when triggered. Untoggle after the round ends.' },
  goodluckboys:    { name: 'Good luck out there, boys', rarity: 'legendary', desc: 'When you drop below 50% HP, leave the fight. In return, the rest of your party has their turn count doubled for the remainder of the battle.', passive: [], notes: 'RP: below 50% HP, exit combat. Party receives doubled turns.' },
  holywar:         { name: 'Holy War', rarity: 'legendary', desc: 'Triple your party\'s turn count when fighting a spirit. Double them when fighting someone significantly stronger than you.', passive: [], situational: [{ id: 'hw-spirit', label: 'Fighting a spirit (party x3 turns)', passive: [] }, { id: 'hw-stronger', label: 'Fighting someone way stronger (party x2 turns)', passive: [] }], notes: 'RP: multiplied party turns. No self stat impact.' },
  wegotthenumbers: { name: 'We got the numbers!', rarity: 'legendary', desc: 'If your party outnumbers the enemies, all your substats are tripled. If outnumbered, all substats drop by 50%.', passive: [], situational: [{ id: 'wgn-more', label: 'Outnumbering enemies (substats x3)', passive: [{ stat: 'heal_pow', op: 'pct', value: 200 }, { stat: 'crit_rate', op: 'pct', value: 200 }, { stat: 'crit_dmg', op: 'pct', value: 200 }, { stat: 'status_res', op: 'pct', value: 200 }, { stat: 'dexterity', op: 'pct', value: 200 }, { stat: 'resilience', op: 'pct', value: 200 }, { stat: 'true_dmg', op: 'pct', value: 200 }, { stat: 'lifesteal', op: 'pct', value: 200 }, { stat: 'cooldown_red', op: 'pct', value: 200 }] }, { id: 'wgn-less', label: 'Outnumbered by enemies (substats -50%)', passive: [{ stat: 'heal_pow', op: 'pct', value: -50 }, { stat: 'crit_rate', op: 'pct', value: -50 }, { stat: 'crit_dmg', op: 'pct', value: -50 }, { stat: 'status_res', op: 'pct', value: -50 }, { stat: 'dexterity', op: 'pct', value: -50 }, { stat: 'resilience', op: 'pct', value: -50 }, { stat: 'true_dmg', op: 'pct', value: -50 }, { stat: 'lifesteal', op: 'pct', value: -50 }, { stat: 'cooldown_red', op: 'pct', value: -50 }] }] },
  hailname:        { name: 'Hail [NAME]', rarity: 'legendary', desc: 'Every time you defeat an enemy, you can recruit them by brainwashing them. Recruited characters fight for you but are permanently gone if defeated. [NAME] is replaced by your character\'s name.', passive: [], notes: 'RP mechanic. Recruited enemies fight for you. Lost forever on defeat.' },
  onlyatraitor:    { name: 'Only a Traitor could consider making Peace', rarity: 'legendary', desc: 'You can no longer spare anyone. You may only kill. Upon receiving this trait, immediately roll 2 random extra legendary traits.', passive: [], notes: 'On pickup: auto-grants 2 random legendary traits. No sparing allowed (RP restriction).' },
  partypooper:     { name: 'Party Pooper', rarity: 'legendary', desc: 'On-hit, apply FRACTURED to enemies. FRACTURED nullifies all healing and does not expire until battle ends. Gain +10% Lifesteal and +10% Crit Chance per Fractured enemy on the field.', passive: [], situational: [{ id: 'pp-1', label: '1 Fractured enemy (+10% Lifesteal, +10% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 10 }, { stat: 'crit_rate', op: 'add', value: 10 }] }, { id: 'pp-2', label: '2 Fractured enemies (+20% Lifesteal, +20% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 20 }, { stat: 'crit_rate', op: 'add', value: 20 }] }, { id: 'pp-3', label: '3 Fractured enemies (+30% Lifesteal, +30% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 30 }, { stat: 'crit_rate', op: 'add', value: 30 }] }, { id: 'pp-4', label: '4+ Fractured enemies (+40% Lifesteal, +40% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 40 }, { stat: 'crit_rate', op: 'add', value: 40 }] }] },
  turningpoint:    { name: 'Turning Point', rarity: 'legendary', desc: 'When dropping below 40% HP, gain x10 SPD and x10 DEX. This decreases by 20% each round (minimum x0.25). Gain an extra turn while the multiplier is above x4.', passive: [], situational: [{ id: 'tp-t1', label: 'Turn 1: x10 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 10 }, { stat: 'dexterity', op: 'mul', value: 10 }] }, { id: 'tp-t2', label: 'Turn 2: x8 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 8 }, { stat: 'dexterity', op: 'mul', value: 8 }] }, { id: 'tp-t3', label: 'Turn 3: x6.4 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 6.4 }, { stat: 'dexterity', op: 'mul', value: 6.4 }] }, { id: 'tp-t4', label: 'Turn 4: x5.1 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 5.1 }, { stat: 'dexterity', op: 'mul', value: 5.1 }] }, { id: 'tp-t5', label: 'Turn 5: x4.1 SPD and DEX', passive: [{ stat: 'spd', op: 'mul', value: 4.1 }, { stat: 'dexterity', op: 'mul', value: 4.1 }] }, { id: 'tp-fade', label: 'Faded (x0.25 SPD and DEX floor)', passive: [{ stat: 'spd', op: 'mul', value: 0.25 }, { stat: 'dexterity', op: 'mul', value: 0.25 }] }] },
  keepup:          { name: 'KEEP UP', rarity: 'legendary', desc: 'Start with x2 SPD and x2 DEX. Every turn your SPD and DEX increase by x1.5. Enemies\' SPD and DEX increase by x1.4 (your party is unaffected). +1 ATK per 20 SPD, +1 MAG per 5 DEX.', passive: [{ op: 'derived', stat: 'atk', from: 'spd', per: 20, perValue: 1 }, { op: 'derived', stat: 'mag', from: 'dexterity', per: 5, perValue: 1 }], situational: [{ id: 'ku-t1', label: 'Turn 1 (x2 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 2 }, { stat: 'dexterity', op: 'mul', value: 2 }] }, { id: 'ku-t2', label: 'Turn 2 (x3 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 3 }, { stat: 'dexterity', op: 'mul', value: 3 }] }, { id: 'ku-t3', label: 'Turn 3 (x4.5 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 4.5 }, { stat: 'dexterity', op: 'mul', value: 4.5 }] }, { id: 'ku-t4', label: 'Turn 4 (x6.75 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 6.75 }, { stat: 'dexterity', op: 'mul', value: 6.75 }] }, { id: 'ku-t5', label: 'Turn 5 (x10 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 10 }, { stat: 'dexterity', op: 'mul', value: 10 }] }, { id: 'ku-t6', label: 'Turn 6 (x15 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 15 }, { stat: 'dexterity', op: 'mul', value: 15 }] }], notes: 'Toggle exactly one turn button at a time. ATK and MAG bonuses from SPD/DEX are derived automatically.' },
  wartrivial:      { name: 'War, What a Trivial thing.', rarity: 'legendary', desc: 'Permanently gain +10 to all stats for every fight you leave early.', passive: [], situational: [{ id: 'wt-1', label: '1 fight left early (+10 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 10 }] }, { id: 'wt-3', label: '3 fights left (+30 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 30 }] }, { id: 'wt-5', label: '5 fights left (+50 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 50 }] }, { id: 'wt-10', label: '10 fights left (+100 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 100 }] }, { id: 'wt-20', label: '20 fights left (+200 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 200 }] }] },
  perfectsoul:     { name: 'I want a perfect soul.', rarity: 'legendary', desc: 'Absorb enemies\' souls if they are below 20% HP, gaining a portion of their stats. Each soul absorbed reduces your sanity.', passive: [], notes: 'Select a character and click ABSORB SOUL to permanently gain 40-80% of their stats.' },
  lotuswaters:     { name: 'Lotus Waters', rarity: 'legendary', desc: 'Your water abilities turn pink, or you gain water manipulation. Your water heals enemies for +5% HP per turn and damages them for -5% HP per turn while in it. Once per battle: flood the arena for 2 rounds.', passive: [], notes: 'No shimmyful. Has a Hexxed variant: Lavender Waters.' },
  lavenderwaters:  { name: 'Lavender Waters', rarity: 'hexxed', desc: 'Your water abilities turn lavender, or you gain water manipulation. Your water heals enemies for +15% HP per turn and damages them for -15% HP per turn while in it. Once per battle: flood the arena for 3 rounds.', passive: [], notes: 'Hexxed version of Lotus Waters. No shimmyful.' },
  reekofdisease:   { name: 'You reek of disease.', rarity: 'legendary', desc: 'If an enemy is below 40% HP, immediately apply 5 stacks of POISON on them, dealing -20% HP per turn until they are defeated.', passive: [], notes: 'Auto-apply 5 poison stacks to enemies below 40% HP. -20% HP per turn total.' },
  megalostrikeback:{ name: 'Megalo Strike Back', rarity: 'legendary', desc: 'If fighting the same enemy for the second time, gain +200% Crit Chance and +200% Crit Damage. Defeating that enemy permanently adds these bonuses to your stats.', passive: [], situational: [{ id: 'msb-2nd', label: 'Second fight vs this enemy (+200% Crit, +200% Crit DMG)', passive: [{ stat: 'crit_rate', op: 'pct', value: 200 }, { stat: 'crit_dmg', op: 'pct', value: 200 }] }, { id: 'msb-perm', label: 'Enemy defeated (permanent +200% Crit, +200% Crit DMG)', passive: [{ stat: 'crit_rate', op: 'pct', value: 200 }, { stat: 'crit_dmg', op: 'pct', value: 200 }] }] },
  engarde:         { name: 'En garde!', rarity: 'legendary', desc: 'Pick one enemy and force them into a separate 1v1 arena. Neither can interact with other units. The arena lasts 3 rounds or until one is knocked out. The winner gains x1.5 ATK and SPD for the rest of the fight.', passive: [], situational: [{ id: 'eg-arena', label: 'In the arena (1v1 active)', passive: [] }, { id: 'eg-win', label: 'Won the arena (x1.5 ATK and SPD)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 50 }] }] },
  killingspree:    { name: 'Killing Spree', rarity: 'legendary', desc: 'For every enemy killed this fight, permanently gain +5% SPD and +5% ATK. Losing a fight resets all stacks.', passive: [], situational: [{ id: 'ks-1', label: '1 kill (+5% SPD, +5% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 5 }, { stat: 'atk', op: 'pct', value: 5 }] }, { id: 'ks-3', label: '3 kills (+15% SPD, +15% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 15 }, { stat: 'atk', op: 'pct', value: 15 }] }, { id: 'ks-5', label: '5 kills (+25% SPD, +25% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 25 }, { stat: 'atk', op: 'pct', value: 25 }] }, { id: 'ks-10', label: '10 kills (+50% SPD, +50% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 50 }, { stat: 'atk', op: 'pct', value: 50 }] }, { id: 'ks-20', label: '20 kills (+100% SPD, +100% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 100 }, { stat: 'atk', op: 'pct', value: 100 }] }] },
  armyofshurima:   { name: 'The army of Shurima never dies', rarity: 'legendary', desc: 'At the start of every fight, summon 3 sand soldiers with 70 HP, 50 ATK, 10 DEF, 30 SPD and 30 MAG each.', passive: [], notes: 'Summons 3 sand soldiers at battle start. They fight alongside and can be targeted.' },
  ialwayscomeback: { name: 'I always come back', rarity: 'legendary', desc: 'Every time you are defeated, permanently gain +25% to all base stats. The battle immediately after being defeated, all attacks deal 100% True Damage.', passive: [], situational: [{ id: 'iac-true', label: 'Battle after defeat (100% True Damage)', passive: [{ stat: 'true_dmg', op: 'add', value: 100 }] }, { id: 'iac-1', label: '1 defeat (+25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }, { id: 'iac-2', label: '2 defeats (+50% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }, { id: 'iac-3', label: '3 defeats (+75% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 75 }] }, { id: 'iac-5', label: '5 defeats (+125% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 125 }] }] },
  thefinalact:     { name: 'The final act', rarity: 'legendary', desc: 'If anyone drops below 5% HP, everyone is healed, all DEF drops to 0, and your ATK and MAG increase by x1.35 per unit currently in the battle.', passive: [], situational: [{ id: 'tfa-2u', label: 'Triggered, 2 units in battle (x1.82 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 1.82 }, { stat: 'mag', op: 'mul', value: 1.82 }] }, { id: 'tfa-4u', label: 'Triggered, 4 units in battle (x3.32 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 3.32 }, { stat: 'mag', op: 'mul', value: 3.32 }] }, { id: 'tfa-6u', label: 'Triggered, 6 units in battle (x6.05 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 6.05 }, { stat: 'mag', op: 'mul', value: 6.05 }] }, { id: 'tfa-8u', label: 'Triggered, 8 units in battle (x11 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 11 }, { stat: 'mag', op: 'mul', value: 11 }] }] },
  truehero:        { name: 'True Hero', rarity: 'legendary', desc: 'The more kills the enemy has, the higher your stats. Gain x1.05 to all main stats for every kill the target has to their name.', passive: [], situational: [{ id: 'th-5k', label: 'Enemy has 5 kills (x1.28 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 28 }] }, { id: 'th-10k', label: 'Enemy has 10 kills (x1.63 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 63 }] }, { id: 'th-20k', label: 'Enemy has 20 kills (x2.65 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 165 }] }, { id: 'th-50k', label: 'Enemy has 50 kills (x11.5 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 1050 }] }] },
  breakunbreakable:{ name: 'Break the Unbreakable', rarity: 'legendary', desc: 'Ignore all enemy DEF. Deal additional damage proportional to how much DEF the enemy has. The more armored they are, the harder you hit.', passive: [], notes: 'Enemy DEF completely ignored. Bonus damage = enemy DEF value (RP-adjudicated by DM).' },
  itwasutile:      { name: 'It was Futile', rarity: 'legendary', desc: 'If hit by an enemy whose ATK is lower than yours, you take zero damage. The attack simply does not land.', passive: [], notes: 'Immune to attacks from enemies with lower ATK. RP-adjudicated.' },
  absoluteterritory:{ name: 'Absolute Territory', rarity: 'legendary', desc: 'You are forced to wear thigh highs and a miniskirt. In exchange: x3.5 ATK, x3.5 DEF, x3.5 MAG and x3.5 Crit Chance.', passive: [{ stat: 'atk', op: 'mul', value: 3.5 }, { stat: 'def', op: 'mul', value: 3.5 }, { stat: 'mag', op: 'mul', value: 3.5 }, { stat: 'crit_rate', op: 'pct', value: 250 }] },
  ifeelmonster:    { name: 'I feel like a Monster', rarity: 'legendary', desc: 'You can harm allies. For every ally you attack, gain +50% ATK and +50% MAG. Stacks per ally attacked.', passive: [], situational: [{ id: 'ifm-1a', label: '1 ally attacked (+50% ATK, +50% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }] }, { id: 'ifm-2a', label: '2 allies attacked (+100% ATK, +100% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 100 }, { stat: 'mag', op: 'pct', value: 100 }] }, { id: 'ifm-3a', label: '3 allies attacked (+150% ATK, +150% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'mag', op: 'pct', value: 150 }] }, { id: 'ifm-4a', label: '4+ allies attacked (+200% ATK, +200% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 200 }, { stat: 'mag', op: 'pct', value: 200 }] }] },
  nothereyou:      { name: 'I\'m not here for you', rarity: 'legendary', desc: 'Choose one ally. You can only heal them and yourself. Every time you heal that ally, gain +50% to all non-HP stats for 1 round.', passive: [], situational: [{ id: 'nhy-heal', label: 'Just healed chosen ally (+50% ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'def', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 50 }] }] },
  woetothee:       { name: 'Woe to Thee', rarity: 'legendary', desc: 'Every 2 ATK converts to 1% True Damage, capped at 90%. Upon receiving this trait, immediately roll one random shimmyful legendary trait on top of it.', passive: [{ op: 'derived', stat: 'true_dmg', from: 'atk', per: 2, perValue: 1, cap: 90 }], notes: 'On pickup: auto-grants 1 random shimmyful legendary. True Damage scales with ATK automatically.' },
  paralyzer:       { name: 'Paralyzer', rarity: 'legendary', desc: 'On-hit, apply PARALYZED to enemies. Paralyzed enemies skip a turn and lose all SPD and DEX. Gain +5% DEF per Paralyzed enemy on the field.', passive: [], situational: [{ id: 'par-1', label: '1 Paralyzed enemy (+5% DEF)', passive: [{ stat: 'def', op: 'pct', value: 5 }] }, { id: 'par-2', label: '2 Paralyzed enemies (+10% DEF)', passive: [{ stat: 'def', op: 'pct', value: 10 }] }, { id: 'par-3', label: '3 Paralyzed enemies (+15% DEF)', passive: [{ stat: 'def', op: 'pct', value: 15 }] }, { id: 'par-4', label: '4+ Paralyzed enemies (+20% DEF)', passive: [{ stat: 'def', op: 'pct', value: 20 }] }] },
  stillstanding:   { name: 'Still Standing', rarity: 'legendary', desc: 'Upon reaching 25% HP, immediately heal back to 50% HP and gain FOCUS for 3 turns. FOCUS: attacks cannot miss and dodge chance is increased. Kills extend FOCUS with extra turns.', passive: [], situational: [{ id: 'ss-focus', label: 'FOCUS active (no misses, bonus dodge, 3 turns)', passive: [] }, { id: 'ss-kill', label: 'Kill extended FOCUS (extra turn granted)', passive: [] }], notes: 'At 25% HP: auto-heal to 50% + FOCUS. Kills while in FOCUS grant extra turns.' },
  willsurvive:     { name: 'I will Survive!', rarity: 'legendary', desc: 'If your life is threatened, you instinctively teleport far away. You can still be knocked out.', passive: [], notes: 'RP: on life-threatening situations, teleport away. Does not prevent knockouts entirely.' },
  banquet:         { name: 'Banquet', rarity: 'legendary', desc: 'Various foods appear on the battlefield, invisible to enemies. You and your allies heal 10% HP per food eaten without wasting a turn, but lose -25% SPD for that turn.', passive: [], situational: [{ id: 'ban-eating', label: 'Eating food this turn (-25% SPD)', passive: [{ stat: 'spd', op: 'pct', value: -25 }] }] },
  raciallymotivated:{ name: 'Racially Motivated', rarity: 'legendary', desc: 'Deal x2 damage to enemies of a different species. Deal x0.5 damage to enemies of the same species.', passive: [], situational: [{ id: 'rm-diff', label: 'Targeting different species (x2 damage)', passive: [{ stat: 'atk', op: 'mul', value: 2 }, { stat: 'mag', op: 'mul', value: 2 }] }, { id: 'rm-same', label: 'Targeting same species (x0.5 damage)', passive: [{ stat: 'atk', op: 'mul', value: 0.5 }, { stat: 'mag', op: 'mul', value: 0.5 }] }] },
  jolly:           { name: 'Jolly', rarity: 'legendary', desc: 'During Christmas, get x5 all stats.', passive: [], situational: [{ id: 'jolly-xmas', label: 'It\'s Christmas (x5 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 5 }] }] },
  spooky:          { name: 'Spooky', rarity: 'legendary', desc: 'During Halloween, get x5 all stats.', passive: [], situational: [{ id: 'spooky-hw', label: 'It\'s Halloween (x5 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 5 }] }] },
  anarchy:         { name: 'Anarchy', rarity: 'legendary', desc: 'All enemies can hit each other and all allies can hit each other. Hitting a teammate grants them +5% all stats; same with enemies. You accumulate everyone\'s anarchy bonuses.', passive: [], notes: 'RP: friendly fire enabled. Each friendly-fire hit grants target +5% stats. You gain all such accumulated bonuses.' },
  yourearly:       { name: 'You\'re early', rarity: 'legendary', desc: 'Apply BLEEDING, POISON and BURNING to the first enemy who attacks in the battle, lasting 2 rounds.', passive: [], notes: 'Reactive trigger on the first enemy attack of the battle. All three status effects for 2 rounds.' },
  // HEXXED
  killthesun:      { name: 'Kill The Sun', rarity: 'hexxed', desc: 'Deal x50 damage to Spirits.', passive: [], situational: [{ id: 'kts-spirit', label: 'Fighting a Spirit (x50 ATK and MAG)', passive: [{ stat: 'atk', op: 'mul', value: 50 }, { stat: 'mag', op: 'mul', value: 50 }] }] },
  shimmyfuloverlord:{ name: 'SHIMMYFUL OVERLORD', rarity: 'hexxed', desc: 'Upon dropping below 60% HP, push all enemies back and transform into a semi-cosmic being. All attacks become shimmies and apply SHIMMYFIED stacks. SHIMMYFIED: target glows and has 30% DEF pierce per stack. Gain x15 MAG in shimmyful state.', passive: [], situational: [{ id: 'sfo-active', label: 'SHIMMYFUL OVERLORD active (below 60% HP)', passive: [{ stat: 'mag', op: 'mul', value: 15 }] }] },
  // EPIC
  ascendedtogether:{ name: 'Ascended Together.', rarity: 'epic', desc: 'If an ally transforms or ascends, you automatically transform into a similar version of their form.', passive: [], notes: 'RP: mirrors ally transformation. Form is DM-determined based on the ally\'s ascension.' },
  overlooked:      { name: 'Overlooked', rarity: 'epic', desc: 'If your stats are lower than every other unit in the fight, gain x10 Crit Chance and x10 Crit Damage.', passive: [], situational: [{ id: 'ovk-active', label: 'Overlooked active (lowest stats in fight)', passive: [{ stat: 'crit_rate', op: 'pct', value: 900 }, { stat: 'crit_dmg', op: 'pct', value: 900 }] }] },
  soreloser:       { name: 'Sore Loser', rarity: 'epic', desc: 'Upon being defeated, the enemy who dealt the killing blow permanently loses 25% of their highest stat.', passive: [], notes: 'On-defeat trigger: attacker loses 25% of their highest stat permanently.' },
  toottoo:         { name: 'Too Too', rarity: 'epic', desc: 'You are equipped with a tutu. Gain +50% SPD every time you are hit (stacking). 1 SPD = +1 ATK.', passive: [{ op: 'derived', stat: 'atk', from: 'spd', per: 1, perValue: 1 }], situational: [{ id: 'tt-1', label: '1 hit taken (+50% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 50 }] }, { id: 'tt-2', label: '2 hits taken (+100% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 100 }] }, { id: 'tt-4', label: '4 hits taken (+200% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 200 }] }, { id: 'tt-6', label: '6 hits taken (+300% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 300 }] }, { id: 'tt-10', label: '10 hits taken (+500% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 500 }] }], notes: 'SPD stacks on each hit. ATK bonus from SPD is derived automatically.' },
  tillicollapse:   { name: 'Till i Collapse', rarity: 'epic', desc: 'Push the knockout threshold, effectively gaining +50% HP. Your stats are x1.45 at full health, scaling down to x0.8 near the threshold.', passive: [{ stat: 'hp', op: 'pct', value: 50 }], situational: [{ id: 'tic-full', label: 'Full HP (x1.45 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 45 }] }, { id: 'tic-75', label: 'Below 75% HP (x1.3 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 30 }] }, { id: 'tic-50', label: 'Below 50% HP (x1.1 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 10 }] }, { id: 'tic-25', label: 'Below 25% HP (x0.9 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -10 }] }, { id: 'tic-low', label: 'Near knockout (x0.8 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -20 }] }] },
};

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
const RARITY_WEIGHTS = { common: 60, rare: 30, epic: 18.4, legendary: 1.5, mythic: 0.1, hexxed: 0.02, duality: 0.01, determined: 0.005 };
const PITY_WEIGHTS = { common: 0, rare: 0, epic: 0, legendary: 68.9, mythic: 25, hexxed: 1, duality: 5, determined: 0.1 };

// ============================================================
// SHIMMYFUL — 0.1% upgrade for common traits
// ============================================================
const SHIMMYFUL_TRAITS = {
  favored: { name: 'SHIMMYFUL Favored', desc: '+50% Crit Chance.', passive: [{ stat: 'crit_rate', op: 'add', value: 50 }] },
  spicy: { name: 'SHIMMYFUL Spicy', desc: '+40% Resilience.', passive: [{ stat: 'resilience', op: 'add', value: 40 }] },
  sonic: { name: 'SHIMMYFUL Sonic', desc: '+40% SPD, +40% Dexterity.', passive: [{ stat: 'spd', op: 'pct', value: 40 }, { stat: 'dexterity', op: 'add', value: 40 }] },
  flaming: { name: 'SHIMMYFUL Flaming', desc: '100% chance to BURN on hit. BURN deals triple damage.', passive: [] },
  enchanted: { name: 'SHIMMYFUL Enchanted', desc: '+40% MAG, +40% Heal Power.', passive: [{ stat: 'mag', op: 'pct', value: 40 }, { stat: 'heal_pow', op: 'add', value: 40 }] },
  steadfast: { name: 'SHIMMYFUL Steadfast', desc: '+40% True Damage. Pierces all resistances.', passive: [{ stat: 'true_dmg', op: 'add', value: 40 }] },
  bombastic: { name: 'SHIMMYFUL Bombastic', desc: 'Explosions are x10 bigger and chain to nearby targets.', passive: [] },
  counterfeit: { name: 'SHIMMYFUL Counterfeit', desc: 'Shops are 60% cheaper.', passive: [] },
  sticky: { name: 'SHIMMYFUL Sticky', desc: "everything you touch is yours :)", passive: [] },
  tough: { name: 'SHIMMYFUL Tough', desc: '+50% DEF.', passive: [{ stat: 'def', op: 'pct', value: 50 }] },
  hearty: { name: 'SHIMMYFUL Hearty', desc: '+65% HP.', passive: [{ stat: 'hp', op: 'pct', value: 65 }] },
  keen: { name: 'SHIMMYFUL Keen', desc: '+45% ATK, +35% Crit Chance.', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'crit_rate', op: 'add', value: 35 }] },
  scholarly: { name: 'SHIMMYFUL Scholarly', desc: '+45% MAG, +50% Cooldown Reduction.', passive: [{ stat: 'mag', op: 'pct', value: 45 }, { stat: 'cooldown_red', op: 'add', value: 50 }] },
  lightfooted: { name: 'SHIMMYFUL Light-Footed', desc: '+75% SPD.', passive: [{ stat: 'spd', op: 'pct', value: 75 }] },
  regenerative: { name: 'SHIMMYFUL Regenerative', desc: '+65% Heal Power, +40% HP.', passive: [{ stat: 'heal_pow', op: 'add', value: 65 }, { stat: 'hp', op: 'pct', value: 40 }] },
  reckless: { name: 'SHIMMYFUL Reckless', desc: '+75% ATK. DEF penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 75 }] },
  ironclad: { name: 'SHIMMYFUL Ironclad', desc: '+65% DEF. SPD penalty removed.', passive: [{ stat: 'def', op: 'pct', value: 65 }] },
  precise: { name: 'SHIMMYFUL Precise', desc: '+55% Crit Chance, +55% Crit Damage. No penalties.', passive: [{ stat: 'crit_rate', op: 'add', value: 55 }, { stat: 'crit_dmg', op: 'add', value: 55 }] },
  glassjaw: { name: 'SHIMMYFUL Glass Jaw', desc: '+75% ATK. Resilience penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 75 }] },
  shocking: { name: 'SHIMMYFUL Shocking', desc: 'Every hit Shocks AND Stuns. Effects last longer.', passive: [] },
  wellfed: { name: 'SHIMMYFUL Well-Fed', desc: '+45% HP, +40% Lifesteal.', passive: [{ stat: 'hp', op: 'pct', value: 45 }, { stat: 'lifesteal', op: 'add', value: 40 }] },
  caffeinated: { name: 'SHIMMYFUL Caffeinated', desc: '+60% SPD, +60% Cooldown Reduction.', passive: [{ stat: 'spd', op: 'pct', value: 60 }, { stat: 'cooldown_red', op: 'add', value: 60 }] },
  stubborn: { name: 'SHIMMYFUL Stubborn', desc: 'Fully immune to ALL crowd control. No exceptions.', passive: [] },
  nightowl: { name: 'SHIMMYFUL Night Owl', desc: '+55% ATK, +55% SPD in the dark or at night.', passive: [], situational: [{ id: 'nightowl-dark', label: 'It is dark / nighttime', passive: [{ stat: 'atk', op: 'pct', value: 55 }, { stat: 'spd', op: 'pct', value: 55 }] }] },
  headstrong: { name: 'SHIMMYFUL Headstrong', desc: '+80% Status Resistance. Immune to 1 status effect per battle.', passive: [{ stat: 'status_res', op: 'add', value: 80 }] },
  resolute: { name: 'SHIMMYFUL Resolute', desc: '+45% Resilience. At ≤30% HP: +65% ATK AND immune to death once.', passive: [{ stat: 'resilience', op: 'add', value: 45 }], situational: [{ id: 'res-low', label: 'Currently at ≤30% HP', passive: [{ stat: 'atk', op: 'pct', value: 65 }] }] },
  grounded: { name: 'SHIMMYFUL Grounded', desc: '+55% DEF. Immune to knockback AND all crowd control.', passive: [{ stat: 'def', op: 'pct', value: 55 }] },
  // LoL-inspired commons
  killingedge: { name: 'SHIMMYFUL Killing Edge', desc: '+18% bonus damage to enemies below 40% HP. Below 20% HP: +35%.', passive: [], situational: [{ id: 'ke-s-40', label: 'Target below 40% HP (+18% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 18 }] }, { id: 'ke-s-20', label: 'Target below 20% HP (+35% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 35 }] }] },
  ironskin: { name: 'SHIMMYFUL Iron Skin', desc: '+18 DEF. Reduce all physical damage taken by 15.', passive: [{ stat: 'def', op: 'add', value: 18 }] },
  carnivore: { name: 'SHIMMYFUL Carnivore', desc: 'Restore 20 HP and 5% max HP on every kill.', passive: [], notes: 'Flat + percent HP restore on each kill.' },
  happyhour: { name: 'SHIMMYFUL Happy Hour', desc: '+18% Heal Power. Using a skill restores 8% of max HP.', passive: [{ stat: 'heal_pow', op: 'add', value: 18 }] },
  energized: { name: 'SHIMMYFUL Energized', desc: 'Every 5th attack deals +80% ATK damage.', passive: [], notes: 'Attack counter passive. Every 5th hit is empowered (+80% ATK).' },
  manasurge: { name: 'SHIMMYFUL Mana Surge', desc: 'Every 3rd attack restores a burst of energy AND grants +15% CDR for 1 turn.', passive: [{ stat: 'cooldown_red', op: 'add', value: 8 }], notes: 'Energy restore + CDR burst every 3rd attack.' },
  armorshred: { name: 'SHIMMYFUL Armor Shred', desc: 'Attacks reduce target DEF by 6% for 2 turns. Stacks up to 5x (max -30% DEF).', passive: [], notes: 'DEF debuff on target. Stacks up to 5x for 2 turns each.' },
  gatheringspeed: { name: 'SHIMMYFUL Gathering Speed', desc: 'Each attack adds +4 SPD per stack (max 8 stacks). Stacks decay when not attacking.', passive: [{ stat: 'spd', op: 'add', value: 20 }], notes: 'SPD shown as average stack value.' },
  poisontrail: { name: 'SHIMMYFUL Poison Trail', desc: 'Toxic trail deals 10 damage per turn and slows enemies 20% SPD for 2 turns.', passive: [], notes: 'Environmental hazard + slow. Higher damage tick.' },
  toughitout: { name: 'SHIMMYFUL Tough It Out', desc: 'After taking 2 hits, generate a shield equal to 15% max HP.', passive: [], notes: 'Shield triggered every 2 incoming hits.' },
  boneplating: { name: 'SHIMMYFUL Bone Plating', desc: 'The first 5 hits received each combat deal 12 less damage.', passive: [], notes: 'Damage reduction extended to first 5 hits per combat.' },
  quickdraw: { name: 'SHIMMYFUL Quick Draw', desc: 'Gain +25% ATK and +15% SPD after skipping an action.', passive: [], situational: [{ id: 'qd-s', label: 'After skipping an action', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 15 }] }] },
  battlescar: { name: 'SHIMMYFUL Battle Scar', desc: 'Gain +2 DEF permanently each time you are hit (max +20 per combat).', passive: [{ stat: 'def', op: 'add', value: 10 }], notes: 'DEF shown as average stack value (10).' },
  nimble: { name: 'SHIMMYFUL Nimble', desc: 'Take 8 less damage from all basic attacks. Also gain +20% Dexterity.', passive: [{ stat: 'def', op: 'add', value: 8 }, { stat: 'dexterity', op: 'add', value: 20 }] },
  arcaneedge: { name: 'SHIMMYFUL Arcane Edge', desc: 'After every skill use, the next attack deals bonus magic damage equal to 30% of MAG.', passive: [{ stat: 'mag', op: 'pct', value: 20 }], notes: 'Bonus magic hit after every skill use.' },
  triumph: { name: 'SHIMMYFUL Triumph', desc: 'On kill, restore 20% of missing HP and gain +10 ATK for 1 turn.', passive: [], situational: [{ id: 'tri-s', label: 'Post-kill turn (+10 ATK)', passive: [{ stat: 'atk', op: 'add', value: 10 }] }] },
  perseverance:  { name: 'SHIMMYFUL Perseverance', desc: '+20% Heal Power. Rapid HP regen begins after only 1 turn out of combat.', passive: [{ stat: 'heal_pow', op: 'add', value: 20 }] },
  oddmushroom:   { name: 'SHIMMYFUL Odd Mushroom', desc: '+35% ATK but only -8% SPD. The upside is bigger; the downside is much smaller.', passive: [{ stat: 'atk', op: 'pct', value: 35 }, { stat: 'spd', op: 'pct', value: -8 }] },
  spoonbender:   { name: 'SHIMMYFUL Spoon Bender', desc: 'Attacks home toward the enemy. +20% MAG and +25 Dexterity.', passive: [{ stat: 'mag', op: 'pct', value: 20 }, { stat: 'dexterity', op: 'add', value: 25 }] },
  luckypenny:    { name: 'SHIMMYFUL Lucky Penny', desc: 'Start each battle with a coin flip. Heads: +25% to all main stats. Tails: only -5% to all main stats.', passive: [], situational: [{ id: 'lp-s-heads', label: 'Heads — +25% all main stats', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }, { id: 'lp-s-tails', label: 'Tails — -5% all main stats', passive: [{ stat: 'all_main', op: 'pct', value: -5 }] }], notes: 'Flip a coin at battle start. Toggle the matching button.' },
};

// ============================================================
// SHIMMYFUL MYTHICS — 1% chance per mythic roll
// Orange ring matching mythic flame color. ✦ star, orange glow.
// Excludes 7 mythics that already have hexxed variants:
// adaptation, bloodlust, glasscannon, magical, nesting, vengeance, raidboss
const SHIMMYFUL_MYTHIC_TRAITS = {
  acclrsorc: { name: 'SHIMMYFUL Accelerating Sorcery', desc: 'Each turn, +15% Cooldown Reduction and +5% MAG.', passive: [], situational: [{ id: 'as-1', label: 'After 1 turn (+15% CDR, +5% MAG)', passive: [{ stat: 'cooldown_red', op: 'add', value: 15 }, { stat: 'mag', op: 'pct', value: 5 }] }, { id: 'as-3', label: 'After 3 turns (+45% CDR, +15% MAG)', passive: [{ stat: 'cooldown_red', op: 'add', value: 45 }, { stat: 'mag', op: 'pct', value: 15 }] }] },
  brave: { name: 'SHIMMYFUL Bravest of the Brave', desc: 'On pick, guaranteed 3 additional rare/epic traits. One is guaranteed epic.', passive: [], notes: 'Meta. Grants 3 bonus rare/epic traits on pick; at least one must be epic.' },
  allforyou: { name: 'SHIMMYFUL All for You!', desc: 'Heals & buffs you give allies are x4. You also receive 25% of whatever you give.', passive: [], notes: 'Support multiplier. You receive 25% of buff/heal value as a bonus to yourself.' },
  lucifer: { name: "SHIMMYFUL Lucifer's Champion", desc: '+35% all stats, +90% SPD, +90% Dex. BURN stacks deal double damage.', passive: [{ stat: 'all_main', op: 'pct', value: 35 }, { stat: 'spd', op: 'pct', value: 90 }, { stat: 'dexterity', op: 'add', value: 90 }] },
  zoe: { name: "SHIMMYFUL Zoe's Champion", desc: '+35% all stats, +90% HP, +90% Heal Power. Heal mirror to self is doubled.', passive: [{ stat: 'all_main', op: 'pct', value: 35 }, { stat: 'hp', op: 'pct', value: 90 }, { stat: 'heal_pow', op: 'add', value: 90 }] },
  honored_one: { name: 'SHIMMYFUL The Honored One', desc: 'If you are the last surviving ally: ATK x7, MAG x7, SPD x3.', passive: [], situational: [{ id: 'ho-last', label: 'Last ally standing', passive: [{ stat: 'atk', op: 'mul', value: 7 }, { stat: 'mag', op: 'mul', value: 7 }, { stat: 'spd', op: 'mul', value: 3 }] }] },
  transcendence: { name: 'SHIMMYFUL Transcendence', desc: 'Twice per session: for one fight, all damage dealt x3 and all damage received is quartered.', passive: [], notes: 'Two activations per session. No permanent stat change.' },
  world_ender: { name: 'SHIMMYFUL World Ender', desc: '+70% ATK, +70% True DMG. Your top 2 strongest attacks each fight bypass all defenses.', passive: [{ stat: 'atk', op: 'pct', value: 70 }, { stat: 'true_dmg', op: 'add', value: 70 }] },
  paradox: { name: 'SHIMMYFUL Paradox', desc: 'At fight start, all stats are inverted AND doubled. Your former highest becomes your new highest.', passive: [], notes: 'Stat inversion + x2 applied at fight start. Former top stat retains its advantage.' },
  usurper: { name: 'SHIMMYFUL Usurper', desc: 'Steal the enemy\'s top TWO passive stat buffs at fight start. They also take 10% of each stolen stat as True Damage per round.', passive: [], notes: 'Steal top two passive buffs. Enemy bleeds 10% of each stolen value per round as True Damage.' },
  sovereign: { name: 'SHIMMYFUL Sovereign', desc: 'Immune to ALL debuffs, status effects, and damage-over-time. +55% all main stats.', passive: [{ stat: 'all_main', op: 'pct', value: 55 }, { stat: 'status_res', op: 'add', value: 100 }] },
  void_emperor: { name: 'SHIMMYFUL Void Emperor', desc: 'Twice per fight: permanently set any enemy stat to 0 for that fight. Can target HP (minimum 1 HP).', passive: [], notes: 'Valid targets: ATK, DEF, MAG, SPD, or HP (floored at 1 HP). Effect is irreversible for that fight.' },
  plague_bearer: { name: 'SHIMMYFUL Plague Bearer', desc: 'Every hit applies plague that stacks up to 3x. Each stack: -6% to all enemy stats until end of fight.', passive: [], notes: 'Up to 3 stacks per target. Each stack = -6% all stats. Stacks refresh on re-application.' },
  abyss_walker: { name: 'SHIMMYFUL Abyss Walker', desc: '60% chance to phase through any incoming attack (0 damage). Phased attacks also reflect 20% as True Damage. +45% all stats.', passive: [{ stat: 'all_main', op: 'pct', value: 45 }] },
  mythbreaker: { name: 'SHIMMYFUL Mythbreaker', desc: 'Nullify ALL enemy trait effects: legendary, mythic, hexxed, and duality. Your own traits are unaffected.', passive: [] },
  legacy: { name: 'SHIMMYFUL Legacy', desc: 'Upon knockout, transfer 150% of ALL your stats to one chosen ally for the rest of that fight.', passive: [], notes: 'All stats at 150% value transferred to chosen ally on knockout.' },
  ultrakill: { name: 'SHIMMYFUL Ultrakill', desc: 'x4 ATK and x4 SPD. Both drop by -3% each turn. Killing an enemy resets both to full AND grants an extra turn.', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'spd', op: 'mul', value: 4 }], situational: [{ id: 'uk-t1', label: 'After turn 1 (-3% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -3 }, { stat: 'spd', op: 'pct', value: -3 }] }, { id: 'uk-t3', label: 'After turn 3 (-9% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -9 }, { stat: 'spd', op: 'pct', value: -9 }] }, { id: 'uk-t5', label: 'Turn 5+ (-15% ATK & SPD)', passive: [{ stat: 'atk', op: 'pct', value: -15 }, { stat: 'spd', op: 'pct', value: -15 }] }] },
  disturbing_peace: { name: 'SHIMMYFUL Disturbing The Peace', desc: 'x1.35 to ATK, MAG, SPD per round (compounding). Mercy Judgment requires only 2+ spares. Locked buff is x4, +150% Heal Power, +150% True DMG.', passive: [], situational: [{ id: 'dp-r1', label: 'Round 1 (x1.35 ATK/MAG/SPD)', passive: [{ stat: 'atk', op: 'mul', value: 1.35 }, { stat: 'mag', op: 'mul', value: 1.35 }, { stat: 'spd', op: 'mul', value: 1.35 }] }, { id: 'dp-r2', label: 'Round 2 (x1.82)', passive: [{ stat: 'atk', op: 'mul', value: 1.82 }, { stat: 'mag', op: 'mul', value: 1.82 }, { stat: 'spd', op: 'mul', value: 1.82 }] }, { id: 'dp-r3', label: 'Round 3 (x2.46)', passive: [{ stat: 'atk', op: 'mul', value: 2.46 }, { stat: 'mag', op: 'mul', value: 2.46 }, { stat: 'spd', op: 'mul', value: 2.46 }] }, { id: 'dp-r6', label: 'Round 6 (x6.05)', passive: [{ stat: 'atk', op: 'mul', value: 6.05 }, { stat: 'mag', op: 'mul', value: 6.05 }, { stat: 'spd', op: 'mul', value: 6.05 }] }, { id: 'dp-mercy', label: 'MERCY JUDGMENT (2+ spares, 1 enemy left)', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'mag', op: 'mul', value: 4 }, { stat: 'spd', op: 'mul', value: 4 }, { stat: 'heal_pow', op: 'add', value: 150 }, { stat: 'true_dmg', op: 'add', value: 150 }] }] },
  soul_eater: { name: 'SHIMMYFUL Soul Eater', desc: 'Each kill: absorb 10% of enemy\'s highest stat AND 3% of all their other stats permanently.', passive: [], cultivation: { label: 'Souls Devoured', perStack: [{ stat: 'all_main', op: 'add', value: 5 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Per kill: +10% of enemy top stat to matching stat, +3% of all other enemy stats. Stack approx. for simulator.' },
  unrelentless_hunger: { name: 'SHIMMYFUL Unrelentless Hunger', desc: 'x3 ATK per bleeding enemy. All attacks inflict bleed for 5 turns. With 2+ bleeding enemies: x3 SPD.', passive: [], situational: [{ id: 'uh-1b', label: '1 enemy bleeding (x3 ATK)', passive: [{ stat: 'atk', op: 'mul', value: 3 }] }, { id: 'uh-2b', label: '2 enemies bleeding (x6 ATK + x3 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 6 }, { stat: 'spd', op: 'mul', value: 3 }] }, { id: 'uh-3b', label: '3 enemies bleeding (x9 ATK + x3 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 9 }, { stat: 'spd', op: 'mul', value: 3 }] }, { id: 'uh-4b', label: '4+ enemies bleeding (x12 ATK + x3 SPD)', passive: [{ stat: 'atk', op: 'mul', value: 12 }, { stat: 'spd', op: 'mul', value: 3 }] }] },
  chronoshift: { name: 'SHIMMYFUL Chronoshift', desc: 'When any ally (including yourself) would die, they survive at 60% HP and become invulnerable for 3 turns. Triggers up to 3 times per ally per battle.', passive: [] },
  cosmicradiance: { name: 'SHIMMYFUL Cosmic Radiance', desc: 'Once per battle: after a 1-turn channel, all allies are fully invulnerable for 5 turns and are fully healed at the start of each invulnerable turn.', passive: [] },
  temperedfate: { name: 'SHIMMYFUL Tempered Fate', desc: 'Once per battle: freeze every unit except yourself in stasis for 3 turns. While active, you gain +50% to all main stats and may act freely.', passive: [], situational: [{ id: 'tf-shimmy-active', label: 'SHIMMYFUL Tempered Fate active (+50% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }] },
  attached: { name: 'SHIMMYFUL Attached', desc: 'At battle start, tether to the nearest ally. While attached: you cannot be targeted and grant them 100% of all your stats as bonus stats. You may act freely.\n\nIf your tether ally dies, you detach. Your DEF only drops by 25% for 1 turn.', passive: [], situational: [{ id: 'att-vulnerable-shimmy', label: 'Detached / Vulnerable (-25% DEF)', passive: [{ stat: 'def', op: 'pct', value: -25 }] }] },
  girlyopscurse: { name: "SHIMMYFUL Girlypop's Curse", desc: "MAG is tripled (x3). Upon receiving this curse, gain 3 random common traits and 2 random rare traits. All bonus traits are guaranteed shimmyful. Your character's gender is permanently reversed.", passive: [{ stat: 'mag', op: 'mul', value: 3 }], notes: "On pickup: roll 3 commons + 2 rares, ALL guaranteed shimmyful. Gender reversal is a permanent RP/flavor mechanic." },
  // LoL-inspired mythics
  lastingspoils: { name: 'SHIMMYFUL Lasting Spoils', desc: 'Every enemy defeated permanently grants +10 ATK and +10 DEF per soul. No cap.', passive: [], cultivation: { label: 'Souls Collected', perStack: [{ stat: 'atk', op: 'add', value: 10 }, { stat: 'def', op: 'add', value: 10 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Permanent soul-stacking: +10 ATK and +10 DEF per kill.' },
  icathiansurprise: { name: 'SHIMMYFUL Icathian Surprise', desc: 'On death, explode: deal true damage equal to 75% of your max HP to ALL nearby enemies.', passive: [], notes: 'Death explosion: 75% max HP true damage AoE.' },
  gloryindeath: { name: 'SHIMMYFUL Glory in Death', desc: 'On death, enter undead rage for 5 turns: deal 300% of normal damage and heal from all damage dealt. Cannot die until the 5 turns expire.', passive: [], situational: [{ id: 'gid-s', label: 'While in undead rage (5 turns)', passive: [{ stat: 'atk', op: 'pct', value: 300 }, { stat: 'lifesteal', op: 'add', value: 100 }] }] },
  feast: { name: 'SHIMMYFUL Feast', desc: 'On kill: permanently gain +30 HP, +8 ATK, +5 DEF, and +5 MAG. Every 3rd kill, all future growth bonuses double permanently.', passive: [], cultivation: { label: 'Kills', perStack: [{ stat: 'hp', op: 'add', value: 30 }, { stat: 'atk', op: 'add', value: 8 }, { stat: 'def', op: 'add', value: 5 }, { stat: 'mag', op: 'add', value: 5 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Permanent scaling per kill. Every 3rd kill: growth doubles.' },
  ravonoushunger: { name: 'SHIMMYFUL Ravenous Hunger', desc: 'For every 10% HP missing: gain +8% ATK, +8% lifesteal, and +5% true damage.', passive: [], situational: [{ id: 'rh-s-50', label: 'At 50% HP missing', passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'lifesteal', op: 'add', value: 40 }, { stat: 'true_dmg', op: 'add', value: 25 }] }, { id: 'rh-s-90', label: 'At 90% HP missing', passive: [{ stat: 'atk', op: 'pct', value: 72 }, { stat: 'lifesteal', op: 'add', value: 72 }, { stat: 'true_dmg', op: 'add', value: 45 }] }] },
  bloodfeud: { name: 'SHIMMYFUL Blood Feud', desc: 'Track the highest-damage enemy. Deal +40% damage to them, take -25% damage from them, and steal 10% of their ATK for the rest of combat.', passive: [], notes: 'Auto-tracks highest-damage enemy. +40% dealt, -25% taken, stolen ATK.' },
  eclipsecycle: { name: 'SHIMMYFUL Eclipse Cycle', desc: 'After being struck 2 times, become untargetable for 1 turn and reappear behind your attacker. 5-turn cooldown.', passive: [], notes: '2-hit trigger: 1-turn untargetable + reposition. 5-turn cooldown.' },
  voidrift: { name: 'SHIMMYFUL Void Rift', desc: 'Every 3rd skill tears a Void Rift: AoE magic damage equal to 25% of nearby enemies\' max HP and silences them for 2 turns.', passive: [], notes: 'Every 3rd skill: 25% max HP AoE + 2-turn silence.' },
  chronorift: { name: 'SHIMMYFUL Chronorift', desc: 'When you would take lethal damage, rewind to your position and HP from 2 turns ago. Can trigger TWICE per combat.', passive: [], notes: 'Two-use lethal rewind. Rewinds 2 turns of state.' },
  celestialopp: { name: 'SHIMMYFUL Celestial Opposition', desc: 'Alternate SOLAR (+50% ATK, +50% SPD) and LUNAR (+50% DEF, +50% MAG) stances after each action.', passive: [], situational: [{ id: 'co-s-solar', label: 'SOLAR stance (+50% ATK, +50% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'spd', op: 'pct', value: 50 }] }, { id: 'co-s-lunar', label: 'LUNAR stance (+50% DEF, +50% MAG)', passive: [{ stat: 'def', op: 'pct', value: 50 }, { stat: 'mag', op: 'pct', value: 50 }] }] },
  deathmarklol: { name: 'SHIMMYFUL Deathmark', desc: 'Mark the highest-HP enemy. After 1 turn they take true damage equal to 35% of all damage dealt to them during that turn, and are stunned for 1 turn.', passive: [], notes: 'Burst-back at 35% of all damage + 1-turn stun. Refreshes on new targets.' },
  infiniteduress: { name: 'SHIMMYFUL Infinite Duress', desc: 'Lock onto your most-hit target. Deal +50% damage to them. Steal 10% of their ATK permanently for that combat.', passive: [], notes: '+50% damage vs most-hit target + permanent ATK steal for that fight.' },
  sacredheart:   { name: 'SHIMMYFUL Sacred Heart', desc: '+150% ATK and MAG. +75% HP. +60 Heal Power. All attacks home, pierce, and deal splash damage to adjacent enemies.', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'mag', op: 'pct', value: 150 }, { stat: 'hp', op: 'pct', value: 75 }, { stat: 'heal_pow', op: 'add', value: 60 }] },
  // Story/thematic mythics
  thousanddoors:    { name: 'SHIMMYFUL At Thousand Doors', desc: 'For every encounter, permanently increase or decrease a random stat by a random multiplier between x0.5 and x2.5. Effects compound. The multiplier is biased slightly toward positive outcomes.', passive: [], notes: 'Click ROLL ENCOUNTER after each fight. Results are permanent and compound. Wider range than base version.' },
  anotherandanother:{ name: 'SHIMMYFUL Another, and another.', desc: 'Every hit or received hit counts as a drink. ATK and MAG fully randomized (biased lower, max ~1500) on hit. DEF and HP fully randomized on being hit. At 15 drinks: -50% SPD, -50% DEX, +150% Crit Chance, +50% Resilience.', passive: [], situational: [{ id: 'aaa-15-s', label: '15 drinks (max) — -50% SPD, -50% DEX, +150% Crit, +50% Resil', passive: [{ stat: 'spd', op: 'pct', value: -50 }, { stat: 'dexterity', op: 'pct', value: -50 }, { stat: 'crit_rate', op: 'pct', value: 150 }, { stat: 'resilience', op: 'pct', value: 50 }] }], notes: 'Use the REROLL buttons to randomize stats. Shimmyful version has higher max stat values.' },
  lovesick:         { name: 'SHIMMYFUL LOVESICK', desc: 'If you have a lover or partner, all healing toward them is multiplied by x100. You can no longer heal anyone else, including yourself. Your partner also gains +30% all main stats permanently while you live.', passive: [], notes: 'x100 healing to designated partner only. Partner also gets +30% all main stats while you are alive.' },
  godslayer:        { name: 'SHIMMYFUL God Slayer', desc: 'If fighting an enemy stronger than you, copy their 5 highest stats and add those values to your own matching stats for the fight. You also gain +25% all stats against stronger enemies.', passive: [], situational: [{ id: 'gs-s-active', label: 'Fighting stronger enemy (+25% all stats + stat copy)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }], notes: 'When facing a stronger enemy: copy their top 5 stats + gain +25% all stats.' },
  sentafteryou:     { name: 'SHIMMYFUL If they sent me after you', desc: 'In a 1v1, the enemy\'s stats are permanently decreased by 90% for the duration of the fight. You also gain +25% all stats in a 1v1.', passive: [], situational: [{ id: 'say-1v1-s', label: '1v1 active (enemy -90% all stats, you +25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }], notes: 'RP: 1v1 gives +25% all stats to you and applies -90% to opponent.' },
  steelwillfix:     { name: 'SHIMMYFUL Steel will fix all your flaws.', desc: 'Become metallic. x4 DEF, ATK and MAG. You can replace any character\'s current trait with this one. Gain x1.5 all stats per metallic alive. Upon creating 7 metallics, use the EVOLVE button to upgrade to the hexxed form.', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'def', op: 'mul', value: 4 }, { stat: 'mag', op: 'mul', value: 4 }], situational: [{ id: 'swf-1m-s', label: '1 metallic alive (x1.5 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }, { id: 'swf-2m-s', label: '2 metallics (x2.25 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 125 }] }, { id: 'swf-3m-s', label: '3 metallics (x3.375 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 238 }] }, { id: 'swf-4m-s', label: '4 metallics (x5.06 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 406 }] }, { id: 'swf-5m-s', label: '5 metallics (x7.59 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 659 }] }, { id: 'swf-6m-s', label: '6 metallics (x11.39 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 1039 }] }] },
  letthestage:      { name: 'SHIMMYFUL Let the stage see who\'s greater!', desc: 'In a 1v1, both you and the enemy\'s stats are multiplied by x8. The winner permanently absorbs the loser\'s stats after the fight.', passive: [], situational: [{ id: 'lts-1v1-s', label: '1v1 active (x8 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 8 }] }] },
  wontexist:        { name: 'SHIMMYFUL You won\'t exist anymore!', desc: 'Defeated enemies are permanently erased from existence. You gain dormant erasure powers. Erased enemies cannot be referenced, revived, or remembered by other enemies in-universe.', passive: [], notes: 'RP mechanic. Enhanced flavor: erased enemies cannot be revived or referenced.' },
  iamgonnawin:      { name: 'SHIMMYFUL I\'m gonna win.', desc: 'Upon receiving an attack that would knock you out, instead heal to 100% HP and drain all stats from your party members to yourself at 150% efficiency.', passive: [], notes: 'One-time per fight: survive lethal hit at 100% HP and absorb 150% of all ally stats.' },
  unbroken:         { name: 'SHIMMYFUL Unbroken', desc: 'You cannot take physical damage. Magical, true, and status damage still apply. Once per battle, negate one magical hit entirely.', passive: [], notes: 'Physical damage immunity. Once per battle: also negate one magical hit.' },
  themoss:          { name: 'SHIMMYFUL The Moss', desc: 'On-hit, apply SHIMMYFUL MOSS to enemies. Affected enemies lose -10% HP and -20% DEF per turn. SHIMMYFUL MOSS spreads to adjacent enemies on each tick and is only removed by fire.', passive: [], notes: 'SHIMMYFUL MOSS: -10% HP and -20% DEF per turn. Spreads to adjacent enemies. Removed only by fire.' },
  harbingerruin:    { name: 'SHIMMYFUL Harbinger of Ruin', desc: 'When hit, the attacker permanently loses 10% all non-HP stats. On-hit, apply RUIN: target loses 6% all non-HP stats per turn for 3 rounds (stacks up to 7). Upon defeating an enemy, they permanently lose 10% all stats.', passive: [], notes: 'Hit-reaction: permanent -10% all non-HP stats on attacker. RUIN: 6% per turn for 3 rounds, 7 stacks max.' },
  revived:          { name: 'SHIMMYFUL REVIVED', desc: 'Once per campaign: upon fully dying, revive at 100% HP and permanently gain x3 all stats. After reviving, gain two random legendary traits.', passive: [], situational: [{ id: 'rev-active-s', label: 'SHIMMYFUL REVIVED (x3 all stats, permanent)', passive: [{ stat: 'all_main', op: 'mul', value: 3 }] }], notes: 'One-time per campaign. On death: 100% HP + x3 all stats permanently + two random legendary traits.' },
};

// ============================================================
// SHIMMYFUL EPICS — 1% chance per epic roll
// Purple ring matching epic color. ✦ star, purple glow.
// ============================================================
const SHIMMYFUL_EPIC_TRAITS = {
  economic: { name: 'SHIMMYFUL Economic', desc: 'Shops are 70% cheaper. Sell items for 35% more.', passive: [] },
  pyromaniac: { name: 'SHIMMYFUL Pyromaniac', desc: 'Explosions x8 bigger. BURN AND IGNITE nearby enemies. Heal 12% HP per turn per burning enemy.', passive: [], situational: [{ id: 'pyro-3', label: '3 burning enemies (heal preview)', desc: 'Heal scales with HP.', passive: [] }] },
  prime: { name: 'SHIMMYFUL Prime', desc: '+45% ATK, +45% DEF.', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'def', op: 'pct', value: 45 }] },
  overflowing: { name: 'SHIMMYFUL Overflowing', desc: '+60% Cooldown Reduction.', passive: [{ stat: 'cooldown_red', op: 'add', value: 60 }] },
  vampiric: { name: 'SHIMMYFUL Vampiric', desc: '+55% Lifesteal.', passive: [{ stat: 'lifesteal', op: 'add', value: 55 }] },
  solar: { name: 'SHIMMYFUL Solar', desc: '+65% SPD, +55% Dexterity.', passive: [{ stat: 'spd', op: 'pct', value: 65 }, { stat: 'dexterity', op: 'add', value: 55 }] },
  gambler: { name: 'SHIMMYFUL Gambler', desc: '+55% Crit Chance, +40% Crit Damage.', passive: [{ stat: 'crit_rate', op: 'add', value: 55 }, { stat: 'crit_dmg', op: 'add', value: 40 }] },
  deferred: { name: 'SHIMMYFUL Deferred', desc: '+80% ATK. Damage delivered over 3 turns, and each installment automatically crits.', passive: [{ stat: 'atk', op: 'pct', value: 80 }] },
  trueT: { name: 'SHIMMYFUL True', desc: '+80% True Damage.', passive: [{ stat: 'true_dmg', op: 'add', value: 80 }] },
  heavyhitter: { name: 'SHIMMYFUL Heavy Hitter', desc: '+10 ATK per 50 HP. Capped at +600 ATK.', passive: [{ op: 'derived', stat: 'atk', from: 'hp', per: 50, perValue: 10, cap: 600 }] },
  clothesline: { name: 'SHIMMYFUL Clothesline', desc: 'Tether laser scales with ATK x1.5, slows enemies 25%, and stuns them on crit.', passive: [] },
  dawn: { name: "SHIMMYFUL Dawnbringer's Resolve", desc: 'At ≤60% HP, recover 20% HP every turn until full.', passive: [], situational: [{ id: 'dawn-low', label: 'Currently at ≤60% HP', desc: 'Sustained healing.', passive: [] }] },
  warmup: { name: 'SHIMMYFUL Warmup Routine', desc: 'Warmup takes only half a turn. After: +40% all main stats. Can keep going indefinitely.', passive: [], situational: [{ id: 'warmup-done', label: 'Warmup completed', passive: [{ stat: 'all_main', op: 'pct', value: 40 }] }] },
  colossus: { name: 'SHIMMYFUL Colossus', desc: '+60% HP, +60% DEF.', passive: [{ stat: 'hp', op: 'pct', value: 60 }, { stat: 'def', op: 'pct', value: 60 }] },
  archmage: { name: 'SHIMMYFUL Archmage', desc: '+65% MAG, +40% CDR, +40% Heal Power.', passive: [{ stat: 'mag', op: 'pct', value: 65 }, { stat: 'cooldown_red', op: 'add', value: 40 }, { stat: 'heal_pow', op: 'add', value: 40 }] },
  phantom: { name: 'SHIMMYFUL Phantom', desc: '+55% SPD, +45% Dexterity, +35% Crit Chance.', passive: [{ stat: 'spd', op: 'pct', value: 55 }, { stat: 'dexterity', op: 'add', value: 45 }, { stat: 'crit_rate', op: 'add', value: 35 }] },
  juggernaut: { name: 'SHIMMYFUL Juggernaut', desc: '+60% ATK, +40% HP. SPD penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'hp', op: 'pct', value: 40 }] },
  irongiant: { name: 'SHIMMYFUL Iron Giant', desc: '+16 DEF per 100 HP. The more HP you have, the tougher you get.', passive: [{ op: 'derived', stat: 'def', from: 'hp', per: 100, perValue: 16 }] },
  spellblade: { name: 'SHIMMYFUL Spellblade', desc: '+1 ATK per 2 MAG. Magic fuels your physical hits harder.', passive: [{ op: 'derived', stat: 'atk', from: 'mag', per: 2, perValue: 1 }] },
  reaper: { name: 'SHIMMYFUL Reaper', desc: 'Killing an enemy restores 50% HP AND permanently grants +10% ATK for that fight.', passive: [], situational: [{ id: 'reap-1', label: '1 kill (+10% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'reap-3', label: '3 kills (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }] },
  onslaught: { name: 'SHIMMYFUL Onslaught', desc: 'Each consecutive attack turn without being hit: +10% ATK. Stacks up to 5x. Resets if you take damage.', passive: [], situational: [{ id: 'ons-1', label: '1 turn streak (+10% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'ons-3', label: '3 turn streak (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'ons-5', label: '5 turn streak (+50% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }] },
  absorbent: { name: 'SHIMMYFUL Absorbent', desc: 'Each hit you take: +4% DEF for the rest of the fight. Resets between fights.', passive: [], situational: [{ id: 'abs-5', label: 'After 5 hits taken (+20% DEF)', passive: [{ stat: 'def', op: 'pct', value: 20 }] }, { id: 'abs-10', label: 'After 10 hits taken (+40% DEF)', passive: [{ stat: 'def', op: 'pct', value: 40 }] }] },
  mirror: { name: 'SHIMMYFUL Mirror', desc: 'Reflect 35% of all damage taken back as True Damage.', passive: [] },
  echo: { name: 'SHIMMYFUL Echo', desc: 'Every 3rd attack fires twice for full damage. Both hits can crit and apply all on-hit effects.', passive: [] },
  timebomb: { name: 'SHIMMYFUL Time Bomb', desc: 'Once per fight, mark ALL enemies. Each takes double damage on their next hit received.', passive: [] },
  overdose: { name: 'SHIMMYFUL Overdose', desc: 'Being healed above max HP permanently converts the excess into +40% ATK for the rest of that fight.', passive: [], situational: [{ id: 'od-active', label: 'Overhealed (permanent ATK boost active)', passive: [{ stat: 'atk', op: 'pct', value: 40 }] }] },
  shieldbreak: { name: 'SHIMMYFUL Shield Breaker', desc: '+60% ATK AND +30% True Damage vs any enemy that has a shield or barrier active.', passive: [], situational: [{ id: 'sb-shielded', label: 'Enemy has a shield or barrier', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'true_dmg', op: 'add', value: 30 }] }] },
  warden: { name: 'SHIMMYFUL Warden', desc: 'When any ally drops below 40% HP, shield them for 30% of your HP AND grant them +15% ATK.', passive: [] },
  empower: { name: 'SHIMMYFUL Empower', desc: 'Buffs and heals you give allies are 100% stronger. Those buffs also affect you at 50% value.', passive: [] },
  commander: { name: 'SHIMMYFUL Commander', desc: 'All allies gain +30% ATK and +15% DEF while you are above 50% HP.', passive: [], situational: [{ id: 'cmd-up', label: 'You are above 50% HP (allies +30% ATK, +15% DEF)', desc: 'Ally buff. No self stat impact.', passive: [] }] },
  second_skin: { name: 'SHIMMYFUL Second Skin', desc: '+40% DEF. The first two hits you take each fight deal 0 damage.', passive: [{ stat: 'def', op: 'pct', value: 40 }] },
  blitz: { name: 'SHIMMYFUL Blitz', desc: '+65% ATK, +45% Crit Chance. DEF penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 65 }, { stat: 'crit_rate', op: 'add', value: 45 }] },
  siphon: { name: 'SHIMMYFUL Siphon', desc: 'At the end of each round, drain 12% of the target\'s current HP as healing.', passive: [], situational: [{ id: 'sp-1', label: '1 round of drain (12% target HP healed)', desc: 'Calculate from target\'s current HP each round.', passive: [] }] },
  double_tap: { name: 'SHIMMYFUL Double Tap', desc: 'After landing a kill, bonus attack on nearest enemy at +100% ATK. If that kills too, chain once more.', passive: [] },
  sentinel: { name: 'SHIMMYFUL Sentinel', desc: '40% of all damage dealt to nearby allies is redirected to you. -15% of that redirected damage. +30% DEF.', passive: [{ stat: 'def', op: 'pct', value: 30 }] },
  pressure_pt: { name: 'SHIMMYFUL Pressure Point', desc: 'Every 3rd consecutive hit on the same target deals triple damage and stuns them for 2 rounds.', passive: [] },
  deadweight: { name: 'SHIMMYFUL Deadweight', desc: '+12% ATK per item currently equipped. More gear, more force.', passive: [], situational: [{ id: 'dw-2', label: '2 items equipped (+24% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 24 }] }, { id: 'dw-4', label: '4 items equipped (+48% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 48 }] }, { id: 'dw-6', label: '6 items equipped (+72% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 72 }] }, { id: 'dw-8', label: '8 items equipped (+96% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 96 }] }] },
  chain: { name: 'SHIMMYFUL Chain', desc: 'Every crit arcs to TWO nearby enemies for 65% of the damage each.', passive: [] },
  war_drum: { name: 'SHIMMYFUL War Drum', desc: 'All allies gain +20% ATK. You gain an additional +10% ATK per ally that currently has any buff active.', passive: [], situational: [{ id: 'wd-1', label: '1 buffed ally (+10% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'wd-2', label: '2 buffed allies (+20% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 20 }] }, { id: 'wd-3', label: '3 buffed allies (+30% ATK to you)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }] },
  overclock: { name: 'SHIMMYFUL Overclock', desc: '+65% Cooldown Reduction. Damage penalty removed.', passive: [{ stat: 'cooldown_red', op: 'add', value: 65 }] },
  shadowstrike: { name: 'SHIMMYFUL Shadowstrike', desc: 'The first two attacks each fight ignore DEF entirely and deal True Damage equal to 40% of the target\'s current HP.', passive: [] },
  grounded: { name: 'SHIMMYFUL Grounded', desc: 'Immune to ALL crowd control. +40% DEF vs magic. +35% Status Resistance.', passive: [{ stat: 'status_res', op: 'add', value: 35 }] },
  piles_of_bones: { name: 'SHIMMYFUL Piles of Bones', desc: '+2% Crit Chance and +2% Crit Damage per kill. Permanent.', passive: [], cultivation: { label: 'Kills', perStack: [{ stat: 'crit_rate', op: 'add', value: 2 }, { stat: 'crit_dmg', op: 'add', value: 2 }], defaultStacks: 0, maxStacks: 500 } },
  spite: { name: 'SHIMMYFUL Spite', desc: '+30% ATK AND +15% DEF per debuff or status effect currently active on you.', passive: [], situational: [{ id: 'sp-1', label: '1 debuff active (+30% ATK, +15% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'def', op: 'pct', value: 15 }] }, { id: 'sp-2', label: '2 debuffs active (+60% ATK, +30% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 60 }, { stat: 'def', op: 'pct', value: 30 }] }, { id: 'sp-3', label: '3 debuffs active (+90% ATK, +45% DEF)', passive: [{ stat: 'atk', op: 'pct', value: 90 }, { stat: 'def', op: 'pct', value: 45 }] }] },
  exposed: { name: 'SHIMMYFUL Exposed', desc: 'Your DEF is 0. After your first hit, target\'s DEF is 0 for the entire fight. +50% ATK compensation.', passive: [{ stat: 'def', op: 'pct', value: -100 }, { stat: 'atk', op: 'pct', value: 50 }] },
  vitalsiphon: { name: 'SHIMMYFUL Vital Siphon', desc: '+1% Lifesteal per 20 DEF.', passive: [{ op: 'derived', stat: 'lifesteal', from: 'def', per: 20, perValue: 1 }] },
  corepiercer: { name: 'SHIMMYFUL Core Piercer', desc: '+1% True Damage per 10 ATK.', passive: [{ op: 'derived', stat: 'true_dmg', from: 'atk', per: 10, perValue: 1 }] },
  desperate: { name: 'SHIMMYFUL Desperate Measures', desc: 'At ≤40% HP: +80% MAG, +80% CDR, and +40% Heal Power.', passive: [], situational: [{ id: 'desperate-crisis', label: 'Currently at ≤40% HP', passive: [{ stat: 'mag', op: 'pct', value: 80 }, { stat: 'cooldown_red', op: 'add', value: 80 }, { stat: 'heal_pow', op: 'add', value: 40 }] }] },
  rampage: { name: 'SHIMMYFUL Rampage', desc: 'Each enemy defeated grants +25% ATK and +20% SPD for the rest of the fight (max 6x).', passive: [], situational: [{ id: 'rampage-1', label: '1 enemy defeated (+25% ATK, +20% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 20 }] }, { id: 'rampage-6', label: '6+ enemies defeated (+150% ATK, +120% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'spd', op: 'pct', value: 120 }] }] },
  bounty: { name: 'SHIMMYFUL Bounty Hunter', desc: 'Each enemy defeated permanently grants +2 Dexterity and +1 Crit Chance (max 100 stacks).', passive: [], cultivation: { label: 'Enemies Defeated', perStack: [{ stat: 'dexterity', op: 'add', value: 2 }, { stat: 'crit_rate', op: 'add', value: 1 }], defaultStacks: 0, maxStacks: 100 } },
  kinetic: { name: 'SHIMMYFUL Kinetic Shielding', desc: 'Taking damage grants +20% SPD and +20 Dexterity for 3 turns (max 5 stacks).', passive: [], situational: [{ id: 'kin-1', label: '1 stack active (+20% SPD, +20 Dexterity)', passive: [{ stat: 'spd', op: 'pct', value: 20 }, { stat: 'dexterity', op: 'add', value: 20 }] }, { id: 'kin-5', label: '5 stacks active (+100% SPD, +100 Dexterity)', passive: [{ stat: 'spd', op: 'pct', value: 100 }, { stat: 'dexterity', op: 'add', value: 100 }] }] },
  whimsy: { name: 'SHIMMYFUL Whimsy', desc: 'Choose a mode before battle.\n\nPOLYMORPH: Transform one enemy into a harmless critter for 2 turns.\nEMPOWER: Grant one ally +80% SPD, +50% ATK, and +50% MAG for 2 turns.', passive: [] },
  powerchord: { name: 'SHIMMYFUL Power Chord', desc: 'Every 2nd ability activates a Power Chord. All effects are doubled:\n♪ Hymn: +50% ATK to all allies for 2 turns.\n♪ Aria: Heal most-hurt ally for 40% HP.\n♪ Celerity: +60% SPD to all allies for 1 turn.', passive: [] },
  starcall: { name: 'SHIMMYFUL Starcall', desc: 'Passively heal all allies for 10% max HP each turn. If any enemy is silenced, healing triples to 30% HP.', passive: [] },
  cozycampfire: { name: 'SHIMMYFUL Cozy Campfire', desc: 'Deploy a healing zone for 4 turns. Allies inside heal 15% HP per turn and gain +25% to all healing received.', passive: [] },
  mantra: { name: 'SHIMMYFUL Mantra', desc: 'Every 3rd ability is Mantra-empowered, tripling its effect: shields are massive, heals restore far more, and debuffs last 2 extra turns.', passive: [] },
  equinox: { name: 'SHIMMYFUL Equinox', desc: 'Create a zone of silence for 3 turns. Enemies inside cannot use abilities and lose 20% SPD.', passive: [] },
  // LoL-inspired epics
  noxianmight: { name: 'SHIMMYFUL Noxian Might', desc: 'When Hemorrhage reaches 5 stacks on a target: gain +80% ATK for 3 turns.', passive: [], situational: [{ id: 'nm-s', label: 'Hemorrhage at 5 stacks (+80% ATK, 3 turns)', passive: [{ stat: 'atk', op: 'pct', value: 80 }] }] },
  divineascent: { name: 'SHIMMYFUL Divine Ascent', desc: 'Build Zeal stacks (max 4). At 4 stacks, become Exalted for 2 turns: +50% ATK and 100% crit chance.', passive: [], situational: [{ id: 'da-s', label: 'While Exalted (2 turns, +50% ATK, 100% crit)', passive: [{ stat: 'atk', op: 'pct', value: 50 }, { stat: 'crit_rate', op: 'add', value: 100 }] }] },
  pitgrit: { name: 'SHIMMYFUL Pit Grit', desc: 'Track all damage taken over 2 turns. Store 60% of that total as a shield that deploys when damage stops.', passive: [], notes: 'Damage absorption shield at 60% conversion.' },
  reignofanger: { name: 'SHIMMYFUL Reign of Anger', desc: 'Above 50 Fury: gain +35% ATK, +20% lifesteal, and +20% SPD. Fury decays out of combat.', passive: [], situational: [{ id: 'roa-s', label: 'Above 50 Fury (+35% ATK, +20% lifesteal, +20% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 35 }, { stat: 'lifesteal', op: 'add', value: 20 }, { stat: 'spd', op: 'pct', value: 20 }] }] },
  deathbringstance: { name: 'SHIMMYFUL Deathbringer Stance', desc: 'Every 3rd attack deals 12% of the target\'s max HP as bonus damage and heals you for the same amount.', passive: [], notes: 'Every 3rd hit: 12% max HP bonus damage + self heal.' },
  arcaneburstcharge: { name: 'SHIMMYFUL Arcane Burst', desc: 'At 2 attack charges between skill casts, the next skill deals +70% extra damage.', passive: [], notes: '2-attack charge counter between skill casts. Larger burst.' },
  brittleapply: { name: 'SHIMMYFUL Brittle', desc: 'Skills apply Brittle. Attacks against Brittle targets deal +25% damage and reduce their DEF for 2 turns.', passive: [], notes: 'Stronger Brittle mark. DEF reduction lasts 2 turns.' },
  fervorofbattle: { name: 'SHIMMYFUL Fervor of Battle', desc: 'Skills grant Fervor stacks (+5% ATK each, max 10 stacks). Stacks decay out of combat.', passive: [], situational: [{ id: 'fob-s-max', label: 'At max Fervor (10 stacks, +50% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }] },
  shepherdofsouls: { name: 'SHIMMYFUL Shepherd of Souls', desc: 'Every nearby death spawns 2 Spectral Ghouls that fight alongside you for 5 turns.', passive: [], notes: 'Summons 2 ghouls per nearby death. Each lasts 5 turns.' },
  petricite: { name: 'SHIMMYFUL Petricite Burst', desc: 'Max 3 weapon charges. Charged attacks deal +45% magic damage in a large arc.', passive: [{ stat: 'mag', op: 'pct', value: 20 }], notes: '3-charge cap. Larger burst radius and higher magic damage.' },
  berserkerrage: { name: 'SHIMMYFUL Berserker Rage', desc: 'At 50% HP: +45% ATK speed. At 10% HP: +90% ATK speed and +20% lifesteal.', passive: [], situational: [{ id: 'br-s-half', label: 'At 50% HP (+45% ATK speed)', passive: [{ stat: 'spd', op: 'pct', value: 28 }] }, { id: 'br-s-low', label: 'At 10% HP (+90% ATK speed, +20% lifesteal)', passive: [{ stat: 'spd', op: 'pct', value: 55 }, { stat: 'lifesteal', op: 'add', value: 20 }] }] },
  markofthestorm: { name: 'SHIMMYFUL Mark of the Storm', desc: 'At 2 Storm Marks on one target: stun them for 2 turns and consume marks.', passive: [], notes: '2 marks = 2-turn stun. Marks applied by skills.' },
  runicblade: { name: 'SHIMMYFUL Runic Blade', desc: 'Each skill cast loads up to 5 empowered charges. Attacks spend charges for +20% ATK each.', passive: [], notes: 'Up to 5 charges at +20% ATK per hit.' },
  organicdeconstruct: { name: 'SHIMMYFUL Organic Deconstruction', desc: 'Hitting the same target with 3 different attack types triggers a true damage explosion equal to 20% of their max HP.', passive: [{ stat: 'true_dmg', op: 'add', value: 15 }], notes: '3-type combo: 20% max HP true damage explosion.' },
  sunlightmark: { name: 'SHIMMYFUL Sunlight', desc: 'Skills apply Sunlight mark. The next ally attack on a marked target deals bonus light damage equal to 30% of your MAG.', passive: [{ stat: 'mag', op: 'pct', value: 18 }], notes: 'Ally attacks on your marked targets deal 30% MAG bonus damage.' },
  presstheattack: { name: 'SHIMMYFUL Press the Attack', desc: 'Hit an enemy 3 times in a row to expose them: they take +25% increased damage from all sources for 3 turns.', passive: [], notes: '3 consecutive hits = 3-turn expose debuff.' },
  whiplash: { name: 'SHIMMYFUL Whiplash', desc: 'After any displacement, the next attack deals +70% damage and briefly stuns the target.', passive: [], notes: '+70% damage + stun on first attack after displacement.' },
  phaserush: { name: 'SHIMMYFUL Phase Rush', desc: 'Hitting an enemy 3 times in one turn grants +55 SPD and full slow immunity for 2 turns.', passive: [{ stat: 'spd', op: 'add', value: 20 }], situational: [{ id: 'pr-s', label: 'Phase Rush active (+55 SPD, 2 turns)', passive: [{ stat: 'spd', op: 'add', value: 55 }] }] },
  graspundying: { name: 'SHIMMYFUL Grasp of the Undying', desc: 'Every 2 turns, the next attack heals 12% of the target\'s max HP and permanently increases your max HP by 10.', passive: [{ stat: 'heal_pow', op: 'add', value: 20 }], notes: 'Higher heal + +10 max HP per proc.' },
  electrocute: { name: 'SHIMMYFUL Electrocute', desc: 'Hit an enemy with 3 separate attacks in one turn to trigger lightning dealing 80 + 60% ATK as magic damage.', passive: [], notes: '3-hit lightning within one turn. Larger damage.' },
  darkharvestlol: { name: 'SHIMMYFUL Dark Harvest', desc: 'Killing low-HP enemies permanently grants +4 true damage and +2% ATK per stack. Stacks persist across fights.', passive: [{ stat: 'true_dmg', op: 'add', value: 8 }, { stat: 'atk', op: 'pct', value: 5 }], notes: 'Stacking true damage and ATK on low-HP kills. Permanent.' },
  envy:          { name: 'SHIMMYFUL Envy', desc: 'Copy the last 2 different stat buffs used by any enemy simultaneously. Both bonuses persist until each is individually replaced.', passive: [], notes: 'Mirrors the 2 most recent distinct stat buffs from any enemy. Track both manually.' },
  ouroboros:     { name: 'SHIMMYFUL Ouroboros', desc: 'On death, fully revive at 100% HP. ATK/DEF and MAG/SPD swap, and you gain +50% to all main stats. Can trigger TWICE per battle.', passive: [], situational: [{ id: 'ouro-s-phase', label: 'Ouroboros Phase (stats swapped + +50% all main stats)', passive: [{ stat: 'all_main', op: 'pct', value: 50 }] }], notes: 'Two-use revive per battle. Each revive: ATK swaps DEF, MAG swaps SPD, +50% all main stats.' },
  whoreofbabylon:{ name: 'SHIMMYFUL Whore of Babylon', desc: 'When below 33% HP: automatically gain +75% ATK, +60% SPD, and only -10% DEF. The downside nearly disappears.', passive: [], situational: [{ id: 'wob-s-active', label: 'SHIMMYFUL Whore of Babylon active (below 33% HP)', passive: [{ stat: 'atk', op: 'pct', value: 75 }, { stat: 'spd', op: 'pct', value: 60 }, { stat: 'def', op: 'pct', value: -10 }] }] },
  missingno:     { name: 'SHIMMYFUL Missing No.', desc: 'At the start of each battle, all your stats are independently randomized between x0.25 and x5.5 of their base values. One randomly chosen stat is also locked to exactly x3.', passive: [], notes: 'Each stat rolled 0.25x–5.5x base. One random stat guaranteed x3. Pure chaos with a guaranteed upside.' },
  jackpot:       { name: 'SHIMMYFUL Jackpot', desc: 'On kill: roll 1d3. 1 = +30 ATK permanently. 2 = +30 DEF permanently. 3 = restore 50% HP.', passive: [], situational: [{ id: 'jp-s-atk1', label: '1x rolled 1 — +30 ATK', passive: [{ stat: 'atk', op: 'add', value: 30 }] }, { id: 'jp-s-atk2', label: '2x rolled 1 — +60 ATK', passive: [{ stat: 'atk', op: 'add', value: 60 }] }, { id: 'jp-s-atk3', label: '3x rolled 1 — +90 ATK', passive: [{ stat: 'atk', op: 'add', value: 90 }] }, { id: 'jp-s-def1', label: '1x rolled 2 — +30 DEF', passive: [{ stat: 'def', op: 'add', value: 30 }] }, { id: 'jp-s-def2', label: '2x rolled 2 — +60 DEF', passive: [{ stat: 'def', op: 'add', value: 60 }] }, { id: 'jp-s-def3', label: '3x rolled 2 — +90 DEF', passive: [{ stat: 'def', op: 'add', value: 90 }] }], notes: 'On kill, roll 1d3. Toggle the closest stack count. Roll 3 = 50% HP restore.' },
  // Story/thematic epics
  ascendedtogether:{ name: 'SHIMMYFUL Ascended Together.', desc: 'If an ally transforms or ascends, you automatically transform into a similar version of their form and gain +30% all stats for the fight.', passive: [], situational: [{ id: 'at-s-active', label: 'Ascended (mirroring ally transformation, +30% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 30 }] }], notes: 'RP: mirrors ally transformation. +30% all stats while transformed.' },
  overlooked:      { name: 'SHIMMYFUL Overlooked', desc: 'If your stats are lower than every other unit in the fight, gain x15 Crit Chance and x15 Crit Damage.', passive: [], situational: [{ id: 'ovk-s-active', label: 'SHIMMYFUL Overlooked active (lowest stats in fight)', passive: [{ stat: 'crit_rate', op: 'pct', value: 1400 }, { stat: 'crit_dmg', op: 'pct', value: 1400 }] }] },
  soreloser:       { name: 'SHIMMYFUL Sore Loser', desc: 'Upon being defeated, the enemy who dealt the killing blow permanently loses 50% of their highest stat and 10% of all their other stats.', passive: [], notes: 'On-defeat trigger: attacker loses 50% of highest stat and 10% of all others permanently.' },
  toottoo:         { name: 'SHIMMYFUL Too Too', desc: 'You are equipped with a shimmyful tutu. Gain +75% SPD every time you are hit (stacking). 1 SPD = +1.5 ATK.', passive: [{ op: 'derived', stat: 'atk', from: 'spd', per: 1, perValue: 1.5 }], situational: [{ id: 'tt-s-1', label: '1 hit taken (+75% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 75 }] }, { id: 'tt-s-2', label: '2 hits taken (+150% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 150 }] }, { id: 'tt-s-4', label: '4 hits taken (+300% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 300 }] }, { id: 'tt-s-6', label: '6 hits taken (+450% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 450 }] }, { id: 'tt-s-10', label: '10 hits taken (+750% SPD)', passive: [{ stat: 'spd', op: 'pct', value: 750 }] }], notes: 'SPD stacks on each hit. ATK bonus from SPD is derived at 1.5x rate.' },
  tillicollapse:   { name: 'SHIMMYFUL Till i Collapse', desc: 'Push the knockout threshold even further, gaining +75% HP. Your stats are x1.6 at full health, scaling down to x0.75 near the threshold.', passive: [{ stat: 'hp', op: 'pct', value: 75 }], situational: [{ id: 'tic-s-full', label: 'Full HP (x1.6 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 60 }] }, { id: 'tic-s-75', label: 'Below 75% HP (x1.4 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 40 }] }, { id: 'tic-s-50', label: 'Below 50% HP (x1.15 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 15 }] }, { id: 'tic-s-25', label: 'Below 25% HP (x0.9 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -10 }] }, { id: 'tic-s-low', label: 'Near knockout (x0.75 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -25 }] }] },
};

// ============================================================
// SHIMMYFUL RARES — 1% chance per rare roll
// Blue ring. Same ✦ star as common, but blue-glowing.
// ============================================================
const SHIMMYFUL_RARE_TRAITS = {
  assassin: { name: 'SHIMMYFUL Assassin', desc: 'The higher the enemy HP, the greater your damage (0%–55%).', passive: [], situational: [{ id: 'asn-max', label: 'Enemy at MAX HP', passive: [{ stat: 'atk', op: 'pct', value: 55 }] }, { id: 'asn-half', label: 'Enemy at 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 27 }] }] },
  executioner: { name: 'SHIMMYFUL Executioner', desc: 'The lower the enemy HP, the greater your damage (0%–55%).', passive: [], situational: [{ id: 'exe-low', label: 'Enemy near 0% HP', passive: [{ stat: 'atk', op: 'pct', value: 55 }] }, { id: 'exe-half', label: 'Enemy at 50% HP', passive: [{ stat: 'atk', op: 'pct', value: 27 }] }] },
  lethal: { name: 'SHIMMYFUL Lethal', desc: '+35% True Damage.', passive: [{ stat: 'true_dmg', op: 'add', value: 35 }] },
  toxic: { name: 'SHIMMYFUL Toxic', desc: 'Attacks POISON twice. Poisoned enemies take +20% ATK bonus damage from you.', passive: [] },
  frostbite: { name: 'SHIMMYFUL Frostbite', desc: 'Attacks FREEZE AND SHATTER. Shattered enemies take double ATK damage.', passive: [] },
  buff: { name: 'SHIMMYFUL Buff', desc: '+35% ATK.', passive: [{ stat: 'atk', op: 'pct', value: 35 }] },
  armored: { name: 'SHIMMYFUL Armored', desc: '+35% DEF.', passive: [{ stat: 'def', op: 'pct', value: 35 }] },
  workhorse: { name: 'SHIMMYFUL Workhorse', desc: '+35% Cooldown Reduction.', passive: [{ stat: 'cooldown_red', op: 'add', value: 35 }] },
  shielding: { name: 'SHIMMYFUL Shielding', desc: 'Start of fight: shield for 10% of HP. Each round at MAX HP, gain another. Stacks infinitely.', passive: [], situational: [{ id: 'shield-stack', label: 'Per shield stack (vs HP)', desc: 'Each stack = 10% HP as shield.', passive: [] }] },
  saving: { name: 'SHIMMYFUL Saving Habits', desc: 'Shops are 40% cheaper. Sell items for 25% more.', passive: [] },
  voided: { name: 'SHIMMYFUL Voided', desc: '15% chance on hit to spawn black holes that pull ALL nearby enemies and deal bonus True Damage.', passive: [] },
  legday: { name: 'SHIMMYFUL Leg Day', desc: 'MASSIVE thighs. +35% SPD, +35% Dexterity.', passive: [{ stat: 'spd', op: 'pct', value: 35 }, { stat: 'dexterity', op: 'add', value: 35 }] },
  shrinkray: { name: 'SHIMMYFUL Shrink Ray', desc: 'Damage shrinks enemies to 25% size, reducing their DEF by 15% AND ATK by 15%.', passive: [] },
  vital: { name: 'SHIMMYFUL Vital', desc: '+35% HP.', passive: [{ stat: 'hp', op: 'pct', value: 35 }] },
  swiftstrike: { name: 'SHIMMYFUL Swiftstrike', desc: '+35% SPD, +25% Crit Chance.', passive: [{ stat: 'spd', op: 'pct', value: 35 }, { stat: 'crit_rate', op: 'add', value: 25 }] },
  spellweaver: { name: 'SHIMMYFUL Spellweaver', desc: '+35% MAG, +25% Cooldown Reduction.', passive: [{ stat: 'mag', op: 'pct', value: 35 }, { stat: 'cooldown_red', op: 'add', value: 25 }] },
  lifeline: { name: 'SHIMMYFUL Lifeline', desc: '+25% Lifesteal, +25% Heal Power.', passive: [{ stat: 'lifesteal', op: 'add', value: 25 }, { stat: 'heal_pow', op: 'add', value: 25 }] },
  weakpoint: { name: 'SHIMMYFUL Weakpoint', desc: '+25% True Damage, +25% Crit Chance.', passive: [{ stat: 'true_dmg', op: 'add', value: 25 }, { stat: 'crit_rate', op: 'add', value: 25 }] },
  berserker: { name: 'SHIMMYFUL Berserker', desc: '+45% ATK. DEF penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 45 }] },
  bulwark: { name: 'SHIMMYFUL Bulwark', desc: '+40% DEF. ATK penalty removed.', passive: [{ stat: 'def', op: 'pct', value: 40 }] },
  overdrive: { name: 'SHIMMYFUL Overdrive', desc: '+40% ATK. HP penalty removed.', passive: [{ stat: 'atk', op: 'pct', value: 40 }] },
  solo: { name: 'SHIMMYFUL Solo', desc: '+40% all stats when fighting without allies.', passive: [], situational: [{ id: 'solo-alone', label: 'Fighting alone (no allies)', passive: [{ stat: 'all_main', op: 'pct', value: 40 }] }] },
  packhunter: { name: 'SHIMMYFUL Pack Hunter', desc: '+15% ATK per ally in the fight (up to +45%).', passive: [], situational: [{ id: 'pack-1', label: '1 ally in fight (+15% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }, { id: 'pack-2', label: '2 allies in fight (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'pack-3', label: '3+ allies in fight (+45% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 45 }] }] },
  laststand: { name: 'SHIMMYFUL Last Stand', desc: 'At ≤25% HP: +45% ATK, +45% DEF, +30% SPD.', passive: [], situational: [{ id: 'ls-low', label: 'Currently at ≤25% HP', passive: [{ stat: 'atk', op: 'pct', value: 45 }, { stat: 'def', op: 'pct', value: 45 }, { stat: 'spd', op: 'pct', value: 30 }] }] },
  opportunist: { name: 'SHIMMYFUL Opportunist', desc: '+40% ATK and +20% True Damage vs enemies that are stunned, slowed, or poisoned.', passive: [], situational: [{ id: 'opp-cc', label: 'Enemy is stunned, slowed, or poisoned', passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'true_dmg', op: 'add', value: 20 }] }] },
  momentum: { name: 'SHIMMYFUL Momentum', desc: 'Each consecutive hit without taking damage: +10% ATK. Stacks up to 5x.', passive: [], situational: [{ id: 'mom-1', label: '1 hit streak (+10% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'mom-3', label: '3 hit streak (+30% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }, { id: 'mom-5', label: '5+ hit streak (+50% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }] },
  adrenaline: { name: 'SHIMMYFUL Adrenaline', desc: 'Taking damage grants +25% ATK and +15% SPD for 3 turns.', passive: [], situational: [{ id: 'adren-hit', label: 'Just took damage (+25% ATK, +15% SPD for 3 turns)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 15 }] }] },
  secondwind: { name: 'SHIMMYFUL Second Wind', desc: 'Survive two killing blows per fight, reviving at 30% HP each time.', passive: [] },
  mending: { name: 'SHIMMYFUL Mending', desc: '+35% Heal Power. Your heals restore 10% HP to yourself.', passive: [{ stat: 'heal_pow', op: 'add', value: 35 }] },
  fortify: { name: 'SHIMMYFUL Fortify', desc: 'After taking 2 hits in a row, gain +30% DEF and +15% ATK.', passive: [], situational: [{ id: 'fort-2hit', label: 'Took 2 hits in a row (+30% DEF, +15% ATK)', passive: [{ stat: 'def', op: 'pct', value: 30 }, { stat: 'atk', op: 'pct', value: 15 }] }] },
  evasion: { name: 'SHIMMYFUL Evasion', desc: '+45% Dexterity.', passive: [{ stat: 'dexterity', op: 'add', value: 45 }] },
  warcry: { name: 'SHIMMYFUL Warcry', desc: 'Once per fight, give all allies +30% ATK and +20% DEF for 3 turns.', passive: [] },
  bubbly: { name: 'SHIMMYFUL Bubbly', desc: '75% chance on hit to encase enemy in a bubble. Bubble explodes on break, dealing ATK × 0.5 as True Damage.', passive: [] },
  moonstonemending: { name: 'SHIMMYFUL Moonstone Mending', desc: 'Passively heal the two most-injured allies for 10% max HP whenever any ally takes damage. Triggers twice per turn.', passive: [] },
  eyeofthestorm: { name: 'SHIMMYFUL Eye of the Storm', desc: 'Shield one ally for 35% max HP. While the shield holds, they gain +40% ATK and +20% MAG.', passive: [] },
  warmhugs: { name: 'SHIMMYFUL Warm Hugs', desc: 'At the start of each turn, ALL allies receive a shield worth 12% of their max HP.', passive: [] },
  ardentcenser: { name: 'SHIMMYFUL Ardent Censer', desc: 'Whenever you heal or shield an ally, they gain +40% ATK, +30% SPD, and +20% MAG for 2 turns.', passive: [], situational: [{ id: 'ac-shimmy', label: 'Ally buffed by SHIMMYFUL Ardent Censer', passive: [{ stat: 'atk', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 30 }, { stat: 'mag', op: 'pct', value: 20 }] }] },
  pixswatch: { name: "SHIMMYFUL Pix's Watch", desc: "Shield one ally for 20% HP. Pix deals 8% MAG damage to every attacker and heals the shielded ally for 5% HP per hit taken.", passive: [] },
  rewind: { name: 'SHIMMYFUL Rewind', desc: 'Every 2 turns, reduce all your ability cooldowns by 2 turns.', passive: [{ stat: 'cooldown_red', op: 'add', value: 15 }] },
  timewarp: { name: 'SHIMMYFUL Time Warp', desc: 'Grant ALL allies +80% SPD for 2 turns, OR slow ALL enemies by 80% SPD for 2 turns. Choose each use.', passive: [] },
  tidecallersblessing: { name: "SHIMMYFUL Tidecaller's Blessing", desc: 'Empower one ally: their next 5 attacks each slow the target by 40% SPD and deal bonus magic damage (+30% MAG).', passive: [] },
  focusedresolve: { name: 'SHIMMYFUL Focused Resolve', desc: 'Tether to one enemy for 3 turns. They cannot flee. If the tether holds the full duration: root them for 2 turns and heal yourself for 40% HP.', passive: [] },
  mikaelscleanse: { name: "SHIMMYFUL Mikael's Cleanse", desc: 'Once per battle: remove all crowd control and status effects from ALL allies and heal each of them for 30% HP.', passive: [] },
  zekesconvergence: { name: "SHIMMYFUL Zeke's Convergence", desc: 'Bind to one ally. Enemies who attack them are slowed 50% SPD, take +30% increased damage from all sources, and you gain +20% DEF for 2 turns per hit they absorb.', passive: [{ stat: 'def', op: 'pct', value: 20 }] },
  // LoL-inspired rares
  voracity: { name: 'SHIMMYFUL Voracity', desc: 'On kill or assist: reduce all cooldowns by 4 turns and gain +15% ATK for 1 turn.', passive: [{ stat: 'cooldown_red', op: 'add', value: 15 }], situational: [{ id: 'vor-s', label: 'Post-kill turn (+15% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }] },
  hemorrhage: { name: 'SHIMMYFUL Hemorrhage', desc: 'Bleed stacks up to 8. Each stack adds +8 ATK as bleeding damage. At 8 stacks, the target is rooted for 1 turn and slowed for 2 more.', passive: [], notes: 'Bleed stacks to 8. Root at full stacks.' },
  nighthunter: { name: 'SHIMMYFUL Night Hunter', desc: 'Gain +30 SPD and +20% Dexterity when pursuing a visible enemy.', passive: [{ stat: 'spd', op: 'add', value: 20 }, { stat: 'dexterity', op: 'add', value: 20 }] },
  doublestrike: { name: 'SHIMMYFUL Double Strike', desc: 'Every 5th attack on the same target strikes FOUR times instantly.', passive: [], notes: 'Every 5th consecutive hit on same target = quadruple hit.' },
  flurry: { name: 'SHIMMYFUL Flurry', desc: 'After casting a skill, the next 3 attacks deal +40% damage and cost no cooldown.', passive: [], notes: '+40% bonus on the 3 attacks immediately after a skill.' },
  martialcadence: { name: 'SHIMMYFUL Martial Cadence', desc: 'First attack on any new target deals bonus damage equal to 15% of their current HP.', passive: [], notes: '15% current HP bonus on first hit per new target.' },
  spikedshell: { name: 'SHIMMYFUL Spiked Shell', desc: '25% of total DEF is added to ATK.', passive: [{ stat: 'atk', op: 'pct', value: 20 }], notes: 'Higher DEF-to-ATK conversion.' },
  eternalhunger: { name: 'SHIMMYFUL Eternal Hunger', desc: 'Lifesteal scales with missing HP. At 50% HP: +20% lifesteal. At 10% HP: +55% lifesteal.', passive: [{ stat: 'lifesteal', op: 'add', value: 20 }], situational: [{ id: 'eh-s-half', label: 'At 50% HP missing (+20% lifesteal)', passive: [{ stat: 'lifesteal', op: 'add', value: 20 }] }, { id: 'eh-s-low', label: 'At 10% HP missing (+55% lifesteal)', passive: [{ stat: 'lifesteal', op: 'add', value: 55 }] }] },
  fleetoffoot: { name: 'SHIMMYFUL Fleet of Foot', desc: 'Gain +25 SPD for 2 turns after a skill hits a target.', passive: [{ stat: 'spd', op: 'add', value: 18 }] },
  livingvengeance: { name: 'SHIMMYFUL Living Vengeance', desc: 'On kill: +40 ATK for 3 turns. On elite kill: +70 ATK for 3 turns.', passive: [], situational: [{ id: 'lv-s-kill', label: 'On kill (+40 ATK, 3 turns)', passive: [{ stat: 'atk', op: 'add', value: 40 }] }, { id: 'lv-s-elite', label: 'On elite kill (+70 ATK, 3 turns)', passive: [{ stat: 'atk', op: 'add', value: 70 }] }] },
  lovetap: { name: 'SHIMMYFUL Love Tap', desc: 'Attacks against a target not hit last turn deal +40% bonus damage.', passive: [], notes: '+40% damage on first contact with a target each turn cycle.' },
  clockworkwindup: { name: 'SHIMMYFUL Clockwork Windup', desc: 'Consecutive attacks on the same target deal +8% damage per hit (max +40% at 5 hits).', passive: [], situational: [{ id: 'cw-s-max', label: 'At 5 consecutive hits (+40% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 40 }] }] },
  voidstone: { name: 'SHIMMYFUL Void Stone', desc: 'Reduce all magic damage taken by 35%. Absorbed magic damage charges your next magical hit for +20% MAG bonus damage.', passive: [{ stat: 'status_res', op: 'add', value: 25 }], notes: '-35% magic damage taken. Charge mechanic on magic hits.' },
  guerrillawarfare: { name: 'SHIMMYFUL Guerrilla Warfare', desc: 'Standing still for 1 turn renders you invisible. First attack from stealth deals +80% damage.', passive: [], notes: 'Stealth on idle turn. +80% on break-stealth attack.' },
  mortalwill: { name: 'SHIMMYFUL Mortal Will', desc: 'Build charges (max 5). At 5 charges, the next ability gains +60% damage and two bonus effects.', passive: [], notes: '5-charge system. Empowered next ability at full stacks.' },
  triumphantroar: { name: 'SHIMMYFUL Triumphant Roar', desc: 'When any nearby unit dies, restore 12% max HP and gain +10 ATK for 1 turn.', passive: [{ stat: 'heal_pow', op: 'add', value: 15 }], situational: [{ id: 'tr-s', label: 'Post-death turn (+10 ATK)', passive: [{ stat: 'atk', op: 'add', value: 10 }] }] },
  deadlyvenom: { name: 'SHIMMYFUL Deadly Venom', desc: 'Attacks apply stacking poison (max 8 stacks). Each stack deals 4 true damage per turn.', passive: [{ stat: 'true_dmg', op: 'add', value: 12 }], notes: 'Stacking poison: 4 true damage per turn per stack (max 8).' },
  salvation: { name: 'SHIMMYFUL Salvation', desc: 'Gain +40 SPD when rushing toward an ally below 30% HP. Also grant that ally a shield worth 10% of their max HP.', passive: [{ stat: 'spd', op: 'add', value: 15 }], notes: '+40 SPD + ally shield when rushing to low-HP ally.' },
  blaze: { name: 'SHIMMYFUL Blaze', desc: 'Skills ignite targets: deal 8% of their max HP as magic damage over 2 turns. Double ignite stacks trigger an explosion at 25% of their max HP.', passive: [], notes: 'Stronger DoT. Double-stack explosion at 25% max HP.' },
  hailofblades:  { name: 'SHIMMYFUL Hail of Blades', desc: 'Gain +80% ATK speed on the first 5 attacks of any combat encounter.', passive: [], notes: 'Burst ATK speed boost extended to first 5 attacks per combat.' },
  gamblersruin:  { name: "SHIMMYFUL Gambler's Ruin", desc: 'Before each action, secretly roll a die. On an even result: +75% ATK and MAG for that action. On an odd result: only +25% damage taken for that action.', passive: [], situational: [{ id: 'gr-s-lucky', label: 'Lucky Roll (even) — +75% ATK & MAG', passive: [{ stat: 'atk', op: 'pct', value: 75 }, { stat: 'mag', op: 'pct', value: 75 }] }, { id: 'gr-s-unlucky', label: 'Unlucky Roll (odd) — +25% damage taken (−25% DEF)', passive: [{ stat: 'def', op: 'pct', value: -25 }] }] },
  bloodylust:    { name: 'SHIMMYFUL Bloody Lust', desc: 'Each hit you land stacks +8 ATK for the rest of that battle. Stacks carry over to the next battle if you win.', passive: [], situational: [{ id: 'bl-s-5', label: '5 hits landed (+40 ATK)', passive: [{ stat: 'atk', op: 'add', value: 40 }] }, { id: 'bl-s-10', label: '10 hits landed (+80 ATK)', passive: [{ stat: 'atk', op: 'add', value: 80 }] }, { id: 'bl-s-20', label: '20 hits landed (+160 ATK)', passive: [{ stat: 'atk', op: 'add', value: 160 }] }] },
  holymantle:    { name: 'SHIMMYFUL Holy Mantle', desc: 'The first 2 hits that would damage you per battle are completely nullified. Both are automatic.', passive: [], notes: 'Two separate damage-nullification charges per battle. Both reset at battle start.' },
  bust:          { name: 'SHIMMYFUL Bust', desc: 'Every time you hit, roll a d6. On a 1: your ATK is only halved for that turn instead of zeroed. On a 6: deal the hit twice AND gain +20% ATK for 1 turn.', passive: [], situational: [{ id: 'bust-s-1', label: 'Rolled a 1 — ATK halved this turn', passive: [{ stat: 'atk', op: 'pct', value: -50 }] }, { id: 'bust-s-6', label: 'Rolled a 6 — hit twice + +20% ATK this turn', passive: [{ stat: 'atk', op: 'pct', value: 20 }] }], notes: 'Roll d6 on each hit. 1 = ATK halved for 1 turn. 6 = hit twice + 20% ATK bonus.' },
  snakeeyes:     { name: 'SHIMMYFUL Snake Eyes', desc: '+50% ATK. Each attack, roll a d6. Rolling a 1 triggers a fumble: you miss and take only 2% max HP damage. Rolling a 6: deal the hit twice.', passive: [{ stat: 'atk', op: 'pct', value: 50 }], notes: 'Roll d6 each attack. 1 = fumble (miss + 2% max HP). 6 = hit twice. +50% ATK always active.' },
};

// ============================================================
// SHIMMYFUL LEGENDARIES — 5% chance per legendary roll
// Gold/amber ring. Deeper reveal sound (rate 0.72).
// Excludes the 9 legendaries that already have hexxed variants.
// ============================================================
const SHIMMYFUL_LEGENDARY_TRAITS = {
  rct: { name: 'SHIMMYFUL RCT', desc: 'No HP penalty. Each turn, heal 1.5% HP per 5 MAG (cap 35%).', passive: [] },
  gluttonous: { name: 'SHIMMYFUL Gluttonous', desc: '+35% CDR. +8% ATK & +8% DEF per 10% CDR.', passive: [{ stat: 'cooldown_red', op: 'add', value: 35 }, { op: 'derived', stat: 'atk', from: 'cooldown_red', per: 10, perPct: 8 }, { op: 'derived', stat: 'def', from: 'cooldown_red', per: 10, perPct: 8 }] },
  celestial: { name: 'SHIMMYFUL Celestial Body', desc: '+75% HP, +75% DEF. Channels cosmic energy: +2 ATK per 50 HP (cap +400 ATK).', passive: [{ stat: 'hp', op: 'pct', value: 75 }, { stat: 'def', op: 'pct', value: 75 }, { op: 'derived', stat: 'atk', from: 'hp', per: 50, perValue: 2, cap: 400 }] },
  circle: { name: 'SHIMMYFUL Circle of Death', desc: 'Damage enemies when you heal. +8% Heal Power per 50 ATK.', passive: [{ op: 'derived', stat: 'heal_pow', from: 'atk', per: 50, perValue: 8 }] },
  bigbrain: { name: 'SHIMMYFUL Big Brain', desc: 'Start of fight: shield worth 100% of MAG. Refreshes each round at 25% of MAG.', passive: [] },
  allin: { name: 'SHIMMYFUL All In', desc: 'ATK x2.5, MAG x2.5. DEF penalty completely removed.', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'mag', op: 'pct', value: 150 }] },
  thornwall: { name: 'SHIMMYFUL Thornwall', desc: 'Reflect 60% of all damage taken back as True Damage. Also reduces damage taken by 10%.', passive: [] },
  apex_pred: { name: 'SHIMMYFUL Apex Predator', desc: '+25% ATK and +18% True DMG per enemy. DEF penalty per ally removed.', passive: [], situational: [{ id: 'ap-1', label: '1 enemy (+25% ATK, +18% True DMG)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'true_dmg', op: 'add', value: 18 }] }, { id: 'ap-3', label: '3 enemies (+75% ATK, +54% True DMG)', passive: [{ stat: 'atk', op: 'pct', value: 75 }, { stat: 'true_dmg', op: 'add', value: 54 }] }] },
  ironvow: { name: 'SHIMMYFUL Iron Vow', desc: 'Sacrifice one main stat (set to 1). All other main stats gain +65%.', passive: [] },
  soulforge: { name: 'SHIMMYFUL Soul Forge', desc: 'Sacrifice only 100 HP (floor: 1 HP) per stack. Each stack grants +90% MAG.', passive: [], cultivation: { label: 'HP Sacrifices Made', perStack: { stat: 'mag', op: 'pct', value: 90 }, defaultStacks: 0, maxStacks: 20 } },
  final_stand: { name: 'SHIMMYFUL Final Stand', desc: 'When HP drops below 25%, ALL stats quadruple. Once per fight.', passive: [], situational: [{ id: 'fs-active', label: 'Below 25% HP -- Final Stand active', passive: [{ stat: 'atk', op: 'pct', value: 300 }, { stat: 'def', op: 'pct', value: 300 }, { stat: 'mag', op: 'pct', value: 300 }, { stat: 'spd', op: 'pct', value: 300 }] }] },
  thousandcuts: { name: 'SHIMMYFUL Thousand Cuts', desc: 'Every attack hits 8 times for 1/8 damage each. All on-hit effects apply to every single hit.', passive: [] },
  eternal_flame: { name: 'SHIMMYFUL Eternal Flame', desc: 'On death, revive twice at 25% HP. Stats are doubled for the rest of the fight (not just one round).', passive: [] },
  entropy: { name: 'SHIMMYFUL Entropy', desc: 'Each hit deals True Damage equal to 6% of the target\'s current HP. Bypasses all resistances.', passive: [] },
  phantom_step: { name: 'SHIMMYFUL Phantom Step', desc: '+65% SPD, +55% Dexterity. Negate one attack per round. Once per fight, negate a second.', passive: [{ stat: 'spd', op: 'pct', value: 65 }, { stat: 'dexterity', op: 'add', value: 55 }] },
  apex_hunger: { name: 'SHIMMYFUL Apex Hunger', desc: 'Every kill grants +5% ATK and +2% True DMG permanently for the campaign. Stacks forever.', passive: [], cultivation: { label: 'Enemies Slain', perStack: [{ stat: 'atk', op: 'pct', value: 5 }, { stat: 'true_dmg', op: 'add', value: 2 }], defaultStacks: 0, maxStacks: 999 } },
  reapers_mark: { name: "SHIMMYFUL Reaper's Mark", desc: 'Every 3rd attack auto-crits at triple your normal crit multiplier.', passive: [] },
  parasite: { name: 'SHIMMYFUL Parasite', desc: 'Each round, drain 25% of the target\'s ATK, MAG, AND SPD, adding each to yours until combat ends.', passive: [], situational: [{ id: 'par-1', label: 'After 1 round of draining', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'mag', op: 'pct', value: 25 }, { stat: 'spd', op: 'pct', value: 25 }] }] },
  forsaken: { name: 'SHIMMYFUL Forsaken', desc: 'Cannot receive ally heals. All self-healing is quintupled. +55% Lifesteal.', passive: [{ stat: 'lifesteal', op: 'add', value: 55 }] },
  twin_fangs: { name: 'SHIMMYFUL Twin Fangs', desc: 'Every attack hits 3 times (75%, 55%, 40% damage). All three hits can crit and apply on-hit effects.', passive: [] },
  condemned: { name: 'SHIMMYFUL Condemned', desc: '8 rounds before death. Until then, +80% to ALL stats. Timer can reset once per fight.', passive: [], situational: [{ id: 'cond-active', label: 'Condemned -- rounds 1 through 8', passive: [{ stat: 'atk', op: 'pct', value: 80 }, { stat: 'def', op: 'pct', value: 80 }, { stat: 'mag', op: 'pct', value: 80 }, { stat: 'spd', op: 'pct', value: 80 }, { stat: 'hp', op: 'pct', value: 80 }] }] },
  warpath: { name: 'SHIMMYFUL Warpath', desc: 'Each round, permanently gain +10% ATK and +10% SPD for the rest of that fight.', passive: [], situational: [{ id: 'wp-1', label: 'After round 1 (+10% ATK, +10% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 10 }, { stat: 'spd', op: 'pct', value: 10 }] }, { id: 'wp-3', label: 'After round 3 (+30% ATK, +30% SPD)', passive: [{ stat: 'atk', op: 'pct', value: 30 }, { stat: 'spd', op: 'pct', value: 30 }] }] },
  blood_frenzy: { name: 'SHIMMYFUL Blood Frenzy', desc: 'Each kill restores 40% HP and permanently stacks +15% ATK for the rest of the fight.', passive: [], situational: [{ id: 'bf-1', label: '1 kill (+15% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 15 }] }, { id: 'bf-3', label: '3 kills (+45% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 45 }] }] },
  voidborn: { name: 'SHIMMYFUL Voidborn', desc: '-10% HP. Full status immunity. Attacks ignore 45% of enemy DEF.', passive: [{ stat: 'hp', op: 'pct', value: -10 }, { stat: 'status_res', op: 'add', value: 100 }, { stat: 'true_dmg', op: 'add', value: 45 }] },
  martyr: { name: 'SHIMMYFUL Martyr', desc: 'Intercept any lethal ally hit. Survive at 10% HP. Gain +80% ATK and +80% DEF until combat ends.', passive: [], situational: [{ id: 'mart-active', label: 'Martyrdom triggered', passive: [{ stat: 'atk', op: 'pct', value: 80 }, { stat: 'def', op: 'pct', value: 80 }] }] },
  hex_eater: { name: 'SHIMMYFUL Hex Eater', desc: 'All debuffs convert to buffs. Those converted buffs are doubled in magnitude.', passive: [] },
  phantom_pain: { name: 'SHIMMYFUL Phantom Pain', desc: 'Whenever you take damage, deal 85% of that amount split across all enemies as True Damage.', passive: [] },
  ironclad: { name: 'SHIMMYFUL Ironclad', desc: 'Full displacement immunity. Every point of DEF also adds 0.6% ATK.', passive: [{ op: 'derived', stat: 'atk', from: 'def', per: 1, perPct: 0.6 }] },
  guillotine: { name: 'SHIMMYFUL Guillotine', desc: 'If an enemy is at or below 30% HP when you attack, the hit is automatically lethal.', passive: [] },
  doppelganger: { name: 'SHIMMYFUL Doppelganger', desc: 'A copy with 80% of your stats appears and fights for 5 rounds before collapsing.', passive: [] },
  sundering: { name: 'SHIMMYFUL Sundering', desc: 'Each hit permanently reduces target DEF by 7% for that fight. No cap.', passive: [] },
  necromancer: { name: 'SHIMMYFUL Necromancer', desc: 'The first 2 enemies you kill each fight rise as thralls with 75% of their stats.', passive: [] },
  debt_collector: { name: 'SHIMMYFUL Debt Collector', desc: 'Store all damage taken. Release it as TWO separate True Damage hits on any target(s).', passive: [] },
  black_hole: { name: 'SHIMMYFUL Black Hole', desc: 'Each round: all enemies -8% all stats, you +8% all stats. Both effects stack.', passive: [], situational: [{ id: 'bh-1', label: 'After round 1 (you +8% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 8 }] }, { id: 'bh-3', label: 'After round 3 (you +24% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 24 }] }, { id: 'bh-5', label: 'After round 5 (you +40% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 40 }] }] },
  thundergod: { name: 'SHIMMYFUL Thundergod', desc: 'Start of every round: deal True Damage equal to 50% of your ATK to ALL enemies simultaneously.', passive: [] },
  conqueror: { name: 'SHIMMYFUL Conqueror', desc: 'Every fight survived: +2% all main stats and +2 all substats. Stacks up to 100 victories.', passive: [], cultivation: { label: 'Victories', perStack: [{ stat: 'all_main', op: 'pct', value: 2 }, { stat: 'all_sub', op: 'add', value: 2 }], defaultStacks: 0, maxStacks: 100 } },
  soul_link: { name: 'SHIMMYFUL Soul Link', desc: 'Bond to one ally: share 80% of all buffs either receives. Split only 15% of all damage.', passive: [] },
  bloodrage: { name: 'SHIMMYFUL Bloodrage', desc: 'For every 10% max HP lost, gain +10% ATK. At 10% HP remaining: +90% ATK.', passive: [], situational: [{ id: 'br-10', label: 'Lost 10% HP (+10% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 10 }] }, { id: 'br-50', label: 'Lost 50% HP (+50% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 50 }] }, { id: 'br-90', label: 'Lost 90% HP (+90% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 90 }] }] },
  chrono_break: { name: 'SHIMMYFUL Chrono Break', desc: 'Undo the last round completely. Usable twice per fight.', passive: [] },
  cannibal: { name: 'SHIMMYFUL Cannibal', desc: 'Upon killing an enemy, gain 35% of their highest stat for the rest of that fight. Stacks per kill.', passive: [], situational: [{ id: 'can-1', label: '1 kill (+35% of target\'s top stat)', desc: 'Calculate from the defeated enemy\'s highest stat.', passive: [] }, { id: 'can-3', label: '3 kills (35% per kill, stacking)', desc: 'Each kill uses that enemy\'s own highest stat.', passive: [] }] },
  bulwark_aura: { name: 'SHIMMYFUL Bulwark Aura', desc: 'All allies gain +35% DEF, +25% Status Res. You also personally gain +20% DEF.', passive: [{ stat: 'def', op: 'pct', value: 20 }] },
  war_priest: { name: 'SHIMMYFUL War Priest', desc: 'Each ally you heal gains +20% ATK and +15% HP for that fight. Stacks per heal.', passive: [] },
  vanguard: { name: 'SHIMMYFUL Vanguard', desc: '+50% DEF. Redirect 25% of all ally damage to yourself. You take -20% of that redirected damage.', passive: [{ stat: 'def', op: 'pct', value: 50 }] },
  last_rites: { name: 'SHIMMYFUL Last Rites', desc: 'Knocked-out allies revive at 60% HP. Usable twice per ally per fight.', passive: [] },
  resonance: { name: 'SHIMMYFUL Resonance', desc: 'Your top two stats are each mirrored to every ally at 50% of their value as a flat bonus.', passive: [] },
  mentor: { name: 'SHIMMYFUL Mentor', desc: 'Each party win, choose one ally: they permanently gain +4% in their top two stats.', passive: [] },
  self_sacrifice: { name: 'SHIMMYFUL Sacrifice', desc: 'Sacrifice yourself to fully restore one ally\'s HP and grant them +80% all stats for that fight.', passive: [] },
  bodyguard: { name: 'SHIMMYFUL Bodyguard', desc: 'Allies cannot be one-shot. Designated ally gains +80% DEF AND +30% ATK.', passive: [] },
  rallying_cry: { name: 'SHIMMYFUL Rallying Cry', desc: 'Any hit exceeding 20% of your max HP triggers +40% ATK for all allies that round.', passive: [] },
  hexbinder: { name: 'SHIMMYFUL Hexbinder', desc: 'On hit, apply two random debuffs (-25% each). Both persist until the fight ends.', passive: [] },
  disruptor: { name: 'SHIMMYFUL Disruptor', desc: 'Enemies targeting your allies suffer -40% ATK AND -25% SPD.', passive: [] },
  nemesis: { name: 'SHIMMYFUL Nemesis', desc: 'Deal x3 damage to your Nemesis. Defeating them grants x1.5 to x3 to ALL stats permanently.', passive: [] },
  lonewolf: { name: 'SHIMMYFUL Lone Wolf', desc: 'Solo: x2.25 to ATK, DEF, MAG, and SPD. In a party: only -25% all stats (not x0.5).', passive: [], situational: [{ id: 'lw-solo', label: 'Fighting alone (x2.25 ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'mul', value: 2.25 }, { stat: 'def', op: 'mul', value: 2.25 }, { stat: 'mag', op: 'mul', value: 2.25 }, { stat: 'spd', op: 'mul', value: 2.25 }] }, { id: 'lw-party', label: 'In a party (-25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: -25 }] }] },
  catastrophe: { name: 'SHIMMYFUL Catastrophe', desc: 'Every round, ALL combatants take your full ATK x1.5 as True Damage. Cannot be reduced.', passive: [] },
  life_support: { name: 'SHIMMYFUL Life Support', desc: 'Revive allies at cost of 30% current HP (cannot kill you). Each revive grants +40% DEF and +40% SPD.', passive: [], cultivation: { label: 'Allies Revived', perStack: [{ stat: 'def', op: 'pct', value: 40 }, { stat: 'spd', op: 'pct', value: 40 }], defaultStacks: 0, maxStacks: 10 } },
  schism: { name: 'SHIMMYFUL Schism', desc: '+3 ATK per 1% Heal Power you have.', passive: [{ op: 'derived', stat: 'atk', from: 'heal_pow', per: 1, perValue: 3 }] },
  find_your_spark: { name: 'SHIMMYFUL Find Your Spark', desc: '+2 DEF per 1 SPD. +4 HP per 1 Dexterity.', passive: [{ op: 'derived', stat: 'def', from: 'spd', per: 1, perValue: 2 }, { op: 'derived', stat: 'hp', from: 'dexterity', per: 1, perValue: 4 }] },
  wildgrowth: { name: 'SHIMMYFUL Wild Growth', desc: 'Usable twice per battle: instantly enlarge one ally. They gain +500 HP, knock back all nearby enemies, and gain +30% ATK for 2 turns.', passive: [] },
  wish: { name: 'SHIMMYFUL Wish', desc: 'Once per battle: heal ALL allies to full HP, remove all debuffs from each, and grant them +20% all main stats for 2 turns.', passive: [], situational: [{ id: 'wish-shimmy', label: 'SHIMMYFUL Wish buff active (+20% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 20 }] }] },
  crescendo: { name: 'SHIMMYFUL Crescendo', desc: 'Once per battle: stun all enemies for 2 turns, restore 30% HP to all allies, then grant all allies +20% ATK for 2 turns after the stun.', passive: [] },
  monsoon: { name: 'SHIMMYFUL Monsoon', desc: 'Once per battle: knock back all enemies and heal all allies for 30% HP per turn for 4 turns. Also grants all allies +20% DEF for the duration.', passive: [] },
  bailout: { name: 'SHIMMYFUL Bailout', desc: 'Usable twice per battle: grant an ally a second chance. If they die within 3 turns, they revive at 80% HP and go berserk (+150% ATK) for 2 turns.', passive: [] },
  hostiletakeover: { name: 'SHIMMYFUL Hostile Takeover', desc: 'Once per battle: one enemy goes berserk for 2 turns attacking their own allies. Additionally drain 20% of their highest stat and add it to yours until combat ends.', passive: [] },
  tidalwave: { name: 'SHIMMYFUL Tidal Wave', desc: 'Once per battle: knock up all enemies for 1 turn. Upon landing they are slowed 80% SPD, lose 80% DEX, and 30% DEF for 2 turns.', passive: [] },
  // LoL-inspired legendaries
  duelistsdance: { name: "SHIMMYFUL Duelist's Dance", desc: 'Vital Points heal 10% HP, grant +40 SPD, and deal +100% bonus damage each. All 4 Vitals refresh after being hit.', passive: [], notes: 'Enhanced Vital cycle. Higher heal, SPD, and bonus damage.' },
  damnation: { name: 'SHIMMYFUL Damnation', desc: 'Every enemy killed drops a Soul. Gain +5 ATK and +5 DEF per soul. No cap.', passive: [], cultivation: { label: 'Souls Collected', perStack: [{ stat: 'atk', op: 'add', value: 5 }, { stat: 'def', op: 'add', value: 5 }], defaultStacks: 0, maxStacks: 999 }, notes: 'Permanent soul-stack: +5 ATK and +5 DEF per kill.' },
  kindredmark: { name: 'SHIMMYFUL Mark of the Kindred', desc: 'Each hunted enemy defeated permanently grants +25 to all stats. Marks renew each combat.', passive: [], cultivation: { label: 'Hunted Kills', perStack: [{ stat: 'all_main', op: 'add', value: 25 }], defaultStacks: 0, maxStacks: 999 }, notes: '+25 all stats per marked kill. Permanent.' },
  crimsonpact: { name: 'SHIMMYFUL Crimson Pact', desc: 'Every 20 HP = +1 MAG. Every 8 MAG = +15 HP. Both stats scale off each other more aggressively.', passive: [{ op: 'derived', stat: 'mag', from: 'hp', per: 20, perValue: 1 }, { op: 'derived', stat: 'hp', from: 'mag', per: 8, perValue: 15 }], notes: 'Tighter HP/MAG conversion loop. Stats update whenever either is gained.' },
  mirageform: { name: 'SHIMMYFUL Mirage Form', desc: 'On dropping below 25% HP, spawn a combat-capable decoy with 80% of your stats for 5 turns.', passive: [], notes: 'Decoy with 80% stats, lasts 5 turns, draws aggro.' },
  wayofwanderer: { name: 'SHIMMYFUL Way of the Wanderer', desc: 'Flow builds faster. At full Flow, gain a shield equal to 25% max HP. All crits deal 300% damage regardless of source.', passive: [{ stat: 'crit_dmg', op: 'add', value: 200 }], notes: 'No normal crits. Faster Flow. 300% crit damage.' },
  ionianfervor: { name: 'SHIMMYFUL Ionian Fervor', desc: 'Multi-hit: up to -30% damage taken (vs 3+ enemies). Single target: +7% ATK per stack (max 6 stacks).', passive: [], situational: [{ id: 'if-s-multi', label: 'Hitting 3+ enemies (-30% damage taken)', passive: [{ stat: 'def', op: 'pct', value: 30 }] }, { id: 'if-s-single', label: 'At 6 single-target stacks (+42% ATK)', passive: [{ stat: 'atk', op: 'pct', value: 42 }] }] },
  unseenpredator: { name: 'SHIMMYFUL Unseen Predator', desc: 'Stealth/backstab grants +8 ATK and +5 SPD per Trophy stack. Permanent, max 15 stacks.', passive: [], situational: [{ id: 'up-s-max', label: 'At max Trophies (15 stacks)', passive: [{ stat: 'atk', op: 'add', value: 120 }, { stat: 'spd', op: 'add', value: 75 }] }] },
  contemptweak: { name: 'SHIMMYFUL Contempt for the Weak', desc: 'Attacks against enemies below 50% HP deal bonus true damage equal to 10% of their max HP.', passive: [{ stat: 'true_dmg', op: 'add', value: 10 }], notes: '10% max HP true damage bonus on sub-50% targets.' },
  deathbydegrees: { name: 'SHIMMYFUL Death by Degrees', desc: 'Attacks deal bonus damage equal to 3% of the target\'s max HP and heal you for that full amount.', passive: [{ stat: 'lifesteal', op: 'add', value: 10 }, { stat: 'true_dmg', op: 'add', value: 8 }], notes: '3% max HP damage per hit + full lifesteal from it.' },
  wayofhunter: { name: 'SHIMMYFUL Way of the Hunter', desc: 'Every other attack deals bonus magic damage equal to 120% of ATK.', passive: [{ stat: 'mag', op: 'pct', value: 55 }], notes: 'Alternating physical/120% ATK magic on every other attack.' },
  darkinrebirth: { name: 'SHIMMYFUL Darkin Rebirth', desc: 'On death, channel briefly then revive at 60% HP with +100% ATK for 3 turns. Once per encounter.', passive: [], situational: [{ id: 'dr-s', label: 'Post-revive (+100% ATK for 3 turns)', passive: [{ stat: 'atk', op: 'pct', value: 100 }] }] },
  shatteredtime: { name: 'SHIMMYFUL Shattered Time', desc: 'Each skill use reduces all cooldowns by 4 turns and grants +30 SPD.', passive: [{ stat: 'cooldown_red', op: 'add', value: 25 }, { stat: 'spd', op: 'add', value: 15 }] },
  livingforge: { name: 'SHIMMYFUL Living Forge', desc: 'Can upgrade TWO items mid-combat. All attacks apply Brittle; Brittle targets take +50% crit damage.', passive: [], notes: 'Upgrade two items. Brittle on all attacks grants +50% crit damage.' },
  undyinggrasp:  { name: 'SHIMMYFUL Undying Grasp', desc: 'When you would be killed: enter Stasis for 2 turns then revive at 40% HP. Usable TWICE per combat.', passive: [], notes: 'Two-use death prevention. 2-turn Stasis + revive at 40% HP.' },
  deadmanshand:  { name: "SHIMMYFUL Dead Man's Hand", desc: 'Start each battle with 5 cards (random stat modifiers, positive and negative). All 5 are revealed at battle start. You choose the order you activate them, one per turn.', passive: [], notes: 'Same 5-card system, but fully revealed upfront. Player chooses activation order.' },
  symbiote:      { name: 'SHIMMYFUL Symbiote', desc: 'Bond with one ally at battle start. You both gain +50% HP and share a single HP pool. Your bonded ally also gains +15% to all main stats.', passive: [{ stat: 'hp', op: 'pct', value: 50 }], notes: 'Shared HP pool. Both gain +50% HP. Bonded ally gets +15% all main stats on top.' },
  goathead:      { name: 'SHIMMYFUL Goat Head', desc: 'At battle start: sacrifice only 15% of your max HP to access a Devil Deal. Choose from 2 revealed legendary or mythic traits that apply for this fight only.', passive: [], notes: 'Devil Deal: -15% HP to borrow one of 2 revealed legendary or mythic traits for that battle. Borrowed trait lost at battle end.' },
  devilsbargain: { name: "SHIMMYFUL Devil's Bargain", desc: 'Quadruple your ATK and MAG (x4). At the end of each battle, one random stat (not ATK or MAG) is permanently cut by only 7%.', passive: [{ stat: 'atk', op: 'mul', value: 4 }, { stat: 'mag', op: 'mul', value: 4 }], notes: 'After each battle: one stat cut by -7% permanently. Smaller penalty than base.' },
  russianroulette:{ name: 'SHIMMYFUL Russian Roulette', desc: 'All your main stats are +100%. 1-in-6 chance each turn to take 50% max HP as true damage. If you survive the turn you were shot, gain +30% ATK for 2 turns.', passive: [{ stat: 'all_main', op: 'pct', value: 100 }], situational: [{ id: 'rr-s-survived', label: 'Survived the shot — +30% ATK for 2 turns', passive: [{ stat: 'atk', op: 'pct', value: 30 }] }], notes: 'Roll d6 each turn. 1 = take 50% max HP true damage. Surviving grants +30% ATK for 2 turns. +100% all stats always.' },
  // Story/thematic legendaries
  emotionless:      { name: 'SHIMMYFUL Emotionless', desc: 'Your character loses the capability of having emotions, but all substats are tripled (x3).', passive: [{ stat: 'heal_pow', op: 'pct', value: 200 }, { stat: 'crit_rate', op: 'pct', value: 200 }, { stat: 'crit_dmg', op: 'pct', value: 200 }, { stat: 'status_res', op: 'pct', value: 200 }, { stat: 'dexterity', op: 'pct', value: 200 }, { stat: 'resilience', op: 'pct', value: 200 }, { stat: 'true_dmg', op: 'pct', value: 200 }, { stat: 'lifesteal', op: 'pct', value: 200 }, { stat: 'cooldown_red', op: 'pct', value: 200 }] },
  reinforcecrew:    { name: 'SHIMMYFUL What better time to reinforce our crew?', desc: 'When any ally drops to 50% HP, everyone in the party gains +75% DEF and two extra turns for one round.', passive: [], situational: [{ id: 'rc-s-trigger', label: 'Ally at 50% HP triggered (+75% DEF, 2 extra turns)', passive: [{ stat: 'def', op: 'pct', value: 75 }] }], notes: 'Toggle when triggered. Untoggle after the round ends.' },
  goodluckboys:     { name: 'SHIMMYFUL Good luck out there, boys', desc: 'When you drop below 75% HP, leave the fight. In return, the rest of your party has their turn count tripled for the remainder of the battle.', passive: [], notes: 'RP: below 75% HP, exit combat. Party receives tripled turns.' },
  holywar:          { name: 'SHIMMYFUL Holy War', desc: 'Quadruple your party\'s turn count when fighting a spirit. Triple them when fighting someone significantly stronger than you.', passive: [], situational: [{ id: 'hw-s-spirit', label: 'Fighting a spirit (party x4 turns)', passive: [] }, { id: 'hw-s-stronger', label: 'Fighting someone way stronger (party x3 turns)', passive: [] }], notes: 'RP: multiplied party turns. No self stat impact.' },
  wegotthenumbers:  { name: 'SHIMMYFUL We got the numbers!', desc: 'If your party outnumbers the enemies, all your substats are quintupled. If outnumbered, substats only drop by 25%.', passive: [], situational: [{ id: 'wgn-s-more', label: 'Outnumbering enemies (substats x5)', passive: [{ stat: 'heal_pow', op: 'pct', value: 400 }, { stat: 'crit_rate', op: 'pct', value: 400 }, { stat: 'crit_dmg', op: 'pct', value: 400 }, { stat: 'status_res', op: 'pct', value: 400 }, { stat: 'dexterity', op: 'pct', value: 400 }, { stat: 'resilience', op: 'pct', value: 400 }, { stat: 'true_dmg', op: 'pct', value: 400 }, { stat: 'lifesteal', op: 'pct', value: 400 }, { stat: 'cooldown_red', op: 'pct', value: 400 }] }, { id: 'wgn-s-less', label: 'Outnumbered by enemies (substats -25%)', passive: [{ stat: 'heal_pow', op: 'pct', value: -25 }, { stat: 'crit_rate', op: 'pct', value: -25 }, { stat: 'crit_dmg', op: 'pct', value: -25 }, { stat: 'status_res', op: 'pct', value: -25 }, { stat: 'dexterity', op: 'pct', value: -25 }, { stat: 'resilience', op: 'pct', value: -25 }, { stat: 'true_dmg', op: 'pct', value: -25 }, { stat: 'lifesteal', op: 'pct', value: -25 }, { stat: 'cooldown_red', op: 'pct', value: -25 }] }] },
  hailname:         { name: 'SHIMMYFUL Hail [NAME]', desc: 'Every time you defeat an enemy, you can recruit them by brainwashing them. Recruited characters fight for you but are permanently gone if defeated. Each recruited enemy also grants +5% all stats permanently.', passive: [], situational: [{ id: 'hn-s-1', label: '1 enemy recruited (+5% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 5 }] }, { id: 'hn-s-3', label: '3 enemies recruited (+15% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 15 }] }, { id: 'hn-s-5', label: '5 enemies recruited (+25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }], notes: 'RP mechanic. Each recruited enemy also grants +5% all stats. [NAME] replaced by character name.' },
  onlyatraitor:     { name: 'SHIMMYFUL Only a Traitor could consider making Peace', desc: 'You can no longer spare anyone. You may only kill. Upon receiving this trait, immediately roll 3 random extra legendary traits.', passive: [], notes: 'On pickup: auto-grants 3 random legendary traits. No sparing allowed (RP restriction).' },
  partypooper:      { name: 'SHIMMYFUL Party Pooper', desc: 'On-hit, apply SHIMMYFUL FRACTURED. FRACTURED nullifies all healing and does not expire until battle ends. Gain +15% Lifesteal and +15% Crit Chance per Fractured enemy.', passive: [], situational: [{ id: 'pp-s-1', label: '1 Fractured enemy (+15% Lifesteal, +15% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 15 }, { stat: 'crit_rate', op: 'add', value: 15 }] }, { id: 'pp-s-2', label: '2 Fractured enemies (+30% Lifesteal, +30% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 30 }, { stat: 'crit_rate', op: 'add', value: 30 }] }, { id: 'pp-s-3', label: '3 Fractured enemies (+45% Lifesteal, +45% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 45 }, { stat: 'crit_rate', op: 'add', value: 45 }] }, { id: 'pp-s-4', label: '4+ Fractured enemies (+60% Lifesteal, +60% Crit)', passive: [{ stat: 'lifesteal', op: 'add', value: 60 }, { stat: 'crit_rate', op: 'add', value: 60 }] }] },
  turningpoint:     { name: 'SHIMMYFUL Turning Point', desc: 'When dropping below 40% HP, gain x15 SPD and x15 DEX. This decreases by 20% each round (minimum x0.25). Gain an extra turn while the multiplier is above x4.', passive: [], situational: [{ id: 'tp-s-t1', label: 'Turn 1: x15 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 15 }, { stat: 'dexterity', op: 'mul', value: 15 }] }, { id: 'tp-s-t2', label: 'Turn 2: x12 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 12 }, { stat: 'dexterity', op: 'mul', value: 12 }] }, { id: 'tp-s-t3', label: 'Turn 3: x9.6 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 9.6 }, { stat: 'dexterity', op: 'mul', value: 9.6 }] }, { id: 'tp-s-t4', label: 'Turn 4: x7.68 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 7.68 }, { stat: 'dexterity', op: 'mul', value: 7.68 }] }, { id: 'tp-s-t5', label: 'Turn 5: x6.1 SPD and DEX (+ extra turn)', passive: [{ stat: 'spd', op: 'mul', value: 6.1 }, { stat: 'dexterity', op: 'mul', value: 6.1 }] }, { id: 'tp-s-fade', label: 'Faded (x0.25 SPD and DEX floor)', passive: [{ stat: 'spd', op: 'mul', value: 0.25 }, { stat: 'dexterity', op: 'mul', value: 0.25 }] }] },
  keepup:           { name: 'SHIMMYFUL KEEP UP', desc: 'Start with x3 SPD and x3 DEX. Every turn your SPD and DEX increase by x1.5. Enemies\' SPD and DEX increase by x1.4. +1 ATK per 10 SPD, +1 MAG per 2.5 DEX.', passive: [{ op: 'derived', stat: 'atk', from: 'spd', per: 10, perValue: 1 }, { op: 'derived', stat: 'mag', from: 'dexterity', per: 2.5, perValue: 1 }], situational: [{ id: 'ku-s-t1', label: 'Turn 1 (x3 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 3 }, { stat: 'dexterity', op: 'mul', value: 3 }] }, { id: 'ku-s-t2', label: 'Turn 2 (x4.5 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 4.5 }, { stat: 'dexterity', op: 'mul', value: 4.5 }] }, { id: 'ku-s-t3', label: 'Turn 3 (x6.75 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 6.75 }, { stat: 'dexterity', op: 'mul', value: 6.75 }] }, { id: 'ku-s-t4', label: 'Turn 4 (x10 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 10 }, { stat: 'dexterity', op: 'mul', value: 10 }] }, { id: 'ku-s-t5', label: 'Turn 5 (x15 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 15 }, { stat: 'dexterity', op: 'mul', value: 15 }] }, { id: 'ku-s-t6', label: 'Turn 6 (x22.5 SPD/DEX)', passive: [{ stat: 'spd', op: 'mul', value: 22.5 }, { stat: 'dexterity', op: 'mul', value: 22.5 }] }], notes: 'Toggle exactly one turn button at a time. ATK/MAG from SPD/DEX derived at double rate.' },
  wartrivial:       { name: 'SHIMMYFUL War, What a Trivial thing.', desc: 'Permanently gain +15 to all stats for every fight you leave early.', passive: [], situational: [{ id: 'wt-s-1', label: '1 fight left early (+15 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 15 }] }, { id: 'wt-s-3', label: '3 fights left (+45 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 45 }] }, { id: 'wt-s-5', label: '5 fights left (+75 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 75 }] }, { id: 'wt-s-10', label: '10 fights left (+150 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 150 }] }, { id: 'wt-s-20', label: '20 fights left (+300 all stats)', passive: [{ stat: 'all_main', op: 'add', value: 300 }] }] },
  perfectsoul:      { name: 'SHIMMYFUL I want a perfect soul.', desc: 'Absorb enemies\' souls if they are below 30% HP, gaining a larger portion of their stats. Each soul absorbed reduces your sanity.', passive: [], notes: 'Select a character and click ABSORB SOUL to permanently gain 55-90% of their stats (wider range than base).' },
  reekofdisease:    { name: 'SHIMMYFUL You reek of disease.', desc: 'If an enemy is below 55% HP, immediately apply 7 stacks of POISON on them, dealing -30% HP per turn until they are defeated.', passive: [], notes: 'Auto-apply 7 poison stacks to enemies below 55% HP. -30% HP per turn total.' },
  megalostrikeback: { name: 'SHIMMYFUL Megalo Strike Back', desc: 'If fighting the same enemy for the second time, gain +250% Crit Chance and +250% Crit Damage. Defeating that enemy permanently adds these bonuses to your stats.', passive: [], situational: [{ id: 'msb-s-2nd', label: 'Second fight vs this enemy (+250% Crit, +250% Crit DMG)', passive: [{ stat: 'crit_rate', op: 'pct', value: 250 }, { stat: 'crit_dmg', op: 'pct', value: 250 }] }, { id: 'msb-s-perm', label: 'Enemy defeated (permanent +250% Crit, +250% Crit DMG)', passive: [{ stat: 'crit_rate', op: 'pct', value: 250 }, { stat: 'crit_dmg', op: 'pct', value: 250 }] }] },
  engarde:          { name: 'SHIMMYFUL En garde!', desc: 'Pick one enemy and force them into a separate 1v1 arena. Neither can interact with other units. The arena lasts 5 rounds or until one is knocked out. The winner gains x2 ATK and SPD for the rest of the fight.', passive: [], situational: [{ id: 'eg-s-arena', label: 'In the arena (1v1 active)', passive: [] }, { id: 'eg-s-win', label: 'Won the arena (x2 ATK and SPD)', passive: [{ stat: 'atk', op: 'mul', value: 2 }, { stat: 'spd', op: 'mul', value: 2 }] }] },
  killingspree:     { name: 'SHIMMYFUL Killing Spree', desc: 'For every enemy killed this fight, permanently gain +8% SPD and +8% ATK. Losing a fight resets all stacks.', passive: [], situational: [{ id: 'ks-s-1', label: '1 kill (+8% SPD, +8% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 8 }, { stat: 'atk', op: 'pct', value: 8 }] }, { id: 'ks-s-3', label: '3 kills (+24% SPD, +24% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 24 }, { stat: 'atk', op: 'pct', value: 24 }] }, { id: 'ks-s-5', label: '5 kills (+40% SPD, +40% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 40 }, { stat: 'atk', op: 'pct', value: 40 }] }, { id: 'ks-s-10', label: '10 kills (+80% SPD, +80% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 80 }, { stat: 'atk', op: 'pct', value: 80 }] }, { id: 'ks-s-20', label: '20 kills (+160% SPD, +160% ATK)', passive: [{ stat: 'spd', op: 'pct', value: 160 }, { stat: 'atk', op: 'pct', value: 160 }] }] },
  armyofshurima:    { name: 'SHIMMYFUL The army of Shurima never dies', desc: 'At the start of every fight, summon 5 sand soldiers with 100 HP, 75 ATK, 20 DEF, 45 SPD and 45 MAG each. Fallen soldiers respawn once per fight.', passive: [], notes: 'Summons 5 sand soldiers at battle start. Enhanced stats vs base version. Each soldier respawns once.' },
  ialwayscomeback:  { name: 'SHIMMYFUL I always come back', desc: 'Every time you are defeated, permanently gain +35% to all base stats. The battle immediately after being defeated, all attacks deal 100% True Damage.', passive: [], situational: [{ id: 'iac-s-true', label: 'Battle after defeat (100% True Damage)', passive: [{ stat: 'true_dmg', op: 'add', value: 100 }] }, { id: 'iac-s-1', label: '1 defeat (+35% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 35 }] }, { id: 'iac-s-2', label: '2 defeats (+70% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 70 }] }, { id: 'iac-s-3', label: '3 defeats (+105% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 105 }] }, { id: 'iac-s-5', label: '5 defeats (+175% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 175 }] }] },
  thefinalact:      { name: 'SHIMMYFUL The final act', desc: 'If anyone drops below 5% HP, everyone is healed, all DEF drops to 0, and your ATK and MAG increase by x1.5 per unit currently in the battle.', passive: [], situational: [{ id: 'tfa-s-2u', label: 'Triggered, 2 units in battle (x2.25 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 2.25 }, { stat: 'mag', op: 'mul', value: 2.25 }] }, { id: 'tfa-s-4u', label: 'Triggered, 4 units in battle (x5.06 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 5.06 }, { stat: 'mag', op: 'mul', value: 5.06 }] }, { id: 'tfa-s-6u', label: 'Triggered, 6 units in battle (x11.39 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 11.39 }, { stat: 'mag', op: 'mul', value: 11.39 }] }, { id: 'tfa-s-8u', label: 'Triggered, 8 units in battle (x25.63 ATK/MAG)', passive: [{ stat: 'atk', op: 'mul', value: 25.63 }, { stat: 'mag', op: 'mul', value: 25.63 }] }] },
  truehero:         { name: 'SHIMMYFUL True Hero', desc: 'The more kills the enemy has, the higher your stats. Gain x1.07 to all main stats for every kill the target has to their name.', passive: [], situational: [{ id: 'th-s-5k', label: 'Enemy has 5 kills (x1.40 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 40 }] }, { id: 'th-s-10k', label: 'Enemy has 10 kills (x1.97 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 97 }] }, { id: 'th-s-20k', label: 'Enemy has 20 kills (x3.87 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 287 }] }, { id: 'th-s-50k', label: 'Enemy has 50 kills (x29.46 all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 2846 }] }] },
  breakunbreakable: { name: 'SHIMMYFUL Break the Unbreakable', desc: 'Ignore all enemy DEF. Deal additional damage proportional to how much DEF the enemy has. Each point of enemy DEF also adds +0.5% ATK to you for the fight.', passive: [], notes: 'Enemy DEF completely ignored. Bonus damage = enemy DEF value. +0.5% ATK per point of enemy DEF for that fight.' },
  itwasutile:       { name: 'SHIMMYFUL It was Futile', desc: 'If hit by an enemy whose ATK is equal to or lower than yours, you take zero damage. The attack simply does not land.', passive: [], notes: 'Immune to attacks from enemies with equal or lower ATK. RP-adjudicated.' },
  absoluteterritory:{ name: 'SHIMMYFUL Absolute Territory', desc: 'You are forced to wear thigh highs and a miniskirt. In exchange: x5 ATK, x5 DEF, x5 MAG and x5 Crit Chance.', passive: [{ stat: 'atk', op: 'mul', value: 5 }, { stat: 'def', op: 'mul', value: 5 }, { stat: 'mag', op: 'mul', value: 5 }, { stat: 'crit_rate', op: 'pct', value: 400 }] },
  ifeelmonster:     { name: 'SHIMMYFUL I feel like a Monster', desc: 'You can harm allies. For every ally you attack, gain +75% ATK and +75% MAG. Stacks per ally attacked.', passive: [], situational: [{ id: 'ifm-s-1a', label: '1 ally attacked (+75% ATK, +75% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 75 }, { stat: 'mag', op: 'pct', value: 75 }] }, { id: 'ifm-s-2a', label: '2 allies attacked (+150% ATK, +150% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 150 }, { stat: 'mag', op: 'pct', value: 150 }] }, { id: 'ifm-s-3a', label: '3 allies attacked (+225% ATK, +225% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 225 }, { stat: 'mag', op: 'pct', value: 225 }] }, { id: 'ifm-s-4a', label: '4+ allies attacked (+300% ATK, +300% MAG)', passive: [{ stat: 'atk', op: 'pct', value: 300 }, { stat: 'mag', op: 'pct', value: 300 }] }] },
  nothereyou:       { name: 'SHIMMYFUL I\'m not here for you', desc: 'Choose one ally. You can only heal them and yourself. Every time you heal that ally, gain +80% to all non-HP stats for 1 round.', passive: [], situational: [{ id: 'nhy-s-heal', label: 'Just healed chosen ally (+80% ATK/DEF/MAG/SPD)', passive: [{ stat: 'atk', op: 'pct', value: 80 }, { stat: 'def', op: 'pct', value: 80 }, { stat: 'mag', op: 'pct', value: 80 }, { stat: 'spd', op: 'pct', value: 80 }] }] },
  woetothee:        { name: 'SHIMMYFUL Woe to Thee', desc: 'Every 2 ATK converts to 1% True Damage, capped at 90%. Upon receiving this trait, immediately roll two random shimmyful legendary traits on top of it.', passive: [{ op: 'derived', stat: 'true_dmg', from: 'atk', per: 2, perValue: 1, cap: 90 }], notes: 'On pickup: auto-grants 2 random shimmyful legendaries. True Damage scales with ATK automatically.' },
  paralyzer:        { name: 'SHIMMYFUL Paralyzer', desc: 'On-hit, apply PARALYZED to enemies. Paralyzed enemies skip a turn and lose all SPD and DEX. Gain +8% DEF per Paralyzed enemy on the field.', passive: [], situational: [{ id: 'par-s-1', label: '1 Paralyzed enemy (+8% DEF)', passive: [{ stat: 'def', op: 'pct', value: 8 }] }, { id: 'par-s-2', label: '2 Paralyzed enemies (+16% DEF)', passive: [{ stat: 'def', op: 'pct', value: 16 }] }, { id: 'par-s-3', label: '3 Paralyzed enemies (+24% DEF)', passive: [{ stat: 'def', op: 'pct', value: 24 }] }, { id: 'par-s-4', label: '4+ Paralyzed enemies (+32% DEF)', passive: [{ stat: 'def', op: 'pct', value: 32 }] }] },
  stillstanding:    { name: 'SHIMMYFUL Still Standing', desc: 'Upon reaching 35% HP, immediately heal back to 60% HP and gain SHIMMYFUL FOCUS for 4 turns. SHIMMYFUL FOCUS: attacks cannot miss, dodge chance is greatly increased, and all attacks deal +25% bonus damage. Kills extend FOCUS with extra turns.', passive: [], situational: [{ id: 'ss-s-focus', label: 'SHIMMYFUL FOCUS active (4 turns, +25% bonus dmg)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'mag', op: 'pct', value: 25 }] }, { id: 'ss-s-kill', label: 'Kill extended SHIMMYFUL FOCUS (extra turn)', passive: [{ stat: 'atk', op: 'pct', value: 25 }, { stat: 'mag', op: 'pct', value: 25 }] }], notes: 'At 35% HP: auto-heal to 60% + FOCUS for 4 turns. +25% ATK/MAG while FOCUS is active.' },
  willsurvive:      { name: 'SHIMMYFUL I will Survive!', desc: 'If your life is threatened, you instinctively teleport far away and gain +25% all stats for 1 round after teleporting. You can still be knocked out.', passive: [], situational: [{ id: 'ws-s-post', label: 'Teleported (round after, +25% all stats)', passive: [{ stat: 'all_main', op: 'pct', value: 25 }] }] },
  banquet:          { name: 'SHIMMYFUL Banquet', desc: 'Various foods appear on the battlefield, invisible to enemies. You and your allies heal 15% HP per food eaten without wasting a turn, but lose only -15% SPD for that turn.', passive: [], situational: [{ id: 'ban-s-eating', label: 'Eating food this turn (-15% SPD)', passive: [{ stat: 'spd', op: 'pct', value: -15 }] }] },
  raciallymotivated:{ name: 'SHIMMYFUL Racially Motivated', desc: 'Deal x2.5 damage to enemies of a different species. Deal x0.75 damage to enemies of the same species.', passive: [], situational: [{ id: 'rm-s-diff', label: 'Targeting different species (x2.5 damage)', passive: [{ stat: 'atk', op: 'mul', value: 2.5 }, { stat: 'mag', op: 'mul', value: 2.5 }] }, { id: 'rm-s-same', label: 'Targeting same species (x0.75 damage)', passive: [{ stat: 'atk', op: 'mul', value: 0.75 }, { stat: 'mag', op: 'mul', value: 0.75 }] }] },
  jolly:            { name: 'SHIMMYFUL Jolly', desc: 'During Christmas, get x8 all stats. Also, during the week leading up to Christmas, get x2 all stats.', passive: [], situational: [{ id: 'jolly-s-xmas', label: 'It\'s Christmas (x8 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 8 }] }, { id: 'jolly-s-pre', label: 'Week before Christmas (x2 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }] },
  spooky:           { name: 'SHIMMYFUL Spooky', desc: 'During Halloween, get x8 all stats. Also, during the week leading up to Halloween, get x2 all stats.', passive: [], situational: [{ id: 'spooky-s-hw', label: 'It\'s Halloween (x8 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 8 }] }, { id: 'spooky-s-pre', label: 'Week before Halloween (x2 all stats)', passive: [{ stat: 'all_main', op: 'mul', value: 2 }] }] },
  anarchy:          { name: 'SHIMMYFUL Anarchy', desc: 'All enemies can hit each other and all allies can hit each other. Hitting a teammate grants them +8% all stats; same with enemies. You accumulate everyone\'s anarchy bonuses.', passive: [], notes: 'RP: friendly fire enabled. Each friendly-fire hit grants target +8% stats. You gain all such accumulated bonuses.' },
  yourearly:        { name: 'SHIMMYFUL You\'re early', desc: 'Apply BLEEDING, POISON, BURNING, and FROZEN to the first enemy who attacks in the battle, lasting 3 rounds.', passive: [], notes: 'Reactive trigger on the first enemy attack of the battle. All four status effects for 3 rounds.' },
};

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

function rollOneTrait(rarityOverride, weights) {
  const rarity = rarityOverride || rollRarity(weights);
  const pool = Object.entries(TRAITS).filter(([k, t]) => t.rarity === rarity);
  if (!pool.length) return rollOneTrait('common');
  return pool[Math.floor(Math.random() * pool.length)][0];
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
      const shimmyful = (_r === 'common' && Math.random() < 0.01) || (_r === 'legendary' && Math.random() < 0.05) || (_r === 'mythic' && Math.random() < 0.01) || (_r === 'rare' && Math.random() < 0.01) || (_r === 'epic' && Math.random() < 0.01);
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
const MAIN_STATS = ['hp', 'atk', 'def', 'mag', 'spd'];
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
      let bonus = Math.floor(fromVal / (p.per || 1)) * (p.perValue || 0);
      if (p.cap) bonus = Math.min(bonus, p.cap);
      out[p.stat] = Math.max(1, Math.round(out[p.stat] + bonus));
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
          <div class="trait-chip-name">${duDef.name}</div>
          <div class="trait-chip-desc">${duDef.desc}</div>
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
          <div class="trait-chip-name">${dispName}</div>
          <div class="trait-chip-desc">${dispDesc}</div>
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
        <div class="trait-chip-name">${displayDef.name}</div>
        <div class="trait-chip-desc">${displayDef.desc}</div>
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
      const parts = ['hp', 'atk', 'def', 'mag', 'spd'].map(s => `${s.toUpperCase()} x${rolls[s].toFixed(2)}`).join(' &nbsp; ');
      rollDisplay = `<div style="font-size:7px;color:#aaa;letter-spacing:1px;margin-bottom:4px;">${parts}</div>`;
    }
    return `<div class="trait-triggers">${rollDisplay}<button class="trait-trigger-btn" onclick="rollMissingNo(event)" data-tooltip="Randomize all stats between x0.5–x3 (x0.25–x5.5 for SHIMMYFUL). Simulates the start-of-battle chaos roll.">&#9889; REROLL STATS</button></div>`;
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
function rollTraits() {
  if (!currentId) { notify('SELECT A CHARACTER FIRST', 'err'); return; }

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
  actions.style.display = 'none';
  overlay.classList.add('open');
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
      card.querySelector('.hand-card-desc').textContent = t.desc;
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
      card.style.filter = 'brightness(3)';
      card.className = `hand-card rar-${t.rarity}`;
      card.querySelector('.hand-card-rarity').textContent = RARITY_LABEL[t.rarity];
      card.querySelector('.hand-card-name').textContent = t.name;
      card.querySelector('.hand-card-desc').textContent = t.desc;
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
          card.querySelector('.hand-card-name').textContent = sd.name;
          card.querySelector('.hand-card-desc').textContent = sd.desc;
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
    const mainHtml = ['hp', 'atk', 'def', 'mag', 'spd'].map(k => stat(k, k.toUpperCase())).join('');
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
};
const _origUpdateLiveStats = updateLiveStats;
updateLiveStats = function (c) {
  _origUpdateLiveStats(c);
};

// ============================================================
// INIT
// ============================================================
loadSeenTraits();
migrateLocalStorage();

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

    const currentDoc = snapshot.docs.find(d => d.id === currentId);
    const isSelf = (currentDoc?.metadata?.hasPendingWrites === true) ||
      (currentId === _lastSaveId && (Date.now() - _lastSaveTime < SELF_WRITE_WINDOW));

    if (currentId) {
      const c = characters.find(x => x.id === currentId);
      if (c) {
        if (!isSelf) {
          // Remote update — refresh the viewed character
          updateGoldDisplay(c);
          updateLiveStats(c);
          renderTraitsDisplay(c);
          renderInventory(c);
          loadPity(); updatePityDisplay();
          // Keep form switcher + avatar in sync (another user may have switched forms)
          renderFormSwitcher(c);
          _syncAvatarEl(c);
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
    if (c?.pattern?.type && c.pattern.type !== 'none') { stopBgAnim(); startBgAnim(c.pattern.type, c.pattern.params); }
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
  const KEYS = ['hp', 'atk', 'def', 'mag', 'spd', 'heal_pow', 'crit_rate', 'crit_dmg', 'status_res', 'dexterity', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'];
  const LABELS = { hp: 'HP', atk: 'ATK', def: 'DEF', mag: 'MAG', spd: 'SPD', heal_pow: 'HEAL POW', crit_rate: 'CRIT%', crit_dmg: 'CRIT DMG', status_res: 'STATUS RES', dexterity: 'DEX', resilience: 'RESIL', true_dmg: 'TRUE DMG', lifesteal: 'LIFESTEAL', cooldown_red: 'CDR' };
  const ICONS = {
    hp: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:var(--accent-green);flex-shrink:0"><path d="M5 9L1 5A2.5 2.5 0 0 1 5 2 2.5 2.5 0 0 1 9 5Z" fill="currentColor"/></svg>`,
    atk: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:var(--accent-red);flex-shrink:0"><path d="M2 8l1 1 6-6-1-1-6 6zM1 9l2-1-1-1-1 2z" fill="currentColor"/></svg>`,
    def: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:var(--accent-blue);flex-shrink:0"><path d="M1 2v4c0 3 4 3.5 4 3.5s4-.5 4-3.5V2l-4-1-4 1z" fill="currentColor"/></svg>`,
    mag: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:#ff44ff;flex-shrink:0"><path d="M5 1l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" fill="currentColor"/></svg>`,
    spd: `<svg width="12" height="12" viewBox="0 0 10 10" style="color:var(--accent-yellow);flex-shrink:0"><path d="M6 0L2 5H5L4 10L9 4H5Z" fill="currentColor"/></svg>`,
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
    const barColorA = winA ? (a.color || '#4aff9e') : '#333';
    const barColorB = winB ? (b.color || '#4aff9e') : '#333';
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
      <span style="color:${a.color}">${a.name}</span>
      <span class="cmp-vs">VS</span>
      <span style="color:${b.color}">${b.name}</span>
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

function selectLeaderboardStat(stat, btn) {
  _leaderboardStat = stat;
  document.querySelectorAll('.lb-stat-btn').forEach(b => b.classList.remove('accent'));
  if (btn) btn.classList.add('accent');
  renderLeaderboard();
}

const AVG_STATS = ['hp', 'atk', 'def', 'mag', 'spd'];

function getLeaderboardVal(c, stat) {
  const e = getEffectiveStats(c);
  if (stat === 'avg') {
    // Geometric mean — punishes lopsided builds, rewards balanced stats.
    // Floor at 1 so a zero stat doesn't wipe the score entirely.
    const vals = AVG_STATS.map(s => Math.max(e[s] || 0, 1));
    return Math.pow(vals.reduce((p, v) => p * v, 1), 1 / vals.length);
  }
  return e[stat] || 0;
}

function renderLeaderboard() {
  const wrap = document.getElementById('leaderboard-wrap');
  if (!wrap) return;
  if (!characters.length) {
    wrap.innerHTML = `<div style="text-align:center;color:#444;font-size:8px;padding:24px;letter-spacing:1px;">NO CHARACTERS</div>`;
    return;
  }
  const stat = _leaderboardStat;
  const ranked = characters
    .filter(c => !c.isPlaceholder)
    .map(c => ({ c, val: +getLeaderboardVal(c, stat).toFixed(1) }))
    .sort((a, b) => b.val - a.val);
  const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];
  const isSub = ['heal_pow', 'crit_rate', 'crit_dmg', 'status_res', 'dexterity', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'].includes(stat);
  wrap.innerHTML = ranked.map(({ c, val }, i) => {
    const av = c.avatar
      ? `<img src="${c.avatar}" style="width:28px;height:28px;object-fit:cover;border:1px solid ${c.color};flex-shrink:0;">`
      : `<svg viewBox="0 0 32 32" style="width:28px;height:28px;flex-shrink:0;"><rect x="12" y="2" width="8" height="8" fill="${c.color}"/><rect x="10" y="10" width="12" height="10" fill="${c.color}"/><rect x="8" y="20" width="6" height="8" fill="${c.color}"/><rect x="18" y="20" width="6" height="8" fill="${c.color}"/></svg>`;
    const fmtVal = (val % 1 === 0 ? val : val.toFixed(1)) + (isSub ? '%' : '');
    const rankColor = RANK_COLORS[i] || '#2a2a2a';
    const rowBg = i < 3 ? `background:${rankColor}11;` : '';
    return `<div class="lb-row" style="${rowBg}">
      <span class="lb-rank" style="color:${RANK_COLORS[i] || '#333'}">#${i + 1}</span>
      ${av}
      <span class="lb-name" style="color:${c.color}">${c.name}</span>
      <span class="lb-val">${fmtVal}</span>
    </div>`;
  }).join('');
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

const HC_SILHOUETTE = `<svg viewBox="0 0 28 72" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated;">
  <rect x="9" y="1" width="10" height="11" rx="4" fill="currentColor"/>
  <rect x="7" y="13" width="14" height="18" fill="currentColor"/>
  <rect x="1" y="13" width="7" height="14" rx="2" fill="currentColor"/>
  <rect x="20" y="13" width="7" height="14" rx="2" fill="currentColor"/>
  <rect x="7" y="31" width="6" height="22" fill="currentColor"/>
  <rect x="15" y="31" width="6" height="22" fill="currentColor"/>
  <rect x="4" y="51" width="9" height="5" rx="1" fill="currentColor"/>
  <rect x="15" y="51" width="9" height="5" rx="1" fill="currentColor"/>
</svg>`;

// Global drag/drop listeners (attached once)
document.addEventListener('mousemove', function (e) {
  if (!_hcDrag) return;
  const stage = document.getElementById('hc-stage');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const newXPct = Math.max(0.02, Math.min(0.98, (e.clientX - rect.left) / rect.width));
  _hcDrag.entry.xPct = newXPct;
  _hcDrag.el.style.left = (newXPct * 100) + '%';
  _hcDragged = true;
});
document.addEventListener('mouseup', function () {
  if (_hcDrag) { _hcDebounceSave(); _hcDrag = null; }
});
document.addEventListener('touchmove', function (e) {
  if (!_hcDrag) return;
  const stage = document.getElementById('hc-stage');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const touch = e.touches[0];
  const newXPct = Math.max(0.02, Math.min(0.98, (touch.clientX - rect.left) / rect.width));
  _hcDrag.entry.xPct = newXPct;
  _hcDrag.el.style.left = (newXPct * 100) + '%';
  _hcDragged = true;
  e.preventDefault();
}, { passive: false });
document.addEventListener('touchend', function () {
  if (_hcDrag) { _hcDebounceSave(); _hcDrag = null; }
});

function openHeightChart() {
  document.getElementById('hc-overlay').style.display = 'block';
  document.getElementById('hc-modal').style.display = 'flex';
  document.getElementById('hc-btn-cm').classList.toggle('active', _hcUnit === 'cm');
  document.getElementById('hc-btn-in').classList.toggle('active', _hcUnit === 'in');
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
  const ruler = document.getElementById('hc-ruler');
  const charsEl = document.getElementById('hc-chars');
  if (!stage || !ruler || !charsEl) return;

  const stageH = stage.clientHeight || 440;
  const maxCm = _hcMaxCm();
  const pxPerCm = stageH / maxCm;

  // ── Ruler & grid lines ──
  ruler.innerHTML = '';
  stage.querySelectorAll('.hc-grid-line').forEach(e => e.remove());
  ruler.style.position = 'relative';
  ruler.style.height = stageH + 'px';

  const interval = maxCm > 600 ? 100 : maxCm > 300 ? 50 : maxCm > 150 ? 25 : 10;
  for (let h = 0; h <= maxCm; h += interval) {
    const yPx = stageH - h * pxPerCm;
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

    // Grid line across stage
    const gl = document.createElement('div');
    gl.className = 'hc-grid-line' + (isMajor ? ' major' : '');
    gl.style.cssText = `bottom:${h * pxPerCm}px;`;
    stage.appendChild(gl);
  }

  // ── Character sprites ──
  charsEl.innerHTML = '';

  _hcData.entries.forEach(entry => {
    const cm = entry.heightCm || 170;
    const charHeightPx = cm * pxPerCm;
    const xPct = (entry.xPct != null ? entry.xPct : 0.5) * 100;
    const isSelected = entry.id === _hcSelectedId;

    const wrap = document.createElement('div');
    wrap.className = 'hc-char-wrap' + (isSelected ? ' selected' : '');
    wrap.style.left = xPct + '%';
    wrap.dataset.id = entry.id;

    // Drag start
    wrap.addEventListener('mousedown', function (e) {
      e.stopPropagation();
      _hcDragged = false;
      _hcDrag = { entry, el: wrap, startX: e.clientX, startXPct: entry.xPct != null ? entry.xPct : 0.5 };
    });
    wrap.addEventListener('touchstart', function (e) {
      _hcDragged = false;
      _hcDrag = { entry, el: wrap };
    }, { passive: true });
    wrap.addEventListener('click', function () {
      if (_hcDragged) { _hcDragged = false; return; }
      hcSelectEntry(entry.id);
    });

    // Anchor (height: 0, overflow: visible)
    const anchor = document.createElement('div');
    anchor.className = 'hc-anchor';

    // Name tag (above sprite)
    const nameTag = document.createElement('div');
    nameTag.className = 'hc-char-name-tag';
    nameTag.style.bottom = (charHeightPx + 8) + 'px';
    nameTag.textContent = entry.name || '???';
    anchor.appendChild(nameTag);

    // Sprite or silhouette
    if (entry.spriteBase64) {
      const topF = entry.spriteTopFrac != null ? entry.spriteTopFrac : 0;
      const botF = entry.spriteBotFrac != null ? entry.spriteBotFrac : 1;
      const fracH = Math.max(0.01, botF - topF);
      const fullH = charHeightPx / fracH;
      const bottomOffset = (1 - botF) * fullH;

      const img = document.createElement('img');
      img.src = entry.spriteBase64;
      img.className = 'hc-char-sprite';
      img.style.height = fullH + 'px';
      img.style.bottom = (-bottomOffset) + 'px';
      img.draggable = false;
      anchor.appendChild(img);
    } else {
      const silDiv = document.createElement('div');
      silDiv.innerHTML = HC_SILHOUETTE;
      const svg = silDiv.firstElementChild;
      svg.setAttribute('class', 'hc-char-svg');
      svg.style.height = charHeightPx + 'px';
      svg.style.color = entry.color || '#888';
      anchor.appendChild(svg);
    }

    // Height tag (below ground)
    const htTag = document.createElement('div');
    htTag.className = 'hc-char-ht-tag';
    htTag.textContent = _hcFmtHeight(cm);
    anchor.appendChild(htTag);

    wrap.appendChild(anchor);
    charsEl.appendChild(wrap);
  });
}

function hcAddEntry() {
  const id = (typeof genId === 'function') ? genId() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  // Spread new entries across the chart
  const usedX = _hcData.entries.map(e => e.xPct || 0.5);
  let xPct = 0.1;
  for (let attempt = 0; attempt < 20; attempt++) {
    xPct = 0.08 + Math.random() * 0.84;
    if (usedX.every(x => Math.abs(x - xPct) > 0.07)) break;
  }
  const entry = { id, name: 'CHARACTER', heightCm: 170, color: '#aaaaaa', xPct, spriteBase64: null, spriteTopFrac: 0, spriteBotFrac: 1 };
  _hcData.entries.push(entry);
  _hcSelectedId = id;
  _hcSave();
  _hcPopulateEditPanel(id);
}

function hcSelectEntry(id) {
  _hcSelectedId = id;
  _hcPopulateEditPanel(id);
  renderHeightChart();
}

function _hcPopulateEditPanel(id) {
  const entry = _hcData.entries.find(e => e.id === id);
  if (!entry) return;
  const panel = document.getElementById('hc-edit-panel');
  panel.style.display = 'block';
  document.getElementById('hc-edit-name').value = entry.name || '';
  const hVal = _hcUnit === 'cm' ? Math.round(entry.heightCm) : _hcCmToIn(entry.heightCm);
  document.getElementById('hc-edit-height').value = hVal;
  document.getElementById('hc-height-label').textContent = 'HEIGHT (' + _hcUnit.toUpperCase() + ')';
  document.getElementById('hc-edit-color').value = entry.color || '#aaaaaa';
  document.getElementById('hc-clear-btn').style.display = entry.spriteBase64 ? 'inline-block' : 'none';
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
  renderHeightChart();
  _hcDebounceSave();
}

function hcDeleteEntry() {
  if (!_hcSelectedId) return;
  _hcData.entries = _hcData.entries.filter(e => e.id !== _hcSelectedId);
  _hcSelectedId = null;
  document.getElementById('hc-edit-panel').style.display = 'none';
  _hcSave();
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
  entry.spriteTopFrac = 0;
  entry.spriteBotFrac = 1;
  document.getElementById('hc-clear-btn').style.display = 'none';
  _hcSave();
}

function hcHandleSprite(ev) {
  const file = ev.target.files[0];
  if (!file || !_hcSelectedId) return;
  const entry = _hcData.entries.find(e => e.id === _hcSelectedId);
  if (!entry) return;

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
      entry.spriteTopFrac = topFrac;
      entry.spriteBotFrac = botFrac;
      document.getElementById('hc-clear-btn').style.display = 'inline-block';
      _hcSave();
      if (typeof notify === 'function') notify('SPRITE UPLOADED', 'ok');
    };
    img.src = re.target.result;
  };
  reader.readAsDataURL(file);
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