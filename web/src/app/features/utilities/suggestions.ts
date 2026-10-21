import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { addDoc, collection, doc, getDocs, increment, limit, orderBy, query, updateDoc } from 'firebase/firestore';
import { FIRESTORE, col } from '../../core/firebase';
import { NotifyService } from '../../core/notify.service';
import { Icon } from '../../ui/icon';

const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic', 'hexxed', 'duality', 'determined'] as const;
const RAR_COLORS: Record<string, { fg: string; border: string; bg: string }> = {
  common: { fg: '#c0c0c0', border: '#6a6a6a', bg: '#111111' },
  rare: { fg: '#4aa9ff', border: '#1f73d4', bg: '#05111f' },
  epic: { fg: '#c98bff', border: '#8a3fff', bg: '#12071f' },
  legendary: { fg: '#ffe14a', border: '#ffae00', bg: '#1e1500' },
  mythic: { fg: '#ffd86a', border: '#ff6a00', bg: '#1c0800' },
  hexxed: { fg: '#c46aff', border: '#5400a0', bg: '#08000f' },
  duality: { fg: '#88c8ff', border: '#1a3080', bg: '#03040e' },
  determined: { fg: '#ff3333', border: '#880000', bg: '#040000' },
};
// shared with the old site (same origin), so a vote there counts here
const VOTED_KEY = 'sugg_voted_v1';

interface TraitSuggestion { id: string; name: string; rarity: string; desc: string; effect: string | null; submitter: string | null; createdAt: number; votes: number }
interface GeneralSuggestion { id: string; text: string; createdAt: number }

function readVoted(): string[] {
  try { return JSON.parse(localStorage.getItem(VOTED_KEY) || '[]') || []; } catch { return []; }
}

/** The trait suggestion box: submit an idea, upvote others (once per browser). */
@Component({
  selector: 'ss-trait-suggestions',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="intro">Got an idea for a new trait? Fill it in below. The more detail the better.</p>
    <form class="form" (submit)="$event.preventDefault(); submit()">
      <label class="field"><span>TRAIT NAME</span>
        <input type="text" maxlength="60" placeholder="e.g. Phantom Step, Bloodpact..." [value]="name()" (input)="name.set($any($event.target).value)" />
      </label>
      <div class="field"><span>SUGGESTED RARITY</span>
        <div class="rarities" role="radiogroup" aria-label="Suggested rarity">
          @for (r of rarities; track r) {
            <button type="button" role="radio" class="rar" [class.on]="rarity() === r" [attr.aria-checked]="rarity() === r" [style.--fg]="colors[r].fg" [style.--bd]="colors[r].border" [style.--bg]="colors[r].bg" (click)="rarity.set(r)">{{ r.toUpperCase() }}</button>
          }
        </div>
      </div>
      <label class="field"><span>WHAT DOES IT DO?</span>
        <textarea rows="3" placeholder="Describe the trait's effect in plain language..." [value]="desc()" (input)="desc.set($any($event.target).value)"></textarea>
      </label>
      <label class="field"><span>STAT EFFECT IDEA <small>(OPTIONAL)</small></span>
        <textarea rows="2" placeholder="e.g. +50% ATK, ×2 DEF when below 20% HP, +30 Crit Rate..." [value]="effect()" (input)="effect.set($any($event.target).value)"></textarea>
      </label>
      <label class="field narrow"><span>YOUR NAME <small>(OPTIONAL)</small></span>
        <input type="text" maxlength="32" placeholder="Leave blank for Anonymous" [value]="submitter()" (input)="submitter.set($any($event.target).value)" />
      </label>
      <div class="send">
        <button type="submit" class="btn u-btn primary"><ss-icon name="star" />SUBMIT SUGGESTION</button>
        <span class="status" [attr.data-tone]="status().tone" aria-live="polite">{{ status().text }}</span>
      </div>
    </form>

    <div class="list">
      @if (list(); as items) {
        @if (items.length) {
          <span class="count">SUGGESTIONS ({{ items.length }})</span>
          @for (s of items; track s.id) {
            @let c = colors[s.rarity] || colors['common'];
            <article class="card" [style.--fg]="c.fg" [style.--bd]="c.border" [style.--bg]="c.bg">
              <header>
                <span class="tag">{{ (s.rarity || 'common').toUpperCase() }}</span>
                <span class="sname">{{ s.name }}</span>
                <button type="button" class="vote" [class.voted]="voted().includes(s.id)" (click)="vote(s)" [title]="voted().includes(s.id) ? 'Already voted' : 'Upvote this trait'"><i class="u-spr s-heart7" aria-hidden="true"></i>{{ s.votes || 0 }}</button>
              </header>
              <p class="sdesc">{{ s.desc }}</p>
              @if (s.effect) { <p class="effect"><span>STAT IDEA</span>{{ s.effect }}</p> }
              <footer><span>{{ s.submitter ? '- ' + s.submitter : ': Anonymous' }}</span><span>{{ s.createdAt | date: 'shortDate' }}</span></footer>
            </article>
          }
        } @else {
          <p class="none u-empty">NO SUGGESTIONS YET: BE THE FIRST.</p>
        }
      }
    </div>
  `,
  styleUrl: './suggestions.scss',
})
export class TraitSuggestions implements OnInit {
  private readonly db = inject(FIRESTORE);
  private readonly notifier = inject(NotifyService);

  protected readonly rarities = RARITIES;
  protected readonly colors = RAR_COLORS;
  protected readonly name = signal('');
  protected readonly rarity = signal<string>('common');
  protected readonly desc = signal('');
  protected readonly effect = signal('');
  protected readonly submitter = signal('');
  protected readonly status = signal<{ text: string; tone: 'ok' | 'err' | '' }>({ text: '', tone: '' });
  protected readonly list = signal<TraitSuggestion[] | null>(null);
  protected readonly voted = signal<string[]>(readVoted());

  ngOnInit(): void { void this.load(); }

  /** The newest forty, most voted first (newest first within a tie). */
  private async load(): Promise<void> {
    try {
      const snap = await getDocs(query(collection(this.db, col('suggestions')), orderBy('createdAt', 'desc'), limit(40)));
      this.list.set(snap.docs.map(d => ({ ...(d.data() as Omit<TraitSuggestion, 'id'>), id: d.id }))
        .sort((a, b) => (b.votes || 0) - (a.votes || 0) || b.createdAt - a.createdAt));
    } catch (err) {
      console.error('Suggestions failed to load:', err);
      this.list.set([]);
    }
  }

  protected async submit(): Promise<void> {
    const name = this.name().trim(), desc = this.desc().trim();
    if (!name) { this.status.set({ text: 'TRAIT NAME IS REQUIRED.', tone: '' }); return; }
    if (!desc) { this.status.set({ text: 'PLEASE DESCRIBE WHAT IT DOES.', tone: '' }); return; }
    try {
      await addDoc(collection(this.db, col('suggestions')), {
        name, rarity: this.rarity(), desc, effect: this.effect().trim() || null, submitter: this.submitter().trim() || null, createdAt: Date.now(), votes: 0,
      });
      this.name.set(''); this.desc.set(''); this.effect.set(''); this.submitter.set(''); this.rarity.set('common');
      this.status.set({ text: 'SUGGESTION SUBMITTED!', tone: 'ok' });
      setTimeout(() => this.status.set({ text: '', tone: '' }), 3500);
      void this.load();
    } catch {
      this.status.set({ text: 'FAILED TO SUBMIT.', tone: 'err' });
    }
  }

  protected async vote(s: TraitSuggestion): Promise<void> {
    if (this.voted().includes(s.id)) { this.notifier.notify('ALREADY VOTED', 'err'); return; }
    try {
      await updateDoc(doc(this.db, col('suggestions'), s.id), { votes: increment(1) });
      const next = [...readVoted(), s.id];
      try { localStorage.setItem(VOTED_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
      this.voted.set(next);
      void this.load();
    } catch (err) {
      console.error('Vote failed:', err);
    }
  }
}

/** Anything else: bugs, features, feedback. Shows the newest twenty. */
@Component({
  selector: 'ss-general-suggestions',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="intro">Anything else: bugs, features, feedback, whatever.</p>
    <form class="form" (submit)="$event.preventDefault(); submit()">
      <label class="field"><span class="sr">Suggestion</span>
        <textarea rows="4" placeholder="Type your suggestion here..." [value]="text()" (input)="text.set($any($event.target).value)"></textarea>
      </label>
      <div class="send">
        <button type="submit" class="btn u-btn primary"><ss-icon name="chat" />SUBMIT</button>
        <span class="status" [attr.data-tone]="status().tone" aria-live="polite">{{ status().text }}</span>
      </div>
    </form>
    <div class="list">
      @if (list(); as items) {
        @if (items.length) {
          <span class="count">RECENT</span>
          @for (s of items; track s.id) {
            <article class="note"><p>{{ s.text }}</p><time>{{ s.createdAt | date: 'shortDate' }}</time></article>
          }
        } @else {
          <p class="none u-empty">NONE YET.</p>
        }
      }
    </div>
  `,
  styleUrl: './suggestions.scss',
})
export class GeneralSuggestions implements OnInit {
  private readonly db = inject(FIRESTORE);
  protected readonly text = signal('');
  protected readonly status = signal<{ text: string; tone: 'ok' | 'err' | '' }>({ text: '', tone: '' });
  protected readonly list = signal<GeneralSuggestion[] | null>(null);

  ngOnInit(): void { void this.load(); }

  private async load(): Promise<void> {
    try {
      const snap = await getDocs(query(collection(this.db, col('general_suggestions')), orderBy('createdAt', 'desc'), limit(20)));
      this.list.set(snap.docs.map(d => ({ ...(d.data() as Omit<GeneralSuggestion, 'id'>), id: d.id })));
    } catch (err) {
      console.error('Suggestions failed to load:', err);
      this.list.set([]);
    }
  }

  protected async submit(): Promise<void> {
    const text = this.text().trim();
    if (!text) { this.status.set({ text: 'WRITE SOMETHING FIRST.', tone: '' }); return; }
    try {
      await addDoc(collection(this.db, col('general_suggestions')), { text, createdAt: Date.now() });
      this.text.set('');
      this.status.set({ text: 'SUBMITTED!', tone: 'ok' });
      setTimeout(() => this.status.set({ text: '', tone: '' }), 3000);
      void this.load();
    } catch {
      this.status.set({ text: 'FAILED.', tone: 'err' });
    }
  }
}
