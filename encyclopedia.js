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
let encNpcs       = [];

// editing state
let _placeEditing    = null;
let _statusEditing   = null;
let _memoryEditing   = null;
let _npcEditing      = null;
let _placeImgData    = null;
let _memoryImgData   = null;
let _npcImgData      = null;
let _statusStars     = 1;
let _sceneEditing    = null; // { memId, sceneIdx } or null
let _pendingConfirm  = null;
let _statusDragId    = null;
let _statusAutoScrollInterval = null;
let _statusAutoScrollDirection = 0; // -1 up, 1 down, 0 none
let _statusFolderExpanded = { GOOD:true, BAD:true, NEUTRAL:true };

// ── Section config ────────────────────────────────────────
const SECTION_CFG = {
  characters: { label: 'CHARACTERS',    sub: 'CHARACTER PROFILES',  col: '#c9a227' },
  places:     { label: 'PLACES',        sub: 'LOCATIONS & REALMS',  col: '#2a9d8f' },
  statuses:   { label: 'STATUS EFFECTS',sub: 'BUFFS, DEBUFFS & FX', col: '#8b5cf6' },
  memories:   { label: 'MEMORIES',      sub: 'CHAPTERS & SCENES',   col: '#e76f51' },
  items:      { label: 'ITEMS',         sub: 'EQUIPMENT & BAG',     col: '#00ccaa' },
  npcs:       { label: 'NPCS',          sub: 'NON-PLAYER CHARACTERS',col: '#e05a9a' },
};

const ENC_ITEM_ICONS = {
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

function getAllItems() {
  const items = [];
  encCharacters.forEach(c => {
    const inv = c.inventory || [];
    inv.forEach(i => {
      items.push({
        ...i,
        characterId: c.id,
        characterName: c.name,
        characterColor: c.color,
        characterAvatar: c.avatar
      });
    });
  });
  return items;
}

function getList() {
  switch(encSection) {
    case 'characters': return encCharacters;
    case 'places':     return encPlaces;
    case 'statuses':   return encStatuses;
    case 'memories':   return encMemories;
    case 'items':      return getAllItems();
    case 'npcs':       return encNpcs;
    default:           return [];
  }
}

function getStatusFolder(status) {
  const folder = (status && status.folder) ? String(status.folder).toUpperCase() : null;
  if (folder === 'GOOD' || folder === 'BAD' || folder === 'NEUTRAL') return folder;
  const type = status && String(status.type || '').toUpperCase();
  if (type === 'BUFF') return 'GOOD';
  if (type === 'DEBUFF') return 'BAD';
  return 'NEUTRAL';
}

function getStatusFolderLabel(key) {
  return key === 'GOOD' ? 'POSITIVE' : key === 'BAD' ? 'NEGATIVE' : 'NEUTRAL';
}

// ── Firebase I/O ──────────────────────────────────────────
function saveEncData() {
  if (!db) return;
  db.collection('enc').doc('data').set(stripUndef({
    places:   encPlaces,
    statuses: encStatuses,
    memories: encMemories,
    npcs:     encNpcs,
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
    encStatuses = (d.statuses || []).map(s => ({ ...s, folder: getStatusFolder(s) }));
    encMemories = d.memories || [];
    encNpcs     = d.npcs     || [];
    if (encSection !== 'characters') { renderLeft(); renderRight(); }
  }, () => {});
}

// ── Mobile ToC Helpers ─────────────────────────────────────
function toggleMobileToC() {
  const left = document.getElementById('enc-left');
  const backdrop = document.getElementById('enc-mobile-backdrop');
  if (left && backdrop) {
    const isOpen = left.classList.toggle('open');
    backdrop.classList.toggle('open', isOpen);
  }
}
function closeMobileToC() {
  const left = document.getElementById('enc-left');
  const backdrop = document.getElementById('enc-mobile-backdrop');
  if (left && backdrop) {
    left.classList.remove('open');
    backdrop.classList.remove('open');
  }
}

// ── Section switching ─────────────────────────────────────
function switchSection(section) {
  encSection = section;
  encIdx     = 0;
  applySectionColor();
  renderLeft();
  renderRight('next');
  closeMobileToC();
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
  closeMobileToC();
}

function updateToC() {
  document.querySelectorAll('.enc-toc-item').forEach(el => {
    const targetIndex = Number(el.getAttribute('data-index') || el.dataset.index || -1);
    if (targetIndex >= 0) {
      el.classList.toggle('active', targetIndex === encIdx);
    }
  });
}

function statusDragStart(e) {
  _statusDragId = e.currentTarget.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', _statusDragId); } catch (err) {}
  e.currentTarget.classList.add('dragging');
}

function statusDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  if (target.dataset.id !== _statusDragId) {
    target.classList.add('drag-over');
  }
  // Auto-scroll the left ToC when dragging near the top/bottom edges
  try {
    const toc = document.getElementById('enc-toc');
    if (toc) {
      const rect = toc.getBoundingClientRect();
      const margin = 48; // px from top/bottom to start scrolling
      if (e.clientY - rect.top < margin) startStatusAutoScroll(-1);
      else if (rect.bottom - e.clientY < margin) startStatusAutoScroll(1);
      else stopStatusAutoScroll();
    }
  } catch (err) {}
}

function statusDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
  stopStatusAutoScroll();
}

function statusDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.enc-toc-item.drag-over, .enc-toc-group-body.drag-over').forEach(el => el.classList.remove('drag-over'));
  stopStatusAutoScroll();
}

function statusDragDrop(e) {
  e.preventDefault();
  const target = e.currentTarget;
  target.classList.remove('drag-over');
  if (!_statusDragId) return;

  const targetId = target.dataset.id;
  const targetGroup = target.dataset.group;
  if (targetId && targetId !== _statusDragId) {
    reorderStatusById(_statusDragId, targetId);
  } else if (targetGroup) {
    moveStatusToGroupEnd(_statusDragId, targetGroup);
  }
  _statusDragId = null;
  stopStatusAutoScroll();
}

function startStatusAutoScroll(dir) {
  if (_statusAutoScrollDirection === dir) return;
  stopStatusAutoScroll();
  _statusAutoScrollDirection = dir;
  const toc = document.getElementById('enc-toc');
  if (!toc) return;
  _statusAutoScrollInterval = setInterval(() => {
    try {
      toc.scrollTop += dir * 12; // scroll speed
    } catch (e) {}
  }, 40);
}

function stopStatusAutoScroll() {
  _statusAutoScrollDirection = 0;
  if (_statusAutoScrollInterval) { clearInterval(_statusAutoScrollInterval); _statusAutoScrollInterval = null; }
}

function toggleStatusFolder(folderKey) {
  _statusFolderExpanded[folderKey] = !_statusFolderExpanded[folderKey];
  renderLeft();
}

function reorderStatusById(sourceId, targetId) {
  const fromIndex = encStatuses.findIndex(x => x.id === sourceId);
  const toIndex = encStatuses.findIndex(x => x.id === targetId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
  const [moved] = encStatuses.splice(fromIndex, 1);
  const insertIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
  encStatuses.splice(insertIndex, 0, moved);
  adjustEncIdxAfterReorder(fromIndex, insertIndex);
  saveEncData();
  renderLeft(); renderRight();
  encNotify('STATUS ORDER UPDATED', 'ok');
}

function moveStatusToGroupEnd(sourceId, groupKey) {
  const fromIndex = encStatuses.findIndex(x => x.id === sourceId);
  if (fromIndex < 0) return;
  const [moved] = encStatuses.splice(fromIndex, 1);
  moved.folder = groupKey;
  const insertIndex = encStatuses.map((s, i) => ({ s, i })).filter(item => getStatusFolder(item.s) === groupKey).map(item => item.i).pop();
  const targetIndex = insertIndex === undefined ? encStatuses.length : insertIndex + 1;
  encStatuses.splice(targetIndex, 0, moved);
  adjustEncIdxAfterReorder(fromIndex, targetIndex);
  saveEncData();
  renderLeft(); renderRight();
  encNotify('STATUS ORDER UPDATED', 'ok');
}

function adjustEncIdxAfterReorder(fromIndex, toIndex) {
  if (encIdx === fromIndex) {
    encIdx = toIndex;
  } else if (fromIndex < encIdx && toIndex >= encIdx) {
    encIdx -= 1;
  } else if (fromIndex > encIdx && toIndex <= encIdx) {
    encIdx += 1;
  }
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

  if (encSection === 'statuses') {
    const groups = { GOOD: { label: 'GOOD', items: [] }, BAD: { label: 'BAD', items: [] }, NEUTRAL: { label: 'NEUTRAL', items: [] } };
    list.forEach((item, i) => {
      const bucket = getStatusFolder(item);
      groups[bucket].items.push({ item, index: i });
    });

    const renderStatusItem = ({ item, index }) => {
      const name = item.name || 'UNNAMED';
      const dotColor = item.color || SECTION_CFG.statuses.col;
      return `<div class="enc-toc-item${index === encIdx ? ' active' : ''}" onclick="encGoTo(${index})" draggable="true" data-id="${esc(item.id)}" data-index="${index}" data-folder="${getStatusFolder(item)}" ondragstart="statusDragStart(event)" ondragover="statusDragOver(event)" ondragleave="statusDragLeave(event)" ondrop="statusDragDrop(event)" ondragend="statusDragEnd(event)">
        <span class="enc-toc-n">${toRoman(index + 1)}</span>
        <span class="enc-toc-txt">${esc(name)}</span>
        <span class="enc-toc-dot" style="background:${dotColor}"></span>
      </div>`;
    };

    const renderStatusGroup = (groupKey) => {
      const group = groups[groupKey];
      const expanded = _statusFolderExpanded[groupKey];
      return `<div class="enc-toc-group">
        <button type="button" class="enc-toc-group-title" onclick="toggleStatusFolder('${groupKey}')" ondragover="statusDragOver(event)" ondragleave="statusDragLeave(event)" ondrop="statusDragDrop(event)" data-group="${groupKey}">
          <span>${_statusFolderExpanded[groupKey] ? '▾' : '▸'}</span>
          <span>${getStatusFolderLabel(groupKey)}</span>
        </button>
        <div class="enc-toc-group-body${expanded ? '' : ' collapsed'}" data-group="${groupKey}" ondragenter="statusDragOver(event)" ondragover="statusDragOver(event)" ondragleave="statusDragLeave(event)" ondrop="statusDragDrop(event)">
          ${group.items.length ? group.items.map(renderStatusItem).join('') : `<div class="enc-toc-empty">NO ${group.label} YET</div>`}
        </div>
      </div>`;
    };

    toc.innerHTML = renderStatusGroup('GOOD') + renderStatusGroup('BAD') + renderStatusGroup('NEUTRAL');
  } else {
    toc.innerHTML = list.map((item, i) => {
      const name = item.name || item.title || 'UNNAMED';
      const dotColor = (encSection === 'items') ? (item.characterColor || '#00ccaa') : (item.color || SECTION_CFG[encSection].col);
      return `<div class="enc-toc-item${i === encIdx ? ' active' : ''}" onclick="encGoTo(${i})" data-index="${i}">
        <span class="enc-toc-n">${toRoman(i + 1)}</span>
        <span class="enc-toc-txt">${esc(name)}</span>
        <span class="enc-toc-dot" style="background:${dotColor}"></span>
      </div>`;
    }).join('') || `<div style="padding:20px;font-size:9px;color:#5a4020;text-align:center;letter-spacing:2px;">NOTHING YET</div>`;
  }

  // Footer action
  if (encSection === 'characters' || encSection === 'items') {
    ft.innerHTML = `<button class="btn sm" style="width:100%;font-size:8px;" onclick="location.href='index.html'">GO TO MAIN APP ↗</button>`;
  } else {
    const label = encSection === 'places'   ? 'NEW PLACE'   :
                  encSection === 'statuses' ? 'NEW STATUS'  :
                  encSection === 'npcs'     ? 'NEW NPC'     : 'NEW CHAPTER';
    const fn    = encSection === 'places'   ? 'openPlaceModal(null)'  :
                  encSection === 'statuses' ? 'openStatusModal(null)' :
                  encSection === 'npcs'     ? 'openNpcModal(null)'    : 'openMemoryModal(null)';
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
        case 'items':      content.innerHTML = renderItemEntry(item);   break;
        case 'npcs':       content.innerHTML = renderNpcEntry(item);    break;
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
    characters: { icon:'⚔', title:'NO CHARACTERS',      sub:'CREATE CHARACTERS IN THE MAIN APP' },
    places:     { icon:'◈', title:'NO PLACES YET',       sub:'ADD YOUR FIRST LOCATION ENTRY' },
    statuses:   { icon:'✦', title:'NO STATUS EFFECTS',   sub:'DOCUMENT YOUR BUFFS & DEBUFFS' },
    memories:   { icon:'✦', title:'NO CHAPTERS YET',     sub:'BEGIN WRITING YOUR STORY' },
    items:      { icon:'⚒', title:'NO ITEMS',            sub:'ITEMS ARE ADDED FROM CHARACTER INVENTORIES' },
    npcs:       { icon:'◉', title:'NO NPCS YET',         sub:'ADD YOUR FIRST NON-PLAYER CHARACTER' },
  };
  const m = msgs[encSection] || { icon:'?', title:'NOTHING HERE', sub:'' };
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
  const traitsHtml = (c.traits || []).slice(0, 14).map((t, i) => {
    const def = (typeof TRAITS !== 'undefined' && TRAITS[t]) || null;
    const name = def ? def.name : t.replace(/_/g, ' ');
    const rar  = def ? def.rarity : 'common';
    const isShimmy = c.shimmyfulTraits && c.shimmyfulTraits.includes(t);
    return `<span class="enc-trait-chip enc-trait-${esc(rar)}${isShimmy ? ' enc-trait-shimmy' : ''} enc-anim-fade" style="animation-delay:${0.3 + i * 0.04}s">${isShimmy ? '<span class="enc-shimmy-star">✦</span> ' : ''}${esc(name)}</span>`;
  }).join('');

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

// ── NPC ENTRY ─────────────────────────────────────────────
function renderNpcEntry(n) {
  if (!n) return '';
  const col = n.color || SECTION_CFG.npcs.col;

  const portrait = n.image
    ? `<div class="enc-char-portrait-frame" style="border-color:${col}44"><img src="${n.image}" style="width:100%;height:100%;object-fit:cover;display:block;"></div>`
    : `<div class="enc-char-portrait-frame" style="border-color:${col}22"><span class="enc-char-portrait-ph" style="color:${col}33">◈</span></div>`;

  const roleBadge      = n.role        ? `<span class="enc-badge enc-anim-fade" style="color:${col};border-color:${col}44;animation-delay:0.14s">${esc(n.role)}</span>` : '';
  const affBadge       = n.affiliation ? `<span class="enc-badge enc-anim-fade" style="color:#a08050;border-color:#3a281044;animation-delay:0.17s">${esc(n.affiliation)}</span>` : '';
  const alignBadge     = n.alignment   ? `<span class="enc-badge enc-anim-fade" style="color:#888;border-color:#33333344;animation-delay:0.2s">${esc(n.alignment)}</span>` : '';

  return `
    <div class="enc-char-hero enc-anim-fade" style="animation-delay:0s">
      ${portrait}
      <div class="enc-char-hero-info">
        <div class="enc-entry-name enc-char-name-big" style="color:${col};text-shadow:0 0 30px ${col}44">${esc(n.name || 'UNNAMED')}</div>
        <div class="enc-char-color-band" style="background:linear-gradient(90deg,${col},transparent)"></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
          ${roleBadge}${affBadge}${alignBadge}
        </div>
      </div>
    </div>
    <div class="enc-entry-divider enc-anim-fade" style="background:${col};animation-delay:0.08s"></div>
    ${n.desc ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.12s">⬥ DESCRIPTION</div>
      <div class="enc-body-text enc-anim-fade" style="animation-delay:0.16s">${esc(n.desc)}</div>` : ''}
    ${n.personality ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.2s">⬥ PERSONALITY</div>
      <div class="enc-body-text enc-anim-fade" style="animation-delay:0.23s">${esc(n.personality)}</div>` : ''}
    ${n.notes ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.27s">⬥ NOTES</div>
      <div class="enc-body-text enc-anim-fade" style="animation-delay:0.3s">${esc(n.notes)}</div>` : ''}
    <div class="enc-entry-actions enc-anim-fade" style="animation-delay:0.35s">
      <button class="btn sm" onclick="openNpcModal('${n.id}')">EDIT</button>
      <button class="btn sm danger" onclick="encConfirmDelete('npc','${n.id}')">✕ DELETE</button>
    </div>
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
    ${p.image ? `<div class="enc-parallax-wrapper enc-anim-fade" style="animation-delay:0s" onmousemove="parallaxImage(event, this)" onmouseleave="resetParallax(this)" onclick="openFullscreenImage('${p.image}')">
                   <img class="enc-place-img" src="${p.image}" alt="">
                 </div>` : ''}
    <div class="enc-entry-name enc-anim-fade" style="color:${col};text-shadow:0 0 30px ${col}44;animation-delay:0.05s">${esc(p.name || 'UNNAMED')}</div>
    <div class="enc-entry-divider enc-anim-fade" style="background:${col};animation-delay:0.08s"></div>
    <div class="enc-meta-row enc-anim-fade" style="animation-delay:0.12s">
      ${p.type   ? `<span class="enc-badge" style="color:${col};border-color:${col}44">${esc(p.type)}</span>` : ''}
      ${p.region ? `<span class="enc-badge" style="color:#a08050;border-color:#3a2810">${esc(p.region)}</span>` : ''}
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
  const starCount = Math.max(0, Math.min(5, Number(s.stars) || 0));
  const starsHtml = Array.from({length:starCount}, () => `<span class="enc-star" style="color:${col}">★</span>`).join('');

  return `
    <div class="enc-status-top enc-anim-fade" style="animation-delay:0s">
      <div class="enc-status-orb orb-${esc(s.shape||'circle')}" style="--status-col:${col};border:2px solid ${col}66" onmouseenter="(typeof playSound==='function')&&playSound('hover',{rate:0.95+Math.random()*0.1,volume:0.45})" onclick="(typeof playSound==='function')&&playSound('click',{rate:0.95,volume:0.5})">
        <span class="orb-glow"></span>
        <span class="orb-sheen"></span>
        <span class="orb-inner"></span>
      </div>
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
      <span style="font-size:8px;color:#6a4a28;letter-spacing:3px;">DURATION</span>
      <span style="font-size:11px;color:#a88a5c;font-family:'Cinzel',serif;">${esc(s.duration)}</span>
    </div>` : ''}
    <div class="enc-entry-actions enc-anim-fade" style="animation-delay:0.3s">
      <button class="btn sm" onclick="openStatusModal('${s.id}')">EDIT</button>
      <button class="btn sm danger" onclick="encConfirmDelete('status','${s.id}')">✕ DELETE</button>
    </div>
  `;
}

// ── ITEM ENTRY ─────────────────────────────────────────────
function renderItemEntry(i) {
  if (!i) return '';
  const col = i.characterColor || '#00ccaa';
  
  // Icon resolution
  let iconHtml = '';
  if (i.iconImage) {
    iconHtml = `<img src="${i.iconImage}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"/>`;
  } else {
    const emoji = ENC_ITEM_ICONS[i.icon || 'sword'] || '🎒';
    iconHtml = `<span class="enc-item-large-emoji" style="font-size:36px;">${emoji}</span>`;
  }

  // Modifiers tags
  const modsHtml = (i.mods || []).map(m => {
    let sign = '';
    if (m.op === 'add') sign = '+';
    if (m.op === 'sub') sign = '-';
    if (m.op === 'mul') sign = 'x';
    if (m.op === 'div') sign = '/';
    return `<span class="enc-item-mod-tag ${m.op}">${esc(m.stat.toUpperCase())} ${sign}${m.value}</span>`;
  }).join('') || '';

  // Passives display
  const passivesHtml = (i.passives || []).filter(Boolean).map(p =>
    `<div class="enc-item-passive-row">${esc(p)}</div>`
  ).join('') || '';

  // Owner portrait display
  const ownerAvatarHtml = i.characterAvatar 
    ? `<img src="${i.characterAvatar}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;border:1px solid ${col}44;"/>`
    : `<div class="enc-char-portrait-ph" style="width:40px;height:40px;border-radius:4px;border:1px solid ${col}22;background:#050302;display:flex;align-items:center;justify-content:center;color:${col}44;font-size:16px;">◈</div>`;

  return `
    <div class="enc-item-detail-hero enc-anim-fade" style="animation-delay:0s">
      <div class="enc-item-large-frame ${i.equipped ? 'equipped' : ''}" style="--item-col:${col}">
        ${iconHtml}
      </div>
      <div>
        <div class="enc-entry-name" style="color:${col};text-shadow:0 0 30px ${col}33">${esc(i.name || 'UNNAMED ITEM')}</div>
        <div class="enc-item-status-badge ${i.equipped ? 'equipped' : ''}" style="color:${col}">
          ${i.equipped ? '⚡ EQUIPPED' : '💼 IN INVENTORY'}
        </div>
      </div>
    </div>
    <div class="enc-entry-divider enc-anim-fade" style="background:${col};animation-delay:0.06s"></div>
    
    ${i.desc ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.12s">⬥ DESCRIPTION</div>
      <div class="enc-body-text enc-anim-fade" style="animation-delay:0.15s">${esc(i.desc)}</div>
    ` : ''}

    ${modsHtml ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.18s">⬥ STAT MODIFIERS</div>
      <div class="enc-item-mods-grid enc-anim-fade" style="animation-delay:0.22s">
        ${modsHtml}
      </div>
    ` : ''}

    ${passivesHtml ? `
      <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.26s">⬥ PASSIVES &amp; ABILITIES</div>
      <div class="enc-item-passives enc-anim-fade" style="animation-delay:0.3s">
        ${passivesHtml}
      </div>
    ` : ''}

    <div class="enc-section-label enc-anim-fade" style="color:${col};animation-delay:0.34s">⬥ OWNER PROFILE</div>
    <div class="enc-item-owner-card enc-anim-fade" style="animation-delay:0.38s;--char-col:${col}">
      ${ownerAvatarHtml}
      <div class="enc-item-owner-info">
        <div class="enc-item-owner-title" style="font-size:7px;letter-spacing:1px;opacity:0.4;font-family:'Press Start 2P',monospace;">CARRIED BY</div>
        <div class="enc-item-owner-name" style="color:${col};font-family:'Cinzel Decorative',serif;font-size:14px;letter-spacing:1.5px;margin-top:2px;">${esc(i.characterName || 'UNKNOWN')}</div>
      </div>
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
    ${m.image ? `<div class="enc-parallax-wrapper enc-anim-fade" style="animation-delay:0s" onmousemove="parallaxImage(event, this)" onmouseleave="resetParallax(this)" onclick="openFullscreenImage('${m.image}')">
                   <img class="enc-memory-cover" src="${m.image}" alt="">
                 </div>` : ''}
    <div class="enc-chapter-label enc-anim-fade" style="animation-delay:0.04s">${esc(m.arc || 'CHAPTER')}</div>
    <div class="enc-entry-name enc-anim-fade" style="color:${col};text-shadow:0 0 30px ${col}44;animation-delay:0.07s">${esc(m.title || 'UNTITLED')}</div>
    <div class="enc-entry-divider enc-anim-fade" style="background:${col};animation-delay:0.1s"></div>
    ${m.date ? `<div class="enc-meta-row enc-anim-fade" style="animation-delay:0.13s"><span class="enc-badge" style="color:#a08050;border-color:#3a2810">${esc(m.date)}</span></div>` : ''}
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

// ── NPC MODAL ─────────────────────────────────────────────
function openNpcModal(id) {
  _npcEditing = id;
  _npcImgData = null;
  const n = id ? encNpcs.find(x => x.id === id) || {} : {};
  document.getElementById('enc-npc-modal-title').textContent = id ? 'EDIT NPC' : 'NEW NPC';
  document.getElementById('en-name').value        = n.name        || '';
  document.getElementById('en-role').value        = n.role        || '';
  document.getElementById('en-affiliation').value = n.affiliation || '';
  document.getElementById('en-alignment').value   = n.alignment   || 'NEUTRAL';
  document.getElementById('en-color').value       = n.color       || '#e05a9a';
  document.getElementById('en-desc').value        = n.desc        || '';
  document.getElementById('en-personality').value = n.personality || '';
  document.getElementById('en-notes').value       = n.notes       || '';
  _npcImgData = n.image || null;
  renderNpcImgPreview();
  document.getElementById('enc-npc-overlay').classList.add('open');
}

function closeNpcModal() {
  document.getElementById('enc-npc-overlay').classList.remove('open');
  _npcEditing = null; _npcImgData = null;
  document.getElementById('en-img-file').value = '';
}

function saveNpcModal() {
  const name = document.getElementById('en-name').value.trim();
  if (!name) { encNotify('NPC NEEDS A NAME', 'err'); return; }
  const npc = {
    id:          _npcEditing || genId(),
    name,
    role:        document.getElementById('en-role').value.trim(),
    affiliation: document.getElementById('en-affiliation').value.trim(),
    alignment:   document.getElementById('en-alignment').value,
    color:       document.getElementById('en-color').value,
    desc:        document.getElementById('en-desc').value.trim(),
    personality: document.getElementById('en-personality').value.trim(),
    notes:       document.getElementById('en-notes').value.trim(),
    image:       _npcImgData || null,
  };
  if (_npcEditing) {
    const i = encNpcs.findIndex(x => x.id === _npcEditing);
    if (i >= 0) { encNpcs[i] = npc; } else { encNpcs.push(npc); }
  } else {
    encNpcs.push(npc);
    encIdx = encNpcs.length - 1;
  }
  saveEncData();
  closeNpcModal();
  if (encSection === 'npcs') { renderLeft(); renderRight(); }
  encNotify(_npcEditing ? 'NPC UPDATED' : 'NPC ADDED', 'ok');
}

function handleNpcImgUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => { _npcImgData = ev.target.result; renderNpcImgPreview(); };
  reader.readAsDataURL(file);
}

function renderNpcImgPreview() {
  const preview  = document.getElementById('en-img-preview');
  const clearBtn = document.getElementById('en-img-clear');
  if (!preview) return;
  if (_npcImgData) {
    preview.innerHTML = `<img src="${_npcImgData}" alt="">`;
    if (clearBtn) clearBtn.style.display = '';
  } else {
    preview.innerHTML = '<span class="enc-img-no-label">NO IMAGE</span>';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

function clearNpcImg() {
  _npcImgData = null;
  document.getElementById('en-img-file').value = '';
  renderNpcImgPreview();
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
  _statusStars = s.stars || 0;
  renderStarPicker(_statusStars);
  document.getElementById('es-stars').value = _statusStars;
  document.getElementById('es-shape').value = s.shape || 'circle';
  if (typeof playSound === 'function') playSound('click', { rate: 1, volume: 0.5 });
  try { updateStatusPreview(); } catch (e) {}
  document.getElementById('enc-status-overlay').classList.add('open');
}

function closeStatusModal() {
  if (typeof playSound === 'function') playSound('click', { rate: 1.1, volume: 0.4 });
  document.getElementById('enc-status-overlay').classList.remove('open');
  _statusEditing = null;
}

function saveStatusModal() {
  const name = document.getElementById('es-name').value.trim();
  if (!name) { encNotify('STATUS NEEDS A NAME', 'err'); return; }
  const existing = _statusEditing ? encStatuses.find(x => x.id === _statusEditing) : null;
  const typeValue = document.getElementById('es-type').value;
  const status = {
    id:       _statusEditing || genId(),
    name,
    type:     typeValue,
    folder:   existing ? existing.folder : getStatusFolder({ type: typeValue }),
    color:    document.getElementById('es-color').value,
    desc:     document.getElementById('es-desc').value.trim(),
    duration: document.getElementById('es-duration').value.trim(),
    stars:    _statusStars,
    shape:    document.getElementById('es-shape').value || 'circle',
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
  if (typeof playSound === 'function') playSound('save', { rate: 1, volume: 0.7 });
  if (encSection === 'statuses') { renderLeft(); renderRight(); }
  encNotify(_statusEditing ? 'STATUS UPDATED' : 'STATUS ADDED', 'ok');
}

function pickStar(n) {
  _statusStars = n;
  renderStarPicker(n);
  document.getElementById('es-stars').value = n;
  if (typeof playSound === 'function') playSound('click', { rate: 0.95 + Math.random() * 0.1, volume: 0.45 });
  try { updateStatusPreview(); } catch (e) {}
}
function renderStarPicker(n) {
  document.querySelectorAll('.enc-star-pick').forEach(b => {
    b.classList.toggle('lit', Number(b.dataset.v) <= n);
  });
}

function updateStatusPreview() {
  const orb = document.getElementById('es-preview-orb');
  const starsDiv = document.getElementById('es-preview-stars');
  if (!orb || !starsDiv) return;
  const col = (document.getElementById('es-color') || {}).value || '#aaaaaa';
  const shape = (document.getElementById('es-shape') || {}).value || 'circle';
  const stars = Number((document.getElementById('es-stars') || {}).value) || 0;
  // set class
  orb.className = 'enc-status-orb orb-' + shape;
  // set css var and border (append alpha if hex)
  try {
    orb.style.setProperty('--status-col', col);
    if (typeof col === 'string' && col[0] === '#' && col.length === 7) orb.style.border = '2px solid ' + col + '66';
    else orb.style.border = '2px solid ' + col;
  } catch (e) {}
  // render stars
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += '<span class="enc-star' + (i <= stars ? '' : ' empty') + '">★</span>';
  }
  starsDiv.innerHTML = html;
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
  if (type === 'npc')    { encNpcs     = encNpcs.filter(x => x.id !== id);     encIdx = Math.max(0, encIdx - 1); }
  saveEncData();
  const section = type === 'place' ? 'places' : type === 'status' ? 'statuses' : type === 'npc' ? 'npcs' : 'memories';
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

// ── PARALLAX & FULLSCREEN ──────────────────────────────────
function parallaxImage(e, el) {
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const xPct = (x / rect.width - 0.5) * 10; // max 5px shift
  const yPct = (y / rect.height - 0.5) * 10;
  const img = el.querySelector('img');
  if(img) {
    img.style.transform = `scale(1.05) translate(${-xPct}px, ${-yPct}px)`;
  }
}
function resetParallax(el) {
  const img = el.querySelector('img');
  if(img) {
    img.style.transform = `scale(1.05) translate(0,0)`;
  }
}
function openFullscreenImage(src) {
  const overlay = document.getElementById('enc-fullscreen-overlay');
  const img = document.getElementById('enc-fullscreen-img');
  if (overlay && img) {
    img.src = src;
    overlay.classList.add('show');
  }
}
function closeFullscreenImage(e) {
  if (e && e.target.id === 'enc-fullscreen-img') return; // don't close if clicking the image itself
  const overlay = document.getElementById('enc-fullscreen-overlay');
  if(overlay) overlay.classList.remove('show');
}

// ── INIT ──────────────────────────────────────────────────
// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  // If stats/roster script loaded first, wait. We'll init by global script.
  // Actually, we export initializeEncyclopedia so script.js calls it.

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
