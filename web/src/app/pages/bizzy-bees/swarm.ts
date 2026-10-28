// BIZZY'S HIVE, over the window: the bee that is the pointer (it hovers a
// little above it, chasing it with a lazy buzz, upright, facing where it is
// going), the honey it leaves behind, four small bees orbiting the point, a
// burst of pollen and petals at every click, and the two darting workers that
// got out of the hive and fly over the sheet. All as the old page had it.
import { Raster } from '../raster';
import { PageOverlay } from '../kit/overlay';
import { C, P, drawBee } from './look';
import { BEE, flyBee } from './hive';

const TAU = Math.PI * 2;
interface Dot { x: number; y: number; life: number }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; r: number; petal: boolean }

export class Swarm extends PageOverlay {
  private bx = innerWidth / 2; private by = innerHeight / 2;
  private face = 1; private tilt = 0;
  private trail: Dot[] = [];
  private bits: Bit[] = [];
  private sheet: DOMRect | null = null;
  private n = 0;

  constructor() { super('pg-bizzy_bees', () => P.table); }

  protected override begin(): void {
    this.bx = this.mx > -1000 ? this.mx : innerWidth / 2; this.by = this.my > -1000 ? this.my : innerHeight / 2;
    this.trail = []; this.bits = []; this.sheet = null; this.n = 0;
  }

  protected override press(): void {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * TAU, s = 1.4 + Math.random() * 3.6;
      this.bits.push({ x: this.mx, y: this.my, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2, life: 1, r: 1.4 + Math.random() * 2.4, petal: Math.random() < 0.32 });
    }
  }

  protected frame(r: Raster, t: number, dt: number): boolean {
    const px = this.px;
    // the two workers that got out: over the sheet, where it is (measured now and then, not every frame)
    if (this.n++ % 20 === 0) this.sheet = document.querySelector('ss-character-view')?.getBoundingClientRect() ?? null;
    const sh = this.sheet;
    if (sh && sh.width > 0) for (const b of [3, 4]) flyBee(r, b, sh.width, Math.max(sh.height, innerHeight - sh.top), t, px, sh.left / px, sh.top / px);
    if (!this.mouse && !this.bits.length) return !!sh;

    if (this.mouse) {
      // the lead bee hovers a touch above the point, chasing it frame-rate independently
      const tx = this.mx + Math.sin(t * 4.2) * 5, ty = this.my - 14 + Math.cos(t * 5.1) * 4, sm = 1 - Math.pow(0.0016, dt);
      this.bx += (tx - this.bx) * sm; this.by += (ty - this.by) * sm;
      const dx = this.mx - this.bx, dy = this.my - this.by;
      if (dx > 20) this.face = 1; else if (dx < -20) this.face = -1;
      this.tilt += (Math.max(-0.4, Math.min(0.4, dy / 140)) - this.tilt) * Math.min(1, dt * 8);
      // its honey trail
      this.trail.push({ x: this.bx, y: this.by, life: 1 });
      if (this.trail.length > 22) this.trail.shift();
    }
    this.trail.forEach((p, i) => {
      p.life -= dt * 1.7;
      if (p.life <= 0) return;
      const lv = p.life * 0.9 * (i / this.trail.length);
      r.dot(p.x / px, p.y / px, p.life > 0.6 ? C['y3'] : C['h8'], lv);
      if (p.life > 0.75) r.dot(p.x / px + 1, p.y / px, C['h8'], lv * 0.6);
    });
    this.trail = this.trail.filter(p => p.life > 0);

    // the bursts: pollen motes and drifting petals, falling as they fade
    for (const b of this.bits) {
      b.life -= dt * 1.5;
      if (b.life <= 0) continue;
      b.vy += dt * 6; b.x += b.vx; b.y += b.vy; b.vx *= 0.96; b.vy *= 0.96;
      const x = b.x / px, y = b.y / px;
      if (b.petal) {
        const a = b.x * 0.05 + t, along = Math.abs(Math.cos(a)) > 0.5;
        const c = b.life > 0.5 ? C['p2'] : C['p1'];
        r.dot(x, y, c, b.life + 0.2); r.dot(along ? x + 1 : x, along ? y : y + 1, C['p1'], b.life + 0.2);
      } else {
        r.dot(x, y, C['y3'], b.life + 0.15);
        if (b.r * b.life > 2.2) r.dot(x + 1, y, C['y2'], b.life);
      }
    }
    this.bits = this.bits.filter(b => b.life > 0);

    if (this.mouse) {
      drawBee(r, this.bx / px, this.by / px, this.tilt, BEE / px, Math.abs(Math.sin(t * 34)), 'new', this.face);
      // the small swarm orbiting the point, upright, facing the way each goes
      for (let i = 0; i < 4; i++) {
        const dir = i % 2 === 0 ? 1 : -1, rad = 24 + i * 11 + Math.sin(t * 1.3 + i) * 4, a = t * (1.5 + i * 0.35) * dir + i * (TAU / 4);
        const ox = this.mx + Math.cos(a) * rad, oy = this.my + Math.sin(a) * rad * 0.72;
        const vx = -Math.sin(a) * dir, vy = Math.cos(a) * dir * 0.72;
        drawBee(r, ox / px, oy / px, Math.max(-0.4, Math.min(0.4, vy * 0.5)), (i % 2 ? 0.52 : 0.5) * BEE / px, Math.abs(Math.sin(t * 30 + i * 1.7)), i % 2 ? 'new' : 'old', vx >= 0 ? 1 : -1);
      }
    }
    return true;
  }
}
