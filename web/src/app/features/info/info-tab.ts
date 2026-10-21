import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CharacterStore } from '../../core/data/character-store';
import { Character } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { uploadMedia } from '../../core/media';
import {
  INFO_LINE_FIELDS, INFO_TEXT_FIELDS, LinkList, MEDIA_MAX_MB, MediaLink,
  affiliationPieces, hasGlitch, platformOf, renderMarkdown, youTubeId,
} from '../../core/game/info';
import { LiveField } from '../../ui/live-field';
import { SoulView } from '../soul/soul-view';
import { normalizeSoul, soulPrimary } from '../../core/game/soul';

/** The INFO tab: the character's dossier. Every field saves as you type. */
@Component({
  selector: 'ss-info-tab',
  imports: [LiveField, SoulView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './info-tab.html',
  styleUrl: './info-tab.scss',
})
export class InfoTab {
  private readonly store = inject(CharacterStore);
  private readonly notifier = inject(NotifyService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly character = input.required<Character>();
  readonly openSoul = output<void>();

  protected readonly lines = INFO_LINE_FIELDS;
  protected readonly texts = INFO_TEXT_FIELDS;
  protected readonly info = computed(() => (this.character().info || {}) as Record<string, any>);
  protected readonly soul = computed(() => normalizeSoul(this.info()['soul']));
  protected readonly soulName = computed(() => this.soul().name || 'Vessel');
  protected readonly soulColor = computed(() => soulPrimary(this.soul()));

  /** Which markdown fields are showing their preview. */
  protected readonly preview = signal<Record<string, boolean>>({});
  protected readonly editingAffiliation = signal(false);
  protected readonly showGlitch = computed(() => !this.editingAffiliation() && hasGlitch(this.info()['affiliation']));
  protected readonly affiliation = computed(() => affiliationPieces(this.info()['affiliation'] || ''));
  /** YouTube players open per "list:index". */
  protected readonly playing = signal<Record<string, boolean>>({});

  protected readonly md = renderMarkdown;
  protected readonly platform = platformOf;
  protected readonly ytId = youTubeId;

  protected links(key: LinkList): MediaLink[] {
    return (this.info()[key] || []) as MediaLink[];
  }

  protected save(key: string, val: string): void {
    void this.store.update(this.character().id, c => { c.info = c.info || {}; (c.info as any)[key] = val; });
  }

  protected togglePreview(key: string): void {
    this.preview.update(p => ({ ...p, [key]: !p[key] }));
  }

  // ── media links ──
  protected addLink(key: LinkList): void {
    void this.store.update(this.character().id, c => {
      c.info = c.info || {};
      const list = ((c.info as any)[key] = (c.info as any)[key] || []);
      list.push({ title: '', url: '', note: '' });
    });
  }
  protected removeLink(key: LinkList, idx: number): void {
    void this.store.update(this.character().id, c => { ((c.info as any)?.[key] || []).splice(idx, 1); });
  }
  protected updateLink(key: LinkList, idx: number, field: 'title' | 'url' | 'note', val: string): void {
    void this.store.update(this.character().id, c => {
      const l = (c.info as any)?.[key]?.[idx];
      if (l) l[field] = val;
    });
    if (field === 'url' && !youTubeId(val)) this.playing.update(p => ({ ...p, [key + ':' + idx]: false }));
  }
  protected togglePlay(key: LinkList, idx: number): void {
    this.playing.update(p => ({ ...p, [key + ':' + idx]: !p[key + ':' + idx] }));
  }
  /** Only ever a youtube.com/embed URL built from a validated 11-character id. */
  protected embed(url: string): SafeResourceUrl | null {
    const id = youTubeId(url);
    return id ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${id}?autoplay=1`) : null;
  }

  protected async uploadClip(idx: number, ev: Event): Promise<void> {
    const inp = ev.target as HTMLInputElement;
    const file = inp.files?.[0];
    inp.value = '';
    if (!file) return;
    if (file.size > MEDIA_MAX_MB * 1024 * 1024) { this.notifier.notify(`File too large: max ${MEDIA_MAX_MB} MB`, 'err'); return; }
    const id = this.character().id;
    this.notifier.notify('Uploading voice clip...', 'ok');
    try {
      const url = await uploadMedia(file, 'video', `voiceclaims/${id}_${idx}_${Date.now()}`);
      void this.store.update(id, c => {
        const l = (c.info as any)?.voiceclaims?.[idx];
        if (l) { l.audio = url; l.fileName = file.name.replace(/\.[^/.]+$/, ''); }
      });
      this.notifier.notify('Voice clip added', 'ok');
    } catch (err) {
      console.warn('[VoiceClaim] upload failed:', err);
      this.notifier.notify('Upload failed: try again', 'err');
    }
  }
  protected clearClip(idx: number): void {
    void this.store.update(this.character().id, c => {
      const l = (c.info as any)?.voiceclaims?.[idx];
      if (l) { delete l.audio; delete l.fileName; }
    });
  }
}
