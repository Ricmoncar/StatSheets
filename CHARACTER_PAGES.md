# Character pages: how to build one, and what to expect

Working notes for whoever builds the next one. Everything here is something
that went wrong at least once, so none of it is theory.

A character page is two canvases and about four hundred lines in `script.js`.

| layer | element | z | coordinate space | what belongs on it |
|---|---|---|---|---|
| background | `#pattern-canvas` | 0 | **its own**, laid out inside the page | the world |
| overlay | `<name>-overlay` | 9999 | the **viewport** | cursor, weather, anything in front of the GUI |

Both are `pointer-events:none`. Both run their own `requestAnimationFrame`
loop. They talk to each other through a couple of module-level variables.

---

## 1. Wiring: the ten hook points

A new page is not live until all ten are done. Missing one fails quietly, which
is why they are listed rather than remembered.

1. The module, inserted before an existing banner comment.
2. Registry entry: `name_type: { label: "Name · Thing", params: [] }`.
3. `drawPattern` dispatch: `if (type === 'name_type') { _drawXPattern(...); return; }`.
4. **Both** `ptype` ternary ladders (there are exactly two; assert the count).
5. The `ptype !== '...'` guard chain.
6. The central `_stopXOverlay()` teardown list.
7. **Both** overlay start sites.
8. The `._lt = undefined` reset list (pattern *and* overlay).
9. The `--char-color` else-if ladder.
10. The CSS chrome toggle block, plus a `.name-ui` / `.name-name` / `.name-pfp`
    block appended to `style.css`.

Then bump the cache busters in `index.html` (`script.js?v=N`, `style.css?v=N`)
or nothing you did will ship.

**Alt forms** (`Leon · human`, `Adam · human`) must be tested *before* the base
form everywhere: in both ptype ladders, in the `--char-color` ladder, in the
start sites, and in the base form's chrome guard (`_isX(c) && !_isXHuman(c)`).
Otherwise the base form wins and the new page never appears.

---

## 2. What makes a background good

### Have one idea, and derive everything from it

Every page that works has a single physical claim at the top of it, and every
drawing decision is downstream of that claim:

- **Sevach**: blood is nearly opaque, so it is black where it is deep and only
  shows colour in a thin film catching light.
- **Adam**: the light hangs *above* the world and distance goes pale, so every
  edge takes light on top and the far towers dissolve into the sky.
- **Plumky**: one carved moon is the only light for miles.
- **Libra**: order is near and entropy is far.

Write the claim in the module's header comment. When a later decision looks
arbitrary, the claim is what settles it.

### Composition first. Polish will not save a page that has none

The single most expensive mistake made so far: Adam's ice kingdom was rebuilt
three times because it was *spires scattered evenly over an empty floor*. That
is a texture, not a place, and adding gradients, fractures and drifts to it did
not help at all. What fixed it was a **road running back to the citadel gate**.

A composition needs:

- **A line through it.** A road, a swell running to a horizon, ranks of blades,
  rows of a crop, a converging floor. It gives the page a vanishing point and
  tells the eye where to enter.
- **A landmark that is not the repeating element.** The ship, the citadel, the
  broken scales, the gate, the crescent. Give it a hole or a light in it, so it
  reads at a glance and carries scale.
- **Something else to balance against the landmark**, or half the page is dead.
  Adam got a ruined outer wall on the right for exactly this reason.
- **A near plane.** If the bottom of the page has nothing close in it, add a
  ledge, a shelf, a foreground band. Otherwise there is only mid and far and the
  page reads flat.

### Depth is a value ramp, and you must pick a direction

Decide once whether distance goes **pale** or **dark**, and never contradict it.

- Cold or dirty air: distance goes **pale and low contrast** (Rady's smog,
  Adam's ice, Sevach's haze). The far things are the *brightest* on the page.
- Clear night: distance goes **dark**.

Then: **put air between the layers.** A soft horizontal haze band drawn between
each depth band is the cheapest large win available. Five ridges without it read
as one ridge; with it they read as five. Fade it at *both* ends or the top edge
is a visible rule across the page.

### One light source, named, obeyed

Say where the light is in a comment and let every facet, rim and shadow follow
it. The moment two things disagree, the page reads as a collage. Where an object
has two faces, one is lit and one is not, and the seam between them is dark.

### Things must touch the ground

Anything standing on a surface needs a **contact shadow** and usually a drift,
kerb or base at its foot. Without it, it is a sticker on a photograph. This is
what took Adam's spires from "cut paper" to "standing in snow".

### Flat fills read as cut paper

A solid shape wants:
- a gradient across it (lit at the top, falling away),
- **one** lit edge, not an outline all round (outlining everything gives a
  wireframe, and it looked worst on the *nearest* objects, which should be the
  most in shadow),
- internal structure: fractures, ribs, seams, plates, fullers.

Subsurface trick that pays every time: on a translucent material, let the
shadowed face **lift again at its foot**, where light bounces back up off the
ground. That single stop is what makes ice read as ice and not as rock.

### Irregularity has to be structured

Random scatter reads as confetti. What reads as nature is a *uniform rule with
per-item variation*: same construction, own phase, own hash, own size. A row of
identically-sized things at identical spacing is corrugated iron; a long slow
undulation laid under everything else is a sea.

Most of them should be small and a few enormous (`pow(rnd, 2.2)`), not an even
spread.

### Repetition is the enemy of "corrupted"

Five identical windows titled `juko.exe`, all holding the same picture, teleporting
to a random point three times a second, read as one asset repeated: the eye
groups them instantly and stops looking. Things that are meant to feel broken
need to differ from each other (five kinds of window, own titles, own contents),
they need to arrive and leave rather than blink (open and close animations, a
lifetime), and they must not teleport, because a thing with no persistence has no
weight. If you want the "it re-synced" beat, tear the *contents* sideways for a
frame and leave the window where it is.

And keep them out of the middle. The character's portrait, name and stats are
what the page is for; put the chaos in the gutters and along the bottom and it
crowds the page without hiding it.

### Respect the furniture

The GUI panels sit across the upper and middle of the page. Keep the middle
quiet and put the good material where it will actually be seen: the band below
the panels, and the edges. Check every page against panel rectangles before
calling it done. Landmarks want to be clear of the panels *and* clear of any
banner or band crossing the sky.

---

## 3. Techniques that carry their weight

**Bake anything that does not change.** Sky, ridges, floors, sprites. Blit them.

**Tileable strip + wrapping offset = infinite scroll.** The workhorse: bake one
strip, draw it twice at `-off` and `width - off`, advance `off`. Used for the
sea, Leon's ranks, Plumky's bunting. The strip must close on itself: give every
harmonic a **whole number of cycles across the width** rather than a wavelength,
and the seam never shows.

**Stamp persistent user-made things** to their own canvas and keep the list, so
they can be re-stamped after a resize clears it.

**Cross-layer variables** let the background answer the cursor: the overlay
writes `_xxTip` / `_xxWave`, the background reads them. See the coordinate trap
below before using them.

**The masked-scratch glow** (a soft local light with no hard clip edge):

```
scratch.clear()
scratch.translate(R - tipX, R - tipY); draw the sprite; restore
scratch.globalCompositeOperation = 'source-atop'; fill with the light colour
scratch.globalCompositeOperation = 'destination-in'; fill with a radial gradient
main.globalCompositeOperation = 'lighter'; drawImage(scratch, tipX - R, tipY - R)
```

Clipping to a disc and re-blitting instead gives a visible hard circle.

**Smooth gradients need stops.** Four stops blown up three times shows every
join as a contour ring. Use 12 to 16 stops on a power curve:
`a * pow(1 - u, p)`. Any edge where a gradient is still visibly non-zero will
read as a hard line.

**Sort by y and draw back to front.** Row order is *not* depth order once items
are jittered off their row line. This is what makes things look like they are
floating.

---

## 4. Performance

Budget at 1920x1080: **background under 2 ms, overlay under 1 ms**, bake under
about 100 ms once on entry. Every shipped page is inside that.

**Measure with a forced flush** or you measure nothing:

```js
const flush = (c) => c.getImageData(0, 0, 1, 1);
fn(); flush(ctx);
const t0 = performance.now();
for (let i = 0; i < n; i++) fn(i);
flush(ctx);                       // without this the GPU queue is still full
const ms = (performance.now() - t0) / n;
```

Watch the throttle when benchmarking: the draw functions early-return if
`t - _lt < 0.033` (background) or `< 0.016` (overlay). Floating point makes an
exactly-equal step fall on the wrong side, so use a comfortably larger step and
assert that the frames actually drew.

What is expensive, in order. These are measured on the live page, not guessed.

1. **`ctx.filter`.** Setting a filter on a viewport-sized context measured
   **650 ms a frame** on Juko's overlay, which drew two hue-rotated copies of
   the cursor sprite. It forces the whole layer onto a software path. Never set
   `ctx.filter` on a large canvas in a loop. To tint a sprite: draw it to a
   scratch canvas its own size, `source-atop` a semi-transparent fill over it
   (semi-transparent so the sprite keeps its shading), blit that. Same picture,
   about a fiftieth of a millisecond.
2. **Wide antialiased polyline strokes across the full width.** Sevach's sea was
   41 ms a frame from this alone: twenty polylines taking eight stroked passes
   each. Baked into scrolling strips it is **0.58 ms**.
3. **`shadowBlur` on a large stroke.** A glowing `strokeRect` around the
   viewport: 4.1 ms with shadowBlur, 0.14 ms without. Four widening strokes at
   falling alpha give the same soft edge for 0.7 ms.
4. **Large gradient fills, even from a cached gradient object.** Caching the
   gradient does not help; the fill is the cost. At 1030x656 a full-screen
   radial fill is 2.0 ms and the same pixels blitted from a baked canvas are
   0.11 ms. **Bake every gradient that only moves or changes brightness**, and
   put the brightness back with `globalAlpha`.
5. **A `CanvasPattern` fill over the full screen**: 4.3 ms, against 0.4 ms for
   a pre-filled sheet of the same size blitted at a random offset. Applies to
   every noise/static layer.
6. **`fillText` with a freshly built `rgba(...)` string.** The string is
   re-parsed every call. 2100 glyphs: **10.9 ms** with fresh strings, **3.7 ms**
   reading from an interned table, 2.0 ms with one fixed style. Quantize the
   alpha into ramps built once at module level (see `_jkRamp`).
7. Full-screen self-copies (`drawImage(canvas, ...)`). About 1 ms each at 720p.
   Budget a handful, not twenty.
8. **Many small canvases.** 149 per-column strips cost 6.2 ms a frame to rebake
   and blit; the same content in ONE atlas canvas, a slot per item, cost 3.7 ms.
   If you bake per item, bake into one atlas.

Cheap enough to ignore: `getBoundingClientRect` once a frame, a few hundred
small `arc` fills batched into one path, blits (a full-canvas blit is 0.11 ms).

**Baking only pays if the thing actually holds still.** Juko's rain columns were
baked per cell-crossing, which sounded right and bought 27%, because a column
falls up to 320 px/s through 15 px cells and so re-baked on 42% of frames
anyway. What made it work was changing the design so the trail is a *rigid*
ribbon that churns on its own slow clock instead of one the glyphs stream
through: same look, one re-bake per column every 0.4 s. Before you bake, work
out the re-bake rate; if it is close to the frame rate, you have added
complexity and a texture upload for nothing.

**Watch the total, not each page in isolation.** Juko runs four canvases (the
background, plus an equalizer, a code frame and a cursor layer at three
z-indexes) and two rAF loops. Every one of them is inside budget on its own.

---

## 5. Traps, each of which cost real time

**The two canvases do not share coordinates.** The overlay is pinned to the
viewport; `#pattern-canvas` is laid out inside the page and on the live site
reports at roughly `(250, 64)` with a backing store slightly wider than its CSS
box. A pointer position used raw in the background lands hundreds of pixels
away. Always go through the helpers:

```js
_bgRect(canvas);                                   // once a frame
const [x, y] = _bgAt(canvas, W, H, clientX, clientY);
```

Leon's page shipped with this bug for weeks because a soft warm pool over dark
iron does not announce where its centre is.

**`destination-out` erases by the *source alpha*.** Set an opaque `fillStyle`
before the punch or you get a partial erase. A crescent moon came out as a full
moon with a smudge because the fill style was still the last crater's, at 0.2.

**`else if` chains.** Inserting a start call between an `if` and its `else if`
rebinds the else to your new condition. It made Leon run his base and human
overlays simultaneously. Insert *after* the whole chain.

**A 6-space anchor contains the 2-space one.** `"  if (_isX(c))"` matches inside
`"      if (_isX(c))"`. Anchor on the preceding newline.

**Shadowed identifiers.** A sprite builder already has `const c` for its canvas;
do not name the palette `c` too.

**rAF never fires in the preview pane** (`document.hidden === true`), and
`innerWidth` collapses to 0 when the pane is hidden. Verify by driving the draw
functions manually against offscreen canvases at a chosen size, and screenshot
by POSTing `canvas.toDataURL()` to a small local endpoint.

**`getComputedStyle` returns stale values on pre-existing nodes in that pane.**
Insert a fresh probe node instead. This nearly sent me hunting a CSS conflict
that did not exist.

**No em, en or minus dashes** anywhere in `script.js`, `style.css` or
`index.html`. Assert it before every commit.

**Section-number comments collide across characters.** Renumber inside the one
function's own text, never by searching the whole file.

**Sprites baked while the layout was collapsed stay wrong** until the
`canvas._xW !== W` guard fires. Reset every cached sprite there, and reset
`stamped` flags on persistent items so they redraw.

**A canvas of width 0 cannot be drawn.** `innerWidth` is 0 in a hidden pane, so
an overlay canvas can be sized 0x0. Gradient objects do not mind; a *baked*
gradient is a canvas, and `drawImage` of a zero-width canvas throws
`InvalidStateError` and takes the rAF loop down with it. Every draw function
wants `if (!(W > 0 && H > 0)) return;` at the top. This is a real trap the
moment you start baking things that used to be gradient objects.

**`characters` is replaced wholesale by every Firestore snapshot.** Anything
holding a character reference keyed only by id goes stale and keeps answering
with the state that object had before the swap. It bit `_jukoCurChar()`: a form
switch writes, the snapshot lands a second later, and from then on the
background believed Juko was in whatever form she had been in before, for as
long as you stayed on her page. Cache the index alongside the reference and
re-find when `characters[i] !== cached`.

**A form's timed intro cannot trust the audio clock on re-entry.** Reading
`_themeAudio.currentTime` to sync a build-up is right, but on re-entry the
PREVIOUS play is still loaded and running through the crossfade, so the clock
reads minutes in and the build-up is skipped entirely. Anchor it: only adopt the
song clock once it agrees with the wall clock this entry started
(`Math.abs(audio - wall) < 2.5`), and fall back to wall time otherwise.

**Count how many elements a CSS animation actually lands on.** 0-infinity put an
infinite `transform` shake on `.stat-row`, `.trait-card`, `.inv-card` and
`.char-entry`: the last of those is one element per character in the sidebar, so
a hundred elements animated a non-composited property forever. It also made the
text unreadable, which was the complaint that led to finding it. Colour strobes
are cheap; position shakes are not, and a page does not need more than one or
two things moving at a time.

**`mix-blend-mode` on a full-viewport fixed layer** forces the whole page
through a blend group whenever it changes, and animating `top` on one relayouts
it every frame. If the overlay canvas already draws the effect, delete the CSS
copy; if not, animate `transform`.

**Never transform `<html>` or shake the whole viewport.** Rotating and scaling
the root promotes the entire document, every fixed canvas included, into one
layer that is re-rasterised for each frame of the animation. It is also the most
physically unpleasant thing you can do to a reader: tipping the horizon of every
straight line at once is what makes a page nauseating rather than exciting. A
short *translation-only* kick on `#app`, fired on a beat and with a real gap
after it, reads as more violent and costs nothing.

**Give the most motion-heavy pages a `prefers-reduced-motion` escape**, in the
CSS *and* in the JS that drives the motion.

---

## 6. Before shipping, every time

- `new Function(src)` on the fetched `script.js` parses.
- The right class, `--char-color` and `data-text` on entry.
- **Exactly one overlay** across five or six character transitions, including
  base-to-alt-form both ways.
- A plain character returns the canvas count to baseline (3) and restores the
  arrow cursor.
- Zero console errors.
- Both narrow (360 wide) and wide (1920) render sensibly; anything sized off
  `min(W, H)` needs checking on a tall thin window.
- Timings recorded, dashes asserted, cache busters bumped.
