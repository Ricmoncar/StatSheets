// ============================================================
// DATA
// ============================================================
const STORAGE_KEY = 'statsheets_v1';
const SEEN_TRAITS_KEY = 'statsheets_seen_traits';
let characters = [];
let folders = [];
let _sidebarSearch = '';

// ── Performance mode: disables the heavy animated backgrounds + custom cursor
// overlays so low-end devices stop lagging/crashing. Persisted per-browser. ──
let _perfMode = (typeof localStorage !== 'undefined' && localStorage.getItem('perf_mode') === '1');
function _updatePerfBtn() {
  document.querySelectorAll('.js-perf-btn').forEach(b => {
    b.classList.toggle('on', _perfMode);
    b.innerHTML = _perfMode ? '⚡ PERF: ON' : '⚡ PERF';
    b.title = _perfMode
      ? 'Performance mode is ON — animated backgrounds & custom cursors are off. Click to turn off.'
      : 'Performance mode: turn off heavy animated backgrounds & custom cursors if the site lags.';
  });
}
function togglePerfMode() {
  _perfMode = !_perfMode;
  try { localStorage.setItem('perf_mode', _perfMode ? '1' : '0'); } catch (e) {}
  _updatePerfBtn();
  // re-apply the current character so the change takes effect right away
  if (typeof currentId !== 'undefined' && currentId && characters.find(x => x.id === currentId)) {
    viewChar(currentId);
  } else if (_perfMode) {
    try { stopBgAnim(); } catch (e) {}
  }
}
if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', _updatePerfBtn);
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

// ══ NARA PAINT STUDIO ════════════════════════════════════════
// Nara's content area is a flowing pastel-rainbow background everywhere EXCEPT
// the Style tab, which becomes a blank white canvas you paint on. You mix your
// colour by dipping the pencil (cursor) into the floating R/G/B/water buckets:
// while the pencil sits in a bucket it absorbs that colour over ~couple seconds,
// blending a % of it into the live RGB. Dip several buckets to mix any colour.
// Painting lives on a persistent offscreen buffer; the brush + transparent
// rainbow frame are a pointer-transparent overlay so the UI stays clickable.
let _naraPaint = {
  active: false,
  rF: 255, gF: 90, bF: 130,     // live colour (floats so dips blend smoothly)
  dip: null,                    // [r,g,b] of the bucket the pencil is currently in
  down: false, mx: 0, my: 0, lastX: null, lastY: null,
  rafId: null, prevTs: 0, t: 0,
  size: 16,                     // brush stroke width (mouse-wheel adjustable, Style tab only)
  layers: [],                   // layer metadata: {id,name,order,visible,alphaLock,locked,opacity}
  bufs: new Map(),              // layer id -> offscreen canvas (pixels)
  activeLayerId: 'base',        // which layer new strokes land on
  brush: 'pen',                 // pen | marker | spray | neon
  charId: null, saveTimer: null,// for per-user localStorage persistence
  undo: [], redo: []            // snapshot stacks for ctrl-z / ctrl-y
};
const NARA_BRUSHES = ['pen', 'marker', 'spray', 'neon', 'eraser'];
function _naraHash(n) { const x = Math.sin(n) * 43758.5453; return x - Math.floor(x); }
// ── layer model: a stack of named layers. "Base" always exists at order 0 and
//    holds everything drawn before layers; new layers go above (order>0) or below.
//    Layer structure is per-client (saved in localStorage); each stroke records the
//    id of the layer it was drawn on, so a stroke composites onto that layer.
// Photoshop/Krita-style blend modes → canvas globalCompositeOperation values
const NARA_BLENDS = [
  ['source-over', 'Normal'], ['lighter', 'Add (Linear Dodge)'], ['multiply', 'Multiply'], ['screen', 'Screen'],
  ['overlay', 'Overlay'], ['darken', 'Darken'], ['lighten', 'Lighten'],
  ['color-dodge', 'Color Dodge'], ['color-burn', 'Color Burn'], ['hard-light', 'Hard Light'],
  ['soft-light', 'Soft Light'], ['difference', 'Difference'], ['exclusion', 'Exclusion'],
  ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity'],
];
function _naraDefaultLayers() { return [{ id: 'base', name: 'Base', order: 0, visible: true, alphaLock: false, locked: false, opacity: 1, blend: 'source-over' }]; }
function _naraSortLayers() { _naraPaint.layers.sort((a, b) => a.order - b.order); }
function _naraNormalizeLayerOrder() {
  _naraSortLayers();
  for (let i = 0; i < _naraPaint.layers.length; i++) _naraPaint.layers[i].order = i;
}
function _naraLayerById(id) { return _naraPaint.layers.find(l => l.id === id); }
function _naraActiveLayer() { return _naraLayerById(_naraPaint.activeLayerId) || _naraPaint.layers[0]; }
function _naraResolveLayerId(s) { const id = (typeof s.layer === 'string') ? s.layer : null; return (id && _naraLayerById(id)) ? id : 'base'; }
function _naraLayersKey() { return 'nara_layers_' + (_naraCollab.canvasId || _naraPaint.charId || 'default'); }
function _naraSaveLayers() { try { localStorage.setItem(_naraLayersKey(), JSON.stringify({ layers: _naraPaint.layers, active: _naraPaint.activeLayerId })); } catch (e) {} }
function _naraLoadLayers() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(_naraLayersKey())); } catch (e) {}
  if (data && Array.isArray(data.layers) && data.layers.length) {
    _naraPaint.layers = data.layers.map(l => ({ id: l.id, name: l.name || 'Layer', order: +l.order || 0, visible: l.visible !== false, alphaLock: !!l.alphaLock, locked: !!l.locked, opacity: l.opacity == null ? 1 : +l.opacity, blend: l.blend || 'source-over' }));
    if (!_naraLayerById('base')) _naraPaint.layers.unshift(_naraDefaultLayers()[0]);
    _naraPaint.activeLayerId = (data.active && _naraLayerById(data.active)) ? data.active : 'base';
  } else { _naraPaint.layers = _naraDefaultLayers(); _naraPaint.activeLayerId = 'base'; }
  _naraNormalizeLayerOrder();
}
function _naraRGB() { const p = _naraPaint; return [Math.round(p.rF), Math.round(p.gF), Math.round(p.bF)]; }
function _naraPaintColor() { const c = _naraRGB(); return `rgb(${c[0]},${c[1]},${c[2]})`; }

// ── Offline fallback persistence (localStorage; only used when there's no db) ──
function _naraStorageKey() { return 'nara_drawing_' + (_naraPaint.charId || 'default'); }
function _naraStrokeStorageKey() { return 'nara_strokes_' + (_naraPaint.charId || 'default'); }
function _naraFlatten() {  // composite all visible layers into one canvas (offline save)
  const { w, h } = _naraCanvasSize(); _naraEnsureBufs(w, h);
  const flat = document.createElement('canvas'); flat.width = w; flat.height = h;
  const g = flat.getContext('2d');
  for (const l of _naraPaint.layers) { if (l.visible === false) continue; const b = _naraPaint.bufs.get(l.id); if (b) { g.globalAlpha = l.opacity == null ? 1 : l.opacity; g.globalCompositeOperation = l.blend || 'source-over'; g.drawImage(b, 0, 0); } }
  g.globalCompositeOperation = 'source-over';
  return flat;
}
function _naraSaveStrokes() {
  if (_naraDb()) return;
  try {
    const strokes = [..._naraCollab.strokes.values()].map(_naraStrokeData);
    localStorage.setItem(_naraStrokeStorageKey(), JSON.stringify({ strokes, updated: Date.now() }));
  } catch (e) {}
}
function _naraSaveDrawing() {
  if (!_naraPaint.layers.length || _naraDb()) return;
  _naraSaveStrokes();
  const flat = _naraFlatten(); if (!flat) return;
  try { localStorage.setItem(_naraStorageKey(), flat.toDataURL('image/png')); } catch (e) {}
}
function _naraGetBuf() { return _naraGetLayerBuf(_naraPaint.activeLayerId); }   // active layer's pixel buffer
function _naraScheduleSave() {
  clearTimeout(_naraPaint.saveTimer);
  _naraPaint.saveTimer = setTimeout(_naraSaveDrawing, 600);
}
function _naraLoadStrokes() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(_naraStrokeStorageKey())); } catch (e) {}
  if (!data || !Array.isArray(data.strokes)) return;
  _naraCollab.strokes.clear();
  for (const s of data.strokes) {
    if (s && s.pts && s.pts.length >= 2) {
      const id = s.id || ('local' + Math.random().toString(36).slice(2, 9));
      _naraCollab.strokes.set(id, { id, ...s });
    }
  }
  _naraRedrawAll();
}
function _naraLoadDrawing() {
  let data = null;
  try { data = localStorage.getItem(_naraStorageKey()); } catch (e) {}
  if (!data) return;
  const img = new Image();
  img.onload = () => {
    const l = _naraGetLayerBuf('base');
    if (l) {
      const ctx = l.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.mozImageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, l.width, l.height);
    }
  };
  img.src = data;
}

// ════ NARA — global, real-time COLLABORATIVE canvases (Firestore) ════
// Multiple shared canvases everyone paints on together; strokes + live cursors
// sync via Firestore. Each painting is the replay of its stroke documents.
// Falls back to a single local (localStorage) canvas when there is no db.
let _naraCollab = {
  me: null, canvasId: null,
  strokes: new Map(),          // id -> {id,pts,color,size,author,t}
  cur: null,                   // in-progress stroke being drawn locally
  cursors: new Map(),          // id -> {x,y,color,name,t}  (other people)
  canvases: [],                // [{id,name,order}]
  unsubList: null, unsubStrokes: null, unsubCursors: null,
  lastCursorT: 0, lastCursorX: -1, lastCursorY: -1, bootstrapping: false,
  myUndo: [], myRedo: [],      // your own actions (typed: stroke / clear) for undo-redo
  deleted: new Set(),          // tombstones: ids we removed → ignore late 'added' echoes
  loading: false, loadTimer: null,   // true while a canvas's strokes are still streaming in
};
function _naraDb() { return (typeof db !== 'undefined') ? db : null; }
function _naraIdentity() {
  let id = localStorage.getItem('nara_client_id');
  if (!id) { id = 'u' + Math.random().toString(36).slice(2, 10); localStorage.setItem('nara_client_id', id); }
  let color = localStorage.getItem('nara_client_color');
  if (!color) { color = `hsl(${Math.floor(Math.random() * 360)},85%,62%)`; localStorage.setItem('nara_client_color', color); }
  const name = localStorage.getItem('nara_client_name') || ('Guest ' + id.slice(1, 5));
  return { id, color, name };
}
function _naraCanvasesRef() { const d = _naraDb(); return d ? d.collection('nara_canvases') : null; }
function _naraStrokesRef() { const d = _naraDb(); return (d && _naraCollab.canvasId) ? d.collection('nara_canvases').doc(_naraCollab.canvasId).collection('strokes') : null; }
function _naraCursorsRef() { const d = _naraDb(); return (d && _naraCollab.canvasId) ? d.collection('nara_canvases').doc(_naraCollab.canvasId).collection('cursors') : null; }

function _naraCanvasSize() {
  const cv = document.getElementById('pattern-canvas');
  return { w: (cv && cv.width) || 1200, h: (cv && cv.height) || 800 };
}
// one offscreen pixel buffer per layer id. Resizing preserves each layer's pixels;
// buffers for deleted layers are dropped.
function _naraEnsureBufs(w, h) {
  const ids = new Set(_naraPaint.layers.map(l => l.id));
  for (const id of [..._naraPaint.bufs.keys()]) if (!ids.has(id)) _naraPaint.bufs.delete(id);
  for (const l of _naraPaint.layers) {
    let buf = _naraPaint.bufs.get(l.id);
    if (!buf) { buf = document.createElement('canvas'); buf.width = w; buf.height = h; _naraPaint.bufs.set(l.id, buf); }
    else if (buf.width !== w || buf.height !== h) {
      const nb = document.createElement('canvas'); nb.width = w; nb.height = h;
      try { nb.getContext('2d').drawImage(buf, 0, 0); } catch (e) {}
      _naraPaint.bufs.set(l.id, nb);
    }
  }
  return _naraPaint.bufs;
}
function _naraGetLayerBuf(id) {
  const { w, h } = _naraCanvasSize(); _naraEnsureBufs(w, h);
  return _naraPaint.bufs.get(id) || _naraPaint.bufs.get('base');
}
// deterministic spray scatter (same on every redraw → no flicker)
function _naraSprayDots(ctx, px, py, ww, st, j) {
  const dr = Math.max(0.6, ww * 0.13);
  for (let k = 0; k < 7; k++) {
    const a = _naraHash(st * 0.011 + j * 7.1 + k * 3.3) * 6.2832, r = _naraHash(st * 0.013 + j * 5.7 + k * 9.1) * ww;
    ctx.beginPath(); ctx.arc(px + Math.cos(a) * r, py + Math.sin(a) * r, dr, 0, 6.2832); ctx.fill();
  }
}
// A stroke stores per-point widths (s.ws, fractions of canvas width) so pen
// pressure varies thickness ALONG the stroke; s.brush picks the rendering style.
function _naraDrawStroke(ctx, s, bw, bh) {
  const pts = s.pts; if (!pts || pts.length < 2) return;
  const brush = s.brush || 'pen', ws = s.ws;
  const widthAt = i => Math.max(0.5, ((ws && ws[i]) || (ws && ws[ws.length - 1]) || s.size || 0.012) * bw);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (brush === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = '#000'; ctx.fillStyle = '#000';
  } else {
    if (s.alphaLock) ctx.globalCompositeOperation = 'source-atop';   // alpha lock: only paint over existing layer pixels
    ctx.strokeStyle = s.color || '#fff'; ctx.fillStyle = s.color || '#fff';
    if (brush === 'neon') { ctx.shadowColor = s.color || '#fff'; ctx.shadowBlur = Math.max(6, widthAt(0) * 1.4); }
    else if (brush === 'marker') ctx.globalAlpha = 0.4;
  }
  if (brush === 'spray') {
    const st = s.t || 1;
    for (let i = 0; i < pts.length; i += 2) _naraSprayDots(ctx, pts[i] * bw, pts[i + 1] * bh, widthAt(i / 2) * 2.4, st, i / 2);
    ctx.restore(); return;
  }
  const mul = brush === 'marker' ? 1.7 : 1;
  if (pts.length === 2) { ctx.lineWidth = widthAt(0) * mul; ctx.beginPath(); ctx.arc(pts[0] * bw, pts[1] * bh, ctx.lineWidth / 2, 0, 6.2832); ctx.fill(); ctx.restore(); return; }
  for (let i = 2; i < pts.length; i += 2) {
    ctx.lineWidth = widthAt(i / 2) * mul;
    ctx.beginPath(); ctx.moveTo(pts[i - 2] * bw, pts[i - 1] * bh); ctx.lineTo(pts[i] * bw, pts[i + 1] * bh); ctx.stroke();
  }
  if (brush === 'neon') { ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.5; for (let i = 2; i < pts.length; i += 2) { ctx.lineWidth = Math.max(0.5, widthAt(i / 2) * 0.4); ctx.beginPath(); ctx.moveTo(pts[i - 2] * bw, pts[i - 1] * bh); ctx.lineTo(pts[i] * bw, pts[i + 1] * bh); ctx.stroke(); } }
  ctx.restore();
}
function _naraDrawStrokeOnBuf(s) {
  const buf = _naraGetLayerBuf(_naraResolveLayerId(s)); if (!buf) return;
  _naraDrawStroke(buf.getContext('2d'), s, buf.width, buf.height);
}
function _naraRedrawAll() {
  const { w, h } = _naraCanvasSize(); _naraEnsureBufs(w, h);
  for (const b of _naraPaint.bufs.values()) b.getContext('2d').clearRect(0, 0, b.width, b.height);
  const all = [..._naraCollab.strokes.values()].sort((a, b) => (a.t || 0) - (b.t || 0));
  for (const s of all) { const b = _naraPaint.bufs.get(_naraResolveLayerId(s)); if (b) _naraDrawStroke(b.getContext('2d'), s, b.width, b.height); }
  if (_naraCollab.cur) { const b = _naraPaint.bufs.get(_naraResolveLayerId(_naraCollab.cur)); if (b) _naraDrawStroke(b.getContext('2d'), _naraCollab.cur, b.width, b.height); }
}
// current brush width (fraction of canvas width) sampled from live pen pressure.
// Soft press → much thinner (low floor); hard press → larger.
function _naraCurWidthFrac() {
  const buf = _naraGetBuf(); const bw = buf ? buf.width : 1200;
  const pr = _naraPaint.pen ? (0.08 + 1.3 * Math.max(0, _naraPaint.pressure || 0)) : 1;
  return (_naraPaint.size * pr) / bw;
}
// live drawing → one stroke that is published on release
function _naraBeginStroke(nx, ny) {
  const al = _naraActiveLayer();
  _naraCollab.cur = { pts: [nx, ny], ws: [_naraCurWidthFrac()], color: _naraPaintColor(), author: _naraCollab.me ? _naraCollab.me.id : 'me', t: Date.now(), layer: al ? al.id : 'base', brush: _naraPaint.brush, alphaLock: !!(al && al.alphaLock) };
  _naraDrawStrokeOnBuf(_naraCollab.cur);
}
function _naraExtendStroke(nx, ny) {
  const s = _naraCollab.cur; if (!s) return;
  const buf = _naraGetLayerBuf(_naraResolveLayerId(s)); const ctx = buf.getContext('2d');
  const bw = buf.width, bh = buf.height, n = s.pts.length, w = _naraCurWidthFrac();
  s.pts.push(nx, ny); s.ws.push(w);
  const brush = s.brush || 'pen';
  ctx.save();
  if (brush === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = '#000'; ctx.fillStyle = '#000';
  } else {
    if (s.alphaLock) ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    if (brush === 'neon') { ctx.shadowColor = s.color; ctx.shadowBlur = Math.max(6, w * bw * 1.4); }
    else if (brush === 'marker') ctx.globalAlpha = 0.4;
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const x0 = s.pts[n - 2] * bw, y0 = s.pts[n - 1] * bh, x1 = nx * bw, y1 = ny * bh;
  if (brush === 'spray') { _naraSprayDots(ctx, x1, y1, Math.max(0.6, w * bw) * 2.4, s.t || 1, (n - 2) / 2 + 1); }
  else {
    ctx.lineWidth = Math.max(0.5, w * bw) * (brush === 'marker' ? 1.7 : 1);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (brush === 'neon') { ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(0.5, w * bw * 0.4); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  }
  ctx.restore();
}
function _naraSimplifyStroke(s, maxPts) {
  const np = s.pts.length / 2; if (np <= maxPts) return;
  const step = Math.ceil(np / maxPts), pts = [], ws = [];
  for (let i = 0; i < np; i += step) { pts.push(s.pts[i * 2], s.pts[i * 2 + 1]); ws.push(s.ws[i]); }
  pts.push(s.pts[s.pts.length - 2], s.pts[s.pts.length - 1]); ws.push(s.ws[s.ws.length - 1]);
  s.pts = pts; s.ws = ws;
}
function _naraCommitStroke() {
  const s = _naraCollab.cur; _naraCollab.cur = null;
  if (!s || s.pts.length < 2) return;
  _naraSimplifyStroke(s, 400);   // bound doc size
  const ref = _naraStrokesRef();
  if (ref) {
    const doc = ref.doc(); s.id = doc.id;
    _naraCollab.strokes.set(s.id, s);                 // optimistic (already drawn live)
    _naraCollab.myUndo.push({ type: 'stroke', stroke: s }); _naraCollab.myRedo.length = 0;
    doc.set({ pts: s.pts, ws: s.ws, color: s.color, author: s.author, t: s.t, layer: s.layer || 'base', brush: s.brush || 'pen', alphaLock: !!s.alphaLock }).catch(e => console.warn('nara stroke', e));
  } else {
    s.id = 'local' + Date.now() + Math.random();
    _naraCollab.strokes.set(s.id, s);
    _naraCollab.myUndo.push({ type: 'stroke', stroke: s }); _naraCollab.myRedo.length = 0;
    _naraSaveDrawing();
    _naraScheduleSave();
  }
}
// ── stroke (re)creation helpers used by undo/redo + undo-clear ──
function _naraCloneStroke(s) { return { pts: s.pts.slice(), ws: s.ws ? s.ws.slice() : null, color: s.color, author: s.author, t: s.t, layer: s.layer || 'base', brush: s.brush || 'pen', alphaLock: !!s.alphaLock }; }
function _naraStrokeData(s) { return { pts: s.pts, ws: s.ws || null, color: s.color, author: s.author, t: s.t, layer: s.layer || 'base', brush: s.brush || 'pen', alphaLock: !!s.alphaLock }; }
function _naraReaddStroke(s) {   // give a stroke object a fresh id, store it, persist
  const ref = _naraStrokesRef();
  if (ref) { const doc = ref.doc(); s.id = doc.id; _naraCollab.strokes.set(s.id, s); doc.set(_naraStrokeData(s)).catch(() => {}); }
  else { s.id = 'local' + Date.now() + Math.random(); _naraCollab.strokes.set(s.id, s); _naraScheduleSave(); }
  return s;
}
function _naraReaddStrokes(list) {   // restore a whole batch (undo of a clear)
  const ref = _naraStrokesRef(), d = _naraDb();
  let batch = (ref && d) ? d.batch() : null, n = 0, i = 0;
  for (const src of list) {
    const s = _naraCloneStroke(src);
    if (ref) { const doc = ref.doc(); s.id = doc.id; _naraCollab.strokes.set(s.id, s); if (batch) { batch.set(doc, _naraStrokeData(s)); if (++n >= 400) { batch.commit(); batch = d.batch(); n = 0; } } }
    else { s.id = 'local' + Date.now() + '_' + (i++); _naraCollab.strokes.set(s.id, s); }
  }
  if (batch && n) batch.commit();
  _naraRedrawAll();
  if (!ref) _naraScheduleSave();
}
// ── layer operations (dynamic add / delete / reorder / rename / props) ──
function _naraAddLayer(dir) {   // dir>=0 → above active, dir<0 → below active
  _naraSortLayers();
  const a = _naraActiveLayer() || _naraPaint.layers[0];
  const idx = _naraPaint.layers.findIndex(l => l.id === a.id);
  const id = 'L' + Math.random().toString(36).slice(2, 9);
  const newLayer = { id, name: 'Layer ' + (_naraPaint.layers.length + 1), order: 0, visible: true, alphaLock: false, locked: false, opacity: 1, blend: 'source-over' };
  const insertAt = dir >= 0 ? idx + 1 : idx;
  _naraPaint.layers.splice(Math.max(0, Math.min(insertAt, _naraPaint.layers.length)), 0, newLayer);
  _naraNormalizeLayerOrder(); _naraPaint.activeLayerId = id;
  _naraSaveLayers(); _naraRenderLayers();
}
function _naraDeleteLayer(id) {
  if (id === 'base') return;
  const l = _naraLayerById(id); if (!l) return;
  if (!confirm('Delete layer "' + l.name + '" and everything on it?')) return;
  const ref = _naraStrokesRef(), d = _naraDb();
  let batch = (ref && d) ? d.batch() : null, n = 0;
  for (const [sid, s] of [..._naraCollab.strokes]) {
    if (_naraResolveLayerId(s) !== id) continue;
    _naraCollab.strokes.delete(sid);
    if (!String(sid).startsWith('local')) { _naraCollab.deleted.add(sid); if (batch) { batch.delete(ref.doc(sid)); if (++n >= 400) { batch.commit(); batch = d.batch(); n = 0; } } }
  }
  if (batch && n) batch.commit();
  _naraCollab.myUndo = _naraFilterActionsByLayer(_naraCollab.myUndo, id);
  _naraCollab.myRedo = _naraFilterActionsByLayer(_naraCollab.myRedo, id);
  _naraPaint.layers = _naraPaint.layers.filter(x => x.id !== id);
  _naraNormalizeLayerOrder();
  _naraPaint.bufs.delete(id);
  if (_naraPaint.activeLayerId === id) _naraPaint.activeLayerId = 'base';
  _naraSaveLayers(); _naraRenderLayers(); _naraRedrawAll();
  if (!ref) _naraScheduleSave();
}
function _naraMoveLayer(id, dir) {   // dir>0 → toward front, dir<0 → toward back
  _naraSortLayers();
  const idx = _naraPaint.layers.findIndex(l => l.id === id);
  const j = idx + (dir > 0 ? 1 : -1);
  if (idx < 0 || j < 0 || j >= _naraPaint.layers.length) return;
  const a = _naraPaint.layers[idx];
  const b = _naraPaint.layers[j];
  if (!b) return;
  const o = a.order;
  a.order = b.order;
  b.order = o;
  _naraSortLayers(); _naraNormalizeLayerOrder(); _naraSaveLayers(); _naraRenderLayers();
}
function _naraRenameLayer(id, name) { const l = _naraLayerById(id); if (l) { l.name = (name || 'Layer').slice(0, 24); _naraSaveLayers(); } }
function _naraSetActiveLayer(id) { if (_naraLayerById(id)) { _naraPaint.activeLayerId = id; _naraSaveLayers(); _naraRenderLayers(); } }
function _naraToggleLayerProp(id, prop) { const l = _naraLayerById(id); if (l) { l[prop] = !l[prop]; _naraSaveLayers(); _naraRenderLayers(); } }
function _naraSetLayerOpacity(id, v) { const l = _naraLayerById(id); if (l) { l.opacity = Math.max(0, Math.min(1, (+v) / 100)); _naraSaveLayers(); } }
function _naraSetLayerBlend(id, v) { const l = _naraLayerById(id); if (l) { l.blend = v || 'source-over'; _naraSaveLayers(); } }
function _naraFilterActionsByLayer(stack, layerId) {
  const keep = s => _naraResolveLayerId(s) !== layerId;
  return stack
    .map(a => a && a.type === 'clear' ? { type: 'clear', strokes: (a.strokes || []).filter(keep) } : a)
    .filter(a => !a || a.type !== 'stroke' || keep(a.stroke));
}
// wipe every stroke (also deletes the docs). Returns a snapshot so it can be undone.
function _naraWipeStrokes() {
  const snap = [..._naraCollab.strokes.values()].map(_naraCloneStroke);
  for (const id of _naraCollab.strokes.keys()) _naraCollab.deleted.add(id);   // tombstone so late echoes don't reappear
  _naraCollab.strokes.clear();
  _naraRedrawAll();
  const ref = _naraStrokesRef(), d = _naraDb();
  if (ref && d) {
    ref.get().then(s2 => { let batch = d.batch(), n = 0; s2.forEach(doc => { batch.delete(doc.ref); if (++n >= 400) { batch.commit(); batch = d.batch(); n = 0; } }); if (n) batch.commit(); }).catch(() => {});
  } else _naraScheduleSave();
  return snap;
}
function _naraClearCanvas() {
  if (!_naraCollab.strokes.size) return;
  if (!confirm('Clear the WHOLE canvas? This wipes everyone\'s strokes.\n\nYou can undo it with Ctrl+Z.')) return;
  const snap = _naraWipeStrokes();
  _naraCollab.myUndo.push({ type: 'clear', strokes: snap });   // Ctrl+Z restores it all
  _naraCollab.myRedo.length = 0;
}
// collaborative undo/redo — acts on YOUR own strokes + your clears
function _naraUndo() {
  if (!_naraCollab.myUndo.length) return;
  const a = _naraCollab.myUndo.pop();
  if (a.type === 'clear') {                    // undo a clear → bring everything back
    _naraReaddStrokes(a.strokes);
    _naraCollab.myRedo.push({ type: 'reclear' });
    return;
  }
  const s = a.stroke;                          // undo a stroke
  _naraCollab.strokes.delete(s.id);
  if (s.id && !String(s.id).startsWith('local')) _naraCollab.deleted.add(s.id);   // ignore the server's late 'added' echo
  _naraRedrawAll();
  _naraCollab.myRedo.push(a);
  const ref = _naraStrokesRef();
  if (ref && s.id && !String(s.id).startsWith('local')) ref.doc(s.id).delete().catch(() => {});
  else _naraScheduleSave();
}
function _naraRedo() {
  if (!_naraCollab.myRedo.length) return;
  const a = _naraCollab.myRedo.pop();
  if (a.type === 'reclear') {                  // redo a clear → wipe again (still undoable)
    const snap = _naraWipeStrokes();
    _naraCollab.myUndo.push({ type: 'clear', strokes: snap });
    return;
  }
  const s = a.stroke; s.t = Date.now();        // redo a stroke
  _naraReaddStroke(s); _naraDrawStrokeOnBuf(s);
  _naraCollab.myUndo.push(a);
}
// ── realtime subscriptions ──
function _naraSubscribeStrokes() {
  const ref = _naraStrokesRef(); if (!ref) return;
  _naraCollab.unsubStrokes = ref.orderBy('t').onSnapshot(snap => {
    let redraw = false;
    snap.docChanges().forEach(ch => {
      const id = ch.doc.id;
      if (ch.type === 'added') {
        if (_naraCollab.strokes.has(id) || _naraCollab.deleted.has(id)) return;   // own optimistic / locally-removed
        const s = { id, ...ch.doc.data() };
        _naraCollab.strokes.set(id, s); _naraDrawStrokeOnBuf(s);
      } else if (ch.type === 'removed') {
        _naraCollab.deleted.delete(id);                // tombstone resolved
        if (_naraCollab.strokes.delete(id)) redraw = true;
      } else if (ch.type === 'modified') {
        if (_naraCollab.deleted.has(id)) return;
        _naraCollab.strokes.set(id, { id, ...ch.doc.data() }); redraw = true;
      }
    });
    if (redraw) _naraRedrawAll();
    // canvas is "loaded" once the server has answered (or anything is on screen) →
    // stop showing the loading state. A blank-from-cache first hit keeps loading on.
    if (_naraCollab.loading && (!snap.metadata.fromCache || _naraCollab.strokes.size > 0)) _naraCollab.loading = false;
  }, e => { console.warn('nara strokes sub', e); _naraCollab.loading = false; });
}
function _naraSubscribeCursors() {
  const ref = _naraCursorsRef(); if (!ref) return;
  _naraCollab.unsubCursors = ref.onSnapshot(snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === 'removed') _naraCollab.cursors.delete(ch.doc.id);
      else _naraCollab.cursors.set(ch.doc.id, ch.doc.data());
    });
  }, e => {});
}
function _naraDeleteMyCursor() {
  const ref = _naraCursorsRef();
  if (ref && _naraCollab.me) ref.doc(_naraCollab.me.id).delete().catch(() => {});
}
function _naraSwitchCanvas(id) {
  if (!id || id === _naraCollab.canvasId) { _naraRenderCanvasList(); return; }
  _naraDeleteMyCursor();
  if (_naraCollab.canvasId) _naraSaveLayers();   // persist the layer stack of the canvas we're leaving
  if (_naraCollab.unsubStrokes) { _naraCollab.unsubStrokes(); _naraCollab.unsubStrokes = null; }
  if (_naraCollab.unsubCursors) { _naraCollab.unsubCursors(); _naraCollab.unsubCursors = null; }
  _naraCollab.canvasId = id;
  try { localStorage.setItem('nara_active_canvas', id); } catch (e) {}
  _naraCollab.strokes.clear(); _naraCollab.cursors.clear(); _naraCollab.deleted.clear();
  _naraCollab.myUndo.length = 0; _naraCollab.myRedo.length = 0; _naraCollab.cur = null;
  _naraPaint.bufs.clear(); _naraLoadLayers();     // each canvas has its own layer stack
  _naraRedrawAll(); _naraRenderLayers();
  _naraCollab.loading = true;                      // show a loading indicator until strokes stream in
  clearTimeout(_naraCollab.loadTimer); _naraCollab.loadTimer = setTimeout(() => { _naraCollab.loading = false; }, 5000);
  _naraSubscribeStrokes(); _naraSubscribeCursors();
  _naraRenderCanvasList();
}
function _naraCreateCanvas(name) {
  const ref = _naraCanvasesRef(); if (!ref) return;
  const order = _naraCollab.canvases.length;
  ref.add({ name: name || ('Canvas ' + (order + 1)), order, createdAt: Date.now() })
    .then(doc => _naraSwitchCanvas(doc.id)).catch(e => console.warn('nara create', e));
}
function _naraNewCanvasPrompt() {
  const dflt = 'Canvas ' + (_naraCollab.canvases.length + 1);
  const name = prompt('New shared canvas name:', dflt);
  if (name !== null) _naraCreateCanvas((name.trim() || dflt));
}
function _naraSubscribeList() {
  const ref = _naraCanvasesRef(); if (!ref) return;
  _naraCollab.unsubList = ref.orderBy('order').onSnapshot(snap => {
    _naraCollab.canvases = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!_naraCollab.canvases.length && !_naraCollab.bootstrapping) {
      _naraCollab.bootstrapping = true; _naraCreateCanvas('Main'); return;
    }
    _naraCollab.bootstrapping = false;
    if (!_naraCollab.canvasId && _naraCollab.canvases.length) {
      const want = localStorage.getItem('nara_active_canvas');
      const exists = _naraCollab.canvases.find(c => c.id === want);
      _naraSwitchCanvas(exists ? want : _naraCollab.canvases[0].id);
    }
    _naraRenderCanvasList();
  }, e => console.warn('nara list', e));
}
function _naraRenderCanvasList() {
  const wrap = document.getElementById('nara-canvas-bar'); if (!wrap) return;
  if (!_naraDb()) { wrap.innerHTML = `<span class="nara-cv-label">LOCAL CANVAS (offline)</span>`; return; }
  const esc = s => (s || 'Canvas').replace(/</g, '&lt;');
  const cur = _naraCollab.canvases.find(c => c.id === _naraCollab.canvasId);
  const items = _naraCollab.canvases.map(c =>
    `<div class="nara-cv-item${c.id === _naraCollab.canvasId ? ' sel' : ''}" onclick="_naraPickCanvas('${c.id}')"><span class="nara-cv-dot"></span>${esc(c.name)}</div>`).join('');
  wrap.innerHTML =
    `<span class="nara-cv-label">CANVAS</span>` +
    `<div class="nara-cv-drop">` +
      `<button class="nara-cv-current" onclick="_naraToggleCvMenu(event)"><span class="nara-cv-name">${esc(cur ? cur.name : '…')}</span><span class="nara-cv-caret">▾</span></button>` +
      `<div class="nara-cv-menu" id="nara-cv-menu">${items}<div class="nara-cv-item nara-cv-new" onclick="_naraNewCanvasPrompt()">＋ New canvas…</div></div>` +
    `</div>` +
    `<span class="nara-cv-live" id="nara-cv-live"></span>`;
}
function _naraToggleCvMenu(e) { if (e) e.stopPropagation(); const m = document.getElementById('nara-cv-menu'); if (m) m.classList.toggle('open'); }
function _naraPickCanvas(id) { const m = document.getElementById('nara-cv-menu'); if (m) m.classList.remove('open'); _naraSwitchCanvas(id); }
function _naraGlobalClick(e) { const m = document.getElementById('nara-cv-menu'); if (m && m.classList.contains('open') && !e.target.closest('.nara-cv-drop')) m.classList.remove('open'); }
function _naraKeyDown(e) {
  if (!_naraPaint.active) return;
  const tgt = e.target;
  if (tgt && (/^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName) || tgt.isContentEditable)) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); _naraUndo(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); _naraRedo(); }
}
function _naraOnStyleTab() {
  if (!_naraPaint.active) return false;
  const st = document.getElementById('tab-style');
  return !!st && st.style.display !== 'none';
}

// floating bucket palette — dip the pencil in one to start absorbing its colour
function _naraBuildPalette() {
  if (document.getElementById('nara-palette')) return;
  const pal = document.createElement('div'); pal.id = 'nara-palette'; pal.className = 'nara-palette';
  // shared-canvas switcher (which global canvas you're painting on + live count)
  const bar = document.createElement('div'); bar.id = 'nara-canvas-bar'; bar.className = 'nara-canvas-bar';
  pal.appendChild(bar);
  const row = document.createElement('div'); row.className = 'nara-tools-row';
  pal.appendChild(row);
  const buckets = [
    { c: [255, 40, 60],  label: 'RED' },
    { c: [40, 210, 90],  label: 'GREEN' },
    { c: [60, 110, 255], label: 'BLUE' },
    { c: [16, 16, 20],   label: 'BLACK' },
    { c: [255, 255, 255], label: 'WATER', water: true },
  ];
  buckets.forEach(b => {
    const el = document.createElement('div');
    el.className = 'nara-bucket' + (b.water ? ' water' : '');
    el.style.setProperty('--bk', `rgb(${b.c[0]},${b.c[1]},${b.c[2]})`);
    el.innerHTML = `<div class="nara-bucket-can"><div class="nara-bucket-paint"></div></div><div class="nara-bucket-label">${b.label}</div>`;
    el.addEventListener('mouseenter', () => { if (!_naraPaint.down) _naraPaint.dip = b.c.slice(); });
    el.addEventListener('mouseleave', () => { _naraPaint.dip = null; });
    row.appendChild(el);
  });
  // live colour readout (the "RGB table")
  const read = document.createElement('div');
  read.className = 'nara-readout';
  read.innerHTML = `<div id="nara-read-swatch" class="nara-read-swatch"></div>
    <div class="nara-read-vals"><span id="nara-read-rgb">R255 G90 B130</span>
    <button class="nara-read-clr" onclick="_naraClearCanvas()">CLEAR</button></div>`;
  row.appendChild(read);
  // brush picker
  const lb = document.createElement('div'); lb.className = 'nara-tools-row nara-lb-row'; lb.id = 'nara-lb-row';
  pal.appendChild(lb);
  document.body.appendChild(pal);
  _naraRenderTools();
  _naraRenderCanvasList();
}
function _naraRenderTools() {
  const lb = document.getElementById('nara-lb-row'); if (!lb) return;
  const brushes = NARA_BRUSHES.map(b => `<button class="nara-brush${b === _naraPaint.brush ? ' active' : ''}" onclick="_naraSetBrush('${b}')">${b}</button>`).join('');
  lb.innerHTML = `<div class="nara-lb-group"><span class="nara-mini-label">BRUSH</span>${brushes}</div>`;
}
function _naraSetBrush(b) { if (NARA_BRUSHES.includes(b)) _naraPaint.brush = b; _naraRenderTools(); }
function _naraRemovePalette() { document.getElementById('nara-palette')?.remove(); }

// ── right-edge sliding LAYERS panel (Procreate-style stack) ──
function _naraBuildLayersPanel() {
  if (document.getElementById('nara-layers-panel')) return;
  const p = document.createElement('div'); p.id = 'nara-layers-panel'; p.className = 'nara-layers-panel';
  p.innerHTML =
    `<div class="nlp-tab" onclick="this.parentNode.classList.toggle('pinned')"><span>LAYERS</span></div>` +
    `<div class="nlp-inner">` +
      `<div class="nlp-head"><span>LAYERS</span><div class="nlp-add">` +
        `<button onclick="_naraAddLayer(1)" title="new layer above active">＋ Above</button>` +
        `<button onclick="_naraAddLayer(-1)" title="new layer below active">＋ Below</button>` +
      `</div></div>` +
      `<div id="nara-layers-list" class="nlp-list"></div>` +
      `<div class="nlp-hint">drag cursor here to open · active layer is highlighted</div>` +
    `</div>`;
  document.body.appendChild(p);
  _naraRenderLayers();
}
function _naraRemoveLayersPanel() { document.getElementById('nara-layers-panel')?.remove(); }
function _naraRenderLayers() {
  const list = document.getElementById('nara-layers-list'); if (!list) return;
  _naraSortLayers();
  const rows = [];
  for (let i = _naraPaint.layers.length - 1; i >= 0; i--) {   // front layer at top of the list
    const l = _naraPaint.layers[i];
    const act = l.id === _naraPaint.activeLayerId ? ' active' : '';
    const esc = (l.name || '').replace(/"/g, '&quot;');
    rows.push(
      `<div class="nlp-row${act}" onclick="_naraSetActiveLayer('${l.id}')">` +
        `<button class="nlp-eye${l.visible === false ? ' off' : ''}" title="show / hide" onclick="event.stopPropagation();_naraToggleLayerProp('${l.id}','visible')">${l.visible === false ? '◌' : '◉'}</button>` +
        `<input class="nlp-name" value="${esc}" spellcheck="false" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter')this.blur()" onchange="_naraRenameLayer('${l.id}',this.value)">` +
        `<div class="nlp-opts">` +
          `<button class="nlp-opt${l.alphaLock ? ' on' : ''}" title="alpha lock (paint only on existing pixels)" onclick="event.stopPropagation();_naraToggleLayerProp('${l.id}','alphaLock')">▦</button>` +
          `<button class="nlp-opt${l.locked ? ' on' : ''}" title="lock (no drawing)" onclick="event.stopPropagation();_naraToggleLayerProp('${l.id}','locked')">${l.locked ? '🔒' : '🔓'}</button>` +
          `<button class="nlp-opt" title="move up" onclick="event.stopPropagation();_naraMoveLayer('${l.id}',1)">▲</button>` +
          `<button class="nlp-opt" title="move down" onclick="event.stopPropagation();_naraMoveLayer('${l.id}',-1)">▼</button>` +
          (l.id === 'base' ? '' : `<button class="nlp-opt nlp-del" title="delete layer" onclick="event.stopPropagation();_naraDeleteLayer('${l.id}')">✕</button>`) +
        `</div>` +
        `<select class="nlp-blend" title="blend mode" onclick="event.stopPropagation()" onchange="_naraSetLayerBlend('${l.id}',this.value)">` +
          NARA_BLENDS.map(([v, n]) => `<option value="${v}"${(l.blend || 'source-over') === v ? ' selected' : ''}>${n}</option>`).join('') +
        `</select>` +
        `<input type="range" class="nlp-opacity" min="0" max="100" value="${Math.round((l.opacity == null ? 1 : l.opacity) * 100)}" title="opacity" onclick="event.stopPropagation()" oninput="_naraSetLayerOpacity('${l.id}',this.value)">` +
      `</div>`
    );
  }
  list.innerHTML = rows.join('');
}

// keep #pattern-canvas pinned over #content; manage the persistent paint buffer
function _naraPinCanvas(cv) {
  const ct = document.getElementById('content');
  if (!ct) return;
  const r = ct.getBoundingClientRect();
  const cw = Math.max(1, Math.round(r.width)), ch = Math.max(1, Math.round(r.height));
  if (cv.style.position !== 'fixed') cv.style.position = 'fixed';
  cv.style.left = r.left + 'px'; cv.style.top = r.top + 'px';
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.style.background = '';
  cv.style.pointerEvents = 'none';
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
}

function _naraIsBackground(target) {
  if (!target) return false;
  return !target.closest('.panel, button, input, textarea, select, a, label, .tab-bar, .nara-bucket, .nara-palette, .nara-layers-panel, #header, #sidebar, #mobile-topbar, #editor, [id$="-modal"], [id$="-overlay"], #char-context-menu, .cv-owner-subtitle');
}
function _naraCanvasXY(clientX, clientY) {
  const ct = document.getElementById('content'); const r = ct.getBoundingClientRect();
  return { x: clientX - r.left, y: clientY - r.top };
}
// mouse wheel resizes the brush — Style tab only
function _naraWheel(e) {
  if (!_naraOnStyleTab()) return;
  e.preventDefault();
  const step = Math.max(1, Math.round(_naraPaint.size * 0.12));   // bigger jumps when already big
  _naraPaint.size = Math.max(2, Math.min(140, _naraPaint.size + (e.deltaY < 0 ? step : -step)));
}
function _naraEndStroke() {
  if (!_naraPaint.down) return;
  _naraPaint.down = false; _naraPaint.pid = null;
  document.body.classList.remove('nara-no-select');
  _naraCommitStroke();        // publish the finished stroke (shared) / save (offline)
}
function _naraPointerDown(e) {
  // pen tablets report button 0 on contact; also accept pen/touch explicitly
  const okBtn = e.button === 0 || e.button === -1 || e.pointerType === 'pen' || e.pointerType === 'touch';
  if (!_naraOnStyleTab() || !okBtn || !_naraIsBackground(e.target)) return;
  const al = _naraActiveLayer(); if (al && al.locked) return;   // can't draw on a locked layer
  if (_naraPaint.down) return;                 // already drawing → ignore palm / 2nd pointer
  e.preventDefault();                          // stop drag-selecting / scrolling
  // Capture this pointer so EVERY move/up for it routes here — vital for pens,
  // which otherwise drop events or get hijacked by Windows-Ink/scroll gestures.
  try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (_) {}
  _naraPaint.pid = e.pointerId;
  document.body.classList.add('nara-no-select');
  _naraPaint.pen = (e.pointerType === 'pen');
  _naraPaint.pressure = e.pressure || 0.5;
  _naraPaint.down = true;
  const buf = _naraGetBuf();
  const { x, y } = _naraCanvasXY(e.clientX, e.clientY);
  _naraBeginStroke(x / buf.width, y / buf.height);
}
function _naraPointerMove(e) {
  // while drawing, only follow the pointer that started the stroke (ignore palm)
  if (_naraPaint.down && _naraPaint.pid != null && e.pointerId !== _naraPaint.pid) return;
  _naraPaint.mx = e.clientX; _naraPaint.my = e.clientY;
  if (!_naraPaint.down) return;
  if (!_naraOnStyleTab()) { _naraEndStroke(); return; }
  // Only the MOUSE's buttons bitmask is trustworthy here; pen drivers sometimes
  // report buttons=0 on a move mid-stroke, which used to falsely cut the line.
  // Pens/touch end only via pointerup/pointercancel (reliable with capture).
  if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) { _naraEndStroke(); return; }
  e.preventDefault();
  _naraPaint.pen = (e.pointerType === 'pen');
  const buf = _naraGetBuf();
  // Replay every coalesced sample the browser batched → smooth, dense pen lines
  const samples = (e.getCoalescedEvents && e.getCoalescedEvents()) || [e];
  for (const ev of samples) {
    if (ev.pressure) _naraPaint.pressure = ev.pressure;
    const { x, y } = _naraCanvasXY(ev.clientX, ev.clientY);
    _naraExtendStroke(x / buf.width, y / buf.height);
  }
}
function _naraPointerUp(e) {
  if (e && _naraPaint.down && _naraPaint.pid != null && e.pointerId != null && e.pointerId !== _naraPaint.pid) return;
  try { if (e && e.target && e.target.releasePointerCapture && e.pointerId != null) e.target.releasePointerCapture(e.pointerId); } catch (_) {}
  _naraEndStroke();
}

// flowing pastel-rainbow page background (shown on every tab except Style)
function _naraDrawRainbowBg(ctx, w, h, t) {
  const lg = ctx.createLinearGradient(0, 0, w, h);
  for (let s = 0; s <= 8; s++) {
    const f = s / 8;
    const hue = ((f * 360) + t * 22) % 360;
    lg.addColorStop(f, `hsl(${hue},68%,85%)`);
  }
  ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
  // soft drifting light blobs for depth
  for (let i = 0; i < 5; i++) {
    const bx = (0.5 + 0.42 * Math.sin(t * 0.25 + i * 1.7)) * w;
    const by = (0.5 + 0.42 * Math.cos(t * 0.21 + i * 2.3)) * h;
    const rr = Math.min(w, h) * (0.28 + 0.08 * Math.sin(t * 0.4 + i));
    const hue = ((i / 5) * 360 + t * 30) % 360;
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
    rg.addColorStop(0, `hsla(${hue},80%,90%,0.5)`);
    rg.addColorStop(1, `hsla(${hue},80%,90%,0)`);
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  }
}

// translucent, flowing rainbow ribbon frame around the whole viewport
function _naraRainGrad(g, x0, y0, x1, y1, hueOff, t, a) {
  const lg = g.createLinearGradient(x0, y0, x1, y1);
  for (let s = 0; s <= 6; s++) {
    const f = s / 6;
    const hue = ((f * 360) + hueOff + t * 40) % 360;
    lg.addColorStop(f, `hsla(${hue},85%,82%,${a})`);
  }
  return lg;
}
function _naraDrawEdges(g, w, h, t) {
  const base = Math.max(12, Math.min(w, h) * 0.022);
  const amp = base * 0.6, step = 7;
  g.save();
  // two passes: a soft wide glow then the brighter ribbon
  for (let pass = 0; pass < 2; pass++) {
    const tk = pass === 0 ? base * 1.7 : base;
    const a = pass === 0 ? 0.16 : 0.5;
    const ph = pass === 0 ? 0 : 1.6;
    // top
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0);
    for (let x = w; x >= 0; x -= step) g.lineTo(x, tk + amp * Math.sin(x * 0.011 + t * 1.3 + ph));
    g.closePath(); g.fillStyle = _naraRainGrad(g, 0, 0, w, 0, 0, t, a); g.fill();
    // bottom
    g.beginPath(); g.moveTo(0, h); g.lineTo(w, h);
    for (let x = w; x >= 0; x -= step) g.lineTo(x, h - tk - amp * Math.sin(x * 0.011 - t * 1.15 + ph));
    g.closePath(); g.fillStyle = _naraRainGrad(g, 0, 0, w, 0, 180, t, a); g.fill();
    // left
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, h);
    for (let y = h; y >= 0; y -= step) g.lineTo(tk + amp * Math.sin(y * 0.011 + t * 1.1 + ph), y);
    g.closePath(); g.fillStyle = _naraRainGrad(g, 0, 0, 0, h, 90, t, a); g.fill();
    // right
    g.beginPath(); g.moveTo(w, 0); g.lineTo(w, h);
    for (let y = h; y >= 0; y -= step) g.lineTo(w - tk - amp * Math.sin(y * 0.011 - t * 1.25 + ph), y);
    g.closePath(); g.fillStyle = _naraRainGrad(g, 0, 0, 0, h, 270, t, a); g.fill();
  }
  g.restore();
}
// a ring showing the current brush footprint (centred on the paint point)
function _naraDrawSizeRing(g, x, y, size) {
  const r = size / 2;
  g.save();
  g.beginPath(); g.arc(x, y, r, 0, 6.2832);
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.stroke();
  g.beginPath(); g.arc(x, y, r, 0, 6.2832);
  g.lineWidth = 0.8; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
  g.restore();
}
// the pencil/brush — bristle tip pinned exactly on the cursor point
function _naraDrawBrush(g, x, y) {
  const col = _naraPaintColor();
  g.save();
  g.translate(x, y);
  g.rotate(0.6);
  g.fillStyle = col;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-5.5, -15); g.lineTo(5.5, -15); g.closePath(); g.fill();
  g.beginPath(); g.arc(0, 0, 3.2, 0, 6.2832); g.fill();             // wet blob at tip
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.arc(-1, -1, 1.1, 0, 6.2832); g.fill();
  g.fillStyle = '#c9cdd6'; g.strokeStyle = '#8a9099'; g.lineWidth = 1; // ferrule
  g.beginPath(); g.rect(-5.5, -22, 11, 7.5); g.fill(); g.stroke();
  g.fillStyle = '#d9af63'; g.strokeStyle = '#6b4f23'; g.lineWidth = 1.2; // handle
  g.beginPath(); g.moveTo(-3.2, -22); g.lineTo(3.2, -22); g.lineTo(2, -48); g.lineTo(-2, -48); g.closePath();
  g.fill(); g.stroke();
  g.restore();
}
// centred "loading" badge shown while a canvas's strokes are still streaming in
function _naraDrawLoading(g, w, h) {
  const cx = w / 2, cy = h / 2, t = _naraPaint.t;
  g.save();
  g.fillStyle = 'rgba(255,255,255,0.82)';
  g.fillRect(cx - 132, cy - 34, 264, 68);
  g.strokeStyle = 'rgba(120,120,140,0.35)'; g.lineWidth = 1; g.strokeRect(cx - 132, cy - 34, 264, 68);
  // spinner
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 6.2832 + t * 4, fade = (i / 12);
    g.strokeStyle = `rgba(150,120,200,${0.25 + 0.6 * fade})`; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 96 + Math.cos(a) * 7, cy + Math.sin(a) * 7); g.lineTo(cx - 96 + Math.cos(a) * 13, cy + Math.sin(a) * 13); g.stroke();
  }
  g.fillStyle = '#4a3f63'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = 'bold 13px system-ui, sans-serif'; g.fillText('Loading canvas…', cx - 72, cy - 6);
  g.fillStyle = '#7a7290'; g.font = '10px system-ui, sans-serif'; g.fillText('be patient, girlypop...', cx - 72, cy + 11);
  g.restore();
}
function _naraPaintTick(ts) {
  if (!_naraPaint.active) { _naraPaint.rafId = null; return; }
  if (!_naraPaint.prevTs) _naraPaint.prevTs = ts;
  const dt = Math.min((ts - _naraPaint.prevTs) / 1000, 0.05); _naraPaint.prevTs = ts; _naraPaint.t += dt;

  // dip mixing — while the pencil sits in a bucket, absorb that colour (~2s to full)
  if (_naraPaint.dip) {
    const k = 1 - Math.exp(-dt / 0.6);
    _naraPaint.rF += (_naraPaint.dip[0] - _naraPaint.rF) * k;
    _naraPaint.gF += (_naraPaint.dip[1] - _naraPaint.gF) * k;
    _naraPaint.bF += (_naraPaint.dip[2] - _naraPaint.bF) * k;
  }

  const onStyle = _naraOnStyleTab();

  // On the Style tab, stop the browser from treating a pen/touch drag as a
  // scroll/pan gesture (which cancels the stroke) — essential for drawing tablets.
  const ct = document.getElementById('content');
  if (ct) {
    const want = onStyle ? 'none' : '';
    if (_naraPaint.taOff !== want) { ct.style.touchAction = want; _naraPaint.taOff = want; }
  }

  // paint surface: white canvas + painting on Style tab, pastel rainbow elsewhere
  const cv = document.getElementById('pattern-canvas');
  if (cv) {
    _naraPinCanvas(cv);
    const w = cv.width, h = cv.height;
    _naraEnsureBufs(w, h);
    const ctx = cv.getContext('2d');
    if (onStyle) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      for (const l of _naraPaint.layers) {   // already sorted back→front by order
        if (l.visible === false) continue;
        const b = _naraPaint.bufs.get(l.id); if (!b) continue;
        ctx.globalAlpha = l.opacity == null ? 1 : l.opacity;
        ctx.globalCompositeOperation = l.blend || 'source-over';   // Photoshop/Krita blend mode
        ctx.drawImage(b, 0, 0);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (_naraCollab.loading) _naraDrawLoading(ctx, w, h);   // reassure: drawings are loading, not lost
    } else {
      _naraDrawRainbowBg(ctx, w, h, _naraPaint.t);
    }
  }

  // palette + layers panel only on the Style tab (that's where you paint)
  const pal = document.getElementById('nara-palette');
  if (pal) pal.style.display = onStyle ? '' : 'none';
  const lpanel = document.getElementById('nara-layers-panel');
  if (lpanel) lpanel.style.display = onStyle ? '' : 'none';
  if (onStyle) {
    const c = _naraRGB();
    const sw = document.getElementById('nara-read-swatch'); if (sw) sw.style.background = `rgb(${c[0]},${c[1]},${c[2]})`;
    const rg = document.getElementById('nara-read-rgb'); if (rg) rg.textContent = `R${c[0]} G${c[1]} B${c[2]}`;
  }

  // broadcast my own cursor to others on this canvas (throttled, normalized)
  if (_naraCollab.me && _naraCursorsRef() && ct) {
    const rc = ct.getBoundingClientRect();
    const nx = (_naraPaint.mx - rc.left) / rc.width, ny = (_naraPaint.my - rc.top) / rc.height;
    const now = performance.now();
    const moved = Math.abs(nx - _naraCollab.lastCursorX) + Math.abs(ny - _naraCollab.lastCursorY) > 0.0025;
    if ((moved && now - _naraCollab.lastCursorT > 110) || now - _naraCollab.lastCursorT > 1600) {
      _naraCollab.lastCursorT = now; _naraCollab.lastCursorX = nx; _naraCollab.lastCursorY = ny;
      _naraCursorsRef().doc(_naraCollab.me.id).set({ x: nx, y: ny, color: _naraCollab.me.color, name: _naraCollab.me.name, t: Date.now() }).catch(() => {});
    }
  }

  // overlay: frame everywhere + other people's cursors + my brush
  const ov = document.getElementById('nara-overlay');
  if (ov) {
    const w = window.innerWidth, h = window.innerHeight;
    if (ov.width !== w || ov.height !== h) { ov.width = w; ov.height = h; }
    const g = ov.getContext('2d'); g.clearRect(0, 0, w, h);
    _naraDrawEdges(g, w, h, _naraPaint.t);
    // other collaborators' cursors (same canvas, seen on every tab)
    let liveOthers = 0;
    if (ct) {
      const rc = ct.getBoundingClientRect(), nowMs = Date.now();
      for (const [id, cu] of _naraCollab.cursors) {
        if (_naraCollab.me && id === _naraCollab.me.id) continue;
        if (!cu || nowMs - (cu.t || 0) > 6000) continue;
        liveOthers++;
        _naraDrawRemoteCursor(g, rc.left + cu.x * rc.width, rc.top + cu.y * rc.height, cu.color || '#fff', cu.name || '');
      }
    }
    const liveEl = document.getElementById('nara-cv-live');
    if (liveEl) liveEl.textContent = `● ${liveOthers + (_naraCollab.canvasId ? 1 : 0)} here`;
    if (onStyle) _naraDrawSizeRing(g, _naraPaint.mx, _naraPaint.my, _naraPaint.size);
    _naraDrawBrush(g, _naraPaint.mx, _naraPaint.my);
  }
  _naraPaint.rafId = requestAnimationFrame(_naraPaintTick);
}
// a small labelled marker for another painter's cursor
function _naraDrawRemoteCursor(g, x, y, color, name) {
  g.save();
  g.translate(x, y);
  // little pencil-tip triangle in their colour
  g.fillStyle = color; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(11, 4); g.lineTo(4, 11); g.closePath();
  g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 0, 2.2, 0, 6.2832); g.fillStyle = '#fff'; g.fill();
  // name tag
  if (name) {
    g.font = '9px "Press Start 2P", monospace';
    const w = g.measureText(name).width + 8;
    g.fillStyle = color; g.globalAlpha = 0.9;
    g.fillRect(12, 10, w, 13);
    g.globalAlpha = 1; g.fillStyle = '#10121a';
    g.fillText(name, 16, 20);
  }
  g.restore();
}

function _startNaraPaint() {
  document.getElementById('char-view')?.classList.add('nara-paint-ui');
  if (_naraPaint.active) return;       // keep painting persistent across re-renders
  _naraPaint.active = true; _naraPaint.dip = null;
  _naraPaint.charId = currentId;       // key this user's saved drawing to the character
  _injectNaraStyles();
  _naraBuildPalette();
  _naraBuildLayersPanel();
  _naraPaint.bufs = new Map(); _naraLoadLayers();   // restore this canvas's layer stack
  const cv = document.getElementById('pattern-canvas');
  if (cv) { _naraPinCanvas(cv); _naraEnsureBufs(cv.width, cv.height); }
  // collaboration: shared canvases via Firestore (or local fallback when offline)
  _naraCollab.me = _naraIdentity();
  if (_naraDb()) {
    _naraCollab.loading = true;
    _naraCollab.canvasId = null; _naraCollab.strokes.clear(); _naraCollab.cursors.clear(); _naraCollab.deleted.clear();
    _naraSubscribeList();
  } else {
    _naraLoadStrokes();           // offline: restore stroke data if present
    if (!_naraCollab.strokes.size) _naraLoadDrawing();
  }
  _naraRenderLayers();
  document.addEventListener('click', _naraGlobalClick);
  window.addEventListener('beforeunload', _naraSaveDrawing);
  window.addEventListener('beforeunload', _naraDeleteMyCursor);

  const arrow = document.getElementById('cursor'); if (arrow) arrow.style.display = 'none';

  if (!document.getElementById('nara-overlay')) {
    const ov = document.createElement('canvas'); ov.id = 'nara-overlay'; document.body.appendChild(ov);
  }
  document.addEventListener('pointerdown', _naraPointerDown);
  document.addEventListener('pointermove', _naraPointerMove);
  window.addEventListener('pointerup', _naraPointerUp);
  window.addEventListener('pointercancel', _naraPointerUp);
  window.addEventListener('blur', _naraPointerUp);
  document.addEventListener('keydown', _naraKeyDown);
  document.addEventListener('wheel', _naraWheel, { passive: false });

  _naraPaint.prevTs = 0;
  if (!_naraPaint.rafId) _naraPaint.rafId = requestAnimationFrame(_naraPaintTick);
}
function _stopNaraPaint() {
  document.getElementById('char-view')?.classList.remove('nara-paint-ui');
  if (!_naraPaint.active) return;
  clearTimeout(_naraPaint.saveTimer);
  _naraSaveDrawing();                  // persist before tearing down (offline only)
  _naraSaveLayers();
  window.removeEventListener('beforeunload', _naraSaveDrawing);
  window.removeEventListener('beforeunload', _naraDeleteMyCursor);
  // tear down collaboration listeners + remove my cursor from the shared canvas
  _naraDeleteMyCursor();
  if (_naraCollab.unsubList) { _naraCollab.unsubList(); _naraCollab.unsubList = null; }
  if (_naraCollab.unsubStrokes) { _naraCollab.unsubStrokes(); _naraCollab.unsubStrokes = null; }
  if (_naraCollab.unsubCursors) { _naraCollab.unsubCursors(); _naraCollab.unsubCursors = null; }
  _naraCollab.canvasId = null; _naraCollab.cur = null; _naraCollab.loading = false;
  _naraCollab.strokes.clear(); _naraCollab.cursors.clear(); _naraCollab.deleted.clear();
  _naraCollab.myUndo.length = 0; _naraCollab.myRedo.length = 0;
  _naraPaint.active = false; _naraPaint.down = false; _naraPaint.dip = null; _naraPaint.layers = []; _naraPaint.bufs = new Map();
  if (_naraPaint.rafId) { cancelAnimationFrame(_naraPaint.rafId); _naraPaint.rafId = null; }
  document.removeEventListener('click', _naraGlobalClick);
  document.removeEventListener('pointerdown', _naraPointerDown);
  document.removeEventListener('pointermove', _naraPointerMove);
  window.removeEventListener('pointerup', _naraPointerUp);
  window.removeEventListener('pointercancel', _naraPointerUp);
  window.removeEventListener('blur', _naraPointerUp);
  document.removeEventListener('keydown', _naraKeyDown);
  document.removeEventListener('wheel', _naraWheel, { passive: false });
  document.body.classList.remove('nara-no-select');
  const _ct = document.getElementById('content'); if (_ct) _ct.style.touchAction = '';
  _naraPaint.taOff = '';
  _naraPaint.undo.length = 0; _naraPaint.redo.length = 0;
  _naraRemovePalette();
  _naraRemoveLayersPanel();
  document.getElementById('nara-overlay')?.remove();
  const arrow = document.getElementById('cursor'); if (arrow) arrow.style.display = '';
  const cv = document.getElementById('pattern-canvas');
  if (cv) {
    const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
    cv.style.pointerEvents = ''; cv.style.background = '';
    if (cv.style.position === 'fixed') { cv.style.position = ''; cv.style.left = ''; cv.style.top = ''; cv.style.width = ''; cv.style.height = ''; }
  }
}
// ─────────────────────────────────────────────────────────────

// ── BIZZY bee pattern ─────────────────────────────────────────
const _BIZZY_RE = /^Bizzy$/i;
function _isBizzy(c) { return !!(c && c.name && _BIZZY_RE.test(c.name)); }

const _BJ_RE = /^BLACKJACK$/i;
function _isBlackjack(c) { return !!(c && c.name && _BJ_RE.test(c.name)); }

const _KATIE_RE = /^Katie$/i;
function _isKatie(c) { return !!(c && c.name && _KATIE_RE.test(c.name)); }

const _SNAPS_RE = /^Snaps$/i;
function _isSnaps(c) { return !!(c && c.name && _SNAPS_RE.test(c.name)); }

const _LEON_RE = /^Leon$/i;
function _isLeon(c) { return !!(c && c.name && _LEON_RE.test(c.name)); }
let _leonFireRafId = null;

const _VALKYRIE_RE = /^Valkyrie$/i;
function _isValkyrie(c) { return !!(c && c.name && _VALKYRIE_RE.test(c.name)); }
let _valkyrieOverlayRafId = null;

const _ADAM_RE = /^Adam$/i;
function _isAdam(c) { return !!(c && c.name && _ADAM_RE.test(c.name)); }
let _adamOverlayRafId = null;

const _FURY_RE = /^Fury$/i;
function _isFury(c) { return !!(c && c.name && _FURY_RE.test(c.name)); }
let _furyOverlayRafId = null;
let _furyMuffinX = 0, _furyMuffinY = 0;
let _furyMuffinTargX = 0, _furyMuffinTargY = 0;
let _furyMuffinVX = 0, _furyMuffinVY = 0;   // spring velocity
let _furyMuffinBounceT = 0;   // decays after click (squish anim)
let _furyMuffinHappyT  = 0;   // decays after click (happy eyes)
let _furyMuffinSparkles = [];  // fire sparkle particles on click
function _furyMuffinMouseMove(e) { _furyMuffinTargX = e.clientX; _furyMuffinTargY = e.clientY; }
function _furyMuffinClick() {
  _furyMuffinBounceT = 1.0;
  _furyMuffinHappyT  = 2.2;
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 90 + Math.random() * 200;
    _furyMuffinSparkles.push({ x: _furyMuffinX, y: _furyMuffinY - 8,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 80,
      life: 1, r: 2.5 + Math.random() * 4.5, hue: Math.random() * 45 });
  }
}

// ── Sorrow — exactly Fury's fire, but monochrome and pouring DOWN from above,
// with a googly-eyed kebab cursor instead of the muffin. (Reuses Fury's draw.) ──
const _SORROW_RE = /^Sorrow$/i;
function _isSorrow(c) { return !!(c && c.name && _SORROW_RE.test(c.name)); }
let _sorrowOverlayRafId = null;

// ── Lucifer · UNLEASHED — form-specific demonic style (the devil, strongest
// by far). Only fires when Lucifer's ACTIVE form is "Unleashed"; the base form
// and every other form keep their normal styling. ──
const _LUCIFER_RE = /^Lucifer$/i;
function _isLuciferUnleashed(c) {
  if (!c || !c.name || !_LUCIFER_RE.test(c.name)) return false;
  const idx = c.activeFormIdx || 0;
  if (idx === 0) return false;
  const af = (c.altForms || [])[idx - 1];
  return !!(af && af.name && /unleash/i.test(af.name));
}
let _luciferOverlayRafId = null;
let _luciferX = 0, _luciferY = 0, _luciferTargX = 0, _luciferTargY = 0, _luciferVX = 0, _luciferVY = 0;
let _luciferEmbers = [], _luciferRings = [], _luciferFlareT = 0, _luciferEmit = 0;
const _LUCIFER_RUNES = 'ΩΨΣΦΛΞΔΘ†‡'.split('');

// ── Divine — goddess of LIGHT. The radiant counterpart to Lucifer: same grand
// scale, but heavenly instead of infernal. A luminous sky, a giant rotating
// sun-mandala halo, ascending light-glyphs, god-rays from above, drifting
// motes, and rare descending sunbeams — gold / white / warm. A radiant cursor
// orb of light. Character-wide (matches "Divine"). ──
const _DIVINE_RE = /^Divine$/i;
function _isDivine(c) { return !!(c && c.name && _DIVINE_RE.test(c.name)); }
let _divineOverlayRafId = null;
let _divineX = 0, _divineY = 0, _divineTargX = 0, _divineTargY = 0, _divineVX = 0, _divineVY = 0;
let _divineMotes = [], _divineRings = [], _divineFlareT = 0, _divineEmit = 0;
const _DIVINE_GLYPHS = '✦✧✶✷❋✺✵⁂'.split('');

// ── Jimmy — he's just Fury's googly-eyed muffin, but BIG and sitting on the
// page background (a bit to the right), watching your cursor. No fire, no
// overlay companion: the muffin IS the background. Pattern-only, character-wide
// (matches "Jimmy"). Eyes track the real pointer wherever it goes. ──
const _JIMMY_RE = /^Jimmy$/i;
function _isJimmy(c) { return !!(c && c.name && _JIMMY_RE.test(c.name)); }
let _jimmyMX = (typeof window !== 'undefined' ? window.innerWidth  / 2 : 0);
let _jimmyMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
let _jimmyMouseHooked = false;
let _jimmyHover = false;          // cursor inside the muffin's hit ellipse
let _jimmyHappyT = 0;            // 0→1 happy ramp (hover + click)
let _jimmyBounceT = 0;          // decays after a click — squish anim
let _jimmyEmitBurst = 0;        // # of crumb sparkles queued by the last click
let _jimmySparkles = [];        // flying crumb particles (canvas coords)
let _jimmyLastDraw = 0;         // perf.now() of last Jimmy frame (gates the click hit-test)
// Screen-space hit ellipse for the muffin, refreshed every frame by the draw loop
let _jimmyCSX = 0, _jimmyCSY = 0, _jimmyHRX = 1, _jimmyHRY = 1;
function _jimmyHookMouse() {
  if (_jimmyMouseHooked) return;
  _jimmyMouseHooked = true;
  document.addEventListener('mousemove', e => { _jimmyMX = e.clientX; _jimmyMY = e.clientY; });
  document.addEventListener('click', e => {
    // only react while Jimmy is actually on-screen and only if the click lands on him
    if (performance.now() - _jimmyLastDraw > 500) return;
    const dx = (e.clientX - _jimmyCSX) / _jimmyHRX;
    const dy = (e.clientY - _jimmyCSY) / _jimmyHRY;
    if (dx * dx + dy * dy <= 1) {
      _jimmyBounceT = 1.0;
      _jimmyHappyT  = Math.min(1, _jimmyHappyT + 0.7);
      _jimmyEmitBurst = 16;
    }
  });
}

// ── The Shi — god of death. Silent, mysterious, VERY elegant: a pale soul
// garden (drifting petals, rising spirit-wisps, a cold moon) in blue/white/gray.
// Beauty in death. Character-wide (matches "The Shi" / "Shi"). ──
const _SHI_RE = /^(the\s+)?shi$/i;
function _isShi(c) { return !!(c && c.name && _SHI_RE.test(c.name)); }
let _shiOverlayRafId = null;
let _shiX = 0, _shiY = 0, _shiTargX = 0, _shiTargY = 0, _shiVX = 0, _shiVY = 0;
let _shiTrail = [], _shiPetals = [], _shiRings = [], _shiEmit = 0;

// ── Lunar — goddess of the moon. Elegant, calm, slightly melancholic; deep dark
// blues, a luminous moon centerpiece over a quiet starfield, drifting clouds and
// the occasional slow shooting star. Character-wide (matches "Lunar"). ──
const _LUNAR_RE = /^Lunar$/i;
function _isLunar(c) { return !!(c && c.name && _LUNAR_RE.test(c.name)); }
let _lunarOverlayRafId = null;
let _lunarX = 0, _lunarY = 0, _lunarTargX = 0, _lunarTargY = 0, _lunarVX = 0, _lunarVY = 0;
let _lunarDust = [], _lunarRings = [], _lunarEmit = 0;

// ── Helios — god of the sun. Strong, intimidating, aggressive, voracious: a
// blazing central sun firing long rotating rays, throbbing corona, solar flares
// and rising sparks in gold/white-hot. Character-wide (matches "Helios"). ──
const _HELIOS_RE = /^Helios$/i;
function _isHelios(c) { return !!(c && c.name && _HELIOS_RE.test(c.name)); }
let _heliosOverlayRafId = null;
let _heliosX = 0, _heliosY = 0, _heliosTargX = 0, _heliosTargY = 0, _heliosVX = 0, _heliosVY = 0;
let _heliosSparks = [], _heliosRings = [], _heliosFlareT = 0, _heliosEmit = 0;

// ── Zoe — spirit of life. Warm, lush, alive: an enchanted glowing garden of
// blooming flowers, drifting petals, rising pollen and swaying grass in greens
// and soft florals. Character-wide (matches "Zoe"). ──
const _ZOE_RE = /^Zoe$/i;
function _isZoe(c) { return !!(c && c.name && _ZOE_RE.test(c.name)); }
let _zoeOverlayRafId = null;
let _zoeX = 0, _zoeY = 0, _zoeTargX = 0, _zoeTargY = 0, _zoeVX = 0, _zoeVY = 0;
let _zoeParts = [], _zoeRings = [], _zoeEmit = 0;

// ── Iris — starry, shimmyful, joyous magical-girl energy: a twinkling golden
// sky full of sparkles, glitter, drifting hearts and shooting stars over a warm
// magical twilight. Character-wide (matches "Iris"). ──
const _IRIS_RE = /^Iris$/i;
function _isIris(c) { return !!(c && c.name && _IRIS_RE.test(c.name)); }
let _irisOverlayRafId = null;
let _irisX = 0, _irisY = 0, _irisTargX = 0, _irisTargY = 0, _irisVX = 0, _irisVY = 0;
let _irisParts = [], _irisRings = [], _irisEmit = 0;
let _irisShimmyCount = 0;   // stars popped with the cursor (shown in Iris's STYLE tab)
function _irisUpdateShimmyDisplay() {
  const el = document.getElementById('iris-shimmy-count');
  if (el) el.textContent = _irisShimmyCount;
}

// ── Mouseburger — a magical BOY; tougher, serious, a touch melancholic (Iris's
// husband). Cool indigo midnight, sharp crystalline sparkles, a lone star and a
// slow comet — with a few stray burgers drifting by (never the main plate). ──
const _MB_RE = /^Mouseburger$/i;
function _isMb(c) { return !!(c && c.name && _MB_RE.test(c.name)); }
let _mbOverlayRafId = null;
let _mbX = 0, _mbY = 0, _mbTargX = 0, _mbTargY = 0, _mbVX = 0, _mbVY = 0;
let _mbParts = [], _mbRings = [], _mbEmit = 0, _mbThread = [];
let _mbSwordAng = 0, _mbSlashes = [];
let _mbSliceCount = 0;   // burgers cut in half (shown in Mouseburger's STYLE tab)
function _mbUpdateSliceDisplay() {
  const el = document.getElementById('mb-slice-count');
  if (el) el.textContent = _mbSliceCount;
}
// Cut splatter: a flash ring + a spray of burger crumbs (bun, lettuce, patty,
// cheese, sesame), pushed into the overlay (x,y in viewport coords).
function _mbBurgerFx(x, y) {
  _mbRings.push({ x, y, r: 7, life: 1 });
  const cols = ['#e7c27a', '#7ec24a', '#8a4a2a', '#f3c64c', '#fff2d6'];
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2, s = 55 + Math.random() * 185;
    _mbParts.push({ kind: 'crumb', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 45, life: 1, decay: 1.1,
      sz: 2 + Math.random() * 3, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 11, grav: 300, col: cols[(Math.random() * cols.length) | 0] });
  }
}

// ── Juko! — energetic programmer girl (green code-garden + cat-sprite cursor) ──
const _JUKO_RE = /^Juko!?$/i;
function _isJuko(c) { return !!(c && c.name && _JUKO_RE.test(c.name)); }
let _jukoOverlayRafId = null;
let _jukoX = 0, _jukoY = 0;
let _jukoTargX = 0, _jukoTargY = 0;
let _jukoVX = 0, _jukoVY = 0;     // spring velocity
let _jukoBounceT = 0;             // decays after click (squish anim)
let _jukoHappyT  = 0;             // decays after click (happy ^^ eyes + blush)
let _jukoParticles = [];          // code-symbol burst on click
// Single-char glyphs for the falling matrix rain (code-flavoured)
const _JUKO_RAIN = '01{}()<>[];=+*/&|!?:.#%abcdefijklmnoprstuvwxyz01'.split('');
// Multi-char tokens that puff out when you click the sprite
const _JUKO_TOKENS = ['{', '}', ';', '<', '>', '/', '=', '(', ')', '[', ']', '*', '+', '&&', '=>', '!', '0', '1', 'fn', '//'];
// Little code snippets that fade in/out across the background
const _JUKO_SNIPPETS = [
  'function fun(){', 'return joy;', 'while(alive){', 'let dream = 1;',
  'console.log("hi!")', 'if(bug) fix();', 'juko.code()', '=> { play() }',
  'for(;;) dance;', 'const win = true;', 'npm run fun', 'git push origin',
  'sudo make coffee', '0xC0DE', '} // :3', 'await snack()', 'render(<Joy/>)',
  'while(true) vibe;', 'let x = 42;', 'export default me;',
];
function _jukoMouseMove(e) { _jukoTargX = e.clientX; _jukoTargY = e.clientY; }
function _jukoClick() {
  _jukoBounceT = 1.0;
  _jukoHappyT  = 1.8;
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 70 + Math.random() * 190;
    _jukoParticles.push({
      x: _jukoX, y: _jukoY,
      vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 70,
      rot: (Math.random() - 0.5) * Math.PI, vr: (Math.random() - 0.5) * 9,
      life: 1, sz: 11 + Math.random() * 11,
      ch:  _JUKO_TOKENS[Math.floor(Math.random() * _JUKO_TOKENS.length)],
      // ~55% green, ~45% light-yellow — her two signature tones
      hue: Math.random() < 0.55 ? 100 + Math.random() * 40 : 52 + Math.random() * 10,
    });
  }
}

// Frog state (pixel coords on overlay canvas)
let _katieFrogX = 200, _katieFrogY = 200;   // current position
let _katieFrogVX = 0,  _katieFrogVY = 0;    // velocity px/s
let _katieTargX  = 200, _katieTargY  = 200;  // mouse target in canvas px
let _katieFrogAng = 0;
let _katieMoveH = null, _katieHookCv = null;
let _katieOverlayRafId = null;

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
    // Top-level `let` does NOT become a window property in a non-module script,
    // so window._themeAudio was permanently undefined — which silently disabled
    // every music-reactive effect that read it (Juko's, etc.). Expose it here.
    window._themeAudio = _themeAudio;
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
let _keepPlayingInBg = false;     // when true, skip the visibilitychange pause
const _themeReloadKeys = new Set();
let _themeFadeTimer = null;
let _themeBarAutoHideTimer = null; // slides bar to peeked after 1.5 s
let _themeBarLeaveTimer    = null; // hides bar again after mouse leaves
let _themePendingKey       = null; // set when play() is blocked by autoplay policy
const _themeTimestamps = new Map(); // charId -> seconds (session-only)
const THEME_MAX_MB = 20;

const CLOUDINARY_CLOUD = 'dhlik6lkn';
const CLOUDINARY_PRESET = 'statsheets';

// ── Upload helper: Cloudinary first, ImageKit fallback ────────
// NOTE: enable "Unsigned uploads" in ImageKit Security settings
const _IK_PUBLIC_KEY = 'w5ddaqvugh';
const _IK_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

async function _uploadMedia(file, resourceType /* 'image' | 'video' */, publicId) {
  // 1. Cloudinary (primary)
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY_PRESET);
    form.append('resource_type', resourceType);
    if (publicId) form.append('public_id', publicId);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${resourceType}/upload`,
      { method: 'POST', body: form }
    );
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.secure_url;
  } catch (err) {
    console.warn('[Upload] Cloudinary failed — falling back to ImageKit:', err.message);
  }

  // 2. ImageKit (fallback)
  const fname = publicId
    ? publicId.split('/').pop() + (resourceType === 'video' ? '.mp3' : '')
    : (file.name || `upload_${Date.now()}`);
  const folder = publicId
    ? '/' + publicId.split('/').slice(0, -1).join('/')
    : '/statsheets';
  const ik = new FormData();
  ik.append('file',      file);
  ik.append('fileName',  fname);
  ik.append('publicKey', _IK_PUBLIC_KEY);
  ik.append('folder',    folder);
  const res2 = await fetch(_IK_UPLOAD_URL, { method: 'POST', body: ik });
  if (!res2.ok) throw new Error('ImageKit HTTP ' + res2.status);
  const d2 = await res2.json();
  if (!d2.url) throw new Error(d2.message || 'ImageKit: no URL');
  return d2.url;
}
// ─────────────────────────────────────────────────────────────

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
  // Juko's theme is permanently hardcoded to the bundled local file — it cannot
  // be changed via upload, and any uploaded song is ignored for playback. This
  // also guarantees the played audio is byte-identical to the file the reactivity
  // envelope analyses (sounds/juko.mp3), so currentTime stays perfectly aligned.
  if (_isJuko(c)) return { url: _JUKO_THEME_SRC, name: "JUKO'S THEME", startAt: 0, _jukoLocked: true };
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

  // Juko's theme is hardcoded and cannot be changed — show a locked notice
  // instead of the upload controls so nothing can overwrite it.
  if (_isJuko(c)) {
    container.innerHTML =
      `<div class="juko-music-locked" style="padding:26px 18px;text-align:center;">
        <div style="font-size:13px;letter-spacing:3px;color:var(--char-color,#4ade5a);text-shadow:0 0 14px var(--char-color,#4ade5a);">♪ JUKO'S THEME ♪</div>
        <div style="font-size:9px;letter-spacing:1.5px;color:#9fd6a4;margin-top:12px;line-height:1.9;">
          NO! GO AWAY!!! DON'T CHANGE MY MUSIC!!!!<br>
          It's locked! <span style="color:#eaffb0;">it can't be changed or removed.</span>
        </div>
        <div style="font-size:8px;letter-spacing:2px;color:#5a7a5e;margin-top:14px;">&lt;/&gt; LOCKED!!!!!amp;&amp;</div>
      </div>`;
    return;
  }

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
    const rawUrl = await _uploadMedia(file, 'video', publicId);
    const url = rawUrl + (rawUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
    const songData = { url, name: file.name.replace(/\.[^/.]+$/, '') };

    // Capture previous song (if any) before overwriting — useful for verification
    const prevSong = _getFormTheme(c, formIdx);

    console.log('[UPLOAD] New theme uploaded:', { url: rawUrl, cachebustedUrl: url, songData, prevSong });

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
  if (_keepPlayingInBg) return; // user opted in to background play
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

function toggleKeepPlaying() {
  _keepPlayingInBg = !_keepPlayingInBg;
  document.getElementById('theme-bar-bg')?.classList.toggle('active', _keepPlayingInBg);
}

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
  bizzy_bees:     { label: "Bizzy's Hive",      params: [] },
  blackjack_neon: { label: "Blackjack's Neon",  params: [] },
  katie_pond:     { label: "Katie's Pond",       params: [] },
  snaps_scales:   { label: "Snaps' Scales", params: [] },
  leon_swords:      { label: "Leon's Blades",          params: [] },
  valkyrie_rain:    { label: "Valkyrie's Blood Rain",  params: [] },
  adam_ice:         { label: "Adam's ice thing",   params: [] },
  fury_fire:        { label: "Fury's Fire",            params: [] },
  sorrow_fire:      { label: "Sorrow's Ashes",         params: [] },
  juko_code:        { label: "Juko's Code Garden",     params: [] },
  lucifer_unleashed:{ label: "Lucifer · Unleashed",    params: [] },
  divine_light:     { label: "Divine · Radiance",      params: [] },
  jimmy_muffin:     { label: "Jimmy · Big Muffin",     params: [] },
  aether_forest:    { label: "Aether · Dark Forest",   params: [] },
  cappy_milk:       { label: "Cappy · Milk",            params: [] },
  diva_virus:       { label: "✨DIVA✨ · Virus",         params: [] },
  evelynn_moon:     { label: "Evelynn · Blood Moon",    params: [] },
  oliver_west:      { label: "Oliver · Wild West",      params: [] },
  spruce_roses:     { label: "Spruce · White Roses",    params: [] },
  momo_waste:       { label: "Momo · Wasteland",        params: [] },
  ronnette_scrap:   { label: "Ronnette · Can't Fix You", params: [] },
  miami_aero:       { label: "Miami · Frutiger Aero",   params: [] },
  joni_jungle:      { label: "Joni · Jungle Bananas",   params: [] },
  shi_souls:        { label: "The Shi · Soul Garden",  params: [] },
  lunar_moon:       { label: "Lunar · Moonlight",      params: [] },
  helios_sun:       { label: "Helios · Solar Wrath",   params: [] },
  zoe_garden:       { label: "Zoe · Living Garden",    params: [] },
  iris_starlight:   { label: "Iris · Shimmerlight",    params: [] },
  mouseburger_dusk: { label: "Mouseburger · Duskfall",  params: [] },
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
  // 30fps cap
  if (_drawBizzyPattern._lt !== undefined && t - _drawBizzyPattern._lt < 0.033) return;
  _drawBizzyPattern._lt = t;

  ctx.clearRect(0, 0, W, H);

  // ── Honeycomb (flat-top hexagons) ─────────────────────────────
  const R   = 20;
  const csx = R * 1.5;
  const csy = R * Math.sqrt(3);

  // Cache the hex Path2D — same shape every cell, translated per cell
  if (!_drawBizzyPattern._hex) {
    const p = new Path2D();
    const hr = R * 0.87;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      i === 0 ? p.moveTo(hr * Math.cos(a), hr * Math.sin(a))
              : p.lineTo(hr * Math.cos(a), hr * Math.sin(a));
    }
    p.closePath();
    _drawBizzyPattern._hex = p;
  }
  const hexPath = _drawBizzyPattern._hex;

  for (let col = -1; col * csx < W + csx; col++) {
    for (let row = -1; row * csy < H + csy; row++) {
      const cx = col * csx;
      const cy = row * csy + (col & 1 ? csy * 0.5 : 0);
      const ph = (Math.sin(t * 0.55 + col * 0.71 + row * 1.13) + 1) * 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle   = `rgba(210,115,0,${(0.10 + ph * 0.22).toFixed(3)})`;
      ctx.fill(hexPath);
      ctx.strokeStyle = `rgba(235,155,0,${(0.22 + ph * 0.32).toFixed(3)})`;
      ctx.lineWidth   = 0.9;
      ctx.stroke(hexPath);
      ctx.restore();
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
    // Outer glow: simple large semi-transparent arc (no createRadialGradient)
    ctx.fillStyle = `rgba(255,210,20,${(al * 0.09).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(px + drift, py, r * 3.5, 0, Math.PI*2); ctx.fill();
    // Core dot
    ctx.fillStyle = `rgba(255,210,20,${al.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(px + drift, py, r, 0, Math.PI*2); ctx.fill();
  }
}

/* ── BLACKJACK — casino card scatter ────────────────────────── */
function _bjHash(i, n) {
  const v = Math.sin(i * 127.1 + n * 311.7 + i * n * 17.3) * 43758.5453;
  return v - Math.floor(v);
}

// Rounded rect path helper (no native roundRect needed)
function _bjRRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);       ctx.arcTo(x+w, y,   x+w, y+r,   r);
  ctx.lineTo(x + w, y + h - r);   ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x + r, y + h);       ctx.arcTo(x,   y+h, x,   y+h-r, r);
  ctx.lineTo(x, y + r);           ctx.arcTo(x,   y,   x+r, y,     r);
  ctx.closePath();
}

function _bjHeartPath(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + r);
  ctx.bezierCurveTo(cx-r*0.2, cy+r*0.6,  cx-r*1.2, cy+r*0.2, cx-r,  cy-r*0.1);
  ctx.bezierCurveTo(cx-r*1.2, cy-r*0.7,  cx-r*0.5, cy-r,     cx,    cy-r*0.5);
  ctx.bezierCurveTo(cx+r*0.5, cy-r,      cx+r*1.2, cy-r*0.7, cx+r,  cy-r*0.1);
  ctx.bezierCurveTo(cx+r*1.2, cy+r*0.2,  cx+r*0.2, cy+r*0.6, cx,    cy+r);
  ctx.closePath();
}

function _drawBjHeart(ctx, cx, cy, r, t) {
  const pulse   = Math.sin(t * 0.7) * 0.5 + 0.5;
  const blinkOn = Math.sin(t * 1.1) > 0.82 && Math.sin(t * 2.3) > 0.5;
  const flicker = 0.88 + Math.sin(t * 23.1) * 0.07 + Math.sin(t * 41.7) * 0.05;
  const base    = blinkOn ? 0.68 : (0.10 + pulse * 0.22);
  const alpha   = Math.max(0, base * flicker);
  const glow    = alpha * 35;

  ctx.save();
  ctx.beginPath(); ctx.rect(cx-r*2.5, cy-r*2.5, r*2.5, r*5); ctx.clip();
  _bjHeartPath(ctx, cx, cy, r);
  ctx.shadowBlur=glow; ctx.shadowColor='#00b4de';
  ctx.fillStyle=`rgba(0,180,222,${alpha.toFixed(3)})`; ctx.fill();
  ctx.shadowBlur=glow*0.5; ctx.strokeStyle=`rgba(120,235,255,${(alpha*0.75).toFixed(3)})`;
  ctx.lineWidth=1.5; ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.rect(cx, cy-r*2.5, r*2.5, r*5); ctx.clip();
  _bjHeartPath(ctx, cx, cy, r);
  ctx.shadowBlur=glow; ctx.shadowColor='#ff8c00';
  ctx.fillStyle=`rgba(255,140,0,${alpha.toFixed(3)})`; ctx.fill();
  ctx.shadowBlur=glow*0.5; ctx.strokeStyle=`rgba(255,210,80,${(alpha*0.75).toFixed(3)})`;
  ctx.lineWidth=1.5; ctx.stroke();
  ctx.restore();
}

function _drawBlackjackPattern(canvas, ctx, W, H, t) {
  // 30fps cap
  if (_drawBlackjackPattern._lt !== undefined && t - _drawBlackjackPattern._lt < 0.033) return;
  _drawBlackjackPattern._lt = t;

  ctx.clearRect(0, 0, W, H);

  // ── Layer 1: Diamond argyle background grid ───────────────
  const DW = 40, DH = 30;

  // Cache diamond Path2D in local coords (translated per cell)
  if (!_drawBlackjackPattern._diamond) {
    const d = new Path2D();
    d.moveTo(0, -DH * 0.5); d.lineTo(DW * 0.5, 0);
    d.lineTo(0, DH * 0.5);  d.lineTo(-DW * 0.5, 0);
    d.closePath();
    _drawBlackjackPattern._diamond = d;
  }
  const diamond = _drawBlackjackPattern._diamond;

  ctx.save();
  for (let row = -1; row * DH < H + DH; row++) {
    for (let col = -1; col * DW < W + DW; col++) {
      const offX = (row & 1) ? DW * 0.5 : 0;
      const cx   = col * DW + offX + DW * 0.5;
      const cy   = row * DH + DH * 0.5;
      const ph   = (Math.sin(t * 0.38 + col * 0.72 + row * 1.05) + 1) * 0.5;
      const isO  = ((col * 3 + row * 2 + 7) % 7 === 0);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle   = isO
        ? `rgba(255,100,0,${(0.06+ph*0.08).toFixed(3)})`
        : `rgba(0,100,190,${(0.06+ph*0.08).toFixed(3)})`;
      ctx.strokeStyle = isO
        ? `rgba(255,150,20,${(0.09+ph*0.07).toFixed(3)})`
        : `rgba(0,160,230,${(0.09+ph*0.07).toFixed(3)})`;
      ctx.fill(diamond); ctx.lineWidth = 0.6; ctx.stroke(diamond);
      ctx.restore();
    }
  }
  ctx.restore();

  // ── Layer 2: Scattered playing cards ─────────────────────
  const SUITS  = ['♠','♥','♦','♣'];
  const VALUES = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const N = 26;

  for (let i = 0; i < N; i++) {
    const h = n => _bjHash(i, n);

    const cw    = 44 + h(0) * 24;           // 44–68 px wide
    const ch    = cw * 1.45;
    const speed = 12 + h(1) * 26;           // px/s  (slow mournful drift)
    const rotB  = (h(2) - 0.5) * 0.85;     // base tilt (≈ ±24°)
    const rotS  = (h(3) - 0.5) * 0.22;     // slow tumble speed
    const x0    = h(4) * (W + cw) - cw * 0.5;
    const yOff  = h(5) * (H + ch + 80);
    const face  = h(6) > 0.55;             // 45 % face-up
    const sIdx  = Math.floor(h(7) * 4);
    const suit  = SUITS[sIdx];
    const isRed = sIdx === 1 || sIdx === 2; // ♥ ♦
    const val   = VALUES[Math.floor(h(8) * 13)];
    const aCard = 0.55 + h(9) * 0.30;
    const bluBk = h(10) > 0.35;            // card back colour

    const cyc  = H + ch + 90;
    const yPos = (t * speed + yOff) % cyc - ch - 30;
    const rot  = rotB + t * rotS;
    const cr   = cw * 0.07;

    ctx.save();
    ctx.translate(x0, yPos + ch * 0.5);
    ctx.rotate(rot);
    ctx.globalAlpha = aCard;

    // Drop shadow — hard offset rect (no shadowBlur, much faster)
    ctx.globalAlpha = aCard * 0.38;
    ctx.fillStyle = '#000';
    ctx.beginPath(); _bjRRect(ctx, -cw*0.5+4, -ch*0.5+5, cw, ch, cr); ctx.fill();
    ctx.globalAlpha = aCard;

    // Card body
    ctx.beginPath();
    _bjRRect(ctx, -cw*0.5, -ch*0.5, cw, ch, cr);
    ctx.fillStyle = face
      ? 'rgba(240,234,218,0.94)'
      : (bluBk ? 'rgba(4,26,58,0.93)' : 'rgba(62,17,4,0.93)');
    ctx.fill();

    // Thin border
    ctx.strokeStyle = face ? 'rgba(200,190,170,0.35)' : 'rgba(180,180,205,0.22)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath(); _bjRRect(ctx, -cw*0.5, -ch*0.5, cw, ch, cr); ctx.stroke();

    if (face) {
      // Face card: large suit in centre + corner pip
      const fc = isRed ? '#b03020' : '#111';
      ctx.fillStyle = fc; ctx.shadowBlur = 0;

      ctx.font = `${Math.round(cw*0.48)}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(suit, 0, ch * 0.04);

      const fSm = Math.round(cw * 0.21);
      ctx.font = `bold ${fSm}px monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(val,  -cw*0.5 + cw*0.09, -ch*0.5 + ch*0.04);
      ctx.font = `${fSm}px serif`;
      ctx.fillText(suit, -cw*0.5 + cw*0.09, -ch*0.5 + ch*0.04 + fSm + 1);

      // Rotated bottom-right corner
      ctx.save(); ctx.rotate(Math.PI);
      ctx.font = `bold ${fSm}px monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(val,  -cw*0.5 + cw*0.09, -ch*0.5 + ch*0.04);
      ctx.font = `${fSm}px serif`;
      ctx.fillText(suit, -cw*0.5 + cw*0.09, -ch*0.5 + ch*0.04 + fSm + 1);
      ctx.restore();

    } else {
      // Card back: inner frame + half-heart symbol
      const pad = cw * 0.1;
      ctx.strokeStyle = bluBk ? 'rgba(0,160,215,0.28)' : 'rgba(255,120,0,0.28)';
      ctx.lineWidth = 0.7;
      ctx.beginPath(); _bjRRect(ctx, -cw*0.5+pad, -ch*0.5+pad, cw-pad*2, ch-pad*2, cr*0.5); ctx.stroke();

      const mr = cw * 0.22;
      // Left half — blue
      ctx.save();
      ctx.beginPath(); ctx.rect(-cw, -ch, cw, ch*2); ctx.clip();
      _bjHeartPath(ctx, 0, 0, mr);
      ctx.fillStyle='rgba(0,175,218,0.80)'; ctx.fill();
      ctx.restore();
      // Right half — orange
      ctx.save();
      ctx.beginPath(); ctx.rect(0, -ch, cw, ch*2); ctx.clip();
      _bjHeartPath(ctx, 0, 0, mr);
      ctx.fillStyle='rgba(255,130,0,0.80)'; ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  // ── Layer 3: Ambient suit symbols (fill gaps) ─────────────
  ctx.save();
  for (let s = 0; s < 18; s++) {
    const h  = n => _bjHash(s + 60, n);
    const sx = h(0) * W, sy = h(1) * H;
    const sz = 11 + h(2) * 13;
    const ss = SUITS[Math.floor(h(3) * 4)];
    const io = h(4) < 0.3;
    const ph = (Math.sin(t * 0.45 + s * 1.3) + 1) * 0.5;
    const sa = (0.07 + ph * 0.07).toFixed(3);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((h(5) - 0.5) * 0.7);
    ctx.font = `${sz}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = io ? `rgba(255,140,0,${sa})` : `rgba(0,180,222,${sa})`;
    ctx.fillText(ss, 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // ── Layer 4: Glowing chip rings ───────────────────────────
  for (let ci = 0; ci < 7; ci++) {
    const h  = n => _bjHash(ci + 200, n);
    const cx = h(0) * W, cy = h(1) * H;
    const cr = 13 + h(2) * 16;
    const io = h(3) < 0.4;
    const ph = (Math.sin(t * 0.65 + ci * 1.5) + 1) * 0.5;
    const a  = (0.07 + ph * 0.07).toFixed(3);
    const col = io ? `rgba(255,140,0,${a})` : `rgba(0,180,222,${a})`;
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.setLineDash([cr*0.28, cr*0.14]);
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = io ? `rgba(255,140,0,${(parseFloat(a)*0.45).toFixed(3)})` : `rgba(0,180,222,${(parseFloat(a)*0.45).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, cr*0.82, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  // ── Layer 5: Centre half-heart (Blackjack's symbol) ──────
  const r = Math.max(20, Math.min(W * 0.08, H * 0.16, 54));
  _drawBjHeart(ctx, W * 0.5, H * 0.5, r, t);
}
/* ─────────────────────────────────────────────────────────────── */

/* ── KATIE — lily pond ────────────────────────────────────────── */
function _katieHook(cv) {
  _katieUnhook();
  _katieHookCv = cv;
  const r0 = cv.getBoundingClientRect();
  const sx  = r0.width  ? cv.width  / r0.width  : 1;
  const sy  = r0.height ? cv.height / r0.height : 1;
  _katieFrogX  = cv.width  * 0.5;
  _katieFrogY  = cv.height * 0.6;
  _katieTargX  = cv.width  * 0.5;
  _katieTargY  = cv.height * 0.6;
  _katieFrogVX = 0; _katieFrogVY = 0; _katieFrogAng = 0;
  _katieMoveH = e => {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    _katieTargX = (e.clientX - r.left) * (cv.width  / r.width);
    _katieTargY = (e.clientY - r.top)  * (cv.height / r.height);
  };
  document.addEventListener('mousemove', _katieMoveH);
}
function _katieUnhook() {
  if (_katieMoveH) { document.removeEventListener('mousemove', _katieMoveH); _katieMoveH = null; }
  _katieHookCv = null;
}

function _katieH(i, n) {
  const v = Math.sin(i * 97.3 + n * 251.9 + i * n * 13.7) * 43758.5453;
  return v - Math.floor(v);
}

function _drawKatiePad(ctx, cx, cy, rx, ry, rot, t, idx) {
  const sway = Math.sin(t * 0.35 + idx * 1.7) * 0.05;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot + sway);

  // Shadow
  ctx.save();
  ctx.translate(4, 5);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0, 0, rx, 0.35, Math.PI*2-0.35); ctx.lineTo(0,0);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
  ctx.restore();

  // Pad body (ellipse with V notch) — flat fill (no createRadialGradient per pad)
  ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0, 0, rx, 0.35, Math.PI*2-0.35); ctx.lineTo(0,0);
  ctx.fillStyle = '#3a8c3a'; ctx.fill();
  ctx.strokeStyle = 'rgba(70,150,50,0.45)'; ctx.lineWidth = 0.8; ctx.stroke();

  // Radial veins
  ctx.save();
  ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0, 0, rx, 0.35, Math.PI*2-0.35); ctx.lineTo(0,0); ctx.clip();
  ctx.strokeStyle = 'rgba(15,65,15,0.28)'; ctx.lineWidth = 0.65;
  for (let v = 0; v < 9; v++) {
    const va = 0.35 + (Math.PI*2 - 0.7) * (v/9);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(va)*rx, Math.sin(va)*ry); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function _drawKatieFlower(ctx, cx, cy, r, t, idx) {
  const bob = Math.sin(t * 0.5 + idx * 2.1) * 1.5;
  ctx.save(); ctx.translate(cx, cy + bob);
  // Flat petal fill — no createRadialGradient per petal (5 × ~6 flowers = ~30 gradients saved)
  for (let p = 0; p < 5; p++) {
    ctx.save(); ctx.rotate((p/5) * Math.PI*2);
    ctx.beginPath(); ctx.ellipse(0, -r*0.65, r*0.3, r*0.52, 0, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,185,210,0.9)'; ctx.fill(); ctx.restore();
  }
  // Centre — wide stroke halo instead of shadowBlur
  ctx.beginPath(); ctx.arc(0, 0, r*0.38, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,200,50,0.18)'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, r*0.28, 0, Math.PI*2);
  ctx.fillStyle = '#ffdf3a'; ctx.fill();
  ctx.restore();
}

// Redrawn to match the chunky toy frog: dark green, cream belly,
// big protruding blue-grey eyes with square pupils + red inner
// corner accents, long purple tongue that wiggles and flies.
function _drawKatieFrog(ctx, x, y, ang, spd, t) {
  const norm   = Math.min(1, spd / 350);          // 0-1 speed factor
  // Squash in travel direction, stretch perpendicular
  const sqX    = 1 + norm * 0.22;
  const sqY    = 1 - norm * 0.14;
  const hop    = spd > 30 ? Math.abs(Math.sin(t * 13)) * Math.min(10, spd * 0.035) : 0;
  const blink  = Math.sin(t * 1.7) > 0.94;

  ctx.save();
  ctx.translate(x, y - hop);
  ctx.rotate(ang);
  ctx.scale(sqX, sqY);

  const BW = 24, BH = 20;

  // ── Purple tongue (shoots from mouth, out the front) ──
  const wag       = Math.sin(t * 9 + spd * 0.05) * (5 + norm * 22);
  const mouthY    = -BH * 0.28;                                   // just below the eyes
  const tongueLen = BH * 0.45 + 10 + norm * 18 + Math.abs(Math.sin(t*3.5)) * 7;
  const tipY      = mouthY - tongueLen;                            // extends OUTWARD (up in local space = front of frog)
  ctx.save();
  ctx.shadowBlur = 6; ctx.shadowColor = '#5520a0';
  ctx.lineWidth  = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#7030c0';
  ctx.beginPath();
  ctx.moveTo(0, mouthY);
  ctx.bezierCurveTo(wag*0.3, mouthY - tongueLen*0.35,
                    wag*0.75, mouthY - tongueLen*0.68,
                    wag,      tipY);
  ctx.stroke();
  // tongue tip bulb
  ctx.fillStyle = '#6828b0';
  ctx.beginPath();
  ctx.ellipse(wag, tipY, 6, 4, Math.atan2(-tongueLen, wag), 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  // ── Back legs ──
  for (const s of [-1,1]) {
    ctx.save(); ctx.translate(s*BW*0.78, BH*0.55); ctx.rotate(s*0.4);
    ctx.beginPath(); ctx.ellipse(s*3, 5, 8, 6, s*0.3, 0, Math.PI*2);
    ctx.fillStyle = '#2d5225'; ctx.fill(); ctx.restore();
  }
  // ── Front legs ──
  for (const s of [-1,1]) {
    ctx.save(); ctx.translate(s*BW*0.7, BH*0.05); ctx.rotate(s*0.55);
    ctx.beginPath(); ctx.ellipse(s*2.5, 4, 6, 4.5, s*0.25, 0, Math.PI*2);
    ctx.fillStyle = '#2d5225'; ctx.fill(); ctx.restore();
  }

  // ── Body ──
  const bg = ctx.createRadialGradient(-BW*0.25, -BH*0.25, 2, 0, 0, BW*1.1);
  bg.addColorStop(0,   '#4a7038');
  bg.addColorStop(0.65,'#365a2a');
  bg.addColorStop(1,   '#253d1c');
  ctx.beginPath(); ctx.ellipse(0, 0, BW, BH, 0, 0, Math.PI*2);
  ctx.fillStyle = bg;
  ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.fill(); ctx.shadowBlur = 0;

  // ── Belly ──
  ctx.beginPath(); ctx.ellipse(0, BH*0.18, BW*0.56, BH*0.56, 0, 0, Math.PI*2);
  ctx.fillStyle = '#d4d0be'; ctx.fill();

  // ── Eyes ──
  const EX = BW*0.52, EY_base = -BH*0.55, ER = 8;
  for (const s of [-1,1]) {
    const ex = s * EX;
    const ey = EY_base;

    // Bumpy socket (dark green mound)
    ctx.beginPath(); ctx.ellipse(ex, ey, ER+2, ER+1.5, 0, 0, Math.PI*2);
    ctx.fillStyle = '#2a4820'; ctx.fill();

    // Blue-grey iris
    ctx.beginPath(); ctx.ellipse(ex, ey, ER, ER*0.92, 0, 0, Math.PI*2);
    ctx.fillStyle = '#8ab4c8'; ctx.fill();

    // Square/rectangular pupil — matches the toy exactly
    if (blink) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(ex-ER*0.6, ey); ctx.lineTo(ex+ER*0.6, ey);
      ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
      ctx.restore();
    } else {
      const pw = ER*0.7, ph = ER*0.82;
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath();
      ctx.moveTo(ex-pw*0.5+2, ey-ph*0.5);
      ctx.lineTo(ex+pw*0.5-2, ey-ph*0.5);
      ctx.arcTo(ex+pw*0.5, ey-ph*0.5, ex+pw*0.5, ey-ph*0.5+2, 2);
      ctx.lineTo(ex+pw*0.5, ey+ph*0.5-2);
      ctx.arcTo(ex+pw*0.5, ey+ph*0.5, ex+pw*0.5-2, ey+ph*0.5, 2);
      ctx.lineTo(ex-pw*0.5+2, ey+ph*0.5);
      ctx.arcTo(ex-pw*0.5, ey+ph*0.5, ex-pw*0.5, ey+ph*0.5-2, 2);
      ctx.lineTo(ex-pw*0.5, ey-ph*0.5+2);
      ctx.arcTo(ex-pw*0.5, ey-ph*0.5, ex-pw*0.5+2, ey-ph*0.5, 2);
      ctx.closePath(); ctx.fill();
    }

    // Red inner-corner crescent (between the eyes, lower)
    const icx = ex - s*ER*0.42, icy = ey+ER*0.3;
    ctx.beginPath(); ctx.ellipse(icx, icy, ER*0.42, ER*0.28, s*0.4, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(130,10,0,0.82)'; ctx.fill();

    // Specular highlight
    ctx.beginPath(); ctx.arc(ex-ER*0.32, ey-ER*0.32, ER*0.21, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.fill();
  }

  ctx.restore();
}

// ── Katie overlay: frog above all menus ───────────────────────
function _startKatieOverlay() {
  _stopKatieOverlay();

  // Fixed-position canvas on document.body — z-index:9999 puts it
  // above every panel. clientX/Y map directly to canvas coordinates.
  const cv = document.createElement('canvas');
  cv.id = 'katie-frog-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width  = window.innerWidth;
  cv.height = window.innerHeight;
  document.body.appendChild(cv);

  // Start frog in the centre of the viewport
  _katieFrogX  = cv.width  * 0.5;
  _katieFrogY  = cv.height * 0.5;
  _katieFrogVX = 0; _katieFrogVY = 0;
  _katieTargX  = _katieFrogX;
  _katieTargY  = _katieFrogY;
  _katieFrogAng = 0;

  // Track raw client coordinates — no getBoundingClientRect needed
  _katieUnhook();
  _katieHookCv = cv;
  _katieMoveH  = e => { _katieTargX = e.clientX; _katieTargY = e.clientY; };
  document.addEventListener('mousemove', _katieMoveH);

  const t0 = performance.now();
  let prevMs = t0;

  function frame(now) {
    if (!document.getElementById('katie-frog-overlay')) {
      _katieOverlayRafId = null; return;
    }
    const dt = Math.min((now - prevMs) / 1000, 0.05);
    prevMs = now;
    const t = (now - t0) / 1000;

    // Spring physics — lags behind cursor, chasing feel
    const SPRING = 130, DAMP = 14;
    _katieFrogVX += ((_katieTargX - _katieFrogX) * SPRING - _katieFrogVX * DAMP) * dt;
    _katieFrogVY += ((_katieTargY - _katieFrogY) * SPRING - _katieFrogVY * DAMP) * dt;
    _katieFrogX  += _katieFrogVX * dt;
    _katieFrogY  += _katieFrogVY * dt;

    // Smooth rotation toward direction of travel
    const spd = Math.hypot(_katieFrogVX, _katieFrogVY);
    if (spd > 12) {
      const ta = Math.atan2(_katieFrogVY, _katieFrogVX) + Math.PI * 0.5;
      let da = ta - _katieFrogAng;
      while (da >  Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      _katieFrogAng += da * 0.13;
    }

    const cv2 = document.getElementById('katie-frog-overlay');
    if (!cv2) { _katieOverlayRafId = null; return; }
    const ctx2 = cv2.getContext('2d');
    ctx2.clearRect(0, 0, cv2.width, cv2.height);
    _drawKatieFrog(ctx2, _katieFrogX, _katieFrogY, _katieFrogAng, spd, t);

    _katieOverlayRafId = requestAnimationFrame(frame);
  }
  _katieOverlayRafId = requestAnimationFrame(frame);
}

function _stopKatieOverlay() {
  if (_katieOverlayRafId) { cancelAnimationFrame(_katieOverlayRafId); _katieOverlayRafId = null; }
  const cv = document.getElementById('katie-frog-overlay');
  if (cv) cv.remove();
  _katieUnhook();
}

function _drawKatiePattern(canvas, ctx, W, H, t) {
  // 30fps cap
  if (_drawKatiePattern._lt !== undefined && t - _drawKatiePattern._lt < 0.033) return;
  _drawKatiePattern._lt = t;

  // Background pond only — frog is on the overlay canvas
  ctx.clearRect(0, 0, W, H);

  // ── Water base — cache gradient, only rebuild on resize ──
  if (!_drawKatiePattern._wg || _drawKatiePattern._wgW !== W || _drawKatiePattern._wgH !== H) {
    const wg = ctx.createLinearGradient(W*0.1, 0, W*0.9, H);
    wg.addColorStop(0,   '#0b2d3e');
    wg.addColorStop(0.5, '#0f3d50');
    wg.addColorStop(1,   '#092838');
    _drawKatiePattern._wg  = wg;
    _drawKatiePattern._wgW = W;
    _drawKatiePattern._wgH = H;
  }
  ctx.fillStyle = _drawKatiePattern._wg; ctx.fillRect(0, 0, W, H);

  // Surface ripple lines — fewer rows, coarser x-step (same visual at distance)
  ctx.save();
  for (let row = 0; row < 10; row++) {
    const ry0 = (row / 10) * H;
    const amp = 2 + Math.sin(row * 0.55) * 1.5;
    const aV  = (0.05 + Math.sin(t*0.55 + row*0.8)*0.03).toFixed(3);
    ctx.strokeStyle = `rgba(45,155,200,${aV})`; ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 14) {
      const y = ry0 + Math.sin(x*0.042 + t*0.7 + row*0.58) * amp;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Caustic light patches (underwater shimmer)
  for (let c = 0; c < 6; c++) {
    const h   = n => _katieH(c+300, n);
    const cpx = h(0)*W, cpy = h(1)*H;
    const dft = Math.sin(t*0.28 + c*2.1) * 20;
    const pw  = (Math.sin(t*0.85 + c*1.4) + 1)*0.5;
    const cg  = ctx.createRadialGradient(cpx+dft, cpy, 0, cpx+dft, cpy, 35+pw*25);
    cg.addColorStop(0, `rgba(70,180,215,${(0.06+pw*0.07).toFixed(3)})`);
    cg.addColorStop(1, 'rgba(0,70,110,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(cpx+dft, cpy, 60+pw*20, 32+pw*14, Math.sin(c*1.3)*0.35, 0, Math.PI*2); ctx.fill();
  }

  // ── Lily pads + flowers ───────────────────────────────────
  for (let i = 0; i < 11; i++) {
    const h   = n => _katieH(i, n);
    const px  = h(0)*W, py = h(1)*H;
    const rx  = 22 + h(2)*28, ry = rx*(0.55 + h(3)*0.2);
    const rot = h(4)*Math.PI*2;
    ctx.save();
    ctx.globalAlpha = 0.78 + h(6)*0.22;
    _drawKatiePad(ctx, px, py, rx, ry, rot, t, i);
    if (h(5) > 0.52) _drawKatieFlower(ctx, px + Math.cos(rot+0.8)*rx*0.18, py + Math.sin(rot+0.8)*ry*0.18, rx*0.28, t, i);
    ctx.restore();
  }

  // ── Bubbles ───────────────────────────────────────────────
  for (let b = 0; b < 20; b++) {
    const h   = n => _katieH(b+150, n);
    const bx0 = h(0)*W, spd = 20+h(1)*30, sz = 2.5+h(2)*5;
    const cyc = H+sz*4+40;
    const byP = H - (t*spd + h(3)*cyc) % cyc;
    if (byP < -sz*2 || byP > H+sz) continue;
    const drft = Math.sin(t*0.9 + b*1.4) * 14;
    const wave = (Math.sin(t*1.7 + b*0.8) + 1)*0.5;
    const bxF  = bx0 + drft;
    ctx.beginPath(); ctx.arc(bxF, byP, sz, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(100,200,230,0.06)'; ctx.fill();
    ctx.strokeStyle = `rgba(150,230,250,${(0.18+wave*0.24).toFixed(3)})`; ctx.lineWidth = 0.9; ctx.stroke();
    // Highlight glint
    ctx.beginPath(); ctx.arc(bxF-sz*0.3, byP-sz*0.35, sz*0.27, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(215,250,255,0.5)'; ctx.fill();
  }

}
/* ─────────────────────────────────────────────────────────────── */

// ── Leon: falling swords + fire overlay ───────────────────────
function _leonH(i, n) {
  return Math.abs(Math.sin(i * 213.7 + n * 147.3 + i * n * 11.1 + 5.5)) % 1;
}

function _drawLeonSword(ctx, x, yCG, ang) {
  // yCG = crossguard y; blade points DOWN, pommel is UP
  ctx.save();
  ctx.translate(x, yCG);
  ctx.rotate(ang);

  // ── Blade (crossguard → tip, downward) ──────────────────
  ctx.beginPath();
  ctx.moveTo(-2.8, 0); ctx.lineTo(2.8, 0);
  ctx.lineTo(0.4, 63);
  ctx.closePath();
  ctx.fillStyle = '#bfccd8';
  ctx.fill();
  // Edge reflections
  ctx.strokeStyle = 'rgba(235,248,255,0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0.9, 6); ctx.lineTo(0.2, 53); ctx.stroke();
  ctx.strokeStyle = 'rgba(70,100,140,0.4)';
  ctx.beginPath(); ctx.moveTo(-1, 6); ctx.lineTo(-0.2, 50); ctx.stroke();

  // ── Crossguard ────────────────────────────────────────────
  ctx.fillStyle = '#c07800';
  ctx.fillRect(-13, -6, 26, 6);
  ctx.fillStyle = 'rgba(255,185,35,0.45)';
  ctx.fillRect(-13, -6, 26, 2.5);
  ctx.fillStyle = '#9a5e00';
  ctx.beginPath();
  ctx.arc(-13, -3, 3, 0, Math.PI*2); ctx.arc(13, -3, 3, 0, Math.PI*2);
  ctx.fill();

  // ── Grip ─────────────────────────────────────────────────
  ctx.fillStyle = '#100700';
  ctx.fillRect(-3, -22, 6, 16);
  ctx.strokeStyle = 'rgba(200,100,0,0.82)';
  ctx.lineWidth = 1.3;
  for (let w = 0; w < 5; w++) {
    const wy = -7 - w * 3;
    ctx.beginPath(); ctx.moveTo(-3, wy); ctx.lineTo(3, wy); ctx.stroke();
  }

  // ── Pommel ───────────────────────────────────────────────
  ctx.fillStyle = '#c07800';
  ctx.beginPath(); ctx.arc(0, -27, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,55,0.65)';
  ctx.beginPath(); ctx.arc(-1.5, -28.5, 2, 0, Math.PI*2); ctx.fill();

  ctx.restore();
}

function _drawLeonPattern(canvas, ctx, W, H, t, params) {
  // 30fps cap
  if (_drawLeonPattern._lt !== undefined && t - _drawLeonPattern._lt < 0.033) return;
  _drawLeonPattern._lt = t;

  ctx.clearRect(0, 0, W, H);

  // ── Checkerboard (uses Leon's stored params exactly) ─────
  const sz   = params?.size   || 32;
  const c1   = params?.color1 || '#e07000';
  const c2   = params?.color2 || '#0a0a0a';
  const spd  = params?.speed  || 0.5;
  const alph = params?.opacity !== undefined ? params.opacity : 1.0;
  const dir  = params?.dir    || 'diagonal';

  if (!canvas._leonPat || canvas._leonC1 !== c1 || canvas._leonC2 !== c2 || canvas._leonSz !== sz) {
    const pc = document.createElement('canvas');
    pc.width = sz * 2; pc.height = sz * 2;
    const pctx = pc.getContext('2d');
    pctx.fillStyle = c1; pctx.fillRect(0, 0, sz, sz); pctx.fillRect(sz, sz, sz, sz);
    pctx.fillStyle = c2; pctx.fillRect(sz, 0, sz, sz); pctx.fillRect(0, sz, sz, sz);
    canvas._leonPat = ctx.createPattern(pc, 'repeat');
    canvas._leonC1 = c1; canvas._leonC2 = c2; canvas._leonSz = sz;
  }
  let ox = 0, oy = 0;
  if      (dir === 'right')    ox =  (t * spd * 60) % (sz * 2);
  else if (dir === 'left')     ox = -((t * spd * 60) % (sz * 2));
  else if (dir === 'down')     oy =  (t * spd * 60) % (sz * 2);
  else if (dir === 'up')       oy = -((t * spd * 60) % (sz * 2));
  else { ox = (t * spd * 60) % (sz * 2); oy = (t * spd * 60) % (sz * 2); }

  ctx.save();
  ctx.globalAlpha = alph;
  ctx.translate(ox, oy);
  ctx.fillStyle = canvas._leonPat;
  ctx.fillRect(-sz * 2, -sz * 2, W + sz * 4, H + sz * 4);
  ctx.restore();
  ctx.globalAlpha = 1;

  // Subtle darkening so swords read clearly against the checker
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, W, H);

  // ── Falling swords ───────────────────────────────────────
  const N = 10;
  for (let i = 0; i < N; i++) {
    const h     = n => _leonH(i, n);
    const x     = h(0) * W;
    const speed = 420 + h(1) * 320;       // 420–740 px/s
    const ang   = (h(2) - 0.5) * 0.18;   // ±5°
    const cyc   = H + 95;
    const yCG   = (t * speed + h(3) * cyc) % cyc - 66; // blade tip enters first

    // Motion trail (warm-white streak above pommel)
    const trailLen = Math.min(68, speed * 0.11);
    const pTop = yCG - 32;
    ctx.save();
    ctx.translate(x, pTop);
    ctx.rotate(ang);
    for (let s = 0; s < 5; s++) {
      const ta = ((5 - s) / 5 * 0.28).toFixed(2);
      ctx.strokeStyle = `rgba(255,225,160,${ta})`;
      ctx.lineWidth = 2.4 - s * 0.38;
      ctx.beginPath();
      ctx.moveTo(0, -s * trailLen / 5);
      ctx.lineTo(0, -(s + 1) * trailLen / 5);
      ctx.stroke();
    }
    ctx.restore();

    _drawLeonSword(ctx, x, yCG, ang);
  }
}

function _drawLeonFire(ctx, W, H, t) {
  // 30fps cap
  if (_drawLeonFire._lt !== undefined && t - _drawLeonFire._lt < 0.033) return;
  _drawLeonFire._lt = t;

  ctx.clearRect(0, 0, W, H);

  // ── Hot ground base (source-over, drawn first) ───────────
  if (!_drawLeonFire._bg || _drawLeonFire._bgW !== W) {
    const g = ctx.createLinearGradient(0, H, 0, H - 50);
    g.addColorStop(0,   'rgba(255,220,120,0.75)');
    g.addColorStop(0.25,'rgba(255,100,0,0.55)');
    g.addColorStop(0.65,'rgba(200,25,0,0.15)');
    g.addColorStop(1,   'rgba(140,0,0,0)');
    _drawLeonFire._bg  = g;
    _drawLeonFire._bgW = W;
  }
  ctx.fillStyle = _drawLeonFire._bg;
  ctx.fillRect(0, 0, W, H);

  // ── Flame tongues — additive blending ────────────────────
  // Overlapping flames ADD colour: dense centre → bright white-orange,
  // sparse edges → dim red.  Each flame uses low alpha; brightness
  // comes from layering, not individual opacity.
  ctx.globalCompositeOperation = 'lighter';

  // helper: draw one asymmetric flame tongue
  const flame = (x0, ht, wd, lean, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x0 - wd * 0.5, H);
    ctx.bezierCurveTo(x0 - wd * 0.38 + lean, H - ht * 0.52,
                      x0 - wd * 0.10 + lean, H - ht * 0.84,
                      x0 + lean * 1.3,        H - ht);
    ctx.bezierCurveTo(x0 + wd * 0.10 + lean, H - ht * 0.84,
                      x0 + wd * 0.38 + lean, H - ht * 0.52,
                      x0 + wd * 0.5,          H);
    ctx.closePath();
    ctx.fill();
  };

  // Layer 1 — tall dark-red back flames
  for (let f = 0; f < 16; f++) {
    const h0 = _leonH(f, 0), h1 = _leonH(f, 1), h2 = _leonH(f, 2);
    const x0  = (f + 0.5) / 16 * W;
    const flk = Math.sin(t*(1.6+h0) + f*1.1)*0.2 + Math.sin(t*(3.1+h1*1.5) + f*2.2)*0.08 + 0.75;
    flame(x0, (70+h0*55)*flk, 30+h1*20, (h2-0.5)*14, 'rgba(155,15,0,0.13)');
  }

  // Layer 2 — mid orange flames
  for (let f = 0; f < 22; f++) {
    const h0 = _leonH(f+50,0), h1 = _leonH(f+50,1), h2 = _leonH(f+50,2);
    const x0  = (f + 0.5 + h2*0.3) / 22 * W;
    const flk = Math.sin(t*(2.5+h0*2) + f*1.4)*0.25 + Math.sin(t*(4.8+h1) + f*3.1)*0.08 + 0.72;
    flame(x0, (42+h0*36)*flk, 20+h1*14, (h2-0.5)*10, 'rgba(255,65,0,0.10)');
  }

  // Layer 3 — bright orange/yellow cores
  for (let f = 0; f < 18; f++) {
    const h0 = _leonH(f+120,0), h1 = _leonH(f+120,1), h2 = _leonH(f+120,2);
    const x0  = (f + 0.5 + h2*0.4) / 18 * W;
    const flk = Math.sin(t*(3.2+h0*2.5) + f*1.8 + h1*4)*0.28 + 0.72;
    flame(x0, (24+h0*28)*flk, 13+h1*11, (h2-0.5)*7, 'rgba(255,145,0,0.13)');
  }

  // Layer 4 — hot white-yellow tips (spiky, fast)
  for (let f = 0; f < 12; f++) {
    const h0 = _leonH(f+200,0), h1 = _leonH(f+200,1), h2 = _leonH(f+200,2);
    const x0  = (f + 0.5 + h2*0.5) / 12 * W;
    const flk = Math.sin(t*(4.8+h0*3.5) + f*2.2 + h1*5)*0.22 + 0.78;
    flame(x0, (14+h0*20)*flk, 8+h1*8, (h2-0.5)*5, 'rgba(255,230,80,0.17)');
  }

  ctx.globalCompositeOperation = 'source-over';

  // ── Embers floating upward ────────────────────────────────
  for (let e = 0; e < 20; e++) {
    const h0 = _leonH(e+300,0), h1 = _leonH(e+300,1), h2 = _leonH(e+300,2);
    const cyc = 2.5 + h0 * 2.2;
    const age = (t / cyc + h2) % 1;
    if (age > 0.88) continue;
    const life = 1 - age / 0.88;
    const ex = h0 * W + Math.sin(t * 1.9 + e * 1.3) * 20;
    const ey = H - 10 - age * H * 0.9;
    const er = 1 + h1 * 2;

    ctx.globalCompositeOperation = 'lighter';
    // Glow halo
    ctx.fillStyle = `rgba(255,120,0,${(life * 0.28).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(ex, ey, er * 3, 0, Math.PI*2); ctx.fill();
    // Core
    ctx.fillStyle = `rgba(255,230,120,${(life * 0.9).toFixed(2)})`;
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function _startLeonOverlay() {
  _stopLeonOverlay();
  _drawLeonFire._lt = undefined; // reset cap so fire draws on frame 1
  const cv = document.createElement('canvas');
  cv.id = 'leon-fire-overlay';
  cv.style.cssText = 'position:fixed;bottom:0;left:0;width:100vw;height:160px;z-index:9999;pointer-events:none;';
  cv.width  = window.innerWidth;
  cv.height = 160;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('leon-fire-overlay');
    if (!cv2) { _leonFireRafId = null; return; }
    if (cv2.width !== window.innerWidth) {
      cv2.width = window.innerWidth;
      _drawLeonFire._bgW = null; // invalidate cached gradient on resize
    }
    _drawLeonFire(cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _leonFireRafId = requestAnimationFrame(frame);
  }
  _leonFireRafId = requestAnimationFrame(frame);
}

function _stopLeonOverlay() {
  if (_leonFireRafId) { cancelAnimationFrame(_leonFireRafId); _leonFireRafId = null; }
  const cv = document.getElementById('leon-fire-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ── Snaps: electric reptile scales ────────────────────────────
function _snapsH(i, j, n) {
  return Math.abs(Math.sin(i * 127.1 + j * 311.7 + n * 74.9 + 3.3));
}

function _drawSnapsPattern(canvas, ctx, W, H, t) {
  // 30fps cap — ambient background doesn't need 60fps
  if (_drawSnapsPattern._lt !== undefined && t - _drawSnapsPattern._lt < 0.033) return;
  _drawSnapsPattern._lt = t;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#040b05';
  ctx.fillRect(0, 0, W, H);

  const R  = 28;                   // slightly larger → fewer scales to draw
  const HW = R * Math.sqrt(3);
  const HH = R * 1.5;
  const r  = R - 1.5;              // inset so edges show between scales
  const cols = Math.ceil(W / HW) + 2;
  const rows = Math.ceil(H / HH) + 2;

  // Cache the hex Path2D — built once, reused every frame
  if (!_drawSnapsPattern._path || _drawSnapsPattern._pathR !== r) {
    const p = new Path2D();
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3;
      k === 0 ? p.moveTo(Math.cos(a) * r, Math.sin(a) * r)
              : p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    p.closePath();
    _drawSnapsPattern._path  = p;
    _drawSnapsPattern._pathR = r;
  }
  const hexPath = _drawSnapsPattern._path;

  const pulse = (Math.sin(t * 1.4) * 0.5 + 0.5) * 0.25;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const x = col * HW + (row % 2 === 1 ? HW * 0.5 : 0);
      const y = row * HH;

      const h0 = _snapsH(col, row, 0);
      const h1 = _snapsH(col, row, 1);
      const h2 = _snapsH(col, row, 2);

      const wave    = Math.sin(t * 0.9 + (x / W) * 5.5 - (y / H) * 3.5 + h0 * 1.4) * 0.5 + 0.5;
      const shimmer = wave * 0.5 + pulse * 0.5;

      // Only 18% of scales can ever spark, and rarely (3-5 active at once)
      let spark = 0;
      if (h0 > 0.82) {
        const sCycle = (t * (0.055 + h2 * 0.065) + h1 * 100) % 1;
        spark = sCycle < 0.05 ? Math.sin(sCycle / 0.05 * Math.PI) : 0;
      }

      const glow = shimmer + spark * 1.1;

      ctx.save();
      ctx.translate(x, y);

      // Flat fill — no radial gradient (eliminates ~400 gradient objects/frame)
      const g = Math.round(10 + shimmer * 44 + spark * 95);
      ctx.fillStyle = `rgb(4,${g},5)`;
      ctx.fill(hexPath);

      // Edge glow — wide semi-transparent halo + sharp bright edge
      // (replaces shadowBlur which is very expensive)
      const eBright = Math.round(75 + glow * 180);
      if (spark > 0) {
        ctx.strokeStyle = `rgba(0,${eBright},40,${(spark * 0.25).toFixed(2)})`;
        ctx.lineWidth   = R * 0.45;
        ctx.stroke(hexPath);
      }
      ctx.strokeStyle = `rgba(25,${eBright},42,${(0.13 + glow * 0.62).toFixed(2)})`;
      ctx.lineWidth   = 1.1 + glow * 1.3;
      ctx.stroke(hexPath);

      // Lightning arcs on sparked scales
      if (spark > 0.18) {
        ctx.strokeStyle = `rgba(140,255,90,${(spark * 0.65).toFixed(2)})`;
        ctx.lineWidth   = 0.8;
        for (let a = 0; a < 3; a++) {
          const aa  = _snapsH(col, row, a + 10) * Math.PI * 2;
          const len = r * 0.65 * spark;
          const mx  = Math.cos(aa) * len * 0.5 + (_snapsH(col, row, a + 14) - 0.5) * 8;
          const my  = Math.sin(aa) * len * 0.5 + (_snapsH(col, row, a + 18) - 0.5) * 8;
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(mx, my);
          ctx.lineTo(Math.cos(aa) * len, Math.sin(aa) * len);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  // Vignette — cached, only rebuilt on resize
  if (!_drawSnapsPattern._vg || _drawSnapsPattern._vgW !== W || _drawSnapsPattern._vgH !== H) {
    const vg = ctx.createRadialGradient(W*.5, H*.5, Math.min(W,H)*.28, W*.5, H*.5, Math.min(W,H)*.88);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    _drawSnapsPattern._vg  = vg;
    _drawSnapsPattern._vgW = W;
    _drawSnapsPattern._vgH = H;
  }
  ctx.fillStyle = _drawSnapsPattern._vg;
  ctx.fillRect(0, 0, W, H);
}
/* ─────────────────────────────────────────────────────────────── */

// ── Valkyrie: elegant blood rain ──────────────────────────────
const _VK_RUNES = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ','ᚺ','ᚾ','ᛁ','ᛃ','ᛇ','ᛈ','ᛉ','ᛊ','ᛏ','ᛒ','ᛖ','ᛗ','ᛚ','ᛜ','ᛞ','ᛟ'];

function _vkNewDrop(W, H, scatter) {
  const len = 10 + Math.random() * 28;
  const hue = 340 + Math.random() * 24;
  const sat = 70 + Math.random() * 24;
  const lum = 15 + Math.random() * 22;
  return {
    x:     Math.random() * W,
    y:     scatter ? Math.random() * H : -(len + Math.random() * H * 0.3),
    speed: 0.28 + Math.random() * 0.52,
    len,
    w:     len * (0.15 + Math.random() * 0.10),
    alpha: 0.35 + Math.random() * 0.55,
    color: `hsl(${hue},${sat}%,${lum}%)`,
  };
}

function _vkNewFeather(W, H, scatter) {
  const h = 38 + Math.random() * 42;
  return {
    x:     Math.random() * W,
    y:     scatter ? Math.random() * H : -(h + Math.random() * H * 0.5),
    speed: 0.014 + Math.random() * 0.018,
    h,
    ang:   (Math.random() - 0.5) * 0.6,
    spin:  (Math.random() - 0.5) * 0.18,
    drift: (Math.random() - 0.5) * 12,
    alpha: 0.12 + Math.random() * 0.20,
    color: Math.random() < 0.65 ? '#3a0008' : '#1a0520',
  };
}

function _vkNewMote(W, H, scatter) {
  return {
    x:     Math.random() * W,
    y:     scatter ? Math.random() * H : H + 5,
    speed: 0.03 + Math.random() * 0.06,
    size:  1.2 + Math.random() * 2.8,
    freq:  0.4 + Math.random() * 1.8,
    phase: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 2.5,
    life:  Math.random(),
    color: Math.random() < 0.6 ? '#d4a840' : '#b8c4ff',
  };
}

// bgAnim canvas: dark background + rune watermarks + rain drops (behind UI)
function _drawValkyriePattern(canvas, ctx, W, H, t) {
  if (_drawValkyriePattern._lt !== undefined && t - _drawValkyriePattern._lt < 0.033) return;
  _drawValkyriePattern._lt = t;

  if (canvas._vkW !== W || canvas._vkH !== H) {
    canvas._vkW = W; canvas._vkH = H;
    canvas._vkBgGrad = null; canvas._vkRunes = null;
  }

  ctx.clearRect(0, 0, W, H);
  if (!canvas._vkBgGrad) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0,   '#07000c');
    g.addColorStop(0.6, '#0c0005');
    g.addColorStop(1,   '#120008');
    canvas._vkBgGrad = g;
  }
  ctx.fillStyle = canvas._vkBgGrad;
  ctx.fillRect(0, 0, W, H);

  const NRUNES = 6;
  if (!canvas._vkRunes) {
    canvas._vkRunes = Array.from({ length: NRUNES }, () => ({
      x:     Math.random() * W,
      y:     H * 0.1 + Math.random() * H * 0.75,
      char:  _VK_RUNES[Math.floor(Math.random() * _VK_RUNES.length)],
      size:  52 + Math.random() * 44,
      phase: Math.random() * Math.PI * 2,
      base:  0.04 + Math.random() * 0.05,
    }));
  }
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const r of canvas._vkRunes) {
    const a = r.base + Math.sin(t * 0.4 + r.phase) * r.base * 0.65;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = '#8b1020';
    ctx.font = `${r.size}px serif`;
    ctx.fillText(r.char, r.x, r.y);
  }
  ctx.restore();

  // ── rain drops + trails + splatters (behind UI) ───────────────
  const NDROPS = 95;
  if (!canvas._vkDrops) {
    canvas._vkDrops    = Array.from({ length: NDROPS }, () => _vkNewDrop(W, H, true));
    canvas._vkSplatters = [];
  }
  if (!canvas._vkDropPath) {
    const p = new Path2D();
    p.moveTo(0, -1);
    p.bezierCurveTo( 0.38, -0.55,  0.38,  0.45,  0,  1);
    p.bezierCurveTo(-0.38,  0.45, -0.38, -0.55,  0, -1);
    p.closePath();
    canvas._vkDropPath = p;
  }

  const dt = 0.033;
  const drops = canvas._vkDrops;
  for (let i = 0; i < drops.length; i++) {
    const d = drops[i];
    d.y += d.speed * dt * H;
    if (d.y > H + d.len) {
      const ns = 2 + Math.floor(Math.random() * 4);
      for (let s = 0; s < ns; s++) {
        const ang = Math.random() * Math.PI;
        const spd = 18 + Math.random() * 44;
        canvas._vkSplatters.push({
          x: d.x, y: H - 1,
          vx: Math.cos(ang) * spd * (Math.random() < 0.5 ? 1 : -1),
          vy: -Math.sin(ang) * spd * 0.55,
          r:  d.w * (0.5 + Math.random() * 0.7),
          life: 1, decay: 1.2 + Math.random() * 1.0,
          alpha: d.alpha * 0.65,
        });
      }
      drops[i] = _vkNewDrop(W, H, false);
      continue;
    }
    const trailLen = d.len * (1.4 + d.speed);
    ctx.globalAlpha = d.alpha * 0.22;
    ctx.fillStyle = d.color;
    ctx.fillRect(d.x - d.w * 0.2, d.y - d.len * 0.5 - trailLen, d.w * 0.4, trailLen);
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.scale(d.w, d.len);
    ctx.globalAlpha = d.alpha;
    ctx.fillStyle = d.color;
    ctx.fill(canvas._vkDropPath);
    ctx.save();
    ctx.translate(0.08, -0.34);
    ctx.scale(0.21, 0.27);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(255,175,175,0.9)';
    ctx.fill(canvas._vkDropPath);
    ctx.restore();
    ctx.restore();
  }
  const splt = canvas._vkSplatters;
  for (let i = splt.length - 1; i >= 0; i--) {
    const s = splt[i];
    s.x  += s.vx * dt;
    s.y  += s.vy * dt;
    s.vy += 90 * dt;
    s.life -= s.decay * dt;
    if (s.life <= 0) { splt.splice(i, 1); continue; }
    ctx.globalAlpha = s.alpha * s.life;
    ctx.fillStyle = '#990018';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Overlay canvas (z-index:9999): feathers, motes, mist — above UI
function _drawValkyrieOverlay(canvas, ctx, W, H, t) {
  if (_drawValkyrieOverlay._lt !== undefined && t - _drawValkyrieOverlay._lt < 0.033) return;
  _drawValkyrieOverlay._lt = t;

  ctx.clearRect(0, 0, W, H);

  const NFEATHERS = 7, NMOTES = 28;
  if (!canvas._vkFeathers) {
    canvas._vkFeathers = Array.from({ length: NFEATHERS }, () => _vkNewFeather(W, H, true));
    canvas._vkMotes    = Array.from({ length: NMOTES },    () => _vkNewMote(W, H, true));
  }

  // ── cache Path2D shapes ───────────────────────────────────────
  if (!canvas._vkFeatherPath) {
    const p = new Path2D();
    p.moveTo(0, -1);
    p.bezierCurveTo( 0.32, -0.6,  0.38,  0.05,  0.26,  0.6);
    p.bezierCurveTo( 0.16,  0.8,  0.06,  0.92,  0,     1);
    p.bezierCurveTo(-0.06,  0.92, -0.16,  0.8, -0.26,  0.6);
    p.bezierCurveTo(-0.38,  0.05, -0.32, -0.6,  0,    -1);
    p.closePath();
    canvas._vkFeatherPath = p;
  }
  if (!canvas._vkMotePath) {
    const p = new Path2D();
    p.moveTo(0, -1); p.lineTo(0.32, 0); p.lineTo(0, 1); p.lineTo(-0.32, 0);
    p.closePath();
    canvas._vkMotePath = p;
  }

  const dt = 0.033;

  // ── feathers ──────────────────────────────────────────────────
  const feathers = canvas._vkFeathers;
  for (let i = 0; i < feathers.length; i++) {
    const f = feathers[i];
    f.y   += f.speed * dt * H;
    f.x   += f.drift * dt;
    f.ang += f.spin  * dt;
    if (f.y > H + f.h) { feathers[i] = _vkNewFeather(W, H, false); continue; }
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.ang);
    ctx.scale(f.h * 0.32, f.h * 0.5);
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color;
    ctx.fill(canvas._vkFeatherPath);
    ctx.strokeStyle = 'rgba(180,140,60,0.4)';
    ctx.lineWidth = 0.04;
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, 1); ctx.stroke();
    ctx.restore();
  }

  // ── divine motes ──────────────────────────────────────────────
  const motes = canvas._vkMotes;
  for (let i = 0; i < motes.length; i++) {
    const m = motes[i];
    m.y -= m.speed * dt * H;
    m.x += Math.sin(t * m.freq + m.phase) * 0.5;
    m.life -= dt * 0.25;
    if (m.life <= 0) { motes[i] = _vkNewMote(W, H, false); continue; }
    const fl = Math.min(1, m.life * 5, (1 - m.life) * 4 + 0.1);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(t * m.spin);
    ctx.scale(m.size, m.size * 2.2);
    ctx.globalAlpha = fl * 0.7;
    ctx.fillStyle = m.color;
    ctx.fill(canvas._vkMotePath);
    ctx.restore();
  }

  ctx.globalAlpha = 1;

  // ── crimson mist veil (slightly lower — bottom 12%) ───────────
  if (!canvas._vkMistGrad || canvas._vkW !== W || canvas._vkH !== H) {
    canvas._vkW = W; canvas._vkH = H;
    const g = ctx.createLinearGradient(0, H * 0.88, 0, H);
    g.addColorStop(0, 'rgba(110,0,20,0)');
    g.addColorStop(1, 'rgba(90,0,14,0.50)');
    canvas._vkMistGrad = g;
  }
  ctx.fillStyle = canvas._vkMistGrad;
  ctx.fillRect(0, H * 0.88, W, H * 0.12);
}

function _startValkyrieOverlay() {
  _stopValkyrieOverlay();
  _drawValkyrieOverlay._lt = undefined;
  const cv = document.createElement('canvas');
  cv.id = 'valkyrie-rain-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width  = window.innerWidth;
  cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('valkyrie-rain-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width  = window.innerWidth;
      cv2.height = window.innerHeight;
    }
    _drawValkyrieOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _valkyrieOverlayRafId = requestAnimationFrame(frame);
  }
  _valkyrieOverlayRafId = requestAnimationFrame(frame);
}

function _stopValkyrieOverlay() {
  if (_valkyrieOverlayRafId) { cancelAnimationFrame(_valkyrieOverlayRafId); _valkyrieOverlayRafId = null; }
  const cv = document.getElementById('valkyrie-rain-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ── Adam: frozen domain ────────────────────────────────────────
function _adNewShard(W, H, scatter) {
  const n = 3 + Math.floor(Math.random() * 3);
  const r = 9 + Math.random() * 22;
  const verts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
    verts.push({ x: Math.cos(a) * r * (0.5 + Math.random() * 0.5), y: Math.sin(a) * r * (0.5 + Math.random() * 0.5) });
  }
  return {
    x:     Math.random() * W,
    y:     scatter ? Math.random() * H : -(r + Math.random() * H * 0.4),
    verts, r,
    ang:   Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.5,
    drift: (Math.random() - 0.5) * 8,
    speed: 0.04 + Math.random() * 0.09,
    alpha: 0.18 + Math.random() * 0.28,
    hue:   188 + Math.random() * 28,
    l:     72 + Math.random() * 20,
  };
}



// bgAnim canvas: cyan checkerboard + falling ice shards
function _drawAdamPattern(canvas, ctx, W, H, t, params) {
  if (_drawAdamPattern._lt !== undefined && t - _drawAdamPattern._lt < 0.033) return;
  _drawAdamPattern._lt = t;

  ctx.clearRect(0, 0, W, H);

  // ── Checkerboard (Adam's stored params, same path as Leon) ────
  const sz   = params?.size   || 32;
  const c1   = params?.color1 || '#00cfcf';
  const c2   = params?.color2 || '#000000';
  const spd  = params?.speed  || 0.5;
  const alph = params?.opacity !== undefined ? params.opacity : 1.0;
  const dir  = params?.dir    || 'diagonal';

  if (!canvas._adamPat || canvas._adamC1 !== c1 || canvas._adamC2 !== c2 || canvas._adamSz !== sz) {
    const pc = document.createElement('canvas');
    pc.width = sz * 2; pc.height = sz * 2;
    const pctx = pc.getContext('2d');
    pctx.fillStyle = c1; pctx.fillRect(0, 0, sz, sz); pctx.fillRect(sz, sz, sz, sz);
    pctx.fillStyle = c2; pctx.fillRect(sz, 0, sz, sz); pctx.fillRect(0, sz, sz, sz);
    canvas._adamPat = ctx.createPattern(pc, 'repeat');
    canvas._adamC1 = c1; canvas._adamC2 = c2; canvas._adamSz = sz;
  }
  let ox = 0, oy = 0;
  if      (dir === 'right')    ox =  (t * spd * 60) % (sz * 2);
  else if (dir === 'left')     ox = -(t * spd * 60) % (sz * 2);
  else if (dir === 'down')     oy =  (t * spd * 60) % (sz * 2);
  else if (dir === 'up')       oy = -(t * spd * 60) % (sz * 2);
  else if (dir === 'diagonal') { ox = (t * spd * 60) % (sz * 2); oy = (t * spd * 60) % (sz * 2); }
  ctx.save();
  ctx.globalAlpha = alph;
  ctx.translate(ox, oy);
  ctx.fillStyle = canvas._adamPat;
  ctx.fillRect(-sz * 2, -sz * 2, W + sz * 4, H + sz * 4);
  ctx.restore();
  ctx.globalAlpha = 1;

  // ── Falling ice shards ────────────────────────────────────────
  const NSHARDS = 26;
  if (!canvas._adamShards) {
    canvas._adamShards = Array.from({ length: NSHARDS }, () => _adNewShard(W, H, true));
  }
  const dt = 0.033;
  for (let i = 0; i < canvas._adamShards.length; i++) {
    const s = canvas._adamShards[i];
    s.y   += s.speed * dt * H;
    s.x   += s.drift * dt;
    s.ang += s.spin  * dt;
    if (s.y > H + s.r * 2) { canvas._adamShards[i] = _adNewShard(W, H, false); continue; }
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.ang);
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = `hsl(${s.hue},78%,${s.l}%)`;
    ctx.beginPath();
    ctx.moveTo(s.verts[0].x, s.verts[0].y);
    for (let v = 1; v < s.verts.length; v++) ctx.lineTo(s.verts[v].x, s.verts[v].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'hsla(200,100%,94%,0.6)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  // ── Centered Ace of Hearts ────────────────────────────────────
  const cw = 130, ch = cw * 1.45, cr = cw * 0.07;
  ctx.save();
  ctx.translate(W * 0.5, H * 0.5);
  ctx.rotate(0.07);  // slight tilt

  // Drop shadow
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath(); _bjRRect(ctx, -cw*0.5+5, -ch*0.5+6, cw, ch, cr); ctx.fill();

  ctx.globalAlpha = 0.93;

  // Card body
  ctx.beginPath(); _bjRRect(ctx, -cw*0.5, -ch*0.5, cw, ch, cr);
  ctx.fillStyle = 'rgba(242,236,220,0.96)'; ctx.fill();
  ctx.strokeStyle = 'rgba(200,188,168,0.40)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); _bjRRect(ctx, -cw*0.5, -ch*0.5, cw, ch, cr); ctx.stroke();

  // Large ♥ in centre
  ctx.fillStyle = '#b02a1a';
  ctx.font = `${Math.round(cw * 0.50)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('♥', 0, ch * 0.04);

  // Corner pips — top-left
  const fSm = Math.round(cw * 0.21);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `bold ${fSm}px monospace`;
  ctx.fillText('A',  -cw*0.5 + cw*0.09, -ch*0.5 + ch*0.04);
  ctx.font = `${fSm}px serif`;
  ctx.fillText('♥',  -cw*0.5 + cw*0.09, -ch*0.5 + ch*0.04 + fSm + 1);

  // Corner pips — bottom-right (rotated 180°)
  ctx.save(); ctx.rotate(Math.PI);
  ctx.font = `bold ${fSm}px monospace`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('A',  -cw*0.5 + cw*0.09, -ch*0.5 + ch*0.04);
  ctx.font = `${fSm}px serif`;
  ctx.fillText('♥',  -cw*0.5 + cw*0.09, -ch*0.5 + ch*0.04 + fSm + 1);
  ctx.restore();

  ctx.restore();
  ctx.globalAlpha = 1;
}

// Overlay: aurora glow, corner ice glow, edge glow, sparkles
function _drawAdamOverlay(canvas, ctx, W, H, t) {
  if (_drawAdamOverlay._lt !== undefined && t - _drawAdamOverlay._lt < 0.033) return;
  _drawAdamOverlay._lt = t;

  ctx.clearRect(0, 0, W, H);

  // ── resize invalidation ───────────────────────────────────────
  if (canvas._adW !== W || canvas._adH !== H) {
    canvas._adW = W; canvas._adH = H;
    canvas._adamAurGrad = null; canvas._adamEdgeGrads = null;
  }
  if (!canvas._adamSparkles) canvas._adamSparkles = [];

  if (!canvas._adamAurGrad) {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.20);
    g.addColorStop(0,    'rgba(0,215,235,0.22)');
    g.addColorStop(0.45, 'rgba(60,190,255,0.09)');
    g.addColorStop(1,    'rgba(0,170,210,0)');
    canvas._adamAurGrad = g;
  }
  if (!canvas._adamEdgeGrads) {
    const ew = Math.min(W, H) * 0.13;
    const cr = Math.min(W, H) * 0.38;   // corner radial reach
    const mkL = (x0, y0, x1, y1) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(0,205,230,0.11)');
      g.addColorStop(1, 'rgba(0,205,230,0)');
      return g;
    };
    const mkR = (cx, cy) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      g.addColorStop(0,   'rgba(140,225,255,0.28)');
      g.addColorStop(0.35,'rgba(60,200,235,0.14)');
      g.addColorStop(1,   'rgba(0,180,220,0)');
      return g;
    };
    canvas._adamEdgeGrads = {
      ew, cr,
      top:    mkL(0, 0,      0, ew),
      bottom: mkL(0, H,      0, H - ew),
      left:   mkL(0, 0,     ew, 0),
      right:  mkL(W, 0, W - ew, 0),
      tl: mkR(0, 0),  tr: mkR(W, 0),
      bl: mkR(0, H),  br: mkR(W, H),
    };
  }

  const dt = 0.033;
  const pulse = 0.72 + 0.28 * Math.sin(t * 0.5);

  // ── aurora glow at top ────────────────────────────────────────
  ctx.globalAlpha = 1;
  ctx.fillStyle = canvas._adamAurGrad;
  ctx.fillRect(0, 0, W, H * 0.20);

  // ── corner ice glow ───────────────────────────────────────────
  const eg = canvas._adamEdgeGrads, cr = eg.cr;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = eg.tl; ctx.fillRect(0,      0,      cr, cr);
  ctx.fillStyle = eg.tr; ctx.fillRect(W - cr, 0,      cr, cr);
  ctx.fillStyle = eg.bl; ctx.fillRect(0,      H - cr, cr, cr);
  ctx.fillStyle = eg.br; ctx.fillRect(W - cr, H - cr, cr, cr);

  // ── edge glow (dimmer) ────────────────────────────────────────
  const ew = eg.ew;
  ctx.fillStyle = eg.top;    ctx.fillRect(0,      0,      W,  ew);
  ctx.fillStyle = eg.bottom; ctx.fillRect(0,      H - ew, W,  ew);
  ctx.fillStyle = eg.left;   ctx.fillRect(0,      0,      ew, H);
  ctx.fillStyle = eg.right;  ctx.fillRect(W - ew, 0,      ew, H);

  // ── ice sparkle glints ────────────────────────────────────────
  if (Math.random() < 0.35) {
    canvas._adamSparkles.push({ x: Math.random() * W, y: Math.random() * H, r: 2 + Math.random() * 5, life: 1, decay: 2.5 + Math.random() * 3.0 });
  }
  for (let i = canvas._adamSparkles.length - 1; i >= 0; i--) {
    const s = canvas._adamSparkles[i];
    s.life -= s.decay * dt;
    if (s.life <= 0) { canvas._adamSparkles.splice(i, 1); continue; }
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalAlpha = s.life * 0.85;
    ctx.strokeStyle = '#e8f8ff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-s.r, 0); ctx.lineTo(s.r, 0);
    ctx.moveTo(0, -s.r); ctx.lineTo(0, s.r);
    ctx.moveTo(-s.r * 0.6, -s.r * 0.6); ctx.lineTo( s.r * 0.6,  s.r * 0.6);
    ctx.moveTo( s.r * 0.6, -s.r * 0.6); ctx.lineTo(-s.r * 0.6,  s.r * 0.6);
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

function _startAdamOverlay() {
  _stopAdamOverlay();
  _drawAdamOverlay._lt = undefined;
  const cv = document.createElement('canvas');
  cv.id = 'adam-ice-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width  = window.innerWidth;
  cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('adam-ice-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width  = window.innerWidth;
      cv2.height = window.innerHeight;
    }
    _drawAdamOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _adamOverlayRafId = requestAnimationFrame(frame);
  }
  _adamOverlayRafId = requestAnimationFrame(frame);
}

function _stopAdamOverlay() {
  if (_adamOverlayRafId) { cancelAnimationFrame(_adamOverlayRafId); _adamOverlayRafId = null; }
  const cv = document.getElementById('adam-ice-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */
/* ─── Fury's Fire ─────────────────────────────────────────────── */
const _FURY_CHAN_XF = [0.10, 0.30, 0.52, 0.72, 0.90];

function _furyNewFirePtcl(W, H, scatter) {
  // ~28% are wide "base" particles — large, slow, spread across full width
  const isBase = Math.random() < 0.28;
  const cx = isBase
    ? W * (0.04 + Math.random() * 0.92)
    : _FURY_CHAN_XF[Math.floor(Math.random() * _FURY_CHAN_XF.length)] * W;
  return {
    cx, isBase,
    x:  cx + (Math.random() - 0.5) * W * (isBase ? 0.14 : 0.05),
    y:  scatter
          ? (isBase ? H - Math.random() * H * 0.30 : H - Math.random() * H * 0.72)
          : H + Math.random() * 18,
    vx: (Math.random() - 0.5) * (isBase ? 9 : 14),
    vy: isBase ? -(14 + Math.random() * 38) : -(42 + Math.random() * 88),
    r:  isBase ? 60 + Math.random() * 38 : 8 + Math.random() * 18,
    life:  scatter ? Math.random() : 1,
    decay: isBase ? 0.06 + Math.random() * 0.10 : 0.13 + Math.random() * 0.25,
    phase:    Math.random() * Math.PI * 2,
    turbFreq: 0.45 + Math.random() * 0.85,
    turbAmp:  isBase ? 5 + Math.random() * 9 : 10 + Math.random() * 18,
  };
}

function _furyNewEmber(W, H, scatter) {
  const cx = _FURY_CHAN_XF[Math.floor(Math.random() * _FURY_CHAN_XF.length)] * W;
  const large = Math.random() < 0.25;
  return {
    x: scatter ? Math.random() * W : cx + (Math.random() - 0.5) * W * 0.08,
    y: scatter ? Math.random() * H : H + Math.random() * 5,
    vx: (Math.random() - 0.5) * 25,
    vy: -(60 + Math.random() * 130),
    r:     large ? (3 + Math.random() * 4) : (0.8 + Math.random() * 2),
    life:  scatter ? Math.random() : 1,
    decay: large ? (0.06 + Math.random() * 0.08) : (0.09 + Math.random() * 0.14),
    hue:   Math.random() < 0.7 ? 0 : 355,
    bright: 22 + Math.random() * 18,
  };
}

function _drawFuryPattern(canvas, ctx, W, H, t) {
  if (_drawFuryPattern._lt !== undefined && t - _drawFuryPattern._lt < 0.033) return;
  const dt = _drawFuryPattern._lt === undefined ? 0.016 : Math.min(t - _drawFuryPattern._lt, 0.05);
  _drawFuryPattern._lt = t;

  if (canvas._furyW !== W || canvas._furyH !== H) {
    canvas._furyW = W; canvas._furyH = H;
    canvas._furyFirePtcls = null; canvas._furyBaseGrads = null; canvas._furyBgEmbers = null; canvas._furyFloorGrad = null; canvas._furyTopGlow = null; canvas._furyBottomPeek = null;
  }

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Smouldering glow — wide floor haze + per-channel radial pools
  if (!canvas._furyBaseGrads) {
    canvas._furyBaseGrads = _FURY_CHAN_XF.map(xf => {
      const cx = xf * W, r = Math.min(W, H) * 0.24;
      const g = ctx.createRadialGradient(cx, H, 0, cx, H, r);
      g.addColorStop(0,    'rgba(155,0,0,0.72)');
      g.addColorStop(0.42, 'rgba(70,0,0,0.38)');
      g.addColorStop(1,    'rgba(0,0,0,0)');
      return g;
    });
    const fg = ctx.createLinearGradient(0, H, 0, H - H * 0.58);
    fg.addColorStop(0,    'rgba(175,0,0,0.68)');
    fg.addColorStop(0.22, 'rgba(90,0,0,0.38)');
    fg.addColorStop(1,    'rgba(0,0,0,0)');
    canvas._furyFloorGrad = fg;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1; ctx.fillStyle = canvas._furyFloorGrad; ctx.fillRect(0, 0, W, H);
  for (const g of canvas._furyBaseGrads) { ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

  // Waving bright red peek from the very bottom — pulsing heat signal
  if (!canvas._furyBottomPeek) {
    const bp = ctx.createLinearGradient(0, H, 0, H - H * 0.13);
    bp.addColorStop(0,    'rgba(255,50,0,1.0)');
    bp.addColorStop(0.35, 'rgba(210,10,0,0.55)');
    bp.addColorStop(1,    'rgba(0,0,0,0)');
    canvas._furyBottomPeek = bp;
  }
  ctx.globalAlpha = Math.max(0.05, 0.40 + 0.28 * Math.sin(t * 2.2) + 0.12 * Math.sin(t * 5.0 + 1.4));
  ctx.fillStyle = canvas._furyBottomPeek; ctx.fillRect(0, 0, W, H);

  // Fire particles — additive blending creates natural crimson glow where they overlap
  if (!canvas._furyFirePtcls) {
    canvas._furyFirePtcls = Array.from({ length: 280 }, (_, i) => _furyNewFirePtcl(W, H, i < 220));
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = canvas._furyFirePtcls.length - 1; i >= 0; i--) {
    const e = canvas._furyFirePtcls[i];
    e.vx += Math.sin(t * e.turbFreq + e.phase) * e.turbAmp * dt;
    e.vx *= (1 - 1.8 * dt);
    e.x  += e.vx * dt;
    e.y  += e.vy * dt;
    e.life -= e.decay * dt;
    if (e.life <= 0 || e.y < -e.r * 2) { canvas._furyFirePtcls[i] = _furyNewFirePtcl(W, H, false); continue; }
    ctx.globalAlpha = e.life * (e.isBase ? 0.14 : 0.32);
    ctx.fillStyle = `hsl(${Math.round(20 * e.life)},100%,${Math.round(12 + 25 * e.life)}%)`;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + 0.6 * e.life), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  if (!canvas._furyBgEmbers) {
    canvas._furyBgEmbers = Array.from({ length: 65 }, (_, i) => _furyNewEmber(W, H, i < 50));
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = canvas._furyBgEmbers.length - 1; i >= 0; i--) {
    const e = canvas._furyBgEmbers[i];
    e.x += e.vx * dt; e.y += e.vy * dt; e.life -= e.decay * dt;
    if (e.life <= 0 || e.y < -10) { canvas._furyBgEmbers[i] = _furyNewEmber(W, H, false); continue; }
    ctx.globalAlpha = e.life * 0.9;
    ctx.fillStyle = `hsl(${e.hue},100%,${e.bright + 8 * e.life}%)`;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
  }
  // Subtle golden glow at the very top edge
  if (!canvas._furyTopGlow) {
    const tg = ctx.createLinearGradient(0, 0, 0, H * 0.20);
    tg.addColorStop(0,    'rgba(140,80,0,0.18)');
    tg.addColorStop(0.45, 'rgba(70,35,0,0.07)');
    tg.addColorStop(1,    'rgba(0,0,0,0)');
    canvas._furyTopGlow = tg;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1; ctx.fillStyle = canvas._furyTopGlow; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function _furyNewOvEmber(W, H, scatter) {
  const cx = _FURY_CHAN_XF[Math.floor(Math.random() * _FURY_CHAN_XF.length)] * W;
  const large = Math.random() < 0.20;
  return {
    x: scatter ? Math.random() * W : cx + (Math.random() - 0.5) * W * 0.10,
    y: scatter ? Math.random() * H : H + Math.random() * 5,
    vx: (Math.random() - 0.5) * 30,
    vy: -(70 + Math.random() * 150),
    r:     large ? (3.5 + Math.random() * 4.5) : (0.8 + Math.random() * 2.5),
    life:  scatter ? Math.random() : 1,
    decay: large ? (0.05 + Math.random() * 0.08) : (0.09 + Math.random() * 0.15),
    hue:   Math.random() < 0.7 ? 0 : 355,
    bright: 25 + Math.random() * 18,
  };
}

function _furyDrawMuffin(ctx, x, y, t) {
  const bT = _furyMuffinBounceT;
  const sq = bT > 0 ? Math.sin(bT * Math.PI * 3.2) * bT * 0.42 : 0;
  const sX = 1 + sq * 0.32;
  const sY = 1 - sq * 0.42;
  const bobY = Math.sin(t * 2.4) * 3.5;
  const spd  = Math.hypot(_furyMuffinVX, _furyMuffinVY);
  const tilt = spd > 18 ? Math.atan2(_furyMuffinVY, _furyMuffinVX) * 0.09 : 0;
  const happy = _furyMuffinHappyT > 0 ? Math.min(1, _furyMuffinHappyT) : 0;

  ctx.save();
  ctx.translate(x, y + bobY);
  ctx.rotate(tilt);
  ctx.scale(sX, sY);

  // Eyes are the star; dome is the chocolate top connected to the cup
  const eyeR = 14, eyeOX = 18, eyeY = 0;
  const cupTW = 19, cupBW = 14, cupH = 22;
  const cupTopY = eyeY + eyeR;      // 14 — cup rim at eye bottoms
  const cupBotY = cupTopY + cupH;   // 36
  const domeR   = 16;
  const domeY   = cupTopY - domeR;  // -2 — dome bottom flush with cup top, no gap

  // 1 ── Orange cup with dark vertical stripes
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-cupTW, cupTopY); ctx.lineTo(-cupBW, cupBotY);
  ctx.lineTo(cupBW, cupBotY);  ctx.lineTo(cupTW, cupTopY);
  ctx.closePath();
  const wg = ctx.createLinearGradient(-cupTW, 0, cupTW, 0);
  wg.addColorStop(0, '#993e04'); wg.addColorStop(0.18, '#d96c12');
  wg.addColorStop(0.50, '#ee8c28'); wg.addColorStop(0.82, '#d96c12');
  wg.addColorStop(1, '#993e04');
  ctx.fillStyle = wg; ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(38,10,0,0.62)'; ctx.lineWidth = 2.8;
  for (let i = 0; i <= 6; i++) {
    const f = i / 6;
    ctx.beginPath();
    ctx.moveTo(-cupTW + f * cupTW * 2, cupTopY);
    ctx.lineTo(-cupBW + f * cupBW * 2, cupBotY);
    ctx.stroke();
  }
  ctx.restore();
  // Dark rim band
  ctx.fillStyle = 'rgba(40,10,0,0.88)';
  ctx.beginPath();
  ctx.moveTo(-cupTW - 1, cupTopY - 1); ctx.lineTo(cupTW + 1, cupTopY - 1);
  ctx.lineTo(cupTW + 1, cupTopY + 4);  ctx.lineTo(-cupTW - 1, cupTopY + 4);
  ctx.closePath(); ctx.fill();

  // 2 ── Chocolate dome — bottom flush with cup top, top pokes above eyes
  const dg = ctx.createRadialGradient(-domeR * 0.28, domeY - domeR * 0.28, 2, 0, domeY, domeR * 1.05);
  dg.addColorStop(0,    '#b05425');
  dg.addColorStop(0.40, '#7a3010');
  dg.addColorStop(1,    '#2e0e02');
  ctx.beginPath(); ctx.arc(0, domeY, domeR, 0, Math.PI * 2);
  ctx.fillStyle = dg; ctx.fill();

  // 3 ── White googly eyes — drawn on top of dome, comically large
  for (let s = -1; s <= 1; s += 2) {
    const ex = s * eyeOX;
    const er = eyeR + happy * 1.5;
    ctx.beginPath(); ctx.arc(ex, eyeY, er, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e4e0'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.70)'; ctx.lineWidth = 1.8; ctx.stroke();
    // Pupil: idle wander blended with velocity-based direction
    const mvSpd = Math.hypot(_furyMuffinVX, _furyMuffinVY);
    const vf = Math.min(1, mvSpd / 320);  // 0 at rest → 1 at full speed
    let pdx, pdy;
    if (happy > 0.05) {
      pdx = Math.sin(t * 2.2 + s * 1.1) * er * 0.18;
      pdy = -er * 0.26 + Math.sin(t * 1.8 + s) * er * 0.09;
    } else {
      // Idle wander fades out as speed increases
      pdx = Math.sin(t * 1.1 + s * 0.9) * er * 0.35 * (1 - vf);
      pdy = Math.cos(t * 0.85 + s * 1.3) * er * 0.35 * (1 - vf);
    }
    // Pull pupils toward movement direction at speed
    if (mvSpd > 8) {
      pdx += (_furyMuffinVX / mvSpd) * er * 0.38 * vf;
      pdy += (_furyMuffinVY / mvSpd) * er * 0.38 * vf;
    }
    // Clamp inside eye
    const pDist = Math.hypot(pdx, pdy);
    const maxPd = er * 0.38;
    if (pDist > maxPd) { pdx *= maxPd / pDist; pdy *= maxPd / pDist; }
    const px = ex + pdx, py = eyeY + pdy;
    ctx.beginPath(); ctx.arc(px, py, er * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(px + er * 0.19, py - er * 0.19, er * 0.19, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
  }

  // Happy blush
  if (happy > 0) {
    for (let s = -1; s <= 1; s += 2) {
      const er = eyeR + happy * 1.5;
      ctx.globalAlpha = happy * 0.50;
      ctx.beginPath();
      ctx.ellipse(s * (eyeOX + er * 0.55), eyeY + er * 0.80, er * 0.62, er * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4466'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function _drawFuryOverlay(canvas, ctx, W, H, t, drawCompanion, flip) {
  if (_drawFuryOverlay._lt !== undefined && t - _drawFuryOverlay._lt < 0.033) return;
  const dt = _drawFuryOverlay._lt === undefined ? 0.016 : Math.min(t - _drawFuryOverlay._lt, 0.05);
  _drawFuryOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);

  if (canvas._furyOvW !== W || canvas._furyOvH !== H) {
    canvas._furyOvW = W; canvas._furyOvH = H;
    canvas._furyOvEmbers = null; canvas._furyOvFire = null; canvas._furyOvFloorGrad = null; canvas._furyOvTopGlow = null; canvas._furyOvBottomPeek = null;
  }

  if (flip) { ctx.save(); ctx.setTransform(1, 0, 0, -1, 0, H); }   // Sorrow: ambient fire pours from above

  // Wide floor haze (overlay)
  if (!canvas._furyOvFloorGrad) {
    const fg = ctx.createLinearGradient(0, H, 0, H - H * 0.55);
    fg.addColorStop(0,    'rgba(175,0,0,0.52)');
    fg.addColorStop(0.22, 'rgba(90,0,0,0.28)');
    fg.addColorStop(1,    'rgba(0,0,0,0)');
    canvas._furyOvFloorGrad = fg;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1; ctx.fillStyle = canvas._furyOvFloorGrad; ctx.fillRect(0, 0, W, H);

  // Overlay fire streams (same channels, full-screen height, more vivid)
  if (!canvas._furyOvFire) {
    canvas._furyOvFire = Array.from({ length: 140 }, (_, i) => _furyNewFirePtcl(W, H, i < 110));
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = canvas._furyOvFire.length - 1; i >= 0; i--) {
    const e = canvas._furyOvFire[i];
    e.vx += Math.sin(t * e.turbFreq + e.phase) * e.turbAmp * dt;
    e.vx *= (1 - 1.8 * dt);
    e.x += e.vx * dt; e.y += e.vy * dt; e.life -= e.decay * dt;
    if (e.life <= 0 || e.y < -e.r * 2) { canvas._furyOvFire[i] = _furyNewFirePtcl(W, H, false); continue; }
    ctx.globalAlpha = e.life * (e.isBase ? 0.16 : 0.38);
    ctx.fillStyle = `hsl(${Math.round(20 * e.life)},100%,${Math.round(12 + 25 * e.life)}%)`;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + 0.6 * e.life), 0, Math.PI * 2); ctx.fill();
  }

  // Overlay embers
  if (!canvas._furyOvEmbers) {
    canvas._furyOvEmbers = Array.from({ length: 100 }, (_, i) => _furyNewOvEmber(W, H, i < 75));
  }
  for (let i = canvas._furyOvEmbers.length - 1; i >= 0; i--) {
    const e = canvas._furyOvEmbers[i];
    e.x += e.vx * dt; e.y += e.vy * dt; e.life -= e.decay * dt;
    if (e.life <= 0 || e.y < -15) { canvas._furyOvEmbers[i] = _furyNewOvEmber(W, H, false); continue; }
    ctx.globalAlpha = e.life;
    ctx.fillStyle = `hsl(${e.hue},100%,${e.bright + 10 * e.life}%)`;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * Math.max(0.3, e.life), 0, Math.PI * 2); ctx.fill();
  }
  // Waving bright red peek from the bottom (overlay)
  if (!canvas._furyOvBottomPeek) {
    const bp = ctx.createLinearGradient(0, H, 0, H - H * 0.13);
    bp.addColorStop(0,    'rgba(255,50,0,1.0)');
    bp.addColorStop(0.35, 'rgba(210,10,0,0.55)');
    bp.addColorStop(1,    'rgba(0,0,0,0)');
    canvas._furyOvBottomPeek = bp;
  }
  ctx.globalAlpha = Math.max(0.05, 0.40 + 0.28 * Math.sin(t * 2.2) + 0.12 * Math.sin(t * 5.0 + 1.4));
  ctx.fillStyle = canvas._furyOvBottomPeek; ctx.fillRect(0, 0, W, H);
  // Subtle golden glow at the very top edge (overlay)
  if (!canvas._furyOvTopGlow) {
    const tg = ctx.createLinearGradient(0, 0, 0, H * 0.20);
    tg.addColorStop(0,    'rgba(140,80,0,0.15)');
    tg.addColorStop(0.45, 'rgba(70,35,0,0.06)');
    tg.addColorStop(1,    'rgba(0,0,0,0)');
    canvas._furyOvTopGlow = tg;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1; ctx.fillStyle = canvas._furyOvTopGlow; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  if (flip) ctx.restore();   // upright again for the cursor companion + sparkles

  // Muffin — spring physics (floaty lag, slower than Katie's frog)
  const SPRING = 75, DAMP = 9;
  _furyMuffinVX += ((_furyMuffinTargX - _furyMuffinX) * SPRING - _furyMuffinVX * DAMP) * dt;
  _furyMuffinVY += ((_furyMuffinTargY - _furyMuffinY) * SPRING - _furyMuffinVY * DAMP) * dt;
  _furyMuffinX  += _furyMuffinVX * dt;
  _furyMuffinY  += _furyMuffinVY * dt;

  // Decay anim timers
  _furyMuffinBounceT = Math.max(0, _furyMuffinBounceT - dt * 3.2);
  _furyMuffinHappyT  = Math.max(0, _furyMuffinHappyT  - dt);

  // Sparkle particles from click
  ctx.globalCompositeOperation = 'source-over';
  for (let i = _furyMuffinSparkles.length - 1; i >= 0; i--) {
    const sp = _furyMuffinSparkles[i];
    sp.x += sp.vx * dt; sp.y += sp.vy * dt;
    sp.vy += 130 * dt;   // gravity
    sp.life -= dt * 2.2;
    if (sp.life <= 0) { _furyMuffinSparkles.splice(i, 1); continue; }
    ctx.globalAlpha = sp.life * 0.95;
    ctx.fillStyle = `hsl(${Math.round(sp.hue)},100%,${Math.round(30 + 40 * sp.life)}%)`;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, sp.r * Math.max(0.2, sp.life), 0, Math.PI * 2); ctx.fill();
  }

  ctx.globalAlpha = 1;
  (drawCompanion || _furyDrawMuffin)(ctx, _furyMuffinX, _furyMuffinY, t);
}

function _startFuryOverlay() {
  _stopFuryOverlay();
  _drawFuryOverlay._lt = undefined;
  _furyMuffinX = _furyMuffinTargX = window.innerWidth * 0.5;
  _furyMuffinY = _furyMuffinTargY = window.innerHeight * 0.5;
  _furyMuffinVX = 0; _furyMuffinVY = 0;
  _furyMuffinBounceT = 0; _furyMuffinHappyT = 0;
  _furyMuffinSparkles = [];
  window.addEventListener('mousemove', _furyMuffinMouseMove);
  window.addEventListener('click', _furyMuffinClick);
  const cv = document.createElement('canvas');
  cv.id = 'fury-fire-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('fury-fire-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawFuryOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _furyOverlayRafId = requestAnimationFrame(frame);
  }
  _furyOverlayRafId = requestAnimationFrame(frame);
}

function _stopFuryOverlay() {
  if (_furyOverlayRafId) { cancelAnimationFrame(_furyOverlayRafId); _furyOverlayRafId = null; }
  window.removeEventListener('mousemove', _furyMuffinMouseMove);
  window.removeEventListener('click', _furyMuffinClick);
  const cv = document.getElementById('fury-fire-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// SORROW — Fury, but monochrome and upside-down, with a kebab cursor.
// ════════════════════════════════════════════════════════════════
// Pattern: draw Fury flipped vertically (fire falls from above), then strip the
// colour with one cheap 'saturation' blend pass (the canvas is opaque).
function _drawSorrowPattern(canvas, ctx, W, H, t) {
  ctx.save();
  ctx.setTransform(1, 0, 0, -1, 0, H);          // flip Y → flames pour down from the top
  _drawFuryPattern(canvas, ctx, W, H, t);
  ctx.restore();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'saturation';  // keep luma, drop all colour → grayscale
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}

// Googly-eyed durum (döner wrap) cursor — same bounce/eyes as the muffin.
function _sorrowDrawDurum(ctx, x, y, t) {
  const bT = _furyMuffinBounceT;
  const sq = bT > 0 ? Math.sin(bT * Math.PI * 3.2) * bT * 0.42 : 0;
  const sX = 1 + sq * 0.32, sY = 1 - sq * 0.42;
  const bobY = Math.sin(t * 2.4) * 3.5;
  const spd = Math.hypot(_furyMuffinVX, _furyMuffinVY);
  const tilt = spd > 18 ? Math.atan2(_furyMuffinVY, _furyMuffinVX) * 0.09 : 0;
  const happy = _furyMuffinHappyT > 0 ? Math.min(1, _furyMuffinHappyT) : 0;

  ctx.save();
  ctx.translate(x, y + bobY);
  ctx.rotate(tilt);
  ctx.scale(sX, sY);

  const bw = 13, bh = 42;
  const breadTop = -bh + 10;     // open rim of the wrap (filling sits above)
  const paperTop = bh - 26;      // paper cone covers the bottom

  // 1 ── filling mounding out of the open top (döner meat + veg)
  ctx.fillStyle = '#6e3414';
  ctx.beginPath(); ctx.ellipse(0, breadTop - 2, bw - 1, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a4a1e';
  for (const dx of [-7, -1, 5]) { ctx.beginPath(); ctx.moveTo(dx - 2, breadTop - 3); ctx.lineTo(dx, breadTop - 12); ctx.lineTo(dx + 2, breadTop - 3); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#62a23e'; ctx.beginPath(); ctx.ellipse(-7, breadTop - 4, 4, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();   // lettuce
  ctx.fillStyle = '#d24a38'; ctx.beginPath(); ctx.arc(6, breadTop - 2, 3, 0, Math.PI * 2); ctx.fill();                 // tomato
  ctx.fillStyle = '#efe6d6'; ctx.beginPath(); ctx.arc(1, breadTop - 1, 2, 0, Math.PI * 2); ctx.fill();                 // onion

  // 2 ── grilled flatbread wrap (tall cylinder, rounded top)
  const wrap = ctx.createLinearGradient(-bw, 0, bw, 0);
  wrap.addColorStop(0, '#a87b40'); wrap.addColorStop(0.42, '#e8c887'); wrap.addColorStop(0.6, '#f0d49a'); wrap.addColorStop(1, '#a87b40');
  ctx.fillStyle = wrap;
  ctx.beginPath();
  ctx.moveTo(-bw, paperTop + 2);
  ctx.lineTo(-bw, breadTop + 4);
  ctx.quadraticCurveTo(-bw, breadTop - 4, -bw * 0.45, breadTop - 4);
  ctx.lineTo(bw * 0.45, breadTop - 4);
  ctx.quadraticCurveTo(bw, breadTop - 4, bw, breadTop + 4);
  ctx.lineTo(bw, paperTop + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(95,58,22,0.5)'; ctx.lineWidth = 1.4; ctx.stroke();
  // diagonal grill char-stripes (clipped to the bread for value/texture)
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(82,46,15,0.5)'; ctx.lineWidth = 2.6;
  for (let i = -1; i <= 4; i++) { const yy = breadTop + i * 12; ctx.beginPath(); ctx.moveTo(-bw - 3, yy); ctx.lineTo(bw + 3, yy + 9); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,240,205,0.35)'; ctx.lineWidth = 2;   // cylinder sheen
  ctx.beginPath(); ctx.moveTo(-bw * 0.36, breadTop + 6); ctx.lineTo(-bw * 0.36, paperTop); ctx.stroke();

  // 3 ── paper cone wrapper at the bottom (narrows downward)
  ctx.fillStyle = '#efe9dd';
  ctx.beginPath();
  ctx.moveTo(-bw - 2, paperTop); ctx.lineTo(bw + 2, paperTop);
  ctx.lineTo(bw * 0.5, bh); ctx.lineTo(-bw * 0.5, bh); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(150,140,122,0.55)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = 'rgba(170,160,142,0.55)'; ctx.lineWidth = 1;   // converging fold lines
  ctx.beginPath();
  ctx.moveTo(-bw * 0.5, paperTop + 1); ctx.lineTo(-bw * 0.15, bh);
  ctx.moveTo(0, paperTop + 1); ctx.lineTo(0, bh);
  ctx.moveTo(bw * 0.5, paperTop + 1); ctx.lineTo(bw * 0.15, bh);
  ctx.stroke();
  ctx.fillStyle = 'rgba(208,198,180,0.9)'; ctx.fillRect(-bw - 2, paperTop - 2, (bw + 2) * 2, 3);   // folded rim

  // 4 ── googly eyes on the bread (same behaviour as the muffin)
  const eyeR = 8, eyeOX = 8, eyeY = breadTop + 16;
  for (let s = -1; s <= 1; s += 2) {
    const ex = s * eyeOX, er = eyeR + happy * 1.2;
    ctx.beginPath(); ctx.arc(ex, eyeY, er, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e4e0'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
    const mvSpd = Math.hypot(_furyMuffinVX, _furyMuffinVY), vf = Math.min(1, mvSpd / 320);
    let pdx, pdy;
    if (happy > 0.05) { pdx = Math.sin(t * 2.2 + s * 1.1) * er * 0.18; pdy = -er * 0.26 + Math.sin(t * 1.8 + s) * er * 0.09; }
    else { pdx = Math.sin(t * 1.1 + s * 0.9) * er * 0.35 * (1 - vf); pdy = Math.cos(t * 0.85 + s * 1.3) * er * 0.35 * (1 - vf); }
    if (mvSpd > 8) { pdx += (_furyMuffinVX / mvSpd) * er * 0.38 * vf; pdy += (_furyMuffinVY / mvSpd) * er * 0.38 * vf; }
    const pDist = Math.hypot(pdx, pdy), maxPd = er * 0.38;
    if (pDist > maxPd) { pdx *= maxPd / pDist; pdy *= maxPd / pDist; }
    const px = ex + pdx, py = eyeY + pdy;
    ctx.beginPath(); ctx.arc(px, py, er * 0.58, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(px + er * 0.19, py - er * 0.19, er * 0.19, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
  }
  if (happy > 0) {
    for (let s = -1; s <= 1; s += 2) {
      const er = eyeR + happy * 1.2;
      ctx.globalAlpha = happy * 0.5;
      ctx.beginPath(); ctx.ellipse(s * (eyeOX + er * 0.6), eyeY + er * 0.85, er * 0.6, er * 0.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4466'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Overlay: run Fury's full overlay (with the kebab companion), then desaturate
// it in place via an offscreen buffer (preserves alpha, unlike a blend fill).
function _sorrowNoCompanion() {}   // the durum is drawn separately so it can keep colour
function _drawSorrowOverlay(canvas, ctx, W, H, t) {
  const prev = _drawFuryOverlay._lt;
  _drawFuryOverlay(canvas, ctx, W, H, t, _sorrowNoCompanion, true);   // flip ambient fire; no companion yet
  if (_drawFuryOverlay._lt === prev) return;    // Fury capped this frame — nothing redrawn
  // fully desaturate the ambient fire + sparkles
  let buf = canvas._srBuf;
  if (!buf || buf.width !== W || buf.height !== H) {
    buf = canvas._srBuf = document.createElement('canvas'); buf.width = W; buf.height = H; canvas._srCtx = buf.getContext('2d');
  }
  const b = canvas._srCtx;
  b.clearRect(0, 0, W, H); b.drawImage(canvas, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'grayscale(1)'; ctx.drawImage(buf, 0, 0); ctx.filter = 'none';
  // draw the durum on top, only lightly desaturated — its bread & meat keep colour
  ctx.save();
  ctx.filter = 'grayscale(0.42)';
  _sorrowDrawDurum(ctx, _furyMuffinX, _furyMuffinY, t);
  ctx.filter = 'none';
  ctx.restore();
}
function _startSorrowOverlay() {
  _stopSorrowOverlay();
  _drawFuryOverlay._lt = undefined;
  _furyMuffinX = _furyMuffinTargX = window.innerWidth * 0.5;
  _furyMuffinY = _furyMuffinTargY = window.innerHeight * 0.5;
  _furyMuffinVX = 0; _furyMuffinVY = 0; _furyMuffinBounceT = 0; _furyMuffinHappyT = 0; _furyMuffinSparkles = [];
  window.addEventListener('mousemove', _furyMuffinMouseMove);
  window.addEventListener('click', _furyMuffinClick);
  const cv = document.createElement('canvas');
  cv.id = 'sorrow-fire-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('sorrow-fire-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawSorrowOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _sorrowOverlayRafId = requestAnimationFrame(frame);
  }
  _sorrowOverlayRafId = requestAnimationFrame(frame);
}
function _stopSorrowOverlay() {
  if (_sorrowOverlayRafId) { cancelAnimationFrame(_sorrowOverlayRafId); _sorrowOverlayRafId = null; }
  window.removeEventListener('mousemove', _furyMuffinMouseMove);
  window.removeEventListener('click', _furyMuffinClick);
  const cv = document.getElementById('sorrow-fire-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
//  JUKO! — Code Garden background + chibi cat-sprite cursor companion
//  Palette: deep editor green-black, vivid greens, light-yellow accents.
// ════════════════════════════════════════════════════════════════
function _jukoNewBokeh(W, H, scatter) {
  return {
    x:  Math.random() * W,
    y:  scatter ? Math.random() * H : H + Math.random() * 50,
    r:  18 + Math.random() * 58,
    vy: 8 + Math.random() * 22,         // drift up px/s
    sw: 0.4 + Math.random() * 0.8,      // sway freq
    sa: 5 + Math.random() * 14,         // sway amp px/s
    pf: 0.5 + Math.random() * 1.3,      // brightness pulse freq
    ph: Math.random() * Math.PI * 2,
    pulse: 1,
    yellow: Math.random() < 0.4,        // light-yellow vs green orb
  };
}

function _jukoNewCol(x, H, scatter) {
  return {
    x,
    y:    scatter ? Math.random() * H : -Math.random() * H * 0.6,  // head pixel pos
    spd:  46 + Math.random() * 88,                                 // fall speed px/s
    len:  10 + Math.floor(Math.random() * 22),                     // trail length (cells)
    mut:  Math.random() * 0.35,                                    // glyph-mutation timer
    yellow: Math.random() < 0.3,                                   // light-yellow vs green head tone
    bright: 0.4 + Math.random() * 0.78,                            // per-column brightness (some dim, some vivid)
    glyphs: Array.from({ length: 40 }, () => _JUKO_RAIN[Math.floor(Math.random() * _JUKO_RAIN.length)]),
  };
}

// Horizontal code ticker behind the vertical rain
function _jukoNewHRow(W, H) {
  const cw = 9;
  return {
    y:   Math.random() * H,
    off: Math.random() * 1200,
    spd: 8 + Math.random() * 24,        // px/s (scrolls left)
    cw,
    alpha: 0.08 + Math.random() * 0.13,
    glyphs: Array.from({ length: Math.ceil(W / cw) + 16 }, () => _JUKO_RAIN[Math.floor(Math.random() * _JUKO_RAIN.length)]),
  };
}

// Code snippet that fades in then out at a spot in the background
function _jukoNewSnippet(W, H, scatter) {
  return {
    x:   18 + Math.random() * Math.max(40, W - 150),
    y:   24 + Math.random() * Math.max(20, H - 48),
    txt: _JUKO_SNIPPETS[Math.floor(Math.random() * _JUKO_SNIPPETS.length)],
    sz:  12 + Math.random() * 7,
    yellow: Math.random() < 0.34,
    life: 0,
    dur:  3.4 + Math.random() * 3.6,
    delay: scatter ? Math.random() * 5 : 0.3 + Math.random() * 3.5,
  };
}

// ── Real music reactivity (safe: analyses a SEPARATE decoded copy of the track,
//    never the live <audio> element, so it can't ever silence playback). Falls
//    back to ambient motion when a track isn't CORS-fetchable. ──
let _jukoAC = null;
let _jukoEnv = null;          // { bps, env:Float32Array, flux:Float32Array }
let _jukoEnvKey = null;       // track key currently loaded / loading
let _jukoAudioReal = false;   // true once a real envelope is driving it
let _jukoAudioLevel = 0;      // smoothed loudness 0..1
let _jukoAudioOnset = 0;      // smoothed onset/beat strength 0..1
let _jukoAudioBase  = 0;      // slow baseline (running average loudness)
let _jukoAudioBeat  = 0;      // AC-coupled punch: how far ABOVE baseline we are

// Hardcoded local copy of Juko's theme, used ONLY for analysis (same-origin →
// fetch+decode always works, no CORS guessing). Drop her song here as juko.mp3.
const _JUKO_THEME_SRC = 'sounds/juko.mp3';
function _jukoEnsureEnvelope() {
  if (_jukoEnvKey === _JUKO_THEME_SRC) return;        // already loaded / loading
  _jukoEnvKey = _JUKO_THEME_SRC; _jukoEnv = null; _jukoAudioReal = false;
  try { if (!_jukoAC) _jukoAC = new (window.AudioContext || window.webkitAudioContext)(); }
  catch (e) { return; }
  fetch(_JUKO_THEME_SRC)
    .then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
    .then(buf => _jukoAC.decodeAudioData(buf))
    .then(audioBuf => { _jukoEnv = _jukoBuildEnvelope(audioBuf); _jukoAudioReal = true; })
    .catch(() => { /* file not present yet → ambient fallback */ });
}

function _jukoBuildEnvelope(buf) {
  const bps = 30;                                     // envelope resolution (bins/sec)
  const win = Math.max(1, Math.floor(buf.sampleRate / bps));
  const ch0 = buf.getChannelData(0);
  const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : null;
  const n = Math.floor(ch0.length / win);
  const env = new Float32Array(n);
  let mx = 1e-6;
  for (let i = 0; i < n; i++) {
    let s = 0; const off = i * win;
    for (let j = 0; j < win; j++) {
      let v = ch0[off + j]; if (ch1) v = (v + ch1[off + j]) * 0.5;
      s += v * v;
    }
    const rms = Math.sqrt(s / win);
    env[i] = rms; if (rms > mx) mx = rms;
  }
  for (let i = 0; i < n; i++) env[i] /= mx;            // normalise 0..1
  const flux = new Float32Array(n);
  let fmx = 1e-6;
  for (let i = 1; i < n; i++) { const d = Math.max(0, env[i] - env[i - 1]); flux[i] = d; if (d > fmx) fmx = d; }
  for (let i = 0; i < n; i++) flux[i] = Math.min(1, flux[i] / fmx);
  return { bps, env, flux };
}

function _jukoSampleAudio(dt) {
  const a = _themeAudio || window._themeAudio || document.getElementById('theme-audio');
  const playing = !!(a && !a.paused && !a.ended && a.currentTime > 0);
  let target = 0, onset = 0;
  if (playing && _jukoEnv && _jukoAudioReal) {
    const idx = Math.floor(a.currentTime * _jukoEnv.bps);
    if (idx >= 0 && idx < _jukoEnv.env.length) { target = _jukoEnv.env[idx]; onset = _jukoEnv.flux[idx]; }
  } else if (playing) {
    const tt = a.currentTime;                          // ambient fallback, tied to playback
    target = Math.max(0, Math.min(1, 0.5 + 0.25 * Math.sin(tt * 6.3) + 0.15 * Math.sin(tt * 9.4) + 0.12 * Math.sin(tt * 3.1)));
    onset  = Math.max(0, Math.sin(tt * 6.3)) * 0.3;
  }
  if (!playing) { target = 0; onset = 0; }
  // Fast attack so peaks land on time, smoother release — minimises perceived lag.
  _jukoAudioLevel += (target - _jukoAudioLevel) * Math.min(1, dt * (target > _jukoAudioLevel ? 30 : 14));
  _jukoAudioOnset  = Math.max(_jukoAudioOnset * (1 - Math.min(1, dt * 7)), onset);  // fast attack, slow release

  // ── AC-coupled "beat" — the key to VISIBLE reactivity ──────────────────
  // Raw loudness (RMS) is too smooth: during a song it just sits at a steady
  // bright value, so a glow tied to it looks pinned on and barely moves. We
  // instead track a slow baseline and react to how far ABOVE it we are right
  // now (plus onset transients). Steady passages → ~0 (dark/calm); hits,
  // drops and swells → sharp spikes. Fast attack, quick-ish release.
  _jukoAudioBase += (_jukoAudioLevel - _jukoAudioBase) * Math.min(1, dt * 0.7);
  const dev  = Math.max(0, _jukoAudioLevel - _jukoAudioBase);
  const beat = Math.min(1, dev * 3.4 + _jukoAudioOnset * 0.95);
  if (beat > _jukoAudioBeat) _jukoAudioBeat = beat;                 // instant attack
  else _jukoAudioBeat += (beat - _jukoAudioBeat) * Math.min(1, dt * 6); // smooth release

  // Debug: inspect in console with `_jukoDbg`, or read the on-screen telemetry.
  window._jukoDbg = { real: _jukoAudioReal, playing, level: +_jukoAudioLevel.toFixed(3),
                      base: +_jukoAudioBase.toFixed(3), beat: +_jukoAudioBeat.toFixed(3), onset: +_jukoAudioOnset.toFixed(3) };
}

function _drawJukoPattern(canvas, ctx, W, H, t) {
  // 30fps cap (matches the other heavy patterns)
  if (_drawJukoPattern._lt !== undefined && t - _drawJukoPattern._lt < 0.033) return;
  const dt = _drawJukoPattern._lt === undefined ? 0.016 : Math.min(t - _drawJukoPattern._lt, 0.05);
  _drawJukoPattern._lt = t;

  _jukoEnsureEnvelope();
  _jukoSampleAudio(dt);
  const aL = _jukoAudioLevel, aO = _jukoAudioOnset;   // 0..1 loudness / beat

  if (canvas._jukoW !== W || canvas._jukoH !== H) {
    canvas._jukoW = W; canvas._jukoH = H;
    canvas._jukoCols = null; canvas._jukoBokeh = null; canvas._jukoVign = null;
    canvas._jukoHRows = null; canvas._jukoSnips = null;
  }

  // 1 ── Editor-dark base with a faint green tint
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#08130c';
  ctx.fillRect(0, 0, W, H);

  // 2 ── Soft bokeh orbs drifting up (green + light-yellow) — warm, fun energy
  if (!canvas._jukoBokeh) {
    canvas._jukoBokeh = Array.from({ length: 26 }, () => _jukoNewBokeh(W, H, true));
  }
  ctx.globalCompositeOperation = 'lighter';
  const bokehBoost = 1 + aL * 0.9;
  for (const b of canvas._jukoBokeh) {
    b.y -= b.vy * dt * bokehBoost;
    b.x += Math.sin(t * b.sw + b.ph) * b.sa * dt;
    b.pulse = (0.45 + 0.55 * Math.sin(t * b.pf + b.ph)) * (1 + aL * 0.5);
    if (b.y < -b.r) Object.assign(b, _jukoNewBokeh(W, H, false));
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, b.yellow
      ? `rgba(224,236,128,${0.16 * b.pulse})`
      : `rgba(86,214,116,${0.15 * b.pulse})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  }

  // 3 ── Horizontal code tickers, scrolling left BEHIND the vertical rain
  if (!canvas._jukoHRows) {
    const rn = Math.max(10, Math.round(H / 28));
    canvas._jukoHRows = Array.from({ length: rn }, () => _jukoNewHRow(W, H));
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = '11px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const row of canvas._jukoHRows) {
    row.off += row.spd * dt * (1 + aL * 1.1);
    const cw = row.cw, n = row.glyphs.length;
    const start = ((row.off % cw) + cw) % cw;
    const baseIdx = Math.floor(row.off / cw);
    ctx.fillStyle = `rgba(46,158,80,${row.alpha})`;
    for (let j = 0, gx = -start; gx < W + cw; j++, gx += cw) {
      ctx.fillText(row.glyphs[(((baseIdx + j) % n) + n) % n], gx, row.y);
    }
  }

  // 4 ── Code snippets that fade in and out across the background
  if (!canvas._jukoSnips) {
    const sn = Math.max(8, Math.round((W * H) / 58000));
    canvas._jukoSnips = Array.from({ length: sn }, () => _jukoNewSnippet(W, H, true));
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const sp of canvas._jukoSnips) {
    sp.life += dt;
    const local = sp.life - sp.delay;
    if (local < 0) continue;
    if (local > sp.dur) { Object.assign(sp, _jukoNewSnippet(W, H, false)); continue; }
    const a = Math.sin(Math.PI * local / sp.dur);            // 0 → 1 → 0
    ctx.font = `${Math.round(sp.sz)}px "Courier New", monospace`;
    ctx.fillStyle = sp.yellow ? `rgba(226,236,128,${a * 0.5})` : `rgba(96,216,120,${a * 0.5})`;
    ctx.fillText(sp.txt, sp.x, sp.y);
  }

  // 5 ── Matrix code rain — dense green streams, glowing heads with additive
  //      bloom, per-column brightness, scrolling light-yellow "keyword" tokens.
  const cellH = 15, colW = 11;
  if (!canvas._jukoCols) {
    const n = Math.ceil(W / colW) + 1;
    canvas._jukoCols = Array.from({ length: n }, (_, i) => _jukoNewCol(i * colW + colW * 0.5, H, true));
  }
  const cols = canvas._jukoCols;

  // 5a — advance columns + paint additive bloom behind each falling head
  ctx.globalCompositeOperation = 'lighter';
  const rainBoost = 1 + aL * 1.3;                 // streams race on loud parts
  for (const col of cols) {
    col.y += col.spd * dt * rainBoost;
    col.mut -= dt * (1 + aL * 1.6);               // glyphs churn faster with energy
    if (col.mut <= 0) {
      col.mut = 0.04 + Math.random() * 0.2;
      col.glyphs[Math.floor(Math.random() * col.glyphs.length)] =
        _JUKO_RAIN[Math.floor(Math.random() * _JUKO_RAIN.length)];
    }
    const hy = col.y;
    if (hy > -18 && hy < H + 18) {
      const gA = (col.yellow ? 0.55 : 0.48) * Math.min(1, 0.5 + col.bright * 0.7);
      const gr = ctx.createRadialGradient(col.x, hy, 0, col.x, hy, 14);
      gr.addColorStop(0, col.yellow ? `rgba(232,248,168,${gA})` : `rgba(150,246,150,${gA})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(col.x, hy, 14, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 5b — glyph streams (per-column brightness; whole field pulses with the music)
  const cf = 0.8 + aL * 0.7;            // loudness → overall brightness
  const headFlash = aO;                 // beat → heads flare white-hot
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const col of cols) {
    const headCell = Math.floor(col.y / cellH);
    const gl = col.glyphs, gn = gl.length, br = col.bright;
    for (let k = 0; k < col.len; k++) {
      const cy = col.y - k * cellH;
      if (cy < -cellH || cy > H + cellH) continue;
      const idx = (((headCell - k) % gn) + gn) % gn;
      const ch = gl[idx];
      const f = 1 - k / col.len;                          // 1 head → 0 tail
      if (k === 0) {
        const ha = Math.min(1, 0.55 + br * 0.45);
        if (headFlash > 0.35) ctx.fillStyle = `rgba(255,255,236,${Math.min(1, ha + headFlash * 0.5)})`;
        else ctx.fillStyle = col.yellow ? `rgba(247,252,205,${ha})` : `rgba(222,255,212,${ha})`;
      } else if (idx % 6 === 0) {
        ctx.fillStyle = `rgba(228,238,120,${Math.min(1, (0.55 * f + 0.18) * br * cf)})`; // yellow keyword token
      } else if (k <= 3) {
        ctx.fillStyle = `rgba(150,238,140,${Math.min(1, (0.9 * f + 0.1) * br * cf)})`;   // fresh green near head
      } else {
        ctx.fillStyle = `rgba(54,194,90,${Math.min(1, 0.78 * f * br * cf)})`;           // deep green tail
      }
      ctx.fillText(ch, col.x, cy);
    }
    if (col.y - col.len * cellH > H) Object.assign(col, _jukoNewCol(col.x, H, false));
  }
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  // 6 ── Soft gradient light bands sweeping up & down over the code
  ctx.globalCompositeOperation = 'lighter';
  for (let bIdx = 0; bIdx < 3; bIdx++) {
    const dir = bIdx % 2 === 0 ? 1 : -1;
    const speed = 0.05 + bIdx * 0.028;
    const bandH = H * 0.55;
    const phase = (((t * speed * dir) % 1) + 1) % 1;
    const cy = phase * (H + bandH) - bandH / 2;
    const rgb = bIdx === 1 ? '226,236,120' : '88,218,120';
    const bandA = 0.05 + aL * 0.11;
    const g = ctx.createLinearGradient(0, cy - bandH / 2, 0, cy + bandH / 2);
    g.addColorStop(0,   `rgba(${rgb},0)`);
    g.addColorStop(0.5, `rgba(${rgb},${bandA})`);
    g.addColorStop(1,   `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - bandH / 2, W, bandH);
  }
  ctx.globalCompositeOperation = 'source-over';

  // 6.5 ── CHAOS: beat bloom + torn slices + channel-split jolts + data corruption.
  //        Strong baseline jitter (wild even in silence); the music cranks it hard.
  if (aO > 0.05) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(130,245,150,${Math.min(0.42, aO * 0.3)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Torn horizontal slices, displaced sideways with a chromatic tint
  const glitchP = 0.2 + aO * 0.7 + aL * 0.22;
  if (Math.random() < glitchP) {
    const slices = 1 + Math.floor(Math.random() * (3 + aO * 6));
    for (let i = 0; i < slices; i++) {
      const sh = 4 + Math.random() * (26 + aL * 46);
      const sy = Math.random() * Math.max(1, H - sh);
      const dx = (Math.random() - 0.5) * (44 + aL * 110 + aO * 130);
      ctx.drawImage(canvas, 0, sy, W, sh, dx, sy, W, sh);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(40,255,120,0.14)' : 'rgba(236,244,120,0.12)';
      ctx.fillRect(dx, sy, W, sh);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // Channel-split ghost jolt on strong beats
  if (aO > 0.42 && Math.random() < 0.6) {
    const off = 3 + aO * 10;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    ctx.drawImage(canvas, off, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Data-corruption blocks — bright garbled glyph clusters pop in
  if (Math.random() < 0.14 + aL * 0.32) {
    const nblk = 1 + Math.floor(Math.random() * 3);
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let b = 0; b < nblk; b++) {
      const bx = Math.random() * W, by = Math.random() * H;
      const bw = 3 + Math.floor(Math.random() * 6), bh = 1 + Math.floor(Math.random() * 4);
      for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(184,255,172,0.92)' : 'rgba(238,246,150,0.85)';
        ctx.fillText(_JUKO_RAIN[Math.floor(Math.random() * _JUKO_RAIN.length)], bx + xx * 11, by + yy * 13);
      }
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }

  // 6.6 ── Loudness makes the whole screen breathe (very visible reactivity)
  if (aL > 0.04) {
    ctx.globalCompositeOperation = 'lighter';
    const pg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.62);
    pg.addColorStop(0, `rgba(72,212,112,${aL * 0.12})`);
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
  }

  // 7 ── Vignette to frame the garden
  if (!canvas._jukoVign) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    canvas._jukoVign = vg;
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = canvas._jukoVign;
  ctx.fillRect(0, 0, W, H);
}

// Chibi Juko: green cat head, gold glasses, light-yellow twintails, reactive eyes.
function _jukoDrawSprite(ctx, x, y, t) {
  const bT = _jukoBounceT;
  const sq = bT > 0 ? Math.sin(bT * Math.PI * 3.0) * bT * 0.40 : 0;
  const sX = 1 + sq * 0.30, sY = 1 - sq * 0.40;
  const bob = Math.sin(t * 2.6) * 2.6;
  const happy = _jukoHappyT > 0 ? Math.min(1, _jukoHappyT) : 0;
  // Gentle lean toward horizontal motion
  const lean = Math.max(-0.26, Math.min(0.26, _jukoVX / 900));
  // Periodic blink (skipped while happy — eyes are ^^ then)
  const cyc = t % 3.4;
  const blinkClose = cyc < 0.16 ? (1 - Math.abs(cyc - 0.08) / 0.08) : 0;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(lean);
  ctx.scale(sX, sY);

  const R = 20;
  const eyeOX = 8.5, eyeY = -1.5, eyeR = 6.6;
  const aL = _jukoAudioLevel, aO = _jukoAudioOnset;   // music drives glow/LEDs

  // ── Tail: a glowing "code cable" (drawn first, so the head sits over its root).
  // Unique twist — it's not fur, it's a data cable made of code glyphs tipped with
  // a little plug + LED. It WHIPS out behind motion and curls into a spiral when
  // idle, and its wiggle/glow swell with the music.
  {
    const spd  = Math.hypot(_jukoVX, _jukoVY);
    const vf   = Math.min(1, spd / 340);
    const bend = Math.max(-1, Math.min(1, -_jukoVX / 280));
    const NSEG = 11, segLen = 5.6;
    const pts = [];
    let px = -bend * 2, py = R * 0.86;                 // root just under the head
    let ang = Math.PI * 0.5 + bend * 0.55;             // hangs down, leans against motion
    pts.push({ x: px, y: py, a: ang });
    for (let i = 1; i <= NSEG; i++) {
      const f = i / NSEG;
      ang += 0.30 * (1 - vf) + bend * 0.18 * f          // idle→spiral, moving→straighten/trail
           + Math.sin(t * 4.2 + i * 0.7) * (0.10 + 0.06 * f) * (0.5 + vf * 0.8 + aL * 0.7);
      px += Math.cos(ang) * segLen;
      py += Math.sin(ang) * segLen;
      pts.push({ x: px, y: py, a: ang });
    }
    // additive glow underlay
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(90,230,110,${0.16 + aL * 0.24})`;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
    // main cable — tapering, dark base → bright tip
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const f = i / pts.length;
      ctx.strokeStyle = `rgb(${30 + f * 70 | 0},${150 + f * 95 | 0},${60 + f * 60 | 0})`;
      ctx.lineWidth = 4.6 * (1 - f * 0.62);
      ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
    // code glyphs riding the cable
    const tg = _jukoDrawSprite._tail || (_jukoDrawSprite._tail = { g: [], next: 0 });
    if (!tg.g.length) for (let k = 0; k < 4; k++) tg.g.push(_JUKO_TOKENS[(Math.random() * _JUKO_TOKENS.length) | 0]);
    if (t > tg.next) { tg.g[(Math.random() * tg.g.length) | 0] = _JUKO_TOKENS[(Math.random() * _JUKO_TOKENS.length) | 0]; tg.next = t + 0.5 + Math.random(); }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < tg.g.length; k++) {
      const idx = Math.min(pts.length - 1, Math.floor((k + 1) / (tg.g.length + 1) * (pts.length - 1)) + 1);
      const p = pts[idx];
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.a - Math.PI * 0.5);
      ctx.font = `bold ${6.5 + (idx / pts.length) * 3}px "Courier New", monospace`;
      ctx.fillStyle = `rgba(${(180 + aO * 70) | 0},255,130,${0.7 + aL * 0.3})`;
      ctx.fillText(tg.g[k], 0, 0);
      ctx.restore();
    }
    ctx.restore();
    // tip: a little plug/connector with a music-reactive LED
    const tip = pts[pts.length - 1], pre = pts[pts.length - 2];
    const ta = Math.atan2(tip.y - pre.y, tip.x - pre.x);
    ctx.save();
    ctx.translate(tip.x, tip.y); ctx.rotate(ta);
    ctx.fillStyle = '#2b332c'; ctx.fillRect(-1, -3.2, 6, 6.4);   // connector body
    ctx.fillStyle = '#1c211b'; ctx.fillRect(5, -2, 3, 4);        // prongs
    const led = Math.min(1, 0.32 + aL + aO * 0.8);
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.arc(2, 0, 2 + led * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210,255,120,${0.32 + led * 0.5})`; ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Cat ears (behind head) — big and perky
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 4, -R * 0.80);
    ctx.lineTo(s * 23, -R * 2.14);
    ctx.lineTo(s * 26, -R * 0.40);
    ctx.closePath();
    ctx.fillStyle = '#36a64c'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 8, -R * 0.86);
    ctx.lineTo(s * 20, -R * 1.80);
    ctx.lineTo(s * 22, -R * 0.52);
    ctx.closePath();
    ctx.fillStyle = '#e7ec88'; ctx.fill();
  }

  // ── Head (green, soft top-light)
  const hg = ctx.createRadialGradient(-R * 0.32, -R * 0.4, 2, 0, 0, R * 1.3);
  hg.addColorStop(0, '#62d273'); hg.addColorStop(0.6, '#3fb257'); hg.addColorStop(1, '#2b8642');
  ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = hg; ctx.fill();
  ctx.strokeStyle = 'rgba(18,68,34,0.5)'; ctx.lineWidth = 1.4; ctx.stroke();

  // ── Headphones (cat-ear-headphone vibe — her programmer music gear)
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2b332c'; ctx.lineWidth = 5.5;                 // band over the top
  ctx.beginPath(); ctx.arc(0, 1, R + 4, Math.PI, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(228,236,138,0.8)'; ctx.lineWidth = 1.7;   // glowing band highlight
  ctx.beginPath(); ctx.arc(0, 1, R + 5.6, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  for (const s of [-1, 1]) {                                        // earcups on the sides
    const cx = s * (R + 3.5), cy = 4;
    ctx.beginPath(); ctx.ellipse(cx, cy, 6.6, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#23291f'; ctx.fill();
    ctx.strokeStyle = '#3a4530'; ctx.lineWidth = 1.4; ctx.stroke();
    // LED ring brightens & thickens with loudness; halo blooms on the beat
    const glow = Math.min(1, aL + aO * 0.6);
    if (glow > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.ellipse(cx, cy, 5 + glow * 4, 8 + glow * 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,240,90,${glow * 0.35})`; ctx.fill();
      ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(cx, cy, 3.6, 6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(207,233,106,${0.7 + glow * 0.3})`;
    ctx.lineWidth = 1.7 + glow * 1.3;
    ctx.stroke();
  }

  // ── Eyes
  for (const s of [-1, 1]) {
    const ex = s * eyeOX;
    if (happy > 0.1) {
      // Happy ^^ — upward arcs
      ctx.strokeStyle = '#12331c'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(ex, eyeY + 2, eyeR * 0.95, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
    } else {
      const eScaleY = 1 - blinkClose * 0.85;
      // White
      ctx.save();
      ctx.translate(ex, eyeY); ctx.scale(1, eScaleY);
      ctx.beginPath(); ctx.arc(0, 0, eyeR, 0, Math.PI * 2);
      ctx.fillStyle = '#f4fff0'; ctx.fill();
      ctx.restore();
      // Reactive pupil — idle wander blended with velocity direction (like Fury's muffin)
      const mvSpd = Math.hypot(_jukoVX, _jukoVY);
      const vf = Math.min(1, mvSpd / 300);
      let pdx = Math.sin(t * 1.2 + s * 0.8) * eyeR * 0.32 * (1 - vf);
      let pdy = Math.cos(t * 0.9 + s * 1.2) * eyeR * 0.32 * (1 - vf);
      if (mvSpd > 8) {
        pdx += (_jukoVX / mvSpd) * eyeR * 0.42 * vf;
        pdy += (_jukoVY / mvSpd) * eyeR * 0.42 * vf;
      }
      const pD = Math.hypot(pdx, pdy), mx = eyeR * 0.42;
      if (pD > mx) { pdx *= mx / pD; pdy *= mx / pD; }
      ctx.save();
      ctx.translate(ex + pdx, eyeY + pdy * eScaleY); ctx.scale(1, eScaleY);
      ctx.beginPath(); ctx.arc(0, 0, eyeR * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#143a20'; ctx.fill();   // dark-green pupil
      ctx.beginPath(); ctx.arc(-eyeR * 0.18, -eyeR * 0.2, eyeR * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();       // catchlight
      ctx.restore();
    }
  }

  // ── Glasses (gold frames + faint green lens tint)
  ctx.strokeStyle = '#d9b347'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * eyeOX, eyeY, eyeR + 2.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(186,232,160,0.13)'; ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();                                   // bridge
  ctx.moveTo(-eyeOX + eyeR + 1, eyeY); ctx.lineTo(eyeOX - eyeR - 1, eyeY); ctx.stroke();
  ctx.beginPath();                                   // temple arms
  ctx.moveTo(-eyeOX - eyeR - 2.4, eyeY); ctx.lineTo(-R + 1, eyeY - 1); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(eyeOX + eyeR + 2.4, eyeY); ctx.lineTo(R - 1, eyeY - 1); ctx.stroke();

  // ── Mouth — :3 cat smile (wider when happy)
  const my = eyeY + eyeR + 5.5;
  const mw = 4 + happy * 2;
  ctx.strokeStyle = '#12331c'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-mw, my);
  ctx.quadraticCurveTo(-mw * 0.5, my + 3 + happy * 1.5, 0, my);
  ctx.quadraticCurveTo(mw * 0.5, my + 3 + happy * 1.5, mw, my);
  ctx.stroke();

  // ── Blush on click
  if (happy > 0) {
    ctx.globalAlpha = happy * 0.55;
    ctx.fillStyle = '#ff9aa6';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * (eyeOX + 5), eyeY + 6, 4.6, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function _drawJukoOverlay(canvas, ctx, W, H, t) {
  if (_drawJukoOverlay._lt !== undefined && t - _drawJukoOverlay._lt < 0.033) return;
  const dt = _drawJukoOverlay._lt === undefined ? 0.016 : Math.min(t - _drawJukoOverlay._lt, 0.05);
  _drawJukoOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);

  // Spring-follow (floaty lag)
  const SPRING = 80, DAMP = 10;
  _jukoVX += ((_jukoTargX - _jukoX) * SPRING - _jukoVX * DAMP) * dt;
  _jukoVY += ((_jukoTargY - _jukoY) * SPRING - _jukoVY * DAMP) * dt;
  _jukoX += _jukoVX * dt;
  _jukoY += _jukoVY * dt;

  _jukoBounceT = Math.max(0, _jukoBounceT - dt * 3.0);
  _jukoHappyT  = Math.max(0, _jukoHappyT  - dt);
  // Bump to the beat — strong onsets give Juko a little squish-bounce
  if (_jukoAudioOnset > 0.5) _jukoBounceT = Math.max(_jukoBounceT, (_jukoAudioOnset - 0.5) * 1.1);

  // Code-symbol burst from clicks
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = _jukoParticles.length - 1; i >= 0; i--) {
    const p = _jukoParticles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 130 * dt; // gravity
    p.rot += p.vr * dt; p.life -= dt * 1.6;
    if (p.life <= 0) { _jukoParticles.splice(i, 1); continue; }
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.min(1, p.life * 1.25);
    ctx.font = `bold ${p.sz}px "Courier New", monospace`;
    ctx.fillStyle = `hsl(${p.hue},85%,62%)`;
    ctx.fillText(p.ch, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';

  _jukoDrawSprite(ctx, _jukoX, _jukoY, t);

  // ── Drive Juko's pfp / name reactive chrome ──
  // Push the live audio envelope into CSS custom props so the menus, avatar and
  // name display pulse and glitch in time with the music. A gentle idle shimmer
  // (sine of t) keeps everything alive even when the track is paused/stopped.
  const _cvRoot = _drawJukoOverlay._root || (_drawJukoOverlay._root = document.getElementById('char-view'));
  if (_cvRoot && _cvRoot.classList.contains('juko-ui')) {
    // Rest DARK and let the BEAT do the talking. A faint idle shimmer keeps it
    // alive when paused; the AC-coupled beat drives the bright pulses so the
    // boxes visibly flash with the music instead of sitting pinned-bright.
    const idle   = 0.05 + 0.03 * Math.sin(t * 2.0);
    const glowV  = Math.min(1.0, idle + _jukoAudioLevel * 0.22 + _jukoAudioBeat * 0.92);
    const onsetV = Math.min(1, _jukoAudioBeat);
    const glitchV = _jukoAudioBeat > 0.5 ? 1 : (Math.sin(t * 13.0) > 0.94 ? 0.5 : 0);
    // PERF: quantize and only write a custom property when it actually changes.
    // Writing to #char-view invalidates the style of its whole subtree, so doing
    // it every frame was the main source of lag. Skipping no-op writes removes it
    // with no visible difference (idle barely writes; music writes on real change).
    const qG = Math.round(glowV * 33) / 33;
    const qO = Math.round(onsetV * 25) / 25;
    const last = _drawJukoOverlay._css || (_drawJukoOverlay._css = { g: -1, o: -1, x: -1 });
    const st = _cvRoot.style;
    if (qG !== last.g)      { st.setProperty('--juko-glow', qG.toFixed(3));   last.g = qG; }
    if (qO !== last.o)      { st.setProperty('--juko-onset', qO.toFixed(3));  last.o = qO; }
    if (glitchV !== last.x) { st.setProperty('--juko-glitch', glitchV.toFixed(2)); last.x = glitchV; }
  }

}

// ── Code-frame layer ──────────────────────────────────────────────────
// Renders each Juko panel's border AS streaming code: a ring of green glyphs
// (random shades, a few warm light-yellow) sitting just inside each box edge,
// flickering and mutating, with a bright "comet" head travelling around the
// perimeter. Brighter than the background matrix and reactive to the music
// (speed ← loudness, head/whole-frame flare ← beat). One fixed full-viewport
// canvas; panel rects are read live so it tracks scrolling and tab changes.
function _jukoBuildFrameCells(w, h, cell) {
  const cells = [];
  const push = (x, y) => cells.push({
    x, y,
    ch: _JUKO_RAIN[(Math.random() * _JUKO_RAIN.length) | 0],
    shade: 0.45 + Math.random() * 0.55,
    warm: Math.random() < 0.16,
    flick: Math.random() * Math.PI * 2,
    mut: 0.2 + Math.random() * 1.6,
  });
  const stepEdge = (x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.max(1, Math.round(Math.hypot(dx, dy) / cell));
    for (let i = 0; i < n; i++) push(x0 + dx * (i / n), y0 + dy * (i / n));
  };
  const m = cell * 0.62;                 // inset so glyphs ride just inside the edge
  stepEdge(m, m, w - m, m);              // top  L→R
  stepEdge(w - m, m, w - m, h - m);      // right T→B
  stepEdge(w - m, h - m, m, h - m);      // bottom R→L
  stepEdge(m, h - m, m, m);              // left  B→T
  return cells;
}

// Bottom equalizer (own canvas, BEHIND the panels): many thin vertical bars in
// graded green tones (dark base → light-yellow tips via one shared vertical
// gradient). Bars snap UP instantly on beats/loudness and fall back smoothly,
// like a VU meter, so they track the actual music rather than lagging it.
function _drawJukoEqualizer(canvas, ctx, W, H, t) {
  if (_drawJukoEqualizer._lt !== undefined && t - _drawJukoEqualizer._lt < 0.033) return;
  const dt = _drawJukoEqualizer._lt === undefined ? 0.016 : Math.min(t - _drawJukoEqualizer._lt, 0.05);
  _drawJukoEqualizer._lt = t;
  ctx.clearRect(0, 0, W, H);

  const lvl = _jukoAudioLevel, beat = _jukoAudioBeat;
  const eqH = Math.min(240, H * 0.26);            // max bar height
  const spacing = 6, barW = 2.6;
  const n = Math.max(8, Math.floor(W / spacing));
  let eq = _drawJukoEqualizer._eq;
  if (!eq || eq.n !== n || eq.H !== H) {
    eq = _drawJukoEqualizer._eq = {
      n, H,
      h:    new Float32Array(n),
      rate: Float32Array.from({ length: n }, () => 2 + Math.random() * 7),
      ph:   Float32Array.from({ length: n }, () => Math.random() * Math.PI * 2),
      rnd:  Float32Array.from({ length: n }, () => 0.55 + Math.random() * 0.45),
    };
    const g = ctx.createLinearGradient(0, H, 0, H - eqH);
    g.addColorStop(0.0, '#06301a');
    g.addColorStop(0.4, '#1c9c3d');
    g.addColorStop(0.72, '#5cef4a');
    g.addColorStop(1.0, '#eaffb0');
    eq.grad = g;
  }
  const kUp = Math.min(1, dt * 38), kDn = Math.min(1, dt * 9);   // fast attack, smooth release
  // solid graded bars
  ctx.fillStyle = eq.grad;
  for (let i = 0; i < n; i++) {
    const wave = 0.55 + 0.45 * Math.sin(t * eq.rate[i] + eq.ph[i]);
    const idle = 0.018 + 0.012 * Math.sin(t * 1.4 + i * 0.4);     // a sliver of life when silent
    const target = Math.min(1, idle + (lvl * 0.5 + beat * 0.72) * wave * eq.rnd[i]);
    eq.h[i] += (target > eq.h[i] ? kUp : kDn) * (target - eq.h[i]);
    const bh = eq.h[i] * eqH;
    if (bh < 1) continue;
    ctx.fillRect(i * spacing + (spacing - barW) * 0.5, H - bh, barW, bh);
  }
  // additive bright caps for a glowing top edge
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const bh = eq.h[i] * eqH;
    if (bh < 6) continue;
    ctx.fillStyle = `rgba(190,255,150,${Math.min(0.6, eq.h[i] * 0.75)})`;
    ctx.fillRect(i * spacing + (spacing - barW) * 0.5 - 0.4, H - bh, barW + 0.8, 2.4);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function _drawJukoCodeFrame(canvas, ctx, W, H, t) {
  if (_drawJukoCodeFrame._lt !== undefined && t - _drawJukoCodeFrame._lt < 0.033) return;
  const dt = _drawJukoCodeFrame._lt === undefined ? 0.016 : Math.min(t - _drawJukoCodeFrame._lt, 0.05);
  _drawJukoCodeFrame._lt = t;
  ctx.clearRect(0, 0, W, H);

  const root = _drawJukoOverlay._root || (_drawJukoOverlay._root = document.getElementById('char-view'));
  if (!root || !root.classList.contains('juko-ui')) return;

  const beat = _jukoAudioBeat, lvl = _jukoAudioLevel;

  const panels = root.querySelectorAll('.panel');
  const cell = 19;                                  // bigger glyphs for the code border
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${cell - 3}px "Courier New", monospace`;
  ctx.globalCompositeOperation = 'lighter';
  _drawJukoCodeFrame._comet = (_drawJukoCodeFrame._comet || 0) + dt * (55 + lvl * 130);

  for (let pi = 0; pi < panels.length; pi++) {
    const p = panels[pi];
    const r = p.getBoundingClientRect();
    if (r.width < 24 || r.bottom < -40 || r.top > H + 40) continue;   // hidden / off-screen
    let st = p._jukoFrame;
    const rw = Math.round(r.width), rh = Math.round(r.height);
    if (!st || st.w !== rw || st.h !== rh) {
      st = p._jukoFrame = { w: rw, h: rh, cells: _jukoBuildFrameCells(r.width, r.height, cell) };
    }
    const cells = st.cells, N = cells.length;
    const head = (_drawJukoCodeFrame._comet / cell + pi * 7) % N;     // offset per panel
    for (let i = 0; i < N; i++) {
      const c = cells[i];
      c.mut -= dt;
      if (c.mut <= 0) { c.ch = _JUKO_RAIN[(Math.random() * _JUKO_RAIN.length) | 0]; c.mut = 0.25 + Math.random() * 1.7; }
      let d = Math.abs(i - head); if (d > N / 2) d = N - d;
      const comet = Math.max(0, 1 - d / 7);
      const flick = 0.8 + 0.2 * Math.sin(t * 7 + c.flick);
      let b = c.shade * flick * (0.3 + lvl * 0.28) + comet * (0.55 + beat * 0.65) + beat * 0.12;
      if (b < 0.045) continue;
      b = Math.min(1.2, b);
      const w2 = comet * (0.5 + beat * 0.45);     // head whitens toward light-yellow
      let cr, cg, cb;
      if (c.warm) { cr = 205; cg = 255; cb = 135; } else { cr = 58; cg = 232; cb = 92; }
      cr = Math.min(255, cr + w2 * 175); cg = Math.min(255, cg + w2 * 22); cb = Math.min(255, cb + w2 * 120);
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${b.toFixed(3)})`;
      ctx.fillText(c.ch, r.left + c.x, r.top + c.y);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

function _startJukoOverlay() {
  _stopJukoOverlay();
  _drawJukoOverlay._lt = undefined;
  _drawJukoCodeFrame._lt = undefined;
  _drawJukoEqualizer._lt = undefined;
  _drawJukoOverlay._css = null;   // force CSS-var re-sync on re-entry
  _jukoX = _jukoTargX = window.innerWidth * 0.5;
  _jukoY = _jukoTargY = window.innerHeight * 0.5;
  _jukoVX = 0; _jukoVY = 0;
  _jukoBounceT = 0; _jukoHappyT = 0;
  _jukoAudioLevel = 0; _jukoAudioOnset = 0; _jukoAudioBase = 0; _jukoAudioBeat = 0;
  _jukoParticles = [];
  window.addEventListener('mousemove', _jukoMouseMove);
  window.addEventListener('click', _jukoClick);
  // Equalizer layer — appended inside #content (z-index:0) so it sits BEHIND
  // #char-view (z-index:1) and its panels, peeking out only around the boxes.
  const eqc = document.createElement('canvas');
  eqc.id = 'juko-eq-overlay';
  eqc.style.cssText = 'position:fixed;left:0;bottom:0;width:100vw;height:100vh;z-index:0;pointer-events:none;';
  eqc.width = window.innerWidth; eqc.height = window.innerHeight;
  (document.getElementById('content') || document.body).appendChild(eqc);
  // Code-frame layer (panel borders rendered as code) — below the sprite.
  const fr = document.createElement('canvas');
  fr.id = 'juko-frame-overlay';
  fr.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:30;pointer-events:none;';
  fr.width = window.innerWidth; fr.height = window.innerHeight;
  document.body.appendChild(fr);
  // Cursor companion / particles layer — on top of everything.
  const cv = document.createElement('canvas');
  cv.id = 'juko-code-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const tt = (now - t0) / 1000;
    const eq2 = document.getElementById('juko-eq-overlay');
    if (eq2) {
      if (eq2.width !== window.innerWidth || eq2.height !== window.innerHeight) {
        eq2.width = window.innerWidth; eq2.height = window.innerHeight;
      }
      _drawJukoEqualizer(eq2, eq2.getContext('2d'), eq2.width, eq2.height, tt);
    }
    const fr2 = document.getElementById('juko-frame-overlay');
    if (fr2) {
      if (fr2.width !== window.innerWidth || fr2.height !== window.innerHeight) {
        fr2.width = window.innerWidth; fr2.height = window.innerHeight;
      }
      _drawJukoCodeFrame(fr2, fr2.getContext('2d'), fr2.width, fr2.height, tt);
    }
    const cv2 = document.getElementById('juko-code-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawJukoOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, tt);
    _jukoOverlayRafId = requestAnimationFrame(frame);
  }
  _jukoOverlayRafId = requestAnimationFrame(frame);
}

function _stopJukoOverlay() {
  if (_jukoOverlayRafId) { cancelAnimationFrame(_jukoOverlayRafId); _jukoOverlayRafId = null; }
  window.removeEventListener('mousemove', _jukoMouseMove);
  window.removeEventListener('click', _jukoClick);
  const cv = document.getElementById('juko-code-overlay');
  if (cv) cv.remove();
  const fr = document.getElementById('juko-frame-overlay');
  if (fr) fr.remove();
  const eqc = document.getElementById('juko-eq-overlay');
  if (eqc) eqc.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// LUCIFER · UNLEASHED — demonic hellscape (background) + hellfire cursor
// ════════════════════════════════════════════════════════════════
function _lucNewEmber(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : H + Math.random() * 40,
    vy: 30 + Math.random() * 95, r: 1.5 + Math.random() * 4.5, a: 0.4 + Math.random() * 0.6,
    sw: 0.5 + Math.random() * 1.5, sa: 6 + Math.random() * 16, ph: Math.random() * 6.28,
    ff: 3 + Math.random() * 5, flick: 1 };
}
function _lucNewRune(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : H + 20 + Math.random() * 60,
    vy: 8 + Math.random() * 22, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.6,
    sz: 14 + Math.random() * 26, a: 0.3 + Math.random() * 0.5, pf: 0.6 + Math.random() * 1.6,
    ph: Math.random() * 6.28, ch: _LUCIFER_RUNES[(Math.random() * _LUCIFER_RUNES.length) | 0] };
}
// Cached soft ember sprite — drawImage'd per ember instead of building a fresh
// radial gradient each one (far cheaper for hundreds of additive embers).
function _lucEmberSprite() {
  if (_lucEmberSprite._c) return _lucEmberSprite._c;
  const s = document.createElement('canvas'); s.width = s.height = 32;
  const g = s.getContext('2d');
  const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,232,155,1)');
  rg.addColorStop(0.4, 'rgba(255,120,40,0.8)');
  rg.addColorStop(1, 'rgba(120,12,10,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  return _lucEmberSprite._c = s;
}
// Inverted (point-down) pentagram path into the current transform.
function _lucPentagram(ctx, R) {
  const star = [];
  for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + i * (Math.PI * 2 / 5); star.push([Math.cos(a) * R, Math.sin(a) * R]); }
  const order = [0, 2, 4, 1, 3, 0];
  ctx.beginPath();
  for (let k = 0; k < order.length; k++) { const p = star[order[k]]; if (k === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
}
function _lucDrawSigil(ctx, cx, cy, R, t, glow) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.rotate(t * 0.06);
  // concentric rings
  for (const rr of [R, R * 0.82]) {
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(150,16,12,${0.10 + glow * 0.16})`; ctx.lineWidth = 11; ctx.stroke();
    ctx.strokeStyle = `rgba(255,70,40,${0.26 + glow * 0.4})`;  ctx.lineWidth = 1.6; ctx.stroke();
  }
  // pentagram
  _lucPentagram(ctx, R * 0.82);
  ctx.strokeStyle = `rgba(160,18,12,${0.14 + glow * 0.2})`; ctx.lineWidth = 9; ctx.stroke();
  ctx.strokeStyle = `rgba(255,84,46,${0.32 + glow * 0.5})`; ctx.lineWidth = 2; ctx.stroke();
  // counter-rotating rune ring
  ctx.rotate(-t * 0.16);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.max(12, R * 0.075)}px "Times New Roman", serif`;
  const runeN = 12, rr = R * 0.91;
  for (let i = 0; i < runeN; i++) {
    const a = i * (Math.PI * 2 / runeN);
    ctx.fillStyle = `rgba(220,40,28,${0.22 + glow * 0.32})`;
    ctx.fillText(_LUCIFER_RUNES[i % _LUCIFER_RUNES.length], Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.restore();
}
function _lucDrawHellfire(canvas, ctx, W, H, t, pulse) {
  ctx.globalCompositeOperation = 'lighter';
  const baseH = H * 0.26;
  if (!canvas._lucFlame) {
    const g = ctx.createLinearGradient(0, H, 0, H - baseH * 1.4);
    g.addColorStop(0, 'rgba(255,232,150,0.9)');
    g.addColorStop(0.25, 'rgba(255,140,30,0.72)');
    g.addColorStop(0.6, 'rgba(200,30,15,0.42)');
    g.addColorStop(1, 'rgba(80,8,8,0)');
    canvas._lucFlame = g;
  }
  ctx.fillStyle = canvas._lucFlame;
  const step = Math.max(8, W / 80);
  for (let layer = 0; layer < 3; layer++) {
    const amp = 18 + layer * 14, spd = 1.2 + layer * 0.5;
    const h = baseH * (0.6 + layer * 0.28) * (0.92 + pulse * 0.16);
    ctx.globalAlpha = 0.5 - layer * 0.12;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += step) {
      const y = H - h + Math.sin(x * 0.012 + t * spd + layer) * amp
                      + Math.sin(x * 0.031 - t * spd * 1.7 + layer * 2) * amp * 0.5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function _lucDrawBolt(canvas, ctx, W, H, t) {
  let b = canvas._lucBolt;
  if (!b || t < b.born) { canvas._lucBolt = b = { next: t + 1.5 + Math.random() * 3, born: -99, dur: 0.4, segs: null }; }
  if (t > b.next) {
    b.born = t; b.dur = 0.32 + Math.random() * 0.3; b.next = t + 2.5 + Math.random() * 4.5;
    const bx = W * (0.12 + Math.random() * 0.76);
    const segs = [[bx, -10]]; let x = bx, y = -10;
    while (y < H + 20) { y += 28 + Math.random() * 55; x += (Math.random() - 0.5) * 130; segs.push([x, y]); }
    b.segs = segs;
  }
  const age = t - b.born;
  if (age > b.dur || !b.segs) return;
  const a = 1 - age / b.dur;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(b.segs[0][0], b.segs[0][1]);
  for (let i = 1; i < b.segs.length; i++) ctx.lineTo(b.segs[i][0], b.segs[i][1]);
  ctx.strokeStyle = `rgba(180,22,15,${a * 0.5})`; ctx.lineWidth = 7; ctx.stroke();
  ctx.strokeStyle = `rgba(255,150,70,${a})`;     ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = `rgba(120,15,10,${a * 0.07})`; ctx.fillRect(0, 0, W, H);
}

function _drawLuciferPattern(canvas, ctx, W, H, t) {
  const fresh = _drawLuciferPattern._lt === undefined;   // (re)entry — clock t just reset to 0
  if (!fresh && t - _drawLuciferPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawLuciferPattern._lt, 0.05);
  _drawLuciferPattern._lt = t;
  // The bolt stores absolute-time fields (born/next); since startBgAnim resets
  // t to 0 on every entry, stale values would make `age` hugely negative and
  // freeze a full-screen flash on screen. Drop it so it reschedules cleanly.
  if (fresh) canvas._lucBolt = null;

  if (canvas._lucW !== W || canvas._lucH !== H) {
    canvas._lucW = W; canvas._lucH = H;
    canvas._lucEmbers = null; canvas._lucRunes = null; canvas._lucVign = null;
    canvas._lucCore = null; canvas._lucFlame = null;
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.5);

  // 1 ── Abyss base
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = '#0a0204'; ctx.fillRect(0, 0, W, H);

  // bottom hell-glow
  if (!canvas._lucCore) {
    const g = ctx.createRadialGradient(W / 2, H * 1.05, H * 0.1, W / 2, H * 1.05, H * 1.1);
    g.addColorStop(0, 'rgba(150,18,10,0.85)');
    g.addColorStop(0.4, 'rgba(80,8,6,0.5)');
    g.addColorStop(1, 'rgba(10,2,4,0)');
    canvas._lucCore = g;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55 + pulse * 0.4; ctx.fillStyle = canvas._lucCore; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // 2 ── Giant rotating pentagram sigil
  _lucDrawSigil(ctx, W / 2, H * 0.42, Math.min(W, H) * 0.34, t, 0.4 + pulse * 0.5);

  // 3 ── Floating runes
  if (!canvas._lucRunes) canvas._lucRunes = Array.from({ length: 14 }, () => _lucNewRune(W, H, true));
  ctx.globalCompositeOperation = 'lighter';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const r of canvas._lucRunes) {
    r.y -= r.vy * dt; r.rot += r.vr * dt;
    if (r.y < -30) Object.assign(r, _lucNewRune(W, H, false));
    const fl = 0.35 + 0.4 * Math.sin(t * r.pf + r.ph) + 0.25 * Math.sin(t * 0.7 + r.ph);
    const a = Math.max(0, fl) * r.a;
    if (a < 0.02) continue;
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
    ctx.font = `${r.sz}px "Times New Roman", serif`;
    ctx.fillStyle = `rgba(${(200 + a * 40) | 0},${(38 + a * 30) | 0},28,${a})`;
    ctx.fillText(r.ch, 0, 0); ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 4 ── Hellfire at the bottom
  _lucDrawHellfire(canvas, ctx, W, H, t, pulse);

  // 5 ── Rising embers (cached sprite, additive)
  if (!canvas._lucEmbers) canvas._lucEmbers = Array.from({ length: 70 }, () => _lucNewEmber(W, H, true));
  ctx.globalCompositeOperation = 'lighter';
  const _spr = _lucEmberSprite();
  for (const e of canvas._lucEmbers) {
    e.y -= e.vy * dt; e.x += Math.sin(t * e.sw + e.ph) * e.sa * dt;
    e.flick = 0.5 + 0.5 * Math.sin(t * e.ff + e.ph);
    if (e.y < -10) Object.assign(e, _lucNewEmber(W, H, false));
    ctx.globalAlpha = Math.min(1, e.flick * e.a);
    const d = e.r * 3.2;
    ctx.drawImage(_spr, e.x - d / 2, e.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 6 ── Molten crack / lightning
  _lucDrawBolt(canvas, ctx, W, H, t);

  // 7 ── Vignette
  if (!canvas._lucVign) {
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.2, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.7, 'rgba(8,0,2,0.4)');
    vg.addColorStop(1, 'rgba(0,0,0,0.9)');
    canvas._lucVign = vg;
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = canvas._lucVign; ctx.fillRect(0, 0, W, H);
}

// ── Hellfire cursor overlay ──
function _luciferMouseMove(e) { _luciferTargX = e.clientX; _luciferTargY = e.clientY; }
function _luciferClick() {
  _luciferFlareT = 1.0;
  _luciferRings.push({ x: _luciferX, y: _luciferY, r: 8, life: 1 });
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, s = 90 + Math.random() * 250;
    _luciferEmbers.push({ x: _luciferX, y: _luciferY, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 70,
      life: 1, r: 2 + Math.random() * 4, burst: true });
  }
}
function _drawLuciferOverlay(canvas, ctx, W, H, t) {
  if (_drawLuciferOverlay._lt !== undefined && t - _drawLuciferOverlay._lt < 0.033) return;
  const dt = _drawLuciferOverlay._lt === undefined ? 0.016 : Math.min(t - _drawLuciferOverlay._lt, 0.05);
  _drawLuciferOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);

  const SPRING = 120, DAMP = 14;
  _luciferVX += ((_luciferTargX - _luciferX) * SPRING - _luciferVX * DAMP) * dt;
  _luciferVY += ((_luciferTargY - _luciferY) * SPRING - _luciferVY * DAMP) * dt;
  _luciferX += _luciferVX * dt; _luciferY += _luciferVY * dt;
  _luciferFlareT = Math.max(0, _luciferFlareT - dt * 2.2);
  const spd = Math.hypot(_luciferVX, _luciferVY);

  // trailing embers
  _luciferEmit += dt * (18 + spd * 0.05);
  while (_luciferEmit > 1) {
    _luciferEmit -= 1;
    if (_luciferEmbers.length > 360) break;
    const a = Math.random() * Math.PI * 2, s = 10 + Math.random() * 40;
    _luciferEmbers.push({ x: _luciferX + (Math.random() - 0.5) * 10, y: _luciferY + (Math.random() - 0.5) * 10,
      vx: Math.cos(a) * s - _luciferVX * 0.06, vy: Math.sin(a) * s - 40 - _luciferVY * 0.06,
      life: 1, r: 1.5 + Math.random() * 3, burst: false });
  }

  ctx.globalCompositeOperation = 'lighter';
  // shockwave rings
  for (let i = _luciferRings.length - 1; i >= 0; i--) {
    const rg = _luciferRings[i];
    rg.r += 420 * dt; rg.life -= dt * 1.6;
    if (rg.life <= 0) { _luciferRings.splice(i, 1); continue; }
    ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,90,40,${rg.life * 0.5})`; ctx.lineWidth = 3 + rg.life * 4; ctx.stroke();
  }
  // embers (cached sprite)
  const _spr = _lucEmberSprite();
  for (let i = _luciferEmbers.length - 1; i >= 0; i--) {
    const e = _luciferEmbers[i];
    e.x += e.vx * dt; e.y += e.vy * dt; e.vy += (e.burst ? 180 : 60) * dt;
    e.life -= dt * (e.burst ? 1.1 : 1.5);
    if (e.life <= 0) { _luciferEmbers.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, e.life);
    const d = e.r * 4.4;
    ctx.drawImage(_spr, e.x - d / 2, e.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;
  // core flame orb
  const flare = 1 + _luciferFlareT * 1.6;
  const cr = (14 + Math.sin(t * 12) * 2) * flare;
  const cg = ctx.createRadialGradient(_luciferX, _luciferY, 0, _luciferX, _luciferY, cr * 2.4);
  cg.addColorStop(0, 'rgba(255,210,120,0.9)');
  cg.addColorStop(0.35, 'rgba(255,90,30,0.7)');
  cg.addColorStop(1, 'rgba(120,8,8,0)');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(_luciferX, _luciferY, cr * 2.4, 0, Math.PI * 2); ctx.fill();
  // rotating sigil at the cursor
  ctx.save(); ctx.translate(_luciferX, _luciferY); ctx.rotate(t * 0.8);
  ctx.lineJoin = 'round';
  _lucPentagram(ctx, 10 * flare);
  ctx.strokeStyle = `rgba(255,120,60,${0.5 + _luciferFlareT * 0.5})`; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
function _startLuciferOverlay() {
  _stopLuciferOverlay();
  _drawLuciferOverlay._lt = undefined;
  _luciferX = _luciferTargX = window.innerWidth * 0.5;
  _luciferY = _luciferTargY = window.innerHeight * 0.5;
  _luciferVX = _luciferVY = 0; _luciferFlareT = 0; _luciferEmit = 0;
  _luciferEmbers = []; _luciferRings = [];
  window.addEventListener('mousemove', _luciferMouseMove);
  window.addEventListener('click', _luciferClick);
  const cv = document.createElement('canvas');
  cv.id = 'lucifer-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('lucifer-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawLuciferOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _luciferOverlayRafId = requestAnimationFrame(frame);
  }
  _luciferOverlayRafId = requestAnimationFrame(frame);
}
function _stopLuciferOverlay() {
  if (_luciferOverlayRafId) { cancelAnimationFrame(_luciferOverlayRafId); _luciferOverlayRafId = null; }
  window.removeEventListener('mousemove', _luciferMouseMove);
  window.removeEventListener('click', _luciferClick);
  const cv = document.getElementById('lucifer-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// DIVINE — goddess of light. Radiant heaven (background) + light cursor.
// The luminous mirror of Lucifer: grand sun-mandala, ascending glyphs,
// god-rays from above, drifting motes, rare descending sunbeams.
// ════════════════════════════════════════════════════════════════
function _divNewMote(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : H + Math.random() * 40,
    vy: 14 + Math.random() * 55, r: 1.4 + Math.random() * 4, a: 0.4 + Math.random() * 0.6,
    sw: 0.4 + Math.random() * 1.3, sa: 5 + Math.random() * 14, ph: Math.random() * 6.28,
    ff: 2 + Math.random() * 4, flick: 1 };
}
function _divNewGlyph(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : H + 20 + Math.random() * 60,
    vy: 7 + Math.random() * 20, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.5,
    sz: 13 + Math.random() * 24, a: 0.28 + Math.random() * 0.45, pf: 0.6 + Math.random() * 1.5,
    ph: Math.random() * 6.28, ch: _DIVINE_GLYPHS[(Math.random() * _DIVINE_GLYPHS.length) | 0] };
}
// Cached soft light-mote sprite (white-gold radial, additive).
function _divMoteSprite() {
  if (_divMoteSprite._c) return _divMoteSprite._c;
  const s = document.createElement('canvas'); s.width = s.height = 32;
  const g = s.getContext('2d');
  const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,255,250,1)');
  rg.addColorStop(0.4, 'rgba(255,224,150,0.78)');
  rg.addColorStop(1, 'rgba(255,200,90,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  return _divMoteSprite._c = s;
}
// Radiant upward 8-point star path (the holy counterpart to the pentagram).
function _divRadiantStar(ctx, R) {
  const pts = 8;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = -Math.PI / 2 + i * (Math.PI / pts);
    const rr = (i % 2 === 0) ? R : R * 0.42;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
function _divDrawHalo(ctx, cx, cy, R, t, glow) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // radiant rays (sunburst) — counter to demonic; slow spin
  ctx.save();
  ctx.rotate(-t * 0.05);
  const rays = 24;
  for (let i = 0; i < rays; i++) {
    const a = i * (Math.PI * 2 / rays);
    const len = R * (1.05 + 0.16 * Math.sin(t * 1.2 + i * 0.7));
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.strokeStyle = `rgba(255,228,150,${0.05 + glow * 0.12})`;
    ctx.lineWidth = i % 2 === 0 ? 3 : 1.2;
    ctx.stroke();
  }
  ctx.restore();
  ctx.rotate(t * 0.05);
  // concentric halo rings
  for (const rr of [R, R * 0.82, R * 0.6]) {
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,236,180,${0.08 + glow * 0.14})`; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,240,${0.24 + glow * 0.4})`;  ctx.lineWidth = 1.5; ctx.stroke();
  }
  // central radiant star
  _div4Star(ctx, 0, 0, R * 0.5, t, 0);
  // outline the star with soft light
  ctx.strokeStyle = `rgba(255,226,150,${0.14 + glow * 0.2})`; ctx.lineWidth = 8; ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,245,${0.34 + glow * 0.5})`; ctx.lineWidth = 2; ctx.stroke();

  // subtle cardinal spikes on the outer halo
  const spikeBase = R * 1.03;
  const spikeLen = R * 0.12;
  ctx.strokeStyle = `rgba(255,236,180,${0.12 + glow * 0.18})`; ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(spikeBase, 0); ctx.lineTo(spikeBase + spikeLen, 0);
  ctx.moveTo(-spikeBase, 0); ctx.lineTo(-spikeBase - spikeLen, 0);
  ctx.moveTo(0, spikeBase); ctx.lineTo(0, spikeBase + spikeLen);
  ctx.moveTo(0, -spikeBase); ctx.lineTo(0, -spikeBase - spikeLen);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,245,${0.28 + glow * 0.4})`; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(spikeBase, 0); ctx.lineTo(spikeBase + spikeLen * 0.55, 0);
  ctx.moveTo(-spikeBase, 0); ctx.lineTo(-spikeBase - spikeLen * 0.55, 0);
  ctx.moveTo(0, spikeBase); ctx.lineTo(0, spikeBase + spikeLen * 0.55);
  ctx.moveTo(0, -spikeBase); ctx.lineTo(0, -spikeBase - spikeLen * 0.55);
  ctx.stroke();
  // counter-rotating glyph ring
  ctx.rotate(-t * 0.13);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.max(12, R * 0.07)}px "Times New Roman", serif`;
  const glyphN = 12, gr = R * 0.91;
  for (let i = 0; i < glyphN; i++) {
    const a = i * (Math.PI * 2 / glyphN);
    ctx.fillStyle = `rgba(255,240,190,${0.2 + glow * 0.3})`;
    ctx.fillText(_DIVINE_GLYPHS[i % _DIVINE_GLYPHS.length], Math.cos(a) * gr, Math.sin(a) * gr);
  }
  ctx.restore();
}
// God-rays streaming down from above (the heavenly counter to bottom hellfire).
function _divDrawGodRays(canvas, ctx, W, H, t, pulse, bright) {
  ctx.globalCompositeOperation = 'lighter';
  const topH = H * 0.34;
  if (!canvas._divRay) {
    const g = ctx.createLinearGradient(0, 0, 0, topH * 1.4);
    g.addColorStop(0, 'rgba(255,248,220,0.62)');
    g.addColorStop(0.3, 'rgba(255,226,150,0.36)');
    g.addColorStop(0.7, 'rgba(255,208,120,0.16)');
    g.addColorStop(1, 'rgba(255,200,90,0)');
    canvas._divRay = g;
  }
  ctx.fillStyle = canvas._divRay;
  const step = Math.max(8, W / 80);
  for (let layer = 0; layer < 3; layer++) {
    const amp = 18 + layer * 14, spd = 1.0 + layer * 0.45;
    const h = topH * (0.6 + layer * 0.28) * (0.92 + pulse * 0.16);
    ctx.globalAlpha = (0.3 - layer * 0.08) * bright;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += step) {
      const y = h + Math.sin(x * 0.012 + t * spd + layer) * amp
                  + Math.sin(x * 0.031 - t * spd * 1.6 + layer * 2) * amp * 0.5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
// Rare descending sunbeam (the radiant counter to the molten lightning bolt).
function _divDrawBeam(canvas, ctx, W, H, t) {
  let b = canvas._divBeam;
  if (!b || t < b.born) { canvas._divBeam = b = { next: t + 1.8 + Math.random() * 3, born: -99, dur: 0.9, x: 0, w: 0 }; }
  if (t > b.next) {
    b.born = t; b.dur = 0.8 + Math.random() * 0.7; b.next = t + 3.5 + Math.random() * 5;
    b.x = W * (0.15 + Math.random() * 0.7); b.w = 60 + Math.random() * 90;
  }
  const age = t - b.born;
  if (age > b.dur) return;
  const env = Math.sin((age / b.dur) * Math.PI);   // fade in/out
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(255,250,225,${env * 0.5})`);
  g.addColorStop(0.5, `rgba(255,232,160,${env * 0.22})`);
  g.addColorStop(1, 'rgba(255,210,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(b.x - b.w * 0.25, 0);
  ctx.lineTo(b.x + b.w * 0.25, 0);
  ctx.lineTo(b.x + b.w, H);
  ctx.lineTo(b.x - b.w, H);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(255,248,220,${env * 0.05})`; ctx.fillRect(0, 0, W, H);
}

// ── Her unique blessing: glowing feathers of light that descend slowly,
// fluttering and turning, fading in from above and dissolving near the floor. ──
function _divFeatherSprite() {
  if (_divFeatherSprite._c) return _divFeatherSprite._c;
  const s = document.createElement('canvas'); s.width = 48; s.height = 100;
  const g = s.getContext('2d');
  g.translate(24, 9);
  const len = 82, wid = 12.5;
  g.shadowColor = 'rgba(255,236,170,0.9)'; g.shadowBlur = 9;
  const grd = g.createLinearGradient(0, 0, 0, len);
  grd.addColorStop(0, 'rgba(255,255,250,0.95)');
  grd.addColorStop(0.5, 'rgba(255,238,182,0.85)');
  grd.addColorStop(1, 'rgba(255,214,120,0.5)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(wid, len * 0.3, wid, len * 0.78, 0, len);
  g.bezierCurveTo(-wid, len * 0.78, -wid, len * 0.3, 0, 0);
  g.closePath(); g.fill();
  g.shadowBlur = 0;
  // central shaft
  g.strokeStyle = 'rgba(255,248,222,0.9)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(0, 2); g.lineTo(0, len - 2); g.stroke();
  // barbs
  g.strokeStyle = 'rgba(255,240,190,0.42)'; g.lineWidth = 0.7;
  for (let i = 1; i <= 8; i++) {
    const yy = len * (i / 9);
    const bw = wid * (1 - Math.abs(i / 9 - 0.4)) * 0.92;
    g.beginPath(); g.moveTo(0, yy); g.lineTo(-bw, yy - 6); g.stroke();
    g.beginPath(); g.moveTo(0, yy); g.lineTo(bw, yy - 6); g.stroke();
  }
  return _divFeatherSprite._c = s;
}
function _divNewFeather(W, H) {
  return { x: Math.random() * W, y: -50 - Math.random() * 140,
    vy: 15 + Math.random() * 20, sway: 16 + Math.random() * 26, sf: 0.45 + Math.random() * 0.7,
    ph: Math.random() * 6.28, rot: (Math.random() - 0.5) * 0.7, vr: (Math.random() - 0.5) * 0.45,
    sz: 0.5 + Math.random() * 0.5, a: 0.5 + Math.random() * 0.4 };
}

function _drawDivinePattern(canvas, ctx, W, H, t) {
  const fresh = _drawDivinePattern._lt === undefined;
  if (!fresh && t - _drawDivinePattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawDivinePattern._lt, 0.05);
  _drawDivinePattern._lt = t;
  // beam stores absolute-time fields; drop on re-entry so it reschedules cleanly.
  if (fresh) canvas._divBeam = null;

  // The pattern canvas is an absolutely-positioned sibling inside the scrolling
  // #content column, so by default it only covers the first viewport and leaves
  // a dark gap below the fold. Pin it FIXED to the #content rect every frame so
  // her radiance always fills the visible area as you scroll. (Reset in the
  // divine-ui chrome else-branch when leaving the character.)
  const _ct = document.getElementById('content');
  if (_ct) {
    const r = _ct.getBoundingClientRect();
    const cw = Math.max(1, Math.round(r.width)), ch = Math.max(1, Math.round(r.height));
    if (canvas.style.position !== 'fixed') canvas.style.position = 'fixed';
    canvas.style.left = r.left + 'px';
    canvas.style.top = r.top + 'px';
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  }
  W = canvas.width; H = canvas.height;

  if (canvas._divW !== W || canvas._divH !== H) {
    canvas._divW = W; canvas._divH = H;
    canvas._divMotes = null; canvas._divGlyphs = null; canvas._divVign = null;
    canvas._divCore = null; canvas._divRay = null;
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.4);
  // Slow, gentle breathing of overall brightness — she swells brighter and
  // softer over ~13s rather than blazing at a constant blinding white.
  const bright = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.48));

  // 1 ── Heaven base (warm, luminous — but not blinding white)
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (!canvas._divBase) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#f3e8cd');
    g.addColorStop(0.45, '#ecdcb6');
    g.addColorStop(1, '#e2cfa1');
    canvas._divBase = g;
  }
  ctx.fillStyle = canvas._divBase; ctx.fillRect(0, 0, W, H);

  // top heaven-glow (light descends from above), softly pulsing
  if (!canvas._divCore) {
    const g = ctx.createRadialGradient(W / 2, -H * 0.05, H * 0.1, W / 2, -H * 0.05, H * 1.1);
    g.addColorStop(0, 'rgba(255,250,230,0.82)');
    g.addColorStop(0.4, 'rgba(255,234,175,0.46)');
    g.addColorStop(1, 'rgba(255,224,150,0)');
    canvas._divCore = g;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (0.26 + pulse * 0.16) * bright; ctx.fillStyle = canvas._divCore; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // 2 ── Giant rotating sun-mandala halo
  _divDrawHalo(ctx, W / 2, H * 0.42, Math.min(W, H) * 0.34, t, (0.3 + pulse * 0.4) * bright);

  // 3 ── Ascending light-glyphs
  if (!canvas._divGlyphs) canvas._divGlyphs = Array.from({ length: 14 }, () => _divNewGlyph(W, H, true));
  ctx.globalCompositeOperation = 'lighter';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const r of canvas._divGlyphs) {
    r.y -= r.vy * dt; r.rot += r.vr * dt;
    if (r.y < -30) Object.assign(r, _divNewGlyph(W, H, false));
    const fl = 0.35 + 0.4 * Math.sin(t * r.pf + r.ph) + 0.25 * Math.sin(t * 0.7 + r.ph);
    const a = Math.max(0, fl) * r.a * bright;
    if (a < 0.02) continue;
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
    ctx.font = `${r.sz}px "Times New Roman", serif`;
    ctx.fillStyle = `rgba(255,${(238 - a * 20) | 0},${(180 - a * 40) | 0},${a})`;
    ctx.fillText(r.ch, 0, 0); ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 4 ── God-rays from above
  _divDrawGodRays(canvas, ctx, W, H, t, pulse, bright);

  // 5 ── Drifting motes (cached sprite, additive)
  if (!canvas._divMotes) canvas._divMotes = Array.from({ length: 70 }, () => _divNewMote(W, H, true));
  ctx.globalCompositeOperation = 'lighter';
  const _spr = _divMoteSprite();
  for (const e of canvas._divMotes) {
    e.y -= e.vy * dt; e.x += Math.sin(t * e.sw + e.ph) * e.sa * dt;
    e.flick = 0.5 + 0.5 * Math.sin(t * e.ff + e.ph);
    if (e.y < -10) Object.assign(e, _divNewMote(W, H, false));
    ctx.globalAlpha = Math.min(1, e.flick * e.a * bright);
    const d = e.r * 3.2;
    ctx.drawImage(_spr, e.x - d / 2, e.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 6 ── Rare descending sunbeam
  _divDrawBeam(canvas, ctx, W, H, t);

  // 6.5 ── Descending feathers of light — her unique blessing
  if (!canvas._divFeathers) { canvas._divFeathers = []; canvas._divFeatherEmit = 0.8; }
  canvas._divFeatherEmit -= dt;
  if (canvas._divFeatherEmit <= 0 && canvas._divFeathers.length < 6) {
    canvas._divFeathers.push(_divNewFeather(W, H));
    canvas._divFeatherEmit = 2.2 + Math.random() * 2.8;
  }
  ctx.globalCompositeOperation = 'lighter';
  const _fsp = _divFeatherSprite();
  for (let i = canvas._divFeathers.length - 1; i >= 0; i--) {
    const f = canvas._divFeathers[i];
    f.y += f.vy * dt;
    f.x += Math.sin(t * f.sf + f.ph) * f.sway * dt;
    f.rot += f.vr * dt + Math.sin(t * f.sf * 1.3 + f.ph) * 0.006;   // gentle flutter-tilt
    if (f.y > H + 90) { canvas._divFeathers.splice(i, 1); continue; }
    let fade = 1;
    if (f.y < 30) fade = Math.max(0, (f.y + 40) / 70);              // fade in from above
    if (f.y > H - 120) fade = Math.min(fade, Math.max(0, (H + 90 - f.y) / 210));  // dissolve near floor
    const a = f.a * fade * (0.82 + 0.18 * Math.sin(t * 2 + f.ph)) * bright;
    if (a <= 0.01) continue;
    ctx.globalAlpha = Math.min(1, a);
    ctx.save();
    ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    const w = 48 * f.sz, h = 100 * f.sz;
    ctx.drawImage(_fsp, -w / 2, -h * 0.12, w, h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 7 ── Soft bright vignette (warms edges without darkening to black)
  if (!canvas._divVign) {
    const vg = ctx.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.2, W / 2, H * 0.5, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(255,255,255,0)');
    vg.addColorStop(0.6, 'rgba(210,160,80,0.12)');
    vg.addColorStop(1, 'rgba(150,100,45,0.42)');
    canvas._divVign = vg;
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = canvas._divVign; ctx.fillRect(0, 0, W, H);
}

// ── Radiant light cursor overlay ──
function _divineMouseMove(e) { _divineTargX = e.clientX; _divineTargY = e.clientY; }
function _divineClick() {
  _divineFlareT = 1.0;
  _divineRings.push({ x: _divineX, y: _divineY, r: 8, life: 1 });
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, s = 90 + Math.random() * 250;
    _divineMotes.push({ x: _divineX, y: _divineY, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 1, r: 2 + Math.random() * 4, burst: true });
  }
}
// A twinkling 4-point sparkle (the classic "shimmy" star) that pulses in size
// and brightness over time.
function _div4Star(ctx, cx, cy, R, t, ph) {
  const tw = 0.55 + 0.45 * Math.sin(t * 4.5 + ph);   // 0.1 → 1.0 twinkle
  const r = R * (0.62 + 0.38 * tw);
  const inner = r * 0.16;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(255,248,212,0.95)';
  ctx.shadowBlur = 3 + 6 * tw;
  ctx.fillStyle = `rgba(255,253,240,${0.65 + 0.35 * tw})`;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const a2 = a + Math.PI / 4;
    const ax = Math.cos(a) * r, ay = Math.sin(a) * r;
    const bx = Math.cos(a2) * inner, by = Math.sin(a2) * inner;
    if (i === 0) ctx.moveTo(ax, ay); else ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// Her sword IS the cursor — a white-and-gold blade, golden winged hilt.
// Drawn with the blade TIP at the hotspot (x,y), pointing up-left like a
// pointer; the ornate hilt + fluttering wings trail down-right. `lean` tilts
// it slightly with cursor motion so it feels alive.
function _divDrawSword(ctx, x, y, t, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.72 + lean);     // tip at hotspot, blade points up-left
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  const guardY = 36;            // where blade meets the cross-guard

  // ── BLADE (tip at origin → guard), white core with gold edge + fuller ──
  ctx.shadowColor = 'rgba(255,238,170,0.9)'; ctx.shadowBlur = 7;
  const bw = 4.3;
  const bg = ctx.createLinearGradient(0, 0, 0, guardY);
  bg.addColorStop(0, 'rgba(255,255,255,0.98)');
  bg.addColorStop(0.5, '#fff8e6');
  bg.addColorStop(1, '#ffeec0');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(bw, guardY - 5);
  ctx.lineTo(bw * 0.55, guardY);
  ctx.lineTo(-bw * 0.55, guardY);
  ctx.lineTo(-bw, guardY - 5);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#e3b246'; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.strokeStyle = 'rgba(214,176,86,0.6)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, guardY - 4); ctx.stroke();

  // ── WINGS at the guard — little white feathers that flutter ──
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.translate(dir * 5, guardY - 1);
    const flap = Math.sin(t * 5 + (dir > 0 ? 0 : 0.8)) * 0.16;
    ctx.rotate(dir * (0.55 + flap));
    ctx.shadowColor = 'rgba(255,244,210,0.85)'; ctx.shadowBlur = 5;
    for (let k = 0; k < 3; k++) {
      const fl = 10 - k * 2.4;
      ctx.fillStyle = k === 0 ? 'rgba(255,255,255,0.97)' : 'rgba(255,250,235,0.9)';
      ctx.beginPath();
      ctx.moveTo(0, k * 2.3);
      ctx.quadraticCurveTo(fl * 0.7, -fl * 0.35, fl, k * 1.4 + 1);
      ctx.quadraticCurveTo(fl * 0.6, k * 2.6 + 3, 0, k * 2.3 + 3.2);
      ctx.closePath(); ctx.fill();
    }
    // gold feather tips
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(230,186,80,0.7)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(2, 1); ctx.lineTo(10, 1.5); ctx.stroke();
    ctx.restore();
  }
  ctx.shadowBlur = 0;

  // ── CROSS-GUARD — golden bar with rounded end-orbs ──
  ctx.fillStyle = '#f3c655'; ctx.strokeStyle = '#9c6f1d'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.rect(-10.5, guardY, 21, 4.2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd96b';
  ctx.beginPath(); ctx.arc(-10.5, guardY + 2, 2.2, 0, 6.28); ctx.arc(10.5, guardY + 2, 2.2, 0, 6.28); ctx.fill();
  ctx.strokeStyle = '#9c6f1d'; ctx.lineWidth = 0.6; ctx.stroke();

  // ── GRIP — wrapped golden handle ──
  const gripTop = guardY + 4.2, gripLen = 12;
  ctx.fillStyle = '#cda43d';
  ctx.beginPath(); ctx.rect(-2.1, gripTop, 4.2, gripLen); ctx.fill();
  ctx.strokeStyle = '#86601a'; ctx.lineWidth = 0.6;
  for (let g = 0; g < 4; g++) { ctx.beginPath(); ctx.moveTo(-2.1, gripTop + 1.5 + g * 2.7); ctx.lineTo(2.1, gripTop + 0.5 + g * 2.7); ctx.stroke(); }

  // ── POMMEL — golden orb with a bright gem ──
  const py = gripTop + gripLen + 2.4;
  ctx.fillStyle = '#ffd96b'; ctx.strokeStyle = '#9c6f1d'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(0, py, 3.1, 0, 6.28); ctx.fill(); ctx.stroke();
  ctx.shadowColor = 'rgba(255,248,220,0.9)'; ctx.shadowBlur = 4;
  ctx.fillStyle = 'rgba(255,252,235,0.95)';
  ctx.beginPath(); ctx.arc(0, py, 1.3, 0, 6.28); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

function _drawDivineOverlay(canvas, ctx, W, H, t) {
  if (_drawDivineOverlay._lt !== undefined && t - _drawDivineOverlay._lt < 0.033) return;
  const dt = _drawDivineOverlay._lt === undefined ? 0.016 : Math.min(t - _drawDivineOverlay._lt, 0.05);
  _drawDivineOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);

  const SPRING = 120, DAMP = 14;
  _divineVX += ((_divineTargX - _divineX) * SPRING - _divineVX * DAMP) * dt;
  _divineVY += ((_divineTargY - _divineY) * SPRING - _divineVY * DAMP) * dt;
  _divineX += _divineVX * dt; _divineY += _divineVY * dt;
  _divineFlareT = Math.max(0, _divineFlareT - dt * 2.2);
  const spd = Math.hypot(_divineVX, _divineVY);

  // trailing motes (gently float, slight upward drift)
  _divineEmit += dt * (18 + spd * 0.05);
  while (_divineEmit > 1) {
    _divineEmit -= 1;
    if (_divineMotes.length > 360) break;
    const a = Math.random() * Math.PI * 2, s = 10 + Math.random() * 40;
    _divineMotes.push({ x: _divineX + (Math.random() - 0.5) * 10, y: _divineY + (Math.random() - 0.5) * 10,
      vx: Math.cos(a) * s - _divineVX * 0.06, vy: Math.sin(a) * s - 16 - _divineVY * 0.06,
      life: 1, r: 1.5 + Math.random() * 3, burst: false });
  }

  ctx.globalCompositeOperation = 'lighter';
  // Gentle halo rings continuously pulse out from her cursor (a soft heartbeat),
  // on top of the bigger bursts from clicks.
  _drawDivineOverlay._ringT = (_drawDivineOverlay._ringT || 0) - dt;
  if (_drawDivineOverlay._ringT <= 0) {
    _divineRings.push({ x: _divineX, y: _divineY, r: 6, life: 1, idle: true });
    _drawDivineOverlay._ringT = 1.5;
  }
  // radiant rings — each one starts DARK and brightens toward white as it
  // expands outward, then softly fades at the end of its life.
  for (let i = _divineRings.length - 1; i >= 0; i--) {
    const rg = _divineRings[i];
    rg.r += (rg.idle ? 150 : 420) * dt; rg.life -= dt * (rg.idle ? 0.9 : 1.6);
    if (rg.life <= 0) { _divineRings.splice(i, 1); continue; }
    const p = 1 - rg.life;                       // 0 = just born/small → 1 = expanded
    const R = (150 + 105 * p) | 0;               // deep gold → …
    const G = (95 + 160 * p) | 0;
    const B = (35 + 205 * p) | 0;                // … → bright white
    const fade = Math.min(1, rg.life * 3);       // soft fade-out near the end
    const al = (0.12 + 0.58 * p) * fade * (rg.idle ? 0.6 : 1);
    ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${R},${G},${B},${al})`;
    ctx.lineWidth = (rg.idle ? 1.5 : 3) + rg.life * (rg.idle ? 2 : 4);
    ctx.stroke();
  }
  // motes (cached sprite)
  const _spr = _divMoteSprite();
  for (let i = _divineMotes.length - 1; i >= 0; i--) {
    const e = _divineMotes[i];
    e.x += e.vx * dt; e.y += e.vy * dt; e.vy += (e.burst ? 150 : 26) * dt;
    e.life -= dt * (e.burst ? 1.1 : 1.5);
    if (e.life <= 0) { _divineMotes.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, e.life);
    const d = e.r * 4.4;
    ctx.drawImage(_spr, e.x - d / 2, e.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;
  // soft radiance pooled at the blade tip (the actual pointer hotspot)
  const flare = 1 + _divineFlareT * 1.6;
  const cr = (9 + Math.sin(t * 10) * 1.5) * flare;
  const cg = ctx.createRadialGradient(_divineTargX, _divineTargY, 0, _divineTargX, _divineTargY, cr * 2.4);
  cg.addColorStop(0, `rgba(255,255,250,${0.55 + _divineFlareT * 0.4})`);
  cg.addColorStop(0.4, 'rgba(255,226,150,0.4)');
  cg.addColorStop(1, 'rgba(255,200,90,0)');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(_divineTargX, _divineTargY, cr * 2.4, 0, Math.PI * 2); ctx.fill();

  // the classic 4-point star shimmy at the center
  _div4Star(ctx, _divineTargX, _divineTargY, 6, t, Math.random() * 6.28);
  // her sword — pinned to the real pointer, tilting with motion
  ctx.globalCompositeOperation = 'source-over';
  const lean = Math.max(-0.45, Math.min(0.45, (_divineTargX - _divineX) * 0.012));
  _divDrawSword(ctx, _divineTargX, _divineTargY, t, lean);
}
function _startDivineOverlay() {
  _stopDivineOverlay();
  _drawDivineOverlay._lt = undefined;
  _divineX = _divineTargX = window.innerWidth * 0.5;
  _divineY = _divineTargY = window.innerHeight * 0.5;
  _divineVX = _divineVY = 0; _divineFlareT = 0; _divineEmit = 0;
  _divineMotes = []; _divineRings = [];
  window.addEventListener('mousemove', _divineMouseMove);
  window.addEventListener('click', _divineClick);
  // hide the default arrow cursor — her sword takes its place
  const _arrow = document.getElementById('cursor');
  if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'divine-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('divine-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawDivineOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _divineOverlayRafId = requestAnimationFrame(frame);
  }
  _divineOverlayRafId = requestAnimationFrame(frame);
}
function _stopDivineOverlay() {
  if (_divineOverlayRafId) { cancelAnimationFrame(_divineOverlayRafId); _divineOverlayRafId = null; }
  window.removeEventListener('mousemove', _divineMouseMove);
  window.removeEventListener('click', _divineClick);
  // restore the default arrow cursor
  const _arrow = document.getElementById('cursor');
  if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('divine-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// AETHER — a dark, eerie forest at night. Cached painterly tree trunks
// framing a black void, a misty teal-green floor, drifting fog, glowing
// fireflies / a will-o'-wisp, and rare pale eyes in the dark. The cursor
// is a red targeting crosshair. Character-wide (matches "Aether").
// ════════════════════════════════════════════════════════════════
const _AETHER_RE = /^Aether$/i;
function _isAether(c) { return !!(c && c.name && _AETHER_RE.test(c.name)); }
let _aetherOverlayRafId = null;
let _aetherMX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
let _aetherMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
let _aetherFireT = 0;          // recoil/flash timer (decays after a click)
let _aetherShock = [];         // expanding shockwave rings spawned on click
let _aetherPX = _aetherMX, _aetherPY = _aetherMY;   // smoothed reticle position
let _aetherRing = null;        // the wedding ring on the ground (shootable ragdoll)

// deterministic RNG so cached trunks are stable but each one is unique
function _aetherRng(seed) { let s = (seed >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function _aRGBA(c, a) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
// a bold tapering limb that forks a couple of times → bare branches up top
function _aetherLimb(g, x, y, a, len, w, depth, color, rng) {
  if (depth <= 0 || len < 10) return;
  const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
  const mx = (x + ex) / 2 + (rng() - 0.5) * len * 0.22;
  const my = (y + ey) / 2 + (rng() - 0.5) * len * 0.16;
  g.strokeStyle = color; g.lineWidth = Math.max(1, w); g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, ex, ey); g.stroke();
  for (let i = 0; i < 2; i++) {
    const da = (i === 0 ? -1 : 1) * (0.28 + rng() * 0.3) + (rng() - 0.5) * 0.18;
    _aetherLimb(g, ex, ey, a + da, len * 0.7, w * 0.62, depth - 1, color, rng);
  }
  if (depth > 1 && rng() < 0.3) _aetherLimb(g, ex, ey, a + (rng() - 0.5) * 0.6, len * 0.5, w * 0.45, depth - 1, color, rng);
}
// a big SOLID, lit, painterly tree trunk (the kind that frames the scene).
// base/light/dark are [r,g,b]; the trunk gets cylindrical shading + bark streaks.
function _aetherTrunk(g, W, H, o) {
  const rng = _aetherRng(o.seed || 1);
  const topY = -40, baseY = H * 0.80, botExtra = H * 0.16;
  const steps = 12, L = [], R = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const y = topY + (baseY + botExtra - topY) * f;
    const w = o.topW + (o.botW - o.topW) * Math.pow(f, 1.25);
    const wob = Math.sin(f * 5 + (o.seed || 1)) * o.topW * 0.05;
    const cx = o.x + (o.lean || 0) * f + wob;
    const flare = f > 0.78 ? Math.pow((f - 0.78) / 0.22, 2) * o.botW * 0.7 : 0;
    L.push([cx - w / 2 - flare, y]); R.push([cx + w / 2 + flare, y]);
  }
  const p = new Path2D();
  p.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) p.lineTo(L[i][0], L[i][1]);
  for (let i = R.length - 1; i >= 0; i--) p.lineTo(R[i][0], R[i][1]);
  p.closePath();
  g.fillStyle = _aRGBA(o.base, 1); g.fill(p);
  g.save(); g.clip(p);
  // cylindrical shading across the trunk width (dark edge → lit core → dark edge)
  const cg = g.createLinearGradient(o.x - o.botW * 0.85, 0, o.x + o.botW * 0.85, 0);
  cg.addColorStop(0, _aRGBA(o.dark, 1));
  cg.addColorStop(0.34, _aRGBA(o.light, 1));
  cg.addColorStop(0.56, _aRGBA(o.base, 1));
  cg.addColorStop(1, _aRGBA(o.dark, 1));
  g.fillStyle = cg; g.fillRect(o.x - o.botW * 1.3, topY, o.botW * 2.6, H + 90);
  // vertical bark streaks
  for (let i = 0; i < 18; i++) {
    const sx = o.x - o.botW * 0.5 + rng() * o.botW;
    const isLight = rng() < 0.45;
    g.strokeStyle = isLight ? _aRGBA(o.light, 0.08 + rng() * 0.14) : _aRGBA(o.dark, 0.16 + rng() * 0.22);
    g.lineWidth = 1 + rng() * 3.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sx, topY);
    g.bezierCurveTo(sx + (rng() - 0.5) * 16, H * 0.35, sx + (rng() - 0.5) * 16, H * 0.7, sx + (rng() - 0.5) * 12, baseY + botExtra);
    g.stroke();
  }
  // soft top-down light so the canopy end of the trunk is a touch brighter
  const tg = g.createLinearGradient(0, topY, 0, baseY);
  tg.addColorStop(0, _aRGBA(o.light, 0.16)); tg.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.fillStyle = tg; g.fillRect(o.x - o.botW * 1.3, topY, o.botW * 2.6, baseY - topY);
  // subtle blood — a reddish stain bleeding DOWN the bark, tinted into the wood
  if (o.blood) {
    const br = _aetherRng((o.seed || 1) + 99);
    const cx = o.x + (br() - 0.5) * o.botW * 0.18;
    const top = H * 0.30, runMax = H * 0.24;
    g.save();
    g.globalCompositeOperation = 'multiply';   // stains/darkens the bark instead of sitting on top
    // a soft pooled source where the wound starts
    const rg = g.createRadialGradient(cx, top + 8, 1, cx, top + 14, o.botW * 0.42);
    rg.addColorStop(0, 'rgba(120,16,16,0.55)'); rg.addColorStop(1, 'rgba(120,16,16,0)');
    g.fillStyle = rg;
    g.beginPath(); g.ellipse(cx, top + 10, o.botW * 0.34, o.botW * 0.24, 0, 0, 6.2832); g.fill();
    // many thin vertical runs of varying length, tapering to a point
    for (let i = 0; i < 10; i++) {
      const x = cx + (br() - 0.5) * o.botW * 0.55;
      const w = 1.5 + br() * 5;
      const y0 = top + (br() - 0.3) * H * 0.04;
      const len = runMax * (0.25 + br() * 0.75);
      const red = [80 + br() * 70, 10 + br() * 16, 10 + br() * 14];
      g.fillStyle = _aRGBA(red, 0.3 + br() * 0.3);
      g.beginPath();
      g.moveTo(x - w / 2, y0);
      g.lineTo(x + w / 2, y0);
      g.quadraticCurveTo(x + w * 0.2, y0 + len * 0.7, x, y0 + len);
      g.quadraticCurveTo(x - w * 0.2, y0 + len * 0.7, x - w / 2, y0);
      g.closePath(); g.fill();
    }
    g.restore();
  }
  g.restore();
  // bare branches reaching up & out from the top, so it's not just a line
  if (o.branches) {
    const lrng = _aetherRng((o.seed || 1) * 7 + 1);
    const fA = 0.16, ay = topY + (baseY + botExtra - topY) * fA, ax = o.x + (o.lean || 0) * fA;
    const bcol = _aRGBA(o.base, 1), lw = Math.max(3, o.topW * 0.45);
    _aetherLimb(g, ax - o.topW * 0.25, ay, -Math.PI / 2 - 0.6, H * 0.16, lw, 3, bcol, lrng);
    _aetherLimb(g, ax + o.topW * 0.25, ay, -Math.PI / 2 + 0.6, H * 0.16, lw, 3, bcol, lrng);
    _aetherLimb(g, ax, ay - H * 0.05, -Math.PI / 2 + 0.12, H * 0.15, lw * 0.85, 3, bcol, lrng);
  }
}
function _aetherGround(g, W, H) {
  const gy = H * 0.82;
  g.beginPath(); g.moveTo(0, gy);
  for (let x = 0; x <= W; x += W / 10) g.lineTo(x, gy - 14 + Math.sin(x * 0.012) * 10 + Math.random() * 9);
  g.lineTo(W, H); g.lineTo(0, H); g.closePath();
  const grad = g.createLinearGradient(0, gy - 20, 0, H);
  grad.addColorStop(0, '#2c4a3d'); grad.addColorStop(0.5, '#16271f'); grad.addColorStop(1, '#08110c');
  g.fillStyle = grad; g.fill();
  // cool misty highlight skimming the top of the floor
  g.fillStyle = 'rgba(150,190,168,0.07)';
  g.beginPath(); g.moveTo(0, gy);
  for (let x = 0; x <= W; x += W / 10) g.lineTo(x, gy - 14 + Math.sin(x * 0.012) * 10);
  g.lineTo(W, gy + 16); g.lineTo(0, gy + 16); g.closePath(); g.fill();
}
function _aetherBuildForest(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // night base — a touch of cold sky filtering through the canopy at the top
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#10161a'); bg.addColorStop(0.4, '#0a0f11'); bg.addColorStop(1, '#0a0f0c');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // deep black central void (the dark gap between the trees)
  const vd = g.createRadialGradient(W * 0.46, H * 0.42, 10, W * 0.46, H * 0.5, Math.max(W, H) * 0.42);
  vd.addColorStop(0, 'rgba(0,0,0,0.92)'); vd.addColorStop(0.7, 'rgba(0,0,0,0.5)'); vd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = vd; g.fillRect(0, 0, W, H);

  // faint distant trunks for depth (low contrast, behind everything)
  _aetherTrunk(g, W, H, { x: 0.40 * W, topW: 0.05 * W, botW: 0.08 * W, base: [26, 28, 26], light: [40, 42, 38], dark: [12, 14, 12], seed: 61 });
  _aetherTrunk(g, W, H, { x: 0.58 * W, topW: 0.05 * W, botW: 0.09 * W, base: [28, 28, 26], light: [44, 44, 40], dark: [12, 13, 12], seed: 67 });

  // ── big LIT trunks framing the void (left cluster + the prominent right one) ──
  _aetherTrunk(g, W, H, { x: 0.13 * W, topW: 0.085 * W, botW: 0.15 * W, base: [60, 54, 44], light: [104, 92, 70], dark: [22, 19, 13], lean: -W * 0.015, seed: 3, branches: true });
  _aetherTrunk(g, W, H, { x: -0.02 * W, topW: 0.09 * W, botW: 0.14 * W, base: [50, 47, 42], light: [86, 80, 68], dark: [18, 16, 12], lean: W * 0.01, seed: 5, branches: true });
  // the big warm trunk on the right (like the reference) — carries the subtle blood
  _aetherTrunk(g, W, H, { x: 0.74 * W, topW: 0.11 * W, botW: 0.19 * W, base: [66, 50, 40], light: [112, 86, 64], dark: [26, 18, 13], lean: W * 0.025, seed: 7, branches: true, blood: true });
  _aetherTrunk(g, W, H, { x: 0.95 * W, topW: 0.10 * W, botW: 0.16 * W, base: [54, 50, 44], light: [92, 84, 72], dark: [20, 18, 14], lean: 0, seed: 11, branches: true });

  _aetherGround(g, W, H);
  return c;
}

function _drawAetherPattern(canvas, ctx, W, H, t) {
  const fresh = _drawAetherPattern._lt === undefined;
  if (!fresh && t - _drawAetherPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawAetherPattern._lt, 0.05);
  _drawAetherPattern._lt = t;

  if (canvas._aetherBgW !== W || canvas._aetherBgH !== H || !canvas._aetherBg) {
    canvas._aetherBg = _aetherBuildForest(W, H);
    canvas._aetherBgW = W; canvas._aetherBgH = H;
    canvas._aetherFlies = null; canvas._aetherEye = null; canvas._aetherEyeT = 3 + Math.random() * 5;
  }
  ctx.drawImage(canvas._aetherBg, 0, 0);

  // light vignette — just darkens the corners a touch (keeps the side trunks lit)
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.9);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // drifting fog
  for (let i = 0; i < 4; i++) {
    const fx = W * (0.18 + i * 0.22) + Math.sin(t * 0.15 + i * 1.7) * W * 0.12;
    const fy = H * (0.55 + (i % 2) * 0.18);
    const rw = W * 0.34, rh = H * 0.10;
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, rw);
    fg.addColorStop(0, 'rgba(150,180,165,0.07)'); fg.addColorStop(1, 'rgba(150,180,165,0)');
    ctx.save(); ctx.translate(fx, fy); ctx.scale(1, rh / rw);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, rw, 0, 6.2832); ctx.fill(); ctx.restore();
  }

  // fireflies + a pale will-o'-wisp (additive glow)
  if (!canvas._aetherFlies) {
    canvas._aetherFlies = Array.from({ length: 16 }, (_, i) => {
      const wisp = i === 0;
      return {
        bx: Math.random() * W, by: H * (0.18 + Math.random() * 0.6),
        ph: Math.random() * 6.28, sp: 0.15 + Math.random() * 0.45,
        amp: 15 + Math.random() * 55, r: wisp ? 2.3 : 0.7 + Math.random() * 1.5,
        hue: wisp ? 150 : 70 + Math.random() * 70, sat: wisp ? 12 : 85,
      };
    });
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const f of canvas._aetherFlies) {
    const x = f.bx + Math.sin(t * f.sp + f.ph) * f.amp;
    const y = f.by + Math.cos(t * f.sp * 0.7 + f.ph * 1.3) * f.amp * 0.5;
    const tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.6 + f.ph));
    const gg = ctx.createRadialGradient(x, y, 0, x, y, f.r * 5);
    gg.addColorStop(0, `hsla(${f.hue},${f.sat}%,82%,${0.9 * tw})`);
    gg.addColorStop(1, `hsla(${f.hue},${f.sat}%,82%,0)`);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, f.r * 5, 0, 6.2832); ctx.fill();
    ctx.fillStyle = `hsla(${f.hue},${f.sat}%,94%,${tw})`;
    ctx.beginPath(); ctx.arc(x, y, f.r * 0.9, 0, 6.2832); ctx.fill();
  }
  ctx.restore();

  // rare pale eyes opening in the dark
  canvas._aetherEyeT -= dt;
  if (!canvas._aetherEye && canvas._aetherEyeT <= 0) {
    canvas._aetherEye = { x: W * (0.3 + Math.random() * 0.4), y: H * (0.24 + Math.random() * 0.28), life: 0, dur: 3.6 };
  }
  if (canvas._aetherEye) {
    const e = canvas._aetherEye; e.life += dt;
    let a = 1;
    if (e.life < 0.8) a = e.life / 0.8;
    else if (e.life > e.dur - 1) a = Math.max(0, e.dur - e.life);
    if (e.life >= e.dur) { canvas._aetherEye = null; canvas._aetherEyeT = 6 + Math.random() * 9; }
    else {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const dx of [-7, 7]) {
        ctx.fillStyle = `rgba(224,250,236,${a * 0.7})`;
        ctx.beginPath(); ctx.ellipse(e.x + dx, e.y, 3.1, 2.0, 0, 0, 6.2832); ctx.fill();
      }
      ctx.restore();
    }
  }

  // the wedding ring lives on the FOREST layer (so the panels occlude it),
  // in this canvas's pixel space — physics + draw here, not on the overlay
  _aetherUpdateRing(dt, W, H);
  _aetherDrawRing(ctx, t);
}

// ── Red targeting crosshair cursor (lots of moving parts) ──
function _aetherMouseMove(e) { _aetherMX = e.clientX; _aetherMY = e.clientY; }
function _aetherClick() {
  _aetherFireT = 1;                                   // slow recoil settle
  _aetherShock.push({ life: 1 });                    // contracting lock-on ring
  // shooting the ring kicks it flying with a tumble. The ring lives in the
  // forest canvas's pixel space, so convert the mouse into that space first.
  const r = _aetherRing;
  const pc = document.getElementById('pattern-canvas');
  if (r && pc && pc.width) {
    const rc = pc.getBoundingClientRect();
    const mx = (_aetherMX - rc.left) * (pc.width / rc.width);
    const my = (_aetherMY - rc.top) * (pc.height / rc.height);
    const dx = mx - r.x, dy = my - r.y;
    if (dx * dx + dy * dy < 28 * 28) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.1;   // mostly up, some spread
      const spd = 720 + Math.random() * 520;
      r.vx = Math.cos(ang) * spd; r.vy = Math.sin(ang) * spd;
      r.vr = (Math.random() - 0.5) * 36; r.moving = true;
    }
  }
}
// physics in the forest canvas's pixel space: gravity + bounce off its walls /
// ground, with spin & damping. (W,H are the pattern canvas dimensions.)
function _aetherUpdateRing(dt, W, H) {
  const r = _aetherRing; if (!r) return;
  const R = r.R, floorY = H * r.restFy;
  if (!r.moving) { r.x = W * r.restFx; r.y = floorY; return; }   // anchored at rest
  r.vy += 1500 * dt;
  r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt;
  if (r.x < R) { r.x = R; r.vx = Math.abs(r.vx) * 0.6; r.vr *= 0.8; }
  else if (r.x > W - R) { r.x = W - R; r.vx = -Math.abs(r.vx) * 0.6; r.vr *= 0.8; }
  if (r.y < R) { r.y = R; r.vy = Math.abs(r.vy) * 0.6; }
  if (r.y > floorY) {
    r.y = floorY; r.vy = -Math.abs(r.vy) * 0.5; r.vx *= 0.7; r.vr *= 0.6;
    if (Math.abs(r.vy) < 45 && Math.abs(r.vx) < 22) {
      r.moving = false; r.vx = r.vy = r.vr = 0;
      r.restFx = r.x / W; r.restFy = r.y / H;   // stay where it landed (survives resize)
    }
  }
}
function _aetherDrawRing(ctx, t) {
  const r = _aetherRing; if (!r) return;
  const moving = r.moving, a = moving ? 0.95 : 0.55;   // subtle but findable at rest
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(moving ? r.rot * 0.3 : 0.2);
  // squash to fake a tumbling band (edge-on → flat) while flying
  ctx.scale(1, moving ? (0.2 + 0.8 * Math.abs(Math.cos(r.rot))) : 0.45);
  ctx.shadowColor = `rgba(255,214,120,${moving ? 0.6 : 0.4})`; ctx.shadowBlur = moving ? 7 : 5;
  ctx.lineWidth = moving ? 2.4 : 2; ctx.strokeStyle = `rgba(226,188,96,${a})`;
  ctx.beginPath(); ctx.arc(0, 0, r.R, 0, 6.2832); ctx.stroke();
  ctx.lineWidth = moving ? 1.1 : 0.9; ctx.strokeStyle = `rgba(160,120,48,${a * 0.7})`;
  ctx.beginPath(); ctx.arc(0, 0, r.R * 0.66, 0, 6.2832); ctx.stroke();
  // diamond gem — twinkles every so often to catch the eye
  const tw = moving ? 0.95 : 0.4 + 0.6 * Math.pow(Math.abs(Math.sin(t * 1.5)), 4);
  ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = moving ? 8 : 3 + 6 * tw;
  ctx.fillStyle = `rgba(255,255,255,${tw})`;
  ctx.beginPath(); ctx.arc(0, -r.R, moving ? 2.2 : 1.8, 0, 6.2832); ctx.fill();
  ctx.restore();
}
function _drawAetherCrosshair(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const fire = _aetherFireT;
  // recoil: the scope kicks up sharply then slowly settles back on target
  ctx.translate(0, -fire * fire * 8);
  const col = `rgb(255,${(46 + fire * 150) | 0},${(26 + fire * 120) | 0})`;
  ctx.shadowColor = 'rgba(255,40,20,0.85)'; ctx.shadowBlur = 9;
  ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.fillStyle = col;

  const R = 15 * (1 + Math.sin(t * 2.5) * 0.045);    // gentle breathing

  // contracting lock-on ring from a shot — wide, then snaps onto the reticle (slow, tense)
  for (const s of _aetherShock) {
    const p = Math.max(0, s.life);                   // 1 → 0
    const rr = R * 1.05 + p * 80;
    ctx.globalAlpha = 0.55 * p; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.2832); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // main ring
  ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.2832); ctx.stroke();
  // N/E/S/W ticks — the inner gap breathes open & closed
  const gap = R * (0.42 + 0.14 * Math.sin(t * 3));
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2, cx = Math.cos(a), sy = Math.sin(a);
    ctx.beginPath(); ctx.moveTo(cx * gap, sy * gap); ctx.lineTo(cx * (R + 8), sy * (R + 8)); ctx.stroke();
  }
  // center dot
  ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(0, 0, 1.9, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 9;
  // slow idle lock-on pulse (held-breath tension)
  const op = (t * 0.45) % 1;
  ctx.globalAlpha = (1 - op) * 0.4; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(0, 0, R + op * 16, 0, 6.2832); ctx.stroke();
  ctx.globalAlpha = 1;

  // SHOT brackets — snap inward as the recoil settles (only while firing)
  if (fire > 0.01) {
    const spread = R + 10 + fire * 26, bl = 6 + fire * 4;
    ctx.globalAlpha = Math.min(1, fire * 1.4); ctx.lineWidth = 2;
    for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) {
      ctx.beginPath();
      ctx.moveTo(sx * spread - sx * bl, sy * spread);
      ctx.lineTo(sx * spread, sy * spread);
      ctx.lineTo(sx * spread, sy * spread - sy * bl);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function _drawAetherOverlay(canvas, ctx, W, H, t) {
  const fresh = _drawAetherOverlay._lt === undefined;
  if (!fresh && t - _drawAetherOverlay._lt < 0.012) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawAetherOverlay._lt, 0.05);
  _drawAetherOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);
  // smooth the reticle toward the pointer (tiny lag = weighty, "aimed" feel)
  _aetherPX += (_aetherMX - _aetherPX) * Math.min(1, dt * 26);
  _aetherPY += (_aetherMY - _aetherPY) * Math.min(1, dt * 26);
  _aetherFireT = Math.max(0, _aetherFireT - dt * 0.6);   // slow settle (~1.6s)
  for (let i = _aetherShock.length - 1; i >= 0; i--) {
    _aetherShock[i].life -= dt * 0.55;                   // slow contract (~1.8s)
    if (_aetherShock[i].life <= 0) _aetherShock.splice(i, 1);
  }
  // (the wedding ring is drawn on the forest layer in _drawAetherPattern,
  //  so the panels occlude it — not here on the top overlay)
  // faint held-breath sway → tension
  const swX = Math.sin(t * 0.8) * 1.1 + Math.sin(t * 2.1 + 1) * 0.5;
  const swY = Math.cos(t * 0.62) * 0.9 + Math.cos(t * 1.7) * 0.4;
  _drawAetherCrosshair(ctx, _aetherPX + swX, _aetherPY + swY, t);
}
function _startAetherOverlay() {
  _stopAetherOverlay();
  _drawAetherOverlay._lt = undefined;
  _aetherPX = _aetherMX; _aetherPY = _aetherMY; _aetherFireT = 0; _aetherShock = [];
  _aetherRing = { restFx: 0.12, restFy: 0.88, x: 0, y: 0, vx: 0, vy: 0, rot: Math.PI * 0.18, vr: 0, R: 9, moving: false };
  window.addEventListener('mousemove', _aetherMouseMove);
  window.addEventListener('mousedown', _aetherClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'aether-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('aether-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawAetherOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _aetherOverlayRafId = requestAnimationFrame(frame);
  }
  _aetherOverlayRafId = requestAnimationFrame(frame);
}
function _stopAetherOverlay() {
  if (_aetherOverlayRafId) { cancelAnimationFrame(_aetherOverlayRafId); _aetherOverlayRafId = null; }
  window.removeEventListener('mousemove', _aetherMouseMove);
  window.removeEventListener('mousedown', _aetherClick);
  _aetherRing = null;
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('aether-overlay'); if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// CAPPY — the screen is filled with white milk: gooey metaball blobs that
// flow toward the cursor (viscous, sloshing). The cursor is a glowing blue
// Star of David. Character-wide (matches "Cappy").
// ════════════════════════════════════════════════════════════════
const _CAPPY_RE = /^(funtime |nightmare |toy |withered )?cappy$/i;
function _isCappy(c) { return !!(c && c.name && _CAPPY_RE.test(c.name)); }
// each Cappy variant pours a different-coloured milk
function _cappyMilkColor(c) {
  const n = (c && c.name || '').toLowerCase();
  if (n === 'funtime cappy')   return '#ff86c9';   // pink
  if (n === 'nightmare cappy') return '#9aa0a8';   // gray
  if (n === 'toy cappy')       return '#ffe06a';   // yellow
  if (n === 'withered cappy')  return '#3450b0';   // dark blue
  return '#fdfdf6';                                 // plain Cappy: milk white
}
let _cappyOverlayRafId = null;
let _cappyMX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
let _cappyMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
function _cappyMouseMove(e) { _cappyMX = e.clientX; _cappyMY = e.clientY; }

function _drawCappyPattern(canvas, ctx, W, H, t) {
  const fresh = _drawCappyPattern._lt === undefined;
  if (!fresh && t - _drawCappyPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawCappyPattern._lt, 0.05);
  _drawCappyPattern._lt = t;

  // (re)seed the milk blobs, scattered across the whole canvas
  if (!canvas._cappyBlobs || canvas._cappyW !== W || canvas._cappyH !== H) {
    canvas._cappyW = W; canvas._cappyH = H; canvas._cappyOff = null; canvas._cappyLit = null;
    canvas._cappyBlobs = Array.from({ length: 46 }, () => {
      const hx = Math.random() * W, hy = Math.random() * H;
      return { x: hx, y: hy, hx, hy, vx: 0, vy: 0, r: 26 + Math.random() * 52 };
    });
  }
  const blobs = canvas._cappyBlobs;

  // cursor in this canvas's pixel space
  let cx = W * 0.5, cy = H * 0.5;
  const rect = canvas.getBoundingClientRect();
  if (rect.width) { cx = (_cappyMX - rect.left) * (W / rect.width); cy = (_cappyMY - rect.top) * (H / rect.height); }

  // viscous flow: a gentle home spring keeps the milk spread; a strong local
  // pull makes it stream toward the cursor
  const damp = Math.pow(0.88, dt * 60);
  for (const b of blobs) {
    b.vx += (b.hx - b.x) * 1.2 * dt;
    b.vy += (b.hy - b.y) * 1.2 * dt;
    const toX = cx - b.x, toY = cy - b.y, d = Math.hypot(toX, toY) + 1;
    const pull = Math.min(2000, 180000 / d);
    b.vx += (toX / d) * pull * dt;
    b.vy += (toY / d) * pull * dt;
    b.vx *= damp; b.vy *= damp;
    b.x += b.vx * dt; b.y += b.vy * dt;
  }

  // ── metaball render (cheap): the milk is blurry, so draw it at LOW resolution
  //    and upscale. Solid circles + one combined blur+contrast pass = gooey
  //    threshold; the upscale adds free smoothing. ~10x less pixel work. ──
  const scale = Math.min(1, 420 / Math.max(W, H));
  const sw = Math.max(1, Math.round(W * scale)), sh = Math.max(1, Math.round(H * scale));
  let off = canvas._cappyOff;
  if (!off || off.width !== sw || off.height !== sh) {
    off = document.createElement('canvas'); off.width = sw; off.height = sh; canvas._cappyOff = off; canvas._cappyLit = null;
  }
  const og = off.getContext('2d');
  og.globalCompositeOperation = 'source-over';
  og.fillStyle = '#08090e'; og.fillRect(0, 0, sw, sh);
  og.fillStyle = '#ffffff';
  for (const b of blobs) { og.beginPath(); og.arc(b.x * scale, b.y * scale, b.r * scale, 0, 6.2832); og.fill(); }

  // one blur+contrast pass → gooey threshold, then tint to this variant's colour
  const milkColor = _cappyMilkColor((typeof characters !== 'undefined') ? characters.find(x => x.id === currentId) : null);
  let lit = canvas._cappyLit;
  if (!lit) { lit = document.createElement('canvas'); lit.width = sw; lit.height = sh; canvas._cappyLit = lit; }
  const lg = lit.getContext('2d');
  lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, sw, sh);
  lg.filter = `blur(${Math.max(3, 13 * scale)}px) contrast(14) brightness(1.04)`;
  lg.drawImage(off, 0, 0);
  lg.filter = 'none';
  lg.globalCompositeOperation = 'multiply'; lg.fillStyle = milkColor; lg.fillRect(0, 0, sw, sh);
  lg.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lit, 0, 0, sw, sh, 0, 0, W, H);

  // soft creamy sheen near the cursor (where the milk pools)
  const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.35);
  sg.addColorStop(0, 'rgba(255,255,255,0.10)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
}

// ── blue Star of David cursor ──
function _drawCappyStar(ctx, x, y, t) {
  const R = 15 * (1 + Math.sin(t * 2) * 0.04);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.6) * 0.06);
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(70,130,255,0.85)'; ctx.shadowBlur = 10;
  // translucent blue fill (both triangles) then bright outline
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = 'rgba(70,130,255,0.16)';
    ctx.strokeStyle = pass === 0 ? '#1b3fae' : '#4d8bff';
    ctx.lineWidth = pass === 0 ? 4 : 2.2;
    for (let tri = 0; tri < 2; tri++) {
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = tri * Math.PI - Math.PI / 2 + i * (2 * Math.PI / 3);
        const px = Math.cos(a) * R, py = Math.sin(a) * R;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (pass === 1) ctx.fill();
      ctx.stroke();
    }
  }
  // bright center
  ctx.shadowBlur = 6; ctx.fillStyle = '#cfe0ff';
  ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, 6.2832); ctx.fill();
  ctx.restore();
}
function _drawCappyOverlay(canvas, ctx, W, H, t) {
  if (_drawCappyOverlay._lt !== undefined && t - _drawCappyOverlay._lt < 0.012) return;
  _drawCappyOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);
  _drawCappyStar(ctx, _cappyMX, _cappyMY, t);
}
function _startCappyOverlay() {
  _stopCappyOverlay();
  _drawCappyOverlay._lt = undefined;
  window.addEventListener('mousemove', _cappyMouseMove);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'cappy-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('cappy-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawCappyOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _cappyOverlayRafId = requestAnimationFrame(frame);
  }
  _cappyOverlayRafId = requestAnimationFrame(frame);
}
function _stopCappyOverlay() {
  if (_cappyOverlayRafId) { cancelAnimationFrame(_cappyOverlayRafId); _cappyOverlayRafId = null; }
  window.removeEventListener('mousemove', _cappyMouseMove);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('cappy-overlay'); if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// ✨DIVA!!!!!!!✨ — an erratic internet VIRUS. Datamosh glitch, corrupted
// rainbow glyph rain, flickering virus pop-ups, RGB-split everything, and a
// chaotic glitching cursor that spews corrupted characters. Pure chaos.
// ════════════════════════════════════════════════════════════════
const _DIVA_RE = /^[✨\s]*diva!+[✨\s]*$/i;
function _isDiva(c) { return !!(c && c.name && _DIVA_RE.test(c.name)); }
let _divaOverlayRafId = null;
let _divaMX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
let _divaMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
let _divaTrail = [];
const _DIVA_GLYPHS = '01█▓▒░@#$%&*<>/\\|=+アイウエオΩ✨♥☣☢★◆01'.split('');
function _divaCh() { return _DIVA_GLYPHS[(Math.random() * _DIVA_GLYPHS.length) | 0]; }
const _DIVA_POP_TXT = ['✨ U WON! ✨', 'WARNING!!!', 'FREE RAM', '( ͡° ͜ʖ ͡°)', 'SYSTEM ERROR', 'CLICK HERE!!', '>:3', '♥ DIVA ♥', 'ERROR 404', '01101001', 'VIRUS :3', 'UwU', 'HIII!!!', 'DOWNLOAD?', 'NICE PC :3', '>w<', '☣ INFECTED ☣', '100% REAL', 'meow >:3', 'i SEE u'];
// red/cyan-split white text — the classic glitch look
function _divaGlitchText(ctx, txt, x, y, jit) {
  ctx.fillStyle = 'rgba(255,0,90,0.85)'; ctx.fillText(txt, x - jit, y);
  ctx.fillStyle = 'rgba(0,255,255,0.85)'; ctx.fillText(txt, x + jit, y);
  ctx.fillStyle = '#fff'; ctx.fillText(txt, x, y);
}

function _drawDivaPattern(canvas, ctx, W, H, t) {
  const fresh = _drawDivaPattern._lt === undefined;
  if (!fresh && t - _drawDivaPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawDivaPattern._lt, 0.05);
  _drawDivaPattern._lt = t;
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  // 1 ── seizure-rainbow base (fast diagonal hue scroll) + darken for contrast
  const g = ctx.createLinearGradient(0, 0, W, H);
  for (let s = 0; s <= 8; s++) g.addColorStop(s / 8, `hsl(${((s / 8) * 420 + t * 140) % 360},95%,55%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.fillRect(0, 0, W, H);

  // 2 ── corrupted rainbow glyph rain (RGB-split heads)
  const colW = 18, lineH = 18;
  if (!canvas._divaCols || canvas._divaW !== W || canvas._divaH !== H) {
    canvas._divaW = W; canvas._divaH = H;
    canvas._divaCols = Array.from({ length: Math.ceil(W / colW) }, (_, i) => ({ x: i * colW + colW / 2, y: Math.random() * H, sp: 70 + Math.random() * 240, hue: Math.random() * 360 }));
  }
  ctx.textAlign = 'center'; ctx.font = `bold ${lineH - 3}px monospace`;
  for (const c of canvas._divaCols) {
    c.y += c.sp * dt;
    if (c.y > H + lineH) { c.y = -Math.random() * H * 0.5; c.sp = 70 + Math.random() * 240; }
    for (let k = 0; k < 6; k++) {
      const yy = c.y - k * lineH; if (yy < -lineH || yy > H) continue;
      if (k === 0) _divaGlitchText(ctx, _divaCh(), c.x, yy, 1.6);
      else { ctx.fillStyle = `hsla(${(c.hue + t * 120 + k * 18) % 360},100%,66%,${(1 - k / 6) * 0.75})`; ctx.fillText(_divaCh(), c.x, yy); }
    }
  }
  ctx.textAlign = 'start';

  // 3 ── DATAMOSH: shove random horizontal strips of the canvas sideways
  for (let k = 0; k < 7; k++) {
    if (Math.random() < 0.6) {
      const sy = Math.random() * H, sh = 4 + Math.random() * 40, dx = (Math.random() - 0.5) * 170;
      try { ctx.drawImage(canvas, 0, sy, W, sh, dx, sy, W, sh); } catch (_) {}
    }
  }

  // 4 ── rainbow glitch blocks (additive)
  ctx.globalCompositeOperation = 'screen';
  for (let k = 0; k < 9; k++) {
    if (Math.random() < 0.5) {
      ctx.fillStyle = `hsla(${Math.random() * 360},100%,60%,0.5)`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 18 + Math.random() * 190, 3 + Math.random() * 26);
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // 5 ── scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

  // 6 ── erratic flickering virus pop-ups
  if (!canvas._divaPops) { canvas._divaPops = []; canvas._divaPopT = 0; }
  canvas._divaPopT -= dt;
  if (canvas._divaPopT <= 0 && canvas._divaPops.length < 7) {
    canvas._divaPopT = 0.25 + Math.random() * 0.8;
    canvas._divaPops.push({ x: Math.random() * W * 0.82, y: Math.random() * H * 0.82, txt: _DIVA_POP_TXT[(Math.random() * _DIVA_POP_TXT.length) | 0], hue: Math.random() * 360, life: 0, max: 0.8 + Math.random() * 2.4 });
  }
  ctx.textAlign = 'start';
  for (let i = canvas._divaPops.length - 1; i >= 0; i--) {
    const p = canvas._divaPops[i]; p.life += dt;
    if (p.life >= p.max) { canvas._divaPops.splice(i, 1); continue; }
    if (Math.random() < 0.06) { p.x += (Math.random() - 0.5) * 34; p.y += (Math.random() - 0.5) * 22; }   // jump
    ctx.save();
    ctx.globalAlpha = Math.random() < 0.12 ? 0.3 : 1;                                                     // flicker
    ctx.font = 'bold 13px monospace';
    const w = ctx.measureText(p.txt).width + 22, h = 30, hue = (p.hue + t * 120) % 360;
    ctx.fillStyle = 'rgba(18,6,28,0.92)'; ctx.fillRect(p.x, p.y, w, h);
    ctx.strokeStyle = `hsl(${hue},100%,65%)`; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, w, h);
    ctx.fillStyle = `hsl(${hue},100%,60%)`; ctx.fillRect(p.x, p.y, w, 9);              // title bar
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace'; ctx.fillText('✕', p.x + w - 9, p.y + 7);
    ctx.font = 'bold 13px monospace';
    _divaGlitchText(ctx, p.txt, p.x + 9, p.y + 24, 1.6);
    ctx.restore();
  }

  // 7 ── occasional full-screen rainbow flash
  if (Math.random() < 0.02) { ctx.fillStyle = `hsla(${Math.random() * 360},100%,70%,0.22)`; ctx.fillRect(0, 0, W, H); }
}

// ── chaotic glitching cursor ──
function _divaMouseMove(e) { _divaMX = e.clientX; _divaMY = e.clientY; }
function _divaClick() {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * 6.2832, s = 90 + Math.random() * 280;
    _divaTrail.push({ x: _divaMX, y: _divaMY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, ch: _divaCh(), hue: Math.random() * 360, burst: true });
  }
}
function _divaArrow(ctx, x, y, col, ox) {
  ctx.save(); ctx.translate(x + ox, y);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.5, 12.5); ctx.lineTo(7.5, 19); ctx.lineTo(9.5, 18); ctx.lineTo(6.5, 11.5); ctx.lineTo(12, 11.5); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function _drawDivaCursor(canvas, ctx, W, H, t) {
  const fresh = _drawDivaCursor._lt === undefined;
  if (!fresh && t - _drawDivaCursor._lt < 0.016) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawDivaCursor._lt, 0.05);
  _drawDivaCursor._lt = t;
  ctx.clearRect(0, 0, W, H);

  // spew a corrupted glyph as the cursor lives
  if (_divaTrail.length < 320) _divaTrail.push({ x: _divaMX + (Math.random() - 0.5) * 12, y: _divaMY + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50 + 10, life: 1, ch: _divaCh(), hue: Math.random() * 360 });
  ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  for (let i = _divaTrail.length - 1; i >= 0; i--) {
    const p = _divaTrail[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.burst ? 130 : 45) * dt;
    p.life -= dt * (p.burst ? 1.1 : 1.7);
    if (p.life <= 0) { _divaTrail.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, p.life);
    ctx.fillStyle = `hsl(${(p.hue + t * 200) % 360},100%,66%)`;
    ctx.fillText(p.ch, p.x, p.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'start';

  // flickering glitch rectangles around the pointer
  for (let k = 0; k < 4; k++) {
    if (Math.random() < 0.6) { ctx.fillStyle = `hsla(${Math.random() * 360},100%,60%,0.5)`; ctx.fillRect(_divaMX + (Math.random() - 0.5) * 42, _divaMY + (Math.random() - 0.5) * 42, 6 + Math.random() * 24, 3 + Math.random() * 9); }
  }
  // jittery RGB-split arrow
  const jx = (Math.random() - 0.5) * 3.2, jy = (Math.random() - 0.5) * 3.2;
  _divaArrow(ctx, _divaMX + jx, _divaMY + jy, 'rgba(255,0,90,0.9)', -2.2);
  _divaArrow(ctx, _divaMX + jx, _divaMY + jy, 'rgba(0,255,255,0.9)', 2.2);
  _divaArrow(ctx, _divaMX + jx, _divaMY + jy, '#fff', 0);
  // a little sparkle orbiting
  ctx.font = '13px monospace'; ctx.fillStyle = '#fff';
  ctx.fillText('✨', _divaMX + 13 + Math.sin(t * 11) * 4, _divaMY - 9 + Math.cos(t * 9) * 3);
}
function _startDivaOverlay() {
  _stopDivaOverlay();
  _drawDivaCursor._lt = undefined; _divaTrail = [];
  window.addEventListener('mousemove', _divaMouseMove);
  window.addEventListener('click', _divaClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'diva-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('diva-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) { cv2.width = window.innerWidth; cv2.height = window.innerHeight; }
    _drawDivaCursor(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _divaOverlayRafId = requestAnimationFrame(frame);
  }
  _divaOverlayRafId = requestAnimationFrame(frame);
}
function _stopDivaOverlay() {
  if (_divaOverlayRafId) { cancelAnimationFrame(_divaOverlayRafId); _divaOverlayRafId = null; }
  window.removeEventListener('mousemove', _divaMouseMove);
  window.removeEventListener('click', _divaClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('diva-overlay'); if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// EVELYNN — elegant & gothic. A large, beautiful blood moon hangs at the
// middle-top over a deep crimson night: twinkling stars, dark clouds drifting
// across the moon, falling rose petals, a pulsing corona, and rising crimson
// mist. The cursor is a slowly-turning red rose that trails petals.
// ════════════════════════════════════════════════════════════════
const _EVELYNN_RE = /^Evelynn$/i;
function _isEvelynn(c) { return !!(c && c.name && _EVELYNN_RE.test(c.name)); }
let _evelynnOverlayRafId = null;
let _evMX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
let _evMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
let _evTrail = [];

function _evNewPetal(W, H) {
  return { x: Math.random() * W, y: Math.random() * H, vy: 16 + Math.random() * 30, vx: (Math.random() - 0.5) * 16, rot: Math.random() * 6.2832, vr: (Math.random() - 0.5) * 1.6, sz: 4 + Math.random() * 7, sway: Math.random() * 6.2832 };
}
function _evDrawPetal(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  ctx.scale(0.4 + 0.6 * Math.abs(Math.cos(p.rot * 1.3)), 1);   // tumble
  const grd = ctx.createLinearGradient(0, -p.sz, 0, p.sz);
  grd.addColorStop(0, '#e23a3a'); grd.addColorStop(1, '#7e0f14');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(0, -p.sz);
  ctx.bezierCurveTo(p.sz * 0.9, -p.sz * 0.4, p.sz * 0.6, p.sz * 0.8, 0, p.sz);
  ctx.bezierCurveTo(-p.sz * 0.6, p.sz * 0.8, -p.sz * 0.9, -p.sz * 0.4, 0, -p.sz);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(60,6,10,0.5)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(0, -p.sz * 0.8); ctx.lineTo(0, p.sz * 0.8); ctx.stroke();
  ctx.restore();
}
function _evBuildSky(W, H, mx, my, R) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2a0608'); sky.addColorStop(0.4, '#1a0406'); sky.addColorStop(0.75, '#0c0203'); sky.addColorStop(1, '#060102');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const hg = g.createRadialGradient(mx, my, R * 0.5, mx, my, Math.max(W, H) * 0.6);
  hg.addColorStop(0, 'rgba(150,20,18,0.5)'); hg.addColorStop(0.4, 'rgba(90,12,12,0.18)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = hg; g.fillRect(0, 0, W, H);
  // moon disc — coppery blood moon with a glowing refraction limb
  const mg = g.createRadialGradient(mx - R * 0.2, my - R * 0.2, R * 0.05, mx, my, R);
  mg.addColorStop(0, '#f0895a'); mg.addColorStop(0.4, '#d2492a'); mg.addColorStop(0.7, '#9f2218');
  mg.addColorStop(0.92, '#6c0f0f'); mg.addColorStop(1, '#c2381f');
  g.beginPath(); g.arc(mx, my, R, 0, 6.2832); g.fillStyle = mg; g.fill();
  g.save(); g.beginPath(); g.arc(mx, my, R, 0, 6.2832); g.clip();
  const rng = _aetherRng(7771);
  // big soft maria (lunar "seas") — clusters of overlapping dark blobs
  for (let s = 0; s < 5; s++) {
    const a = rng() * 6.2832, rr = rng() * R * 0.6, sx = mx + Math.cos(a) * rr, sy = my + Math.sin(a) * rr;
    const blobs = 4 + (rng() * 4 | 0);
    for (let b = 0; b < blobs; b++) {
      const bx = sx + (rng() - 0.5) * R * 0.45, by = sy + (rng() - 0.5) * R * 0.45, br = R * (0.12 + rng() * 0.22);
      const dg = g.createRadialGradient(bx, by, 0, bx, by, br);
      dg.addColorStop(0, `rgba(48,7,8,${0.18 + rng() * 0.16})`); dg.addColorStop(1, 'rgba(48,7,8,0)');
      g.fillStyle = dg; g.beginPath(); g.arc(bx, by, br, 0, 6.2832); g.fill();
    }
  }
  // craters: dark pit + a bright sunlit rim
  for (let i = 0; i < 20; i++) {
    const a = rng() * 6.2832, rr = rng() * R * 0.9, cx = mx + Math.cos(a) * rr, cy = my + Math.sin(a) * rr, cr = R * (0.02 + rng() * 0.07);
    g.fillStyle = `rgba(38,4,6,${0.15 + rng() * 0.2})`; g.beginPath(); g.arc(cx, cy, cr, 0, 6.2832); g.fill();
    g.strokeStyle = `rgba(255,140,100,${0.08 + rng() * 0.12})`; g.lineWidth = 0.8;
    g.beginPath(); g.arc(cx - cr * 0.16, cy - cr * 0.16, cr, 0, 6.2832); g.stroke();
  }
  // fine surface mottling
  for (let i = 0; i < 240; i++) {
    const a = rng() * 6.2832, rr = Math.sqrt(rng()) * R, cx = mx + Math.cos(a) * rr, cy = my + Math.sin(a) * rr;
    g.fillStyle = `rgba(${rng() < 0.5 ? '255,160,120' : '38,5,8'},${0.04 + rng() * 0.06})`;
    g.fillRect(cx, cy, 1.2, 1.2);
  }
  // soft upper-left highlight, lower-right terminator shadow
  const hl = g.createRadialGradient(mx - R * 0.4, my - R * 0.4, 0, mx - R * 0.4, my - R * 0.4, R * 0.9);
  hl.addColorStop(0, 'rgba(255,180,140,0.16)'); hl.addColorStop(1, 'rgba(255,180,140,0)');
  g.fillStyle = hl; g.fillRect(mx - R, my - R, R * 2, R * 2);
  const tg = g.createRadialGradient(mx + R * 0.5, my + R * 0.5, R * 0.2, mx + R * 0.35, my + R * 0.35, R * 1.5);
  tg.addColorStop(0, 'rgba(10,1,2,0)'); tg.addColorStop(1, 'rgba(6,0,1,0.5)');
  g.fillStyle = tg; g.fillRect(mx - R, my - R, R * 2, R * 2);
  g.restore();
  // glowing limb
  g.strokeStyle = 'rgba(255,80,50,0.5)'; g.lineWidth = Math.max(1.5, R * 0.02);
  g.beginPath(); g.arc(mx, my, R * 0.99, 0, 6.2832); g.stroke();
  return c;
}
function _drawEvelynnPattern(canvas, ctx, W, H, t) {
  const fresh = _drawEvelynnPattern._lt === undefined;
  if (!fresh && t - _drawEvelynnPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawEvelynnPattern._lt, 0.05);
  _drawEvelynnPattern._lt = t;
  const mx = W * 0.5, my = H * 0.24, R = Math.min(W, H) * 0.17;
  if (canvas._evW !== W || canvas._evH !== H || !canvas._evBg) {
    canvas._evW = W; canvas._evH = H;
    canvas._evBg = _evBuildSky(W, H, mx, my, R);
    canvas._evStars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.72, r: 0.4 + Math.random() * 1.4, ph: Math.random() * 6.2832, sp: 0.5 + Math.random() * 1.5 }));
    canvas._evClouds = Array.from({ length: 5 }, () => ({ x: Math.random() * W, y: my + (Math.random() - 0.5) * R * 1.7, w: R * (1.1 + Math.random() * 1.2), h: R * (0.25 + Math.random() * 0.3), sp: 5 + Math.random() * 16, a: 0.16 + Math.random() * 0.22 }));
    canvas._evPetals = Array.from({ length: 26 }, () => _evNewPetal(W, H));
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(canvas._evBg, 0, 0);
  // twinkling crimson-white stars
  ctx.fillStyle = 'rgb(255,200,190)';
  for (const s of canvas._evStars) { ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(t * s.sp + s.ph)); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill(); }
  ctx.globalAlpha = 1;
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.8);
  // ── animated moon SURFACE (clipped to the disc): slow shadow sweep + breathing glow ──
  ctx.save();
  ctx.beginPath(); ctx.arc(mx, my, R, 0, 6.2832); ctx.clip();
  const sh = Math.sin(t * 0.12) * R * 0.55;
  const sg = ctx.createLinearGradient(mx - R + sh, 0, mx + R * 0.3 + sh, 0);
  sg.addColorStop(0, 'rgba(6,0,1,0)'); sg.addColorStop(0.5, 'rgba(6,0,1,0.26)'); sg.addColorStop(1, 'rgba(6,0,1,0)');
  ctx.fillStyle = sg; ctx.fillRect(mx - R, my - R, R * 2, R * 2);
  ctx.globalCompositeOperation = 'lighter';
  const ig = ctx.createRadialGradient(mx - R * 0.2, my - R * 0.2, 0, mx, my, R);
  ig.addColorStop(0, `rgba(255,95,55,${0.06 + pulse * 0.13})`); ig.addColorStop(1, 'rgba(255,95,55,0)');
  ctx.fillStyle = ig; ctx.fillRect(mx - R, my - R, R * 2, R * 2);
  ctx.restore();
  // ── corona + slowly-rotating flickering flare rays (additive) ──
  ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createRadialGradient(mx, my, R * 0.55, mx, my, R * 2.5);
  cg.addColorStop(0, 'rgba(255,50,38,0)'); cg.addColorStop(0.44, 'rgba(255,60,44,0)');
  cg.addColorStop(0.48, `rgba(230,40,30,${0.24 + pulse * 0.18})`); cg.addColorStop(1, 'rgba(120,10,10,0)');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(mx, my, R * 2.5, 0, 6.2832); ctx.fill();
  ctx.save(); ctx.translate(mx, my); ctx.rotate(t * 0.05);
  const rays = 22;
  for (let i = 0; i < rays; i++) {
    const len = R * (0.22 + 0.2 * (0.5 + 0.5 * Math.sin(t * 1.8 + i * 1.3))), wdt = R * 0.045;
    const rg = ctx.createLinearGradient(R * 0.98, 0, R * 0.98 + len, 0);
    rg.addColorStop(0, `rgba(255,70,45,${0.16 + pulse * 0.12})`); rg.addColorStop(1, 'rgba(255,70,45,0)');
    ctx.save(); ctx.rotate(i * (6.2832 / rays)); ctx.fillStyle = rg; ctx.fillRect(R * 0.98, -wdt / 2, len, wdt); ctx.restore();
  }
  // swirling aura wisps
  for (let i = 0; i < 3; i++) {
    const rr = R * (1.14 + i * 0.18), a0 = t * (0.3 + i * 0.12) + i * 2, sweep = 1.2 + 0.6 * Math.sin(t * 0.8 + i);
    ctx.strokeStyle = `rgba(220,40,30,${0.1 + 0.06 * Math.sin(t * 1.2 + i)})`; ctx.lineWidth = R * 0.03;
    ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + sweep); ctx.stroke();
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  // dark clouds drifting across (occlude the moon)
  for (const cl of canvas._evClouds) {
    cl.x += cl.sp * dt; if (cl.x - cl.w > W) cl.x = -cl.w * 1.2;
    const c2 = ctx.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.w);
    c2.addColorStop(0, `rgba(7,1,3,${cl.a})`); c2.addColorStop(1, 'rgba(7,1,3,0)');
    ctx.save(); ctx.translate(cl.x, cl.y); ctx.scale(1, cl.h / cl.w); ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(0, 0, cl.w, 0, 6.2832); ctx.fill(); ctx.restore();
  }
  // falling rose petals
  for (const p of canvas._evPetals) {
    p.x += (p.vx + Math.sin(t * 0.8 + p.sway) * 12) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.y > H + 12) { Object.assign(p, _evNewPetal(W, H)); p.y = -12; }
    _evDrawPetal(ctx, p);
  }
  // rising crimson mist along the bottom
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const fx = W * (0.25 + i * 0.28) + Math.sin(t * 0.2 + i * 2) * W * 0.08, fy = H * 0.92, fr = W * 0.3;
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    fg.addColorStop(0, 'rgba(150,18,16,0.10)'); fg.addColorStop(1, 'rgba(150,18,16,0)');
    ctx.save(); ctx.translate(fx, fy); ctx.scale(1, 0.4); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, fr, 0, 6.2832); ctx.fill(); ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  // occasional crimson shooting star streaking across the sky
  if (!canvas._evShoot && Math.random() < 0.005) {
    canvas._evShoot = { x: W * (0.3 + Math.random() * 0.7), y: Math.random() * H * 0.4, vx: -(220 + Math.random() * 220), vy: 70 + Math.random() * 130, life: 1 };
  }
  if (canvas._evShoot) {
    const ss = canvas._evShoot; ss.x += ss.vx * dt; ss.y += ss.vy * dt; ss.life -= dt * 0.7;
    if (ss.life <= 0 || ss.x < -60 || ss.y > H + 40) canvas._evShoot = null;
    else {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const tx = ss.x - ss.vx * 0.09, ty = ss.y - ss.vy * 0.09;
      const lg = ctx.createLinearGradient(ss.x, ss.y, tx, ty);
      lg.addColorStop(0, `rgba(255,190,170,${ss.life})`); lg.addColorStop(1, 'rgba(255,120,90,0)');
      ctx.strokeStyle = lg; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ss.x, ss.y); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = `rgba(255,210,190,${ss.life})`; ctx.beginPath(); ctx.arc(ss.x, ss.y, 1.8, 0, 6.2832); ctx.fill();
      ctx.restore();
    }
  }
  // soft elegant vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.4, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ── elegant red-rose cursor that trails petals ──
function _evMouseMove(e) { _evMX = e.clientX; _evMY = e.clientY; }
function _evClick() {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * 6.2832, s = 60 + Math.random() * 150;
    _evTrail.push({ x: _evMX, y: _evMY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: Math.random() * 6.2832, vr: (Math.random() - 0.5) * 4, sz: 3 + Math.random() * 5, life: 1, sway: Math.random() * 6.2832 });
  }
}
function _evPetalShape(ctx, len, wid, col) {
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(40,4,8,0.4)'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-wid, -len * 0.5, -wid * 0.55, -len, 0, -len);
  ctx.bezierCurveTo(wid * 0.55, -len, wid, -len * 0.5, 0, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function _evRose(ctx, x, y, R, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.25);
  ctx.shadowColor = 'rgba(200,20,30,0.7)'; ctx.shadowBlur = 10;
  const rings = [
    { n: 6, len: R, wid: R * 0.52, col: '#7e0f14', rot: 0, push: R * 0.16 },
    { n: 5, len: R * 0.74, wid: R * 0.44, col: '#ad1a20', rot: 0.55, push: R * 0.12 },
    { n: 4, len: R * 0.5, wid: R * 0.36, col: '#d83a3a', rot: 1.1, push: R * 0.08 },
  ];
  for (const rg of rings) for (let i = 0; i < rg.n; i++) {
    ctx.save(); ctx.rotate(rg.rot + i * (6.2832 / rg.n)); ctx.translate(0, -rg.push); _evPetalShape(ctx, rg.len, rg.wid, rg.col); ctx.restore();
  }
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.16, 0, 6.2832); ctx.fillStyle = '#4a0608'; ctx.fill();
  ctx.restore();
}
function _drawEvelynnCursor(canvas, ctx, W, H, t) {
  const fresh = _drawEvelynnCursor._lt === undefined;
  if (!fresh && t - _drawEvelynnCursor._lt < 0.016) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawEvelynnCursor._lt, 0.05);
  _drawEvelynnCursor._lt = t;
  ctx.clearRect(0, 0, W, H);
  if (_evTrail.length < 120 && Math.random() < 0.5)
    _evTrail.push({ x: _evMX + (Math.random() - 0.5) * 8, y: _evMY + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 30, vy: 18 + Math.random() * 30, rot: Math.random() * 6.2832, vr: (Math.random() - 0.5) * 2, sz: 3 + Math.random() * 4, life: 1, sway: Math.random() * 6.2832 });
  for (let i = _evTrail.length - 1; i >= 0; i--) {
    const p = _evTrail[i];
    p.x += (p.vx + Math.sin(t * 1.5 + p.sway) * 10) * dt; p.y += p.vy * dt; p.vy += 30 * dt; p.rot += p.vr * dt; p.life -= dt * 0.7;
    if (p.life <= 0) { _evTrail.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, p.life); _evDrawPetal(ctx, p);
  }
  ctx.globalAlpha = 1;
  const gl = ctx.createRadialGradient(_evMX, _evMY, 0, _evMX, _evMY, 26);
  gl.addColorStop(0, 'rgba(220,30,30,0.35)'); gl.addColorStop(1, 'rgba(220,30,30,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(_evMX, _evMY, 26, 0, 6.2832); ctx.fill();
  _evRose(ctx, _evMX, _evMY, 15, t);
}
function _startEvelynnOverlay() {
  _stopEvelynnOverlay();
  _drawEvelynnCursor._lt = undefined; _evTrail = [];
  window.addEventListener('mousemove', _evMouseMove);
  window.addEventListener('click', _evClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'evelynn-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('evelynn-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) { cv2.width = window.innerWidth; cv2.height = window.innerHeight; }
    _drawEvelynnCursor(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _evelynnOverlayRafId = requestAnimationFrame(frame);
  }
  _evelynnOverlayRafId = requestAnimationFrame(frame);
}
function _stopEvelynnOverlay() {
  if (_evelynnOverlayRafId) { cancelAnimationFrame(_evelynnOverlayRafId); _evelynnOverlayRafId = null; }
  window.removeEventListener('mousemove', _evMouseMove);
  window.removeEventListener('click', _evClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('evelynn-overlay'); if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// OLIVER TIMBERWOOD — the (drunk, mysterious) sheriff of the wild west. A dusty
// sunset desert: a low sun, layered mesas, saguaro cacti, a lone silhouette, a
// fence, rolling tumbleweeds, blowing dust, heat-shimmer, and a gentle DRUNKEN
// sway over it all. A white rose blooms in each of the four corners. The cursor
// is a gold sheriff's badge that wobbles drunkenly and kicks up dust.
// ════════════════════════════════════════════════════════════════
const _OLIVER_RE = /^oliver\s+timberwood$/i;
function _isOliver(c) { return !!(c && c.name && _OLIVER_RE.test(c.name)); }
let _oliverOverlayRafId = null;
let _olMX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
let _olMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
let _olX = _olMX, _olY = _olMY, _olDust = [], _olSpark = [];
function _olRR(g, x, y, w, h, r) { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); g.fill(); }
// a proper saguaro — slim trunk + two arms whose elbows connect to it
function _olCactus(g, x, baseY, h, col) {
  g.fillStyle = col;
  const w = Math.max(6, h * 0.11), aw = w * 0.82;   // slimmer trunk + arm thickness
  _olRR(g, x - w / 2, baseY - h, w, h, w / 2);       // trunk (rounded top)
  // left arm: horizontal run INTO the trunk, then bends up at the elbow
  const lY = baseY - h * 0.52, lOut = w * 1.7, lUp = h * 0.4;
  _olRR(g, x - lOut, lY, lOut + w * 0.4, aw, aw / 2);        // horizontal (overlaps trunk)
  _olRR(g, x - lOut, lY - lUp, aw, lUp + aw, aw / 2);        // rises from elbow
  // right arm (a little higher)
  const rY = baseY - h * 0.64, rOut = w * 1.55, rUp = h * 0.34;
  _olRR(g, x - w * 0.4, rY, rOut + w * 0.4, aw, aw / 2);     // horizontal (overlaps trunk)
  _olRR(g, x + rOut - aw, rY - rUp, aw, rUp + aw, aw / 2);   // rises from elbow
}
// flat-topped butte ridge filled down past baseY (so it's solid to the ground)
function _olMesa(g, W, H, baseY, col, seed, height) {
  const rng = _aetherRng(seed); g.fillStyle = col;
  g.beginPath(); g.moveTo(0, H); g.lineTo(0, baseY); let x = 0;
  while (x < W) {
    g.lineTo(x, baseY - height * (0.04 + rng() * 0.1)); x += W * (0.02 + rng() * 0.04);   // rolling base
    if (rng() < 0.5) {
      const bw = W * (0.06 + rng() * 0.13), bh = height * (0.6 + rng() * 0.55);
      g.lineTo(x, baseY - bh * 0.82); g.lineTo(x + bw * 0.1, baseY - bh);
      g.lineTo(x + bw * 0.9, baseY - bh); g.lineTo(x + bw, baseY - bh * 0.82); x += bw;
    }
  }
  g.lineTo(W, baseY); g.lineTo(W, H); g.closePath(); g.fill();
}
// SKY layer (behind the god-rays): gradient, clouds, sun + glow
function _olBuildSky(W, H, horizon) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, horizon + H * 0.05);
  sky.addColorStop(0, '#1b1838'); sky.addColorStop(0.3, '#492845'); sky.addColorStop(0.55, '#8f3c2b');
  sky.addColorStop(0.78, '#d2662a'); sky.addColorStop(0.92, '#f2953a'); sky.addColorStop(1, '#ffd483');
  g.fillStyle = sky; g.fillRect(0, 0, W, horizon + H * 0.05);
  // soft cloud streaks high up
  const rng = _aetherRng(303);
  for (let i = 0; i < 6; i++) {
    const cx = rng() * W, cy = H * (0.08 + rng() * 0.3), cw = W * (0.1 + rng() * 0.18);
    g.save(); g.translate(cx, cy); g.scale(1, 0.16);
    const cg = g.createRadialGradient(0, 0, 0, 0, 0, cw);
    cg.addColorStop(0, `rgba(255,200,150,${0.05 + rng() * 0.06})`); cg.addColorStop(1, 'rgba(255,200,150,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(0, 0, cw, 0, 6.2832); g.fill(); g.restore();
  }
  // sun glow + disc
  const sx = W * 0.5, sy = horizon - H * 0.015, sr = Math.min(W, H) * 0.14;
  const glow = g.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 4.5);
  glow.addColorStop(0, 'rgba(255,224,160,0.55)'); glow.addColorStop(0.3, 'rgba(255,170,80,0.3)'); glow.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, horizon + sr);
  const sun = g.createRadialGradient(sx, sy - sr * 0.2, sr * 0.08, sx, sy, sr);
  sun.addColorStop(0, '#fff6e0'); sun.addColorStop(0.4, '#ffe089'); sun.addColorStop(0.75, '#ffb24a'); sun.addColorStop(1, '#ff8b34');
  g.beginPath(); g.arc(sx, sy, sr, 0, 6.2832); g.fillStyle = sun; g.fill();
  g.save(); g.beginPath(); g.arc(sx, sy, sr, 0, 6.2832); g.clip();
  g.fillStyle = 'rgba(120,50,20,0.18)';
  for (let i = 0; i < 4; i++) g.fillRect(sx - sr, sy + sr * 0.05 + i * sr * 0.32, sr * 2, sr * 0.1);
  g.restore();
  return c;
}
// FOREGROUND layer (in front of the god-rays): mesas, ground, cacti, fence, scrub
function _olBuildFg(W, H, horizon) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // mesas — atmospheric perspective (far = hazy/light, near = dark)
  _olMesa(g, W, H, horizon + H * 0.012, '#9a5238', 11, H * 0.085);
  _olMesa(g, W, H, horizon + H * 0.05, '#5e3020', 23, H * 0.15);
  _olMesa(g, W, H, horizon + H * 0.1, '#371b0f', 41, H * 0.12);
  // ground plain
  const gnd = g.createLinearGradient(0, horizon, 0, H);
  gnd.addColorStop(0, '#6e3c20'); gnd.addColorStop(0.4, '#492611'); gnd.addColorStop(1, '#2a1409');
  g.fillStyle = gnd; g.fillRect(0, horizon + H * 0.02, W, H);
  // fence along the foreground
  const fy = horizon + H * 0.2; g.fillStyle = '#170c05';
  g.fillRect(0, fy, W, Math.max(2, H * 0.006)); g.fillRect(0, fy + H * 0.035, W, Math.max(2, H * 0.006));
  for (let x = W * 0.06; x < W; x += W * 0.13) g.fillRect(x, fy - H * 0.022, Math.max(3, W * 0.006), H * 0.08);
  // cacti (varied sizes), darkest silhouettes
  [[0.1, 1.0], [0.27, 0.6], [0.62, 1.25], [0.8, 0.78], [0.92, 1.05]].forEach(([fx, fs]) => _olCactus(g, fx * W, horizon + H * 0.085, H * 0.17 * fs, '#160c06'));
  // low scrub bushes / rocks dotted along the ground
  const rng = _aetherRng(909); g.fillStyle = '#140a05';
  for (let i = 0; i < 9; i++) {
    const bx = rng() * W, by = horizon + H * (0.12 + rng() * 0.18), bw = W * (0.012 + rng() * 0.02);
    g.beginPath(); g.ellipse(bx, by, bw, bw * 0.5, 0, 0, 6.2832); g.fill();
  }
  return c;
}
function _olBird(g, x, y, s, flap) {
  g.strokeStyle = 'rgba(20,10,6,0.7)'; g.lineWidth = Math.max(1, s * 0.12); g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - s, y + flap * s * 0.3); g.quadraticCurveTo(x - s * 0.3, y - flap * s * 0.5, x, y);
  g.quadraticCurveTo(x + s * 0.3, y - flap * s * 0.5, x + s, y + flap * s * 0.3);
  g.stroke();
}
function _olTumble(g, x, y, r, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.lineCap = 'round';
  // woven inner tangle — curved strands threading through the centre
  for (let i = 0; i < 20; i++) {
    const a1 = i * 0.97, a2 = a1 + 1.7 + (i % 3) * 0.4;
    const r1 = r * (0.45 + (i % 4) * 0.13), r2 = r * (0.55 + (i % 5) * 0.09);
    g.strokeStyle = `rgba(${118 - (i % 3) * 22},${80 - (i % 3) * 16},42,0.8)`;
    g.lineWidth = Math.max(1, r * 0.05);
    g.beginPath();
    g.moveTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
    g.quadraticCurveTo(Math.cos(a1 + 0.9) * r * 0.28, Math.sin(a1 + 0.9) * r * 0.28, Math.cos(a2) * r2, Math.sin(a2) * r2);
    g.stroke();
  }
  // wispy twigs poking out of the ball
  g.strokeStyle = 'rgba(146,98,52,0.6)'; g.lineWidth = Math.max(0.8, r * 0.035);
  for (let i = 0; i < 9; i++) { const a = i * 0.78; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); g.lineTo(Math.cos(a) * r * 1.18, Math.sin(a) * r * 1.12); g.stroke(); }
  g.restore();
}
// a white corner rose (cream petals + a couple leaves), gently swaying
function _olTumble(g, x, y, r, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.lineCap = 'round';
  // woven inner tangle — curved strands threading through the centre
  for (let i = 0; i < 20; i++) {
    const a1 = i * 0.97, a2 = a1 + 1.7 + (i % 3) * 0.4;
    const r1 = r * (0.45 + (i % 4) * 0.13), r2 = r * (0.55 + (i % 5) * 0.09);
    g.strokeStyle = `rgba(${118 - (i % 3) * 22},${80 - (i % 3) * 16},42,0.8)`;
    g.lineWidth = Math.max(1, r * 0.05);
    g.beginPath();
    g.moveTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
    g.quadraticCurveTo(Math.cos(a1 + 0.9) * r * 0.28, Math.sin(a1 + 0.9) * r * 0.28, Math.cos(a2) * r2, Math.sin(a2) * r2);
    g.stroke();
  }
  // wispy twigs poking out of the ball
  g.strokeStyle = 'rgba(146,98,52,0.6)'; g.lineWidth = Math.max(0.8, r * 0.035);
  for (let i = 0; i < 9; i++) { const a = i * 0.78; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); g.lineTo(Math.cos(a) * r * 1.18, Math.sin(a) * r * 1.12); g.stroke(); }
  g.restore();
}
// a white corner rose (cream petals + a couple leaves), gently swaying
function _olWhiteRose(ctx, x, y, R, t, ph) {
  ctx.save(); ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.8 + ph) * 0.12);
  const br = 1 + Math.sin(t * 1.1 + ph) * 0.04; ctx.scale(br, br);
  // leaves behind
  ctx.fillStyle = '#3c6b2e';
  for (const la of [-2.4, -0.7, 2.4]) { ctx.save(); ctx.rotate(la); ctx.beginPath(); ctx.ellipse(0, R * 0.95, R * 0.22, R * 0.5, 0, 0, 6.2832); ctx.fill(); ctx.restore(); }
  ctx.shadowColor = 'rgba(255,255,255,0.5)'; ctx.shadowBlur = 10;
  const rings = [
    { n: 7, len: R, wid: R * 0.5, col: '#e7e3da', rot: 0, push: R * 0.16 },
    { n: 6, len: R * 0.74, wid: R * 0.44, col: '#f6f3ec', rot: 0.5, push: R * 0.12 },
    { n: 5, len: R * 0.5, wid: R * 0.36, col: '#fffdf8', rot: 1.0, push: R * 0.08 },
  ];
  for (const rg of rings) for (let i = 0; i < rg.n; i++) { ctx.save(); ctx.rotate(rg.rot + i * (6.2832 / rg.n)); ctx.translate(0, -rg.push); _evPetalShape(ctx, rg.len, rg.wid, rg.col); ctx.restore(); }
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.16, 0, 6.2832); ctx.fillStyle = '#efe2af'; ctx.fill();
  ctx.restore();
}
function _drawOliverPattern(canvas, ctx, W, H, t) {
  const fresh = _drawOliverPattern._lt === undefined;
  if (!fresh && t - _drawOliverPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawOliverPattern._lt, 0.05);
  _drawOliverPattern._lt = t;
  const horizon = H * 0.66;
  if (canvas._olW !== W || canvas._olH !== H || !canvas._olSky) {
    canvas._olW = W; canvas._olH = H;
    canvas._olSky = _olBuildSky(W, H, horizon);
    canvas._olFg = _olBuildFg(W, H, horizon);
    canvas._olTw = Array.from({ length: 4 }, () => ({ x: Math.random() * W, y: horizon + H * (0.16 + Math.random() * 0.18), r: 14 + Math.random() * 16, rot: Math.random() * 6.28, sp: 55 + Math.random() * 90, bob: Math.random() * 6.28 }));
    canvas._olDustBg = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: horizon + Math.random() * (H - horizon), vx: 20 + Math.random() * 50, r: 0.6 + Math.random() * 1.8 }));
    canvas._olStars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * horizon * 0.7, r: 0.3 + Math.random() * 1.1, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 1.6 }));
    canvas._olBirds = Array.from({ length: 4 }, () => ({ x: Math.random() * W, y: H * (0.12 + Math.random() * 0.22), s: 6 + Math.random() * 7, sp: 12 + Math.random() * 18, ph: Math.random() * 6.28 }));
    canvas._olPetals = [];
  }
  // DRUNKEN sway over the whole scene (overscaled so edges never reveal)
  const swayX = Math.sin(t * 0.7) * 4 + Math.sin(t * 1.9) * 2, swayY = Math.cos(t * 0.5) * 3 + Math.sin(t * 1.3) * 1.5;
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(swayX, swayY);
  // 1 ── SKY (behind everything)
  ctx.drawImage(canvas._olSky, -10, -10, W + 20, H + 20);
  // twinkling stars in the upper sky
  ctx.fillStyle = '#fff1dc';
  for (const s of canvas._olStars) { ctx.globalAlpha = 0.2 + 0.6 * Math.abs(Math.sin(t * s.sp + s.ph)); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill(); }
  ctx.globalAlpha = 1;
  // 2 ── god-rays fanning up from the sun (additive). Drawn BEFORE the foreground
  //      so the mesas occlude them (correct depth).
  const sunX = W * 0.5, sunY = horizon - H * 0.015;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.translate(sunX, sunY);
  const nRays = 13;
  for (let i = 0; i < nRays; i++) {
    const a = -Math.PI / 2 + (i - (nRays - 1) / 2) * 0.24 + Math.sin(t * 0.13) * 0.12;
    const flick = 0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.7);
    const len = Math.max(W, H) * 0.85, wd = 0.03 + 0.022 * flick;
    const rg = ctx.createLinearGradient(0, 0, len, 0);
    rg.addColorStop(0, `rgba(255,214,140,${0.05 + 0.06 * flick})`); rg.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.save(); ctx.rotate(a); ctx.fillStyle = rg;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -len * wd); ctx.lineTo(len, len * wd); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // pulsing sun glow (additive, still behind the foreground)
  const sp0 = 0.5 + 0.5 * Math.sin(t * 1.2);
  const sg0 = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.min(W, H) * 0.3);
  sg0.addColorStop(0, `rgba(255,214,150,${0.07 + sp0 * 0.12})`); sg0.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = sg0; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  // 3 ── distant birds drifting across the sky
  ctx.save();
  for (const b of canvas._olBirds) {
    b.x -= b.sp * dt; if (b.x < -20) { b.x = W + 20; b.y = H * (0.12 + Math.random() * 0.22); }
    _olBird(ctx, b.x, b.y, b.s, Math.sin(t * 6 + b.ph));
  }
  ctx.restore();
  // 4 ── FOREGROUND (mesas/ground/cacti/fence) — occludes the rays & birds
  ctx.drawImage(canvas._olFg, -10, -10, W + 20, H + 20);

  // heat shimmer rising off the desert floor (in front of the mesas)
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgba(255,200,140,${0.04 + 0.03 * Math.sin(t * 3 + i)})`; ctx.fillRect(Math.sin(t * 2 + i) * 6, horizon + H * 0.04 + i * 9, W, 3); }
  ctx.globalCompositeOperation = 'source-over';

  // blowing dust
  ctx.fillStyle = 'rgba(210,170,110,0.4)';
  for (const d of canvas._olDustBg) {
    d.x += (d.vx + Math.sin(t + d.y) * 8) * dt; if (d.x > W + 5) { d.x = -5; d.y = horizon + Math.random() * (H - horizon); }
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + d.x * 0.05);
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // rolling tumbleweeds (rotation matches roll distance; they hop along the ground)
  for (const tw of canvas._olTw) {
    tw.x += tw.sp * dt; tw.rot += (tw.sp * dt) / tw.r;
    if (tw.x - tw.r > W) { tw.x = -tw.r; tw.y = horizon + H * (0.16 + Math.random() * 0.18); tw.r = 14 + Math.random() * 16; tw.sp = 55 + Math.random() * 90; }
    const hop = Math.abs(Math.sin(tw.x * 0.013 + tw.bob)) * tw.r * 0.55;
    _olTumble(ctx, tw.x, tw.y - hop, tw.r, tw.rot);
  }
  ctx.restore();   // end drunken sway

  // four corner WHITE ROSES (fixed; their own gentle sway)
  const Rr = Math.min(W, H) * 0.075;
  _olWhiteRose(ctx, Rr * 0.75, Rr * 0.75, Rr, t, 0);
  _olWhiteRose(ctx, W - Rr * 0.75, Rr * 0.75, Rr, t, 1.6);
  _olWhiteRose(ctx, Rr * 0.75, H - Rr * 0.75, Rr, t, 3.1);
  _olWhiteRose(ctx, W - Rr * 0.75, H - Rr * 0.75, Rr, t, 4.7);
  // drifting white petals shed from the corners
  if (canvas._olPetals.length < 18 && Math.random() < 0.4) {
    const corner = [[Rr, Rr], [W - Rr, Rr], [Rr, H - Rr], [W - Rr, H - Rr]][(Math.random() * 4) | 0];
    canvas._olPetals.push({ x: corner[0], y: corner[1], vx: (Math.random() - 0.5) * 22, vy: 10 + Math.random() * 24, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2, sz: 4 + Math.random() * 5, life: 1, sway: Math.random() * 6.28 });
  }
  for (let i = canvas._olPetals.length - 1; i >= 0; i--) {
    const p = canvas._olPetals[i];
    p.x += (p.vx + Math.sin(t + p.sway) * 10) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= dt * 0.25;
    if (p.life <= 0 || p.y > H + 12) { canvas._olPetals.splice(i, 1); continue; }
    ctx.save(); ctx.globalAlpha = Math.min(1, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.scale(0.4 + 0.6 * Math.abs(Math.cos(p.rot * 1.3)), 1);
    ctx.fillStyle = '#fdfbf5';
    ctx.beginPath(); ctx.moveTo(0, -p.sz); ctx.bezierCurveTo(p.sz * 0.9, -p.sz * 0.4, p.sz * 0.6, p.sz * 0.8, 0, p.sz); ctx.bezierCurveTo(-p.sz * 0.6, p.sz * 0.8, -p.sz * 0.9, -p.sz * 0.4, 0, -p.sz); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // warm vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.32, W / 2, H * 0.5, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(28,10,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ── gold sheriff-badge cursor (drunken wobble + dust + click sparkle) ──
function _olMouseMove(e) { _olMX = e.clientX; _olMY = e.clientY; }
function _olClick() {
  for (let i = 0; i < 12; i++) { const a = Math.random() * 6.2832, s = 70 + Math.random() * 190; _olSpark.push({ x: _olX, y: _olY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, r: 1 + Math.random() * 2.6, star: Math.random() < 0.4 }); }
}
function _olStar(ctx, x, y, R, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath(); ctx.arc(0, 0, R * 1.18, 0, 6.2832); ctx.fillStyle = '#caa23a'; ctx.fill();   // badge ring
  ctx.strokeStyle = '#7a5a18'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const rr = i % 2 === 0 ? R : R * 0.44, a = -Math.PI / 2 + i * Math.PI / 5; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
  ctx.closePath(); ctx.fillStyle = '#f2c94c'; ctx.fill(); ctx.strokeStyle = '#7a5a18'; ctx.lineWidth = 1; ctx.stroke();
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * (2 * Math.PI / 5); ctx.beginPath(); ctx.arc(Math.cos(a) * R, Math.sin(a) * R, R * 0.13, 0, 6.2832); ctx.fillStyle = '#e6c14a'; ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 0, R * 0.17, 0, 6.2832); ctx.fillStyle = '#7a5a18'; ctx.fill();
  ctx.restore();
}
function _drawOliverCursor(canvas, ctx, W, H, t) {
  const fresh = _drawOliverCursor._lt === undefined;
  if (!fresh && t - _drawOliverCursor._lt < 0.016) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawOliverCursor._lt, 0.05);
  _drawOliverCursor._lt = t;
  ctx.clearRect(0, 0, W, H);
  // drunken follow: laggy spring + a lazy wobble around the pointer
  _olX += (_olMX - _olX) * Math.min(1, dt * 9);
  _olY += (_olMY - _olY) * Math.min(1, dt * 9);
  const bx = _olX + Math.sin(t * 3.1) * 4 + Math.sin(t * 5.3) * 2.2;
  const by = _olY + Math.cos(t * 2.6) * 3 + Math.sin(t * 4.1) * 1.5;
  // dust kicked up under the badge
  if (_olDust.length < 90) _olDust.push({ x: bx + (Math.random() - 0.5) * 6, y: by + 7, vx: (Math.random() - 0.5) * 14, vy: 5 + Math.random() * 10, life: 1, r: 2 + Math.random() * 4 });
  for (let i = _olDust.length - 1; i >= 0; i--) {
    const d = _olDust[i]; d.x += d.vx * dt; d.y += d.vy * dt; d.r += 8 * dt; d.life -= dt * 1.3;
    if (d.life <= 0) { _olDust.splice(i, 1); continue; }
    ctx.globalAlpha = d.life * 0.4; ctx.fillStyle = '#caa472';
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // click sparkles
  for (let i = _olSpark.length - 1; i >= 0; i--) {
    const s = _olSpark[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 220 * dt; s.life -= dt * 1.3;
    if (s.life <= 0) { _olSpark.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, s.life); ctx.fillStyle = '#ffd95e';
    if (s.star) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.life * 6); _olStar(ctx, 0, 0, s.r * 2.2, 0); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // glow + badge
  const gl = ctx.createRadialGradient(bx, by, 0, bx, by, 22);
  gl.addColorStop(0, 'rgba(255,210,90,0.3)'); gl.addColorStop(1, 'rgba(255,210,90,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(bx, by, 22, 0, 6.2832); ctx.fill();
  _olStar(ctx, bx, by, 11, Math.sin(t * 0.9) * 0.25);
  // glint
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); ctx.fillStyle = '#fff7df';
  ctx.beginPath(); ctx.arc(bx - 3, by - 3, 1.6, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
}
function _startOliverOverlay() {
  _stopOliverOverlay();
  _drawOliverCursor._lt = undefined; _olDust = []; _olSpark = []; _olX = _olMX; _olY = _olMY;
  window.addEventListener('mousemove', _olMouseMove);
  window.addEventListener('click', _olClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'oliver-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('oliver-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) { cv2.width = window.innerWidth; cv2.height = window.innerHeight; }
    _drawOliverCursor(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _oliverOverlayRafId = requestAnimationFrame(frame);
  }
  _oliverOverlayRafId = requestAnimationFrame(frame);
}
function _stopOliverOverlay() {
  if (_oliverOverlayRafId) { cancelAnimationFrame(_oliverOverlayRafId); _oliverOverlayRafId = null; }
  window.removeEventListener('mousemove', _olMouseMove);
  window.removeEventListener('click', _olClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('oliver-overlay'); if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// SPRUCE — Oliver's right-hand lady, taken to the EXTREME, and all about white
// roses. A dramatic twilight overflowing with lush white roses on every edge, a
// giant central white rose, a heavy petal blizzard, drifting pollen sparkles,
// and a grand white-rose cursor that showers petals.
// ════════════════════════════════════════════════════════════════
const _SPRUCE_RE = /^Spruce$/i;
function _isSpruce(c) { return !!(c && c.name && _SPRUCE_RE.test(c.name)); }
let _spruceOverlayRafId = null;
let _spMX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
let _spMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
let _spTrail = [];
function _spDrawPetal(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  ctx.scale(0.4 + 0.6 * Math.abs(Math.cos(p.rot * 1.3)), 1);
  const grd = ctx.createLinearGradient(0, -p.sz, 0, p.sz);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#e7e1d4');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.moveTo(0, -p.sz); ctx.bezierCurveTo(p.sz * 0.9, -p.sz * 0.4, p.sz * 0.6, p.sz * 0.8, 0, p.sz); ctx.bezierCurveTo(-p.sz * 0.6, p.sz * 0.8, -p.sz * 0.9, -p.sz * 0.4, 0, -p.sz); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(175,165,148,0.4)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(0, -p.sz * 0.8); ctx.lineTo(0, p.sz * 0.8); ctx.stroke();
  ctx.restore();
}
// a lush white rose drawn at the current origin (caller translates)
function _spDrawRose(ctx, R, rot, glow) {
  ctx.save(); ctx.rotate(rot);
  ctx.fillStyle = '#3c6b2e';     // leaves behind
  for (const la of [-2.4, -0.7, 2.4]) { ctx.save(); ctx.rotate(la); ctx.beginPath(); ctx.ellipse(0, R * 0.98, R * 0.22, R * 0.5, 0, 0, 6.2832); ctx.fill(); ctx.restore(); }
  if (glow) { ctx.shadowColor = 'rgba(255,255,255,0.7)'; ctx.shadowBlur = R * 0.5; }
  const rings = [
    { n: 9, len: R, wid: R * 0.5, col: '#e9e5dc', rot: 0, push: R * 0.18 },
    { n: 8, len: R * 0.78, wid: R * 0.44, col: '#f3efe7', rot: 0.4, push: R * 0.14 },
    { n: 6, len: R * 0.56, wid: R * 0.38, col: '#fbf8f2', rot: 0.9, push: R * 0.1 },
    { n: 5, len: R * 0.36, wid: R * 0.32, col: '#fffdf9', rot: 1.4, push: R * 0.06 },
  ];
  for (const rg of rings) for (let i = 0; i < rg.n; i++) { ctx.save(); ctx.rotate(rg.rot + i * (6.2832 / rg.n)); ctx.translate(0, -rg.push); _evPetalShape(ctx, rg.len, rg.wid, rg.col); ctx.restore(); }
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.15, 0, 6.2832); ctx.fillStyle = '#efe2af'; ctx.fill();
  ctx.restore();
}
function _spBuildGarden(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), S = Math.min(W, H);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#160a16'); bg.addColorStop(0.4, '#2e1626'); bg.addColorStop(0.7, '#481f2e'); bg.addColorStop(1, '#1b0c17');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const cg = g.createRadialGradient(W * 0.5, H * 0.2, 10, W * 0.5, H * 0.2, Math.max(W, H) * 0.5);
  cg.addColorStop(0, 'rgba(255,240,225,0.2)'); cg.addColorStop(1, 'rgba(255,240,225,0)');
  g.fillStyle = cg; g.fillRect(0, 0, W, H);
  // lush white-rose vines framing the WHOLE screen
  const rng = _aetherRng(555);
  const place = (x, y, R) => { g.save(); g.translate(x, y); _spDrawRose(g, R, rng() * 6.2832, false); g.restore(); };
  [[0, 0], [W, 0], [0, H], [W, H]].forEach(([cx, cy]) => { for (let i = 0; i < 6; i++) place(cx + (rng() - 0.5) * S * 0.18, cy + (rng() - 0.5) * S * 0.18, S * (0.045 + rng() * 0.045)); });
  for (let i = 0; i < 6; i++) place(W * (0.18 + i * 0.13), H * 0.02 + rng() * S * 0.03, S * (0.03 + rng() * 0.03));   // top
  for (let i = 0; i < 6; i++) place(W * (0.18 + i * 0.13), H * 0.98 - rng() * S * 0.03, S * (0.03 + rng() * 0.03));   // bottom
  for (let i = 0; i < 4; i++) place(W * 0.02 + rng() * S * 0.03, H * (0.26 + i * 0.16), S * (0.03 + rng() * 0.03));   // left
  for (let i = 0; i < 4; i++) place(W * 0.98 - rng() * S * 0.03, H * (0.26 + i * 0.16), S * (0.03 + rng() * 0.03));   // right
  return c;
}
function _drawSprucePattern(canvas, ctx, W, H, t) {
  const fresh = _drawSprucePattern._lt === undefined;
  if (!fresh && t - _drawSprucePattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawSprucePattern._lt, 0.05);
  _drawSprucePattern._lt = t;
  if (canvas._spW !== W || canvas._spH !== H || !canvas._spBg) {
    canvas._spW = W; canvas._spH = H;
    canvas._spBg = _spBuildGarden(W, H);
    canvas._spPetals = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * H, vy: 22 + Math.random() * 40, vx: (Math.random() - 0.5) * 26, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2, sz: 5 + Math.random() * 8, sway: Math.random() * 6.28 }));
    canvas._spSpark = Array.from({ length: 36 }, () => ({ x: Math.random() * W, y: Math.random() * H, vy: -(8 + Math.random() * 20), r: 0.6 + Math.random() * 1.8, ph: Math.random() * 6.28, sp: 1 + Math.random() * 2 }));
  }
  // gentle elegant breathing sway of the whole garden
  const swX = Math.sin(t * 0.5) * 5, swY = Math.cos(t * 0.4) * 4, br = 1 + Math.sin(t * 0.6) * 0.008;
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(W / 2 + swX, H / 2 + swY); ctx.scale(br, br); ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(canvas._spBg, -12, -12, W + 24, H + 24);
  ctx.restore();
  // GIANT central white rose with a pulsing halo
  const gx = W * 0.5, gy = H * 0.2, gR = Math.min(W, H) * 0.15, pulse = 0.5 + 0.5 * Math.sin(t * 0.9);
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(gx, gy, gR * 0.5, gx, gy, gR * 2.4);
  halo.addColorStop(0, `rgba(255,250,240,${0.05 + pulse * 0.1})`); halo.addColorStop(0.5, `rgba(255,230,235,${0.04 + pulse * 0.06})`); halo.addColorStop(1, 'rgba(255,230,235,0)');
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(gx, gy, gR * 2.4, 0, 6.2832); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.translate(gx, gy); ctx.scale(1 + Math.sin(t * 0.8) * 0.02, 1 + Math.sin(t * 0.8) * 0.02); _spDrawRose(ctx, gR, t * 0.1, true); ctx.restore();
  // pollen sparkles drifting up (additive twinkle)
  ctx.globalCompositeOperation = 'lighter';
  for (const s of canvas._spSpark) {
    s.y += s.vy * dt; s.x += Math.sin(t * 0.6 + s.ph) * 6 * dt; if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W; }
    ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * s.sp + s.ph));
    ctx.fillStyle = '#fff6e8'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // HEAVY white petal blizzard
  for (const p of canvas._spPetals) {
    p.x += (p.vx + Math.sin(t * 0.8 + p.sway) * 20) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.y > H + 14) { p.y = -14; p.x = Math.random() * W; }
    if (p.x < -14) p.x = W + 14; else if (p.x > W + 14) p.x = -14;
    _spDrawPetal(ctx, p);
  }
  // soft drifting mist
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const mx = W * (0.3 + i * 0.25) + Math.sin(t * 0.2 + i * 2) * W * 0.1, my = H * (0.55 + (i % 2) * 0.2), mr = W * 0.28;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
    mg.addColorStop(0, 'rgba(255,245,238,0.05)'); mg.addColorStop(1, 'rgba(255,245,238,0)');
    ctx.save(); ctx.translate(mx, my); ctx.scale(1, 0.45); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, 0, mr, 0, 6.2832); ctx.fill(); ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
  // soft vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.82);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,4,12,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ── grand white-rose cursor that showers petals + sparkles ──
function _spMouseMove(e) { _spMX = e.clientX; _spMY = e.clientY; }
function _spClick() {
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * 6.2832, s = 70 + Math.random() * 200;
    _spTrail.push({ kind: Math.random() < 0.5 ? 'petal' : 'spark', x: _spMX, y: _spMY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 5, sz: 4 + Math.random() * 6, r: 1 + Math.random() * 2, life: 1, sway: Math.random() * 6.28 });
  }
}
function _drawSpruceCursor(canvas, ctx, W, H, t) {
  const fresh = _drawSpruceCursor._lt === undefined;
  if (!fresh && t - _drawSpruceCursor._lt < 0.016) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawSpruceCursor._lt, 0.05);
  _drawSpruceCursor._lt = t;
  ctx.clearRect(0, 0, W, H);
  if (_spTrail.length < 200) {
    if (Math.random() < 0.7) _spTrail.push({ kind: 'petal', x: _spMX + (Math.random() - 0.5) * 12, y: _spMY + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 26, vy: 14 + Math.random() * 28, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2, sz: 3 + Math.random() * 5, life: 1, sway: Math.random() * 6.28 });
    if (Math.random() < 0.5) _spTrail.push({ kind: 'spark', x: _spMX + (Math.random() - 0.5) * 16, y: _spMY + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, r: 0.8 + Math.random() * 1.8, life: 1 });
  }
  for (let i = _spTrail.length - 1; i >= 0; i--) {
    const p = _spTrail[i];
    p.x += (p.vx + (p.kind === 'petal' ? Math.sin(t * 1.5 + p.sway) * 10 : 0)) * dt; p.y += p.vy * dt;
    if (p.kind === 'petal') { p.vy += 28 * dt; p.rot += p.vr * dt; p.life -= dt * 0.7; }
    else { p.vy += 60 * dt; p.life -= dt * 1.4; }
    if (p.life <= 0) { _spTrail.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, p.life);
    if (p.kind === 'petal') _spDrawPetal(ctx, p);
    else { ctx.fillStyle = '#fff6e8'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // glow + grand rose
  const gl = ctx.createRadialGradient(_spMX, _spMY, 0, _spMX, _spMY, 30);
  gl.addColorStop(0, 'rgba(255,250,242,0.35)'); gl.addColorStop(1, 'rgba(255,250,242,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(_spMX, _spMY, 30, 0, 6.2832); ctx.fill();
  ctx.save(); ctx.translate(_spMX, _spMY); _spDrawRose(ctx, 17, t * 0.3, true); ctx.restore();
  // orbiting sparkles
  for (let k = 0; k < 3; k++) { const a = t * 1.6 + k * 2.1, rr = 22 + Math.sin(t * 2 + k) * 4; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + k); ctx.fillStyle = '#fffbf2'; ctx.beginPath(); ctx.arc(_spMX + Math.cos(a) * rr, _spMY + Math.sin(a) * rr, 1.6, 0, 6.2832); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function _startSpruceOverlay() {
  _stopSpruceOverlay();
  _drawSpruceCursor._lt = undefined; _spTrail = [];
  window.addEventListener('mousemove', _spMouseMove);
  window.addEventListener('click', _spClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'spruce-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('spruce-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) { cv2.width = window.innerWidth; cv2.height = window.innerHeight; }
    _drawSpruceCursor(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _spruceOverlayRafId = requestAnimationFrame(frame);
  }
  _spruceOverlayRafId = requestAnimationFrame(frame);
}
function _stopSpruceOverlay() {
  if (_spruceOverlayRafId) { cancelAnimationFrame(_spruceOverlayRafId); _spruceOverlayRafId = null; }
  window.removeEventListener('mousemove', _spMouseMove);
  window.removeEventListener('click', _spClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('spruce-overlay'); if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// MOMO — a foggy grey wasteland with crows wheeling overhead and a distinctive
// red top hat (butterfly wings, a red gem, gold trim) lying on the ground. The
// cursor is a crow that flies after the pointer, shedding the odd feather.
// ════════════════════════════════════════════════════════════════
const _MOMO_RE = /^Momo$/i;
function _isMomo(c) { return !!(c && c.name && _MOMO_RE.test(c.name)); }
let _momoOverlayRafId = null;
let _moMX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
let _moMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
let _moX = _moMX, _moY = _moMY, _moFeathers = [];
// a wing in local space, rooted at the shoulder (0,0), sweeping BACKWARD (−x)
// and slightly up — a broad raven blade ending in splayed primary feathers.
// The caller rotates this around the shoulder to flap it.
function _moWing(ctx, s, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.10);
  ctx.quadraticCurveTo(-s * 0.8, -s * 0.46, -s * 1.5, -s * 0.30);   // leading edge → wrist (back & up)
  ctx.quadraticCurveTo(-s * 1.02, -s * 0.02, -s * 0.78, s * 0.10);  // wrist down to trailing edge
  ctx.quadraticCurveTo(-s * 0.36, s * 0.20, 0, s * 0.12);           // trailing edge back to shoulder
  ctx.closePath(); ctx.fill();
  // primary feathers ("fingers") splaying off the wrist
  const wx = -s * 1.5, wy = -s * 0.30;
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.translate(wx, wy); ctx.rotate(0.12 + i * 0.30);
    ctx.beginPath(); ctx.moveTo(0, -s * 0.05);
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.02, -s * 0.8, s * 0.07);
    ctx.quadraticCurveTo(-s * 0.45, s * 0.15, 0, s * 0.1);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
// a handsome flying crow (side view, facing +x). flap in [-1,1]: +1 downstroke
// (wings sweep DOWN), −1 upstroke (wings sweep UP). faceLeft flips; tilt banks.
function _moCrow(ctx, x, y, s, flap, faceLeft, tilt, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.translate(x, y); if (tilt) ctx.rotate(tilt); if (faceLeft) ctx.scale(-1, 1);
  const col = '#0d0d10';
  const shX = s * 0.12, shY = -s * 0.26;
  // FAR wing — behind the body, dimmer, a hair behind in phase
  ctx.save(); ctx.globalAlpha *= 0.5; ctx.translate(shX - s * 0.08, shY - s * 0.04); ctx.rotate(flap * 0.7 - 0.04); _moWing(ctx, s * 0.94, col); ctx.restore();
  ctx.fillStyle = col;
  // TAIL — a clean wedge of a few feathers angled back
  ctx.save(); ctx.translate(-s * 0.78, -s * 0.02); ctx.rotate(0.08);
  ctx.beginPath(); ctx.moveTo(0, -s * 0.28); ctx.lineTo(-s * 1.25, -s * 0.05); ctx.lineTo(-s * 1.22, s * 0.16); ctx.lineTo(0, s * 0.26); ctx.closePath(); ctx.fill();
  ctx.restore();
  // BODY — chunky, slightly nose-up
  ctx.beginPath(); ctx.ellipse(0, 0, s * 1.05, s * 0.5, -0.1, 0, 6.2832); ctx.fill();
  // BREAST sweeping up into the neck
  ctx.beginPath(); ctx.moveTo(s * 0.45, s * 0.1); ctx.quadraticCurveTo(s * 1.0, s * 0.0, s * 1.02, -s * 0.42);
  ctx.quadraticCurveTo(s * 0.7, -s * 0.3, s * 0.4, -s * 0.2); ctx.closePath(); ctx.fill();
  // HEAD
  ctx.beginPath(); ctx.arc(s * 1.05, -s * 0.46, s * 0.29, 0, 6.2832); ctx.fill();
  // BEAK — long, pointed, slight downward set
  ctx.beginPath(); ctx.moveTo(s * 1.28, -s * 0.56); ctx.lineTo(s * 1.92, -s * 0.4); ctx.lineTo(s * 1.3, -s * 0.3); ctx.closePath(); ctx.fill();
  // EYE glint
  ctx.fillStyle = 'rgba(165,165,175,0.75)'; ctx.beginPath(); ctx.arc(s * 1.12, -s * 0.5, s * 0.05, 0, 6.2832); ctx.fill();
  // NEAR wing — over the body, full flap
  ctx.fillStyle = col;
  ctx.save(); ctx.translate(shX, shY); ctx.rotate(flap * 0.78); _moWing(ctx, s, col); ctx.restore();
  ctx.restore();
}
function _moFeatherDraw(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
  ctx.fillStyle = `rgba(20,20,24,${Math.min(1, p.life)})`;
  ctx.beginPath(); ctx.moveTo(0, -p.sz); ctx.bezierCurveTo(p.sz * 0.6, -p.sz * 0.2, p.sz * 0.4, p.sz * 0.7, 0, p.sz); ctx.bezierCurveTo(-p.sz * 0.4, p.sz * 0.7, -p.sz * 0.6, -p.sz * 0.2, 0, -p.sz); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// the hat's front ornament: gold sprigs, translucent butterfly wings, a red gem
function _moHatDeco(ctx, x, y, cw) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#d9a86a'; ctx.lineWidth = cw * 0.04; ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -cw * 0.04); ctx.quadraticCurveTo(s * cw * 0.13, -cw * 0.3, s * cw * 0.07, -cw * 0.44); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, -cw * 0.04); ctx.lineTo(0, -cw * 0.46); ctx.stroke();
  ctx.fillStyle = 'rgba(205,100,100,0.55)'; ctx.strokeStyle = 'rgba(150,55,55,0.6)'; ctx.lineWidth = cw * 0.012;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.scale(s, 1);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(cw * 0.22, -cw * 0.2, cw * 0.42, -cw * 0.12, cw * 0.34, cw * 0.03); ctx.bezierCurveTo(cw * 0.3, cw * 0.06, cw * 0.12, cw * 0.05, 0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cw * 0.02); ctx.bezierCurveTo(cw * 0.16, cw * 0.1, cw * 0.26, cw * 0.22, cw * 0.17, cw * 0.26); ctx.bezierCurveTo(cw * 0.1, cw * 0.24, cw * 0.04, cw * 0.11, 0, cw * 0.02); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(0, 0, cw * 0.09, 0, 6.2832); ctx.fill();
  ctx.fillStyle = 'rgba(255,180,180,0.9)'; ctx.beginPath(); ctx.arc(-cw * 0.03, -cw * 0.03, cw * 0.03, 0, 6.2832); ctx.fill();
  ctx.restore();
}
function _moHat(ctx, cx, cy, cw, tilt) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt);
  const crownH = cw * 1.45, brimW = cw * 1.95, brimEH = cw * 0.4, topY = -crownH;
  ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#191313'; ctx.beginPath(); ctx.ellipse(cw * 0.18, brimEH * 0.45, brimW * 0.6, brimEH * 0.62, 0, 0, 6.2832); ctx.fill(); ctx.restore();
  // brim
  const bg = ctx.createLinearGradient(0, -brimEH, 0, brimEH);
  bg.addColorStop(0, '#b84444'); bg.addColorStop(0.5, '#9c3838'); bg.addColorStop(1, '#722a2a');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, 0, brimW / 2, brimEH, 0, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = '#5c2020'; ctx.lineWidth = cw * 0.025; ctx.stroke();
  ctx.fillStyle = 'rgba(200,90,90,0.4)'; ctx.beginPath(); ctx.ellipse(0, -brimEH * 0.18, brimW * 0.34, brimEH * 0.6, 0, 0, 6.2832); ctx.fill();
  // crown side (cylindrical shading)
  const sg = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
  sg.addColorStop(0, '#7e2c2c'); sg.addColorStop(0.32, '#c04c4c'); sg.addColorStop(0.55, '#a83c3c'); sg.addColorStop(1, '#6c2424');
  ctx.fillStyle = sg; ctx.fillRect(-cw / 2, topY + cw * 0.14, cw, crownH - cw * 0.14);
  ctx.beginPath(); ctx.ellipse(0, 0, cw / 2, cw * 0.16, 0, 0, Math.PI); ctx.fillStyle = '#6c2424'; ctx.fill();
  // top cap
  const tg = ctx.createRadialGradient(-cw * 0.16, topY - cw * 0.04, cw * 0.05, 0, topY, cw * 0.55);
  tg.addColorStop(0, '#d05c5c'); tg.addColorStop(1, '#993636');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(0, topY, cw / 2, cw * 0.16, 0, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = '#7e2c2c'; ctx.lineWidth = cw * 0.02; ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,200,0.5)'; ctx.beginPath(); ctx.ellipse(-cw * 0.12, topY - cw * 0.03, cw * 0.18, cw * 0.05, -0.3, 0, 6.2832); ctx.fill();
  ctx.fillStyle = 'rgba(255,180,170,0.16)'; ctx.fillRect(-cw * 0.3, topY + cw * 0.2, cw * 0.12, crownH - cw * 0.45);
  // band + gold trim
  const bandY = -cw * 0.52, bandH = cw * 0.34;
  ctx.fillStyle = '#4c1b1f'; ctx.fillRect(-cw / 2, bandY, cw, bandH);
  ctx.strokeStyle = '#cda566'; ctx.lineWidth = cw * 0.03;
  ctx.beginPath(); ctx.moveTo(-cw / 2, bandY + bandH * 0.12); ctx.lineTo(cw / 2, bandY + bandH * 0.12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-cw / 2, bandY + bandH * 0.88); ctx.lineTo(cw / 2, bandY + bandH * 0.88); ctx.stroke();
  _moHatDeco(ctx, 0, bandY + bandH * 0.5, cw);
  ctx.restore();
  // return the gem's world position (for the animated glow)
  return { gx: cx + cw * 0.34 * Math.sin(tilt), gy: cy - cw * 0.34 * Math.cos(tilt) };
}
function _moBuildWaste(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const horizon = H * 0.6;
  const sky = g.createLinearGradient(0, 0, 0, horizon + H * 0.1);
  sky.addColorStop(0, '#cdcccb'); sky.addColorStop(0.6, '#bdbab8'); sky.addColorStop(1, '#a9a39e');
  g.fillStyle = sky; g.fillRect(0, 0, W, horizon + H * 0.1);
  const gnd = g.createLinearGradient(0, horizon, 0, H);
  gnd.addColorStop(0, '#7c6a60'); gnd.addColorStop(0.4, '#5a4a42'); gnd.addColorStop(1, '#362c27');
  g.fillStyle = gnd; g.fillRect(0, horizon, W, H - horizon);
  // muddy tonal patches
  const rng = _aetherRng(404);
  for (let i = 0; i < 14; i++) {
    const px = rng() * W, py = horizon + rng() * (H - horizon), pw = W * (0.08 + rng() * 0.18);
    g.save(); g.translate(px, py); g.scale(1, 0.28);
    const pg = g.createRadialGradient(0, 0, 0, 0, 0, pw);
    pg.addColorStop(0, `rgba(${30 + rng() * 20},${22 + rng() * 16},${18 + rng() * 12},${0.18 + rng() * 0.2})`); pg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = pg; g.beginPath(); g.arc(0, 0, pw, 0, 6.2832); g.fill(); g.restore();
  }
  // scattered debris/rocks
  g.fillStyle = '#241c18';
  for (let i = 0; i < 10; i++) { const bx = rng() * W, by = horizon + H * 0.08 + rng() * (H - horizon) * 0.85, bw = W * (0.006 + rng() * 0.016); g.beginPath(); g.ellipse(bx, by, bw, bw * 0.5, 0, 0, 6.2832); g.fill(); }
  // the hat on the ground (lower-right)
  const gem = _moHat(g, W * 0.72, H * 0.85, Math.min(W, H) * 0.11, 0.13);
  c._gemX = gem.gx; c._gemY = gem.gy;
  return c;
}
function _drawMomoPattern(canvas, ctx, W, H, t) {
  const fresh = _drawMomoPattern._lt === undefined;
  if (!fresh && t - _drawMomoPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawMomoPattern._lt, 0.05);
  _drawMomoPattern._lt = t;
  if (canvas._moW !== W || canvas._moH !== H || !canvas._moBg) {
    canvas._moW = W; canvas._moH = H;
    canvas._moBg = _moBuildWaste(W, H);
    canvas._moCrows = Array.from({ length: 7 }, () => {
      const s = 4 + Math.random() * 11, far = s < 7;
      return { x: Math.random() * W, y: H * (0.06 + Math.random() * 0.46), s, far,
        vx: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 42 + s * 1.4),
        fl: 7 + Math.random() * 5, ph: Math.random() * 6.28, bob: Math.random() * 6.28,
        oscSp: 0.3 + Math.random() * 0.55, amp: H * (0.012 + Math.random() * 0.04), glide: Math.random() < 0.3 };
    });
    canvas._moFog = Array.from({ length: 6 }, () => ({ x: Math.random() * W, y: H * (0.2 + Math.random() * 0.6), r: W * (0.18 + Math.random() * 0.22), sp: 6 + Math.random() * 14, a: 0.04 + Math.random() * 0.05 }));
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(canvas._moBg, 0, 0);
  // pulsing red glow on the hat's gem
  if (canvas._moBg._gemX != null) {
    const gp = 0.5 + 0.5 * Math.sin(t * 2.2);
    ctx.globalCompositeOperation = 'lighter';
    const gg = ctx.createRadialGradient(canvas._moBg._gemX, canvas._moBg._gemY, 0, canvas._moBg._gemX, canvas._moBg._gemY, Math.min(W, H) * 0.05);
    gg.addColorStop(0, `rgba(255,40,40,${0.25 + gp * 0.4})`); gg.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(canvas._moBg._gemX, canvas._moBg._gemY, Math.min(W, H) * 0.05, 0, 6.2832); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // drifting fog (whitens the scene)
  for (const f of canvas._moFog) {
    f.x += f.sp * dt; if (f.x - f.r > W) f.x = -f.r;
    const fg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
    fg.addColorStop(0, `rgba(206,204,205,${f.a})`); fg.addColorStop(1, 'rgba(206,204,205,0)');
    ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, 0.5); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, f.r, 0, 6.2832); ctx.fill(); ctx.restore();
  }
  // crows wheeling around — each on its own gentle arc, banking into the turns,
  // gliding now and then; distant ones fade into the fog
  for (const cr of canvas._moCrows) {
    cr.x += cr.vx * dt;
    const phase = t * cr.oscSp + cr.bob;
    const y = cr.y + Math.sin(phase) * cr.amp;
    let tilt = Math.max(-0.38, Math.min(0.38, Math.cos(phase) * cr.oscSp * cr.amp * 0.02));
    if (cr.vx < 0) tilt = -tilt;
    if (cr.vx > 0 && cr.x - cr.s * 2.5 > W) cr.x = -cr.s * 2.5;
    else if (cr.vx < 0 && cr.x + cr.s * 2.5 < 0) cr.x = W + cr.s * 2.5;
    const flap = Math.sin(t * cr.fl + cr.ph) * (cr.glide ? 0.35 : 1);
    _moCrow(ctx, cr.x, y, cr.s, flap, cr.vx < 0, tilt, cr.far ? 0.5 : 1);
  }
  // a touch of low ground fog + vignette
  const lf = ctx.createLinearGradient(0, H * 0.7, 0, H);
  lf.addColorStop(0, 'rgba(200,198,198,0)'); lf.addColorStop(1, 'rgba(190,188,188,0.12)');
  ctx.fillStyle = lf; ctx.fillRect(0, H * 0.7, W, H * 0.3);
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,18,18,0.4)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ── crow cursor (flies after the pointer, shedding feathers) ──
function _moMouseMove(e) { _moMX = e.clientX; _moMY = e.clientY; }
function _moClick() {
  for (let i = 0; i < 10; i++) { const a = Math.random() * 6.2832, s = 50 + Math.random() * 130; _moFeathers.push({ x: _moX, y: _moY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 3, sz: 4 + Math.random() * 4, life: 1 }); }
}
function _drawMomoCursor(canvas, ctx, W, H, t) {
  const fresh = _drawMomoCursor._lt === undefined;
  if (!fresh && t - _drawMomoCursor._lt < 0.016) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawMomoCursor._lt, 0.05);
  _drawMomoCursor._lt = t;
  ctx.clearRect(0, 0, W, H);
  const px = _moX, py = _moY;
  _moX += (_moMX - _moX) * Math.min(1, dt * 9);
  _moY += (_moMY - _moY) * Math.min(1, dt * 9);
  const vx = _moX - px, vy = _moY - py, faceLeft = vx < -0.4;
  let ctilt = Math.max(-0.4, Math.min(0.4, vy * 0.02)); if (faceLeft) ctilt = -ctilt;
  // shed a feather now and then
  if (_moFeathers.length < 80 && Math.random() < 0.18) _moFeathers.push({ x: _moX - 6, y: _moY + 4, vx: (Math.random() - 0.5) * 12, vy: 8 + Math.random() * 14, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2, sz: 3 + Math.random() * 3, life: 1 });
  for (let i = _moFeathers.length - 1; i >= 0; i--) {
    const p = _moFeathers[i]; p.x += (p.vx + Math.sin(t * 2 + p.rot) * 8) * dt; p.y += p.vy * dt; p.vy += 26 * dt; p.rot += p.vr * dt; p.life -= dt * 0.7;
    if (p.life <= 0) { _moFeathers.splice(i, 1); continue; }
    _moFeatherDraw(ctx, p);
  }
  _moCrow(ctx, _moX, _moY, 13, Math.sin(t * 13), faceLeft, ctilt, 1);
}
function _startMomoOverlay() {
  _stopMomoOverlay();
  _drawMomoCursor._lt = undefined; _moFeathers = []; _moX = _moMX; _moY = _moMY;
  window.addEventListener('mousemove', _moMouseMove);
  window.addEventListener('click', _moClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'momo-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('momo-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) { cv2.width = window.innerWidth; cv2.height = window.innerHeight; }
    _drawMomoCursor(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _momoOverlayRafId = requestAnimationFrame(frame);
  }
  _momoOverlayRafId = requestAnimationFrame(frame);
}
function _stopMomoOverlay() {
  if (_momoOverlayRafId) { cancelAnimationFrame(_momoOverlayRafId); _momoOverlayRafId = null; }
  window.removeEventListener('mousemove', _moMouseMove);
  window.removeEventListener('click', _moClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('momo-overlay'); if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// RONNETTE — "I Can't Fix You" (Living Tombstone / Mangle vibes): a fiery
// ORANGE scene strewn with dark silhouettes of robot scrap — tangled wires,
// claws, gears, endoskeleton hands — with white flickering flames, glowing
// eyes peering from the junk, sparks, and a failing-light flicker. The cursor
// is a wrench (you can't fix it) trailing sparks.
// ════════════════════════════════════════════════════════════════
const _RONNETTE_RE = /^Ronnette$/i;
function _isRonnette(c) { return !!(c && c.name && _RONNETTE_RE.test(c.name)); }
let _ronnetteOverlayRafId = null;
let _roMX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
let _roMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
let _roSparks = [];
const _RO_DARK = '#0a0a0c';
function _roWire(g, x, y, len, ang, width, seed) {
  const rng = _aetherRng(seed);
  g.lineWidth = width; g.lineCap = 'round'; g.strokeStyle = _RO_DARK;
  let cx = x, cy = y, ca = ang; g.beginPath(); g.moveTo(cx, cy);
  const segs = 4 + (rng() * 4 | 0);
  for (let i = 0; i < segs; i++) { const sl = len / segs; ca += (rng() - 0.5) * 1.5; const nx = cx + Math.cos(ca) * sl, ny = cy + Math.sin(ca) * sl, mx = cx + Math.cos(ca - 0.6) * sl * 0.6, my = cy + Math.sin(ca - 0.6) * sl * 0.6; g.quadraticCurveTo(mx, my, nx, ny); cx = nx; cy = ny; }
  g.stroke();
}
function _roShard(g, x, y, s, seed) { const rng = _aetherRng(seed); g.fillStyle = _RO_DARK; g.beginPath(); const n = 4 + (rng() * 3 | 0); for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + rng() * 0.4, rr = s * (0.5 + rng() * 0.7); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.85; i === 0 ? g.moveTo(px, py) : g.lineTo(px, py); } g.closePath(); g.fill(); }
function _roGear(g, x, y, r, teeth) { g.fillStyle = _RO_DARK; g.beginPath(); for (let i = 0; i < teeth * 2; i++) { const rr = i % 2 ? r : r * 1.28, a = i / (teeth * 2) * 6.2832; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i === 0 ? g.moveTo(px, py) : g.lineTo(px, py); } g.closePath(); g.fill(); g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x, y, r * 0.42, 0, 6.2832); g.fill(); g.restore(); }
// a real mechanical claw: forearm + palm joint + three curved tapered talons
function _roTalon(g, x, y, s, ang) {
  g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = _RO_DARK;
  g.beginPath(); g.moveTo(-s * 0.2, -s * 0.28); g.lineTo(-s * 1.7, -s * 0.16); g.lineTo(-s * 1.7, s * 0.16); g.lineTo(-s * 0.2, s * 0.28); g.closePath(); g.fill();
  g.beginPath(); g.arc(0, 0, s * 0.34, 0, 6.2832); g.fill();
  for (let k = 0; k < 3; k++) {
    g.save(); g.rotate(-0.55 + k * 0.55);
    g.beginPath();
    g.moveTo(-s * 0.12, -s * 0.18);
    g.quadraticCurveTo(s * 0.28, -s * 0.7, s * 0.16, -s * 1.22);
    g.quadraticCurveTo(s * 0.02, -s * 1.28, -s * 0.08, -s * 1.16);
    g.quadraticCurveTo(s * 0.06, -s * 0.62, -s * 0.28, -s * 0.12);
    g.closePath(); g.fill();
    g.restore();
  }
  g.restore();
}
// a drooping cable hanging from (x,y), drifting + curling, with a connector end
function _roCable(g, x, y, len, drift, width, seed) {
  const rng = _aetherRng(seed);
  g.strokeStyle = _RO_DARK; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x, y);
  let cx = x, cy = y; const segs = 3 + (rng() * 2 | 0);
  for (let i = 0; i < segs; i++) {
    const ny = y + len * ((i + 1) / segs), nx = cx + drift * (8 + rng() * 24) + (rng() - 0.5) * 16;
    const mx = (cx + nx) / 2 + drift * 12, my = (cy + ny) / 2 + len / segs * 0.45;
    g.quadraticCurveTo(mx, my, nx, ny); cx = nx; cy = ny;
  }
  g.stroke();
  g.fillStyle = _RO_DARK; g.beginPath(); g.arc(cx, cy, width * 0.85, 0, 6.2832); g.fill();
}
function _roEndoHand(g, x, y, s, ang) {
  g.save(); g.translate(x, y); g.rotate(ang); g.strokeStyle = _RO_DARK; g.fillStyle = _RO_DARK; g.lineCap = 'round';
  g.beginPath(); g.arc(0, 0, s * 0.4, 0, 6.2832); g.fill();
  for (const a of [-0.65, -0.22, 0.22, 0.65]) { g.save(); g.rotate(a); g.lineWidth = s * 0.14; g.beginPath(); g.moveTo(0, -s * 0.3); g.lineTo(0, -s * 0.95); g.stroke(); g.beginPath(); g.arc(0, -s * 0.58, s * 0.1, 0, 6.2832); g.fill(); g.beginPath(); g.arc(0, -s * 0.95, s * 0.08, 0, 6.2832); g.fill(); g.restore(); }
  g.restore();
}
// a flickering flame: a tall tongue that tapers to a wavy point, its sides
// rippling into licks and the lean growing toward the tip.
function _roFlame(ctx, x, baseY, w, h, t, seed, col) {
  const flick = 0.82 + 0.18 * Math.sin(t * 7 + seed) + 0.1 * Math.sin(t * 13 + seed * 1.7);
  const hh = h * flick, steps = 16;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  for (let i = 1; i <= steps; i++) {                       // up the LEFT edge
    const f = i / steps;
    const taper = Math.pow(1 - f, 0.85) * (0.72 + 0.28 * Math.sin(f * 9 - t * 6 + seed));
    const sway = Math.sin(f * 4 + t * 5 + seed) * w * 0.4 * f;
    ctx.lineTo(x - w * 0.5 * taper + sway, baseY - hh * f);
  }
  for (let i = steps - 1; i >= 0; i--) {                   // down the RIGHT edge
    const f = i / steps;
    const taper = Math.pow(1 - f, 0.85) * (0.72 + 0.28 * Math.sin(f * 9 - t * 6 + seed));
    const sway = Math.sin(f * 4 + t * 5 + seed) * w * 0.4 * f;
    ctx.lineTo(x + w * 0.5 * taper + sway, baseY - hh * f);
  }
  ctx.closePath(); ctx.fill();
}
// A deliberately composed silhouette: a ragged dark "ceiling" and "floor" of
// broken machinery frame the scene, cables drape from the ceiling, and a few
// bold claws/cogs reach in from the corners — leaving a clean centre for fire.
function _roBuildScraps(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); const S = Math.min(W, H);
  g.fillStyle = _RO_DARK;
  // CEILING — ragged dark band, dipping low at the corners
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H * 0.24);
  g.bezierCurveTo(W * 0.86, H * 0.1, W * 0.8, H * 0.18, W * 0.7, H * 0.08);
  g.bezierCurveTo(W * 0.62, H * 0.15, W * 0.56, H * 0.05, W * 0.5, H * 0.07);
  g.bezierCurveTo(W * 0.43, H * 0.05, W * 0.37, H * 0.13, W * 0.3, H * 0.06);
  g.bezierCurveTo(W * 0.22, H * 0.14, W * 0.14, H * 0.08, W * 0.05, H * 0.16);
  g.lineTo(0, H * 0.24); g.closePath(); g.fill();
  // FLOOR — low ragged ground with mounds in the corners
  g.beginPath(); g.moveTo(0, H); g.lineTo(W, H); g.lineTo(W, H * 0.8);
  g.bezierCurveTo(W * 0.86, H * 0.98, W * 0.8, H * 0.88, W * 0.7, H * 0.98);
  g.bezierCurveTo(W * 0.6, H * 0.93, W * 0.5, H * 1.0, W * 0.4, H * 0.96);
  g.bezierCurveTo(W * 0.3, H * 1.0, W * 0.2, H * 0.9, W * 0.1, H * 0.98);
  g.lineTo(0, H * 0.82); g.closePath(); g.fill();
  // cables draping from the ceiling (longer/denser toward the corners)
  [0.04, 0.1, 0.17, 0.25, 0.5, 0.75, 0.83, 0.9, 0.96].forEach((fx, i) => {
    const corner = Math.max(0, 1 - Math.min(fx, 1 - fx) / 0.3);
    const cy = H * (0.05 + 0.04 * Math.sin(fx * 22)) + corner * H * 0.08;
    _roCable(g, fx * W, cy + H * 0.02, H * (0.12 + corner * 0.42 + (i % 2) * 0.06), fx < 0.5 ? -1 : 1, S * (0.013 + corner * 0.01), 600 + i);
  });
  // bold focal robot parts in the corners
  _roTalon(g, W * 0.9, H * 0.17, S * 0.2, 2.3);        // top-right: big claw reaching down-left
  _roGear(g, W * 0.98, H * 0.05, S * 0.075, 11);
  _roEndoHand(g, W * 0.8, H * 0.3, S * 0.13, -0.4);
  _roGear(g, W * 0.72, H * 0.13, S * 0.045, 9);
  _roShard(g, W * 0.16, H * 0.07, S * 0.09, 5);        // top-left plate
  _roTalon(g, W * 0.08, H * 0.88, S * 0.16, -0.7);     // bottom-left claw
  _roGear(g, W * 0.94, H * 0.92, S * 0.065, 10);
  _roTalon(g, W * 0.95, H * 0.8, S * 0.15, 3.5);       // bottom-right claw
  // a couple of cables draping into the bottom corners
  _roCable(g, W * 0.06, H * 0.78, H * 0.18, 1, S * 0.014, 700);
  _roCable(g, W * 0.94, H * 0.74, H * 0.2, -1, S * 0.014, 701);
  return c;
}
// the broken animatronic head hanging & swaying from a cable — the centerpiece.
// Fox-ish skull, bent ears, a dangling jaw, severed neck wires, a glowing eye.
function _roMangleHead(ctx, t, W, H) {
  const ax = W * 0.5, ay = -H * 0.03, L = H * 0.3;
  const ang = Math.sin(t * 0.7) * 0.13 + Math.sin(t * 1.9) * 0.04;
  const hx = ax + Math.sin(ang) * L, hy = ay + Math.cos(ang) * L, s = H * 0.085;
  ctx.save();
  ctx.strokeStyle = _RO_DARK; ctx.lineWidth = Math.max(3, H * 0.006); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + hx) / 2, (ay + hy) / 2, hx, hy); ctx.stroke();
  ctx.translate(hx, hy); ctx.rotate(ang * 1.2);
  ctx.fillStyle = _RO_DARK; ctx.strokeStyle = _RO_DARK;
  // severed neck wires reaching up toward the cable
  ctx.lineWidth = s * 0.08; ctx.lineCap = 'round';
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * s * 0.12, -s * 0.6); ctx.quadraticCurveTo(k * s * 0.22 + Math.sin(t * 3 + k) * 4, -s * 1.0, k * s * 0.32, -s * 1.25); ctx.stroke(); }
  // skull
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.85, s * 0.95, 0, 0, 6.2832); ctx.fill();
  // ears (one upright, one bent)
  ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.5); ctx.lineTo(-s * 0.88, -s * 1.25); ctx.lineTo(-s * 0.18, -s * 0.72); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(s * 0.45, -s * 0.55); ctx.lineTo(s * 1.0, -s * 0.95); ctx.lineTo(s * 0.78, -s * 1.1); ctx.lineTo(s * 0.7, -s * 0.45); ctx.closePath(); ctx.fill();
  // snout pointing down-front
  ctx.beginPath(); ctx.moveTo(-s * 0.42, s * 0.45); ctx.quadraticCurveTo(-s * 0.25, s * 1.35, s * 0.08, s * 1.5); ctx.quadraticCurveTo(s * 0.5, s * 1.25, s * 0.52, s * 0.55); ctx.closePath(); ctx.fill();
  // dangling lower jaw (swings with lag)
  const jaw = 0.2 + Math.sin(t * 1.5 + 1) * 0.12;
  ctx.save(); ctx.translate(s * 0.05, s * 1.0); ctx.rotate(jaw);
  ctx.beginPath(); ctx.moveTo(-s * 0.32, 0); ctx.quadraticCurveTo(-s * 0.05, s * 0.85, s * 0.42, s * 0.4); ctx.lineTo(s * 0.22, -s * 0.02); ctx.closePath(); ctx.fill();
  ctx.restore();
  // glowing flickering eye
  const blink = Math.abs(Math.sin(t * 0.9)) > 0.1 ? (0.7 + 0.3 * Math.sin(t * 9)) : 0.15;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const eg = ctx.createRadialGradient(s * 0.18, -s * 0.05, 0, s * 0.18, -s * 0.05, s * 0.8);
  eg.addColorStop(0, `rgba(255,170,60,${0.9 * blink})`); eg.addColorStop(0.5, `rgba(255,110,30,${0.4 * blink})`); eg.addColorStop(1, 'rgba(255,110,30,0)');
  ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(s * 0.18, -s * 0.05, s * 0.8, 0, 6.2832); ctx.fill();
  ctx.fillStyle = `rgba(255,240,205,${blink})`; ctx.beginPath(); ctx.arc(s * 0.18, -s * 0.05, s * 0.17, 0, 6.2832); ctx.fill();
  ctx.restore();
  ctx.restore();
}
function _drawRonnettePattern(canvas, ctx, W, H, t) {
  const fresh = _drawRonnettePattern._lt === undefined;
  if (!fresh && t - _drawRonnettePattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawRonnettePattern._lt, 0.05);
  _drawRonnettePattern._lt = t;
  if (canvas._roW !== W || canvas._roH !== H || !canvas._roScraps) {
    canvas._roW = W; canvas._roH = H;
    canvas._roScraps = _roBuildScraps(W, H);
    canvas._roFlames = Array.from({ length: 12 }, () => ({ x: W * (0.04 + Math.random() * 0.92), base: H * (0.9 + Math.random() * 0.12), w: W * (0.022 + Math.random() * 0.03), h: H * (0.22 + Math.random() * 0.34), seed: Math.random() * 100 }));
    canvas._roEyes = Array.from({ length: 3 }, () => ({ x: W * (0.7 + Math.random() * 0.28), y: H * (0.06 + Math.random() * 0.34), r: S0(W, H) * 0.008 + Math.random() * 3, ph: Math.random() * 6.28 }));
    canvas._roSmoke = Array.from({ length: 10 }, () => ({ x: Math.random() * W, y: H * (0.5 + Math.random() * 0.5), vy: -(10 + Math.random() * 22), r: W * (0.03 + Math.random() * 0.05), a: 0.05 + Math.random() * 0.06 }));
    canvas._roEmbers = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: H * (0.5 + Math.random() * 0.55), vy: -(22 + Math.random() * 46), r: 0.6 + Math.random() * 1.9, ph: Math.random() * 6.28, drift: Math.random() * 6.28 }));
  }
  // 1 ── orange firelit background (flickering brightness)
  const flick = 1 + Math.sin(t * 24) * 0.04 + Math.sin(t * 7) * 0.03;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#3a1604'); bg.addColorStop(0.45, `rgb(${168 * flick | 0},${74 * flick | 0},14)`); bg.addColorStop(0.8, `rgb(${214 * flick | 0},${104 * flick | 0},26)`); bg.addColorStop(1, '#7a3208');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // 2 ── white flames + warm under-glow
  ctx.globalCompositeOperation = 'lighter';
  for (const f of canvas._roFlames) { const gg = ctx.createRadialGradient(f.x, f.base - f.h * 0.4, 0, f.x, f.base - f.h * 0.4, f.w * 3); gg.addColorStop(0, 'rgba(255,180,90,0.18)'); gg.addColorStop(1, 'rgba(255,180,90,0)'); ctx.fillStyle = gg; ctx.fillRect(f.x - f.w * 3, f.base - f.h * 2, f.w * 6, f.h * 2.5); }
  ctx.globalCompositeOperation = 'source-over';
  for (const f of canvas._roFlames) { _roFlame(ctx, f.x, f.base, f.w, f.h, t, f.seed, '#f4efe6'); _roFlame(ctx, f.x, f.base, f.w * 0.6, f.h * 0.78, t * 1.1, f.seed + 3, '#fffdf8'); }
  // 3 ── drifting smoke
  ctx.globalCompositeOperation = 'lighter';
  for (const sm of canvas._roSmoke) { sm.y += sm.vy * dt; sm.x += Math.sin(t * 0.5 + sm.y) * 6 * dt; if (sm.y < -sm.r) { sm.y = H + sm.r; sm.x = Math.random() * W; } const sg = ctx.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, sm.r); sg.addColorStop(0, `rgba(60,30,12,${sm.a})`); sg.addColorStop(1, 'rgba(60,30,12,0)'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sm.x, sm.y, sm.r, 0, 6.2832); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  // 4 ── dark robot scrap (framing, in front of the flames)
  ctx.drawImage(canvas._roScraps, 0, 0);
  // 4b ── fire-glow rim light: warms the lower edges of the scrap from below
  ctx.globalCompositeOperation = 'lighter';
  const rim = ctx.createRadialGradient(W * 0.5, H * 1.02, 0, W * 0.5, H * 1.02, Math.max(W, H) * 0.7);
  rim.addColorStop(0, `rgba(255,140,50,${0.14 + 0.04 * Math.sin(t * 5)})`); rim.addColorStop(0.5, 'rgba(255,120,40,0.05)'); rim.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = rim; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  // 4c ── the hanging, swaying mangled head (centerpiece)
  _roMangleHead(ctx, t, W, H);
  // 4d ── embers rising from the fire
  ctx.globalCompositeOperation = 'lighter';
  for (const em of canvas._roEmbers) {
    em.y += em.vy * dt; em.x += Math.sin(t * 0.8 + em.drift) * 14 * dt; em.vy *= 0.998;
    if (em.y < H * 0.08) { em.y = H * (0.92 + Math.random() * 0.08); em.x = Math.random() * W; em.vy = -(22 + Math.random() * 46); }
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 4 + em.ph));
    ctx.fillStyle = `rgba(255,${150 + 60 * tw | 0},60,${tw})`;
    ctx.beginPath(); ctx.arc(em.x, em.y, em.r, 0, 6.2832); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // 5 ── glowing eyes peering from the junk
  ctx.globalCompositeOperation = 'lighter';
  for (const e of canvas._roEyes) { const blink = Math.abs(Math.sin(t * 0.8 + e.ph)) > 0.12 ? 1 : 0.1; const eg = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4); eg.addColorStop(0, `rgba(255,170,60,${0.85 * blink})`); eg.addColorStop(0.5, `rgba(255,120,30,${0.4 * blink})`); eg.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 4, 0, 6.2832); ctx.fill(); ctx.fillStyle = `rgba(255,235,200,${blink})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, 6.2832); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  // 6 ── failing-light flicker (occasional dark dip / orange surge)
  if (Math.random() < 0.05) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H); }
  else if (Math.random() < 0.04) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,130,40,0.1)'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  // 7 ── vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.82);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
function S0(W, H) { return Math.min(W, H); }

// ── wrench cursor (trails sparks; click = spark burst) ──
function _roMouseMove(e) { _roMX = e.clientX; _roMY = e.clientY; }
function _roClick() {
  for (let i = 0; i < 18; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, s = 80 + Math.random() * 240; _roSparks.push({ x: _roMX, y: _roMY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, r: 0.8 + Math.random() * 2, hot: Math.random() < 0.5 }); }
}
function _roWrench(ctx, x, y, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.lineJoin = 'round'; ctx.strokeStyle = '#141418'; ctx.lineWidth = 1.4;
  const mg = ctx.createLinearGradient(-7, 0, 7, 0); mg.addColorStop(0, '#34343a'); mg.addColorStop(0.5, '#5a5a64'); mg.addColorStop(1, '#2a2a30');
  ctx.fillStyle = mg;
  // open-end head (jaws) near the hotspot
  ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(-7, -9); ctx.lineTo(-2.4, -9); ctx.lineTo(-2.4, -3.5); ctx.lineTo(2.4, -3.5); ctx.lineTo(2.4, -9); ctx.lineTo(7, -9); ctx.lineTo(7, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
  // handle
  ctx.beginPath(); ctx.moveTo(-3.2, 3); ctx.lineTo(3.2, 3); ctx.lineTo(2.6, 27); ctx.lineTo(-2.6, 27); ctx.closePath(); ctx.fill(); ctx.stroke();
  // box-end ring
  ctx.beginPath(); ctx.arc(0, 31, 5.4, 0, 6.2832); ctx.fill(); ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(0, 31, 2.6, 0, 6.2832); ctx.fill(); ctx.restore();
  // highlight
  ctx.fillStyle = 'rgba(210,210,220,0.3)'; ctx.fillRect(-1.6, 5, 1.4, 20);
  ctx.restore();
}
function _drawRonnetteCursor(canvas, ctx, W, H, t) {
  const fresh = _drawRonnetteCursor._lt === undefined;
  if (!fresh && t - _drawRonnetteCursor._lt < 0.016) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawRonnetteCursor._lt, 0.05);
  _drawRonnetteCursor._lt = t;
  ctx.clearRect(0, 0, W, H);
  // occasional spark drip from the wrench
  if (_roSparks.length < 160 && Math.random() < 0.25) _roSparks.push({ x: _roMX + (Math.random() - 0.5) * 6, y: _roMY + 4, vx: (Math.random() - 0.5) * 30, vy: 20 + Math.random() * 40, life: 1, r: 0.7 + Math.random() * 1.6, hot: Math.random() < 0.4 });
  ctx.globalCompositeOperation = 'lighter';
  for (let i = _roSparks.length - 1; i >= 0; i--) {
    const s = _roSparks[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 320 * dt; s.life -= dt * 1.5;
    if (s.life <= 0) { _roSparks.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, s.life); ctx.fillStyle = s.hot ? '#fff2c0' : '#ff9a30';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // a soft warm glow + the wrench (slight idle sway)
  const gl = ctx.createRadialGradient(_roMX, _roMY, 0, _roMX, _roMY, 24);
  gl.addColorStop(0, 'rgba(255,150,60,0.22)'); gl.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(_roMX, _roMY, 24, 0, 6.2832); ctx.fill();
  _roWrench(ctx, _roMX, _roMY, -0.5 + Math.sin(t * 2) * 0.08);
}
function _startRonnetteOverlay() {
  _stopRonnetteOverlay();
  _drawRonnetteCursor._lt = undefined; _roSparks = [];
  window.addEventListener('mousemove', _roMouseMove);
  window.addEventListener('click', _roClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'ronnette-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('ronnette-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) { cv2.width = window.innerWidth; cv2.height = window.innerHeight; }
    _drawRonnetteCursor(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _ronnetteOverlayRafId = requestAnimationFrame(frame);
  }
  _ronnetteOverlayRafId = requestAnimationFrame(frame);
}
function _stopRonnetteOverlay() {
  if (_ronnetteOverlayRafId) { cancelAnimationFrame(_ronnetteOverlayRafId); _ronnetteOverlayRafId = null; }
  window.removeEventListener('mousemove', _roMouseMove);
  window.removeEventListener('click', _roClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('ronnette-overlay'); if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// MIAMI — full Frutiger Aero: glossy blue skies, turquoise water and lush green,
// fluffy clouds, a bright sun with god-rays, glassy rising bubbles, drifting
// bokeh, swaying grass, and sparkles. The cursor is a glossy water bubble that
// trails bubbles and pops into a ripple on click.
// ════════════════════════════════════════════════════════════════
const _MIAMI_RE = /^Miami$/i;
function _isMiami(c) { return !!(c && c.name && _MIAMI_RE.test(c.name)); }
let _miamiOverlayRafId = null;
let _miMX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
let _miMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
let _miTrail = [], _miRipples = [];
function _miBubble(ctx, x, y, r, alpha) {
  ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.7, 'rgba(170,235,255,0.08)'); g.addColorStop(1, 'rgba(120,220,255,0.2)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(0.8, r * 0.06); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.ellipse(x - r * 0.34, y - r * 0.4, r * 0.24, r * 0.14, -0.6, 0, 6.2832); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x + r * 0.3, y + r * 0.28, r * 0.09, 0, 6.2832); ctx.fill();
  ctx.restore();
}
function _miBokeh(ctx, x, y, r, hue, alpha) {
  const g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r);
  g.addColorStop(0, `hsla(${hue},85%,82%,${alpha * 0.28})`); g.addColorStop(0.82, `hsla(${hue},85%,86%,${alpha * 0.5})`); g.addColorStop(1, `hsla(${hue},85%,86%,0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
}
function _miCloud(g, x, y, s) {
  const puffs = [[-0.72, 0.16, 0.52], [-0.28, 0.2, 0.6], [0.28, 0.2, 0.6], [0.72, 0.16, 0.5], [-0.42, -0.16, 0.58], [0.12, -0.32, 0.7], [0.46, -0.1, 0.54]];
  g.fillStyle = 'rgba(188,224,246,0.9)';
  for (const [dx, dy, r] of puffs) { g.beginPath(); g.arc(x + dx * s, y + dy * s + s * 0.07, r * s, 0, 6.2832); g.fill(); }
  g.fillStyle = '#ffffff';
  for (const [dx, dy, r] of puffs) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, 6.2832); g.fill(); }
}
function _miLeaf(g, x, y, s, ang) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const grad = g.createLinearGradient(0, -s, 0, s); grad.addColorStop(0, '#86e35e'); grad.addColorStop(1, '#2e9e4f');
  g.fillStyle = grad;
  g.beginPath(); g.moveTo(0, -s); g.bezierCurveTo(s * 0.72, -s * 0.4, s * 0.6, s * 0.62, 0, s); g.bezierCurveTo(-s * 0.6, s * 0.62, -s * 0.72, -s * 0.4, 0, -s); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(20,80,40,0.4)'; g.lineWidth = s * 0.035; g.beginPath(); g.moveTo(0, -s * 0.85); g.lineTo(0, s * 0.85); g.stroke();
  for (let k = -2; k <= 2; k++) { if (!k) continue; const fy = k * s * 0.28; g.beginPath(); g.moveTo(0, fy); g.lineTo(Math.sign(k) * s * 0.0 + s * 0.32 * (k > 0 ? 1 : -1), fy + s * 0.22); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(-s * 0.2, -s * 0.18, s * 0.16, s * 0.5, -0.3, 0, 6.2832); g.fill();
  g.restore();
}
function _miGrass(g, x, baseY, h, bend, col) {
  g.fillStyle = col; g.beginPath(); g.moveTo(x - h * 0.06, baseY);
  g.quadraticCurveTo(x + bend * 0.5, baseY - h * 0.55, x + bend, baseY - h);
  g.quadraticCurveTo(x + bend * 0.5, baseY - h * 0.5, x + h * 0.06, baseY);
  g.closePath(); g.fill();
}
function _miBuildScene(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); const S = Math.min(W, H);
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2ea3e6'); sky.addColorStop(0.32, '#5cc6ec'); sky.addColorStop(0.52, '#88e4d4'); sky.addColorStop(0.64, '#a3ea9e'); sky.addColorStop(0.82, '#4fbf66'); sky.addColorStop(1, '#2c9446');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // sun + glow
  const sx = W * 0.24, sy = H * 0.15, sr = S * 0.14;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr * 4.5);
  sg.addColorStop(0, 'rgba(255,255,255,0.9)'); sg.addColorStop(0.2, 'rgba(255,255,245,0.5)'); sg.addColorStop(1, 'rgba(255,255,220,0)');
  g.fillStyle = sg; g.fillRect(0, 0, W, H * 0.6);
  g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(sx, sy, sr * 0.45, 0, 6.2832); g.fill();
  // clouds
  _miCloud(g, W * 0.6, H * 0.16, S * 0.1); _miCloud(g, W * 0.83, H * 0.3, S * 0.07); _miCloud(g, W * 0.42, H * 0.09, S * 0.06); _miCloud(g, W * 0.1, H * 0.34, S * 0.055);
  // glossy leaves framing the lower corners
  _miLeaf(g, W * 0.05, H * 0.56, S * 0.15, -0.5); _miLeaf(g, W * 0.97, H * 0.5, S * 0.14, 0.5); _miLeaf(g, W * 0.92, H * 0.64, S * 0.1, 1.05); _miLeaf(g, W * 0.12, H * 0.68, S * 0.09, -1.0);
  // grass field
  const gy = H * 0.88; g.fillStyle = '#2c9446'; g.fillRect(0, gy, W, H - gy);
  const rng = _aetherRng(321), step = Math.max(8, W / 130);
  for (let x = 0; x < W; x += step) { const bx = x + rng() * step, h = H * (0.05 + rng() * 0.1), bend = (rng() - 0.5) * h * 0.5, sh = 0.7 + rng() * 0.35; g.fillStyle = `rgb(${48 * sh | 0},${158 * sh | 0},${70 * sh | 0})`; _miGrass(g, bx, gy + H * 0.02, h, bend); }
  return c;
}
function _drawMiamiPattern(canvas, ctx, W, H, t) {
  const fresh = _drawMiamiPattern._lt === undefined;
  if (!fresh && t - _drawMiamiPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawMiamiPattern._lt, 0.05);
  _drawMiamiPattern._lt = t;
  const S = Math.min(W, H);
  if (canvas._miW !== W || canvas._miH !== H || !canvas._miBg) {
    canvas._miW = W; canvas._miH = H;
    canvas._miBg = _miBuildScene(W, H);
    canvas._miBubbles = Array.from({ length: 26 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: S * (0.008 + Math.random() * 0.03), vy: -(14 + Math.random() * 40), wob: Math.random() * 6.28, ws: 0.5 + Math.random() }));
    canvas._miBokeh = Array.from({ length: 16 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: S * (0.03 + Math.random() * 0.08), vy: -(6 + Math.random() * 14), hue: 150 + Math.random() * 70, ph: Math.random() * 6.28 }));
    canvas._miSpark = Array.from({ length: 18 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.7, ph: Math.random() * 6.28, sp: 1 + Math.random() * 2 }));
    canvas._miGrassF = Array.from({ length: 16 }, () => ({ x: Math.random() * W, h: H * (0.1 + Math.random() * 0.12), ph: Math.random() * 6.28, col: `rgb(${40 + Math.random() * 20 | 0},${150 + Math.random() * 40 | 0},${64 + Math.random() * 20 | 0})` }));
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(canvas._miBg, 0, 0);
  const sx = W * 0.24, sy = H * 0.15;
  // god-rays from the sun
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(sx, sy);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 6.2832 + t * 0.06, flick = 0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.3), len = Math.max(W, H) * 0.9, wd = 0.018 + 0.014 * flick;
    const rg = ctx.createLinearGradient(0, 0, len, 0); rg.addColorStop(0, `rgba(255,255,240,${0.04 + 0.05 * flick})`); rg.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.save(); ctx.rotate(a); ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -len * wd); ctx.lineTo(len, len * wd); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  // drifting bokeh
  ctx.globalCompositeOperation = 'lighter';
  for (const b of canvas._miBokeh) { b.y += b.vy * dt; b.x += Math.sin(t * 0.3 + b.ph) * 10 * dt; if (b.y < -b.r) { b.y = H + b.r; b.x = Math.random() * W; } _miBokeh(ctx, b.x, b.y, b.r, b.hue, 0.6 + 0.4 * Math.sin(t * 0.7 + b.ph)); }
  ctx.globalCompositeOperation = 'source-over';
  // swaying foreground grass
  const gy = H * 0.9;
  for (const gr of canvas._miGrassF) _miGrass(ctx, gr.x, gy + H * 0.04, gr.h, Math.sin(t * 1.4 + gr.ph) * gr.h * 0.28, gr.col);
  // rising glossy bubbles
  for (const bu of canvas._miBubbles) { bu.y += bu.vy * dt; bu.x += Math.sin(t * bu.ws + bu.wob) * 16 * dt; if (bu.y < -bu.r) { bu.y = H + bu.r; bu.x = Math.random() * W; } _miBubble(ctx, bu.x, bu.y, bu.r, 0.85); }
  // sparkles / lens flares
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffffff';
  for (const sp of canvas._miSpark) { const tw = Math.pow(Math.abs(Math.sin(t * sp.sp + sp.ph)), 4); if (tw < 0.05) continue; ctx.globalAlpha = tw; const r = 1 + tw * 3; ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, 6.2832); ctx.fill(); ctx.fillRect(sp.x - r * 3, sp.y - 0.5, r * 6, 1); ctx.fillRect(sp.x - 0.5, sp.y - r * 3, 1, r * 6); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // glossy diagonal sheen across the top
  const sh = ctx.createLinearGradient(0, 0, W * 0.5, H * 0.5);
  sh.addColorStop(0, 'rgba(255,255,255,0.12)'); sh.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H * 0.5);
}

// ── glossy bubble cursor ──
function _miMouseMove(e) { _miMX = e.clientX; _miMY = e.clientY; }
function _miClick() {
  _miRipples.push({ x: _miMX, y: _miMY, r: 6, life: 1 });
  for (let i = 0; i < 12; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * 160; _miTrail.push({ x: _miMX, y: _miMY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 2 + Math.random() * 5, life: 1 }); }
}
function _drawMiamiCursor(canvas, ctx, W, H, t) {
  const fresh = _drawMiamiCursor._lt === undefined;
  if (!fresh && t - _drawMiamiCursor._lt < 0.016) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawMiamiCursor._lt, 0.05);
  _drawMiamiCursor._lt = t;
  ctx.clearRect(0, 0, W, H);
  if (_miTrail.length < 90 && Math.random() < 0.6) _miTrail.push({ x: _miMX + (Math.random() - 0.5) * 10, y: _miMY + (Math.random() - 0.5) * 10, vx: (Math.random() - 0.5) * 14, vy: -(10 + Math.random() * 24), r: 1.5 + Math.random() * 4, life: 1 });
  for (let i = _miTrail.length - 1; i >= 0; i--) {
    const p = _miTrail[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 12 * dt; p.life -= dt * 0.8;
    if (p.life <= 0) { _miTrail.splice(i, 1); continue; }
    _miBubble(ctx, p.x, p.y, p.r, Math.min(1, p.life) * 0.85);
  }
  // ripples (click pops)
  for (let i = _miRipples.length - 1; i >= 0; i--) {
    const rp = _miRipples[i]; rp.r += 220 * dt; rp.life -= dt * 1.4;
    if (rp.life <= 0) { _miRipples.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(180,240,255,${Math.max(0, rp.life) * 0.7})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, 6.2832); ctx.stroke();
  }
  // the main glossy bubble
  const r = 14 + Math.sin(t * 2.5) * 1.2;
  const gl = ctx.createRadialGradient(_miMX, _miMY, 0, _miMX, _miMY, r * 2);
  gl.addColorStop(0, 'rgba(150,235,255,0.3)'); gl.addColorStop(1, 'rgba(150,235,255,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(_miMX, _miMY, r * 2, 0, 6.2832); ctx.fill();
  _miBubble(ctx, _miMX, _miMY, r, 1);
}
function _startMiamiOverlay() {
  _stopMiamiOverlay();
  _drawMiamiCursor._lt = undefined; _miTrail = []; _miRipples = [];
  window.addEventListener('mousemove', _miMouseMove);
  window.addEventListener('click', _miClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'miami-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('miami-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) { cv2.width = window.innerWidth; cv2.height = window.innerHeight; }
    _drawMiamiCursor(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _miamiOverlayRafId = requestAnimationFrame(frame);
  }
  _miamiOverlayRafId = requestAnimationFrame(frame);
}
function _stopMiamiOverlay() {
  if (_miamiOverlayRafId) { cancelAnimationFrame(_miamiOverlayRafId); _miamiOverlayRafId = null; }
  window.removeEventListener('mousemove', _miMouseMove);
  window.removeEventListener('click', _miClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('miami-overlay'); if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// JONI — a lush jungle (canopy, big leaves, hanging vines, god-rays, fireflies,
// mist). Bananas lie on the floor; the cursor is a hand that PICKS one up, and
// clicking PEELS it open strip by strip, then EATS it. They respawn.
// ════════════════════════════════════════════════════════════════
const _JONI_RE = /^Joni$/i;
function _isJoni(c) { return !!(c && c.name && _JONI_RE.test(c.name)); }
let _joniOverlayRafId = null;
let _joMX = (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
let _joMY = (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
let _joBananas = [], _joHeld = null, _joEatFx = [], _joRespawnT = 0;
// ── jungle scene helpers ──
// a big banana/tropical leaf — a paddle blade with a midrib and side veins
function _joFrond(g, x, baseY, len, ang, col) {
  g.save(); g.translate(x, baseY); g.rotate(ang);
  const wid = len * 0.34; g.fillStyle = col;
  g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(wid * 0.9, -len * 0.15, wid * 0.7, -len * 0.7, wid * 0.25, -len * 0.92);
  g.quadraticCurveTo(0, -len, -wid * 0.25, -len * 0.92);
  g.bezierCurveTo(-wid * 0.7, -len * 0.7, -wid * 0.9, -len * 0.15, 0, 0);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(10,30,12,0.55)'; g.lineWidth = len * 0.022; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(0, -len * 0.5, 0, -len * 0.92); g.stroke();
  g.lineWidth = len * 0.008;
  for (let i = 1; i <= 7; i++) { const f = i / 8, vy = -len * f, vw = wid * 0.72 * (1 - f * 0.5); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, vy); g.quadraticCurveTo(s * vw * 0.5, vy - vw * 0.15, s * vw, vy - vw * 0.35); g.stroke(); } }
  g.restore();
}
function _joLeaf(g, x, y, s, ang, col, dark) {
  g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = col;
  g.beginPath(); g.moveTo(0, -s); g.bezierCurveTo(s * 0.52, -s * 0.4, s * 0.42, s * 0.62, 0, s); g.bezierCurveTo(-s * 0.42, s * 0.62, -s * 0.52, -s * 0.4, 0, -s); g.closePath(); g.fill();
  g.strokeStyle = dark; g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(0, -s * 0.85); g.lineTo(0, s * 0.85); g.stroke();
  for (let k = -2; k <= 2; k++) { if (!k) continue; const fy = k * s * 0.28; g.beginPath(); g.moveTo(0, fy); g.lineTo((k > 0 ? 1 : -1) * s * 0.34, fy + s * 0.22); g.stroke(); }
  g.restore();
}
// a clean hanging vine: a smooth tapering tendril that wavers and curls, with
// leaflets that GROW from actual points on the vine (stem connects them on).
function _joVine(g, x, topY, len, col) {
  g.strokeStyle = col; g.lineCap = 'round';
  let cx = x, cy = topY, ca = Math.PI / 2; const segs = 9, pts = [[cx, cy]];
  for (let i = 0; i < segs; i++) {
    const f = i / segs; ca += Math.sin(i * 1.2 + x) * 0.2 + (i > segs - 3 ? 0.25 : 0);   // gentle waver + curl at the end
    const sl = len / segs, nx = cx + Math.cos(ca) * sl, ny = cy + Math.sin(ca) * sl;
    g.lineWidth = Math.max(1.5, len * 0.02 * (1 - f * 0.75));
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(nx, ny); g.stroke();
    cx = nx; cy = ny; pts.push([nx, ny]);
  }
  // leaflets anchored ON the vine: a short stem from the actual vine point, then a blade
  const ll = len * 0.06;
  for (let k = 0; k < pts.length; k++) {
    if (k < 2 || k % 2 === 1) continue;                       // a few, alternating
    const p = pts[k], pp = pts[k - 1];
    const dir = Math.atan2(p[1] - pp[1], p[0] - pp[0]);       // local vine direction
    const side = (k % 4 === 0) ? 1 : -1;
    g.save(); g.translate(p[0], p[1]); g.rotate(dir + side * 0.95);
    g.strokeStyle = col; g.lineWidth = Math.max(1, len * 0.012);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(ll * 0.7, 0); g.stroke();   // stem joining the vine
    g.fillStyle = col;                                                  // pointed leaflet at the stem's end
    g.beginPath(); g.moveTo(ll * 0.7, 0); g.quadraticCurveTo(ll * 1.5, -ll * 0.5, ll * 2.3, 0); g.quadraticCurveTo(ll * 1.5, ll * 0.5, ll * 0.7, 0); g.closePath(); g.fill();
    g.restore();
  }
}
// a leafy cluster of big leaves (used at branch tips for the canopy)
function _joLeafCluster(g, x, y, s, col) {
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.2832 + Math.random() * 0.5, d = s * (0.1 + Math.random() * 0.4); _joFrond(g, x + Math.cos(a) * d, y + Math.sin(a) * d, s * (0.7 + Math.random() * 0.6), a + 1.5708, col); }
}
// a recursive tree branch that ends in leaf clusters, occasionally dropping a vine
function _joBranch(g, x, y, ang, len, w, depth, brCol, leafCol, vineCol) {
  if (depth <= 0 || len < 16) { _joLeafCluster(g, x, y, len * 1.5 + 10, leafCol); return; }
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
  g.strokeStyle = brCol; g.lineWidth = Math.max(2, w); g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + ex) / 2 + (Math.random() - 0.5) * len * 0.2, (y + ey) / 2, ex, ey); g.stroke();
  if (depth === 2 && vineCol && Math.random() < 0.6) _joVine(g, ex, ey, len * 1.4, vineCol);
  for (let i = 0; i < 2; i++) { const da = (i === 0 ? -1 : 1) * (0.35 + Math.random() * 0.3); _joBranch(g, ex, ey, ang + da, len * 0.72, w * 0.66, depth - 1, brCol, leafCol, vineCol); }
  if (depth > 1 && Math.random() < 0.4) _joBranch(g, ex, ey, ang + (Math.random() - 0.5) * 0.5, len * 0.55, w * 0.5, depth - 1, brCol, leafCol, vineCol);
}
// a whole jungle tree: brown trunk with root flares + bark, leafy branching canopy
function _joTree(g, x, baseY, h, leafCol, vineCol) {
  const tw = h * 0.07, topY = baseY - h * 0.62, brCol = '#33271a';
  g.fillStyle = brCol;
  g.beginPath(); g.moveTo(x - tw * 2.6, baseY);
  g.quadraticCurveTo(x - tw * 1.1, baseY - h * 0.04, x - tw * 0.55, baseY - h * 0.4);
  g.quadraticCurveTo(x - tw * 0.5, baseY - h * 0.55, x - tw * 0.4, topY);
  g.lineTo(x + tw * 0.4, topY);
  g.quadraticCurveTo(x + tw * 0.5, baseY - h * 0.55, x + tw * 0.55, baseY - h * 0.4);
  g.quadraticCurveTo(x + tw * 1.1, baseY - h * 0.04, x + tw * 2.6, baseY);
  g.lineTo(x + tw * 1.5, baseY); g.quadraticCurveTo(x, baseY - h * 0.12, x - tw * 1.5, baseY);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(18,12,7,0.5)'; g.lineWidth = tw * 0.18; g.lineCap = 'round';
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * tw * 0.4, baseY - h * 0.1); g.quadraticCurveTo(x + i * tw * 0.5, baseY - h * 0.35, x + i * tw * 0.3, topY); g.stroke(); }
  _joBranch(g, x, topY, -Math.PI / 2 - 0.4, h * 0.34, tw * 1.1, 3, brCol, leafCol, vineCol);
  _joBranch(g, x, topY, -Math.PI / 2 + 0.4, h * 0.34, tw * 1.1, 3, brCol, leafCol, vineCol);
  _joBranch(g, x, topY - h * 0.04, -Math.PI / 2 + 0.05, h * 0.36, tw * 1.0, 3, brCol, leafCol, vineCol);
}
function _joBuildJungle(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); const S = Math.min(W, H);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#7bb84e'); grad.addColorStop(0.24, '#4f9a44'); grad.addColorStop(0.52, '#357a34'); grad.addColorStop(0.8, '#266026'); grad.addColorStop(1, '#1b461b');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const lg = g.createRadialGradient(W * 0.5, -H * 0.05, 10, W * 0.5, H * 0.45, Math.max(W, H) * 0.7);
  lg.addColorStop(0, 'rgba(225,255,170,0.32)'); lg.addColorStop(1, 'rgba(225,255,170,0)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H * 0.8);
  // far foliage haze blobs (depth)
  for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(${50 + Math.random() * 30 | 0},${110 + Math.random() * 40 | 0},${50 + Math.random() * 20 | 0},0.45)`; const lx = Math.random() * W, ly = H * (0.1 + Math.random() * 0.55), ls = S * (0.06 + Math.random() * 0.12); g.save(); g.translate(lx, ly); g.scale(1, 0.7); g.beginPath(); g.arc(0, 0, ls, 0, 6.2832); g.fill(); g.restore(); }
  // two big trees framing the sides (leafy canopies)
  _joTree(g, W * 0.86, H * 1.02, H * 1.0, '#236b23', '#1d4a1c');
  _joTree(g, W * 0.13, H * 1.02, H * 0.86, '#1f5f20', '#19421a');
  // canopy band along the very top
  g.fillStyle = '#143218';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, H * 0.1);
  for (let x = W; x >= 0; x -= W * 0.05) g.lineTo(x, H * (0.05 + 0.04 * Math.sin(x * 0.02)));
  g.lineTo(0, H * 0.1); g.closePath(); g.fill();
  for (let i = 0; i < 5; i++) _joVine(g, W * (0.2 + i * 0.16 + Math.random() * 0.04), H * 0.03, H * (0.2 + Math.random() * 0.28), '#1c3e1c');
  // big leaves ROOTED at the bottom edges (growing up, not floating)
  _joFrond(g, W * 0.02, H * 1.02, S * 0.36, 0.32, '#2e6a2e');
  _joFrond(g, W * 0.98, H * 1.0, S * 0.32, -0.34, '#2e6a2e');
  _joFrond(g, W * 0.3, H * 1.04, S * 0.18, 0.1, '#347e34');
  _joFrond(g, W * 0.55, H * 1.05, S * 0.16, -0.1, '#2f7030');
  // floor
  g.fillStyle = '#173612'; g.beginPath(); g.moveTo(0, H); g.lineTo(W, H); g.lineTo(W, H * 0.93);
  for (let x = W; x >= 0; x -= W * 0.08) g.lineTo(x, H * (0.93 + 0.02 * Math.sin(x * 0.03)));
  g.closePath(); g.fill();
  return c;
}
function _drawJoniPattern(canvas, ctx, W, H, t) {
  const fresh = _drawJoniPattern._lt === undefined;
  if (!fresh && t - _drawJoniPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawJoniPattern._lt, 0.05);
  _drawJoniPattern._lt = t;
  const S = Math.min(W, H);
  if (canvas._joW !== W || canvas._joH !== H || !canvas._joBg) {
    canvas._joW = W; canvas._joH = H;
    canvas._joBg = _joBuildJungle(W, H);
    canvas._joFlies = Array.from({ length: 22 }, () => ({ x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 0.7, amp: S * (0.02 + Math.random() * 0.05), r: 0.8 + Math.random() * 1.6 }));
    canvas._joMist = Array.from({ length: 6 }, () => ({ x: Math.random() * W, y: H * (0.55 + Math.random() * 0.4), r: W * (0.14 + Math.random() * 0.18), sp: 5 + Math.random() * 12, a: 0.04 + Math.random() * 0.05 }));
    canvas._joFronds = [
      { x: W * 0.03, y: H * 1.02, len: S * 0.34, base: 0.32, ph: Math.random() * 6.28 },
      { x: W * 0.98, y: H * 1.02, len: S * 0.34, base: -0.34, ph: Math.random() * 6.28 },
      { x: W * 0.48, y: H * 1.06, len: S * 0.24, base: 0.02, ph: Math.random() * 6.28 },
    ];
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.drawImage(canvas._joBg, 0, 0);
  // soft green-gold god rays
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(W * 0.5, -H * 0.05);
  for (let i = 0; i < 11; i++) { const a = Math.PI / 2 + (i - 5) * 0.16 + Math.sin(t * 0.1) * 0.05, flick = 0.5 + 0.5 * Math.sin(t * 0.6 + i), len = H * 1.1, wd = 0.02 + 0.015 * flick; const rg = ctx.createLinearGradient(0, 0, 0, len); rg.addColorStop(0, `rgba(220,255,160,${0.04 + 0.04 * flick})`); rg.addColorStop(1, 'rgba(220,255,160,0)'); ctx.save(); ctx.rotate(a - Math.PI / 2); ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-len * wd, len); ctx.lineTo(len * wd, len); ctx.closePath(); ctx.fill(); ctx.restore(); }
  ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  // mist
  ctx.globalCompositeOperation = 'lighter';
  for (const m of canvas._joMist) { m.x += m.sp * dt; if (m.x - m.r > W) m.x = -m.r; const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r); mg.addColorStop(0, `rgba(200,230,180,${m.a})`); mg.addColorStop(1, 'rgba(200,230,180,0)'); ctx.save(); ctx.translate(m.x, m.y); ctx.scale(1, 0.4); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(0, 0, m.r, 0, 6.2832); ctx.fill(); ctx.restore(); }
  ctx.globalCompositeOperation = 'source-over';
  // swaying foreground fronds (over the scene)
  for (const fr of canvas._joFronds) _joFrond(ctx, fr.x, fr.y, fr.len, fr.base + Math.sin(t * 0.8 + fr.ph) * 0.06, '#163a18');
  // glowing fireflies
  ctx.globalCompositeOperation = 'lighter';
  for (const f of canvas._joFlies) { const fx = f.x + Math.sin(t * f.sp + f.ph) * f.amp, fy = f.y + Math.cos(t * f.sp * 0.8 + f.ph) * f.amp * 0.7, tw = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + f.ph)); const gg = ctx.createRadialGradient(fx, fy, 0, fx, fy, f.r * 5); gg.addColorStop(0, `rgba(220,255,120,${0.9 * tw})`); gg.addColorStop(1, 'rgba(220,255,120,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(fx, fy, f.r * 5, 0, 6.2832); ctx.fill(); ctx.fillStyle = `rgba(245,255,200,${tw})`; ctx.beginPath(); ctx.arc(fx, fy, f.r, 0, 6.2832); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';

  // ── bananas live on THIS layer (behind the panels, so they never cover menus) ──
  const rect = canvas.getBoundingClientRect();
  const rx = rect.width ? W / rect.width : 1, ry = rect.height ? H / rect.height : 1;
  const pmx = (_joMX - rect.left) * rx, pmy = (_joMY - rect.top) * ry;
  if (!_joBananas.length) for (let i = 0; i < 6; i++) _joBananas.push(_joNewBanana(W, H));
  if (_joBananas.length < 6) { _joRespawnT -= dt; if (_joRespawnT <= 0) { _joBananas.push(_joNewBanana(W, H)); _joRespawnT = 1 + Math.random() * 2; } }
  for (const b of _joBananas) if (b !== _joHeld) _joBanana(ctx, b.x, b.y, b.rot, b.sc, b.peel);
  for (let i = _joEatFx.length - 1; i >= 0; i--) { const p = _joEatFx[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 240 * dt; p.life -= dt * 1.4; if (p.life <= 0) { _joEatFx.splice(i, 1); continue; } ctx.globalAlpha = Math.min(1, p.life); ctx.fillStyle = '#f6eecb'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (_joHeld) { _joHeld.x += (pmx + 18 - _joHeld.x) * Math.min(1, dt * 16); _joHeld.y += (pmy + 26 - _joHeld.y) * Math.min(1, dt * 16); _joBanana(ctx, _joHeld.x, _joHeld.y, 0.2, _joHeld.sc * 1.1, _joHeld.peel); }
}

// ── hand cursor (overlay) + pick-up/peel/eat handlers ──
function _joMouseMove(e) { _joMX = e.clientX; _joMY = e.clientY; }
function _joNewBanana(W, H) { return { x: W * (0.1 + Math.random() * 0.8), y: H * (0.74 + Math.random() * 0.2), rot: (Math.random() - 0.5) * 2, sc: 0.85 + Math.random() * 0.4, peel: 0 }; }
// a single curved banana body (a peel flap OR the fruit), hinged at (0,0) up
function _joBananaBody(ctx, len, hw, col, edge) {
  const tx = len * 0.17;   // tip leans → gives the banana its crescent curve
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-hw * 0.7, -len * 0.22, tx - hw, -len * 0.8, tx, -len);
  ctx.bezierCurveTo(tx + hw, -len * 0.8, hw * 1.3, -len * 0.22, 0, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 1.1; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.4;   // highlight ridge along the curve
  ctx.beginPath(); ctx.moveTo(tx * 0.2, -len * 0.16); ctx.quadraticCurveTo(tx * 0.4, -len * 0.6, tx, -len * 0.9); ctx.stroke();
}
// banana: a curved yellow body when whole; peel flaps hinge open from the base
// as `peel` rises, revealing the curved white fruit standing inside.
function _joBanana(ctx, x, y, rot, sc, peel) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  const L = 48, hw = 8.5; ctx.translate(0, L * 0.42);   // hinge near the base
  // white fruit (revealed as the peel opens)
  if (peel > 0.03) {
    _joBananaBody(ctx, L * 0.94, hw * 0.78, '#f7f0d2', '#e3d3a0');
    ctx.fillStyle = '#cdb072'; ctx.beginPath(); ctx.arc(L * 0.94 * 0.17, -L * 0.94, hw * 0.5, 0, 6.2832); ctx.fill();
  }
  // 4 peel flaps: all stacked (whole banana) at peel 0, splay symmetrically as it opens
  const ang = [-1.5, -0.55, 0.55, 1.5], cols = ['#e0b41c', '#f3cd24', '#edc620', '#d7a814'];
  for (const i of [0, 3, 1, 2]) {   // outer first, inner last → clean lit center when closed
    ctx.save(); ctx.rotate(ang[i] * peel * 0.92);
    _joBananaBody(ctx, L, hw, cols[i], '#b6890f');
    ctx.fillStyle = '#5a3a18'; ctx.beginPath(); ctx.arc(L * 0.17, -L, hw * 0.4, 0, 6.2832); ctx.fill();   // brown tip
    ctx.restore();
  }
  // little stem you hold at the base
  ctx.fillStyle = '#6b4a22'; ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-2.2, -2, 4.4, 9, 2); else ctx.rect(-2.2, -2, 4.4, 9);
  ctx.fill();
  ctx.restore();
}
function _joHand(ctx, x, y, grab) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.25);
  ctx.fillStyle = '#e6b079'; ctx.strokeStyle = '#9c6a36'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(0, 7, 9, 11, 0, 0, 6.2832); ctx.fill(); ctx.stroke();   // palm
  const fl = grab ? 5 : 12;
  for (let i = 0; i < 4; i++) { const fx = -6 + i * 4; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(fx - 1.7, -fl + (grab ? 7 : -2), 3.4, fl, 1.6); else ctx.rect(fx - 1.7, -fl + (grab ? 7 : -2), 3.4, fl); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(7, grab ? 2 : 0, 3.4, grab ? 6 : 9, 1.6); else ctx.rect(7, 0, 3.4, 9); ctx.fill(); ctx.stroke();   // thumb
  ctx.restore();
}
function _joClick() {
  // convert the pointer into the forest-canvas pixel space (where bananas live)
  const pc = document.getElementById('pattern-canvas'); if (!pc || !pc.width) return;
  const rect = pc.getBoundingClientRect();
  const rx = rect.width ? pc.width / rect.width : 1, ry = rect.height ? pc.height / rect.height : 1;
  const pmx = (_joMX - rect.left) * rx, pmy = (_joMY - rect.top) * ry;
  const b = _joHeld;
  if (b) {
    if (b.peel < 0.99) b.peel = Math.min(1, b.peel + 0.34);
    else { // eat it
      for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, s = 40 + Math.random() * 120; _joEatFx.push({ x: pmx, y: pmy + 16, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 1, r: 2 + Math.random() * 3 }); }
      _joBananas.splice(_joBananas.indexOf(b), 1); _joHeld = null; _joRespawnT = 1.2;
    }
    return;
  }
  for (const ban of _joBananas) { if (ban === _joHeld) continue; const d = Math.hypot(pmx - ban.x, pmy - ban.y); if (d < 48 * ban.sc) { _joHeld = ban; ban.peel = 0; return; } }
}
function _drawJoniCursor(canvas, ctx, W, H, t) {
  const fresh = _drawJoniCursor._lt === undefined;
  if (!fresh && t - _drawJoniCursor._lt < 0.016) return;
  _drawJoniCursor._lt = t;
  ctx.clearRect(0, 0, W, H);
  _joHand(ctx, _joMX, _joMY, !!_joHeld);   // only the hand is on the top overlay
}
function _startJoniOverlay() {
  _stopJoniOverlay();
  _drawJoniCursor._lt = undefined; _joBananas = []; _joHeld = null; _joEatFx = []; _joRespawnT = 0;
  window.addEventListener('mousemove', _joMouseMove);
  window.addEventListener('click', _joClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';
  const cv = document.createElement('canvas');
  cv.id = 'joni-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('joni-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) { cv2.width = window.innerWidth; cv2.height = window.innerHeight; }
    _drawJoniCursor(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _joniOverlayRafId = requestAnimationFrame(frame);
  }
  _joniOverlayRafId = requestAnimationFrame(frame);
}
function _stopJoniOverlay() {
  if (_joniOverlayRafId) { cancelAnimationFrame(_joniOverlayRafId); _joniOverlayRafId = null; }
  window.removeEventListener('mousemove', _joMouseMove);
  window.removeEventListener('click', _joClick);
  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';
  const cv = document.getElementById('joni-overlay'); if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// JIMMY — Fury's muffin, supersized, sitting on the page background and
// following your cursor with its big googly eyes. Pattern-only.
// ════════════════════════════════════════════════════════════════
// A big muffin whose pupils point at the cursor. (cx,cy) = muffin centre in
// canvas pixels; (curX,curY) = cursor in the SAME canvas pixel space; scale
// blows the whole thing up. Geometry mirrors _furyDrawMuffin so it reads as
// the exact same character, just larger and eye-tracking instead of velocity.
function _drawJimmyMuffin(ctx, cx, cy, t, scale, curX, curY) {
  const happy = _jimmyHappyT;                   // 0→1 (hover/click reaction)
  const bobY = Math.sin(t * 1.5) * 5 - happy * 4;   // perks up when happy
  const breathe = 1 + Math.sin(t * 1.1) * 0.012;
  // click squish
  const bT = _jimmyBounceT;
  const sq = bT > 0 ? Math.sin(bT * Math.PI * 3.2) * bT * 0.42 : 0;
  const sX = (1 + sq * 0.30) * breathe;
  const sY = (1 - sq * 0.38) * breathe;

  ctx.save();
  ctx.translate(cx, cy + bobY);
  const sxx = scale * sX, syy = scale * sY;
  ctx.scale(sxx, syy);

  // cursor in the muffin's LOCAL coordinate frame (undo translate+scale)
  const lcx = (curX - cx) / sxx;
  const lcy = (curY - (cy + bobY)) / syy;

  // Same proportions as Fury's muffin
  const eyeR = 14, eyeOX = 18, eyeY = 0;
  const cupTW = 19, cupBW = 14, cupH = 22;
  const cupTopY = eyeY + eyeR;      // 14
  const cupBotY = cupTopY + cupH;   // 36
  const domeR   = 16;
  const domeY   = cupTopY - domeR;  // -2

  // soft contact shadow on the page under him
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#2a1604';
  ctx.beginPath();
  ctx.ellipse(0, cupBotY + 7, cupTW * 1.15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 1 ── Orange cup with dark vertical stripes
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-cupTW, cupTopY); ctx.lineTo(-cupBW, cupBotY);
  ctx.lineTo(cupBW, cupBotY);  ctx.lineTo(cupTW, cupTopY);
  ctx.closePath();
  const wg = ctx.createLinearGradient(-cupTW, 0, cupTW, 0);
  wg.addColorStop(0, '#993e04'); wg.addColorStop(0.18, '#d96c12');
  wg.addColorStop(0.50, '#ee8c28'); wg.addColorStop(0.82, '#d96c12');
  wg.addColorStop(1, '#993e04');
  ctx.fillStyle = wg; ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(38,10,0,0.62)'; ctx.lineWidth = 2.8;
  for (let i = 0; i <= 6; i++) {
    const f = i / 6;
    ctx.beginPath();
    ctx.moveTo(-cupTW + f * cupTW * 2, cupTopY);
    ctx.lineTo(-cupBW + f * cupBW * 2, cupBotY);
    ctx.stroke();
  }
  ctx.restore();
  // Dark rim band
  ctx.fillStyle = 'rgba(40,10,0,0.88)';
  ctx.beginPath();
  ctx.moveTo(-cupTW - 1, cupTopY - 1); ctx.lineTo(cupTW + 1, cupTopY - 1);
  ctx.lineTo(cupTW + 1, cupTopY + 4);  ctx.lineTo(-cupTW - 1, cupTopY + 4);
  ctx.closePath(); ctx.fill();

  // 2 ── Chocolate dome
  const dg = ctx.createRadialGradient(-domeR * 0.28, domeY - domeR * 0.28, 2, 0, domeY, domeR * 1.05);
  dg.addColorStop(0,    '#b05425');
  dg.addColorStop(0.40, '#7a3010');
  dg.addColorStop(1,    '#2e0e02');
  ctx.beginPath(); ctx.arc(0, domeY, domeR, 0, Math.PI * 2);
  ctx.fillStyle = dg; ctx.fill();

  // 3 ── Big googly eyes — pupils aim straight at the cursor (grow when happy)
  for (let sgn = -1; sgn <= 1; sgn += 2) {
    const ex = sgn * eyeOX;
    const er = eyeR + happy * 1.6;
    ctx.beginPath(); ctx.arc(ex, eyeY, er, 0, Math.PI * 2);
    ctx.fillStyle = '#e8e4e0'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.70)'; ctx.lineWidth = 1.8; ctx.stroke();
    // direction from this eye toward the cursor, clamped inside the eye
    let dx = lcx - ex, dy = lcy - eyeY;
    const d = Math.hypot(dx, dy) || 1;
    const maxPd = er * 0.40;
    const reach = Math.min(maxPd, d);          // ease toward centre when cursor is right on it
    const px = ex + (dx / d) * reach;
    const py = eyeY + (dy / d) * reach;
    ctx.beginPath(); ctx.arc(px, py, er * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(px + er * 0.19, py - er * 0.19, er * 0.19, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
  }

  // 4 ── Happy blush when you hover / poke him
  if (happy > 0.02) {
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      const er = eyeR + happy * 1.6;
      ctx.globalAlpha = happy * 0.50;
      ctx.beginPath();
      ctx.ellipse(sgn * (eyeOX + er * 0.55), eyeY + er * 0.80, er * 0.62, er * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4466'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function _drawJimmyPattern(canvas, ctx, W, H, t) {
  const fresh = _drawJimmyPattern._lt === undefined;
  if (!fresh && t - _drawJimmyPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawJimmyPattern._lt, 0.05);
  _drawJimmyPattern._lt = t;
  _jimmyLastDraw = performance.now();
  _jimmyHookMouse();

  // Pin the canvas FIXED to the #content rect every frame so Jimmy stays put
  // (and fully covers) while the sheet scrolls — same idiom as Divine.
  let rLeft = 0, rTop = 0;
  const _ct = document.getElementById('content');
  if (_ct) {
    const r = _ct.getBoundingClientRect();
    const cw = Math.max(1, Math.round(r.width)), ch = Math.max(1, Math.round(r.height));
    if (canvas.style.position !== 'fixed') canvas.style.position = 'fixed';
    canvas.style.left = r.left + 'px'; canvas.style.top = r.top + 'px';
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    rLeft = r.left; rTop = r.top;
  }
  W = canvas.width; H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // muffin placement — big and brought up toward the top, a bit to the right
  const mx = W * 0.66;
  const my = H * 0.26;
  const scale = Math.max(4.6, Math.min(W, H) / 95);   // BIG, sane on small screens
  const curX = _jimmyMX - rLeft;
  const curY = _jimmyMY - rTop;

  // ── publish the screen-space hit ellipse (used by the click handler + hover) ──
  _jimmyCSX = rLeft + mx;
  _jimmyCSY = rTop  + my + 9 * scale;       // centre shifted toward the cup
  _jimmyHRX = 34 * scale;
  _jimmyHRY = 30 * scale;
  const hdx = (_jimmyMX - _jimmyCSX) / _jimmyHRX, hdy = (_jimmyMY - _jimmyCSY) / _jimmyHRY;
  _jimmyHover = (hdx * hdx + hdy * hdy) <= 1;

  // ── reaction timers ──
  if (_jimmyHover) _jimmyHappyT = Math.min(1, _jimmyHappyT + dt * 3.0);
  else             _jimmyHappyT = Math.max(0, _jimmyHappyT - dt * 1.6);
  if (_jimmyBounceT > 0) _jimmyBounceT = Math.max(0, _jimmyBounceT - dt * 1.7);

  // 1 ── Warm dark backdrop so the orange muffin and red rain pop
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0,    '#2a1d10');
  bg.addColorStop(0.55, '#1f160c');
  bg.addColorStop(1,    '#150e07');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // 2 ── RED BINARY RAIN — falling from above, semi-transparent, BEHIND the muffin
  _drawJimmyBinary(canvas, ctx, W, H, dt);

  // gentle warm glow centred on the muffin (over the rain, under the muffin)
  const gl = ctx.createRadialGradient(mx, my, 10, mx, my, Math.max(W, H) * 0.50);
  gl.addColorStop(0,   'rgba(255,176,80,0.18)');
  gl.addColorStop(0.5, 'rgba(200,110,40,0.06)');
  gl.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);

  // 3 ── Big Jimmy, eyes on the cursor (drawn AFTER the rain → rain never covers him)
  _drawJimmyMuffin(ctx, mx, my, t, scale, curX, curY);

  // 4 ── Crumb sparkles flung out on click (emitted at the muffin, on top of him)
  if (_jimmyEmitBurst > 0) {
    for (let i = 0; i < _jimmyEmitBurst; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (60 + Math.random() * 140);
      _jimmySparkles.push({
        x: mx + (Math.random() - 0.5) * 18 * scale * 0.3,
        y: my - 6 * scale,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
        life: 1, r: (1.4 + Math.random() * 2.2) * (scale / 3.5),
        c: Math.random() < 0.5 ? '#ffcf6b' : (Math.random() < 0.5 ? '#d96c12' : '#7a3010')
      });
    }
    _jimmyEmitBurst = 0;
  }
  for (let i = _jimmySparkles.length - 1; i >= 0; i--) {
    const p = _jimmySparkles[i];
    p.vy += 320 * dt;                 // gravity
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.life -= dt * 1.1;
    if (p.life <= 0) { _jimmySparkles.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.c;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 5 ── soft edge vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// Red 0/1 streams pouring down the page — sparse, semi-transparent, persistent
// per-column state cached on the canvas so the digits don't flicker every frame.
function _drawJimmyBinary(canvas, ctx, W, H, dt) {
  const lineH = 17, colW = 18;
  if (canvas._jimBinW !== W || canvas._jimBinH !== H || !canvas._jimCols) {
    canvas._jimBinW = W; canvas._jimBinH = H;
    const n = Math.ceil(W / colW);
    canvas._jimCols = Array.from({ length: n }, (_, i) => {
      const len = 7 + Math.floor(Math.random() * 16);
      return {
        x: i * colW + colW * 0.5,
        y: Math.random() * H,
        speed: 45 + Math.random() * 95,
        len,
        bits: Array.from({ length: len }, () => (Math.random() < 0.5 ? '0' : '1'))
      };
    });
  }
  ctx.save();
  ctx.font = '14px "Courier New", monospace';
  ctx.textAlign = 'center';
  for (const col of canvas._jimCols) {
    col.y += col.speed * dt;
    if (col.y - col.len * lineH > H) {            // wrapped fully past the bottom
      col.y = -Math.random() * H * 0.4;
      col.speed = 45 + Math.random() * 95;
    }
    // slowly mutate one digit so the stream feels alive without flickering
    if (Math.random() < 0.06) col.bits[(Math.random() * col.len) | 0] = (Math.random() < 0.5 ? '0' : '1');
    for (let k = 0; k < col.len; k++) {
      const cy = col.y - k * lineH;
      if (cy < -lineH || cy > H + lineH) continue;
      const f = 1 - k / col.len;                  // head brightest
      if (k === 0) {
        ctx.fillStyle = 'rgba(255,150,140,0.55)';  // bright leading glyph
      } else {
        ctx.fillStyle = `rgba(225,30,30,${(0.40 * f).toFixed(3)})`;
      }
      ctx.fillText(col.bits[k], col.x, cy);
    }
  }
  ctx.restore();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// THE SHI — god of death. Silent, mysterious, elegant soul garden.
// ════════════════════════════════════════════════════════════════
function _shiSoulSprite() {
  if (_shiSoulSprite._c) return _shiSoulSprite._c;
  const s = document.createElement('canvas'); s.width = s.height = 32;
  const g = s.getContext('2d');
  const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(224,238,250,1)');
  rg.addColorStop(0.4, 'rgba(150,188,222,0.7)');
  rg.addColorStop(1, 'rgba(90,130,170,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  return _shiSoulSprite._c = s;
}
function _shiPetalSprite() {
  if (_shiPetalSprite._c) return _shiPetalSprite._c;
  const s = document.createElement('canvas'); s.width = 24; s.height = 40;
  const g = s.getContext('2d');
  g.beginPath();
  g.moveTo(12, 2);
  g.bezierCurveTo(22, 12, 22, 28, 12, 38);
  g.bezierCurveTo(2, 28, 2, 12, 12, 2);
  g.closePath();
  const lg = g.createLinearGradient(0, 0, 0, 40);
  lg.addColorStop(0, 'rgba(228,240,250,0.96)');
  lg.addColorStop(0.5, 'rgba(192,214,234,0.82)');
  lg.addColorStop(1, 'rgba(150,182,212,0.55)');
  g.fillStyle = lg; g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(12, 5); g.lineTo(12, 35); g.stroke();
  return _shiPetalSprite._c = s;
}
function _shiNewWisp(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : H + Math.random() * 30,
    vy: 12 + Math.random() * 28, r: 2 + Math.random() * 5, a: 0.3 + Math.random() * 0.5,
    sw: 0.3 + Math.random() * 0.8, sa: 5 + Math.random() * 12, ph: Math.random() * 6.28,
    ff: 1.5 + Math.random() * 2.5, flick: 1 };
}
function _shiNewPetal(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : -20 - Math.random() * 40,
    vy: 14 + Math.random() * 26, sz: 8 + Math.random() * 10, rot: Math.random() * 6.28,
    vr: (Math.random() - 0.5) * 1.2, a: 0.4 + Math.random() * 0.4,
    sw: 0.4 + Math.random() * 1.0, sa: 8 + Math.random() * 16, ph: Math.random() * 6.28 };
}
function _shiNewFog(W, H) {
  return { x: Math.random() * W, y: Math.random() * H, r: 120 + Math.random() * 200,
    vx: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 10), a: 0.04 + Math.random() * 0.05 };
}

function _drawShiPattern(canvas, ctx, W, H, t) {
  if (_drawShiPattern._lt !== undefined && t - _drawShiPattern._lt < 0.033) return;
  const dt = _drawShiPattern._lt === undefined ? 0.016 : Math.min(t - _drawShiPattern._lt, 0.05);
  _drawShiPattern._lt = t;

  if (canvas._shiW !== W || canvas._shiH !== H) {
    canvas._shiW = W; canvas._shiH = H;
    canvas._shiBase = null; canvas._shiMoon = null; canvas._shiVign = null;
    canvas._shiWisps = null; canvas._shiPetals = null; canvas._shiFog = null;
  }
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.5);

  // 1 ── Cold base gradient
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (!canvas._shiBase) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0f16'); g.addColorStop(0.5, '#0e131c'); g.addColorStop(1, '#080a10');
    canvas._shiBase = g;
  }
  ctx.fillStyle = canvas._shiBase; ctx.fillRect(0, 0, W, H);

  // 2 ── Cold moon halo, high
  if (!canvas._shiMoon) {
    const cx = W * 0.5, cy = H * 0.28, r = Math.min(W, H) * 0.42;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(180,205,225,0.2)');
    g.addColorStop(0.4, 'rgba(120,150,180,0.08)');
    g.addColorStop(1, 'rgba(80,110,140,0)');
    canvas._shiMoon = g;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.7 + breathe * 0.3; ctx.fillStyle = canvas._shiMoon; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  const mx = W * 0.5, my = H * 0.28, mr = Math.min(W, H) * 0.1;
  const mg = ctx.createRadialGradient(mx, my, mr * 0.55, mx, my, mr);
  mg.addColorStop(0, `rgba(214,228,242,${0.1 + breathe * 0.06})`);
  mg.addColorStop(1, 'rgba(214,228,242,0)');
  ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();

  // 3 ── Drifting fog banks
  if (!canvas._shiFog) canvas._shiFog = Array.from({ length: 5 }, () => _shiNewFog(W, H));
  ctx.globalCompositeOperation = 'lighter';
  for (const f of canvas._shiFog) {
    f.x += f.vx * dt;
    if (f.x - f.r > W) f.x = -f.r;
    if (f.x + f.r < 0) f.x = W + f.r;
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
    g.addColorStop(0, `rgba(150,178,205,${f.a * (0.6 + breathe * 0.4)})`);
    g.addColorStop(1, 'rgba(150,178,205,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
  }

  // 4 ── Rising spirit-wisps (souls ascending)
  if (!canvas._shiWisps) canvas._shiWisps = Array.from({ length: 34 }, () => _shiNewWisp(W, H, true));
  const wsp = _shiSoulSprite();
  ctx.globalCompositeOperation = 'lighter';
  for (const w of canvas._shiWisps) {
    w.y -= w.vy * dt; w.x += Math.sin(t * w.sw + w.ph) * w.sa * dt;
    w.flick = 0.6 + 0.4 * Math.sin(t * w.ff + w.ph);
    if (w.y < -20) Object.assign(w, _shiNewWisp(W, H, false));
    ctx.globalAlpha = Math.min(1, w.flick * w.a);
    const d = w.r * 3.4; ctx.drawImage(wsp, w.x - d / 2, w.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 5 ── Falling petals (beauty in death)
  if (!canvas._shiPetals) canvas._shiPetals = Array.from({ length: 26 }, () => _shiNewPetal(W, H, true));
  const psp = _shiPetalSprite();
  ctx.globalCompositeOperation = 'source-over';
  for (const p of canvas._shiPetals) {
    p.y += p.vy * dt; p.x += Math.sin(t * p.sw + p.ph) * p.sa * dt; p.rot += p.vr * dt;
    if (p.y > H + 20) Object.assign(p, _shiNewPetal(W, H, false));
    ctx.save();
    ctx.globalAlpha = p.a;
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.drawImage(psp, -p.sz / 2, -p.sz * 0.85, p.sz, p.sz * 1.7);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 6 ── Soft vignette
  if (!canvas._shiVign) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(4,6,10,0.72)');
    canvas._shiVign = vg;
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = canvas._shiVign; ctx.fillRect(0, 0, W, H);
}

// ── Spectral cursor companion: a silent soul-flame with a flowing veil trail
// and slowly drifting petals. Click → a soft ripple + petal bloom. ──
function _shiMouseMove(e) { _shiTargX = e.clientX; _shiTargY = e.clientY; }
function _shiClick() {
  _shiRings.push({ x: _shiX, y: _shiY, r: 6, life: 1 });
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 70;
    _shiPetals.push({ x: _shiX, y: _shiY, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2, sz: 8 + Math.random() * 8,
      life: 1, grav: 16 + Math.random() * 14 });
  }
}
function _drawShiOverlay(canvas, ctx, W, H, t) {
  if (_drawShiOverlay._lt !== undefined && t - _drawShiOverlay._lt < 0.033) return;
  const dt = _drawShiOverlay._lt === undefined ? 0.016 : Math.min(t - _drawShiOverlay._lt, 0.05);
  _drawShiOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);

  // Slow, graceful spring — elegant lag
  const SPRING = 46, DAMP = 9;
  _shiVX += ((_shiTargX - _shiX) * SPRING - _shiVX * DAMP) * dt;
  _shiVY += ((_shiTargY - _shiY) * SPRING - _shiVY * DAMP) * dt;
  _shiX += _shiVX * dt; _shiY += _shiVY * dt;

  _shiTrail.push({ x: _shiX, y: _shiY });
  if (_shiTrail.length > 22) _shiTrail.shift();

  // Flowing veil trail (tapering pale ribbon)
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i < _shiTrail.length; i++) {
    const f = i / _shiTrail.length;
    ctx.strokeStyle = `rgba(190,216,240,${f * 0.22})`;
    ctx.lineWidth = f * 7;
    ctx.beginPath(); ctx.moveTo(_shiTrail[i - 1].x, _shiTrail[i - 1].y); ctx.lineTo(_shiTrail[i].x, _shiTrail[i].y); ctx.stroke();
  }

  // Emit slowly drifting petals
  _shiEmit += dt * (4 + Math.hypot(_shiVX, _shiVY) * 0.01);
  while (_shiEmit > 1) {
    _shiEmit -= 1;
    if (_shiPetals.length > 150) break;
    const a = Math.random() * Math.PI * 2, s = 8 + Math.random() * 22;
    _shiPetals.push({ x: _shiX, y: _shiY, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 10,
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 1.5, sz: 7 + Math.random() * 7,
      life: 1, grav: 10 + Math.random() * 10 });
  }

  // Soft ripples
  for (let i = _shiRings.length - 1; i >= 0; i--) {
    const r = _shiRings[i];
    r.r += 120 * dt; r.life -= dt * 0.9;
    if (r.life <= 0) { _shiRings.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(200,222,245,${r.life * 0.4})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }

  // Petals
  const psp = _shiPetalSprite();
  ctx.globalCompositeOperation = 'source-over';
  for (let i = _shiPetals.length - 1; i >= 0; i--) {
    const p = _shiPetals[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 0.98; p.rot += p.vr * dt; p.life -= dt * 0.5;
    if (p.life <= 0) { _shiPetals.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = Math.min(0.85, p.life * 0.85);
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.drawImage(psp, -p.sz / 2, -p.sz * 0.85, p.sz, p.sz * 1.7);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // Soul-flame orb at the head
  ctx.globalCompositeOperation = 'lighter';
  const pr = 10 + Math.sin(t * 3) * 1.5;
  const og = ctx.createRadialGradient(_shiX, _shiY, 0, _shiX, _shiY, pr * 2.6);
  og.addColorStop(0, 'rgba(226,240,252,0.9)');
  og.addColorStop(0.4, 'rgba(160,196,230,0.55)');
  og.addColorStop(1, 'rgba(90,130,170,0)');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(_shiX, _shiY, pr * 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(236,246,255,0.9)'; ctx.beginPath(); ctx.arc(_shiX, _shiY, pr * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}
function _startShiOverlay() {
  _stopShiOverlay();
  _drawShiOverlay._lt = undefined;
  _shiX = _shiTargX = window.innerWidth * 0.5;
  _shiY = _shiTargY = window.innerHeight * 0.5;
  _shiVX = _shiVY = 0; _shiTrail = []; _shiPetals = []; _shiRings = []; _shiEmit = 0;
  window.addEventListener('mousemove', _shiMouseMove);
  window.addEventListener('click', _shiClick);
  const cv = document.createElement('canvas');
  cv.id = 'shi-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('shi-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawShiOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _shiOverlayRafId = requestAnimationFrame(frame);
  }
  _shiOverlayRafId = requestAnimationFrame(frame);
}
function _stopShiOverlay() {
  if (_shiOverlayRafId) { cancelAnimationFrame(_shiOverlayRafId); _shiOverlayRafId = null; }
  window.removeEventListener('mousemove', _shiMouseMove);
  window.removeEventListener('click', _shiClick);
  const cv = document.getElementById('shi-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// LUNAR — goddess of the moon. Calm, elegant, melancholic moonlight.
// ════════════════════════════════════════════════════════════════
function _lunarStarSprite() {
  if (_lunarStarSprite._c) return _lunarStarSprite._c;
  const s = document.createElement('canvas'); s.width = s.height = 16;
  const g = s.getContext('2d');
  const rg = g.createRadialGradient(8, 8, 0, 8, 8, 8);
  rg.addColorStop(0, 'rgba(236,244,255,1)');
  rg.addColorStop(0.5, 'rgba(172,200,236,0.6)');
  rg.addColorStop(1, 'rgba(120,150,200,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 16, 16);
  return _lunarStarSprite._c = s;
}
function _lunarCrescentSprite() {
  if (_lunarCrescentSprite._c) return _lunarCrescentSprite._c;
  const s = document.createElement('canvas'); s.width = s.height = 64;
  const g = s.getContext('2d');
  const rg = g.createRadialGradient(26, 26, 2, 32, 32, 24);
  rg.addColorStop(0, 'rgba(238,244,253,1)');
  rg.addColorStop(0.7, 'rgba(198,214,238,0.96)');
  rg.addColorStop(1, 'rgba(150,176,214,0.9)');
  g.fillStyle = rg; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(42, 28, 20, 0, Math.PI * 2); g.fill();
  return _lunarCrescentSprite._c = s;
}
function _lunarNewMote(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : H + Math.random() * 30,
    vy: 8 + Math.random() * 18, r: 1.5 + Math.random() * 3.5, a: 0.25 + Math.random() * 0.4,
    sw: 0.2 + Math.random() * 0.6, sa: 4 + Math.random() * 9, ph: Math.random() * 6.28,
    ff: 1 + Math.random() * 2, flick: 1 };
}
function _lunarNewCloud(W, H) {
  const my = H * 0.30;
  return { x: Math.random() * W, y: my + (Math.random() - 0.5) * H * 0.34,
    w: W * (0.3 + Math.random() * 0.45), h: 26 + Math.random() * 46,
    vx: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 9), a: 0.16 + Math.random() * 0.2 };
}

function _drawLunarPattern(canvas, ctx, W, H, t) {
  const fresh = _drawLunarPattern._lt === undefined;
  if (!fresh && t - _drawLunarPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawLunarPattern._lt, 0.05);
  _drawLunarPattern._lt = t;
  if (fresh) canvas._lunShoot = null;   // shooting star uses absolute time → reset on (re)entry

  if (canvas._lunW !== W || canvas._lunH !== H) {
    canvas._lunW = W; canvas._lunH = H;
    canvas._lunBase = null; canvas._lunStars = null; canvas._lunMoonGlow = null;
    canvas._lunVign = null; canvas._lunClouds = null; canvas._lunMotes = null;
  }
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.4);
  const mx = W * 0.72, my = H * 0.30, mr = Math.min(W, H) * 0.15;

  // 1 ── Deep night gradient
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (!canvas._lunBase) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070d1f'); g.addColorStop(0.5, '#0b1430'); g.addColorStop(1, '#05080f');
    canvas._lunBase = g;
  }
  ctx.fillStyle = canvas._lunBase; ctx.fillRect(0, 0, W, H);

  // 2 ── Starfield (cached positions, twinkling)
  if (!canvas._lunStars) {
    canvas._lunStars = Array.from({ length: 150 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      base: 0.25 + Math.random() * 0.7, sz: 1 + Math.random() * 2.6,
      tw: 0.6 + Math.random() * 2.2, ph: Math.random() * 6.28,
      glint: Math.random() < 0.12,
    }));
  }
  const star = _lunarStarSprite();
  ctx.globalCompositeOperation = 'lighter';
  for (const s of canvas._lunStars) {
    const a = s.base * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph)));
    ctx.globalAlpha = a;
    const d = s.sz * 4; ctx.drawImage(star, s.x - d / 2, s.y - d / 2, d, d);
    if (s.glint && a > 0.5) {
      ctx.strokeStyle = `rgba(225,238,255,${(a - 0.5) * 0.7})`; ctx.lineWidth = 0.7;
      const gl = s.sz * 4.5;
      ctx.beginPath(); ctx.moveTo(s.x - gl, s.y); ctx.lineTo(s.x + gl, s.y);
      ctx.moveTo(s.x, s.y - gl); ctx.lineTo(s.x, s.y + gl); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // 3 ── The Moon (centerpiece) — glow halo + lit disc + soft craters
  if (!canvas._lunMoonGlow) {
    const g = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.6);
    g.addColorStop(0, 'rgba(150,180,225,0.5)');
    g.addColorStop(0.4, 'rgba(90,120,175,0.16)');
    g.addColorStop(1, 'rgba(60,90,150,0)');
    canvas._lunMoonGlow = g;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.6 + breathe * 0.3; ctx.fillStyle = canvas._lunMoonGlow; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const dg = ctx.createRadialGradient(mx - mr * 0.32, my - mr * 0.32, mr * 0.15, mx, my, mr);
  dg.addColorStop(0, '#eaf0fa'); dg.addColorStop(0.55, '#c6d3e8'); dg.addColorStop(1, '#9aabcb');
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  // craters
  ctx.fillStyle = 'rgba(120,140,172,0.28)';
  for (const cr of [[-0.32, -0.22, 0.17], [0.26, 0.12, 0.2], [0.04, 0.36, 0.14], [-0.16, 0.28, 0.1], [0.34, -0.18, 0.09]]) {
    ctx.beginPath(); ctx.arc(mx + cr[0] * mr, my + cr[1] * mr, cr[2] * mr, 0, Math.PI * 2); ctx.fill();
  }
  // rim light
  ctx.strokeStyle = 'rgba(228,238,252,0.35)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(mx, my, mr, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();

  // 4 ── Drifting clouds (pass over the moon, dim it slightly) — melancholic
  if (!canvas._lunClouds) canvas._lunClouds = Array.from({ length: 4 }, () => _lunarNewCloud(W, H));
  ctx.globalCompositeOperation = 'source-over';
  for (const c of canvas._lunClouds) {
    c.x += c.vx * dt;
    if (c.x - c.w > W) c.x = -c.w;
    if (c.x + c.w < 0) c.x = W + c.w;
    const g = ctx.createLinearGradient(c.x - c.w, 0, c.x + c.w, 0);
    g.addColorStop(0, 'rgba(7,11,26,0)');
    g.addColorStop(0.5, `rgba(8,13,30,${c.a})`);
    g.addColorStop(1, 'rgba(7,11,26,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w, c.h, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 5 ── Rising light motes
  if (!canvas._lunMotes) canvas._lunMotes = Array.from({ length: 22 }, () => _lunarNewMote(W, H, true));
  ctx.globalCompositeOperation = 'lighter';
  for (const m of canvas._lunMotes) {
    m.y -= m.vy * dt; m.x += Math.sin(t * m.sw + m.ph) * m.sa * dt;
    m.flick = 0.6 + 0.4 * Math.sin(t * m.ff + m.ph);
    if (m.y < -16) Object.assign(m, _lunarNewMote(W, H, false));
    ctx.globalAlpha = Math.min(1, m.flick * m.a);
    const d = m.r * 4; ctx.drawImage(star, m.x - d / 2, m.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 6 ── Occasional slow shooting star (re-entry safe)
  {
    let sh = canvas._lunShoot;
    if (!sh || t < sh.born) canvas._lunShoot = sh = { next: t + 2.5 + Math.random() * 5, born: -99, dur: 1, x0: 0, y0: 0, ang: 0, len: 0 };
    if (t > sh.next) {
      sh.born = t; sh.dur = 0.8 + Math.random() * 0.5; sh.next = t + 5 + Math.random() * 8;
      sh.x0 = W * (0.08 + Math.random() * 0.6); sh.y0 = H * (0.04 + Math.random() * 0.28);
      sh.ang = Math.PI * (0.13 + Math.random() * 0.18); sh.len = Math.min(W, H) * (0.4 + Math.random() * 0.3);
    }
    const age = t - sh.born;
    if (age >= 0 && age < sh.dur) {
      const prog = age / sh.dur;
      const hx = sh.x0 + Math.cos(sh.ang) * sh.len * prog, hy = sh.y0 + Math.sin(sh.ang) * sh.len * prog;
      const trail = 70, tx = hx - Math.cos(sh.ang) * trail, ty = hy - Math.sin(sh.ang) * trail;
      const a = Math.sin(prog * Math.PI);
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, 'rgba(200,220,250,0)'); g.addColorStop(1, `rgba(228,240,255,${a * 0.9})`);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = `rgba(236,246,255,${a})`; ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 7 ── Soft vignette
  if (!canvas._lunVign) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.82);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(3,5,12,0.75)');
    canvas._lunVign = vg;
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = canvas._lunVign; ctx.fillRect(0, 0, W, H);
}

// ── Crescent-moon cursor companion with a trail of twinkling stardust. ──
function _lunarMouseMove(e) { _lunarTargX = e.clientX; _lunarTargY = e.clientY; }
function _lunarClick() {
  _lunarRings.push({ x: _lunarX, y: _lunarY, r: 6, life: 1 });
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 110;
    _lunarDust.push({ x: _lunarX, y: _lunarY, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 1, sz: 1.5 + Math.random() * 3, tw: 1 + Math.random() * 3, ph: Math.random() * 6.28, grav: 6 });
  }
}
function _drawLunarOverlay(canvas, ctx, W, H, t) {
  if (_drawLunarOverlay._lt !== undefined && t - _drawLunarOverlay._lt < 0.033) return;
  const dt = _drawLunarOverlay._lt === undefined ? 0.016 : Math.min(t - _drawLunarOverlay._lt, 0.05);
  _drawLunarOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);

  const SPRING = 52, DAMP = 10;
  _lunarVX += ((_lunarTargX - _lunarX) * SPRING - _lunarVX * DAMP) * dt;
  _lunarVY += ((_lunarTargY - _lunarY) * SPRING - _lunarVY * DAMP) * dt;
  _lunarX += _lunarVX * dt; _lunarY += _lunarVY * dt;
  const spd = Math.hypot(_lunarVX, _lunarVY);

  // emit stardust trail
  _lunarEmit += dt * (8 + spd * 0.03);
  while (_lunarEmit > 1) {
    _lunarEmit -= 1;
    if (_lunarDust.length > 200) break;
    const a = Math.random() * Math.PI * 2, s = 6 + Math.random() * 18;
    _lunarDust.push({ x: _lunarX + (Math.random() - 0.5) * 12, y: _lunarY + (Math.random() - 0.5) * 12,
      vx: Math.cos(a) * s - _lunarVX * 0.04, vy: Math.sin(a) * s - _lunarVY * 0.04,
      life: 1, sz: 1.2 + Math.random() * 2.4, tw: 1 + Math.random() * 3, ph: Math.random() * 6.28, grav: 4 });
  }

  ctx.globalCompositeOperation = 'lighter';
  // ripples
  for (let i = _lunarRings.length - 1; i >= 0; i--) {
    const r = _lunarRings[i];
    r.r += 140 * dt; r.life -= dt * 0.9;
    if (r.life <= 0) { _lunarRings.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(186,210,245,${r.life * 0.4})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  // stardust
  const star = _lunarStarSprite();
  for (let i = _lunarDust.length - 1; i >= 0; i--) {
    const p = _lunarDust[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 0.985; p.life -= dt * 0.6;
    if (p.life <= 0) { _lunarDust.splice(i, 1); continue; }
    const a = Math.min(1, p.life) * (0.55 + 0.45 * Math.sin(t * p.tw + p.ph));
    if (a <= 0.02) continue;
    ctx.globalAlpha = a;
    const d = p.sz * 4.5; ctx.drawImage(star, p.x - d / 2, p.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // crescent companion at the head
  const cr = _lunarCrescentSprite();
  const glow = ctx.createRadialGradient(_lunarX, _lunarY, 0, _lunarX, _lunarY, 34);
  glow.addColorStop(0, 'rgba(180,205,240,0.5)');
  glow.addColorStop(1, 'rgba(120,150,200,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(_lunarX, _lunarY, 34, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(_lunarX, _lunarY);
  ctx.rotate(-0.3 + Math.sin(t * 0.8) * 0.12 + Math.max(-0.3, Math.min(0.3, _lunarVX / 600)));
  ctx.globalAlpha = 0.96;
  ctx.drawImage(cr, -16, -16, 32, 32);
  ctx.restore();
  ctx.globalAlpha = 1;
}
function _startLunarOverlay() {
  _stopLunarOverlay();
  _drawLunarOverlay._lt = undefined;
  _lunarX = _lunarTargX = window.innerWidth * 0.5;
  _lunarY = _lunarTargY = window.innerHeight * 0.5;
  _lunarVX = _lunarVY = 0; _lunarDust = []; _lunarRings = []; _lunarEmit = 0;
  window.addEventListener('mousemove', _lunarMouseMove);
  window.addEventListener('click', _lunarClick);
  const cv = document.createElement('canvas');
  cv.id = 'lunar-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('lunar-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawLunarOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _lunarOverlayRafId = requestAnimationFrame(frame);
  }
  _lunarOverlayRafId = requestAnimationFrame(frame);
}
function _stopLunarOverlay() {
  if (_lunarOverlayRafId) { cancelAnimationFrame(_lunarOverlayRafId); _lunarOverlayRafId = null; }
  window.removeEventListener('mousemove', _lunarMouseMove);
  window.removeEventListener('click', _lunarClick);
  const cv = document.getElementById('lunar-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// HELIOS — god of the sun. Aggressive, voracious, blinding sun rays.
// ════════════════════════════════════════════════════════════════
function _heliosSparkSprite() {
  if (_heliosSparkSprite._c) return _heliosSparkSprite._c;
  const s = document.createElement('canvas'); s.width = s.height = 32;
  const g = s.getContext('2d');
  const rg = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  rg.addColorStop(0, 'rgba(255,250,225,1)');
  rg.addColorStop(0.4, 'rgba(255,180,60,0.85)');
  rg.addColorStop(1, 'rgba(200,80,10,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 32, 32);
  return _heliosSparkSprite._c = s;
}
function _helNewSpark(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : H + Math.random() * 30,
    vy: 40 + Math.random() * 120, r: 1.5 + Math.random() * 4, a: 0.4 + Math.random() * 0.6,
    sw: 0.6 + Math.random() * 1.6, sa: 8 + Math.random() * 20, ph: Math.random() * 6.28,
    ff: 4 + Math.random() * 6, flick: 1 };
}
// Long radiating rays from a common apex; flat additive triangles overlap near
// the apex → a naturally bright, blinding core that fades outward. Aggressive
// per-ray throb.
function _heliosRays(ctx, cx, cy, len, t, count, spin, speed, widthF) {
  for (let i = 0; i < count; i++) {
    const a = spin + t * speed + i * (Math.PI * 2 / count);
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + i * 1.7);
    const half = (Math.PI / count) * widthF * (0.45 + 0.55 * pulse);
    const al = 0.045 + 0.16 * pulse;
    ctx.fillStyle = `rgba(255,${(170 + pulse * 60) | 0},${(40 + pulse * 45) | 0},${al})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a - half) * len, cy + Math.sin(a - half) * len);
    ctx.lineTo(cx + Math.cos(a + half) * len, cy + Math.sin(a + half) * len);
    ctx.closePath(); ctx.fill();
  }
}

// Big pyramid silhouettes grounded at the very bottom, backlit by the sun.
function _helDrawPyramids(ctx, W, H) {
  ctx.fillStyle = 'rgba(6,3,1,0.97)';
  for (const [pf, hf, wf] of [[0.5, 0.40, 1.0], [0.24, 0.28, 0.95], [0.78, 0.31, 0.95], [0.07, 0.2, 0.9], [0.93, 0.22, 0.9]]) {
    const px = W * pf, ph = H * hf, half = ph * wf;
    ctx.beginPath(); ctx.moveTo(px, H - ph); ctx.lineTo(px - half, H + 2); ctx.lineTo(px + half, H + 2); ctx.closePath(); ctx.fill();
  }
}

function _drawHeliosPattern(canvas, ctx, W, H, t) {
  const fresh = _drawHeliosPattern._lt === undefined;
  if (!fresh && t - _drawHeliosPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawHeliosPattern._lt, 0.05);
  _drawHeliosPattern._lt = t;
  if (fresh) canvas._helFlare = null;   // solar flare uses absolute time → reset on (re)entry

  if (canvas._helW !== W || canvas._helH !== H) {
    canvas._helW = W; canvas._helH = H;
    canvas._helBase = null; canvas._helVign = null; canvas._helSparks = null;
  }
  const cx = W * 0.5, cy = H * 0.32, rayLen = Math.hypot(W, H);
  const sr = Math.min(W, H) * 0.13;
  const throb = 0.5 + 0.5 * Math.sin(t * 2.2);   // aggressive heartbeat

  // 1 ── Scorched warm base
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (!canvas._helBase) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.95);
    g.addColorStop(0, '#241405'); g.addColorStop(0.5, '#160c03'); g.addColorStop(1, '#080401');
    canvas._helBase = g;
  }
  ctx.fillStyle = canvas._helBase; ctx.fillRect(0, 0, W, H);

  // 2 ── Strong rotating sun rays (two layers — bold long spears + a dense fan)
  ctx.globalCompositeOperation = 'lighter';
  _heliosRays(ctx, cx, cy, rayLen, t, 26, 0, 0.09, 0.8);
  _heliosRays(ctx, cx, cy, rayLen, t, 10, 0.4, -0.05, 0.35);   // long bright spears, counter-spin

  // 3 ── Blazing sun: corona glow + churning disc + white-hot core
  const cg = ctx.createRadialGradient(cx, cy, sr * 0.3, cx, cy, sr * 3.4);
  cg.addColorStop(0, `rgba(255,212,120,${0.6 + throb * 0.32})`);
  cg.addColorStop(0.4, `rgba(255,140,40,${0.28 + throb * 0.2})`);
  cg.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
  // churning surface flares around the rim (voracious)
  for (let i = 0; i < 6; i++) {
    const a = t * 0.5 + i * (Math.PI * 2 / 6);
    const fx = cx + Math.cos(a) * sr * 0.7, fy = cy + Math.sin(a) * sr * 0.7;
    const fr = sr * (0.35 + 0.2 * Math.sin(t * 3 + i));
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    fg.addColorStop(0, 'rgba(255,225,150,0.5)'); fg.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
  }
  // disc
  const dg = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr * (1 + throb * 0.07));
  dg.addColorStop(0, 'rgba(255,252,240,1)');
  dg.addColorStop(0.55, 'rgba(255,205,95,0.96)');
  dg.addColorStop(1, 'rgba(255,140,40,0.55)');
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(cx, cy, sr * (1 + throb * 0.07), 0, Math.PI * 2); ctx.fill();

  // 4 ── Solar flare eruption (occasional, re-entry safe)
  {
    let fl = canvas._helFlare;
    if (!fl || t < fl.born) canvas._helFlare = fl = { next: t + 1.5 + Math.random() * 3, born: -99, dur: 0.7, ang: 0, reach: sr };
    if (t > fl.next) {
      fl.born = t; fl.dur = 0.55 + Math.random() * 0.45; fl.next = t + 2.5 + Math.random() * 4;
      fl.ang = Math.random() * Math.PI * 2; fl.reach = sr * (1.4 + Math.random() * 1.6);
    }
    const age = t - fl.born;
    if (age >= 0 && age < fl.dur) {
      const p = age / fl.dur, a = Math.sin(p * Math.PI);
      const ox = cx + Math.cos(fl.ang) * sr * 0.85, oy = cy + Math.sin(fl.ang) * sr * 0.85;
      const rr = fl.reach * p + 1;
      const rg = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
      rg.addColorStop(0, 'rgba(255,235,170,0)');
      rg.addColorStop(0.7, `rgba(255,195,85,${a * 0.5})`);
      rg.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(ox, oy, rr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,175,65,${a * 0.05})`; ctx.fillRect(0, 0, W, H);   // screen flash
    }
  }

  // 5 ── Rising sparks (cached sprite)
  if (!canvas._helSparks) canvas._helSparks = Array.from({ length: 60 }, () => _helNewSpark(W, H, true));
  const spr = _heliosSparkSprite();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of canvas._helSparks) {
    e.y -= e.vy * dt; e.x += Math.sin(t * e.sw + e.ph) * e.sa * dt;
    e.flick = 0.5 + 0.5 * Math.sin(t * e.ff + e.ph);
    if (e.y < -12) Object.assign(e, _helNewSpark(W, H, false));
    ctx.globalAlpha = Math.min(1, e.flick * e.a);
    const d = e.r * 3.2; ctx.drawImage(spr, e.x - d / 2, e.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 5.5 ── Pyramid silhouettes on the desert horizon (backlit)
  ctx.globalCompositeOperation = 'source-over';
  _helDrawPyramids(ctx, W, H);

  // 6 ── Warm vignette
  if (!canvas._helVign) {
    const vg = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.25, cx, cy, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(12,4,0,0.82)');
    canvas._helVign = vg;
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = canvas._helVign; ctx.fillRect(0, 0, W, H);
}

// ── Cursor: a blazing little sun with its own rotating rays + spark trail.
// Click → an aggressive solar burst (sparks + shockwave + flash). ──
function _heliosMouseMove(e) { _heliosTargX = e.clientX; _heliosTargY = e.clientY; }
function _heliosClick() {
  _heliosFlareT = 1.0;
  _heliosRings.push({ x: _heliosX, y: _heliosY, r: 8, life: 1 });
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 320;
    _heliosSparks.push({ x: _heliosX, y: _heliosY, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 1, r: 2 + Math.random() * 4, burst: true });
  }
}
function _drawHeliosOverlay(canvas, ctx, W, H, t) {
  if (_drawHeliosOverlay._lt !== undefined && t - _drawHeliosOverlay._lt < 0.033) return;
  const dt = _drawHeliosOverlay._lt === undefined ? 0.016 : Math.min(t - _drawHeliosOverlay._lt, 0.05);
  _drawHeliosOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);

  const SPRING = 175, DAMP = 16;   // aggressive, snappy
  _heliosVX += ((_heliosTargX - _heliosX) * SPRING - _heliosVX * DAMP) * dt;
  _heliosVY += ((_heliosTargY - _heliosY) * SPRING - _heliosVY * DAMP) * dt;
  _heliosX += _heliosVX * dt; _heliosY += _heliosVY * dt;
  _heliosFlareT = Math.max(0, _heliosFlareT - dt * 2.4);
  const spd = Math.hypot(_heliosVX, _heliosVY);

  // spark trail
  _heliosEmit += dt * (22 + spd * 0.06);
  while (_heliosEmit > 1) {
    _heliosEmit -= 1;
    if (_heliosSparks.length > 380) break;
    const a = Math.random() * Math.PI * 2, s = 14 + Math.random() * 50;
    _heliosSparks.push({ x: _heliosX + (Math.random() - 0.5) * 10, y: _heliosY + (Math.random() - 0.5) * 10,
      vx: Math.cos(a) * s - _heliosVX * 0.05, vy: Math.sin(a) * s - _heliosVY * 0.05,
      life: 1, r: 1.5 + Math.random() * 3, burst: false });
  }

  const spr = _heliosSparkSprite();
  ctx.globalCompositeOperation = 'lighter';
  // shockwave rings
  for (let i = _heliosRings.length - 1; i >= 0; i--) {
    const r = _heliosRings[i];
    r.r += 480 * dt; r.life -= dt * 1.7;
    if (r.life <= 0) { _heliosRings.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(255,200,90,${r.life * 0.55})`; ctx.lineWidth = 3 + r.life * 4;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  // sparks
  for (let i = _heliosSparks.length - 1; i >= 0; i--) {
    const e = _heliosSparks[i];
    e.x += e.vx * dt; e.y += e.vy * dt; e.vy += (e.burst ? 90 : 40) * dt;
    e.life -= dt * (e.burst ? 1.2 : 1.7);
    if (e.life <= 0) { _heliosSparks.splice(i, 1); continue; }
    ctx.globalAlpha = Math.min(1, e.life);
    const d = e.r * 3.6; ctx.drawImage(spr, e.x - d / 2, e.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // blazing sun head with rotating mini-rays
  const flare = 1 + _heliosFlareT * 1.4;
  _heliosRays(ctx, _heliosX, _heliosY, (34 + Math.sin(t * 6) * 4) * flare, t, 14, t * 0.6, 0.0, 0.5);
  const og = ctx.createRadialGradient(_heliosX, _heliosY, 0, _heliosX, _heliosY, 22 * flare);
  og.addColorStop(0, 'rgba(255,248,225,0.95)');
  og.addColorStop(0.4, 'rgba(255,170,60,0.6)');
  og.addColorStop(1, 'rgba(220,90,15,0)');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(_heliosX, _heliosY, 22 * flare, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,252,238,0.95)'; ctx.beginPath(); ctx.arc(_heliosX, _heliosY, 5 * flare, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}
function _startHeliosOverlay() {
  _stopHeliosOverlay();
  _drawHeliosOverlay._lt = undefined;
  _heliosX = _heliosTargX = window.innerWidth * 0.5;
  _heliosY = _heliosTargY = window.innerHeight * 0.5;
  _heliosVX = _heliosVY = 0; _heliosSparks = []; _heliosRings = []; _heliosFlareT = 0; _heliosEmit = 0;
  window.addEventListener('mousemove', _heliosMouseMove);
  window.addEventListener('click', _heliosClick);
  const cv = document.createElement('canvas');
  cv.id = 'helios-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('helios-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawHeliosOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _heliosOverlayRafId = requestAnimationFrame(frame);
  }
  _heliosOverlayRafId = requestAnimationFrame(frame);
}
function _stopHeliosOverlay() {
  if (_heliosOverlayRafId) { cancelAnimationFrame(_heliosOverlayRafId); _heliosOverlayRafId = null; }
  window.removeEventListener('mousemove', _heliosMouseMove);
  window.removeEventListener('click', _heliosClick);
  const cv = document.getElementById('helios-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// ZOE — spirit of life. A living, blooming, glowing garden.
// ════════════════════════════════════════════════════════════════
// Cached soft petal sprites in several flower hues (drawImage, tint baked in).
function _zoePetalSprites() {
  if (_zoePetalSprites._a) return _zoePetalSprites._a;
  const cols = [[255,150,190],[255,226,120],[206,176,246],[250,250,244],[255,172,140],[176,233,150]];
  _zoePetalSprites._a = cols.map(c => {
    const s = document.createElement('canvas'); s.width = 24; s.height = 36;
    const g = s.getContext('2d');
    g.beginPath(); g.moveTo(12, 2); g.bezierCurveTo(23, 12, 21, 30, 12, 34); g.bezierCurveTo(3, 30, 1, 12, 12, 2); g.closePath();
    const lg = g.createLinearGradient(0, 0, 0, 36);
    lg.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.96)`);
    lg.addColorStop(1, `rgba(${(c[0]*0.65)|0},${(c[1]*0.65)|0},${(c[2]*0.65)|0},0.6)`);
    g.fillStyle = lg; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(10, 13, 2.6, 6, 0, 0, Math.PI * 2); g.fill();
    return s;
  });
  return _zoePetalSprites._a;
}
function _zoePollenSprite() {
  if (_zoePollenSprite._c) return _zoePollenSprite._c;
  const s = document.createElement('canvas'); s.width = s.height = 16;
  const g = s.getContext('2d');
  const rg = g.createRadialGradient(8, 8, 0, 8, 8, 8);
  rg.addColorStop(0, 'rgba(232,255,180,1)');
  rg.addColorStop(0.45, 'rgba(170,225,120,0.6)');
  rg.addColorStop(1, 'rgba(110,180,90,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 16, 16);
  return _zoePollenSprite._c = s;
}
function _zoeDrawFlower(ctx, sz, n, sprIdx, bloom) {
  const spr = _zoePetalSprites()[sprIdx];
  const open = 0.5 + 0.55 * bloom;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate(i * (Math.PI * 2 / n));
    const pl = sz * open;
    ctx.globalAlpha = 0.88;
    ctx.drawImage(spr, -sz * 0.28, -pl, sz * 0.56, pl);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 0.42);
  cg.addColorStop(0, `rgba(255,240,150,${0.7 + bloom * 0.28})`);
  cg.addColorStop(1, 'rgba(230,180,60,0)');
  ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, sz * 0.42, 0, Math.PI * 2); ctx.fill();
}
function _zoeNewFlower(W, H) {
  return { x: Math.random() * W, y: Math.random() * H, sz: 16 + Math.random() * 26,
    n: 5 + (Math.random() * 3 | 0), spr: Math.random() * 6 | 0, rate: 0.35 + Math.random() * 0.6,
    ph: Math.random() * 6.28, spin: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.18, a: 0.55 + Math.random() * 0.4 };
}
function _zoeNewFall(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : -20 - Math.random() * 40,
    vy: 12 + Math.random() * 24, sz: 9 + Math.random() * 9, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 1.4,
    sw: 0.4 + Math.random() * 1.0, sa: 8 + Math.random() * 16, ph: Math.random() * 6.28, spr: Math.random() * 6 | 0,
    a: 0.55 + Math.random() * 0.4 };
}
function _zoeNewMote(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : H + Math.random() * 30,
    vy: 10 + Math.random() * 26, r: 1.5 + Math.random() * 4, a: 0.35 + Math.random() * 0.5,
    sw: 0.4 + Math.random() * 1.1, sa: 6 + Math.random() * 14, ph: Math.random() * 6.28, ff: 2 + Math.random() * 3, flick: 1 };
}

function _drawZoePattern(canvas, ctx, W, H, t) {
  if (_drawZoePattern._lt !== undefined && t - _drawZoePattern._lt < 0.033) return;
  const dt = _drawZoePattern._lt === undefined ? 0.016 : Math.min(t - _drawZoePattern._lt, 0.05);
  _drawZoePattern._lt = t;

  if (canvas._zoeW !== W || canvas._zoeH !== H) {
    canvas._zoeW = W; canvas._zoeH = H;
    canvas._zoeBase = null; canvas._zoeVign = null; canvas._zoeFlowers = null;
    canvas._zoeFall = null; canvas._zoeMotes = null; canvas._zoeGrass = null;
  }
  const breathe = 0.5 + 0.5 * Math.sin(t * 0.6);

  // 1 ── Deep verdant base
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (!canvas._zoeBase) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0c2014'); g.addColorStop(0.55, '#0a1a10'); g.addColorStop(1, '#06120a');
    canvas._zoeBase = g;
  }
  ctx.fillStyle = canvas._zoeBase; ctx.fillRect(0, 0, W, H);

  // 2 ── Soft canopy light from above
  ctx.globalCompositeOperation = 'lighter';
  const lg = ctx.createRadialGradient(W * 0.5, -H * 0.1, 0, W * 0.5, -H * 0.1, H * 1.1);
  lg.addColorStop(0, `rgba(150,220,120,${0.12 + breathe * 0.06})`);
  lg.addColorStop(0.5, 'rgba(110,180,90,0.05)');
  lg.addColorStop(1, 'rgba(60,120,60,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);

  // 3 ── Blooming flowers (breathing open/closed), softly glowing
  if (!canvas._zoeFlowers) canvas._zoeFlowers = Array.from({ length: 7 }, () => _zoeNewFlower(W, H));
  ctx.globalCompositeOperation = 'source-over';
  for (const f of canvas._zoeFlowers) {
    f.spin += f.vr * dt;
    const bloom = 0.5 + 0.5 * Math.sin(t * f.rate + f.ph);
    ctx.save(); ctx.globalAlpha = f.a; ctx.translate(f.x, f.y); ctx.rotate(f.spin);
    _zoeDrawFlower(ctx, f.sz, f.n, f.spr, bloom);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 4 ── Drifting petals
  if (!canvas._zoeFall) canvas._zoeFall = Array.from({ length: 28 }, () => _zoeNewFall(W, H, true));
  const psp = _zoePetalSprites();
  for (const p of canvas._zoeFall) {
    p.y += p.vy * dt; p.x += Math.sin(t * p.sw + p.ph) * p.sa * dt; p.rot += p.vr * dt;
    if (p.y > H + 20) Object.assign(p, _zoeNewFall(W, H, false));
    ctx.save(); ctx.globalAlpha = p.a; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.drawImage(psp[p.spr], -p.sz / 2, -p.sz * 0.7, p.sz, p.sz * 1.4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 5 ── Rising pollen / fireflies
  if (!canvas._zoeMotes) canvas._zoeMotes = Array.from({ length: 36 }, () => _zoeNewMote(W, H, true));
  const poll = _zoePollenSprite();
  ctx.globalCompositeOperation = 'lighter';
  for (const m of canvas._zoeMotes) {
    m.y -= m.vy * dt; m.x += Math.sin(t * m.sw + m.ph) * m.sa * dt;
    m.flick = 0.55 + 0.45 * Math.sin(t * m.ff + m.ph);
    if (m.y < -14) Object.assign(m, _zoeNewMote(W, H, false));
    ctx.globalAlpha = Math.min(1, m.flick * m.a);
    const d = m.r * 4; ctx.drawImage(poll, m.x - d / 2, m.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 6 ── Swaying grass along the bottom
  if (!canvas._zoeGrass) {
    const n = Math.ceil(W / 20);
    canvas._zoeGrass = Array.from({ length: n }, (_, i) => ({
      x: i * 20 + Math.random() * 20, h: 34 + Math.random() * 78, ph: Math.random() * 6.28,
      sw: 0.5 + Math.random() * 0.8, w: 3 + Math.random() * 3, shade: 30 + Math.random() * 40,
    }));
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const b of canvas._zoeGrass) {
    const sway = Math.sin(t * b.sw + b.ph) * b.h * 0.22;
    const tipX = b.x + sway, tipY = H - b.h, cX = b.x + sway * 0.5;
    ctx.fillStyle = `rgb(${(20 + b.shade * 0.4) | 0},${(60 + b.shade) | 0},${(28 + b.shade * 0.4) | 0})`;
    ctx.beginPath();
    ctx.moveTo(b.x - b.w / 2, H + 2);
    ctx.quadraticCurveTo(cX - b.w * 0.3, (H + tipY) / 2, tipX, tipY);
    ctx.quadraticCurveTo(cX + b.w * 0.3, (H + tipY) / 2, b.x + b.w / 2, H + 2);
    ctx.closePath(); ctx.fill();
  }

  // 7 ── Soft vignette
  if (!canvas._zoeVign) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.82);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(4,10,5,0.7)');
    canvas._zoeVign = vg;
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = canvas._zoeVign; ctx.fillRect(0, 0, W, H);
}

// ── Cursor: a glowing life-spirit orb with orbiting leaves; trails petals +
// pollen, and clicks bloom a burst of petals + a growing ring. ──
function _zoeMouseMove(e) { _zoeTargX = e.clientX; _zoeTargY = e.clientY; }
function _zoeClick() {
  _zoeRings.push({ x: _zoeX, y: _zoeY, r: 6, life: 1 });
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, s = 50 + Math.random() * 140;
    _zoeParts.push({ x: _zoeX, y: _zoeY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1,
      sz: 8 + Math.random() * 8, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 4,
      spr: Math.random() * 6 | 0, petal: true, grav: 30 });
  }
}
function _drawZoeOverlay(canvas, ctx, W, H, t) {
  if (_drawZoeOverlay._lt !== undefined && t - _drawZoeOverlay._lt < 0.033) return;
  const dt = _drawZoeOverlay._lt === undefined ? 0.016 : Math.min(t - _drawZoeOverlay._lt, 0.05);
  _drawZoeOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);

  const SPRING = 58, DAMP = 11;
  _zoeVX += ((_zoeTargX - _zoeX) * SPRING - _zoeVX * DAMP) * dt;
  _zoeVY += ((_zoeTargY - _zoeY) * SPRING - _zoeVY * DAMP) * dt;
  _zoeX += _zoeVX * dt; _zoeY += _zoeVY * dt;
  const spd = Math.hypot(_zoeVX, _zoeVY);

  // emit trail (petals + pollen)
  _zoeEmit += dt * (6 + spd * 0.04);
  while (_zoeEmit > 1) {
    _zoeEmit -= 1;
    if (_zoeParts.length > 220) break;
    const pollen = Math.random() < 0.55;
    const a = Math.random() * Math.PI * 2, s = 6 + Math.random() * 22;
    _zoeParts.push({ x: _zoeX + (Math.random() - 0.5) * 12, y: _zoeY + (Math.random() - 0.5) * 12,
      vx: Math.cos(a) * s - _zoeVX * 0.04, vy: Math.sin(a) * s - _zoeVY * 0.04 + 8, life: 1,
      sz: pollen ? (1.5 + Math.random() * 2.5) : (6 + Math.random() * 6), rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 2.5, spr: Math.random() * 6 | 0, petal: !pollen, grav: 14 });
  }

  // rings (blooming growth)
  ctx.globalCompositeOperation = 'lighter';
  for (let i = _zoeRings.length - 1; i >= 0; i--) {
    const r = _zoeRings[i];
    r.r += 150 * dt; r.life -= dt * 1.0;
    if (r.life <= 0) { _zoeRings.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(170,235,140,${r.life * 0.45})`; ctx.lineWidth = 2 + r.life * 2;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }

  // particles
  const psp = _zoePetalSprites(); const poll = _zoePollenSprite();
  for (let i = _zoeParts.length - 1; i >= 0; i--) {
    const p = _zoeParts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 0.97; p.rot += p.vr * dt; p.life -= dt * 0.6;
    if (p.life <= 0) { _zoeParts.splice(i, 1); continue; }
    const a = Math.min(1, p.life);
    if (p.petal) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.globalAlpha = a * 0.9; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.drawImage(psp[p.spr], -p.sz / 2, -p.sz * 0.7, p.sz, p.sz * 1.4); ctx.restore();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a; const d = p.sz * 4.5; ctx.drawImage(poll, p.x - d / 2, p.y - d / 2, d, d);
    }
  }
  ctx.globalAlpha = 1;

  // life-spirit orb + orbiting leaves
  ctx.globalCompositeOperation = 'lighter';
  const pr = 12 + Math.sin(t * 2.5) * 2;
  const og = ctx.createRadialGradient(_zoeX, _zoeY, 0, _zoeX, _zoeY, pr * 2.4);
  og.addColorStop(0, 'rgba(225,255,190,0.92)');
  og.addColorStop(0.4, 'rgba(150,225,120,0.55)');
  og.addColorStop(1, 'rgba(80,160,80,0)');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(_zoeX, _zoeY, pr * 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(236,255,210,0.95)'; ctx.beginPath(); ctx.arc(_zoeX, _zoeY, pr * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const leaf = _zoePetalSprites()[5];   // green sprite as a leaf
  for (let i = 0; i < 3; i++) {
    const a = t * 1.4 + i * (Math.PI * 2 / 3);
    const lx = _zoeX + Math.cos(a) * 20, ly = _zoeY + Math.sin(a) * 20;
    ctx.save(); ctx.globalAlpha = 0.85; ctx.translate(lx, ly); ctx.rotate(a + Math.PI / 2);
    ctx.drawImage(leaf, -5, -8, 10, 16); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function _startZoeOverlay() {
  _stopZoeOverlay();
  _drawZoeOverlay._lt = undefined;
  _zoeX = _zoeTargX = window.innerWidth * 0.5;
  _zoeY = _zoeTargY = window.innerHeight * 0.5;
  _zoeVX = _zoeVY = 0; _zoeParts = []; _zoeRings = []; _zoeEmit = 0;
  window.addEventListener('mousemove', _zoeMouseMove);
  window.addEventListener('click', _zoeClick);
  const cv = document.createElement('canvas');
  cv.id = 'zoe-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('zoe-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawZoeOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _zoeOverlayRafId = requestAnimationFrame(frame);
  }
  _zoeOverlayRafId = requestAnimationFrame(frame);
}
function _stopZoeOverlay() {
  if (_zoeOverlayRafId) { cancelAnimationFrame(_zoeOverlayRafId); _zoeOverlayRafId = null; }
  window.removeEventListener('mousemove', _zoeMouseMove);
  window.removeEventListener('click', _zoeClick);
  const cv = document.getElementById('zoe-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// IRIS — starry, shimmyful, joyous magical-girl sparkle.
// ════════════════════════════════════════════════════════════════
// Cached 4-point sparkle glint (warm gold/white) — drawn scaled for twinkle.
function _irisSparkleSprite() {
  if (_irisSparkleSprite._c) return _irisSparkleSprite._c;
  const s = document.createElement('canvas'); s.width = s.height = 32;
  const g = s.getContext('2d'); g.translate(16, 16);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 10);
  rg.addColorStop(0, 'rgba(255,251,215,1)');
  rg.addColorStop(0.5, 'rgba(255,224,110,0.55)');
  rg.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,252,228,0.95)';
  for (let k = 0; k < 4; k++) {
    g.beginPath(); g.moveTo(0, -15); g.lineTo(2, 0); g.lineTo(0, 4); g.lineTo(-2, 0); g.closePath(); g.fill();
    g.rotate(Math.PI / 2);
  }
  return _irisSparkleSprite._c = s;
}
function _irisStarPath(ctx, R) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5), a2 = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.lineTo(Math.cos(a2) * R * 0.45, Math.sin(a2) * R * 0.45);
  }
  ctx.closePath();
}
function _irisNewMote(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : H + Math.random() * 30,
    vy: 12 + Math.random() * 26, r: 1.5 + Math.random() * 3.5, a: 0.4 + Math.random() * 0.5,
    sw: 0.4 + Math.random() * 1.2, sa: 6 + Math.random() * 16, ph: Math.random() * 6.28, ff: 2.5 + Math.random() * 4, flick: 1 };
}
function _irisNewFall(W, H, scatter) {
  const vy = 55 + Math.random() * 95;
  return { x: Math.random() * W, y: scatter ? Math.random() * H : -24 - Math.random() * 60,
    vx: (Math.random() - 0.5) * 34, vy, fall: vy, sz: 9 + Math.random() * 11,
    rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 2.4, a: 0.88 + Math.random() * 0.12,
    explode: scatter ? false : Math.random() < 0.5, explodeY: H * (0.22 + Math.random() * 0.5) };
}
// Burst a falling star into smaller stars shooting outward.
function _irisBurst(canvas, x, y) {
  if (canvas._irisFrags.length >= 300) return;
  const n = 6 + (Math.random() * 5 | 0);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, spd = 80 + Math.random() * 170;
    canvas._irisFrags.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
      sz: 3.5 + Math.random() * 4, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 9, life: 1 });
  }
}
// A glowing 5-point star with a sparkle halo (cheap: one sprite + two fills).
function _irisDrawStar(ctx, x, y, sz, rot, alpha) {
  const spr = _irisSparkleSprite();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha * 0.6;
  const d = sz * 4.2; ctx.drawImage(spr, x - d / 2, y - d / 2, d, d);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  _irisStarPath(ctx, sz); ctx.fillStyle = '#ffd766'; ctx.fill();
  _irisStarPath(ctx, sz * 0.52); ctx.fillStyle = '#fff4cf'; ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function _drawIrisPattern(canvas, ctx, W, H, t) {
  const fresh = _drawIrisPattern._lt === undefined;
  if (!fresh && t - _drawIrisPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawIrisPattern._lt, 0.05);
  _drawIrisPattern._lt = t;
  if (fresh) canvas._irisShoot = null;   // shooting star uses absolute time → reset on (re)entry

  if (canvas._irisW !== W || canvas._irisH !== H) {
    canvas._irisW = W; canvas._irisH = H;
    canvas._irisBase = null; canvas._irisVign = null; canvas._irisStars = null;
    canvas._irisBig = null; canvas._irisMotes = null;
    canvas._irisFalls = null; canvas._irisFrags = null;
  }
  const shimmer = 0.5 + 0.5 * Math.sin(t * 1.1);
  const spr = _irisSparkleSprite();

  // 1 ── Warm magical twilight base (gold heart → plum edges)
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (!canvas._irisBase) {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.9);
    g.addColorStop(0, '#3a2c12'); g.addColorStop(0.5, '#241433'); g.addColorStop(1, '#160a20');
    canvas._irisBase = g;
  }
  ctx.fillStyle = canvas._irisBase; ctx.fillRect(0, 0, W, H);

  // 2 ── Twinkling star field
  if (!canvas._irisStars) {
    canvas._irisStars = Array.from({ length: 130 }, () => ({
      x: Math.random() * W, y: Math.random() * H, sz: 1.6 + Math.random() * 3.4,
      tw: 1 + Math.random() * 3, ph: Math.random() * 6.28, base: 0.4 + Math.random() * 0.6,
    }));
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const s of canvas._irisStars) {
    const a = s.base * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph)));
    ctx.globalAlpha = a;
    const d = s.sz * 3.4; ctx.drawImage(spr, s.x - d / 2, s.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 3 ── Big shimmyful sparkles (slow twinkle, prominent glitter)
  if (!canvas._irisBig) {
    canvas._irisBig = Array.from({ length: 16 }, () => ({
      x: Math.random() * W, y: Math.random() * H, sz: 8 + Math.random() * 12,
      tw: 0.6 + Math.random() * 1.4, ph: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.4, rot: Math.random() * 6.28,
    }));
  }
  for (const s of canvas._irisBig) {
    s.rot += s.spin * dt;
    const pulse = 0.5 + 0.5 * Math.sin(t * s.tw + s.ph);
    ctx.globalAlpha = 0.3 + pulse * 0.7;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
    const d = s.sz * (1.6 + pulse * 1.2) * 2;
    ctx.drawImage(spr, -d / 2, -d / 2, d, d);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 4 ── Rising glitter motes
  if (!canvas._irisMotes) canvas._irisMotes = Array.from({ length: 30 }, () => _irisNewMote(W, H, true));
  for (const m of canvas._irisMotes) {
    m.y -= m.vy * dt; m.x += Math.sin(t * m.sw + m.ph) * m.sa * dt;
    m.flick = 0.5 + 0.5 * Math.sin(t * m.ff + m.ph);
    if (m.y < -12) Object.assign(m, _irisNewMote(W, H, false));
    ctx.globalAlpha = Math.min(1, m.flick * m.a);
    const d = m.r * 3.6; ctx.drawImage(spr, m.x - d / 2, m.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 5.5 ── Falling 5-point stars; some burst into smaller stars shooting out.
  // The cursor (read in canvas-local space) draws nearby stars toward your wand
  // and pops any it touches — interactive sparkle-catching.
  if (!canvas._irisFalls) canvas._irisFalls = Array.from({ length: 10 }, () => _irisNewFall(W, H, true));
  if (!canvas._irisFrags) canvas._irisFrags = [];
  let mx = -99999, my = -99999;
  if (_irisOverlayRafId) { const rc = canvas.getBoundingClientRect(); mx = _irisTargX - rc.left; my = _irisTargY - rc.top; }
  const PULL = 130, POP = 30;
  for (const f of canvas._irisFalls) {
    const dx = f.x - mx, dy = f.y - my, dist = Math.hypot(dx, dy);
    if (dist < POP) { _irisBurst(canvas, f.x, f.y); _irisShimmyCount++; _irisUpdateShimmyDisplay(); Object.assign(f, _irisNewFall(W, H, false)); continue; }
    if (dist < PULL) {                                  // gently drawn toward the wand
      const k = (1 - dist / PULL) / (dist + 0.001);
      f.vx -= dx * k * 620 * dt; f.vy -= dy * k * 620 * dt;
    }
    f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
    f.vx += (0 - f.vx) * dt * 1.1;                      // ease back to a calm fall
    f.vy += (f.fall - f.vy) * dt * 1.1;
    if (f.explode && f.y >= f.explodeY) { _irisBurst(canvas, f.x, f.y); Object.assign(f, _irisNewFall(W, H, false)); continue; }
    if (f.y > H + 30 || f.y < -120 || f.x < -120 || f.x > W + 120) Object.assign(f, _irisNewFall(W, H, false));
    _irisDrawStar(ctx, f.x, f.y, f.sz, f.rot, f.a);
  }
  for (let i = canvas._irisFrags.length - 1; i >= 0; i--) {
    const p = canvas._irisFrags[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 70 * dt; p.vx *= 0.99; p.rot += p.vr * dt; p.life -= dt * 1.3;
    if (p.life <= 0) { canvas._irisFrags.splice(i, 1); continue; }
    _irisDrawStar(ctx, p.x, p.y, p.sz, p.rot, Math.min(1, p.life) * 0.95);
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  // 6 ── Occasional shooting star (re-entry safe)
  {
    let sh = canvas._irisShoot;
    if (!sh || t < sh.born) canvas._irisShoot = sh = { next: t + 1.5 + Math.random() * 3, born: -99, dur: 0.9, x0: 0, y0: 0, ang: 0, len: 0 };
    if (t > sh.next) {
      sh.born = t; sh.dur = 0.7 + Math.random() * 0.5; sh.next = t + 3 + Math.random() * 5;
      sh.x0 = W * (0.08 + Math.random() * 0.6); sh.y0 = H * (0.04 + Math.random() * 0.3);
      sh.ang = Math.PI * (0.12 + Math.random() * 0.2); sh.len = Math.min(W, H) * (0.45 + Math.random() * 0.3);
    }
    const age = t - sh.born;
    if (age >= 0 && age < sh.dur) {
      const prog = age / sh.dur;
      const hx = sh.x0 + Math.cos(sh.ang) * sh.len * prog, hy = sh.y0 + Math.sin(sh.ang) * sh.len * prog;
      const trail = 80, tx = hx - Math.cos(sh.ang) * trail, ty = hy - Math.sin(sh.ang) * trail;
      const a = Math.sin(prog * Math.PI);
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, 'rgba(255,240,180,0)'); g.addColorStop(1, `rgba(255,246,205,${a * 0.9})`);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      const d = 12; ctx.globalAlpha = a; ctx.drawImage(spr, hx - d / 2, hy - d / 2, d, d); ctx.globalAlpha = 1;
    }
  }

  // 7 ── Soft warm vignette
  if (!canvas._irisVign) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.82);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(14,6,20,0.72)');
    canvas._irisVign = vg;
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = canvas._irisVign; ctx.fillRect(0, 0, W, H);
}

// ── Cursor: a spinning golden star wand trailing glitter; click bursts sparkles
// + hearts + a twinkle ring. ──
function _irisMouseMove(e) { _irisTargX = e.clientX; _irisTargY = e.clientY; }
function _irisClick() {
  _irisRings.push({ x: _irisX, y: _irisY, r: 6, life: 1 });
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 190;
    _irisParts.push({ x: _irisX, y: _irisY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1,
      sz: 4 + Math.random() * 6, grav: 50, tw: 2 + Math.random() * 4, ph: Math.random() * 6.28 });
  }
}
function _drawIrisOverlay(canvas, ctx, W, H, t) {
  if (_drawIrisOverlay._lt !== undefined && t - _drawIrisOverlay._lt < 0.033) return;
  const dt = _drawIrisOverlay._lt === undefined ? 0.016 : Math.min(t - _drawIrisOverlay._lt, 0.05);
  _drawIrisOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);

  const SPRING = 70, DAMP = 12;
  _irisVX += ((_irisTargX - _irisX) * SPRING - _irisVX * DAMP) * dt;
  _irisVY += ((_irisTargY - _irisY) * SPRING - _irisVY * DAMP) * dt;
  _irisX += _irisVX * dt; _irisY += _irisVY * dt;
  const spd = Math.hypot(_irisVX, _irisVY);

  // glitter trail
  _irisEmit += dt * (16 + spd * 0.06);
  while (_irisEmit > 1) {
    _irisEmit -= 1;
    if (_irisParts.length > 260) break;
    const a = Math.random() * Math.PI * 2, s = 8 + Math.random() * 26;
    _irisParts.push({ x: _irisX + (Math.random() - 0.5) * 12, y: _irisY + (Math.random() - 0.5) * 12,
      vx: Math.cos(a) * s - _irisVX * 0.05, vy: Math.sin(a) * s - _irisVY * 0.05, life: 1,
      sz: 3 + Math.random() * 5, rot: 0, vr: 0, heart: false, grav: 24, tw: 2 + Math.random() * 4, ph: Math.random() * 6.28 });
  }

  const spr = _irisSparkleSprite();
  // twinkle rings
  ctx.globalCompositeOperation = 'lighter';
  for (let i = _irisRings.length - 1; i >= 0; i--) {
    const r = _irisRings[i];
    r.r += 260 * dt; r.life -= dt * 1.3;
    if (r.life <= 0) { _irisRings.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(255,235,150,${r.life * 0.5})`; ctx.lineWidth = 2 + r.life * 3;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  // particles
  ctx.globalCompositeOperation = 'lighter';
  for (let i = _irisParts.length - 1; i >= 0; i--) {
    const p = _irisParts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 0.98; p.life -= dt * 0.7;
    if (p.life <= 0) { _irisParts.splice(i, 1); continue; }
    const a = Math.min(1, p.life);
    ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * p.tw + p.ph));
    const d = p.sz * 3.4; ctx.drawImage(spr, p.x - d / 2, p.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // spinning star wand at the head
  ctx.globalCompositeOperation = 'lighter';
  const pr = 14 + Math.sin(t * 4) * 2;
  const og = ctx.createRadialGradient(_irisX, _irisY, 0, _irisX, _irisY, pr * 2.6);
  og.addColorStop(0, 'rgba(255,250,210,0.9)');
  og.addColorStop(0.4, 'rgba(255,215,90,0.55)');
  og.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(_irisX, _irisY, pr * 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(_irisX, _irisY); ctx.rotate(t * 1.6);
  _irisStarPath(ctx, pr);
  const sg = ctx.createLinearGradient(0, -pr, 0, pr);
  sg.addColorStop(0, 'rgba(255,250,225,0.98)'); sg.addColorStop(1, 'rgba(255,205,80,0.95)');
  ctx.fillStyle = sg; ctx.fill();
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
}
function _startIrisOverlay() {
  _stopIrisOverlay();
  _drawIrisOverlay._lt = undefined;
  _irisX = _irisTargX = window.innerWidth * 0.5;
  _irisY = _irisTargY = window.innerHeight * 0.5;
  _irisVX = _irisVY = 0; _irisParts = []; _irisRings = []; _irisEmit = 0;
  window.addEventListener('mousemove', _irisMouseMove);
  window.addEventListener('click', _irisClick);
  const cv = document.createElement('canvas');
  cv.id = 'iris-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('iris-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawIrisOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _irisOverlayRafId = requestAnimationFrame(frame);
  }
  _irisOverlayRafId = requestAnimationFrame(frame);
}
function _stopIrisOverlay() {
  if (_irisOverlayRafId) { cancelAnimationFrame(_irisOverlayRafId); _irisOverlayRafId = null; }
  window.removeEventListener('mousemove', _irisMouseMove);
  window.removeEventListener('click', _irisClick);
  const cv = document.getElementById('iris-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

// ════════════════════════════════════════════════════════════════
// MOUSEBURGER — magical boy. Cool, serious, melancholic midnight; with
// a few stray burgers drifting by (never the main plate).
// ════════════════════════════════════════════════════════════════
function _mbSparkleSprite() {
  if (_mbSparkleSprite._c) return _mbSparkleSprite._c;
  const s = document.createElement('canvas'); s.width = s.height = 32;
  const g = s.getContext('2d'); g.translate(16, 16);
  const rg = g.createRadialGradient(0, 0, 0, 0, 0, 9);
  rg.addColorStop(0, 'rgba(255,244,224,1)');
  rg.addColorStop(0.5, 'rgba(255,162,80,0.5)');
  rg.addColorStop(1, 'rgba(214,80,40,0)');
  g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,236,206,0.95)';            // sharp, long 4-point glint (tougher)
  for (let k = 0; k < 4; k++) {
    g.beginPath(); g.moveTo(0, -15); g.lineTo(1.4, 0); g.lineTo(0, 3.2); g.lineTo(-1.4, 0); g.closePath(); g.fill();
    g.rotate(Math.PI / 2);
  }
  return _mbSparkleSprite._c = s;
}
function _mbBurgerSprite() {
  if (_mbBurgerSprite._c) return _mbBurgerSprite._c;
  const s = document.createElement('canvas'); s.width = 44; s.height = 40;
  const g = s.getContext('2d'); g.translate(22, 20);
  g.lineJoin = 'round';
  g.fillStyle = '#cf9450';                           // bottom bun
  g.beginPath(); g.moveTo(-17, 8); g.lineTo(17, 8); g.quadraticCurveTo(19, 16, 11, 17); g.lineTo(-11, 17); g.quadraticCurveTo(-19, 16, -17, 8); g.closePath(); g.fill();
  g.fillStyle = '#7a3f22'; g.fillRect(-17, 3, 34, 5);   // patty
  g.fillStyle = '#f3c64c';                           // cheese
  g.beginPath(); g.moveTo(-17, 2); g.lineTo(17, 2); g.lineTo(13, 7); g.lineTo(7, 3); g.lineTo(1, 7); g.lineTo(-6, 3); g.lineTo(-13, 7); g.closePath(); g.fill();
  g.fillStyle = '#7ec24a';                           // lettuce
  g.beginPath(); g.moveTo(-18, 0);
  for (let x = -18; x <= 18; x += 5) { g.lineTo(x + 2.5, -3); g.lineTo(x + 5, 0); }
  g.lineTo(18, 2); g.lineTo(-18, 2); g.closePath(); g.fill();
  g.fillStyle = '#e0a458';                           // top bun
  g.beginPath(); g.moveTo(-17, -1); g.quadraticCurveTo(0, -19, 17, -1); g.closePath(); g.fill();
  g.fillStyle = '#fff2d6';                           // sesame
  for (const p of [[-9, -7, 0.4], [-1, -10, -0.3], [7, -7, 0.2], [3, -5, 0.6], [-5, -4, -0.5]]) {
    g.save(); g.translate(p[0], p[1]); g.rotate(p[2]); g.beginPath(); g.ellipse(0, 0, 2, 1, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  return _mbBurgerSprite._c = s;
}
function _mbStarPath(ctx, R) {   // sharp 4-point star (compass-glint)
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + i * (Math.PI / 2), a2 = a + Math.PI / 4;
    ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.lineTo(Math.cos(a2) * R * 0.32, Math.sin(a2) * R * 0.32);
  }
  ctx.closePath();
}
// A starlit knight's blade: steel sword pointing along +X, hilt at origin, with
// a glowing edge and a 4-point star for a pommel gem.
function _mbDrawSword(ctx, x, y, ang, alpha) {
  const g = 7, L = 42, w = 3.2, tip = 9;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.globalCompositeOperation = 'lighter';            // blade glow
  ctx.globalAlpha = alpha * 0.5;
  const gg = ctx.createLinearGradient(g, 0, L, 0);
  gg.addColorStop(0, 'rgba(255,150,60,0)'); gg.addColorStop(0.5, 'rgba(255,170,80,0.55)'); gg.addColorStop(1, 'rgba(255,225,170,0)');
  ctx.fillStyle = gg; ctx.fillRect(g, -w * 2.4, L - g, w * 4.8);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
  ctx.beginPath();                                     // blade
  ctx.moveTo(g, -w); ctx.lineTo(L - tip, -w); ctx.lineTo(L, 0); ctx.lineTo(L - tip, w); ctx.lineTo(g, w); ctx.closePath();
  const bg = ctx.createLinearGradient(0, -w, 0, w);
  bg.addColorStop(0, '#8a4a2e'); bg.addColorStop(0.5, '#fff0e0'); bg.addColorStop(1, '#8a4a2e');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = 'rgba(255,250,235,0.55)'; ctx.lineWidth = 0.8;   // fuller
  ctx.beginPath(); ctx.moveTo(g + 2, 0); ctx.lineTo(L - tip, 0); ctx.stroke();
  ctx.fillStyle = '#c0824a'; ctx.fillRect(g - 1, -11, 4, 22);        // crossguard
  ctx.fillStyle = '#ffd0a0'; ctx.beginPath(); ctx.arc(g + 1, -11, 2, 0, Math.PI * 2); ctx.arc(g + 1, 11, 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a2014'; ctx.fillRect(-2, -2.2, g + 1, 4.4);     // grip
  ctx.save(); ctx.translate(-4, 0); ctx.rotate(0.2);                 // pommel star gem
  _mbStarPath(ctx, 5); ctx.fillStyle = '#ffe6c2'; ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.globalAlpha = 1;
}
// shortest distance from point (px,py) to segment (ax,ay)-(bx,by)
function _mbSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let tt = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
  return Math.hypot(px - (ax + tt * dx), py - (ay + tt * dy));
}
function _mbCrownSprite() {
  if (_mbCrownSprite._c) return _mbCrownSprite._c;
  const s = document.createElement('canvas'); s.width = 40; s.height = 30;
  const g = s.getContext('2d'); g.translate(20, 16); g.lineJoin = 'round';
  g.fillStyle = '#f0c64a';
  g.beginPath();
  g.moveTo(-15, 6); g.lineTo(15, 6); g.lineTo(15, -2); g.lineTo(10, 3); g.lineTo(7, -8); g.lineTo(0, 2); g.lineTo(-7, -8); g.lineTo(-10, 3); g.lineTo(-15, -2);
  g.closePath(); g.fill();
  g.fillStyle = '#e0b43a'; g.fillRect(-15, 5, 30, 4);
  g.fillStyle = '#ff6b9a'; g.beginPath(); g.arc(0, 5, 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6bb0ff'; g.beginPath(); g.arc(-8, 6, 1.6, 0, Math.PI * 2); g.arc(8, 6, 1.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff2c0'; for (const p of [[-7, -8], [0, 2], [7, -8]]) { g.beginPath(); g.arc(p[0], p[1] - 1, 1.4, 0, Math.PI * 2); g.fill(); }
  return _mbCrownSprite._c = s;
}
function _mbNewMote(W, H, scatter) {
  return { x: Math.random() * W, y: scatter ? Math.random() * H : H + Math.random() * 30,
    vy: 8 + Math.random() * 18, r: 1.4 + Math.random() * 3, a: 0.25 + Math.random() * 0.4,
    sw: 0.3 + Math.random() * 0.9, sa: 5 + Math.random() * 12, ph: Math.random() * 6.28, ff: 1.5 + Math.random() * 3, flick: 1 };
}
function _mbNewBurger(W, H) {
  return { x: Math.random() * W, y: H * 0.12 + Math.random() * H * 0.72,
    vx: (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 10), bob: Math.random() * 6.28, bs: 0.4 + Math.random() * 0.6,
    ba: 8 + Math.random() * 14, sz: 0.85 + Math.random() * 0.5, rot: (Math.random() - 0.5) * 0.3, a: 0.2 + Math.random() * 0.18 };
}

function _drawMbPattern(canvas, ctx, W, H, t) {
  const fresh = _drawMbPattern._lt === undefined;
  if (!fresh && t - _drawMbPattern._lt < 0.033) return;
  const dt = fresh ? 0.016 : Math.min(t - _drawMbPattern._lt, 0.05);
  _drawMbPattern._lt = t;
  if (fresh) canvas._mbComet = null;   // comet uses absolute time → reset on (re)entry

  if (canvas._mbW !== W || canvas._mbH !== H) {
    canvas._mbW = W; canvas._mbH = H;
    canvas._mbBase = null; canvas._mbVign = null; canvas._mbStars = null;
    canvas._mbCryst = null; canvas._mbMotes = null; canvas._mbBurgers = null; canvas._mbConst = null; canvas._mbSwordC = null; canvas._mbHalves = null;
  }
  const pulse = 0.5 + 0.5 * Math.sin(t * 0.5);
  const spr = _mbSparkleSprite();

  // 1 ── Cool midnight base
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  if (!canvas._mbBase) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1c0d08'); g.addColorStop(0.55, '#1a0b06'); g.addColorStop(1, '#0c0503');
    canvas._mbBase = g;
  }
  ctx.fillStyle = canvas._mbBase; ctx.fillRect(0, 0, W, H);

  // 2 ── Cool star field (dim, slow twinkle)
  if (!canvas._mbStars) {
    canvas._mbStars = Array.from({ length: 130 }, () => ({
      x: Math.random() * W, y: Math.random() * H, sz: 1.4 + Math.random() * 3,
      tw: 0.5 + Math.random() * 2, ph: Math.random() * 6.28, base: 0.3 + Math.random() * 0.55,
    }));
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const s of canvas._mbStars) {
    const a = s.base * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph)));
    ctx.globalAlpha = a; const d = s.sz * 3.2; ctx.drawImage(spr, s.x - d / 2, s.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 2.5 ── Constellations — brighter stars linked into a quiet star-map. The
  // signature: a structured, brooding night sky, not loose glitter like Iris.
  if (!canvas._mbConst) {
    const N = 22, cs = [];
    for (let i = 0; i < N; i++) cs.push({ x: 30 + Math.random() * (W - 60), y: 30 + Math.random() * (H - 60), ph: Math.random() * 6.28, tw: 0.4 + Math.random() * 0.8 });
    const maxD2 = Math.pow(Math.min(W, H) * 0.24, 2), links = [];
    for (let i = 0; i < N; i++) {
      const near = [];
      for (let j = 0; j < N; j++) if (j !== i) { const dx = cs[i].x - cs[j].x, dy = cs[i].y - cs[j].y; near.push([dx * dx + dy * dy, j]); }
      near.sort((a, b) => a[0] - b[0]);
      let cnt = 0;
      for (const [d2, j] of near) { if (cnt >= 2) break; if (d2 < maxD2) { if (i < j) links.push([i, j]); cnt++; } }
    }
    canvas._mbConst = { stars: cs, links };
  }
  const _con = canvas._mbConst;
  ctx.globalCompositeOperation = 'lighter';
  for (const [i, j] of _con.links) {
    const A = _con.stars[i], B = _con.stars[j];
    const sh = 0.5 + 0.5 * Math.sin(t * 0.4 + i + j);
    ctx.strokeStyle = `rgba(230,140,72,${0.05 + sh * 0.1})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  }
  for (const s of _con.stars) {
    const a = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
    ctx.globalAlpha = a; const d = 9; ctx.drawImage(spr, s.x - d / 2, s.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 2.7 ── A sword spelled out in the stars — his star-sign as Iris's knight
  if (!canvas._mbSwordC) {
    const cx0 = W * 0.2, cy0 = H * 0.5, s0 = Math.min(W, H) * 0.34;
    const norm = [[0, 1.0], [0, 0.84], [-0.34, 0.78], [0.34, 0.78], [0, 0.46], [0, 0.0]];
    canvas._mbSwordC = { pts: norm.map(p => ({ x: cx0 + p[0] * s0, y: cy0 + (p[1] - 0.5) * s0, ph: Math.random() * 6.28 })),
      links: [[0, 1], [1, 2], [1, 3], [2, 3], [1, 4], [4, 5]] };
  }
  const _sw = canvas._mbSwordC, swp = 0.5 + 0.5 * Math.sin(t * 0.6);
  ctx.globalCompositeOperation = 'lighter';
  for (const [i, j] of _sw.links) {
    const A = _sw.pts[i], B = _sw.pts[j];
    ctx.strokeStyle = `rgba(240,152,80,${0.1 + swp * 0.15})`; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  }
  for (const p of _sw.pts) {
    const a = 0.5 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.9 + p.ph));
    ctx.globalAlpha = a; const d = 11; ctx.drawImage(spr, p.x - d / 2, p.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 3 ── A lone melancholic star, high, slowly pulsing with a cross-glint
  {
    const lx = W * 0.7, ly = H * 0.2, lp = 0.5 + 0.5 * Math.sin(t * 0.8);
    ctx.globalAlpha = 0.5 + lp * 0.45; const d = 26 + lp * 8;
    ctx.drawImage(spr, lx - d / 2, ly - d / 2, d, d);
    ctx.strokeStyle = `rgba(255,224,182,${0.25 + lp * 0.3})`; ctx.lineWidth = 0.8;
    const gl = 22 + lp * 8;
    ctx.beginPath(); ctx.moveTo(lx - gl, ly); ctx.lineTo(lx + gl, ly); ctx.moveTo(lx, ly - gl); ctx.lineTo(lx, ly + gl); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 4 ── Sharp crystalline sparkles (slow, deliberate, tougher)
  if (!canvas._mbCryst) {
    canvas._mbCryst = Array.from({ length: 14 }, () => ({
      x: Math.random() * W, y: Math.random() * H, sz: 8 + Math.random() * 11,
      tw: 0.4 + Math.random() * 1.0, ph: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.3, rot: Math.random() * 6.28,
    }));
  }
  for (const s of canvas._mbCryst) {
    s.rot += s.spin * dt;
    const p = 0.5 + 0.5 * Math.sin(t * s.tw + s.ph);
    ctx.globalAlpha = 0.22 + p * 0.6;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
    const d = s.sz * (1.5 + p) * 2; ctx.drawImage(spr, -d / 2, -d / 2, d, d);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 5 ── Rising cool motes
  if (!canvas._mbMotes) canvas._mbMotes = Array.from({ length: 28 }, () => _mbNewMote(W, H, true));
  for (const m of canvas._mbMotes) {
    m.y -= m.vy * dt; m.x += Math.sin(t * m.sw + m.ph) * m.sa * dt;
    m.flick = 0.5 + 0.5 * Math.sin(t * m.ff + m.ph);
    if (m.y < -12) Object.assign(m, _mbNewMote(W, H, false));
    ctx.globalAlpha = Math.min(1, m.flick * m.a);
    const d = m.r * 3.4; ctx.drawImage(spr, m.x - d / 2, m.y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // 6 ── Stray drifting burgers (subtle easter egg — never the main plate)
  // (one of them is Iris's crown) — and you can SLICE a burger clean in half by
  // swinging the blade through it fast enough (the crown is spared).
  if (!canvas._mbBurgers) canvas._mbBurgers = Array.from({ length: 4 }, (_, i) => { const b = _mbNewBurger(W, H); b.crown = (i === 0); return b; });
  if (!canvas._mbHalves) canvas._mbHalves = [];
  const bspr = _mbBurgerSprite(), crspr = _mbCrownSprite();
  // blade segment + swing speed in canvas-local space (while the cursor is live)
  let _bx0 = -99999, _by0 = -99999, _bx1 = 0, _by1 = 0, _swspd = 0, _rcL = 0, _rcT = 0;
  if (_mbOverlayRafId) {
    const rc = canvas.getBoundingClientRect(); _rcL = rc.left; _rcT = rc.top;
    _bx0 = _mbTargX - _rcL; _by0 = _mbTargY - _rcT; _swspd = Math.hypot(_mbVX, _mbVY);
    _bx1 = _bx0 + Math.cos(_mbSwordAng) * 42; _by1 = _by0 + Math.sin(_mbSwordAng) * 42;
  }
  const CUT_SPEED = 520;
  ctx.globalCompositeOperation = 'source-over';
  for (const b of canvas._mbBurgers) {
    b.x += b.vx * dt;
    if (b.x < -50) b.x = W + 50; if (b.x > W + 50) b.x = -50;
    const by = b.y + Math.sin(t * b.bs + b.bob) * b.ba;
    if (!b.crown && _swspd > CUT_SPEED && _mbSegDist(b.x, by, _bx0, _by0, _bx1, _by1) < 22 + 14 * b.sz) {
      const ux = _mbVX / _swspd, uy = _mbVY / _swspd, ppx = -uy, ppy = ux, imp = 90, sep = 95;
      if (canvas._mbHalves.length < 24) for (const hf of [1, -1]) {
        canvas._mbHalves.push({ x: b.x, y: by, vx: ux * imp + ppx * sep * hf, vy: uy * imp + ppy * sep * hf,
          rot: b.rot, vr: (Math.random() - 0.5) * 5 + hf * 2.5, life: 1, half: hf > 0 ? 1 : 0, sz: b.sz });
      }
      _mbSlashes.push({ x: b.x + _rcL, y: by + _rcT, ang: _mbSwordAng, life: 1 });   // feedback slash
      _mbBurgerFx(b.x + _rcL, by + _rcT); _mbSliceCount++; _mbUpdateSliceDisplay();
      Object.assign(b, _mbNewBurger(W, H)); b.crown = false;
      continue;
    }
    const sprI = b.crown ? crspr : bspr, iw = b.crown ? 40 : 44, ih = b.crown ? 30 : 40;
    ctx.save(); ctx.globalAlpha = b.a * (0.7 + 0.3 * Math.sin(t * 0.7 + b.bob)); ctx.translate(b.x, by); ctx.rotate(b.rot);
    ctx.drawImage(sprI, -iw * b.sz / 2, -ih * b.sz / 2, iw * b.sz, ih * b.sz);
    ctx.restore();
  }
  // tumbling burger halves (top piece flies one way, bottom piece the other)
  for (let i = canvas._mbHalves.length - 1; i >= 0; i--) {
    const h = canvas._mbHalves[i];
    h.x += h.vx * dt; h.y += h.vy * dt; h.vy += 240 * dt; h.vx *= 0.99; h.rot += h.vr * dt; h.life -= dt * 0.5;
    if (h.life <= 0) { canvas._mbHalves.splice(i, 1); continue; }
    const w = 44 * h.sz, hh2 = 20 * h.sz;
    ctx.save(); ctx.globalAlpha = Math.min(1, h.life); ctx.translate(h.x, h.y); ctx.rotate(h.rot);
    ctx.drawImage(bspr, 0, h.half === 0 ? 0 : 20, 44, 20, -w / 2, -hh2 / 2, w, hh2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // 7 ── Lone slow comet (occasional, melancholic, re-entry safe)
  {
    let sh = canvas._mbComet;
    if (!sh || t < sh.born) canvas._mbComet = sh = { next: t + 3 + Math.random() * 5, born: -99, dur: 1.4, x0: 0, y0: 0, ang: 0, len: 0 };
    if (t > sh.next) {
      sh.born = t; sh.dur = 1.2 + Math.random() * 0.7; sh.next = t + 6 + Math.random() * 9;
      sh.x0 = W * (0.1 + Math.random() * 0.6); sh.y0 = H * (0.05 + Math.random() * 0.28);
      sh.ang = Math.PI * (0.12 + Math.random() * 0.18); sh.len = Math.min(W, H) * (0.45 + Math.random() * 0.3);
    }
    const age = t - sh.born;
    if (age >= 0 && age < sh.dur) {
      const prog = age / sh.dur;
      const hx = sh.x0 + Math.cos(sh.ang) * sh.len * prog, hy = sh.y0 + Math.sin(sh.ang) * sh.len * prog;
      const trail = 90, tx = hx - Math.cos(sh.ang) * trail, ty = hy - Math.sin(sh.ang) * trail;
      const a = Math.sin(prog * Math.PI);
      const g = ctx.createLinearGradient(tx, ty, hx, hy);
      g.addColorStop(0, 'rgba(255,190,130,0)'); g.addColorStop(1, `rgba(255,228,186,${a * 0.8})`);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      const d = 12; ctx.globalAlpha = a; ctx.drawImage(spr, hx - d / 2, hy - d / 2, d, d); ctx.globalAlpha = 1;
    }
  }

  // 8 ── Cool vignette
  if (!canvas._mbVign) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.82);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(14,5,2,0.78)');
    canvas._mbVign = vg;
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = canvas._mbVign; ctx.fillRect(0, 0, W, H);
}

// ── Cursor: a sharp spinning star, cooler and more deliberate; trails crystal
// sparkles. Click bursts sparkles + a cool ring (and rarely a stray burger). ──
function _mbMouseMove(e) { _mbTargX = e.clientX; _mbTargY = e.clientY; }
function _mbClick() {
  _mbRings.push({ x: _mbX, y: _mbY, r: 6, life: 1 });
  _mbSlashes.push({ x: _mbX, y: _mbY, ang: _mbSwordAng, life: 1 });   // a sword slash
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2, s = 55 + Math.random() * 175;
    _mbParts.push({ x: _mbX, y: _mbY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1,
      sz: 4 + Math.random() * 5, grav: 45, tw: 1.5 + Math.random() * 3, ph: Math.random() * 6.28 });
  }
  // a big burger flung from the blade — swing back through it to slice it!
  const a = Math.random() * Math.PI * 2, s = 95 + Math.random() * 130;
  _mbParts.push({ kind: 'burger', x: _mbX, y: _mbY, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 75, life: 1, decay: 0.32,
    sz: 1.0 + Math.random() * 0.55, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 4, grav: 210, cuttable: true, cutArm: 0.22 });
}
function _drawMbOverlay(canvas, ctx, W, H, t) {
  if (_drawMbOverlay._lt !== undefined && t - _drawMbOverlay._lt < 0.033) return;
  const dt = _drawMbOverlay._lt === undefined ? 0.016 : Math.min(t - _drawMbOverlay._lt, 0.05);
  _drawMbOverlay._lt = t;
  ctx.clearRect(0, 0, W, H);

  const SPRING = 95, DAMP = 13;   // tighter, more serious than Iris
  _mbVX += ((_mbTargX - _mbX) * SPRING - _mbVX * DAMP) * dt;
  _mbVY += ((_mbTargY - _mbY) * SPRING - _mbVY * DAMP) * dt;
  _mbX += _mbVX * dt; _mbY += _mbVY * dt;
  const spd = Math.hypot(_mbVX, _mbVY);

  // orient the blade along movement (eased; holds its angle when nearly still)
  let _ta = _mbSwordAng;
  if (spd > 22) _ta = Math.atan2(_mbVY, _mbVX);
  let _da = _ta - _mbSwordAng;
  while (_da > Math.PI) _da -= Math.PI * 2;
  while (_da < -Math.PI) _da += Math.PI * 2;
  _mbSwordAng += _da * Math.min(1, dt * 9);

  _mbEmit += dt * (8 + spd * 0.035);
  while (_mbEmit > 1) {
    _mbEmit -= 1;
    if (_mbParts.length > 240) break;
    const a = Math.random() * Math.PI * 2, s = 8 + Math.random() * 22;
    _mbParts.push({ x: _mbX + (Math.random() - 0.5) * 10, y: _mbY + (Math.random() - 0.5) * 10,
      vx: Math.cos(a) * s - _mbVX * 0.05, vy: Math.sin(a) * s - _mbVY * 0.05, life: 1,
      sz: 3 + Math.random() * 4, grav: 18, tw: 1.5 + Math.random() * 3, ph: Math.random() * 6.28, burger: false });
  }

  const spr = _mbSparkleSprite(), bspr = _mbBurgerSprite();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = _mbRings.length - 1; i >= 0; i--) {
    const r = _mbRings[i];
    r.r += 300 * dt; r.life -= dt * 1.4;
    if (r.life <= 0) { _mbRings.splice(i, 1); continue; }
    ctx.strokeStyle = `rgba(255,180,108,${r.life * 0.5})`; ctx.lineWidth = 2 + r.life * 3;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
  }
  // sword slashes — a bright crescent swing afterimage
  for (let i = _mbSlashes.length - 1; i >= 0; i--) {
    const s = _mbSlashes[i];
    s.life -= dt * 2.6;
    if (s.life <= 0) { _mbSlashes.splice(i, 1); continue; }
    const r = 30 + (1 - s.life) * 26, spread = 1.1;
    ctx.strokeStyle = `rgba(255,228,186,${s.life * 0.85})`; ctx.lineWidth = 1 + s.life * 3.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, s.ang - spread, s.ang + spread); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${s.life * 0.5})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, r + 5, s.ang - spread * 0.8, s.ang + spread * 0.8); ctx.stroke();
  }
  const _bx0 = _mbX, _by0 = _mbY, _bx1 = _mbX + Math.cos(_mbSwordAng) * 42, _by1 = _mbY + Math.sin(_mbSwordAng) * 42;
  const _swspd = Math.hypot(_mbVX, _mbVY);
  for (let i = _mbParts.length - 1; i >= 0; i--) {
    const p = _mbParts[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.grav || 0) * dt; p.vx *= 0.98;
    if (p.vr) p.rot += p.vr * dt;
    p.life -= (p.decay || 0.75) * dt;
    // a flung burger gets cut in half by a fast swing through it
    if (p.kind === 'burger' && p.cuttable) {
      p.cutArm -= dt;
      if (p.cutArm <= 0 && _swspd > 520 && _mbSegDist(p.x, p.y, _bx0, _by0, _bx1, _by1) < 16 + 18 * p.sz) {
        const ux = _mbVX / _swspd, uy = _mbVY / _swspd, ppx = -uy, ppy = ux;
        for (const hf of [1, -1]) _mbParts.push({ kind: 'half', x: p.x, y: p.y, vx: ux * 70 + ppx * 110 * hf, vy: uy * 70 + ppy * 110 * hf,
          rot: p.rot, vr: (Math.random() - 0.5) * 5 + hf * 2, life: 1, decay: 0.55, sz: p.sz, half: hf > 0 ? 1 : 0, grav: 240 });
        _mbBurgerFx(p.x, p.y); _mbSlashes.push({ x: p.x, y: p.y, ang: _mbSwordAng, life: 1 });
        _mbSliceCount++; _mbUpdateSliceDisplay();
        _mbParts.splice(i, 1); continue;
      }
    }
    if (p.life <= 0) { _mbParts.splice(i, 1); continue; }
    const a = Math.min(1, p.life);
    if (p.kind === 'burger') {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      const w = 44 * p.sz, h = 40 * p.sz; ctx.drawImage(bspr, -w / 2, -h / 2, w, h); ctx.restore();
    } else if (p.kind === 'half') {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      const w = 44 * p.sz, hh2 = 20 * p.sz; ctx.drawImage(bspr, 0, p.half === 0 ? 0 : 20, 44, 20, -w / 2, -hh2 / 2, w, hh2); ctx.restore();
    } else if (p.kind === 'crumb') {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      ctx.fillStyle = p.col; ctx.fillRect(-p.sz, -p.sz, p.sz * 2, p.sz * 2); ctx.restore();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(t * p.tw + p.ph));
      const d = p.sz * 3.4; ctx.drawImage(spr, p.x - d / 2, p.y - d / 2, d, d);
    }
  }
  ctx.globalAlpha = 1;

  // constellation thread — a glowing line woven through the cursor's path, with
  // small star nodes brightening toward the head (his signature mechanic)
  _mbThread.push({ x: _mbX, y: _mbY });
  if (_mbThread.length > 16) _mbThread.shift();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i < _mbThread.length; i++) {
    const f = i / _mbThread.length;
    ctx.strokeStyle = `rgba(255,178,108,${f * 0.5})`; ctx.lineWidth = f * 2.2;
    ctx.beginPath(); ctx.moveTo(_mbThread[i - 1].x, _mbThread[i - 1].y); ctx.lineTo(_mbThread[i].x, _mbThread[i].y); ctx.stroke();
  }
  for (let i = 0; i < _mbThread.length; i += 2) {
    const f = i / _mbThread.length;
    ctx.globalAlpha = f * 0.8; const d = 4 + f * 4;
    ctx.drawImage(spr, _mbThread[i].x - d / 2, _mbThread[i].y - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // glowing orb + the starlit blade he wields (points where you move)
  ctx.globalCompositeOperation = 'lighter';
  const pr = 13 + Math.sin(t * 2.5) * 1.5;
  const og = ctx.createRadialGradient(_mbX, _mbY, 0, _mbX, _mbY, pr * 2.5);
  og.addColorStop(0, 'rgba(255,238,212,0.85)');
  og.addColorStop(0.4, 'rgba(255,150,70,0.45)');
  og.addColorStop(1, 'rgba(200,80,30,0)');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(_mbX, _mbY, pr * 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  _mbDrawSword(ctx, _mbX, _mbY, _mbSwordAng, 1);
}
function _startMbOverlay() {
  _stopMbOverlay();
  _drawMbOverlay._lt = undefined;
  _mbX = _mbTargX = window.innerWidth * 0.5;
  _mbY = _mbTargY = window.innerHeight * 0.5;
  _mbVX = _mbVY = 0; _mbParts = []; _mbRings = []; _mbEmit = 0; _mbThread = []; _mbSlashes = []; _mbSwordAng = 0;
  window.addEventListener('mousemove', _mbMouseMove);
  window.addEventListener('click', _mbClick);
  const cv = document.createElement('canvas');
  cv.id = 'mb-overlay';
  cv.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;';
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('mb-overlay');
    if (!cv2) return;
    if (cv2.width !== window.innerWidth || cv2.height !== window.innerHeight) {
      cv2.width = window.innerWidth; cv2.height = window.innerHeight;
    }
    _drawMbOverlay(cv2, cv2.getContext('2d'), cv2.width, cv2.height, (now - t0) / 1000);
    _mbOverlayRafId = requestAnimationFrame(frame);
  }
  _mbOverlayRafId = requestAnimationFrame(frame);
}
function _stopMbOverlay() {
  if (_mbOverlayRafId) { cancelAnimationFrame(_mbOverlayRafId); _mbOverlayRafId = null; }
  window.removeEventListener('mousemove', _mbMouseMove);
  window.removeEventListener('click', _mbClick);
  const cv = document.getElementById('mb-overlay');
  if (cv) cv.remove();
}
/* ─────────────────────────────────────────────────────────────── */

function drawPattern(canvas, type, params, t) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Special: Bizzy's bee pattern — always overrides stored type
  if (type === 'bizzy_bees')     { _drawBizzyPattern(canvas, ctx, W, H, t);         return; }
  if (type === 'blackjack_neon') { _drawBlackjackPattern(canvas, ctx, W, H, t);      return; }
  if (type === 'katie_pond')     { _drawKatiePattern(canvas, ctx, W, H, t);          return; }
  if (type === 'snaps_scales')   { _drawSnapsPattern(canvas, ctx, W, H, t);          return; }
  if (type === 'leon_swords')    { _drawLeonPattern(canvas, ctx, W, H, t, params);   return; }
  if (type === 'valkyrie_rain')  { _drawValkyriePattern(canvas, ctx, W, H, t);            return; }
  if (type === 'adam_ice')       { _drawAdamPattern(canvas, ctx, W, H, t, params);       return; }
  if (type === 'fury_fire')      { _drawFuryPattern(canvas, ctx, W, H, t);               return; }
  if (type === 'sorrow_fire')    { _drawSorrowPattern(canvas, ctx, W, H, t);             return; }
  if (type === 'juko_code')      { _drawJukoPattern(canvas, ctx, W, H, t);               return; }
  if (type === 'lucifer_unleashed') { _drawLuciferPattern(canvas, ctx, W, H, t);         return; }
  if (type === 'divine_light')      { _drawDivinePattern(canvas, ctx, W, H, t);          return; }
  if (type === 'jimmy_muffin')      { _drawJimmyPattern(canvas, ctx, W, H, t);           return; }
  if (type === 'aether_forest')     { _drawAetherPattern(canvas, ctx, W, H, t);          return; }
  if (type === 'cappy_milk')        { _drawCappyPattern(canvas, ctx, W, H, t);           return; }
  if (type === 'diva_virus')        { _drawDivaPattern(canvas, ctx, W, H, t);            return; }
  if (type === 'evelynn_moon')      { _drawEvelynnPattern(canvas, ctx, W, H, t);         return; }
  if (type === 'oliver_west')       { _drawOliverPattern(canvas, ctx, W, H, t);          return; }
  if (type === 'spruce_roses')      { _drawSprucePattern(canvas, ctx, W, H, t);          return; }
  if (type === 'momo_waste')        { _drawMomoPattern(canvas, ctx, W, H, t);            return; }
  if (type === 'ronnette_scrap')    { _drawRonnettePattern(canvas, ctx, W, H, t);        return; }
  if (type === 'miami_aero')        { _drawMiamiPattern(canvas, ctx, W, H, t);           return; }
  if (type === 'joni_jungle')       { _drawJoniPattern(canvas, ctx, W, H, t);            return; }
  if (type === 'shi_souls')      { _drawShiPattern(canvas, ctx, W, H, t);                 return; }
  if (type === 'lunar_moon')     { _drawLunarPattern(canvas, ctx, W, H, t);               return; }
  if (type === 'helios_sun')     { _drawHeliosPattern(canvas, ctx, W, H, t);              return; }
  if (type === 'zoe_garden')     { _drawZoePattern(canvas, ctx, W, H, t);                 return; }
  if (type === 'iris_starlight') { _drawIrisPattern(canvas, ctx, W, H, t);                return; }
  if (type === 'mouseburger_dusk') { _drawMbPattern(canvas, ctx, W, H, t);                return; }

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
  // Performance mode: skip all animated backgrounds (blank canvas, no RAF)
  if (_perfMode) { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); return; }
  canvas._matrixCols = null; canvas._matrixW = 0; canvas._diamonds = null; canvas._pixels = null; canvas._stars = null; canvas._noiseFrame = 0; canvas._noiseBuf = null;

  // Reset 30fps cap timestamps — each pattern stores _lt relative to its own
  // t0 (which resets to 0 on every startBgAnim call). Without this reset,
  // _lt from the previous session (e.g. 3.5s) causes every frame to be skipped
  // until t catches back up, giving a multi-second blank delay on re-entry.
  _drawBizzyPattern._lt       = undefined;
  _drawBlackjackPattern._lt   = undefined;
  _drawKatiePattern._lt       = undefined;
  _drawSnapsPattern._lt       = undefined;
  _drawLeonPattern._lt        = undefined;
  _drawValkyriePattern._lt    = undefined;
  _drawValkyrieOverlay._lt    = undefined;
  _drawAdamPattern._lt        = undefined;
  _drawAdamOverlay._lt        = undefined;
  _drawFuryPattern._lt        = undefined;
  _drawFuryOverlay._lt        = undefined;
  _drawJukoPattern._lt        = undefined;
  _drawJukoOverlay._lt        = undefined;
  _drawLuciferPattern._lt     = undefined;
  _drawLuciferOverlay._lt     = undefined;
  _drawDivinePattern._lt      = undefined;
  _drawDivineOverlay._lt      = undefined;
  _drawJimmyPattern._lt       = undefined;
  _drawAetherPattern._lt      = undefined;
  _drawAetherOverlay._lt      = undefined;
  _drawCappyPattern._lt       = undefined;
  _drawCappyOverlay._lt       = undefined;
  _drawDivaPattern._lt        = undefined;
  _drawDivaCursor._lt         = undefined;
  _drawEvelynnPattern._lt     = undefined;
  _drawEvelynnCursor._lt      = undefined;
  _drawOliverPattern._lt      = undefined;
  _drawOliverCursor._lt       = undefined;
  _drawSprucePattern._lt      = undefined;
  _drawSpruceCursor._lt       = undefined;
  _drawMomoPattern._lt        = undefined;
  _drawMomoCursor._lt         = undefined;
  _drawRonnettePattern._lt    = undefined;
  _drawRonnetteCursor._lt     = undefined;
  _drawMiamiPattern._lt       = undefined;
  _drawMiamiCursor._lt        = undefined;
  _drawJoniPattern._lt        = undefined;
  _drawJoniCursor._lt         = undefined;
  _drawShiPattern._lt         = undefined;
  _drawShiOverlay._lt         = undefined;
  _drawLunarPattern._lt       = undefined;
  _drawLunarOverlay._lt       = undefined;
  _drawHeliosPattern._lt      = undefined;
  _drawHeliosOverlay._lt      = undefined;
  _drawZoePattern._lt         = undefined;
  _drawZoeOverlay._lt         = undefined;
  _drawIrisPattern._lt        = undefined;
  _drawIrisOverlay._lt        = undefined;
  _drawMbPattern._lt          = undefined;
  _drawMbOverlay._lt          = undefined;

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
  _stopKatieOverlay();
  _stopLeonOverlay();
  _stopValkyrieOverlay();
  _stopAdamOverlay();
  _stopFuryOverlay();
  _stopJukoOverlay();
  _stopLuciferOverlay();
  _stopDivineOverlay();
  _stopAetherOverlay();
  _stopCappyOverlay();
  _stopDivaOverlay();
  _stopEvelynnOverlay();
  _stopOliverOverlay();
  _stopSpruceOverlay();
  _stopMomoOverlay();
  _stopRonnetteOverlay();
  _stopMiamiOverlay();
  _stopJoniOverlay();
  _stopShiOverlay();
  _stopLunarOverlay();
  _stopHeliosOverlay();
  _stopZoeOverlay();
  _stopIrisOverlay();
  _stopMbOverlay();
  _stopSorrowOverlay();
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
  if (_naraMode) { _startNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); }
  else if (_isBizzy(c))    { _stopNaraRaf(); _startBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); }
  else if (_isKatie(c))    { _stopNaraRaf(); _stopBizzyRaf(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', c.color); }
  else if (_isLeon(c))     { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', c.color); }
  else if (_isValkyrie(c)) { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', c.color); }
  else if (_isAdam(c))     { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', c.color); }
  else if (_isFury(c))     { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', c.color); }
  else if (_isJuko(c))     { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', c.color); }
  else if (_isLuciferUnleashed(c)) { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', '#e01122'); }
  else if (_isDivine(c))   { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); document.getElementById('char-view').style.setProperty('--char-color', '#f4cf6a'); }
  else if (_isShi(c))      { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', '#a7c4dc'); }
  else if (_isLunar(c))    { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', '#8aa8de'); }
  else if (_isHelios(c))   { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', '#ffab1f'); }
  else if (_isZoe(c))      { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', '#5cc457'); }
  else if (_isIris(c))     { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', '#ffd633'); }
  else if (_isMb(c))       { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', '#d9552c'); }
  else if (_isSorrow(c))   { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', '#9a9a9a'); }
  else { _stopNaraRaf(); _stopBizzyRaf(); _stopKatieOverlay(); _stopLeonOverlay(); _stopValkyrieOverlay(); _stopAdamOverlay(); _stopFuryOverlay(); _stopJukoOverlay(); _stopLuciferOverlay(); _stopShiOverlay(); _stopLunarOverlay(); _stopHeliosOverlay(); _stopZoeOverlay(); _stopIrisOverlay(); _stopMbOverlay(); _stopSorrowOverlay(); _stopDivineOverlay(); document.getElementById('char-view').style.setProperty('--char-color', c.color); }

  // ── Juko-only reactive UI chrome: glowing tabs, special pfp, glitching name ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _av = document.getElementById('cv-avatar');
    const _nm = document.getElementById('cv-name');
    if (_isJuko(c)) {
      _cvRoot.classList.add('juko-ui');
      _cvRoot.style.setProperty('--juko-glow', '0');
      _cvRoot.style.setProperty('--juko-onset', '0');
      _cvRoot.style.setProperty('--juko-glitch', '0');
      if (_av) {
        _av.classList.add('juko-pfp');
        // Always-on (music-independent) FX layer: a holographic sheen sweep
        // plus a blinking "</>" code tag in the corner. Re-injected each render
        // because the avatar innerHTML (the <img>) was just rebuilt above.
        if (!_av.querySelector('.juko-pfp-fx')) {
          const fx = document.createElement('div');
          fx.className = 'juko-pfp-fx';
          fx.innerHTML = '<span class="juko-pfp-tag">&lt;/&gt;</span>';
          _av.appendChild(fx);
        }
      }
      if (_nm) { _nm.classList.add('juko-name'); _nm.setAttribute('data-text', _nm.textContent || 'JUKO!'); }
    } else {
      _cvRoot.classList.remove('juko-ui');
      if (_av) { _av.classList.remove('juko-pfp'); const fx = _av.querySelector('.juko-pfp-fx'); if (fx) fx.remove(); }
      if (_nm) { _nm.classList.remove('juko-name'); _nm.removeAttribute('data-text'); }
    }
  }

  // ── Lucifer · Unleashed — demonic UI chrome (infernal panels, hellish pfp,
  // menacing glitching name). Only while the Unleashed form is active. ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _av = document.getElementById('cv-avatar');
    const _nm = document.getElementById('cv-name');
    const _pc = document.getElementById('pattern-canvas');
    if (_isLuciferUnleashed(c)) {
      _cvRoot.classList.add('lucifer-ui');
      if (_av) _av.classList.add('lucifer-pfp');
      if (_nm) { _nm.classList.add('lucifer-name'); _nm.setAttribute('data-text', _nm.textContent || 'LUCIFER'); }
      if (_pc) _pc.style.opacity = '0.9';   // the hellscape should DOMINATE, not whisper
    } else {
      _cvRoot.classList.remove('lucifer-ui');
      if (_av) _av.classList.remove('lucifer-pfp');
      if (_nm) { _nm.classList.remove('lucifer-name'); if (!_nm.classList.contains('juko-name')) _nm.removeAttribute('data-text'); }
      if (_pc) _pc.style.opacity = '';      // back to the default subtle 0.3
    }
  }

  // ── The Shi — elegant soul-garden UI chrome (frost-pale panels, ethereal
  // breathing name, spectral portrait). Character-wide. ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _av = document.getElementById('cv-avatar');
    const _nm = document.getElementById('cv-name');
    const _pc = document.getElementById('pattern-canvas');
    if (_isShi(c)) {
      _cvRoot.classList.add('shi-ui');
      if (_av) _av.classList.add('shi-pfp');
      if (_nm) { _nm.classList.add('shi-name'); _nm.setAttribute('data-text', _nm.textContent || 'THE SHI'); }
      if (_pc) _pc.style.opacity = '0.6';   // ethereal but present
    } else {
      _cvRoot.classList.remove('shi-ui');
      if (_av) _av.classList.remove('shi-pfp');
      if (_nm) { _nm.classList.remove('shi-name'); if (!_nm.classList.contains('juko-name') && !_nm.classList.contains('lucifer-name')) _nm.removeAttribute('data-text'); }
      if (_pc && !_isLuciferUnleashed(c)) _pc.style.opacity = '';
    }
  }

  // ── Lunar — moonlit UI chrome (deep-blue panels, silver breathing name,
  // moonlit portrait). Character-wide. ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _av = document.getElementById('cv-avatar');
    const _nm = document.getElementById('cv-name');
    const _pc = document.getElementById('pattern-canvas');
    if (_isLunar(c)) {
      _cvRoot.classList.add('lunar-ui');
      if (_av) _av.classList.add('lunar-pfp');
      if (_nm) { _nm.classList.add('lunar-name'); _nm.setAttribute('data-text', _nm.textContent || 'LUNAR'); }
      if (_pc) _pc.style.opacity = '0.7';
    } else {
      _cvRoot.classList.remove('lunar-ui');
      if (_av) _av.classList.remove('lunar-pfp');
      if (_nm) { _nm.classList.remove('lunar-name'); if (!_nm.classList.contains('juko-name') && !_nm.classList.contains('lucifer-name') && !_nm.classList.contains('shi-name')) _nm.removeAttribute('data-text'); }
      if (_pc && !_isLuciferUnleashed(c) && !_isShi(c)) _pc.style.opacity = '';
    }
  }

  // ── Helios — blazing solar UI chrome (molten-gold panels, fierce radiant
  // name, sun-forged portrait). Character-wide. ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _av = document.getElementById('cv-avatar');
    const _nm = document.getElementById('cv-name');
    const _pc = document.getElementById('pattern-canvas');
    if (_isHelios(c)) {
      _cvRoot.classList.add('helios-ui');
      if (_av) _av.classList.add('helios-pfp');
      if (_nm) { _nm.classList.add('helios-name'); _nm.setAttribute('data-text', _nm.textContent || 'HELIOS'); }
      if (_pc) _pc.style.opacity = '0.85';   // blinding
    } else {
      _cvRoot.classList.remove('helios-ui');
      if (_av) _av.classList.remove('helios-pfp');
      if (_nm) { _nm.classList.remove('helios-name'); if (!_nm.classList.contains('juko-name') && !_nm.classList.contains('lucifer-name') && !_nm.classList.contains('shi-name') && !_nm.classList.contains('lunar-name')) _nm.removeAttribute('data-text'); }
      if (_pc && !_isLuciferUnleashed(c) && !_isShi(c) && !_isLunar(c)) _pc.style.opacity = '';
    }
  }

  // ── Zoe — living-garden UI chrome (verdant panels, blooming name, leafy
  // portrait). Character-wide. ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _av = document.getElementById('cv-avatar');
    const _nm = document.getElementById('cv-name');
    const _pc = document.getElementById('pattern-canvas');
    if (_isZoe(c)) {
      _cvRoot.classList.add('zoe-ui');
      if (_av) _av.classList.add('zoe-pfp');
      if (_nm) { _nm.classList.add('zoe-name'); _nm.setAttribute('data-text', _nm.textContent || 'ZOE'); }
      if (_pc) _pc.style.opacity = '0.72';
    } else {
      _cvRoot.classList.remove('zoe-ui');
      if (_av) _av.classList.remove('zoe-pfp');
      if (_nm) { _nm.classList.remove('zoe-name'); if (!_nm.classList.contains('juko-name') && !_nm.classList.contains('lucifer-name') && !_nm.classList.contains('shi-name') && !_nm.classList.contains('lunar-name') && !_nm.classList.contains('helios-name')) _nm.removeAttribute('data-text'); }
      if (_pc && !_isLuciferUnleashed(c) && !_isShi(c) && !_isLunar(c) && !_isHelios(c)) _pc.style.opacity = '';
    }
  }

  // ── Iris — shimmyful magical-girl UI chrome (golden sparkle panels, twinkling
  // name, starlit portrait). Character-wide. ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _av = document.getElementById('cv-avatar');
    const _nm = document.getElementById('cv-name');
    const _pc = document.getElementById('pattern-canvas');
    if (_isIris(c)) {
      _cvRoot.classList.add('iris-ui');
      if (_av) _av.classList.add('iris-pfp');
      if (_nm) { _nm.classList.add('iris-name'); _nm.setAttribute('data-text', _nm.textContent || 'IRIS'); }
      if (_pc) _pc.style.opacity = '0.78';
    } else {
      _cvRoot.classList.remove('iris-ui');
      if (_av) _av.classList.remove('iris-pfp');
      if (_nm) { _nm.classList.remove('iris-name'); if (!_nm.classList.contains('juko-name') && !_nm.classList.contains('lucifer-name') && !_nm.classList.contains('shi-name') && !_nm.classList.contains('lunar-name') && !_nm.classList.contains('helios-name') && !_nm.classList.contains('zoe-name')) _nm.removeAttribute('data-text'); }
      if (_pc && !_isLuciferUnleashed(c) && !_isShi(c) && !_isLunar(c) && !_isHelios(c) && !_isZoe(c)) _pc.style.opacity = '';
    }
  }

  // ── Mouseburger — cool magical-boy UI chrome (indigo panels, serious silver
  // name, midnight portrait). Character-wide. ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _av = document.getElementById('cv-avatar');
    const _nm = document.getElementById('cv-name');
    const _pc = document.getElementById('pattern-canvas');
    if (_isMb(c)) {
      _cvRoot.classList.add('mb-ui');
      if (_av) _av.classList.add('mb-pfp');
      if (_nm) { _nm.classList.add('mb-name'); _nm.setAttribute('data-text', _nm.textContent || 'MOUSEBURGER'); }
      if (_pc) _pc.style.opacity = '0.78';
    } else {
      _cvRoot.classList.remove('mb-ui');
      if (_av) _av.classList.remove('mb-pfp');
      if (_nm) { _nm.classList.remove('mb-name'); if (!_nm.classList.contains('juko-name') && !_nm.classList.contains('lucifer-name') && !_nm.classList.contains('shi-name') && !_nm.classList.contains('lunar-name') && !_nm.classList.contains('helios-name') && !_nm.classList.contains('zoe-name') && !_nm.classList.contains('iris-name')) _nm.removeAttribute('data-text'); }
      if (_pc && !_isLuciferUnleashed(c) && !_isShi(c) && !_isLunar(c) && !_isHelios(c) && !_isZoe(c) && !_isIris(c)) _pc.style.opacity = '';
    }
  }

  // ── Divine — radiant goddess-of-light UI chrome (luminous gold panels, holy
  // glowing name, haloed portrait). The heavenly mirror of Lucifer. Placed last
  // so its name data-text is never stripped by an earlier block. Character-wide. ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _av = document.getElementById('cv-avatar');
    const _nm = document.getElementById('cv-name');
    const _pc = document.getElementById('pattern-canvas');
    if (_isDivine(c)) {
      _cvRoot.classList.add('divine-ui');
      if (_av) _av.classList.add('divine-pfp');
      if (_nm) { _nm.classList.add('divine-name'); _nm.setAttribute('data-text', _nm.textContent || 'DIVINE'); }
      if (_pc) _pc.style.opacity = '0.62';   // present and luminous, but not blinding
    } else {
      _cvRoot.classList.remove('divine-ui');
      if (_av) _av.classList.remove('divine-pfp');
      if (_nm) { _nm.classList.remove('divine-name'); if (!_nm.classList.contains('juko-name') && !_nm.classList.contains('lucifer-name') && !_nm.classList.contains('shi-name') && !_nm.classList.contains('lunar-name') && !_nm.classList.contains('helios-name') && !_nm.classList.contains('zoe-name') && !_nm.classList.contains('iris-name') && !_nm.classList.contains('mb-name')) _nm.removeAttribute('data-text'); }
      if (_pc && !_isLuciferUnleashed(c) && !_isShi(c) && !_isLunar(c) && !_isHelios(c) && !_isZoe(c) && !_isIris(c) && !_isMb(c)) _pc.style.opacity = '';
      // Undo the fixed-to-#content pinning the Divine (or Jimmy) draw loop applied,
      // so other characters get the default absolute, content-sized background
      // canvas back. (Both pin the canvas fixed; this generic reset un-pins either.)
      if (_pc && _pc.style.position === 'fixed') {
        _pc.style.position = ''; _pc.style.left = ''; _pc.style.top = '';
        _pc.style.width = ''; _pc.style.height = '';
      }
    }
  }

  // ── ✨DIVA✨ — erratic rainbow-virus UI chrome (glitching rainbow panels +
  // a glitching, RGB-split rainbow name). ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _nm = document.getElementById('cv-name');
    if (_isDiva(c)) {
      _cvRoot.classList.add('diva-ui');
      if (_nm) { _nm.classList.add('diva-name'); _nm.setAttribute('data-text', _nm.textContent || 'DIVA'); }
    } else {
      _cvRoot.classList.remove('diva-ui');
      if (_nm) { _nm.classList.remove('diva-name'); if (!_nm.classList.contains('juko-name') && !_nm.classList.contains('lucifer-name') && !_nm.classList.contains('shi-name') && !_nm.classList.contains('lunar-name') && !_nm.classList.contains('helios-name') && !_nm.classList.contains('zoe-name') && !_nm.classList.contains('iris-name') && !_nm.classList.contains('mb-name') && !_nm.classList.contains('divine-name')) _nm.removeAttribute('data-text'); }
    }
  }

  // ── Evelynn — elegant blood-moon UI chrome (deep crimson panels + a softly
  // glowing crimson name). ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _nm = document.getElementById('cv-name');
    if (_isEvelynn(c)) { _cvRoot.classList.add('evelynn-ui'); if (_nm) _nm.classList.add('evelynn-name'); }
    else { _cvRoot.classList.remove('evelynn-ui'); if (_nm) _nm.classList.remove('evelynn-name'); }
  }

  // ── Oliver — wild-west UI chrome (aged dark-wood panels + a gold, lantern-lit
  // sheriff name). ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _nm = document.getElementById('cv-name');
    if (_isOliver(c)) { _cvRoot.classList.add('oliver-ui'); if (_nm) _nm.classList.add('oliver-name'); }
    else { _cvRoot.classList.remove('oliver-ui'); if (_nm) _nm.classList.remove('oliver-name'); }
  }

  // ── Spruce — lavish white-rose UI chrome (ivory panels + glowing white name). ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _nm = document.getElementById('cv-name');
    if (_isSpruce(c)) { _cvRoot.classList.add('spruce-ui'); if (_nm) _nm.classList.add('spruce-name'); }
    else { _cvRoot.classList.remove('spruce-ui'); if (_nm) _nm.classList.remove('spruce-name'); }
  }

  // ── Momo — foggy grey-wasteland UI chrome (ashen panels + a pale, crimson-lit name). ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _nm = document.getElementById('cv-name');
    if (_isMomo(c)) { _cvRoot.classList.add('momo-ui'); if (_nm) _nm.classList.add('momo-name'); }
    else { _cvRoot.classList.remove('momo-ui'); if (_nm) _nm.classList.remove('momo-name'); }
  }

  // ── Ronnette — scorched-orange industrial UI chrome (charred panels + a
  // flickering ember name). ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _nm = document.getElementById('cv-name');
    if (_isRonnette(c)) { _cvRoot.classList.add('ronnette-ui'); if (_nm) _nm.classList.add('ronnette-name'); }
    else { _cvRoot.classList.remove('ronnette-ui'); if (_nm) _nm.classList.remove('ronnette-name'); }
  }

  // ── Miami — glossy Frutiger-Aero UI chrome (aqua glass panels + a chrome-blue name). ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _nm = document.getElementById('cv-name');
    if (_isMiami(c)) { _cvRoot.classList.add('miami-ui'); if (_nm) _nm.classList.add('miami-name'); }
    else { _cvRoot.classList.remove('miami-ui'); if (_nm) _nm.classList.remove('miami-name'); }
  }

  // ── Joni — leafy jungle UI chrome (green foliage panels + a leafy name). ──
  {
    const _cvRoot = document.getElementById('char-view');
    const _nm = document.getElementById('cv-name');
    if (_isJoni(c)) { _cvRoot.classList.add('joni-ui'); if (_nm) _nm.classList.add('joni-name'); }
    else { _cvRoot.classList.remove('joni-ui'); if (_nm) _nm.classList.remove('joni-name'); }
  }
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
  const ptype = _isBizzy(c) ? 'bizzy_bees' : _isBlackjack(c) ? 'blackjack_neon' : _isKatie(c) ? 'katie_pond' : _isSnaps(c) ? 'snaps_scales' : _isLeon(c) ? 'leon_swords' : _isValkyrie(c) ? 'valkyrie_rain' : _isAdam(c) ? 'adam_ice' : _isFury(c) ? 'fury_fire' : _isSorrow(c) ? 'sorrow_fire' : _isJuko(c) ? 'juko_code' : _isLuciferUnleashed(c) ? 'lucifer_unleashed' : _isDivine(c) ? 'divine_light' : _isJimmy(c) ? 'jimmy_muffin' : _isAether(c) ? 'aether_forest' : _isCappy(c) ? 'cappy_milk' : _isDiva(c) ? 'diva_virus' : _isEvelynn(c) ? 'evelynn_moon' : _isOliver(c) ? 'oliver_west' : _isSpruce(c) ? 'spruce_roses' : _isMomo(c) ? 'momo_waste' : _isRonnette(c) ? 'ronnette_scrap' : _isMiami(c) ? 'miami_aero' : _isJoni(c) ? 'joni_jungle' : _isShi(c) ? 'shi_souls' : _isLunar(c) ? 'lunar_moon' : _isHelios(c) ? 'helios_sun' : _isZoe(c) ? 'zoe_garden' : _isIris(c) ? 'iris_starlight' : _isMb(c) ? 'mouseburger_dusk' : (c.pattern?.type || 'none');
  const pdef = PATTERN_DEFS[ptype];
  const _stPanel = document.querySelector('#tab-style .panel');
  const _stPanelTitle = document.querySelector('#tab-style .panel-title');
  if (_isNara(c)) {
    // Nara has no "pattern" panel — the Style tab is just her blank paint canvas.
    if (_stPanel) _stPanel.style.display = 'none';
    styleEl.innerHTML = '';
  } else {
  if (_stPanel) _stPanel.style.display = '';
  if (_stPanelTitle) _stPanelTitle.textContent = 'BACKGROUND PATTERN';
  styleEl.innerHTML = `<div style="font-size:9px;letter-spacing:2px;margin-bottom:14px;line-height:1.8;">PATTERN: <span class="text-yellow">${pdef?.label || 'None'}</span></div>`;
  if (ptype !== 'none' && ptype !== 'bizzy_bees' && ptype !== 'blackjack_neon' && ptype !== 'katie_pond' && ptype !== 'snaps_scales' && ptype !== 'leon_swords' && ptype !== 'valkyrie_rain' && ptype !== 'adam_ice' && ptype !== 'fury_fire' && ptype !== 'sorrow_fire' && ptype !== 'juko_code' && ptype !== 'lucifer_unleashed' && ptype !== 'divine_light' && ptype !== 'jimmy_muffin' && ptype !== 'aether_forest' && ptype !== 'cappy_milk' && ptype !== 'diva_virus' && ptype !== 'evelynn_moon' && ptype !== 'oliver_west' && ptype !== 'spruce_roses' && ptype !== 'momo_waste' && ptype !== 'ronnette_scrap' && ptype !== 'miami_aero' && ptype !== 'joni_jungle' && ptype !== 'shi_souls' && ptype !== 'lunar_moon' && ptype !== 'helios_sun' && ptype !== 'zoe_garden' && ptype !== 'iris_starlight' && ptype !== 'mouseburger_dusk' && pdef) {
    const pp = c.pattern?.params || {};
    pdef.params.forEach(p => {
      const v = pp[p.id] !== undefined ? pp[p.id] : p.default;
      styleEl.innerHTML += `<div style="font-size:8px;letter-spacing:1px;margin-bottom:6px;color:#666;">${p.label}: <span style="color:#ccc;">${v}</span></div>`;
    });
  }
  }
  // Iris-only "shimmy counter" — tally of falling stars popped with the cursor
  if (_isIris(c)) {
    styleEl.innerHTML +=
      `<div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,210,90,0.25);font-size:9px;letter-spacing:2px;line-height:1.8;color:#ffe08a;">` +
        `&#10022; SHIMMY COUNTER: <span id="iris-shimmy-count" style="color:#fff4cf;font-weight:bold;text-shadow:0 0 10px rgba(255,220,110,0.85);">${_irisShimmyCount}</span>` +
      `</div>` +
      `<div style="font-size:7.5px;letter-spacing:1px;color:#8a7340;margin-top:5px;">stars shattered with your cursor &#10038;</div>`;
  }
  // Mouseburger-only "burgers sliced" counter
  if (_isMb(c)) {
    styleEl.innerHTML +=
      `<div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(224,120,60,0.25);font-size:9px;letter-spacing:2px;line-height:1.8;color:#f0c089;">` +
        `&#9876; BURGERS SLICED: <span id="mb-slice-count" style="color:#ffe2bc;font-weight:bold;text-shadow:0 0 10px rgba(255,150,80,0.85);">${_mbSliceCount}</span>` +
      `</div>` +
      `<div style="font-size:7.5px;letter-spacing:1px;color:#8a6038;margin-top:5px;">cut clean in half with a fast swing &#9876;</div>`;
  }
  stopBgAnim();
  if (ptype !== 'none' && !_isNara(c)) startBgAnim(ptype, c.pattern?.params || {});  // Nara keeps the canvas blank to paint on
  if (_isNara(c)) _startNaraPaint(); else _stopNaraPaint();
  if (!_perfMode) {   // performance mode skips all cursor-companion overlays
  if (_isKatie(c))    _startKatieOverlay();    // start AFTER stopBgAnim so it isn't killed
  if (_isLeon(c))     _startLeonOverlay();
  if (_isValkyrie(c)) _startValkyrieOverlay();
  if (_isAdam(c))     _startAdamOverlay();
  if (_isFury(c))     _startFuryOverlay();
  if (_isSorrow(c))   _startSorrowOverlay();
  if (_isJuko(c))     _startJukoOverlay();
  if (_isLuciferUnleashed(c)) _startLuciferOverlay();
  if (_isDivine(c)) _startDivineOverlay();
  if (_isAether(c))   _startAetherOverlay();
  if (_isCappy(c))    _startCappyOverlay();
  if (_isDiva(c))     _startDivaOverlay();
  if (_isEvelynn(c))  _startEvelynnOverlay();
  if (_isOliver(c))   _startOliverOverlay();
  if (_isSpruce(c))   _startSpruceOverlay();
  if (_isMomo(c))     _startMomoOverlay();
  if (_isRonnette(c)) _startRonnetteOverlay();
  if (_isMiami(c))    _startMiamiOverlay();
  if (_isJoni(c))     _startJoniOverlay();
  if (_isShi(c))      _startShiOverlay();
  if (_isLunar(c))    _startLunarOverlay();
  if (_isHelios(c))   _startHeliosOverlay();
  if (_isZoe(c))      _startZoeOverlay();
  if (_isIris(c))     _startIrisOverlay();
  if (_isMb(c))       _startMbOverlay();
  }

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

//const RARITY_WEIGHTS = { common: 0, rare: 0, epic: 0, legendary: 11, mythic: 5, hexxed: 5, duality: 2, determined: 0 };

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
    const _rePtype = _isBizzy(c) ? 'bizzy_bees' : _isBlackjack(c) ? 'blackjack_neon' : _isKatie(c) ? 'katie_pond' : _isSnaps(c) ? 'snaps_scales' : _isLeon(c) ? 'leon_swords' : _isValkyrie(c) ? 'valkyrie_rain' : _isAdam(c) ? 'adam_ice' : _isFury(c) ? 'fury_fire' : _isSorrow(c) ? 'sorrow_fire' : _isJuko(c) ? 'juko_code' : _isLuciferUnleashed(c) ? 'lucifer_unleashed' : _isDivine(c) ? 'divine_light' : _isJimmy(c) ? 'jimmy_muffin' : _isAether(c) ? 'aether_forest' : _isCappy(c) ? 'cappy_milk' : _isDiva(c) ? 'diva_virus' : _isEvelynn(c) ? 'evelynn_moon' : _isOliver(c) ? 'oliver_west' : _isSpruce(c) ? 'spruce_roses' : _isMomo(c) ? 'momo_waste' : _isRonnette(c) ? 'ronnette_scrap' : _isMiami(c) ? 'miami_aero' : _isJoni(c) ? 'joni_jungle' : _isShi(c) ? 'shi_souls' : _isLunar(c) ? 'lunar_moon' : _isHelios(c) ? 'helios_sun' : _isZoe(c) ? 'zoe_garden' : _isIris(c) ? 'iris_starlight' : _isMb(c) ? 'mouseburger_dusk' : c?.pattern?.type;
    if (_rePtype && _rePtype !== 'none') {
      stopBgAnim(); // also kills Katie/Leon overlays
      startBgAnim(_rePtype, c?.pattern?.params || {});
      // Restart overlays that stopBgAnim just destroyed
      if (_isKatie(c))    _startKatieOverlay();
      if (_isLeon(c))     _startLeonOverlay();
      if (_isValkyrie(c)) _startValkyrieOverlay();
      if (_isAdam(c))     _startAdamOverlay();
      if (_isFury(c))     _startFuryOverlay();
      if (_isSorrow(c))   _startSorrowOverlay();
      if (_isJuko(c))     _startJukoOverlay();
      if (_isLuciferUnleashed(c)) _startLuciferOverlay();
  if (_isDivine(c)) _startDivineOverlay();
      if (_isAether(c))   _startAetherOverlay();
      if (_isCappy(c))    _startCappyOverlay();
      if (_isDiva(c))     _startDivaOverlay();
      if (_isEvelynn(c))  _startEvelynnOverlay();
      if (_isOliver(c))   _startOliverOverlay();
      if (_isSpruce(c))   _startSpruceOverlay();
      if (_isMomo(c))     _startMomoOverlay();
      if (_isRonnette(c)) _startRonnetteOverlay();
      if (_isMiami(c))    _startMiamiOverlay();
      if (_isJoni(c))     _startJoniOverlay();
      if (_isShi(c))      _startShiOverlay();
      if (_isLunar(c))    _startLunarOverlay();
      if (_isHelios(c))   _startHeliosOverlay();
      if (_isZoe(c))      _startZoeOverlay();
      if (_isIris(c))     _startIrisOverlay();
      if (_isMb(c))       _startMbOverlay();
    }
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

      // 3. Upload the original file (Cloudinary primary, ImageKit fallback)
      const spriteUrl = await _uploadMedia(file, 'image', null);

      entry.spriteBase64 = null;
      entry.spriteUrl = spriteUrl;
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

// Encyclopedia mobile drawer
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