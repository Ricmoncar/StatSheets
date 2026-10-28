// SORROW: the page. Exactly Fury's fire, as the old page had it, but drained
// of colour and pouring down from above, behind the sheet and over the
// window. The cursor (in place of the heart) is a googly-eyed doner wrap,
// tilting into its motion, its eyes looking where it is going, and a click
// makes it bounce, blush and throw sparks.
import { Raster } from '../raster';
import { greyTable, palette } from '../kit/palette';
import { sceneModule } from '../kit/scene';
import { Xf, alpha, bez2, shape, shapeOval } from '../kit/paint';
import { FireOverlay, FireWorld, P as FIRE } from '../fury-fire/fire';

const GREY = greyTable(FIRE);
const TAU = Math.PI * 2;

// the wrap keeps a little of its colour (the old page drew it 42% grey)
const D = palette({
  m: ['#4a2008', '#6e3414', '#8a4a1e'],       // the meat
  v: ['#3c7a26', '#62a23e', '#d24a38', '#efe6d6'],   // lettuce, tomato, onion
  b: ['#5f3a16', '#a87b40', '#c9a060', '#e8c887', '#f0d49a', '#fff0cd'],   // the bread
  p: ['#968c7a', '#aaa08e', '#d0c6b4', '#efe9dd'],   // the paper
  e: ['#111111', '#e8e4e0', '#ffffff', '#ff4466'],   // eyes, and the blush
});
const DC = D.C;
const WRAP_COLOURS = greyTable(D, 0.42);

class SorrowOverlay extends FireOverlay {
  private x = innerWidth / 2; private y = innerHeight / 2; private vx = 0; private vy = 0;
  private bounce = 0; private happy = 0;
  private wrap = new Raster(40, 64);

  constructor() { super('pg-sorrow_fire', true, () => GREY); }

  protected override begin(): void {
    super.begin();
    this.x = this.mx > -1000 ? this.mx : innerWidth / 2; this.y = this.my > -1000 ? this.my : innerHeight / 2;
    this.vx = this.vy = 0; this.bounce = this.happy = 0;
  }

  protected override press(): void {
    this.bounce = 1; this.happy = 2.2;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * TAU, s = 90 + Math.random() * 200;
      this.sparks.push({ x: this.x, y: this.y - 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 1, r: 2.5 + Math.random() * 4.5, hue: Math.random() * 45 });
    }
  }

  protected override decorate(_r: Raster, t: number, dt: number): void {
    // a floaty spring after the pointer
    // the wrap is the pointer now, so it sits right on it; how fast it moves still tilts it and steers its eyes
    if (this.mouse && dt > 0) {
      const k = Math.min(1, dt * 12);
      this.vx += ((this.mx - this.x) / dt - this.vx) * k; this.vy += ((this.my - this.y) / dt - this.vy) * k;
      this.x = this.mx; this.y = this.my;
    } else { this.vx *= 0.9; this.vy *= 0.9; }
    this.bounce = Math.max(0, this.bounce - dt * 3.2);
    this.happy = Math.max(0, this.happy - dt);
    if (!this.mouse) { this.cursor?.move(0, 0, this.px, false); return; }
    this.drawWrap(t);
    this.cursor?.set(this.wrap, WRAP_COLOURS, this.wrap.w / 2, this.wrap.h / 2, this.px, true);
    this.cursor?.move(this.x, this.y, this.px, true);
  }

  /** The wrap at the middle of its raster: the filling out of the top, the grilled bread, the paper cone, and the eyes. */
  private drawWrap(t: number): void {
    const r = this.wrap, b = this.bounce, sq = b > 0 ? Math.sin(b * Math.PI * 3.2) * b * 0.42 : 0;
    const sX = 1 + sq * 0.32, sY = 1 - sq * 0.42, spd = Math.hypot(this.vx, this.vy);
    const happy = Math.min(1, this.happy);
    const f: Xf = { x: r.w / 2, y: r.h / 2 + (Math.sin(t * 2.4) * 3.5) / this.px, a: spd > 18 ? Math.atan2(this.vy, this.vx) * 0.09 : 0, s: 1.15 / this.px };
    const S = (pts: number[]) => pts.map((v, i) => (i % 2 ? v * sY : v * sX));
    const bw = 13, bh = 42, top = -bh + 10, paper = bh - 26;
    r.clear(0);
    // the filling: meat mounding out of the open top, with lettuce, tomato and onion
    shapeOval(r, f, 0, (top - 2) * sY, (bw - 1) * sX, 8 * sY, 0, DC['m1']);
    for (const dx of [-7, -1, 5]) shape(r, f, S([dx - 2, top - 3, dx, top - 12, dx + 2, top - 3]), DC['m2']);
    shapeOval(r, f, -7 * sX, (top - 4) * sY, 4 * sX, 2.5 * sY, -0.4, DC['v1']);
    shapeOval(r, f, 6 * sX, (top - 2) * sY, 3 * sX, 3 * sY, 0, DC['v2']);
    shapeOval(r, f, 1 * sX, (top - 1) * sY, 2 * sX, 2 * sY, 0, DC['v3']);
    // the bread: rounded at the top, grilled across, darker at its sides
    const bread = [-bw, paper + 2, -bw, top + 4];
    bez2(bread, -bw, top + 4, -bw, top - 4, -bw * 0.45, top - 4);
    bread.push(bw * 0.45, top - 4);
    bez2(bread, bw * 0.45, top - 4, bw, top - 4, bw, top + 4);
    bread.push(bw, paper + 2);
    shape(r, f, S(bread), (x, y, u, v) => {
      const k = Math.abs(u / (bw * sX)), grill = (((v / sY - top) - (u / sX + bw) * 0.75) % 12 + 12) % 12 < 2.4;
      if (grill) return DC['b1'];
      if (Math.abs(u / sX + bw * 0.36) < 1) return DC['b5'];
      return k > 0.8 ? DC['b1'] : k > 0.55 ? DC['b2'] : k > 0.2 ? DC['b3'] : DC['b4'];
    });
    // the paper cone round the bottom, with its folds and the folded rim
    shape(r, f, S([-bw - 2, paper, bw + 2, paper, bw * 0.5, bh, -bw * 0.5, bh]), (x, y, u) => (Math.abs(u / sX) < 1 || Math.abs(Math.abs(u / sX) - bw * 0.33) < 0.8 ? DC['p1'] : DC['p3']));
    shape(r, f, S([-bw - 2, paper - 2, bw + 2, paper - 2, bw + 2, paper + 1, -bw - 2, paper + 1]), DC['p2']);
    // the googly eyes, looking about, or where it is going, or (happy) up
    const vf = Math.min(1, spd / 320);
    for (const s of [-1, 1]) {
      const ex = s * 8, ey = top + 16, er = 8 + happy * 1.2;
      shapeOval(r, f, ex * sX, ey * sY, (er + 0.8) * sX, (er + 0.8) * sY, 0, DC['e0']);
      shapeOval(r, f, ex * sX, ey * sY, er * sX, er * sY, 0, DC['e1']);
      let pdx: number, pdy: number;
      if (happy > 0.05) { pdx = Math.sin(t * 2.2 + s * 1.1) * er * 0.18; pdy = -er * 0.26 + Math.sin(t * 1.8 + s) * er * 0.09; }
      else { pdx = Math.sin(t * 1.1 + s * 0.9) * er * 0.35 * (1 - vf); pdy = Math.cos(t * 0.85 + s * 1.3) * er * 0.35 * (1 - vf); }
      if (spd > 8) { pdx += (this.vx / spd) * er * 0.38 * vf; pdy += (this.vy / spd) * er * 0.38 * vf; }
      const pd = Math.hypot(pdx, pdy), mx = er * 0.38;
      if (pd > mx) { pdx *= mx / pd; pdy *= mx / pd; }
      shapeOval(r, f, (ex + pdx) * sX, (ey + pdy) * sY, er * 0.58 * sX, er * 0.58 * sY, 0, DC['e0']);
      shapeOval(r, f, (ex + pdx + er * 0.19) * sX, (ey + pdy - er * 0.19) * sY, er * 0.19 * sX, er * 0.19 * sY, 0, DC['e2']);
      if (happy > 0) shapeOval(r, f, s * (8 + er * 0.6) * sX, (ey + er * 0.85) * sY, er * 0.6 * sX, er * 0.25 * sY, 0, alpha(DC['e3'], happy * 0.8));
    }
  }
}

export const { drawBackground, resetBackground, startOverlay, stopOverlay } = sceneModule(new FireWorld(true, GREY), new SorrowOverlay());
