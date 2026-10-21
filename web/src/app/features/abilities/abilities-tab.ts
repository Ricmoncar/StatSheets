import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { readAsDataURL } from '../../core/media';
import {
  AB_IMAGE_MAX_MB, AB_META, AB_TYPES, AB_TYPE_ORDER, AbilityDraft, AbilityType, PASSIVE_MAX, TEXT_COLORS,
  abilityId, abilityTags, applyColor, emptyAbility, isHexColor, saveAbility,
} from '../../core/game/abilities';
import { CldSrc } from '../../ui/cld-src';
import { ColorText } from '../../ui/color-text';
import { Modal } from '../../ui/modal';
import { Icon } from '../../ui/icon';

/**
 * The ABILITIES tab: character passives (free text) and ability cards, with
 * the ability editor and the text colour toolbar (select text in a
 * description to colour it).
 */
@Component({
  selector: 'ss-abilities-tab',
  imports: [Modal, CldSrc, ColorText, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './abilities-tab.html',
  styleUrl: './abilities-tab.scss',
})
export class AbilitiesTab {
  private readonly store = inject(CharacterStore);
  private readonly notifier = inject(NotifyService);

  readonly character = input.required<Character>();
  protected readonly types = AB_TYPES;
  protected readonly typeOrder = AB_TYPE_ORDER;
  protected readonly meta = AB_META;
  protected readonly colors = TEXT_COLORS;
  protected readonly passiveMax = PASSIVE_MAX;
  protected readonly tagsOf = abilityTags;

  protected readonly abilities = computed(() => this.character().abilities || []);
  protected readonly passives = computed(() => (this.character().charPassives || []) as string[]);

  // ── editor ──
  protected readonly editIdx = signal<number | null | 'new'>(null);
  protected readonly draft = signal<AbilityDraft>(emptyAbility());

  protected typeOf(t: unknown): (typeof AB_TYPES)[AbilityType] {
    return AB_TYPES[t as AbilityType] || AB_TYPES.ACTIVE;
  }

  protected openEditor(idx: number | null): void {
    const ab = idx != null ? this.abilities()[idx] : null;
    const s = (v: unknown) => (v == null ? '' : String(v));
    this.draft.set(ab ? {
      name: s(ab.name), type: (ab.type as AbilityType) || 'ACTIVE', desc: s(ab.desc), notes: s(ab.notes), cost: s(ab.cost), cd: s(ab.cd),
      range: s(ab.range), cast: s(ab.cast), tags: Array.isArray(ab.tags) ? ab.tags.join(', ') : s(ab.tags), dmg: s(ab.dmg),
      duration: s(ab.duration), req: s(ab.req), image: ab.image || null,
    } : emptyAbility());
    this.editIdx.set(idx == null ? 'new' : idx);
  }
  protected closeEditor(): void { this.editIdx.set(null); this.toolbar.set(null); }
  protected set<K extends keyof AbilityDraft>(k: K, v: AbilityDraft[K]): void { this.draft.update(d => ({ ...d, [k]: v })); }

  protected async pickImage(ev: Event): Promise<void> {
    const inp = ev.target as HTMLInputElement;
    const file = inp.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.notifier.notify('NOT AN IMAGE', 'err'); return; }
    if (file.size > AB_IMAGE_MAX_MB * 1024 * 1024) { this.notifier.notify(`IMAGE TOO LARGE (MAX ${AB_IMAGE_MAX_MB} MB)`, 'err'); return; }
    this.set('image', await readAsDataURL(file));
  }

  protected save(): void {
    const idx = this.editIdx();
    const at = idx === 'new' ? null : idx;
    let err: string | null = null as string | null;
    const d = this.draft();
    if (!(d.name || '').trim()) { this.notifier.notify('ABILITY NEEDS A NAME', 'err'); return; }
    void this.store.update(this.character().id, c => { err = saveAbility(c, d, at, abilityId()); });
    if (err) { this.notifier.notify(err, 'err'); return; }
    this.notifier.notify(at != null ? 'ABILITY UPDATED' : 'ABILITY ADDED', 'ok');
    this.closeEditor();
  }

  protected remove(idx: number): void {
    void this.store.update(this.character().id, c => { (c.abilities || []).splice(idx, 1); });
    this.notifier.notify('ABILITY REMOVED', 'ok');
  }

  // ── passives ──
  protected addPassive(): void {
    void this.store.update(this.character().id, c => { c.charPassives = [...((c.charPassives || []) as string[]), '']; });
  }
  protected removePassive(i: number): void {
    void this.store.update(this.character().id, c => { (c.charPassives as string[] || []).splice(i, 1); });
  }
  protected setPassive(i: number, v: string): void {
    void this.store.update(this.character().id, c => { const p = (c.charPassives || []) as string[]; p[i] = v; c.charPassives = p; });
  }

  // ── text colour toolbar ──
  protected readonly toolbar = signal<{ x: number; y: number; field: 'desc' | 'notes'; start: number; end: number } | null>(null);
  protected readonly hex = signal('');

  protected onSelect(ev: MouseEvent, field: 'desc' | 'notes'): void {
    const ta = ev.target as HTMLTextAreaElement;
    if (ta.selectionEnd - ta.selectionStart < 1) { this.toolbar.set(null); return; }
    const x = Math.max(8, Math.min(ev.clientX - 8, window.innerWidth - 240));
    const y = ev.clientY - 94 < 8 ? ev.clientY + 18 : ev.clientY - 94;
    this.toolbar.set({ x, y, field, start: ta.selectionStart, end: ta.selectionEnd });
  }

  protected colour(color: string | null): void {
    const t = this.toolbar();
    if (!t) return;
    const r = applyColor(String(this.draft()[t.field] || ''), t.start, t.end, color);
    this.set(t.field, r.text);
    this.toolbar.set(null);
  }

  protected colourCustom(): void {
    const v = this.hex().trim();
    if (!isHexColor(v)) { this.notifier.notify('INVALID HEX COLOR', 'err'); return; }
    this.colour(v);
    this.hex.set('');
  }
}
