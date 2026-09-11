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

### If it belongs in the scene, build it IN the scene

Asked for "a red star on the left side", I built a tall arched window on the
OVERLAY, on the grounds that the left of the picture is behind the GUI panels
and a thing meant to be intimidating has to be visible. The answer was that it
"feels out of place", and that the star should be "IN THE BACKGROUND ITSELF, IN
THE SKY". That was right. A thing floated on the overlay is in front of the
room, not in it: it has no perspective, no wall to sit in, and nothing in the
room lights it or is lit by it, so it reads as a decal however well it is drawn.
The panels are translucent. Something genuinely in the picture reads through
them, and reading through them is what "in the background" means.

If the scene has no place for the thing, change the scene. The hall had a
vaulted ceiling and therefore no sky, so the wall got torn open.

### Building an opening: what actually makes a hole read as a hole

Three passes at this failed before it read, and every failure was the same
failure: dark shape on a dark wall. Detail does not make a shape read; contrast
does. In order of how much each one bought:

1. **Something behind it, at a DIFFERENT VALUE.** A night sky in a picture is
   almost never black: it is the *lightest dark* in the frame. The interior here
   is warm red-black everywhere, so the sky is a cooler, lighter violet-black.
   That one change did more than everything else put together.
2. **A HORIZON.** A gradient is a fill; black spires against a lighter sky is a
   distance. It also gives the bottom of the opening something to be.
3. **The THICKNESS of the material**, as a band of cut face between the outer
   outline and an inset copy of it. Reading outward: dark wall, lit broken
   stone, sky. Three values in a row is all a hole has ever needed. Inset by a
   CONSTANT distance, not by a fraction of the way to the centroid, or the band
   goes wide where the opening is tall and vanishes where it is narrow and reads
   as a ribbon draped over two sides of it.
4. **Teeth on all four sides.** Two ragged edges and two ruled ones is a picture
   frame. Keep the teeth SHALLOW: deeper than about a tenth of the surface and
   they stop reading as broken masonry and start reading as spikes.
5. **Rubble on the floor under it**, and the wreckage of whatever used to be in
   the way. A hole with nothing beneath it is a hole somebody drew.

Build the outline in the room's own parameters, not in screen space. Every
vertex here is a (u, f) on the left wall run through the same two functions the
floor junction, the dado and the cornice use, so the opening foreshortens and
leans with the room for free, and the far end of it rides up out of the picture,
which is what stops it reading as a porthole stuck on.

### Do not light the lip with a dot product and hope

The obvious "is this edge facing the light" test came out negative all the way
round: the chandelier is far off to the right, so neither the up-facing top lip
nor the down-facing bottom lip points at it, and the whole outline drew unlit.
The face that is actually turned toward the light is the *cut face inside the
opening*, so that is the thing to make bright. Work out which surface is really
facing the light before writing the shading; do not shade the silhouette and
hope.

### A distant light must be laid over the vignette

The near vignette sits over the whole picture, and it pulled the star's core
down to (170,151,150): a warm grey dot. Everything in the room should be behind
the near dark, because the vignette is the room closing in. A star is not in the
room. Draw its core and the tightest ring of its halo again after the vignette,
additively and small. It is also just what a bright light does to a lens.

### Additive white cores go cyan

Stack additive passes on a red object and the red channel clips first, then
green and blue keep climbing: the core goes white and then faintly cold. A red
giant came out looking like a headlight, twice. Paint the disc with
`source-over` through one radial gradient, and keep `lighter` for the halo and
the spikes where it belongs.

### Clip a light to what it can actually shine on

Clipping the star to the opening left its spikes running down over the black
mountains in front of it. It needs the *sky* inside the opening, which is a
second polygon: the top lip, the ends, and the horizon back along the bottom.
Canvas clips intersect, so clip to both.

Related: do not draw an object inside a clip it does not live in. The ruined
window's glazing bars were being drawn inside the opening, but the window's sill
is *below* the opening, so all that survived the clip was the top inch of each
bar: four short vertical lines floating in the sky like scratches on the screen.
The window is on the wall. Draw it on the wall, and stop each bar short of the
lip so none of them stray up into the sky.

### A path helper that calls `beginPath` cannot build a ring

`_ivBreachPath` began its own path, so calling it twice for an even-odd ring
(outer, then inset) silently threw the outer path away and filled the inset
polygon solid. That painted lit stone over the entire sky and made the opening
read as a framed picture hung on the wall. Give any such helper a `keep` flag
and pass it for the second outline.

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

**You can TEAR the interface, and a clean gap is not a tear.** Masking a
straight transparent band through the panels gives you a slot, and a slot reads
as a design element. What reads as torn is three things at once:

1. **The rip is ragged.** Walk a jittering centreline with a half width that
   varies along it, take a few bites out of the edges, and lose the odd chunk
   entirely. Build it as an SVG `<path>` (outer rectangle plus one closed
   subpath per wound, `fill-rule="evenodd"`) and hand it to `mask-image` as a
   data URL: it is a STRING, so it costs microseconds to build.
2. **The pieces move.** Translate every element away from the cut, on the side
   its own middle falls, with a shear along the cut. And shove the blocks
   INSIDE the card separately and harder: a mask puts a hole through a panel,
   but a panel that does not move is a panel with a hole in it. Keep the list
   to the half dozen big blocks; an effect on `.char-entry` is one element per
   character in the sidebar.
3. **Something comes off.** Shards in the interface's own colours, tumbling
   out of the wound and falling.

**Build the mask ONCE and take it off once. Never animate it.** This was the
mistake that made the whole thing look wrong: the first version widened the
wound over half a second, which meant a fresh data URL twenty times a second,
and every one of those is a NEW image the browser has to re-rasterise before it
can composite the element. The page flickered, because for a frame at a time
elements were being drawn with no mask at all.

It was also modelling the wrong thing. A cut is instantaneous: the hole does
not grow. What grows is the SEPARATION of the two pieces, and that is a
transform, which is a compositor property, free to animate, and re-rasterises
nothing. So: one wide fixed rip, put in on the first frame and taken out on the
last, and an animated shove between. The visible wound is then the rip plus
twice the shove, which is what the canvas layer should draw so its burning
edges sit on the edges that are actually there.

Two more traps. Build the mask in WINDOW space and place it per element with
`mask-size: <winW>px <winH>px` and a negative `mask-position` of that element's
box, or every element gets its own private diagonal instead of one cut across
all of them. And SNAPSHOT each box before you shove it: a shoved element's own
`getBoundingClientRect` is the shoved one, so recomputing from it feeds the
shove back into itself and everything drifts off the screen.

It needs a teardown that clears mask and transform off every element and every
inner block (a stuck mask leaves the app permanently sliced), and a
reduced-motion escape. Measured: 1.06 ms background and 0.74 ms overlay idle,
rising to 1.78 and 1.52 for the second a tear is open.

**An event needs a HOLD, not an attack and a decay.** Ivy's cuts snapped open
and then began settling immediately, and the note back was that it "goes back
to normal too quickly". The envelope that reads is snap, HOLD wide for about a
third of the whole thing, then take the remaining two thirds to settle, rocking
once or twice on the way in. Two heavy pieces knocked apart do not glide back
into line, and a wound wants to sit there long enough to be looked at. The same
shape suits almost any impact: the hold is the part that is easy to leave out
and the part people notice is missing.

**On a pixel page, ONE thing may be crisp, and it should be the thing you are
holding.** Everything on Ivy goes through the low resolution buffer, which is
right for a room and wrong for a polished needle: the rapier was drawn at the
same three-pixel grid as the wallpaper. Drawing it straight onto the real
canvas after the low-resolution blit, at full resolution and last of all, is
what lets it read as steel. Two rules come with that: it has to be drawn LAST
so nothing chunky lands on top of it, and anything attached to it has to come
with it, because a smooth blade dragging a stepped trail reads as two different
cursors.

### Moving the interface itself, and leaving something behind

The room breathes, the chandelier swings, the floor marches, and the GUI sat
perfectly still on top of all of it, which is what made it read as a screenshot
pasted over a picture. Making the panels sway with the page is cheap and it ties
the two together. A few rules came out of doing it:

**ONE writer per CSS property.** The tear already wrote `transform` on these
elements. A second writer for the sway is a fight nobody wins, so the sway and
the shove are summed in one function and written once. If you find yourself
adding a second thing that sets the same property, merge them instead.

**Phase every element off its own position, not off a shared clock.** A dozen
boxes moving in step is not a swaying interface, it is a wobbling page, and a
wobbling page is the nauseating thing this manual already warns about. Out of
step, the same amplitude reads as the room moving under the furniture.

**Freeze on mousedown; do not snap to zero.** The earlier click fix cleared the
transform whenever the pointer was down, which stops clicks being eaten but is
itself a jump. What a `click` actually needs is for the element not to MOVE
between its mousedown and its mouseup, and holding the current offset does that
without the jump.

**Measuring something you are transforming.** `getBoundingClientRect` reports
the box as transformed, so measuring a panel you are already swaying and then
swaying it from that measurement walks it off the screen. Subtract your own
transform, and only re-measure when the layout cache generation changes: within
a generation the cached rect was taken under whatever transform was in effect
then, and subtracting the CURRENT one instead lets the base drift.

**An honest trail of a slow movement is invisible.** A three pixel sway moves
less than a pixel between frames, so the true afterimage is a sub-pixel fringe.
Each echo has to be pushed further along the direction the element came from
until you can actually see it, and the lag has to be read back in SECONDS rather
than in frames or the trail is three times longer on a 30 Hz laptop than on a
144 Hz monitor.

**Three ghosts read as three rectangles. Five read as a smear.** Density with
the alpha falling off is what makes a trail; a few widely spaced copies just
look like copies. And ghost the OUTLINE, not a filled box: these panels are
frames with translucent middles, and a filled ghost puts a wash over the text
inside the real one.

**Ghost on the canvas, not in CSS.** The DOM ways of doing it are a duplicated
subtree per ghost or an animated `filter: drop-shadow`, and the second repaints
the whole panel every frame. Three strokes on the overlay cost 0.11 ms.

**Separate "take the effect off" from "put the page back".** The tear's cleanup
ran at the end of every cut and was clearing the transform with it, so the whole
interface snapped back a few pixels and dropped its echoes each time a wound
healed. Removing the hole and restoring the layout are two different jobs, and
only leaving the page should do the second one.

**Sort by y and draw back to front.** Row order is *not* depth order once items
are jittered off their row line. This is what makes things look like they are
floating.

### When the page is mostly covered (Aeden · PUPPET)

**Check what is actually visible before deciding where anything goes.** On a
full-width layout the panels run edge to edge, so the right gutter the manual
talks about does not exist; the only open cloth is the header band beside the
portrait. Worse, `#pattern-canvas` is `position:absolute` inside the scrolling
`#content`, so it scrolls away with the panels and its bottom edge is rarely
on screen. Anything that has to be at "the bottom of the page" (the lavender
here) belongs on the overlay, which is pinned to the viewport. Keep it low in
the middle, where it stands in front of text, taller at the corners, and make
it bend away from the pointer, so hovering over what is behind it parts it.
The landmark (a sleeping felt moon and stars on strings) went in the header
band, the one part of the cloth nothing covers, at x above 0.7 of the width,
which is clear of the header on both the wide and the narrow layout.

**A full-screen per-pixel pattern belongs on the GPU.** Eighteen patterns and
seven transitions would be eighteen per-pixel loops on a 2D canvas. A fragment
shader on an OFFSCREEN WebGL canvas, drawn into `#pattern-canvas` with one
`drawImage`, costs 0.7 ms for render plus blit at 1670x1016; the whole
background frame with props is 1.1 ms. Rules that came with it:

- ONE context for the life of the tab. Browsers cap live WebGL contexts, and a
  page you can flick in and out of would spend one per visit. Shrink the canvas
  to 1x1 when the page is left instead of throwing it away.
- Handle `webglcontextlost` (preventDefault, fall back to a 2D version) and
  `webglcontextrestored` (rebuild). A page with no GL must still be the page.
- Filter edges to a pixel with `fwidth` (`OES_standard_derivatives` in
  WebGL 1). But `atan` has a branch cut, and `fwidth` spikes across it, which
  draws a blurred line out of the centre of every polar pattern. There, work
  the width out analytically: an angle's footprint is one pixel over the
  radius.
- Give each pattern its OWN clock, the time since it went up, not the page
  clock. Page time grows for hours and a mediump float loses its fraction;
  local time stays small, and every pattern starts fresh.
- GLSL traps: `pow` of a negative base is undefined (write `x * x`), and
  `smoothstep` with the first edge above the second is undefined (write
  `1.0 - smoothstep(lo, hi, x)`). Both work on some GPUs and not others.

**A bright seam reads as lightning.** The first versions of two transitions
(a ragged front, and a noise dissolve) had a narrow additive edge following
high-frequency raggedness, and on a dark cloth they read as electricity rather
than as fabric changing. Low-frequency raggedness, a narrower and dimmer seam,
and let the spot light decide how bright it gets.

**Swinging DOM elements: measure with `offsetLeft`, rotate with `rotate`.**
Each trait tag swings on the CSS `rotate` property, which is separate from
`transform`, so the chip's own hover transform still composes and nobody fights
over one property. `getBoundingClientRect` would include the rotation being
written; `offsetLeft`/`offsetTop`/`offsetWidth` are layout values and do not,
so the boxes can be re-measured on any layout generation without feeding the
swing back into itself. Put `transform-origin` exactly on the thing the canvas
draws at the pivot (the grommet), and the string drawn to it never has to
follow the rotation at all. Write only when the angle moved, hold it while the
button is down, and clear it on teardown. Cap the swing by the element's
width: a wide tag's top corners move by half its width times the angle, and
they are inside an `overflow:hidden` collapsible.

**Do not restyle a trait chip's background.** Rarities live in the chip's
background and pseudo-elements (mythic is a gradient, legendary a sweep), and
a page rule that sets `background` on `.trait-chip` outranks them and wipes
them out. Change the shape, the outline, the shadow and the spacing, and draw
anything extra on the overlay.

**A click effect on a DOM element: one delegated listener, keyed on the
class.** The portrait wobble is a `document` click listener registered once at
load, which acts only when `#cv-avatar` has the page's class. It therefore
also works in performance mode, when the overlay never starts. The wobble is a
Web Animation on `transform`, which restarts cleanly on a second click with no
reflow, as long as the element has no transform of its own in that style.

**A cursor is an icon, not an illustration.** The bunny was drawn twice
with detail (shading, a brow, arms, feet, a fold in each ear, a patch with a
mark on it) and was called "horrid" both times; the first version was also
read as having its eyes shut, because at cursor size a 2 px eye under a brow
line is a closed eye. What was kept is one flat silhouette with ONE outline
round the outside (stroke every part, then fill over all of them, and only
the outer edge survives), a plain patch, two dot eyes with a highlight each,
and a mouth. Life comes from the motion (springy ears, a lean, a squash),
not from the drawing. If a cursor needs explaining up close, it is too
detailed.

**Springs attached to motion: work the sign out, do not guess it.** The
bunny's ears were written with the obvious sign and would have streamed
forward, into the direction of travel, and lifted when climbing. For two ears
hung at `side * angle`, streaming behind a move to the right means BOTH angles
increase, and lagging behind a climb means they droop.

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

12. **One fill of many overlapping shapes.** Aeden's lavender stems were
   first drawn as tapered ribbons: every stem of a row a closed polygon, all
   of them in one path and one `fill`. That one call measured 0.6 ms a frame,
   half the overlay, while all 210 floret sprites together cost 0.05 ms. The
   same stems as batched quadratic STROKES, two widths per row (thick below,
   thin above, each piece its own quadratic cut from the whole curve) still
   taper and cost next to nothing. A self-overlapping path is expensive to
   rasterise however few calls it takes.

   Find a cost like that by switching one part off at a time INSIDE whole
   frames and timing the difference. Timing each part in its own loop without
   a clear lets Chrome pile up every frame's drawing until the flush, so the
   parts add up to several times the real frame and point at the wrong thing.

13. **Path fills and image draws, interleaved.** Sel's sky drew 261 stars as
   batched arcs (0.3 ms on their own) and 16 sparkles as a glow sprite plus a
   small path each (0.8 ms on their own). In the same frame the two together
   measured 9.3 ms, and they were the whole of a 5 to 6 ms overrun. With no
   path fill on that layer at all (the small stars as `fillRect` squares,
   which at a pixel or two nobody can tell from circles, and the big ones and
   every sparkle as one baked sprite) the whole background came to 0.9 ms. If
   a layer mixes `fill()` with `drawImage`, time it both ways before trusting
   either number.

Cheap enough to ignore: `getBoundingClientRect` once a frame, a few hundred
small `arc` fills batched into one path, blits (a full-canvas blit is 0.11 ms).
But see item 13: batched arcs stop being cheap the moment they share a frame
with image draws.

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
