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

### A page is a PLACE, not a picture of the character

The most expensive mistake of the second round, and it is worth putting above
everything else because it looks like success right up until someone says it.
Juko's "1" was built as a figure: the character, whole, centred, standing in a
space, rendered in loving detail. It was well drawn and it was wrong, because
none of the pages that work has anyone standing in it. The sea, the ice
kingdom, the pumpkin patch, the entropy floor, the code garden: they are all
somewhere you are, not something you are looking at.

If the character has to be present, make them the ARCHITECTURE. The thing
overhead is now a wing that runs off two edges of the frame; you never see the
whole of it and you know it by what it blocks out. Same character, same
reference art, and the page stopped being a portrait.

### A page that only drifts is a wallpaper

The same build failed a second test: almost every pixel of it was baked, and
the only motion was a slow sideways drift. Baking is right for what does not
change, but if NOTHING changes then the technique has eaten the page. Ask what
in this place is happening, and make that the thing you draw.

It also wants more than one kind of motion, at different speeds, with at least
one of them being an EVENT rather than a loop. "1" ended up with the field
flying at the camera in real perspective, digits churning until they resolve,
cables streaming past, the sky rocking, debris tumbling, and a wave of
resolution thrown off the light on a real beat that turns everything it reaches
into a 1. The last of those is the one that makes it feel alive, because it is
the only one you can be surprised by.

Perspective is worth the trouble here. Three sheets at three speeds is a
parallax trick and reads as one; giving every mote a real z and projecting it
is barely more code and reads as a space you are inside.

### And a loop is not a page either: give it EVENTS

Even with six kinds of motion running, a page whose motion all loops has been
seen in full after about fifteen seconds. What fixes that is a small scheduler:
one event at a time, every six to eleven seconds, never the same one twice
running, each rolled once when it starts so it is the same event all the way
through.

The rule that makes it work: each event must be a different KIND of thing, not
a different colour of the same thing. "1" ended up with something crossing the
frame, the light going out and coming back, the previous form showing through
for two seconds, the collapse arriving as a straight front instead of a ring,
the field drawing itself a figure out of whatever motes happen to be there, the
sky beating once, and a giant 0 passing through UNDOING the collapse as it goes.
Seven of those cost about a millisecond between them and the page stops
repeating.

Two traps found building them. An event that picks a random point of the frame
and looks for content near it will usually find nothing, because a field is
dense in one place and thin everywhere else: anchor it to something that
already exists. And an event that can cancel itself must not do so by setting
its own duration to nearly zero, or it never appears and you will not be able to
tell whether it is broken or merely rare.

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

And be clear about what the ramp applies to: it is the **air**. Objects seen
through pale air are *lower contrast*, not brighter, so a far object is still
darker than the air behind it. AH!Flowey's far tangle was drawn paler than the
ground on the reasoning that distance goes pale, and forty vines came out as
pale scratches floating on a dark field, like marks on a lens. Painting them
mid-grey against a bright patch of air turned the same forty into a canopy. If
a far thing is the brightest thing on the page, that thing is the light or the
air; it is not a vine.

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

**And which face is the lit one is a calculation, not an assumption.** Juko's
knight lit the `-n` edge of every blade in its wing, which is correct for a
blade pointing one way and backwards for a blade pointing the other. In a fan
that spans a hundred degrees it is backwards for most of them, and the largest
object on the page ended up lit from the wrong side while every rule above it
was still being followed on paper. Pass the light's position in and take the
sign from `dot(normal, light - point)`.

### Drawing a figure: what actually reads

Four attempts at one wireframe figure, and each failure has a name:

- **A fan is not a wing.** Blades radiating from a single point across 130
  degrees is a starburst. A wing is blades pointing roughly the SAME way across
  maybe 60, rooted along a spread rather than at a point, longest at one end,
  with an arc along the leading edge.
- **Outlines pile up; filled shapes occlude.** A wireframe made of unfilled
  outlines reads as a wire mess however carefully it is drawn. Fill each plate
  near black and the same shapes read as overlapping armour.
- **An arc bows once; it does not curl.** A quadratic from a point to a point
  makes a bent stick. To get a tentacle, walk the path outward and TURN the
  heading a little at every step, with the turn rate rising along it.
- **Size the figure off the canvas you actually have.** `min(W, H)` looks
  reasonable and is wrong here: `#pattern-canvas` is the content area, about
  1.6:1, so a figure sized off the smaller dimension is lost on a tall window
  and cropped to nothing on a wide one. Take the span off the width and let the
  height be a ceiling on it.

Also: if a figure is meant to feel enormous, crop it deliberately, but crop the
TIPS. Cropping so hard that only the roots are on the page does not read as
"too big for the frame", it reads as a mistake.

### Draw the ground before the things standing on it

Obvious, and it still went wrong: the path was filled after the arch, so it
covered the arch's legs and the landmark read as a hoop floating in mid air.
Air, then far things, then the floor, then everything standing on the floor.

### Three shapes that did not read, and why

- **A ruin has ONE leg on the ground.** An arch with both feet down is a
  horseshoe however carefully it is broken. Stand one leg, snap the other side
  off in mid air, and it reads as a ruin instantly.
- **Do not light the inside of a hole.** A hole reads because the background
  shows through it, so leave it unpainted (`fill('evenodd')`) and put the
  brightness *behind* the whole object. Filling the opening with light instead
  turned the arch inside out: dark cap, bright slab, and it looked like a lit
  headstone.
- **An eye is a pale field with a dark hole in it.** A dark socket under a pale
  sclera under a black pupil is three concentric circles, and a face made of
  two of them reads as a pair of archery targets. Two shapes, not three.

### Scale is the thing that goes wrong twice

Flower heads on this page were sized off the width of the vine they sit on,
which is correct, with a multiplier that made them a hundred and thirty pixels
across. It was caught, fixed in the garden, and then shipped again a day later
in the window frame from the same formula copied over. When a size is derived
from another size, check it at the extremes of that other size before moving
on, and check every place the formula was copied to.

### A landmark must not be made of the same kind of shape as its surroundings

The broken arch on this page failed three times: too tall, then reading as a
horseshoe, then lit inside out. All three were fixable and none of them was the
real problem, which is that an arch is a CURVE in a page made entirely of
curves, so it sank into the tangle whatever value it was given. Replacing it
with a doorway (two uprights and a lintel, the only straight edges anywhere on
the page) made it read instantly at half the size and a third of the
brightness. If a landmark keeps needing to be made brighter to be seen, the
problem is its shape language, not its value.

### Things must touch the ground

Anything standing on a surface needs a **contact shadow** and usually a drift,
kerb or base at its foot. Without it, it is a sticker on a photograph. This is
what took Adam's spires from "cut paper" to "standing in snow".

### "Detached, unorganised and flat": the three things that cause it

AH!Flowey was built once, looked competent, and got exactly that verdict. All
three complaints had one cause each, and none of them was polish.

**Flat** was a flat fill plus a hairline. A silhouette with a one pixel lit edge
on it is a sticker however good the shape is. What fixes it is THREE TONES
ACROSS THE WIDTH of every solid thing: a dark body, a lit band down the side
facing the light, and a bright rim on that edge. For a curved object build the
band as one quad per segment rather than one long polygon, and it survives the
lit side swapping over when the object curls past the light.

And the lit band has to STOP AT THE CENTRELINE. Running it a third of the way
past the middle covered two thirds of every vine on the page and turned the
whole thing pale: they went from flat black sticks to flat olive sticks, which
is not an improvement. A lit side is a side.

**Detached** was that everything started in mid air. Vines came in from the
edges of the canvas and simply began. What fixes it is to draw the MASS FIRST
and root everything in it: a bank of tangled root heaped along both kerbs of
the path, a ceiling of it overhead, a band of thicket down each edge of the
window. Then every vine grows out of something and the page stops being a pile
of separate objects. This is the same lesson as "things must touch the ground",
one level up: a thing needs somewhere to come FROM, not just something to stand
on.

**Unorganised** was two layers drawn by two different pieces of code. The
background and the overlay ended up with their own vine code, their own values
and their own idea of the light, and they read as two pictures stapled
together. Write ONE renderer for the thing your page is made of, give it a
palette argument, and call it from both layers. The only difference between a
vine in the picture and a vine on the window frame should be which palette it
gets.

And the palette itself: one grey ramp reads flat no matter how carefully it is
drawn. Pick a COOL light and a WARM shadow (or the reverse) so that every
surface is telling you which way it faces by its hue as well as its value.
Adding that split to this page did more than any other single change.

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

### Test the landmark against the panels FIRST, not the composition

A composition can be right and still be invisible. AH!Flowey's broken arch was
built on the left with a road running to it, checked, liked, and then covered
almost entirely by the stats and traits panels, which between them own the left
two thirds of `#pattern-canvas`. What is actually visible on a character page is
an L: the **right gutter** and the **band along the bottom**. Put the landmark
in that L before drawing anything else. Moving the arch into the right gutter,
where it silhouettes against the shaft, cost ten lines and was the single
biggest improvement to the page.

If a shape was built to be lit from one side and the move puts it on the other
side of the light, do not re-derive it: draw it inside a mirroring transform
about its own centre, and its one lit edge lands on the correct side for free.

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

**A vine is a filled ribbon, not a stroked polyline.** Offset the centreline
by a tapering half-width, walk out and back, close it: one `fill` per vine,
with a real taper, and vines overlap like vines instead of crosshatching like
wire. Thorns go in as extra subpaths of the SAME path, so a whole vine and its
thorns are still one fill. Then one stroke down the lit side. Twelve swaying
vines plus a baked mass cost 0.42 ms at 1920x1080.

**Nested shapes make visible steps.** Five nested wedges for a light shaft gave
five vertical bands you could count. Fifty thin ones with alpha on a bell curve
give the same shape and no seams, and it is a bake, so the count is free.

**Space items along a path by index, not by rolling a position.** Two flowers
given random positions on one short vine land on top of each other and read as
a bunch of berries. `at = (k + rnd * 0.7) / n` spreads them and still looks
unplanned.

**The same object wants different numbers on the two layers.** A vine in the
picture is near black because it is in front of a lit room; the same vine on the
overlay is in front of a near black application, and at those values it is
invisible. The frame's bodies were lifted off black and its lit edges doubled.
Check every overlay element against `#000`, not against your background.

**A shape drawn on top of a mass at half alpha reads as a separate object.**
Lobes added under a ceiling to break up its silhouette were drawn over it at
0.55 and came out as a row of flying saucers parked underneath. Drawn FIRST, in
the mass's own fill, they are simply places where the ceiling hangs lower,
which is what they were for.

**On a pixel page, design at the LOW resolution.** The pixel pipeline draws
everything into a buffer a third to a fifth of the size, so an object sized the
way you would size it on a sharp canvas gets a fraction of the pixels you
imagined. Ivy's rapier was built at the size a normal cursor would be and came
out with a blade two low-resolution pixels wide, which is to say invisible.
Work out the pixel count you will actually get for each part before drawing it:
a blade wants five across, an ornament wants twenty, and if that makes the
object big, the object is big.

**Bake the metal, keep the fire.** A chandelier of eighteen scroll arms and a
curtain of drops, three passes each, redrawn every frame, was a third of that
page's cost, and none of it ever changed: only the flames move, and the swing
is a rotation. Baking the metal into a sheet and applying the swing to the blit
took the background from 1.76 ms to 1.26. Ask of every ornate thing which part
of it is actually animating.

**One `createRadialGradient` per light is one too many.** Sixteen sconces meant
sixteen gradient objects built and filled every frame. One white radial baked
into a 64x64 sprite, tinted once when the palette changes and blitted at
whatever size each light needs, is the same picture for nothing. The same
applies to any glow, bloom, pool or halo that differs only in size and colour.

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

**Measure on the LIVE page, not on an offscreen canvas.** The two disagreed by
a factor of eight on Juko's "1": the draw function billed 14.6 ms a frame in
the page while every canvas operation inside it added up to 0.44 ms. None of
the cost was drawing. An offscreen benchmark cannot see the things below,
because they are about the document the canvas is sitting in.

1. **Writing a CSS custom property.** The single most expensive thing found in
   this project, by a distance. Measured on Juko's page:

   | | cost |
   |---|---|
   | `getBoundingClientRect` on a clean layout | 0.000 ms |
   | the same read after toggling a class | 0.005 ms |
   | the same read after ONE `style.setProperty('--x', ...)` | **11.2 ms** |

   Custom properties inherit, so changing one re-resolves the style of every
   node beneath it, and a character card is ~750 nodes full of `calc()` and
   `color-mix()` reading that variable. Driving a music-reactive glow by
   writing one every frame costs a third of a second per second. Quantizing
   the value does not save you: with music playing a quantized value still
   changes on most frames.

   Make the write an EVENT: go immediately on a real jump (which is what a beat
   is, and the only part anyone watches) and otherwise no more than about four
   times a second. Thirty writes a second becomes two or three and it looks
   identical. Toggling a class is essentially free by comparison, so where you
   need more than a handful of states, prefer classes.

2. **Reading layout inside the frame.** `getBoundingClientRect`, `offsetWidth`,
   `getComputedStyle` and friends force the browser to finish style and layout
   on the spot. That is free when nothing has changed and costs a full recalc
   when something has, which on an animated page is every frame. Boxes only
   move when something moves them, so cache the reads against a generation that
   `resize`, `scroll` and a `ResizeObserver` bump, and never on a timer faster
   than a second. `_lyRect(el)` in the source does this and every page that
   reads the cursor position through `_bgRect` was paying for it.

3. **`ctx.filter`.** Setting a filter on a viewport-sized context measured
   **650 ms a frame** on Juko's overlay, which drew two hue-rotated copies of
   the cursor sprite. It forces the whole layer onto a software path. Never set
   `ctx.filter` on a large canvas in a loop. To tint a sprite: draw it to a
   scratch canvas its own size, `source-atop` a semi-transparent fill over it
   (semi-transparent so the sprite keeps its shading), blit that. Same picture,
   about a fiftieth of a millisecond.
4. **Wide antialiased polyline strokes across the full width.** Sevach's sea was
   41 ms a frame from this alone: twenty polylines taking eight stroked passes
   each. Baked into scrolling strips it is **0.58 ms**.
5. **`shadowBlur` on a large stroke.** A glowing `strokeRect` around the
   viewport: 4.1 ms with shadowBlur, 0.14 ms without. Four widening strokes at
   falling alpha give the same soft edge for 0.7 ms.
6. **Large gradient fills, even from a cached gradient object.** Caching the
   gradient does not help; the fill is the cost. At 1030x656 a full-screen
   radial fill is 2.0 ms and the same pixels blitted from a baked canvas are
   0.11 ms. **Bake every gradient that only moves or changes brightness**, and
   put the brightness back with `globalAlpha`.
7. **A `CanvasPattern` fill over the full screen**: 4.3 ms, against 0.4 ms for
   a pre-filled sheet of the same size blitted at a random offset. Applies to
   every noise/static layer.
8. **`fillText` with a freshly built `rgba(...)` string.** Setting `ctx.font`
   is expensive too, so quantize glyph sizes onto a small table and draw a
   size at a time rather than setting a fresh font per glyph. The string is
   re-parsed every call. 2100 glyphs: **10.9 ms** with fresh strings, **3.7 ms**
   reading from an interned table, 2.0 ms with one fixed style. Quantize the
   alpha into ramps built once at module level (see `_jkRamp`).
9. Full-screen self-copies (`drawImage(canvas, ...)`). About 1 ms each at 720p.
   Budget a handful, not twenty.
10. **Many small canvases.** 149 per-column strips cost 6.2 ms a frame to rebake
   and blit; the same content in ONE atlas canvas, a slot per item, cost 3.7 ms.
   If you bake per item, bake into one atlas.

11. A soft band added to hide one hard edge brings its own. AH!Flowey's path
   was dissolved into the haze with a full width gradient, which removed the
   rule at the horizon and drew a new one across the whole page at its own top
   edge. Fade at BOTH ends. This is in the composition section too and it still
   happened, so it is here as well.

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

**A generic anchor plus `rindex` deletes whatever is between.** A patch script
replaced a block bounded by `s.index(start)` and `s.rindex('  return cv;
}')`.
That closing brace is how every sheet builder in the file ends, so `rindex`
found the LAST one and the edit silently removed two entire functions. The page
kept parsing and died at runtime with "not defined". Bound a replacement with
anchors unique to the ONE function you mean, and assert the slice you are about
to delete looks like what you think it is.

**A 6-space anchor contains the 2-space one.** `"  if (_isX(c))"` matches inside
`"      if (_isX(c))"`. Anchor on the preceding newline.

**Shadowed identifiers.** A sprite builder already has `const c` for its canvas;
do not name the palette `c` too.

**rAF never fires in the preview pane** (`document.hidden === true`), and
`innerWidth` collapses to 0 when the pane is hidden. A zero-width viewport also
makes every `max-width` media query match, so the app's mobile rules switch on
during verification: that is why the system cursor reappears and the custom one
vanishes while testing, and it is not a bug in the page. Anything spring-driven
also cannot be tested by hovering and waiting, because the spring only advances
on frames that never come; drive the draw function by hand instead. Verify by driving the draw
functions manually against offscreen canvases at a chosen size, and screenshot
by POSTing `canvas.toDataURL()` to a small local endpoint.

**`getComputedStyle` returns stale values on pre-existing nodes in that pane.**
Insert a fresh probe node instead. This nearly sent me hunting a CSS conflict
that did not exist.

**No em, en or minus dashes** anywhere in `script.js`, `style.css` or
`index.html`. Assert it before every commit.

**Section-number comments collide across characters.** Renumber inside the one
function's own text, never by searching the whole file.

**The frame throttle needs a `>= 0`.** `if (t - _lt < 0.033) return;` is a
correct 30fps cap and a permanent freeze the first time the clock goes
BACKWARDS, because a large negative difference passes the test forever. Any
remount that resets the loop's `t0`, or anything that drives a draw function
directly, does exactly that. Write `t - _lt >= 0 && t - _lt < 0.033`.

**`#pattern-canvas` sits at opacity 0.3 by default**, so anything subtle you
draw is a third as visible as it looked while you were testing it. Pages that
want the background to carry the page raise it (0.6 to 0.95). The blocks that
set it form a chain where each resets the property unless one of the earlier
claimants is active, which means every new claimant has to be added to every
later negation. Do not extend that chain: put a new claimant in its own block
AFTER all of them, where it only has to set the value.

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
