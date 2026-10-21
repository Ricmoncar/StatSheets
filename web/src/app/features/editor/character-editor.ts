import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { CharacterStore, genId } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { Baseline } from '../../core/data/merge';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { compressImage, readAsDataURL } from '../../core/media';
import {
  BASE_STAT_MAX, BASE_SUBSTAT_FIELDS, EditorDraft, FORM_NAME_MAX, FORM_STAT_MAX, FORM_SUBSTAT_FIELDS, FORMS_MAX,
  NAME_MAX, SOUL_SWATCHES, TAG_MAX_LEN, TAGS_MAX, addTag, buildCharacter, clampStat, draftFrom, newDraft, newForm, placeholderFrom,
} from '../../core/game/editor';
import { PatternCanvas } from '../../ui/pattern-canvas';
import { GENERIC_PATTERNS } from '../../core/game/patterns';
import { PL_TIERS, overallPowerLevel, statPowerLevel } from '../../core/game/sheet';
import { TRAITS } from '../../core/game/traits-data';
import { StatBar } from '../../ui/stat-bar';

const STAT_ROWS = [
  { key: 'hp', label: 'HP' }, { key: 'atk', label: 'ATTACK' }, { key: 'def', label: 'DEFENSE' },
  { key: 'mag', label: 'MAGIC' }, { key: 'spd', label: 'SPEED' }, { key: 'iq', label: 'IQ' },
] as const;
type StatKey = typeof STAT_ROWS[number]['key'];

/**
 * NEW CHARACTER / EDIT CHARACTER / RESUME DRAFT. Ported from showEditor,
 * saveCharacter, cancelEditor and the alt-form and tag editors.
 */
@Component({
  selector: 'ss-character-editor',
  imports: [StatBar, PatternCanvas],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './character-editor.html',
  styleUrl: './character-editor.scss',
})
export class CharacterEditor implements OnInit {
  private readonly store = inject(CharacterStore);
  private readonly router = inject(Router);
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);

  /** From /edit/:id; absent for /new */
  readonly id = input<string>();

  protected readonly d = signal<EditorDraft>(newDraft());
  protected readonly tagInput = signal('');
  protected readonly title = signal('NEW CHARACTER');

  protected readonly statRows = STAT_ROWS;
  protected readonly baseMax = BASE_STAT_MAX;
  protected readonly formMax = FORM_STAT_MAX;
  protected readonly subFields = BASE_SUBSTAT_FIELDS;
  protected readonly formSubFields = FORM_SUBSTAT_FIELDS;
  protected readonly swatches = SOUL_SWATCHES;
  protected readonly patterns = Object.entries(GENERIC_PATTERNS).map(([key, def]) => ({ key, label: def.label }));
  protected readonly limits = { name: NAME_MAX, tag: TAG_MAX_LEN, tags: TAGS_MAX, forms: FORMS_MAX, formName: FORM_NAME_MAX };

  protected readonly patternParams = computed(() => GENERIC_PATTERNS[this.d().pattern.type]?.params || []);
  protected readonly overall = computed(() => overallPowerLevel(this.d().stats as any));
  protected readonly formOverall = (i: number) => overallPowerLevel(this.d().forms[i].stats as any);
  protected readonly tierOf = (key: string, v: number) => PL_TIERS[statPowerLevel(key, v)];

  private editing: Character | null = null;
  private openedWith: Baseline | undefined;

  constructor() {
    // /edit/:id opened directly: wait for the characters to load, then fill the form once
    effect(() => {
      const id = this.id();
      if (!id || this.editing || this.store.status() === 'connecting') return;
      const c = this.store.byId().get(id);
      if (!c) { void this.router.navigate(['/']); return; }
      untracked(() => {
        this.editing = c;
        this.openedWith = this.store.baselineOf(c);
        this.title.set(c.isPlaceholder ? 'RESUME DRAFT' : 'EDIT CHARACTER');
        this.d.set(draftFrom(c));
      });
    });
  }

  ngOnInit(): void {
    if (!this.id()) this.store.clearDrafts();   // starting a new character drops older drafts
  }

  protected patch(p: Partial<EditorDraft>): void { this.d.update(d => ({ ...d, ...p })); }

  protected setStat(key: StatKey, val: unknown): void {
    this.d.update(d => ({ ...d, stats: { ...d.stats, [key]: clampStat(val, BASE_STAT_MAX[key]) } }));
  }
  protected setSub(key: string, val: unknown, max: number): void {
    const v = Math.max(0, Math.min(max, parseFloat(String(val)) || 0));
    this.d.update(d => ({ ...d, substats: { ...d.substats, [key]: v } }));
  }

  protected addTag(): void {
    const next = addTag(this.d().tags, this.tagInput());
    if (!next) return;
    this.patch({ tags: next });
    this.tagInput.set('');
  }
  protected removeTag(i: number): void { this.patch({ tags: this.d().tags.filter((_, j) => j !== i) }); }

  protected async pickAvatar(ev: Event, formIdx: number | null): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const url = await compressImage(await readAsDataURL(file), 512, 0.82);
    if (formIdx == null) this.patch({ avatar: url });
    else this.updateForm(formIdx, { avatar: url });
    input.value = '';
  }

  // ── forms ──
  protected addForm(): void {
    if (this.d().forms.length >= FORMS_MAX) return;
    this.patch({ forms: [...this.d().forms, newForm()] });
  }
  protected removeForm(i: number): void { this.patch({ forms: this.d().forms.filter((_, j) => j !== i) }); }
  protected updateForm(i: number, p: Partial<EditorDraft['forms'][number]>): void {
    this.patch({ forms: this.d().forms.map((f, j) => (j === i ? { ...f, ...p } : f)) });
  }
  protected setFormStat(i: number, key: StatKey, val: unknown): void {
    const f = this.d().forms[i];
    this.updateForm(i, { stats: { ...f.stats, [key]: clampStat(val, FORM_STAT_MAX[key] || 9999) } });
  }
  protected setFormSub(i: number, key: string, val: unknown): void {
    const f = this.d().forms[i];
    this.updateForm(i, { substats: { ...f.substats, [key]: +(val as number) || 0 } });
  }
  protected formTraitNames(keys: string[] | null): string {
    return (keys || []).map(k => TRAITS[k]?.name || k).join(', ');
  }

  // ── pattern ──
  protected setPattern(type: string): void { this.patch({ pattern: { type, params: {} } }); }
  protected setParam(id: string, raw: string, type: string): void {
    const v = type === 'range' ? parseFloat(raw) : raw;
    this.patch({ pattern: { ...this.d().pattern, params: { ...this.d().pattern.params, [id]: v } } });
  }
  protected paramValue(p: { id: string; default: unknown }): unknown {
    const v = this.d().pattern.params[p.id];
    return v !== undefined ? v : p.default;
  }

  // ── save / cancel ──
  protected save(): void {
    const draft = this.d();
    if (!draft.name.trim()) { this.notifier.notify('NAME REQUIRED!', 'err'); return; }
    const existing = this.editing && !this.editing.isPlaceholder ? (this.store.byId().get(this.editing.id) || this.editing) : (this.editing || {});
    const id = this.editing?.id || genId();
    const char = buildCharacter(existing, draft, id, Date.now());
    void this.store.saveFromEditor(char, this.editing && !this.editing.isPlaceholder ? this.openedWith : undefined);
    this.notifier.notify(this.editing && !this.editing.isPlaceholder ? 'CHARACTER UPDATED' : 'CHARACTER SAVED', 'ok');
    this.sound.play('save');
    if (char.name.toLowerCase() === 'gaster') setTimeout(() => this.sound.play('gaster', { volume: 0.9 }), 300);
    void this.router.navigate(['/c', id]);
  }

  protected cancel(): void {
    if (!this.editing) {
      // a cancelled NEW character is kept as a local draft
      this.store.keepDraft(placeholderFrom(this.d(), genId()));
      this.notifier.notify('DRAFT SAVED. CLICK IT TO RESUME', 'ok');
      void this.router.navigate(['/']);
      return;
    }
    if (this.editing.isPlaceholder) { void this.router.navigate(['/']); return; }
    void this.router.navigate(['/c', this.editing.id]);
  }
}
