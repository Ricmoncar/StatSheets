import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CharacterStore, genId } from '../../core/data/character-store';
import { Character, ItemMod } from '../../core/data/models';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { compressImage, readAsDataURL, uploadMedia } from '../../core/media';
import { ICON_CATEGORIES, ITEM_ICONS } from '../../core/game/item-icons';
import { ITEM_NAME_MAX, MOD_OPS, MOD_STATS, NEW_MOD, PASSIVE_MAX, iconHue, saveItem } from '../../core/game/items';
import { CldSrc } from '../../ui/cld-src';
import { Modal } from '../../ui/modal';

/**
 * NEW ITEM / EDIT ITEM: name, description, an emoji icon or an uploaded image,
 * stat modifiers and free-text passives. Uploaded icons go to Cloudinary; if
 * that fails, a small compressed copy is kept inline instead (as before).
 */
@Component({
  selector: 'ss-item-editor',
  imports: [Modal, CldSrc],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './item-editor.html',
  styleUrl: './item-editor.scss',
})
export class ItemEditor implements OnInit {
  private readonly store = inject(CharacterStore);
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);

  readonly character = input.required<Character>();
  readonly itemId = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly categories = ICON_CATEGORIES;
  protected readonly icons = ITEM_ICONS;
  protected readonly stats = MOD_STATS;
  protected readonly ops = MOD_OPS;
  protected readonly nameMax = ITEM_NAME_MAX;
  protected readonly passiveMax = PASSIVE_MAX;
  protected readonly hue = iconHue;

  protected readonly name = signal('');
  protected readonly desc = signal('');
  protected readonly icon = signal<string | null>('sword');
  protected readonly iconImage = signal<string | null>(null);
  protected readonly iconLabel = signal('SWORD');
  protected readonly uploading = signal(false);
  protected readonly mods = signal<ItemMod[]>([]);
  protected readonly passives = signal<string[]>([]);
  private uploadToken = 0;

  ngOnInit(): void {
    const item = this.itemId() ? (this.character().inventory || []).find(i => i.id === this.itemId()) : null;
    this.name.set(item?.name || '');
    this.desc.set(item?.desc || '');
    this.icon.set(item ? (item.icon || 'sword') : 'sword');
    this.iconImage.set(item?.iconImage || null);
    this.iconLabel.set(this.iconImage() ? 'CUSTOM UPLOAD' : (this.icon() || '').toUpperCase());
    this.mods.set(JSON.parse(JSON.stringify(item?.mods || [])));
    this.passives.set([...((item?.passives || []) as string[])]);
  }

  protected pickIcon(key: string): void {
    this.icon.set(key);
    this.iconImage.set(null);
    this.iconLabel.set(key.toUpperCase());
  }

  protected async upload(ev: Event): Promise<void> {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const token = ++this.uploadToken;
    this.uploading.set(true);
    this.icon.set(null);
    this.iconLabel.set('UPLOADING...');
    const done = (img: string | null, text: string) => {
      if (token !== this.uploadToken) return;   // the editor moved on
      this.uploading.set(false);
      this.iconImage.set(img);
      this.iconLabel.set(text);
    };
    try {
      done(await uploadMedia(file, 'image', 'items/' + this.character().id + '_' + Date.now()), 'CUSTOM UPLOAD');
    } catch {
      try { done(await compressImage(await readAsDataURL(file), 256, 0.85), 'CUSTOM UPLOAD (OFFLINE COPY)'); }
      catch { done(null, 'UPLOAD FAILED'); this.notifier.notify('IMAGE UPLOAD FAILED', 'err'); }
    }
  }

  protected setMod(i: number, patch: Partial<ItemMod>): void {
    this.mods.update(ms => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  }
  protected addMod(): void { this.mods.update(ms => [...ms, { ...NEW_MOD }]); }
  protected removeMod(i: number): void { this.mods.update(ms => ms.filter((_, j) => j !== i)); }

  protected setPassive(i: number, v: string): void { this.passives.update(ps => ps.map((p, j) => (j === i ? v : p))); }
  protected addPassive(): void { this.passives.update(ps => [...ps, '']); }
  protected removePassive(i: number): void { this.passives.update(ps => ps.filter((_, j) => j !== i)); }

  protected save(): void {
    if (this.uploading()) { this.notifier.notify('WAIT FOR THE IMAGE TO FINISH UPLOADING', 'err'); return; }
    let error: string | null = null as string | null;
    const draft = { name: this.name(), desc: this.desc(), icon: this.icon(), iconImage: this.iconImage(), mods: this.mods(), passives: this.passives() };
    if (!draft.name.trim()) { this.notifier.notify('Item needs a name!', 'err'); return; }
    void this.store.update(this.character().id, c => {
      const r = saveItem(c, draft, this.itemId(), genId());
      if ('error' in r) error = r.error;
    });
    if (error) { this.notifier.notify(error, 'err'); return; }
    this.sound.play('save');
    this.notifier.notify('ITEM SAVED', 'ok');
    this.closed.emit();
  }
}
