// ============================================================
// DATA
// ============================================================
const STORAGE_KEY = 'statsheets_v1';
const SEEN_TRAITS_KEY = 'statsheets_seen_traits';
let characters = [];
let seenTraits = [];
let currentId = null;
let editingId = null;
let previewAnim = null;
let bgAnim = null;
let editorAnim = null;

// ============================================================
// FIREBASE
// ============================================================
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBRtoLzS--wz_6sD4rWMgzcwZnHVHUBNdg",
  authDomain:        "statsheets-3668d.firebaseapp.com",
  projectId:         "statsheets-3668d",
  storageBucket:     "statsheets-3668d.firebasestorage.app",
  messagingSenderId: "558910483943",
  appId:             "1:558910483943:web:c468342f15569a4cf0e142"
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
} catch(e) { console.error('Firebase init failed:', e); }

// Track our own writes so onSnapshot doesn't re-render the screen we already updated
let _lastSaveId = null;
let _lastSaveTime = 0;
const SELF_WRITE_WINDOW = 2500; // ms

function loadData() { characters = []; } // no-op — data comes from Firestore

function saveData(charObj) {
  const c = charObj || characters.find(x => x.id === currentId);
  if (!c || !db) return;
  _lastSaveId = c.id;
  _lastSaveTime = Date.now();
  // Keep local array in sync optimistically
  const idx = characters.findIndex(x => x.id === c.id);
  if (idx >= 0) characters[idx] = c; else characters.push(c);
  db.collection('characters').doc(c.id).set(c).catch(err => {
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
  } catch(e) { console.error('Migration error:', e); }
}

function loadSeenTraits() {
  try { seenTraits = JSON.parse(localStorage.getItem(SEEN_TRAITS_KEY)) || []; }
  catch { seenTraits = []; }
}
function saveSeenTraits() { localStorage.setItem(SEEN_TRAITS_KEY, JSON.stringify(seenTraits)); }

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
// SOUND ENGINE
// ============================================================
const SOUNDS_PATH = 'sounds/';
let _hoverCooldown = false;

function playSound(name, { rate = 1, volume = 1 } = {}) {
  try {
    const audio = new Audio(SOUNDS_PATH + name + '.mp3');
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.playbackRate = Math.max(0.1, Math.min(4, rate));
    audio.play().catch(() => {});
    return audio;
  } catch (e) {}
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
  renderStatSegs(val, stat);
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

function triggerImgUpload() { document.getElementById('avatar-file').click(); }

function handleImgUpload(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { currentAvatarDataURL = e.target.result; renderAvatarZone(); };
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
function renderSidebar() {
  const list = document.getElementById('char-list');
  if (!list) return;
  list.innerHTML = '';
  if (!characters.length) {
    list.innerHTML = '<div style="padding:16px;font-size:8px;color:#333;letter-spacing:1px;text-align:center;line-height:2;">-- EMPTY --</div>';
    return;
  }
  characters.forEach(c => {
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
    el.innerHTML = `
      ${avatarHTML}
      <div class="char-entry-name">${nameHtml}</div>
      <div class="char-entry-actions">
        ${!isDraft ? `<button class="btn icon-btn" onclick="event.stopPropagation();editChar('${c.id}')" title="Edit">
          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M7 1l2 2-6 6H1V7L7 1z" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="6" y="0" width="3" height="3" fill="currentColor" rx="0.5"/></svg>
        </button>` : ''}
        <button class="btn icon-btn danger" onclick="event.stopPropagation();deleteChar('${c.id}')" title="Delete">
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="3" width="8" height="1" fill="currentColor"/><rect x="3" y="1" width="4" height="1" fill="currentColor"/><path d="M2 4l1 6h4l1-6" fill="none" stroke="currentColor" stroke-width="1"/></svg>
        </button>
      </div>`;
    el.addEventListener('click', () => {
      if (isDraft) showEditor(c.id);
      else { playSound('characterchange', { volume: 0.7 }); viewChar(c.id); }
    });
    list.appendChild(el);
  });
}

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
  cv.classList.remove('active');
  void cv.offsetWidth; // force reflow to restart animation
  cv.classList.add('active');

  document.getElementById('editor').classList.remove('active');
  if (previewAnim) cancelAnimationFrame(previewAnim);

  const avatarEl = document.getElementById('cv-avatar');
  if (c.avatar) {
    avatarEl.innerHTML = `<img src="${c.avatar}"/>`;
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
  updateGoldDisplay(c);
  
  const bioText = document.getElementById('cv-bio-text');
  if (c.bio && c.bio.trim() !== '') {
    bioText.textContent = c.bio;
    bioText.style.display = 'block';
  } else {
    bioText.style.display = 'none';
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

function switchTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-stats').style.display = tab === 'stats' ? '' : 'none';
  document.getElementById('tab-style').style.display = tab === 'style' ? '' : 'none';
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
    traitTriggers: existing.traitTriggers || {},
    traitStacks: existing.traitStacks || {},
    gold: existing.gold ?? 0,
    goldHistory: existing.goldHistory || [],
    pity: existing.pity ?? 0
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
document.addEventListener('mouseover', function(e) {
  const chip = e.target.closest('.trait-chip[data-trait]');
  if (!chip || chip.dataset.tooltip !== undefined) return;
  const key = chip.dataset.trait;
  const c = characters.find(x => x.id === currentId);
  if (c) chip.dataset.tooltip = buildTraitTooltip(c, key);
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
  const base = { ...c.stats };
  const subBase = c.substats || {
    heal_pow: 0, crit_rate: 0, crit_dmg: 0,
    status_res: 0, dexterity: 0, resilience: 0,
    true_dmg: 0, lifesteal: 0, cooldown_red: 0
  };

  // Enforce locked substats to ALWAYS have a 0 base, even if legacy data exists
  const lockedSubstats = ['crit_rate', 'crit_dmg', 'status_res', 'resilience', 'true_dmg', 'lifesteal', 'cooldown_red'];
  lockedSubstats.forEach(key => subBase[key] = 0);

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
  }).join('') + `</div>`;
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
    saveData();
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
  const stats = ['hp', 'atk', 'def', 'mag', 'spd'];
  stats.forEach(key => {
    const baseVal = c.stats[key] || 0;
    const effVal = effStats[key];
    const diff = effVal - baseVal;
    let diffHtml = '';
    if (diff > 0) diffHtml = `<span class="eff-stat-diff pos">(+${diff})</span>`;
    else if (diff < 0) diffHtml = `<span class="eff-stat-diff neg">(${diff})</span>`;

    const row = document.getElementById(`stat-segs-${key}`)?.parentElement;
    if (row) {
      const valEl = row.querySelector('.stat-val');
      if (valEl) valEl.innerHTML = `${effVal}${diffHtml}`;
    }

    // 0.05 speed gives a slower, dramatic fill when equipping items!
    renderStatSegs(effVal, key, 0.05);
  });
  
  renderSubstatsDisplay(c, effStats);
}

function deleteItem(itemId) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  if (!confirm("Delete this item?")) return;
  playSound('delete');
  c.inventory = c.inventory.filter(i => i.id !== itemId);
  saveData();
  viewChar(currentId);
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

  saveData();
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
  favored:     { name:'Favored', rarity:'common', desc:'+10% Crit Chance', passive:[{stat:'crit_rate',op:'add',value:10}] },
  spicy:       { name:'Spicy', rarity:'common', desc:'+5% Resilience', passive:[{stat:'resilience',op:'add',value:5}] },
  sonic:       { name:'Sonic', rarity:'common', desc:'+5% SPD, +5% Dexterity', passive:[{stat:'spd',op:'pct',value:5},{stat:'dexterity',op:'add',value:5}] },
  flaming:     { name:'Flaming', rarity:'common', desc:'50% chance to BURN enemies on hit.', passive:[], notes:'Status effect. No direct stat impact.' },
  enchanted:   { name:'Enchanted', rarity:'common', desc:'+5% MAG, +5% Heal Power', passive:[{stat:'mag',op:'pct',value:5},{stat:'heal_pow',op:'add',value:5}] },
  steadfast:   { name:'Steadfast', rarity:'common', desc:'+5% True Damage. Deal extra damage if enemy is blocking.', passive:[{stat:'true_dmg',op:'add',value:5}], situational:[{id:'block', label:'Enemy is BLOCKING', desc:'Bonus damage vs blocking targets.', passive:[]}] },
  bombastic:   { name:'Bombastic', rarity:'common', desc:'Explosions caused by user are x2 bigger.', passive:[], notes:'Cosmetic / scaling. No direct stat impact.' },
  counterfeit: { name:'Counterfeit', rarity:'common', desc:'Shops are 10% cheaper.', passive:[], notes:'Economy effect. No combat stat impact.' },
  sticky:      { name:'Sticky', rarity:'common', desc:'your fingers are sticky :)', passive:[], notes:'Flavor trait.' },
  tough:       { name:'Tough', rarity:'common', desc:'+5% DEF', passive:[{stat:'def',op:'pct',value:5}] },
  hearty:      { name:'Hearty', rarity:'common', desc:'+8% HP', passive:[{stat:'hp',op:'pct',value:8}] },
  keen:        { name:'Keen', rarity:'common', desc:'+5% ATK, +3% Crit Chance', passive:[{stat:'atk',op:'pct',value:5},{stat:'crit_rate',op:'add',value:3}] },
  scholarly:   { name:'Scholarly', rarity:'common', desc:'+5% MAG, +5% Cooldown Reduction', passive:[{stat:'mag',op:'pct',value:5},{stat:'cooldown_red',op:'add',value:5}] },
  lightfooted: { name:'Light-Footed', rarity:'common', desc:'+8% SPD', passive:[{stat:'spd',op:'pct',value:8}] },
  regenerative:{ name:'Regenerative', rarity:'common', desc:'+8% Heal Power, +3% HP', passive:[{stat:'heal_pow',op:'add',value:8},{stat:'hp',op:'pct',value:3}] },
  reckless:    { name:'Reckless', rarity:'common', desc:'+10% ATK, -5% DEF', passive:[{stat:'atk',op:'pct',value:10},{stat:'def',op:'pct',value:-5}] },
  ironclad:    { name:'Ironclad', rarity:'common', desc:'+8% DEF, -5% SPD', passive:[{stat:'def',op:'pct',value:8},{stat:'spd',op:'pct',value:-5}] },
  precise:     { name:'Precise', rarity:'common', desc:'+8% Crit Chance, -5% Crit Damage', passive:[{stat:'crit_rate',op:'add',value:8},{stat:'crit_dmg',op:'add',value:-5}] },
  glassjaw:    { name:'Glass Jaw', rarity:'common', desc:'+8% ATK, -5% Resilience', passive:[{stat:'atk',op:'pct',value:8},{stat:'resilience',op:'add',value:-5}] },
  shocking:    { name:'Shocking', rarity:'common', desc:'Chance to SHOCK/STUN enemies on hit.', passive:[], notes:'Status effect. No direct stat impact.' },
  wellfed:     { name:'Well-Fed', rarity:'common', desc:'+5% HP, +3% Lifesteal', passive:[{stat:'hp',op:'pct',value:5},{stat:'lifesteal',op:'add',value:3}] },
  caffeinated: { name:'Caffeinated', rarity:'common', desc:'+5% SPD, +5% Cooldown Reduction', passive:[{stat:'spd',op:'pct',value:5},{stat:'cooldown_red',op:'add',value:5}] },
  stubborn:    { name:'Stubborn', rarity:'common', desc:'Extremely resistant to crowd control and intimidation.', passive:[], notes:'Flavor trait.' },
  nightowl:    { name:'Night Owl', rarity:'common', desc:'+5% ATK, +5% SPD in the dark or at night.', passive:[], situational:[{id:'nightowl-dark', label:'It is dark / nighttime', passive:[{stat:'atk',op:'pct',value:5},{stat:'spd',op:'pct',value:5}]}] },
  headstrong:  { name:'Headstrong', rarity:'common', desc:'+8% Status Resistance', passive:[{stat:'status_res',op:'add',value:8}] },
  resolute:    { name:'Resolute', rarity:'common', desc:'+5% Resilience. At ≤30% HP, gain +5% ATK.', passive:[{stat:'resilience',op:'add',value:5}], situational:[{id:'res-low', label:'Currently at ≤30% HP', passive:[{stat:'atk',op:'pct',value:5}]}] },
  grounded:    { name:'Grounded', rarity:'common', desc:'+5% DEF. Immune to knockback effects.', passive:[{stat:'def',op:'pct',value:5}], notes:'Knockback immunity is flavor. +5% DEF is the stat impact.' },

  // ============ RARE (blue) ============
  assassin:    { name:'Assassin', rarity:'rare', desc:'The higher enemy HP, the greater your damage (0%–30%).', passive:[], situational:[{id:'asn-max', label:'Enemy at MAX HP', passive:[{stat:'atk',op:'pct',value:30}]}, {id:'asn-half', label:'Enemy at 50% HP', passive:[{stat:'atk',op:'pct',value:15}]}] },
  executioner: { name:'Executioner', rarity:'rare', desc:'The lower the enemy HP, the greater your damage (0%–30%).', passive:[], situational:[{id:'exe-low', label:'Enemy at 0% HP threshold', passive:[{stat:'atk',op:'pct',value:30}]}, {id:'exe-half', label:'Enemy at 50% HP', passive:[{stat:'atk',op:'pct',value:15}]}] },
  lethal:      { name:'Lethal', rarity:'rare', desc:'+15% True Damage.', passive:[{stat:'true_dmg',op:'add',value:15}] },
  toxic:       { name:'Toxic', rarity:'rare', desc:'Attacks POISON enemies.', passive:[], notes:'Status effect. No direct stat impact.' },
  frostbite:   { name:'Frostbite', rarity:'rare', desc:'Attacks FREEZE enemies.', passive:[], notes:'Status effect. No direct stat impact.' },
  buff:        { name:'Buff', rarity:'rare', desc:'+15% ATK', passive:[{stat:'atk',op:'pct',value:15}] },
  armored:     { name:'Armored', rarity:'rare', desc:'+15% DEF', passive:[{stat:'def',op:'pct',value:15}] },
  workhorse:   { name:'Workhorse', rarity:'rare', desc:'+15% Cooldown Reduction', passive:[{stat:'cooldown_red',op:'add',value:15}] },
  shielding:   { name:'Shielding', rarity:'rare', desc:'Start of fight: shield for 5% of HP. If a round passes at MAX HP, gain another. Stacks infinitely.', passive:[], situational:[{id:'shield-stack', label:'Per shield stack (vs HP)', desc:'Each stack = 5% HP as shield. Stat impact varies.', passive:[]}] },
  saving:      { name:'Saving Habits', rarity:'rare', desc:'Shops are 20% cheaper.', passive:[], notes:'Economy effect. No combat stat impact.' },
  voided:      { name:'Voided', rarity:'rare', desc:'Attacks have a 5% chance to spawn black holes that pull and damage.', passive:[], notes:'Proc effect. No direct stat impact.' },
  legday:      { name:'Leg Day', rarity:'rare', desc:'Big thighs. +15% SPD, +15% Dexterity', passive:[{stat:'spd',op:'pct',value:15},{stat:'dexterity',op:'add',value:15}] },
  shrinkray:   { name:'Shrink Ray', rarity:'rare', desc:'Damage shrinks enemies by 50% and reduces their DEF by 5%.', passive:[], notes:'Affects enemy stats. No self stat impact.' },
  vital:       { name:'Vital', rarity:'rare', desc:'+15% HP', passive:[{stat:'hp',op:'pct',value:15}] },
  swiftstrike: { name:'Swiftstrike', rarity:'rare', desc:'+15% SPD, +10% Crit Chance', passive:[{stat:'spd',op:'pct',value:15},{stat:'crit_rate',op:'add',value:10}] },
  spellweaver: { name:'Spellweaver', rarity:'rare', desc:'+15% MAG, +10% Cooldown Reduction', passive:[{stat:'mag',op:'pct',value:15},{stat:'cooldown_red',op:'add',value:10}] },
  lifeline:    { name:'Lifeline', rarity:'rare', desc:'+10% Lifesteal, +10% Heal Power', passive:[{stat:'lifesteal',op:'add',value:10},{stat:'heal_pow',op:'add',value:10}] },
  weakpoint:   { name:'Weakpoint', rarity:'rare', desc:'+10% True Damage, +10% Crit Chance', passive:[{stat:'true_dmg',op:'add',value:10},{stat:'crit_rate',op:'add',value:10}] },
  berserker:   { name:'Berserker', rarity:'rare', desc:'+25% ATK, -15% DEF', passive:[{stat:'atk',op:'pct',value:25},{stat:'def',op:'pct',value:-15}] },
  bulwark:     { name:'Bulwark', rarity:'rare', desc:'+20% DEF, -15% ATK', passive:[{stat:'def',op:'pct',value:20},{stat:'atk',op:'pct',value:-15}] },
  overdrive:   { name:'Overdrive', rarity:'rare', desc:'+20% ATK, -10% HP', passive:[{stat:'atk',op:'pct',value:20},{stat:'hp',op:'pct',value:-10}] },
  solo:        { name:'Solo', rarity:'rare', desc:'+20% all stats when fighting without allies.', passive:[], situational:[{id:'solo-alone', label:'Fighting alone (no allies)', passive:[{stat:'all_main',op:'pct',value:20}]}] },
  packhunter:  { name:'Pack Hunter', rarity:'rare', desc:'+8% ATK per ally in the fight (up to +24%).', passive:[], situational:[{id:'pack-1', label:'1 ally in fight (+8% ATK)', passive:[{stat:'atk',op:'pct',value:8}]}, {id:'pack-2', label:'2 allies in fight (+16% ATK)', passive:[{stat:'atk',op:'pct',value:16}]}, {id:'pack-3', label:'3+ allies in fight (+24% ATK)', passive:[{stat:'atk',op:'pct',value:24}]}] },
  laststand:   { name:'Last Stand', rarity:'rare', desc:'At ≤25% HP: +20% ATK, +20% DEF.', passive:[], situational:[{id:'ls-low', label:'Currently at ≤25% HP', passive:[{stat:'atk',op:'pct',value:20},{stat:'def',op:'pct',value:20}]}] },
  opportunist: { name:'Opportunist', rarity:'rare', desc:'+20% ATK vs enemies that are stunned, slowed, or poisoned.', passive:[], situational:[{id:'opp-cc', label:'Enemy is stunned, slowed, or poisoned', passive:[{stat:'atk',op:'pct',value:20}]}] },
  momentum:    { name:'Momentum', rarity:'rare', desc:'Each consecutive hit without taking damage: +5% ATK. Stacks up to 3x.', passive:[], situational:[{id:'mom-1', label:'1 hit streak (+5% ATK)', passive:[{stat:'atk',op:'pct',value:5}]}, {id:'mom-2', label:'2 hit streak (+10% ATK)', passive:[{stat:'atk',op:'pct',value:10}]}, {id:'mom-3', label:'3+ hit streak (+15% ATK)', passive:[{stat:'atk',op:'pct',value:15}]}] },
  adrenaline:  { name:'Adrenaline', rarity:'rare', desc:'Taking damage grants +10% ATK for 2 turns.', passive:[], situational:[{id:'adren-hit', label:'Just took damage (+10% ATK for 2 turns)', passive:[{stat:'atk',op:'pct',value:10}]}] },
  secondwind:  { name:'Second Wind', rarity:'rare', desc:'Once per fight, survive a killing blow at 1 HP.', passive:[], notes:'Once-per-fight effect. No direct stat impact.' },
  mending:     { name:'Mending', rarity:'rare', desc:'+15% Heal Power. Your heals restore 3% HP to yourself.', passive:[{stat:'heal_pow',op:'add',value:15}], notes:'Self-heal on cast is flavor/mechanic. Heal Power is the stat impact.' },
  fortify:     { name:'Fortify', rarity:'rare', desc:'After taking 3 hits in a row, gain +15% DEF.', passive:[], situational:[{id:'fort-3hit', label:'Took 3 hits in a row (+15% DEF)', passive:[{stat:'def',op:'pct',value:15}]}] },
  evasion:     { name:'Evasion', rarity:'rare', desc:'+20% Dexterity', passive:[{stat:'dexterity',op:'add',value:20}] },
  warcry:      { name:'Warcry', rarity:'rare', desc:'Once per fight, give all allies +15% ATK for 2 turns.', passive:[], notes:'Support effect. No self stat impact.' },
  bubbly:      { name:'Bubbly', rarity:'rare', desc:'50% chance on hit to encase enemy in a bubble, stunning them for 1 turn but making them untouchable.', passive:[], notes:'Proc effect. Stuns but grants enemy temporary damage immunity.' },

  // ============ EPIC (light purple, pulse) ============
  economic:    { name:'Economic', rarity:'epic', desc:'Shops are 50% cheaper.', passive:[], notes:'Economy effect. No combat stat impact.' },
  pyromaniac:  { name:'Pyromaniac', rarity:'epic', desc:'Explosions x4 bigger. Explosions BURN nearby enemies. Heal 5% HP per turn per BURNING enemy.', passive:[], situational:[{id:'pyro-3', label:'3 burning enemies (heal preview)', desc:'Heal scales with HP.', passive:[]}] },
  prime:       { name:'Prime', rarity:'epic', desc:'+20% ATK, +20% DEF', passive:[{stat:'atk',op:'pct',value:20},{stat:'def',op:'pct',value:20}] },
  overflowing: { name:'Overflowing', rarity:'epic', desc:'+30% Cooldown Reduction', passive:[{stat:'cooldown_red',op:'add',value:30}] },
  vampiric:    { name:'Vampiric', rarity:'epic', desc:'+25% Lifesteal', passive:[{stat:'lifesteal',op:'add',value:25}] },
  solar:       { name:'Solar', rarity:'epic', desc:'+35% SPD, +30% Dexterity', passive:[{stat:'spd',op:'pct',value:35},{stat:'dexterity',op:'add',value:30}] },
  gambler:     { name:'Gambler', rarity:'epic', desc:'+30% Crit Chance, +15% Crit Damage', passive:[{stat:'crit_rate',op:'add',value:30},{stat:'crit_dmg',op:'add',value:15}] },
  deferred:    { name:'Deferred', rarity:'epic', desc:'+45% ATK. Damage delivered over 3 turns.', passive:[{stat:'atk',op:'pct',value:45}] },
  trueT:       { name:'True', rarity:'epic', desc:'+40% True Damage', passive:[{stat:'true_dmg',op:'add',value:40}] },
  heavyhitter: { name:'Heavy Hitter', rarity:'epic', desc:'+5 ATK per 50 HP. Capped at +300 ATK.', passive:[{op:'derived', stat:'atk', from:'hp', per:50, perValue:5, cap:300}] },
  clothesline: { name:'Clothesline', rarity:'epic', desc:'Tether to an ally each fight. Laser scales with ATK, slows enemies by 10%.', passive:[], notes:'Ally-tether effect. No self stat impact.' },
  dawn:        { name:"Dawnbringer's Resolve", rarity:'epic', desc:'At ≤50% HP, recover 10% HP every turn until full.', passive:[], situational:[{id:'dawn-low', label:'Currently at ≤50% HP', desc:'Sustained healing.', passive:[]}] },
  warmup:      { name:'Warmup Routine', rarity:'epic', desc:'Spend first round exercising (cancels if hit). After: +20% all main stats. Can keep exercising indefinitely.', passive:[], situational:[{id:'warmup-done', label:'Warmup completed', passive:[{stat:'all_main',op:'pct',value:20}]}] },
  colossus:    { name:'Colossus', rarity:'epic', desc:'+30% HP, +30% DEF', passive:[{stat:'hp',op:'pct',value:30},{stat:'def',op:'pct',value:30}] },
  archmage:    { name:'Archmage', rarity:'epic', desc:'+35% MAG, +20% CDR, +20% Heal Power', passive:[{stat:'mag',op:'pct',value:35},{stat:'cooldown_red',op:'add',value:20},{stat:'heal_pow',op:'add',value:20}] },
  phantom:     { name:'Phantom', rarity:'epic', desc:'+30% SPD, +20% Dexterity, +20% Crit Chance', passive:[{stat:'spd',op:'pct',value:30},{stat:'dexterity',op:'add',value:20},{stat:'crit_rate',op:'add',value:20}] },
  juggernaut:  { name:'Juggernaut', rarity:'epic', desc:'+30% ATK, +20% HP, -15% SPD', passive:[{stat:'atk',op:'pct',value:30},{stat:'hp',op:'pct',value:20},{stat:'spd',op:'pct',value:-15}] },
  irongiant:   { name:'Iron Giant', rarity:'epic', desc:'+8 DEF per 100 HP. The more HP you have, the tougher you get.', passive:[{op:'derived',stat:'def',from:'hp',per:100,perValue:8}] },
  spellblade:  { name:'Spellblade', rarity:'epic', desc:'+1 ATK per 3 MAG. Magic fuels your physical hits.', passive:[{op:'derived',stat:'atk',from:'mag',per:3,perValue:1}] },
  reaper:      { name:'Reaper', rarity:'epic', desc:'Killing an enemy restores 25% HP.', passive:[], notes:'Kill-trigger heal. No passive stat impact.' },
  onslaught:   { name:'Onslaught', rarity:'epic', desc:'Each consecutive attack turn without being hit: +5% ATK. Stacks up to 3x. Resets if you take damage.', passive:[], situational:[{id:'ons-1', label:'1 turn streak (+5% ATK)', passive:[{stat:'atk',op:'pct',value:5}]}, {id:'ons-2', label:'2 turn streak (+10% ATK)', passive:[{stat:'atk',op:'pct',value:10}]}, {id:'ons-3', label:'3+ turn streak (+15% ATK)', passive:[{stat:'atk',op:'pct',value:15}]}] },
  absorbent:   { name:'Absorbent', rarity:'epic', desc:'Each hit you take: +2% DEF for the rest of the fight. Resets between fights.', passive:[], situational:[{id:'abs-5', label:'After 5 hits taken (+10% DEF)', passive:[{stat:'def',op:'pct',value:10}]}, {id:'abs-10', label:'After 10 hits taken (+20% DEF)', passive:[{stat:'def',op:'pct',value:20}]}] },
  mirror:      { name:'Mirror', rarity:'epic', desc:'Reflect 15% of all damage taken back at the attacker.', passive:[], notes:'Damage reflection. No direct self stat impact.' },
  echo:        { name:'Echo', rarity:'epic', desc:'Every 3rd attack fires twice, hitting the same target again for full damage.', passive:[], notes:'Attack multiplier. No direct stat impact.' },
  timebomb:    { name:'Time Bomb', rarity:'epic', desc:'Once per fight, mark an enemy. They take double damage on their next hit received.', passive:[], notes:'One-shot debuff. No self stat impact.' },
  overdose:    { name:'Overdose', rarity:'epic', desc:'Being healed above max HP converts the excess into bonus ATK temporarily.', passive:[], situational:[{id:'od-active', label:'Overhealed (bonus ATK active)', passive:[{stat:'atk',op:'pct',value:20}]}] },
  shieldbreak: { name:'Shield Breaker', rarity:'epic', desc:'+30% ATK vs any enemy that has a shield or barrier active.', passive:[], situational:[{id:'sb-shielded', label:'Enemy has a shield or barrier', passive:[{stat:'atk',op:'pct',value:30}]}] },
  warden:      { name:'Warden', rarity:'epic', desc:'When any ally drops below 30% HP, instantly shield them for 15% of your HP.', passive:[], notes:'Ally-shield proc. No self stat impact.' },
  empower:     { name:'Empower', rarity:'epic', desc:'Buffs and heals you give allies are 50% stronger.', passive:[], notes:'Support multiplier. No self stat impact.' },
  commander:   { name:'Commander', rarity:'epic', desc:'All allies gain +15% ATK while you are above 50% HP.', passive:[], situational:[{id:'cmd-up', label:'You are above 50% HP (allies +15% ATK)', desc:'Ally buff. No self stat impact.', passive:[]}] },

  // ============ LEGENDARY (yellow, glow) ============
  godly:       { name:'Godly', rarity:'legendary', desc:'+40% ATK, +40% DEF', passive:[{stat:'atk',op:'pct',value:40},{stat:'def',op:'pct',value:40}] },
  rct:         { name:'RCT', rarity:'legendary', desc:'-15% HP. Each turn, heal 1% HP per 5 MAG (cap 20%).', passive:[{stat:'hp',op:'pct',value:-15}], situational:[{id:'rct-tick', label:'Per-turn regen tick', desc:'Healing scales with MAG.', passive:[]}] },
  gluttonous:  { name:'Gluttonous', rarity:'legendary', desc:'+20% CDR. +5% ATK & +5% DEF per 10% CDR.', passive:[{stat:'cooldown_red',op:'add',value:20},{op:'derived',stat:'atk',from:'cooldown_red',per:10,perPct:5},{op:'derived',stat:'def',from:'cooldown_red',per:10,perPct:5}] },
  cultivation: { name:'Cultivation', rarity:'legendary', desc:'Every fight, +2% in every main stat. Permanent scaling.', passive:[], cultivation:{label:'Fights Cultivated', perStack:{stat:'all_main',op:'pct',value:2}, defaultStacks:10, maxStacks:500} },
  cursed:      { name:'Cursed', rarity:'legendary', desc:'Lower HP → higher damage (0%→+80%). Gain 10% Lifesteal at 20% HP.', passive:[], situational:[{id:'cursed-low', label:'Currently at 20% HP', passive:[{stat:'atk',op:'pct',value:64},{stat:'lifesteal',op:'add',value:10}]}, {id:'cursed-half', label:'Currently at 50% HP', passive:[{stat:'atk',op:'pct',value:40}]}] },
  angelic:     { name:'Angelic', rarity:'legendary', desc:'+100% Heal Power. Healing an ally heals you for 5% of the amount.', passive:[{stat:'heal_pow',op:'add',value:100}] },
  ryoiki:      { name:'Ryoiki', rarity:'legendary', desc:'Start of fight: shield for 20% HP. If a round passes at MAX HP, +20% HP shield. Stacks infinitely.', passive:[], situational:[{id:'ryoiki-1', label:'Per shield stack (vs HP)', desc:'Each stack = 20% HP as shield.', passive:[]}] },
  celestial:   { name:'Celestial Body', rarity:'legendary', desc:'+30% HP, +30% DEF, -30% ATK, -30% Crit Damage', passive:[{stat:'hp',op:'pct',value:30},{stat:'def',op:'pct',value:30},{stat:'atk',op:'pct',value:-30},{stat:'crit_dmg',op:'add',value:-30}] },
  temporal:    { name:'Temporal', rarity:'legendary', desc:'You get 2 turns per round.', passive:[], notes:'Action economy. No direct stat impact.' },
  spiritual:   { name:'Spiritual', rarity:'legendary', desc:'+50% Cooldown Reduction', passive:[{stat:'cooldown_red',op:'add',value:50}] },
  circle:      { name:'Circle of Death', rarity:'legendary', desc:'Damage enemies when you heal. +5% Heal Power per 65 ATK.', passive:[{op:'derived',stat:'heal_pow',from:'atk',per:65,perValue:5}] },
  bigbrain:    { name:'Big Brain', rarity:'legendary', desc:'Start of fight: shield worth 50% of MAG.', passive:[], notes:'One-time shield. No passive stat impact.' },
  giant:       { name:'Giant Slayer', rarity:'legendary', desc:'Become tiny. Deal more damage the bigger your target is.', passive:[], situational:[{id:'gs-big', label:'Target is HUGE', passive:[{stat:'atk',op:'pct',value:50}]}] },
  goliath:     { name:'Goliath', rarity:'legendary', desc:'Become big. Deal more damage the smaller your target is.', passive:[], situational:[{id:'go-small', label:'Target is TINY', passive:[{stat:'atk',op:'pct',value:50}]}] },

  // ============ MYTHIC (gradient orange/yellow, sun) ============
  adaptation:  { name:'Adaptation', rarity:'mythic', desc:'Every hit from an enemy → +15% DEF vs that enemy. Stacks infinitely.', passive:[], situational:[{id:'adp-stk', label:'Per stack vs an enemy', passive:[{stat:'def',op:'pct',value:15}]}] },
  acclrsorc:   { name:'Accelerating Sorcery', rarity:'mythic', desc:'Each turn, +10% Cooldown Reduction.', passive:[], situational:[{id:'as-1', label:'After 1 turn', passive:[{stat:'cooldown_red',op:'add',value:10}]}, {id:'as-3', label:'After 3 turns', passive:[{stat:'cooldown_red',op:'add',value:30}]}] },
  brave:       { name:'Bravest of the Brave', rarity:'mythic', desc:'On pick, guaranteed 2 additional rare/epic traits. You can hold 2 traits at once.', passive:[], notes:'Meta. Grants 2 bonus rare/epic traits on pick.' },
  bloodlust:   { name:'Bloodlust', rarity:'mythic', desc:'-5% HP per round, +100% Lifesteal. Each hit costs +2% HP but gains +5% Lifesteal.', passive:[{stat:'lifesteal',op:'add',value:100}] },
  allforyou:   { name:'All for You!', rarity:'mythic', desc:'Heals & buffs given to allies are x2.5. Cannot heal/buff yourself.', passive:[], notes:'Support multiplier. No self stat impact.' },
  glasscannon: { name:'Glass Cannon', rarity:'mythic', desc:'+200% ATK, -90% DEF, -80% HP', passive:[{stat:'atk',op:'pct',value:200},{stat:'def',op:'pct',value:-90},{stat:'hp',op:'pct',value:-80}] },
  magical:     { name:'Magical Girl', rarity:'mythic', desc:'Transform on fight start: +15% all stats, +90% MAG.', passive:[{stat:'all_main',op:'pct',value:15},{stat:'mag',op:'pct',value:90}] },
  nesting:     { name:'Nesting Doll', rarity:'mythic', desc:'3 revives. Lose -25% HP and -25% ATK per revive.', passive:[], situational:[{id:'nd-1', label:'After 1 revive', passive:[{stat:'hp',op:'pct',value:-25},{stat:'atk',op:'pct',value:-25}]}, {id:'nd-3', label:'After 3 revives', passive:[{stat:'hp',op:'pct',value:-75},{stat:'atk',op:'pct',value:-75}]}] },
  lucifer:     { name:"Lucifer's Champion", rarity:'mythic', desc:"+20% all stats, +50% SPD, +50% Dex. Every attack stacks 3.5% HP/turn BURN. Kill Zoe's champion to obtain.", passive:[{stat:'all_main',op:'pct',value:20},{stat:'spd',op:'pct',value:50},{stat:'dexterity',op:'add',value:50}] },
  zoe:         { name:"Zoe's Champion", rarity:'mythic', desc:"+20% all stats, +50% HP, +50% Heal Power. Heal mirror to self. Kill Lucifer's champion to obtain.", passive:[{stat:'all_main',op:'pct',value:20},{stat:'hp',op:'pct',value:50},{stat:'heal_pow',op:'add',value:50}] },
  vengeance:   { name:'Vengeance', rarity:'mythic', desc:'Per ally dead: x2 stats. All allies dead: -80% DEF but x4 stats & +25% Lifesteal.', passive:[], situational:[{id:'vg-1', label:'1 ally down (x2 stats)', passive:[{stat:'all_main',op:'mul',value:2}]}, {id:'vg-all', label:'All allies down', passive:[{stat:'all_main',op:'mul',value:4},{stat:'def',op:'pct',value:-80},{stat:'lifesteal',op:'add',value:25}]}] },
  raidboss:    { name:'Raid Boss', rarity:'mythic', desc:'Skip first turn (chained, +90% DEF). After: x2 all stats.', passive:[], situational:[{id:'rb-t1', label:'Turn 1 (chained)', passive:[{stat:'def',op:'pct',value:90}]}, {id:'rb-loose', label:'After turn 1 (released)', passive:[{stat:'all_main',op:'mul',value:2}]}] },

  // ============ HEXXED (gradient dark purple/black, void) ============
  hx_shadow:   { name:'Shadow Assassin', rarity:'hexxed', desc:'Enemy at high HP → up to +200% damage. x1.75 when enemy doesn\'t see you.', passive:[], situational:[{id:'hxsa-max', label:'Enemy at MAX HP', passive:[{stat:'atk',op:'pct',value:200}]}, {id:'hxsa-unseen', label:'Enemy doesn\'t see you (x1.75)', passive:[{stat:'atk',op:'mul',value:1.75}]}] },
  hx_royal:    { name:'Royal Executioner', rarity:'hexxed', desc:'Enemy at low HP → up to +200% damage. Execute enemies below 40% HP.', passive:[], situational:[{id:'hxre-low', label:'Enemy at 0% threshold', passive:[{stat:'atk',op:'pct',value:200}]}, {id:'hxre-exec', label:'Execute threshold (40% HP)', desc:'Instant kill. No stat change.', passive:[]}] },
  hx_shrink:   { name:'Sci-Fi Shrink Ray', rarity:'hexxed', desc:'Damage shrinks enemies by 200% and reduces their DEF by 50%.', passive:[], notes:'Affects enemy stats. No self stat impact.' },
  hx_void:     { name:'Abyssal Voided', rarity:'hexxed', desc:'50% chance attacks spawn black holes. Trapped enemies lose their turn.', passive:[], notes:'Proc effect. No direct stat impact.' },
  hx_econ:     { name:'Greedy Economic', rarity:'hexxed', desc:'Shops are 85% cheaper.', passive:[], notes:'Economy effect. No combat stat impact.' },
  hx_pyro:     { name:'Manic Pyromaniac', rarity:'hexxed', desc:'Explosions x10 bigger. Apply BURN/POISON/BLEED/SLOW. Heal 20% HP/turn per BURNING enemy.', passive:[] },
  hx_vamp:     { name:'Ancient Vampiric', rarity:'hexxed', desc:'+100% Lifesteal. Getting hit -10%. Hitting +10%.', passive:[{stat:'lifesteal',op:'add',value:100}] },
  hx_solar:    { name:'Icarus Solar', rarity:'hexxed', desc:'+80% SPD, +80% Dexterity. Nearby enemies slowed 30%.', passive:[{stat:'spd',op:'pct',value:80},{stat:'dexterity',op:'add',value:80}] },
  hx_gamble:   { name:'Idle Death Gambler', rarity:'hexxed', desc:'+80% Crit Chance, +70% Crit Damage. Crits permanently increase ATK by +1%.', passive:[{stat:'crit_rate',op:'add',value:80},{stat:'crit_dmg',op:'add',value:70}], cultivation:{label:'Permanent Crit Stacks', perStack:{stat:'atk',op:'pct',value:1}, defaultStacks:0, maxStacks:500} },
  hx_defer:    { name:'Fractured Deferred', rarity:'hexxed', desc:'+120% ATK. Damage in 2 turns. Targets lose 70% DEF.', passive:[{stat:'atk',op:'pct',value:120}] },
  hx_true:     { name:'Vitriolic True', rarity:'hexxed', desc:'Completely ignore defense (100% True Damage).', passive:[{stat:'true_dmg',op:'add',value:100}] },
  hx_heavy:    { name:'Heaviest of Heavy Hitter', rarity:'hexxed', desc:'+1 ATK per 1 HP. No cap.', passive:[{op:'derived',stat:'atk',from:'hp',per:1,perValue:1}] },
  hx_dusk:     { name:"Duskbringer's Resolve", rarity:'hexxed', desc:'At ≤20% HP: instantly heal to full + x4 HP as shield.', passive:[], situational:[{id:'hxd-trig', label:'Triggered (full heal + x4 HP shield)', passive:[]}] },
  hx_gymbro:   { name:"Gymbro's Warmup Routine", rarity:'hexxed', desc:'Heavy exercise first round (cancels only if all enemies hit). After: +50% all stats. Restack each round.', passive:[], situational:[{id:'hxg-done', label:'Warmup completed (+50% all)', passive:[{stat:'all_main',op:'pct',value:50}]}, {id:'hxg-2', label:'Stacked twice (+100% all)', passive:[{stat:'all_main',op:'pct',value:100}]}] },
  hx_godly:    { name:'Egotistic Godly', rarity:'hexxed', desc:'x2 ATK, x2 DEF. x4 all stats vs SPIRITS.', passive:[{stat:'atk',op:'mul',value:2},{stat:'def',op:'mul',value:2}], situational:[{id:'hxgd-spirit', label:'Fighting a SPIRIT (x4 all)', passive:[{stat:'all_main',op:'mul',value:4}]}] },
  hx_cult:     { name:'Soul Reaping Cultivation', rarity:'hexxed', desc:'Every fight, +5% in every main stat. Permanent scaling.', passive:[], cultivation:{label:'Souls Reaped', perStack:{stat:'all_main',op:'pct',value:5}, defaultStacks:10, maxStacks:500} },
  hx_cursed:   { name:'Undying Cursed', rarity:'hexxed', desc:'Lower HP → up to +200% damage. At 20% HP: 50% Lifesteal & 100% Resilience.', passive:[], situational:[{id:'hxc-20', label:'At 20% HP', passive:[{stat:'atk',op:'pct',value:160},{stat:'lifesteal',op:'add',value:50},{stat:'resilience',op:'add',value:100}]}, {id:'hxc-50', label:'At 50% HP', passive:[{stat:'atk',op:'pct',value:100}]}] },
  hx_angel:    { name:'Fallen Angelic', rarity:'hexxed', desc:'+400% Heal Power. Healing mirrors fully. -20% Heal Power per hit taken.', passive:[{stat:'heal_pow',op:'add',value:400}] },
  hx_ryoiki:   { name:'Overcharged Ryoiki', rarity:'hexxed', desc:'Start: shield = 100% HP. MAX HP round → +50% HP shield. +5% HP shield per attack.', passive:[], situational:[{id:'hxr-base', label:'Base shield (100% HP)', desc:'Shield only. No stat change.', passive:[]}] },
  hx_temp:     { name:'FTL Temporal', rarity:'hexxed', desc:'You get 3 turns per round.', passive:[], notes:'Action economy. No direct stat impact.' },
  hx_spirit:   { name:'Mastered Spiritual', rarity:'hexxed', desc:'+90% Cooldown Reduction. Repeated moves get x1.5 effectiveness.', passive:[{stat:'cooldown_red',op:'add',value:90}] },
  hx_giant:    { name:'Colossus Slayer', rarity:'hexxed', desc:'Become microscopic. More damage the bigger your target.', passive:[], situational:[{id:'hxcs-huge', label:'Target is COLOSSAL', passive:[{stat:'atk',op:'pct',value:200}]}] },
  hx_goliath:  { name:"Cappy's Goliath", rarity:'hexxed', desc:'Size x20. More damage the smaller your target.', passive:[], situational:[{id:'hxcg-tiny', label:'Target is microscopic', passive:[{stat:'atk',op:'pct',value:200}]}] },
  hx_adapt:    { name:'Unbound Adaptation', rarity:'hexxed', desc:'Hit by enemy → +50% DEF vs them. 4 hits → permanent immunity to that enemy.', passive:[], situational:[{id:'hxua-stk', label:'Per stack vs an enemy', passive:[{stat:'def',op:'pct',value:50}]}] },
  hx_blood:    { name:'Monstrous Bloodlust', rarity:'hexxed', desc:'-10% HP/round. x3 Lifesteal. Hits +10% HP cost, lifesteal doubles. +5% Resilience.', passive:[{stat:'lifesteal',op:'mul',value:3},{stat:'resilience',op:'add',value:5}] },
  hx_glass:    { name:'Crystalized Glass Cannon', rarity:'hexxed', desc:'+400% ATK, -100% DEF, -99% HP.', passive:[{stat:'atk',op:'pct',value:400},{stat:'def',op:'pct',value:-100},{stat:'hp',op:'pct',value:-99}] },
  hx_magic:    { name:'Magical Girlypops', rarity:'hexxed', desc:'Whole party transforms: +20% all stats, x2 MAG.', passive:[{stat:'all_main',op:'pct',value:20},{stat:'mag',op:'mul',value:2}] },
  hx_nest:     { name:'Death-Defying Nesting Doll', rarity:'hexxed', desc:'5 revives. -20% HP and -20% ATK per revive.', passive:[], situational:[{id:'hxnd-1', label:'After 1 revive', passive:[{stat:'hp',op:'pct',value:-20},{stat:'atk',op:'pct',value:-20}]}, {id:'hxnd-5', label:'After 5 revives', passive:[{stat:'hp',op:'pct',value:-100},{stat:'atk',op:'pct',value:-100}]}] },
  hx_veng:     { name:"Warlord's Vengeance", rarity:'hexxed', desc:'Per ally dead: x5 stats. All dead: lose all DEF, x10 all stats, +80% Lifesteal.', passive:[], situational:[{id:'hxv-1', label:'1 ally down (x5 stats)', passive:[{stat:'all_main',op:'mul',value:5}]}, {id:'hxv-all', label:'All allies down', passive:[{stat:'all_main',op:'mul',value:10},{stat:'def',op:'mul',value:0},{stat:'lifesteal',op:'add',value:80}]}] },
  hx_raid:     { name:'Final Raid Boss', rarity:'hexxed', desc:'Skip turn 1, immune to damage. After: x4 stats. Healing/buffs/shields on you x1.5. +50% Status Res.', passive:[], situational:[{id:'hxrb-loose', label:'After turn 1 (released)', passive:[{stat:'all_main',op:'mul',value:4},{stat:'status_res',op:'add',value:50}]}] },
  hx_sticky:   { name:'Fingering Sticky', rarity:'hexxed', desc:'your fingers are very sticky :) also u get the sticky fingers stand.', passive:[], notes:'Flavor / reference trait.' },
  hx_spicy:    { name:'Determined Spicy', rarity:'hexxed', desc:'+90% Resilience (capped). Surviving on 1HP → x2 all stats infinitely.', passive:[{stat:'resilience',op:'add',value:90}], situational:[{id:'hxds-1', label:'Survived once on 1HP (x2 all)', passive:[{stat:'all_main',op:'mul',value:2}]}, {id:'hxds-2', label:'Survived twice on 1HP (x4 all)', passive:[{stat:'all_main',op:'mul',value:4}]}] },
  hx_armor:    { name:'Full-Plate Armored', rarity:'hexxed', desc:'x10 DEF', passive:[{stat:'def',op:'mul',value:10}] },
};

const RARITY_ORDER = ['common','rare','epic','legendary','mythic','hexxed'];
const RARITY_LABEL = { common:'COMMON', rare:'RARE', epic:'EPIC', legendary:'LEGENDARY', mythic:'MYTHIC', hexxed:'HEXXED' };
const RARITY_WEIGHTS = { common:60, rare:30, epic:18.4, legendary:1.5, mythic:0.1, hexxed:0.02 };
const PITY_WEIGHTS   = { common:0,  rare:0,  epic:5,    legendary:85,  mythic:9,   hexxed:1   };

function rollRarity(weights) {
  const w = weights || RARITY_WEIGHTS;
  const total = Object.values(w).reduce((a,b) => a+b, 0);
  let r = Math.random() * total;
  for (const [k,wt] of Object.entries(w)) {
    if (r < wt) return k;
    r -= wt;
  }
  return Object.keys(w).find(k => w[k] > 0) || 'common';
}

function rollOneTrait(rarityOverride, weights) {
  const rarity = rarityOverride || rollRarity(weights);
  const pool = Object.entries(TRAITS).filter(([k,t]) => t.rarity === rarity);
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
    if (!seen.has(k)) { seen.add(k); hand.push(k); }
    tries++;
  }
  return hand;
}

// ============================================================
// GOLD / TREASURY
// ============================================================
function formatGold(n) {
  return Math.abs(Math.round(n)).toLocaleString();
}

function updateGoldDisplay(c) {
  const amtEl = document.getElementById('cv-gold-amount');
  if (amtEl) amtEl.textContent = formatGold(c.gold || 0);
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
  if (direction < 0 && amount > current) { notify("NOT ENOUGH GOLD!", 'err'); return; }
  c.gold = current + direction * amount;
  c.goldHistory = c.goldHistory || [];
  c.goldHistory.unshift({
    amount: direction * amount,
    note: note || (direction > 0 ? 'Added' : 'Removed'),
    ts: Date.now(),
    balance: c.gold
  });
  if (c.goldHistory.length > 200) c.goldHistory.length = 200;

  saveData();
  playSound('save', { rate: direction > 0 ? 1.1 : 0.9, volume: 0.8 });
  renderGoldManager(c);
  updateGoldDisplay(c);
  document.getElementById('gold-input').value = '';
  document.getElementById('gold-note').value = '';
}

function renderGoldManager(c) {
  document.getElementById('gold-balance-amount').textContent = formatGold(c.gold || 0) + ' G';
  const list = document.getElementById('gold-history-list');
  const history = c.goldHistory || [];
  if (!history.length) {
    list.innerHTML = '<div class="gold-no-history">NO TRANSACTIONS YET</div>';
    return;
  }
  list.innerHTML = history.map(tx => {
    const sign = tx.amount >= 0 ? '+' : '-';
    const cls  = tx.amount >= 0 ? 'pos' : 'neg';
    const d    = new Date(tx.ts);
    const date = d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
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
  if (c) { c.pity = traitPity; saveData(); }
}

function updatePityDisplay() {
  const countEl = document.getElementById('pity-count');
  const fillEl  = document.getElementById('pity-fill');
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
  getActiveTraits(c).forEach(({key, def}) => {
    (def.passive || []).forEach(p => out.push({ ...p, _src:key }));
    (def.situational || []).forEach(sit => {
      if (triggers[key + ':' + sit.id]) {
        (sit.passive || []).forEach(p => out.push({ ...p, _src:key+':'+sit.id }));
      }
    });
    if (def.cultivation) {
      const n = stacks[key] != null ? stacks[key] : (def.cultivation.defaultStacks || 0);
      const per = def.cultivation.perStack;
      if (per && n > 0) {
        out.push({ ...per, value: per.value * n, _src:key+':cult'});
      }
    }
  });
  return out;
}

function applyMainStatPassive(stat, p, addMap, pctMap, mulMap, baseSnapshot, derivedAdd) {
  if (p.op === 'add') addMap[stat] = (addMap[stat]||0) + p.value;
  else if (p.op === 'pct') pctMap[stat] = (pctMap[stat]||0) + p.value;
  else if (p.op === 'mul') mulMap[stat] = (mulMap[stat]||1) * p.value;
}

// Patch existing getEffectiveStats: inject trait passives as synthetic item
// mods so derived substat scaling (e.g. heal_pow from MAG) inherits trait boosts.
const _origGetEffectiveStats = getEffectiveStats;
const MAIN_STATS = ['hp','atk','def','mag','spd'];
const SUB_STATS  = ['heal_pow','crit_rate','crit_dmg','status_res','dexterity','resilience','true_dmg','lifesteal','cooldown_red'];

function _traitPassivesToMods(passives) {
  const expanded = [];
  passives.forEach(p => {
    if (p.op === 'derived') return; // handled later
    // resilience is hard-capped at 50% inside orig; handle it in the post-pass instead.
    if (p.stat === 'resilience') return;
    const stats = p.stat === 'all_main' ? MAIN_STATS : [p.stat];
    stats.forEach(stat => {
      if (p.op === 'add') {
        expanded.push({ stat, op: 'add', value: p.value });
      } else if (p.op === 'pct') {
        expanded.push({ stat, op: 'mul', value: 1 + p.value/100 });
      } else if (p.op === 'mul') {
        expanded.push({ stat, op: 'mul', value: p.value });
      }
    });
  });
  return expanded;
}

getEffectiveStats = function(c) {
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
    const sitButtons = renderTraitSituationals(c, key);
    return `
      <div class="trait-chip rar-${rarity}" data-trait="${key}">
        <div class="trait-chip-rarity">${RARITY_LABEL[rarity]}</div>
        <div class="trait-chip-name">${t.name}</div>
        <div class="trait-chip-desc">${t.desc}</div>
        ${sitButtons}
        <button class="trait-chip-remove" onclick="removeTrait('${key}', event)" title="Remove trait">✕</button>
      </div>`;
  }).join('');
}

function renderTraitSituationals(c, key) {
  const t = TRAITS[key];
  if (!t || !t.situational || !t.situational.length) return '';
  const triggers = c.traitTriggers || {};
  const buttons = t.situational
    .filter(sit => sit.passive && sit.passive.length > 0)
    .map(sit => {
      const id = key+':'+sit.id;
      const on = !!triggers[id];
      return `<button class="trait-trigger-btn ${on?'on':''}" onclick="toggleTraitTrigger('${id}', event)" data-tooltip="${(sit.desc||'Toggle this scenario to preview your stats.')}">&#9889; ${sit.label}${on?' ON':''}</button>`;
    }).join('');
  if (!buttons) return '';
  return `<div class="trait-triggers">${buttons}</div>`;
}

function buildTraitTooltip(c, key) {
  const t = TRAITS[key];
  if (!t) return '';
  // Show concrete stat deltas this trait contributes RIGHT NOW.
  const baseNoTrait = JSON.parse(JSON.stringify(c));
  baseNoTrait.traits = (baseNoTrait.traits || []).filter(k => k !== key);
  const withTrait = c;
  const a = _origGetEffectiveStats(baseNoTrait); // raw base
  // To isolate THIS trait's effect, build full eff with and without
  const fullWith = getEffectiveStats(withTrait);
  const fullWithout = getEffectiveStats(baseNoTrait);

  const MAIN = ['hp','atk','def','mag','spd'];
  const SUB  = ['heal_pow','crit_rate','crit_dmg','status_res','dexterity','resilience','true_dmg','lifesteal','cooldown_red'];
  const labels = {hp:'HP',atk:'ATK',def:'DEF',mag:'MAG',spd:'SPD',heal_pow:'Heal Power',crit_rate:'Crit Chance',crit_dmg:'Crit DMG',status_res:'Status Res',dexterity:'Dexterity',resilience:'Resilience',true_dmg:'True DMG',lifesteal:'Lifesteal',cooldown_red:'CDR'};

  let lines = '';
  MAIN.concat(SUB).forEach(s => {
    const diff = fullWith[s] - fullWithout[s];
    if (Math.abs(diff) > 0.05) {
      const sign = diff > 0 ? '+' : '';
      const cls = diff > 0 ? 'tt-pos' : 'tt-neg';
      const suffix = SUB.includes(s) ? '%' : '';
      lines += `<div class='tt-line'><span class='tt-stat'>${labels[s]}</span><span class='${cls}'>${sign}${diff.toFixed(SUB.includes(s)?1:0)}${suffix}</span></div>`;
    }
  });

  let extras = '';
  if (t.situational?.length) extras += `<div class='tt-extra'>⚡ Has ${t.situational.length} situational trigger${t.situational.length>1?'s':''}.</div>`;
  if (t.cultivation) extras += `<div class='tt-extra'>📈 Cultivates: ${t.cultivation.label}.</div>`;
  if (t.notes) extras += `<div class='tt-note'>${t.notes}</div>`;
  if (!lines) lines = `<div class='tt-note'>No direct stat change while passive. See description.</div>`;

  return `<div class='tt-header rar-${t.rarity}'>${RARITY_LABEL[t.rarity]} • ${t.name}</div><div class='tt-desc'>${t.desc}</div><div class='tt-breakdown'>${lines}</div>${extras}`;
}

function toggleTraitTrigger(triggerKey, ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.traitTriggers = c.traitTriggers || {};
  c.traitTriggers[triggerKey] = !c.traitTriggers[triggerKey];
  saveData();
  updateLiveStats(c);
  renderTraitsDisplay(c);
}

function removeTrait(key, ev) {
  if (ev) ev.stopPropagation();
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.traits = (c.traits || []).filter(k => k !== key);
  playSound('delete');
  // Clean up triggers/stacks for removed trait
  if (c.traitTriggers) {
    Object.keys(c.traitTriggers).forEach(tk => { if (tk.startsWith(key+':')) delete c.traitTriggers[tk]; });
  }
  if (c.traitStacks) delete c.traitStacks[key];
  saveData();
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

    return `
      <div class="codex-section rar-${rar}">
        <div class="codex-section-title">
          <span class="codex-rar-tag rar-${rar}">${RARITY_LABEL[rar]} (${countSeen}/${countTotal})</span>
          <span class="codex-rar-chance">${RARITY_WEIGHTS[rar]}% chance</span>
        </div>
        <div class="codex-list">
          ${seenOfRarity.map(([k, t]) => `
            <div class="codex-entry rar-${rar}">
              <div class="codex-entry-name">${t.name}</div>
              <div class="codex-entry-desc">${t.desc}</div>
            </div>
          `).join('')}
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

  const overlay   = document.getElementById('trait-roll-overlay');
  const title     = document.getElementById('roll-phase-title');
  const sub       = document.getElementById('roll-phase-sub');
  const actions   = document.getElementById('roll-phase-actions');
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
    const rarities = currentHand.map(k => TRAITS[k].rarity);
    if (rarities.includes('hexxed')) {
      finalPity = 0;
    } else if (rarities.includes('mythic')) {
      finalPity = Math.max(0, traitPity - 80);
    } else if (rarities.includes('legendary')) {
      finalPity = Math.max(0, traitPity - 40);
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
      const key = currentHand[i];
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
        }, 380);
      }
    }, delay);
  });
}

function rerollHand() {
  rollTraits();
}

function pickTraitFromHand(key) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  c.traits = c.traits || [];

  // "Bravest of the Brave" mythic: grants 2 bonus rare/epic
  if (key === 'brave') {
    c.traits = ['brave'];
    const pool = Object.entries(TRAITS).filter(([,t]) => t.rarity==='rare' || t.rarity==='epic').map(([k])=>k);
    const seen = new Set(['brave']);
    while (c.traits.length < 3) {
      const k = pool[Math.floor(Math.random()*pool.length)];
      if (!seen.has(k)) { seen.add(k); c.traits.push(k); }
    }
  } else {
    c.traits = [key];
  }

  // Reset triggers/stacks for the new selection
  c.traitTriggers = {};
  c.traitStacks = {};
  c.traits.forEach(k => {
    const t = TRAITS[k];
    if (t?.cultivation) c.traitStacks[k] = t.cultivation.defaultStacks || 0;
  });

  saveData();
  playSound('equip', { rate: 1.15, volume: 0.9 });
  closeTraitRoll();
  viewChar(currentId);
  const t = TRAITS[key];
  notify(`${RARITY_LABEL[t.rarity]}: ${t.name}!`, 'ok');
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
    const t = TRAITS[key];
    const cult = t.cultivation;
    const stacks = c.traitStacks[key] != null ? c.traitStacks[key] : (cult.defaultStacks || 0);
    return `
      <div class="cult-block rar-${t.rarity}" data-key="${key}">
        <div class="cult-block-header">
          <span class="cult-tag rar-${t.rarity}">${RARITY_LABEL[t.rarity]}</span>
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
  const max = TRAITS[key].cultivation.maxStacks;
  const cur = c.traitStacks[key] != null ? c.traitStacks[key] : (TRAITS[key].cultivation.defaultStacks || 0);
  const next = Math.max(0, Math.min(max, cur + delta));
  c.traitStacks[key] = next;
  const input = document.getElementById('cult-input-'+key);
  if (input) input.value = next;
  const slider = document.querySelector(`.cult-block[data-key="${key}"] .cult-slider`);
  if (slider) slider.value = next;
  saveData();
  refreshCultivationPreviews();
  updateLiveStats(c);
  renderTraitsDisplay(c);
}
function setStacks(key, val) {
  const c = characters.find(x => x.id === currentId);
  if (!c) return;
  const max = TRAITS[key].cultivation.maxStacks;
  const v = Math.max(0, Math.min(max, parseInt(val) || 0));
  c.traitStacks = c.traitStacks || {};
  c.traitStacks[key] = v;
  saveData();
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
    const stat = (k, label, suffix='') => {
      const diff = eff[k] - _origGetEffectiveStats(without)[k];
      if (Math.abs(diff) < 0.5 && !suffix) return '';
      const sign = diff>0?'+':'';
      return `<div class='cult-stat-row'><span>${label}</span><span class='${diff>0?"tt-pos":"tt-neg"}'>${sign}${diff.toFixed(suffix?1:0)}${suffix}</span></div>`;
    };
    const html = ['hp','atk','def','mag','spd'].map(k => stat(k, k.toUpperCase())).join('');
    const el = document.getElementById('cult-preview-'+key);
    if (el) el.innerHTML = `<div class='cult-preview-title'>SCALED STAT DELTA</div>${html || '<div class="cult-stat-row"><span>-</span><span>-</span></div>'}`;
  });
}

// ============================================================
// HOOK TRAIT RENDER INTO viewChar
// ============================================================
const _origViewChar = viewChar;
viewChar = function(id) {
  _origViewChar(id);
  const c = characters.find(x => x.id === id);
  if (c) renderTraitsDisplay(c);
};
const _origUpdateLiveStats = updateLiveStats;
updateLiveStats = function(c) {
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
      .map(d => d.data())
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    renderSidebar();

    const isSelf = currentId === _lastSaveId && (Date.now() - _lastSaveTime < SELF_WRITE_WINDOW);

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