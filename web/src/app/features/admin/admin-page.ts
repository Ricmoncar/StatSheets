import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { arrayRemove, arrayUnion, doc, increment, runTransaction, updateDoc, writeBatch } from 'firebase/firestore';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { ConfirmService } from '../../core/confirm.service';
import { FIRESTORE, col } from '../../core/firebase';
import { MAIN_STATS } from '../../core/game/stats';
import { TRAITS } from '../../core/game/traits-data';
import { NotifyService } from '../../core/notify.service';
import { Icon } from '../../ui/icon';
import { Panel } from '../../ui/panel';
import { SESSION_KEY, StatMap, mergeStats, nextRev, passwordOk, setMerge, statValue, traitKey } from './admin';

interface Pending { traits: string[]; shimmy: string[] }
interface Orig extends Pending { stats: StatMap; name: string }

const BATCH = 500;

function readSession(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

/**
 * ADMIN (the old admin.html), behind the old password: a trait editor for one
 * character, quick stat overrides and renaming, trait operations on every
 * character at once, and an overview of everyone's traits and stats. Saves
 * merge with changes made elsewhere since the character was loaded.
 */
@Component({
  selector: 'ss-admin-page',
  imports: [Icon, Panel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-page.html',
  styleUrl: './admin-page.scss',
})
export class AdminPage {
  private readonly db = inject(FIRESTORE);
  protected readonly store = inject(CharacterStore);
  private readonly notifier = inject(NotifyService);
  private readonly confirm = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  protected readonly STATS = MAIN_STATS;

  // ── the gate ──
  protected readonly unlocked = signal(readSession());
  protected readonly authErr = signal('');

  protected unlock(input: HTMLInputElement): void {
    if (passwordOk(input.value)) {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* private mode: this visit only */ }
      this.unlocked.set(true);
    } else {
      this.authErr.set('WRONG PASSWORD.');
      input.value = '';
      input.focus();
    }
  }

  // ── characters ──
  protected readonly chars = this.store.characters;
  protected readonly search = signal('');
  protected readonly filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    return q ? this.chars().filter(c => (c.name || c.id || '').toLowerCase().includes(q)) : this.chars();
  });
  /** Every trait the game knows, plus any key a character holds that it does not. */
  protected readonly knownKeys = computed(() => {
    const keys = new Set(Object.keys(TRAITS));
    for (const c of this.chars()) for (const k of [...(c.traits || []), ...(c.shimmyfulTraits || [])]) keys.add(k);
    return [...keys].sort();
  });

  protected readonly selId = signal<string | null>(null);
  protected readonly sel = computed(() => (this.selId() ? this.store.byId().get(this.selId()!) ?? null : null));
  protected readonly pending = signal<Pending | null>(null);
  private orig: Orig | null = null;
  /** Trait edits not saved yet: while set, changes from elsewhere do not replace them. */
  protected readonly dirty = signal(false);
  protected readonly statsText = signal<Record<string, string>>({});
  private statsTyped = false;
  protected readonly renameText = signal('');
  protected readonly teMsg = signal('');
  protected readonly bulkMsg = signal('');
  protected readonly nukeMsg = signal('');
  private teMsgTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // as on the old page, the editor follows the database until something is changed here
    effect(() => {
      const c = this.sel();
      untracked(() => {
        if (!c) return;
        if (!this.dirty()) {
          this.pending.set({ traits: [...(c.traits || [])], shimmy: [...(c.shimmyfulTraits || [])] });
          if (this.orig) { this.orig.traits = [...(c.traits || [])]; this.orig.shimmy = [...(c.shimmyfulTraits || [])]; }
        }
        if (!this.statsTyped) this.statsText.set(this.statFields(c));
      });
    });
  }

  protected rarity(key: string): string { return TRAITS[key]?.rarity || 'common'; }
  protected traitName(key: string): string { return TRAITS[key]?.name || key; }
  protected count(n: number, what: string): string { return `${n} ${what}${n !== 1 ? 'S' : ''}`; }
  protected isShimmy(c: Character, k: string): boolean { return (c.shimmyfulTraits || []).includes(k); }

  private statFields(c: Character): Record<string, string> {
    const s = (c.stats || {}) as StatMap;
    return Object.fromEntries(MAIN_STATS.map(k => [k, String(s[k] || 0)]));
  }

  // ── the trait editor ──
  protected load(c: Character): void {
    this.selId.set(c.id);
    this.pending.set({ traits: [...(c.traits || [])], shimmy: [...(c.shimmyfulTraits || [])] });
    this.orig = { traits: [...(c.traits || [])], shimmy: [...(c.shimmyfulTraits || [])], stats: { ...((c.stats || {}) as StatMap) }, name: c.name };
    this.dirty.set(false);
    this.statsTyped = false;
    this.statsText.set(this.statFields(c));
    this.teMsg.set('');
    this.renameText.set(c.name || '');
  }

  protected jumpToEdit(c: Character): void {
    this.load(c);
    this.host.querySelector('.te')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected addTrait(input: HTMLInputElement, shimmy: HTMLInputElement): void {
    const p = this.pending();
    if (!p) { this.notifier.notify('SELECT A CHARACTER FIRST', 'err'); return; }
    const key = traitKey(input.value);
    if (!key) return;
    this.pending.set({
      traits: p.traits.includes(key) ? p.traits : [...p.traits, key],
      shimmy: shimmy.checked && !p.shimmy.includes(key) ? [...p.shimmy, key] : p.shimmy,
    });
    input.value = '';
    shimmy.checked = false;
    this.dirty.set(true);
  }

  protected removeTrait(key: string): void {
    const p = this.pending();
    if (!p) return;
    this.pending.set({ traits: p.traits.filter(k => k !== key), shimmy: p.shimmy.filter(k => k !== key) });
    this.dirty.set(true);
  }

  protected async clearAll(): Promise<void> {
    const c = this.sel();
    if (!c || !this.pending()) return;
    if (!(await this.confirm.ask(`CLEAR ALL TRAITS FROM ${(c.name || c.id).toUpperCase()}?`))) return;
    this.pending.set({ traits: [], shimmy: [] });
    this.dirty.set(true);
  }

  /** Reads the latest version and merges this page's additions and removals into it, with the next revision. */
  protected async saveTraits(): Promise<void> {
    const c = this.sel(), p = this.pending();
    if (!c || !p) { this.notifier.notify('SELECT A CHARACTER FIRST', 'err'); return; }
    const orig = this.orig || { traits: [], shimmy: [] };
    const ref = doc(this.db, col('characters'), c.id);
    try {
      const saved = await runTransaction(this.db, async t => {
        const snap = await t.get(ref);
        if (!snap.exists()) throw new Error('character was deleted');
        const d = snap.data() as Character;
        const traits = setMerge(orig.traits, p.traits, d.traits);
        const shimmyfulTraits = setMerge(orig.shimmy, p.shimmy, d.shimmyfulTraits);
        t.update(ref, { traits, shimmyfulTraits, _rev: nextRev(d) });
        return { traits, shimmy: shimmyfulTraits };
      });
      this.pending.set({ traits: [...saved.traits], shimmy: [...saved.shimmy] });
      if (this.orig) { this.orig.traits = [...saved.traits]; this.orig.shimmy = [...saved.shimmy]; }
      this.dirty.set(false);
      this.teMsg.set('SAVED');
      clearTimeout(this.teMsgTimer);
      this.teMsgTimer = setTimeout(() => this.teMsg.set(''), 2500);
      this.notifier.notify('SAVED: ' + (c.name || c.id), 'ok');
    } catch (err) {
      this.notifier.notify('SAVE FAILED: ' + (err as Error).message, 'err');
    }
  }

  // ── quick stats and renaming ──
  protected typeStat(k: string, v: string): void {
    this.statsTyped = true;
    this.statsText.update(m => ({ ...m, [k]: v }));
  }

  protected async saveStats(): Promise<void> {
    const c = this.sel();
    if (!c) { this.notifier.notify('SELECT A CHARACTER FIRST', 'err'); return; }
    const orig = this.orig?.stats || {};
    const want: StatMap = {};
    for (const k of MAIN_STATS) { const v = statValue(this.statsText()[k] ?? ''); if (v !== undefined) want[k] = v; }
    const ref = doc(this.db, col('characters'), c.id);
    try {
      const r = await runTransaction(this.db, async t => {
        const snap = await t.get(ref);
        if (!snap.exists()) throw new Error('character was deleted');
        const d = snap.data() as Character;
        const m = mergeStats(orig, want, (d.stats || {}) as StatMap);
        t.update(ref, { stats: m.stats, _rev: nextRev(d) });
        return m;
      });
      if (this.orig) this.orig.stats = { ...r.stats };
      this.statsTyped = false;
      if (r.clashed.length) this.notifier.notify('CHANGED ELSEWHERE, NOT SAVED: ' + r.clashed.join(', ').toUpperCase(), 'err');
      else this.notifier.notify('STATS SAVED: ' + (c.name || c.id), 'ok');
    } catch (err) {
      this.notifier.notify('SAVE FAILED: ' + (err as Error).message, 'err');
    }
  }

  protected async rename(): Promise<void> {
    const c = this.sel();
    if (!c) { this.notifier.notify('SELECT A CHARACTER FIRST', 'err'); return; }
    const newName = this.renameText().trim();
    if (!newName) { this.notifier.notify('ENTER A NAME', 'err'); return; }
    const old = c.name;
    const origName = this.orig?.name ?? old;
    const ref = doc(this.db, col('characters'), c.id);
    try {
      await runTransaction(this.db, async t => {
        const snap = await t.get(ref);
        if (!snap.exists()) throw new Error('character was deleted');
        const d = snap.data() as Character;
        if (d.name !== origName && d.name !== newName) throw new Error(`it was renamed elsewhere to "${d.name}"`);
        t.update(ref, { name: newName, _rev: nextRev(d) });
      });
      if (this.orig) this.orig.name = newName;
      this.notifier.notify(`"${old}" → "${newName}"`, 'ok');
    } catch (err) {
      this.notifier.notify('RENAME FAILED: ' + (err as Error).message, 'err');
    }
  }

  // ── every character at once ──
  /**
   * Writes in batches of 500. A batch is all or nothing, so one document that
   * cannot take the change (one already at Firestore's 1 MB limit, say) would
   * stop everyone else's: a failed batch is written again one character at a
   * time, and the ones that still fail are named. Returns the ids written.
   */
  private async batchWrite(updates: { id: string; data: Record<string, unknown> }[]): Promise<Set<string>> {
    const written = new Set<string>();
    const failed: { id: string; why: string }[] = [];
    for (let i = 0; i < updates.length; i += BATCH) {
      const chunk = updates.slice(i, i + BATCH);
      const b = writeBatch(this.db);
      for (const u of chunk) b.update(doc(this.db, col('characters'), u.id), u.data);
      try {
        await b.commit();
        for (const u of chunk) written.add(u.id);
      } catch {
        const results = await Promise.allSettled(chunk.map(u => updateDoc(doc(this.db, col('characters'), u.id), u.data)));
        results.forEach((r, j) => {
          if (r.status === 'fulfilled') written.add(chunk[j].id);
          else failed.push({ id: chunk[j].id, why: /exceeds the maximum allowed size/.test(String(r.reason?.message)) ? 'too big' : String(r.reason?.message || 'error') });
        });
      }
    }
    if (failed.length) {
      const byId = this.store.byId();
      const names = failed.map(f => `${byId.get(f.id)?.name || f.id} (${f.why})`).join(', ');
      this.notifier.notify(`COULD NOT UPDATE ${failed.length}: ${names}`, 'err', 6000);
    }
    return written;
  }

  protected async giveAll(keyIn: HTMLInputElement, shimmyIn: HTMLInputElement): Promise<void> {
    const key = traitKey(keyIn.value), shimmy = shimmyIn.checked, all = this.chars();
    if (!key) { this.notifier.notify('ENTER A TRAIT KEY', 'err'); return; }
    if (!(await this.confirm.ask(`GIVE "${key}" TO ALL ${all.length} CHARACTERS?${shimmy ? ' (SHIMMYFUL)' : ''}`))) return;
    const lacking = all.filter(c => !(c.traits || []).includes(key)).map(c => c.id);
    const data = { traits: arrayUnion(key), ...(shimmy ? { shimmyfulTraits: arrayUnion(key) } : {}), _rev: increment(1) };
    const written = await this.batchWrite(all.map(c => ({ id: c.id, data })));
    this.report(`GAVE "${key}" TO ${lacking.filter(id => written.has(id)).length} CHARS`, written.size, m => this.bulkMsg.set(m));
  }

  protected removeAll(keyIn: HTMLInputElement, where: 'bulk' | 'nuke'): Promise<void> {
    const key = traitKey(keyIn.value);
    if (!key) { this.notifier.notify('ENTER A TRAIT KEY', 'err'); return Promise.resolve(); }
    return this.doRemoveAll(key, m => (where === 'bulk' ? this.bulkMsg : this.nukeMsg).set(m));
  }

  private async doRemoveAll(key: string, msg: (m: string) => void): Promise<void> {
    if (!(await this.confirm.ask(`REMOVE "${key}" FROM ALL CHARACTERS WHO HAVE IT?`))) return;
    const holders = this.chars().filter(c => (c.traits || []).includes(key));
    if (!holders.length) { this.notifier.notify('NO CHARACTERS HAD THAT TRAIT', 'info'); return; }
    const data = { traits: arrayRemove(key), shimmyfulTraits: arrayRemove(key), _rev: increment(1) };
    const written = await this.batchWrite(holders.map(c => ({ id: c.id, data })));
    this.report(`REMOVED "${key}" FROM ${written.size} CHARS`, written.size, msg);
  }

  protected async wipeAll(): Promise<void> {
    const all = this.chars();
    if (!(await this.confirm.ask(`WIPE ALL TRAITS FROM ALL ${all.length} CHARACTERS?`))) return;
    if (!(await this.confirm.ask('SECOND CONFIRMATION: THIS CANNOT BE UNDONE.'))) return;
    const data = { traits: [], shimmyfulTraits: [], _rev: increment(1) };
    const written = await this.batchWrite(all.map(c => ({ id: c.id, data })));
    this.report(`WIPED ALL TRAITS FROM ${written.size} CHARS`, written.size, m => this.nukeMsg.set(m));
  }

  private report(done: string, n: number, msg: (m: string) => void): void {
    if (!n) return;   // nothing went through; the failure toast says why
    msg(done);
    this.notifier.notify(done, 'ok');
  }
}
