# python3 port_ivy_evil.py   (from rebuild/tools; writes web/src/app/pages/ivy-evil/ivy-evil.ts)
#
# Ports the IVY · EVIL CREATURE section of the old script.js into the new app,
# the drawing code unchanged. Every substitution states how many times its
# anchor must occur and stops if that is not so, so nothing else in the
# section is touched by accident. Each one is marked [port] in the output.
import os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
old = open(os.path.join(ROOT, 'script.js'), encoding='utf-8').read()
# the section: from its banner to the closing rule after its last function
BANNER = '// ' + '═' * 64 + '\n// IVY · EVIL CREATURE\n'
start = old.index(BANNER)
end = old.index('\n', old.index('/* ─────', old.index('function _stopIvyEvilOverlay()'))) + 1
src = old[start:end]
out_path = os.path.join(ROOT, 'web', 'src', 'app', 'pages', 'ivy-evil', 'ivy-evil.ts')

def sub(old, new, count=1):
    global src
    n = src.count(old)
    assert n == count, f'expected {count} of {old[:70]!r}, found {n}'
    src = src.replace(old, new)

# 1. the old page canvas is the new app's world canvas
sub("document.getElementById('pattern-canvas')", "_worldCanvas()", 2)
# 2. the old DOM cursor: the host hides the system cursor instead
sub("  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = 'none';\n", "")
sub("  const _arrow = document.getElementById('cursor'); if (_arrow) _arrow.style.display = '';\n", "")
# 3. what gets torn and swayed: the new app's elements, through the host
sub("const _IV_CUT_EL = ['char-view', 'sidebar', 'header', 'theme-bar'];\n", "")
sub("""  const out = [];
  for (const id of _IV_CUT_EL) { const el = document.getElementById(id); if (el) out.push([el, 1]); }
  for (const el of document.querySelectorAll('#char-view .panel, #cv-avatar, #cv-name, #char-view .tabs')) out.push([el, 1.55]);
  return out;
}""", """  // [port] the sheet, the list, the header and the music bar, then the panels,
  // portrait, name and tabs inside the sheet: see pages/host.ts
  return _interfaceTargets(1.55);
}""")
sub("""  return !!(el && el.closest && el.closest(
    'button, .btn, a, input, select, textarea, label, summary, option,' +
    '[onclick], [role="button"], .tab-btn, .char-entry, .panel-title,' +
    '.stat-row, .inv-card, .trait-card, .chip, .folder-row'));""", """  return _isInteractive(el);   // [port] the new app's controls: see pages/host.ts""")
# 4. the sway goes on `translate`, not `transform`: the music bar slides and the
#    phone drawer opens on their own transforms, and the two properties compose
sub("""      el.style.transform = (Math.abs(tx) + Math.abs(ty) < 0.05) ? ''
        : 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px)';""", """      // [port] on `translate`, which composes with the elements' own transforms
      // (the music bar and the phone drawer slide on theirs)
      el.style.translate = (Math.abs(tx) + Math.abs(ty) < 0.05) ? ''
        : tx.toFixed(2) + 'px ' + ty.toFixed(2) + 'px';""")
sub("""    el.style.transform = '';
    el._ivFx = null;""", """    el.style.translate = '';
    el._ivFx = null;""")
# 5. touch screens: no pointer for the blade to sit on
sub("function _ivMouseMove(e) { _ivMX = e.clientX; _ivMY = e.clientY; }", """// [port] On a touch screen there is no pointer for the rapier to sit on: a tap
// still cuts, but the blade, its trail and its light are drawn for a mouse
// only. A tap sends a mousemove of its own just before its mousedown, so a
// mousemove only counts as a mouse once no touch has happened for a second.
let _ivTouch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
let _ivTouchAt = -1e9;
function _ivTouchStart() { _ivTouch = true; _ivTouchAt = performance.now(); }
function _ivMouseMove(e) {
  _ivMX = e.clientX; _ivMY = e.clientY;
  if (_ivTouch && performance.now() - _ivTouchAt > 1000) _ivTouch = false;
}""")
sub("""  // ── the light the rapier is carrying, thrown onto the chrome ──
  {""", """  // ── the light the rapier is carrying, thrown onto the chrome ──
  if (!_ivTouch) {   // [port] no blade on a touch screen""")
sub("  if (spd > 500 && _ivGhosts.length < 7) {", "  if (!_ivTouch && spd > 500 && _ivGhosts.length < 7) {")
sub("  if (_ivDrips.length < 6 && _ivRnd(((t * 2) | 0) * 5.3) > 0.90) {", "  if (!_ivTouch && _ivDrips.length < 6 && _ivRnd(((t * 2) | 0) * 5.3) > 0.90) {")
sub("  const CPX = 1.6;\n", "  if (_ivTouch) return;   // [port] no blade without a pointer\n  const CPX = 1.6;\n")
sub("""  window.addEventListener('blur', _ivMouseUp);
  const cv = document.createElement('canvas');""", """  window.addEventListener('blur', _ivMouseUp);
  window.addEventListener('touchstart', _ivTouchStart, { passive: true, capture: true });
  const cv = document.createElement('canvas');""")
sub("""  window.removeEventListener('blur', _ivMouseUp);
  const cv = document.getElementById('ivyevil-overlay'); if (cv) cv.remove();""", """  window.removeEventListener('blur', _ivMouseUp);
  window.removeEventListener('touchstart', _ivTouchStart, { capture: true });
  const cv = document.getElementById('ivyevil-overlay'); if (cv) cv.remove();""")
# 6. phones and touch screens draw the overlay at 30 frames a second, not 70
sub("""  const t0 = performance.now();
  function frame(now) {
    const cv2 = document.getElementById('ivyevil-overlay');
    if (!cv2) return;""", """  const t0 = performance.now();
  // [port] phones and touch screens: 30 frames a second is plenty for this layer
  const small = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  let last = -1e9;
  function frame(now) {
    const cv2 = document.getElementById('ivyevil-overlay');
    if (!cv2) return;
    if (small && now - last < 30) { _ivOverlayRaf = requestAnimationFrame(frame); return; }
    last = now;""")

head = """// @ts-nocheck
// IVY · EVIL CREATURE, ported from the old site's script.js (the IVY · EVIL
// CREATURE section), the drawing code unchanged. Every change is marked
// [port]; the rest is the original, so the two can be compared line for line.
// What it reached for outside itself (the active form, the layout cache, the
// page canvas, the interface it tears) comes from ../host.
import {
  activeFormName as _activeFormName, lyRect as _lyRect, lyGen as _lyGen,
  worldCanvas as _worldCanvas, interfaceTargets as _interfaceTargets, isInteractive as _isInteractive,
} from '../host';

"""
tail = """

// [port] what the page host calls
export function drawBackground(canvas, ctx, W, H, t) { _drawIvyEvilPattern(canvas, ctx, W, H, t); }
/** A fresh clock: the frame cap remembers the last one. */
export function resetBackground() { _drawIvyEvilPattern._lt = undefined; }
export { _startIvyEvilOverlay as startOverlay, _stopIvyEvilOverlay as stopOverlay };
"""
open(out_path, 'w', encoding='utf-8').write(head + src.rstrip() + tail)
print('ok', len(src.splitlines()), 'lines')
