// ============================================================
// ENCYCLOPÆDIA — encyclopedia.js
// ============================================================

// ── Firebase ──────────────────────────────────────────────
const ENC_FB_CONFIG = {
  apiKey:            "AIzaSyBRtoLzS--wz_6sD4rWMgzcwZnHVHUBNdg",
  authDomain:        "statsheets-3668d.firebaseapp.com",
  projectId:         "statsheets-3668d",
  storageBucket:     "statsheets-3668d.firebasestorage.app",
  messagingSenderId: "558910483943",
  appId:             "1:558910483943:web:c468342f15569a4cf0e142"
};
let db = null;
try {
  firebase.initializeApp(ENC_FB_CONFIG, 'encyclopedia');
  db = firebase.app('encyclopedia').firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
} catch(e) { console.error('Encyclopedia Firebase init failed:', e); }

// ── State ─────────────────────────────────────────────────
let encSection    = 'characters';
let encIdx        = 0;
let encCharacters = [];
let encPlaces     = [];
let encStatuses   = [];
let encMemories   = [];

// editing state
let _placeEditing    = null;
let _statusEditing   = null;
let _memoryEditing   = null;
let _placeImgData    = null;
let _memoryImgData   = null;
let _statusStars     = 1;
let _sceneEditing    = null; // { memId, sceneIdx } or null
let _pendingConfirm  = null;

// ── Section config ────────────────────────────────────────
const SECTION_CFG = {
  characters: { label: 'CHARACTERS',    sub: 'CHARACTER PROFILES',  col: '#c9a227' },
  places:     { label: 'PLACES',        sub: 'LOCATIONS & REALMS',  col: '#2a9d8f' },
  statuses:   { label: 'STATUS EFFECTS',sub: 'BUFFS, DEBUFFS & FX', col: '#8b5cf6' },
  memories:   { label: 'MEMORIES',      sub: 'CHAPTERS & SCENES',   col: '#e76f51' },
};

// AB_TYPE_COLORS mirror for ability icons (no dependency on script.js)
const ENC_AB_COLORS = {
  ACTIVE:   { text:'#00ffff', icon:'⚡︎' },
  PASSIVE:  { text:'#cc99ff', icon:'◈' },
  REACTION: { text:'#ffff44', icon:'↺' },
  TOGGLE:   { text:'#00ff80', icon:'⇌' },
  AURA:     { text:'#5599ff', icon:'◎' },
  ULTIMATE: { text:'#ff8844', icon:'★' },
};

// Stat gradient: red(low) → yellow(mid) → green(high)
function statColor(val, max) {
  const r = Math.min(Math.max(val / max, 0), 1);
  if (r < 0.5) {
    const t = r * 2;
    return `rgb(${255},${Math.round(80 + 175 * t)},${Math.round(40 + 30 * t)})`;
  }
  const t = (r - 0.5) * 2;
  return `rgb(${Math.round(255 - 210 * t)},${Math.round(255)},${Math.round(70 + 60 * t)})`;
}
function statPercent(val, max) { return Math.min(Math.max(val / max, 0), 1) * 100; }

// ── Helpers ───────────────────────────────────────────────
function encNotify(msg, type) {
  const el = document.getElementById('notif');
  if (!el) return;
  el.textContent = msg;
  el.className = 'notif-' + (type || 'ok');
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function stripUndef(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndef);
  return Object.fromEntries(
    Object.entries(obj).filter(([,v]) => v !== undefined).map(([k,v]) => [k, stripUndef(v)])
  );
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

function getList() {
  switch(encSection) {
    case 'characters': return encCharacters;
    case 'places':     return encPlaces;
    case 'statuses':   return encStatuses;
    case 'memories':   return encMemories;
    default:           return [];
  }
}

// ── Firebase I/O ──────────────────────────────────────────
function saveEncData() {
  if (!db) return;
  db.collection('enc').doc('data').set(stripUndef({
    places:   encPlaces,
    statuses: encStatuses,
    memories: encMemories,
  }), { merge: false }).catch(e => console.error('Enc save failed:', e));
}

function initFirestore() {
  if (!db) { renderLeft(); renderRight(); return; }

  // Characters (read-only)
  db.collection('characters').onSnapshot(snap => {
    encCharacters = snap.docs.map(d => d.data()).sort((a,b) => {
      const ao = a.order != null ? a.order : (a.createdAt || 0);
      const bo = b.order != null ? b.order : (b.createdAt || 0);
      return ao - bo;
    });
    if (encSection === 'characters') { renderLeft(); renderRight(); }
  }, () => {});

  // Encyclopedia data
  db.collection('enc').doc('data').onSnapshot(snap => {
    const d = snap.data() || {};
    encPlaces   = d.places   || [];
    encStatuses = d.statuses || [];
    encMemories = d.memories || [];
    if (encSection !== 'characters') { renderLeft(); renderRight(); }
  }, () => {});
}

// ── Section switching ─────────────────────────────────────
function switchSection(section) {
  encSection = section;
  encIdx     = 0;
  applySectionColor();
  renderLeft();
  renderRight('next');
}

function applySectionColor() {
  const col = SECTION_CFG[encSection].col;
  document.getElementById('enc-book').style.setProperty('--enc-col', col);
  document.querySelectorAll('.enc-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.section === encSection);
  });
  const cfg = SECTION_CFG[encSection];
  document.getElementById('enc-idx-label').textContent = cfg.label;
  document.getElementById('enc-idx-sub').textContent   = cfg.sub;
  document.getElementById('enc-page-info').style.color = col + '44';
  document.querySelector('.enc-modal-title') && null; // handled per-modal
}

// ── Navigation ────────────────────────────────────────────
function encNav(dir) {
  const list = getList();
  if (dir === 'next' && encIdx < list.length - 1) { encIdx++; renderRight('next'); updateToC(); }
  else if (dir === 'prev' && encIdx > 0)           { encIdx--; renderRight('prev'); updateToC(); }
}

function encGoTo(idx) {
  const dir = idx >= encIdx ? 'next' : 'prev';
  encIdx = idx;
  renderRight(dir);
  updateToC();
}

function updateToC() {
  document.querySelectorAll('.enc-toc-item').forEach((el, i) => {
    el.classList.toggle('active', i === encIdx);
  });
}

function updateNav() {
  const list = getList();
  const prev = document.getElementById('enc-prev-btn');
  const next = document.getElementById('enc-next-btn');
  const info = document.getElementById('enc-page-info');
  prev.disabled = (encIdx <= 0);
  next.disabled = (encIdx >= list.length - 1);
  if (list.length === 0) {
    info.textContent = '— —';
  } else {
    info.textContent = `${encIdx + 1}  /  ${list.length}`;
  }
}

// ── Left page (ToC) ───────────────────────────────────────
function renderLeft() {
  const toc  = document.getElementById('enc-toc');
  const ft   = document.getElementById('enc-left-ft-content');
  const list = getList();

  toc.innerHTML = list.map((item, i) => {
    const name = item.name || item.title || 'UNNAMED';
    const dotColor = item.color || SECTION_CFG[encSection].col;
    return `<div class="enc-toc-item${i === encIdx ? ' active' : ''}" onclick="encGoTo(${i})">
      <span class="enc-toc-n">${toRoman(i + 1)}</span>
      <span class="enc-toc-txt">${esc(name)}</span>
      <span class="enc-toc-dot" style="background:${dotColor}"></span>
    </div>`;
  }).join('') || `<div style="padding:20px;font-size:9px;color:#2a1808;text-align:center;letter-spacing:2px;">NOTHING YET</div>`;

  // Footer action
  if (encSection === 'characters') {
    ft.innerHTML = `<button class="btn sm" style="width:100%;font-size:8px;" onclick="location.href='index.html'">GO TO MAIN APP ↗</button>`;
  } else {
    const label = encSection === 'places' ? 'NEW PLACE' :
                  encSection === 'statuses' ? 'NEW STATUS' : 'NEW CHAPTER';
    const fn    = encSection === 'places' ? 'openPlaceModal(null)' :
                  encSection === 'statuses' ? 'openStatusModal(null)' : 'openMemoryModal(null)';
    ft.innerHTML = `<button class="btn sm accent" style="width:100%;font-size:8px;" onclick="${fn}">+ ${label}</button>`;
  }
}

function toRoman(n) {
  const v = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const s = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let r = '';
  v.forEach((val,i) => { while(n >= val){ r += s[i]; n -= val; } });
  return r;
}

// ── Right page (entry detail) ─────────────────────────────
function renderRight(dir) {
  const content = document.getElementById('enc-content');
  const list    = getList();

  const apply = () => {
    if (list.length === 0) {
      content.innerHTML = emptyState();
    } else {
      const item = list[encIdx];
      switch(encSection) {
        case 'characters': content.innerHTML = renderCharEntry(item);   break;
        case 'places':     content.innerHTML = renderPlaceEntry(item);  break;
        case 'statuses':   content.innerHTML = renderStatusEntry(item); break;
        case 'memories':   content.innerHTML = renderMemoryEntry(item); break;
      }
    }
    updateNav();
    document.getElementById('enc-content-scroll').scrollTop = 0;
  };

  if (dir) {
    content.classList.remove('enc-anim-next', 'enc-anim-prev');
    void content.offsetWidth;
    content.classList.add(dir === 'next' ? 'enc-anim-next' : 'enc-anim-prev');
  }
  apply();
  // Animate any stat bars that were rendered
  try { animateStatBars(); } catch(e) {}
}

function emptyState() {
  const cfg = SECTION_CFG[encSection];
  const msgs = {
    characters: { icon:'⚔', title:'NO CHARACTERS', sub:'CREATE CHARACTERS IN THE MAIN APP' },
    places:     { icon:'◈', title:'NO PLACES YET',  sub:'ADD YOUR FIRST LOCATION ENTRY' },
    statuses:   { icon:'✦', title:'NO STATUS EFFECTS', sub:'DOCUMENT YOUR BUFFS & DEBUFFS' },
    memories:   { icon:'✦', title:'NO CHAPTERS YET', sub:'BEGIN WRITING YOUR STORY' },
  };
  const m = msgs[encSection];
  return `<div class="enc-empty">
    <div class="enc-empty-icon">${m.icon}</div>
    <div class="enc-empty-title">${m.title}</div>
    <div class="enc-empty-sub">${m.sub}</div>
  </div>`;
}

// ── STAT BARS (replaces radar) ─────────────────────────────
function renderStatRadar(st, col) {
  // Keep same API name to minimize code changes elsewhere.
  const HP_MAX = 500, STAT_MAX = 100;
  const stats = [
    { key: 'hp',  label: 'HP',  val: st.hp  || 0, max: HP_MAX  },
    { key: 'atk', label: 'ATK', val: st.atk || 0, max: STAT_MAX },
    { key: 'def', label: 'DEF', val: st.def || 0, max: STAT_MAX },
    { key: 'mag', label: 'MAG', val: st.mag || 0, max: STAT_MAX },
    { key: 'spd', label: 'SPD', val: st.spd || 0, max: STAT_MAX },
  ];

  const rows = stats.map(s => {
    const pct = Math.round(statPercent(s.val, s.max));
    const color = statColor(s.val, s.max);
    return `
      <div class="enc-stat-bar-row">
        <div class="enc-stat-bar-meta">
          <div class="enc-stat-bar-label">${s.label}</div>
          <div class="enc-stat-bar-value">${s.val}</div>
        </div>
        <div class="enc-stat-bar-track" aria-hidden="true">
          <div class="enc-stat-bar-fill" data-pct="${pct}" style="width:0%; background:${color}; --pct:${pct}%;"></div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="enc-stat-bars enc-anim-fade" style="animation-delay:0.1s">
      ${rows}
    </div>`;
}

// Animate stat bar fills after render
function animateStatBars() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.enc-stat-bar-fill').forEach(el => {
      const pct = el.getAttribute('data-pct') || '0';
      // small stagger
      const delay = Math.min(200, Math.random() * 160);
      setTimeout(() => { el.style.width = pct + '%'; }, delay);
    });
  });
}

// ── CHARACTER ENTRY ───────────────────────────────────────
function renderCharEntry(c) {
  if (!c) return '';
  const info = c.info || {};
  const col  = c.color || '#c9a227';
  const st   = c.stats || {};

  // ── Radar chart ──
  const statsHtml = renderStatRadar(st, col);

  // ── Portrait ──
  const avatar = c.avatar
    ? `<div class="enc-char-portrait-frame" style="border-color:${col}44"><img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;display:block;"></div>`
    : `<div class="enc-char-portrait-frame" style="border-color:${col}22"><span class="enc-char-portrait-ph" style="color:${col}33">◈</span></div>`;

  // ── Traits ──
  const traitsHtml = (c.traits || []).slice(0, 14).map((t, i) =>
    `<span class="enc-char-tag enc-anim-fade" style="animation-delay:${0.3 + i * 0.04}s">${esc(t.replace(/_/g,' '))}</span>`
  ).join('');

  // ── Abilities ──
  const abilitiesHtml = (c.abilities || []).map((ab, i) => {
    const tc = ENC_AB_COLORS[ab.type] || ENC_AB_COLORS.ACTIVE;
    return `<div class="enc-char-ability-row enc-anim-fade" style="animation-delay:${0.25 + i * 0.06}s">
      <span class="enc-char-ability-icon" style="color:${tc.text}">${tc.icon}</span>
      <span class="enc-char-ability-name">${esc(ab.name || 'UNNAMED')}</span>
      <span class="enc-char-ability-type" style="color:${tc.text}">${ab.type || 'ACTIVE'}</span>
    </div>`;
  }).join('');

  // ── Passives ──
  const passivesHtml = (c.charPassives || []).filter(p => p).map((p, i) =>
    `<div class="enc-char-passive-row enc-anim-fade" style="animation-delay:${0.2 + i * 0.05}s">${esc(p)}</div>`
  ).join('');

  // ── Info fields ──
  const infoFields = [
    ['RACE',        info.race],
    ['AGE',         info.age],
    ['PRONOUNS',    info.pronouns],
    ['HEIGHT',      info.height],
    ['ORIGIN',      info.origin],
    ['OCCUPATION',  info.occupation],
    ['AFFILIATION', info.affiliation],
    ['OWNER',       info.owner],
  ].filter(([,v]) => v);

  const infoGridHtml = infoFields.map(([l,v], i) => `
    <div class="enc-info-field enc-anim-fade" style="animation-delay:${0.15 + i * 0.05}s">
      <div class="enc-info-lbl">${l}</div>
      <div class="enc-info-val">${esc(v)}</div>
    </div>`).join('');

  return `
    <div class="enc-char-hero enc-anim-fade" style="animation-delay:0s">
      ${avatar}
      <div class="enc-char-hero-info">
        <div class="enc-entry-name enc-char-name-big" style="color:${col};text-shadow:0 0 30px ${col}44">${esc(c.name || 'UNNAMED')}</div>
        <div class="enc-char-color-band" style="background:linear-gradient(90deg,${col},transparent)"></div>
        ${infoFields.length ? `<div class="enc-char-quick-tags">
          ${infoFields.slice(0,4).map(([l,v]) => `<span class="enc-char-quick-tag">${esc(v)}</span>`).join('<span class="enc-char-quick-sep">·</span>')}
        </div>` : ''}
      </div>
    </div>
    <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.08s">⬥ COMBAT STATS</div>
    ${statsHtml}
    ${traitsHtml ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.28s">⬥ TRAITS</div>
      <div class="enc-char-tags-row">${traitsHtml}</div>` : ''}
    ${infoGridHtml ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.35s">⬥ IDENTITY</div>
      <div class="enc-char-info-grid">${infoGridHtml}</div>` : ''}
    ${info.bio ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.4s">⬥ BIOGRAPHY</div>
      <div class="enc-body-text enc-anim-fade" style="animation-delay:0.42s">${esc(info.bio)}</div>` : ''}
    ${info.personality ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.45s">⬥ PERSONALITY</div>
      <div class="enc-body-text enc-anim-fade" style="animation-delay:0.47s">${esc(info.personality)}</div>` : ''}
    ${(info.goals || info.fears) ? `
      <div class="enc-char-info-grid enc-anim-fade" style="animation-delay:0.5s;margin-top:10px">
        ${info.goals ? `<div><div class="enc-info-lbl">GOALS</div><div class="enc-body-text">${esc(info.goals)}</div></div>` : ''}
        ${info.fears ? `<div><div class="enc-info-lbl">FEARS</div><div class="enc-body-text">${esc(info.fears)}</div></div>` : ''}
      </div>` : ''}
    ${abilitiesHtml ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.5s">⬥ ABILITIES</div>
      <div>${abilitiesHtml}</div>` : ''}
    ${passivesHtml ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.55s">⬥ PASSIVES</div>
      <div>${passivesHtml}</div>` : ''}
    ${info.notes ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.6s">⬥ NOTES</div>
      <div class="enc-body-text enc-anim-fade" style="animation-delay:0.62s">${esc(info.notes)}</div>` : ''}
  `;
}

// ── PLACE ENTRY ───────────────────────────────────────────
function renderPlaceEntry(p) {
  if (!p) return '';
  const col = SECTION_CFG.places.col;
  const soundtracksHtml = (p.soundtracks || []).map((st, i) => {
    const embedUrl = ytEmbed(st.url || '');
    return `<div class="enc-soundtrack-item enc-anim-fade" style="animation-delay:${0.35 + i * 0.08}s">
      <div class="enc-soundtrack-hd" onclick="toggleSoundtrack(this)">
        <span class="enc-soundtrack-icon" style="color:${col}">▶</span>
        <span class="enc-soundtrack-lbl">${esc(st.label || ('TRACK ' + (i+1)))}</span>
        <span class="enc-soundtrack-toggle">▼</span>
      </div>
      ${embedUrl ? `<div class="enc-soundtrack-embed">
        <iframe src="${embedUrl}" allowfullscreen loading="lazy"></iframe>
      </div>` : ''}
    </div>`;
  }).join('');

  return `
    ${p.image ? `<img class="enc-place-img enc-anim-fade" style="animation-delay:0s" src="${p.image}" alt="">` : ''}
    <div class="enc-entry-name enc-anim-fade" style="color:${col};text-shadow:0 0 30px ${col}44;animation-delay:0.05s">${esc(p.name || 'UNNAMED')}</div>
    <div class="enc-entry-divider enc-anim-fade" style="background:${col};animation-delay:0.08s"></div>
    <div class="enc-meta-row enc-anim-fade" style="animation-delay:0.12s">
      ${p.type   ? `<span class="enc-badge" style="color:${col};border-color:${col}44">${esc(p.type)}</span>` : ''}
      ${p.region ? `<span class="enc-badge" style="color:#6a5438;border-color:#2a1808">${esc(p.region)}</span>` : ''}
    </div>
    ${p.desc ? `<div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.16s">⬥ DESCRIPTION</div>
                <div class="enc-body-text enc-anim-fade" style="animation-delay:0.19s">${esc(p.desc)}</div>` : ''}
    ${p.lore ? `<div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.22s">⬥ LORE &amp; HISTORY</div>
                <div class="enc-body-text enc-anim-fade" style="animation-delay:0.25s">${esc(p.lore)}</div>` : ''}
    ${p.features ? `<div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.28s">⬥ NOTABLE FEATURES</div>
                    <div class="enc-body-text enc-anim-fade" style="animation-delay:0.31s">${esc(p.features)}</div>` : ''}
    ${soundtracksHtml ? `<div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.33s">⬥ SOUNDTRACKS</div>
                          <div>${soundtracksHtml}</div>` : ''}
    <div class="enc-entry-actions enc-anim-fade" style="animation-delay:0.4s">
      <button class="btn sm" onclick="openPlaceModal('${p.id}')">EDIT</button>
      <button class="btn sm danger" onclick="encConfirmDelete('place','${p.id}')">✕ DELETE</button>
    </div>
  `;
}

// ── STATUS ENTRY ──────────────────────────────────────────
function renderStatusEntry(s) {
  if (!s) return '';
  const col  = s.color || '#aaaaaa';
  const type = s.type  || 'NEUTRAL';
  const TYPE_COLORS = { BUFF:'#44ff88', DEBUFF:'#ff4444', NEUTRAL:'#aaaaaa', PASSIVE:'#cc99ff', UNIQUE:'#ffcc44' };
  const tc = TYPE_COLORS[type] || '#888';
  const starsHtml = Array.from({length:5}, (_,i) =>
    `<span class="enc-star${i < (s.stars||1) ? '' : ' empty'}" style="color:${col}">★</span>`
  ).join('');

  return `
    <div class="enc-status-top enc-anim-fade" style="animation-delay:0s">
      <div class="enc-status-orb" style="--status-col:${col};background:${col}22;border:2px solid ${col}66"></div>
      <div>
        <div class="enc-entry-name" style="color:${col};text-shadow:0 0 30px ${col}44">${esc(s.name || 'UNNAMED')}</div>
        <span class="enc-badge" style="color:${tc};border-color:${tc}44">${type}</span>
      </div>
    </div>
    <div class="enc-entry-divider enc-anim-fade" style="background:${col};animation-delay:0.06s"></div>
    <div class="enc-stars-display enc-anim-fade" style="animation-delay:0.1s">${starsHtml}</div>
    ${s.desc ? `<div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.18s">⬥ EFFECT</div>
                <div class="enc-body-text enc-anim-fade" style="animation-delay:0.22s">${esc(s.desc)}</div>` : ''}
    ${s.duration ? `<div class="enc-anim-fade" style="display:flex;align-items:center;gap:14px;padding:10px 14px;background:#090703;border:1px solid #1e1208;margin-top:14px;animation-delay:0.26s">
      <span style="font-size:8px;color:#3a2810;letter-spacing:3px;">DURATION</span>
      <span style="font-size:11px;color:#6a5438;font-family:'Cinzel',serif;">${esc(s.duration)}</span>
    </div>` : ''}
    <div class="enc-entry-actions enc-anim-fade" style="animation-delay:0.3s">
      <button class="btn sm" onclick="openStatusModal('${s.id}')">EDIT</button>
      <button class="btn sm danger" onclick="encConfirmDelete('status','${s.id}')">✕ DELETE</button>
    </div>
  `;
}

// ── MEMORY ENTRY ──────────────────────────────────────────
function renderMemoryEntry(m) {
  if (!m) return '';
  const col = SECTION_CFG.memories.col;
  const scenes = m.scenes || [];

  const scenesHtml = scenes.map((sc, i) => `
    <div class="enc-scene enc-anim-fade" id="enc-scene-${m.id}-${i}" style="animation-delay:${0.2 + i * 0.08}s">
      ${sc.title ? `<div class="enc-scene-title">${esc(sc.title)}</div>` : ''}
      <div class="enc-scene-text">${esc(sc.text || '')}</div>
      <div class="enc-scene-btns">
        <button class="btn sm" onclick="openSceneForm('${m.id}',${i})">EDIT</button>
        <button class="btn sm danger" onclick="deleteScene('${m.id}',${i})">✕</button>
      </div>
    </div>`).join('');

  return `
    ${m.image ? `<img class="enc-memory-cover enc-anim-fade" style="animation-delay:0s" src="${m.image}" alt="">` : ''}
    <div class="enc-chapter-label enc-anim-fade" style="animation-delay:0.04s">${esc(m.arc || 'CHAPTER')}</div>
    <div class="enc-entry-name enc-anim-fade" style="color:${col};text-shadow:0 0 30px ${col}44;animation-delay:0.07s">${esc(m.title || 'UNTITLED')}</div>
    <div class="enc-entry-divider enc-anim-fade" style="background:${col};animation-delay:0.1s"></div>
    ${m.date ? `<div class="enc-meta-row enc-anim-fade" style="animation-delay:0.13s"><span class="enc-badge" style="color:#6a5438;border-color:#2a1808">${esc(m.date)}</span></div>` : ''}
    <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.16s">⬥ SCENES</div>
    <div class="enc-scenes" id="enc-scenes-${m.id}">${scenesHtml}</div>
    <div class="enc-add-scene-bar enc-anim-fade" style="animation-delay:${0.25 + scenes.length * 0.08}s">
      <button class="btn sm accent" onclick="openSceneForm('${m.id}', null)">+ ADD SCENE</button>
    </div>
    <div id="enc-scene-form-wrap-${m.id}"></div>
    <div class="enc-entry-actions enc-anim-fade" style="animation-delay:${0.3 + scenes.length * 0.08}s">
      <button class="btn sm" onclick="openMemoryModal('${m.id}')">EDIT CHAPTER</button>
      <button class="btn sm danger" onclick="encConfirmDelete('memory','${m.id}')">✕ DELETE CHAPTER</button>
    </div>
  `;
}

// ── SCENE FORM (inline) ───────────────────────────────────
function openSceneForm(memId, sceneIdx) {
  // Close any open form
  document.querySelectorAll('[id^="enc-scene-form-wrap-"]').forEach(el => { el.innerHTML = ''; });

  const mem = encMemories.find(m => m.id === memId);
  if (!mem) return;
  const isEdit = sceneIdx !== null && sceneIdx !== undefined;
  const sc     = isEdit ? (mem.scenes || [])[sceneIdx] || {} : {};

  const wrap = document.getElementById(`enc-scene-form-wrap-${memId}`);
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="enc-scene-form">
      <div class="enc-scene-form-field">
        <label>SCENE TITLE <span style="opacity:0.4">(optional)</span></label>
        <input type="text" id="esf-title" value="${esc(sc.title||'')}" placeholder="e.g. A Quiet Night" maxlength="80"/>
      </div>
      <div class="enc-scene-form-field">
        <label>SCENE TEXT *</label>
        <textarea id="esf-text" rows="6" placeholder="Write what happened in this scene...">${esc(sc.text||'')}</textarea>
      </div>
      <div class="enc-scene-form-btns">
        <button class="btn sm" type="button" onclick="closeSceneForm('${memId}')">CANCEL</button>
        <button class="btn sm accent" type="button" onclick="saveSceneForm('${memId}',${isEdit ? sceneIdx : 'null'})">
          ${isEdit ? 'UPDATE SCENE' : 'ADD SCENE'}
        </button>
      </div>
    </div>`;
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeSceneForm(memId) {
  const wrap = document.getElementById(`enc-scene-form-wrap-${memId}`);
  if (wrap) wrap.innerHTML = '';
}

function saveSceneForm(memId, sceneIdx) {
  const mem = encMemories.find(m => m.id === memId);
  if (!mem) return;
  const title = document.getElementById('esf-title')?.value.trim() || '';
  const text  = document.getElementById('esf-text')?.value || '';
  if (!text.trim()) { encNotify('SCENE NEEDS TEXT', 'err'); return; }
  if (!mem.scenes) mem.scenes = [];
  const sc = { title, text };
  if (sceneIdx !== null && sceneIdx !== undefined) {
    mem.scenes[sceneIdx] = sc;
  } else {
    mem.scenes.push(sc);
  }
  saveEncData();
  closeSceneForm(memId);
  // Re-render just the scenes
  const scenesEl = document.getElementById(`enc-scenes-${memId}`);
  if (scenesEl) {
    scenesEl.innerHTML = mem.scenes.map((s, i) => `
      <div class="enc-scene" id="enc-scene-${memId}-${i}">
        ${s.title ? `<div class="enc-scene-title">${esc(s.title)}</div>` : ''}
        <div class="enc-scene-text">${esc(s.text || '')}</div>
        <div class="enc-scene-btns">
          <button class="btn sm" onclick="openSceneForm('${memId}',${i})">EDIT</button>
          <button class="btn sm danger" onclick="deleteScene('${memId}',${i})">✕</button>
        </div>
      </div>`).join('');
  }
  encNotify(sceneIdx !== null && sceneIdx !== undefined ? 'SCENE UPDATED' : 'SCENE ADDED', 'ok');
}

function deleteScene(memId, sceneIdx) {
  const mem = encMemories.find(m => m.id === memId);
  if (!mem || !mem.scenes) return;
  mem.scenes.splice(sceneIdx, 1);
  saveEncData();
  const scenesEl = document.getElementById(`enc-scenes-${memId}`);
  if (scenesEl) {
    scenesEl.innerHTML = mem.scenes.map((s, i) => `
      <div class="enc-scene">
        ${s.title ? `<div class="enc-scene-title">${esc(s.title)}</div>` : ''}
        <div class="enc-scene-text">${esc(s.text || '')}</div>
        <div class="enc-scene-btns">
          <button class="btn sm" onclick="openSceneForm('${memId}',${i})">EDIT</button>
          <button class="btn sm danger" onclick="deleteScene('${memId}',${i})">✕</button>
        </div>
      </div>`).join('');
  }
  encNotify('SCENE REMOVED', 'ok');
}

// ── PLACE MODAL ───────────────────────────────────────────
function openPlaceModal(id) {
  _placeEditing = id;
  _placeImgData = null;
  const p = id ? encPlaces.find(x => x.id === id) || {} : {};
  document.getElementById('enc-place-modal-title').textContent = id ? 'EDIT PLACE' : 'NEW PLACE';
  document.getElementById('ep-name').value    = p.name     || '';
  document.getElementById('ep-region').value  = p.region   || '';
  document.getElementById('ep-type').value    = p.type     || 'CITY';
  document.getElementById('ep-desc').value    = p.desc     || '';
  document.getElementById('ep-lore').value    = p.lore     || '';
  document.getElementById('ep-features').value = p.features|| '';
  _placeImgData = p.image || null;
  renderEncImgPreview('place');
  // Soundtracks
  const stList = document.getElementById('ep-soundtracks-list');
  stList.innerHTML = '';
  (p.soundtracks || []).forEach(st => addSoundtrackRow(st.label, st.url));
  document.getElementById('enc-place-overlay').classList.add('open');
}

function closePlaceModal() {
  document.getElementById('enc-place-overlay').classList.remove('open');
  _placeEditing = null; _placeImgData = null;
  document.getElementById('ep-img-file').value = '';
}

function savePlaceModal() {
  const name = document.getElementById('ep-name').value.trim();
  if (!name) { encNotify('PLACE NEEDS A NAME', 'err'); return; }
  const place = {
    id:         _placeEditing || genId(),
    name,
    region:     document.getElementById('ep-region').value.trim(),
    type:       document.getElementById('ep-type').value,
    desc:       document.getElementById('ep-desc').value.trim(),
    lore:       document.getElementById('ep-lore').value.trim(),
    features:   document.getElementById('ep-features').value.trim(),
    image:      _placeImgData || null,
    soundtracks: collectSoundtracks(),
  };
  if (_placeEditing) {
    const i = encPlaces.findIndex(x => x.id === _placeEditing);
    if (i >= 0) { encPlaces[i] = place; } else { encPlaces.push(place); }
  } else {
    encPlaces.push(place);
    encIdx = encPlaces.length - 1;
  }
  saveEncData();
  closePlaceModal();
  if (encSection === 'places') { renderLeft(); renderRight(); }
  encNotify(_placeEditing ? 'PLACE UPDATED' : 'PLACE ADDED', 'ok');
}

function addSoundtrackRow(label, url) {
  const stList = document.getElementById('ep-soundtracks-list');
  const row = document.createElement('div');
  row.className = 'enc-st-row';
  row.innerHTML = `
    <input type="text" class="enc-st-lbl" placeholder="LABEL" value="${esc(label||'')}" maxlength="60"/>
    <input type="url" style="flex:2" placeholder="https://youtube.com/watch?v=..." value="${esc(url||'')}"/>
    <button class="btn sm danger" type="button" style="flex-shrink:0;padding:4px 8px;font-size:7px;" onclick="this.parentElement.remove()">✕</button>`;
  stList.appendChild(row);
}

function collectSoundtracks() {
  const rows = document.querySelectorAll('#ep-soundtracks-list .enc-st-row');
  return Array.from(rows).map(r => {
    const inputs = r.querySelectorAll('input');
    return { label: inputs[0].value.trim(), url: inputs[1].value.trim() };
  }).filter(st => st.url);
}

// ── STATUS MODAL ──────────────────────────────────────────
function openStatusModal(id) {
  _statusEditing = id;
  const s = id ? encStatuses.find(x => x.id === id) || {} : {};
  document.getElementById('enc-status-modal-title').textContent = id ? 'EDIT STATUS' : 'NEW STATUS EFFECT';
  document.getElementById('es-name').value     = s.name     || '';
  document.getElementById('es-type').value     = s.type     || 'DEBUFF';
  document.getElementById('es-color').value    = s.color    || '#ff4444';
  document.getElementById('es-desc').value     = s.desc     || '';
  document.getElementById('es-duration').value = s.duration || '';
  _statusStars = s.stars || 1;
  renderStarPicker(_statusStars);
  document.getElementById('enc-status-overlay').classList.add('open');
}

function closeStatusModal() {
  document.getElementById('enc-status-overlay').classList.remove('open');
  _statusEditing = null;
}

function saveStatusModal() {
  const name = document.getElementById('es-name').value.trim();
  if (!name) { encNotify('STATUS NEEDS A NAME', 'err'); return; }
  const status = {
    id:       _statusEditing || genId(),
    name,
    type:     document.getElementById('es-type').value,
    color:    document.getElementById('es-color').value,
    desc:     document.getElementById('es-desc').value.trim(),
    duration: document.getElementById('es-duration').value.trim(),
    stars:    _statusStars,
  };
  if (_statusEditing) {
    const i = encStatuses.findIndex(x => x.id === _statusEditing);
    if (i >= 0) { encStatuses[i] = status; } else { encStatuses.push(status); }
  } else {
    encStatuses.push(status);
    encIdx = encStatuses.length - 1;
  }
  saveEncData();
  closeStatusModal();
  if (encSection === 'statuses') { renderLeft(); renderRight(); }
  encNotify(_statusEditing ? 'STATUS UPDATED' : 'STATUS ADDED', 'ok');
}

function pickStar(n) {
  _statusStars = n;
  renderStarPicker(n);
  document.getElementById('es-stars').value = n;
}
function renderStarPicker(n) {
  document.querySelectorAll('.enc-star-pick').forEach(b => {
    b.classList.toggle('lit', Number(b.dataset.v) <= n);
  });
}

// ── MEMORY MODAL ──────────────────────────────────────────
function openMemoryModal(id) {
  _memoryEditing = id;
  _memoryImgData = null;
  const m = id ? encMemories.find(x => x.id === id) || {} : {};
  document.getElementById('enc-memory-modal-title').textContent = id ? 'EDIT CHAPTER' : 'NEW CHAPTER';
  document.getElementById('em-title').value = m.title || '';
  document.getElementById('em-arc').value   = m.arc   || '';
  document.getElementById('em-date').value  = m.date  || '';
  _memoryImgData = m.image || null;
  renderEncImgPreview('memory');
  document.getElementById('enc-memory-overlay').classList.add('open');
}

function closeMemoryModal() {
  document.getElementById('enc-memory-overlay').classList.remove('open');
  _memoryEditing = null; _memoryImgData = null;
  document.getElementById('em-img-file').value = '';
}

function saveMemoryModal() {
  const title = document.getElementById('em-title').value.trim();
  if (!title) { encNotify('CHAPTER NEEDS A TITLE', 'err'); return; }
  const existing = _memoryEditing ? encMemories.find(x => x.id === _memoryEditing) : null;
  const memory = {
    id:     _memoryEditing || genId(),
    title,
    arc:    document.getElementById('em-arc').value.trim(),
    date:   document.getElementById('em-date').value.trim(),
    image:  _memoryImgData || null,
    scenes: existing ? (existing.scenes || []) : [],
  };
  if (_memoryEditing) {
    const i = encMemories.findIndex(x => x.id === _memoryEditing);
    if (i >= 0) { encMemories[i] = memory; } else { encMemories.push(memory); }
  } else {
    encMemories.push(memory);
    encIdx = encMemories.length - 1;
  }
  saveEncData();
  closeMemoryModal();
  if (encSection === 'memories') { renderLeft(); renderRight(); }
  encNotify(_memoryEditing ? 'CHAPTER UPDATED' : 'CHAPTER ADDED', 'ok');
}

// ── IMAGE HANDLING ────────────────────────────────────────
function handleEncImgUpload(type, event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { encNotify('NOT AN IMAGE', 'err'); return; }
  if (file.size > 8 * 1024 * 1024) { encNotify('IMAGE TOO LARGE (MAX 8MB)', 'err'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    if (type === 'place')  { _placeImgData  = e.target.result; renderEncImgPreview('place'); }
    if (type === 'memory') { _memoryImgData = e.target.result; renderEncImgPreview('memory'); }
  };
  reader.readAsDataURL(file);
}

function renderEncImgPreview(type) {
  const data = type === 'place' ? _placeImgData : _memoryImgData;
  const preview  = document.getElementById(type === 'place' ? 'ep-img-preview' : 'em-img-preview');
  const clearBtn = document.getElementById(type === 'place' ? 'ep-img-clear'   : 'em-img-clear');
  if (!preview) return;
  if (data) {
    preview.innerHTML = `<img src="${data}" alt="">`;
    if (clearBtn) clearBtn.style.display = '';
  } else {
    preview.innerHTML = '<span class="enc-img-no-label">NO IMAGE</span>';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

function clearEncImg(type) {
  if (type === 'place')  { _placeImgData  = null; document.getElementById('ep-img-file').value = ''; }
  if (type === 'memory') { _memoryImgData = null; document.getElementById('em-img-file').value = ''; }
  renderEncImgPreview(type);
}

// ── DELETE / CONFIRM ──────────────────────────────────────
function encConfirmDelete(type, id) {
  _pendingConfirm = { type, id };
  document.getElementById('enc-confirm-msg').textContent = 'DELETE THIS ENTRY?\nTHIS CANNOT BE UNDONE.';
  document.getElementById('enc-confirm-overlay').classList.add('open');
}

function encConfirmYes() {
  if (!_pendingConfirm) return;
  const { type, id } = _pendingConfirm;
  if (type === 'place')  { encPlaces   = encPlaces.filter(x => x.id !== id); encIdx = Math.max(0, encIdx - 1); }
  if (type === 'status') { encStatuses = encStatuses.filter(x => x.id !== id); encIdx = Math.max(0, encIdx - 1); }
  if (type === 'memory') { encMemories = encMemories.filter(x => x.id !== id); encIdx = Math.max(0, encIdx - 1); }
  saveEncData();
  const section = type === 'place' ? 'places' : type === 'status' ? 'statuses' : 'memories';
  if (encSection === section) { renderLeft(); renderRight(); }
  encConfirmNo();
  encNotify('ENTRY DELETED', 'ok');
}

function encConfirmNo() {
  _pendingConfirm = null;
  document.getElementById('enc-confirm-overlay').classList.remove('open');
}

// ── YouTube ───────────────────────────────────────────────
function ytEmbed(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  return m ? `https://www.youtube.com/embed/${m[1]}?modestbranding=1` : '';
}

function toggleSoundtrack(hd) {
  const embed = hd.nextElementSibling;
  const tog   = hd.querySelector('.enc-soundtrack-toggle');
  if (!embed || !embed.classList.contains('enc-soundtrack-embed')) return;
  embed.classList.toggle('open');
  if (tog) tog.textContent = embed.classList.contains('open') ? '▲' : '▼';
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Custom cursor tracking
  const _cur = document.getElementById('cursor');
  if (_cur) document.addEventListener('mousemove', e => {
    _cur.style.left = e.clientX + 'px';
    _cur.style.top  = e.clientY + 'px';
  });

  applySectionColor();
  initFirestore();

  document.getElementById('enc-confirm-yes').onclick = encConfirmYes;
  document.getElementById('enc-confirm-no').onclick  = encConfirmNo;

  // Close modals on overlay click
  ['enc-place-overlay','enc-status-overlay','enc-memory-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
  });

  // Keyboard: Escape closes modals / confirm
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePlaceModal(); closeStatusModal(); closeMemoryModal(); encConfirmNo();
    }
    if (e.key === 'ArrowRight') encNav('next');
    if (e.key === 'ArrowLeft')  encNav('prev');
  });
});
