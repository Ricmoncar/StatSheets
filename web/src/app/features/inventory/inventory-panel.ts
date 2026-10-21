import { ChangeDetectionStrategy, Component, Injectable, computed, inject, input, signal } from '@angular/core';
import { CharacterStore, genId } from '../../core/data/character-store';
import { Character, InventoryItem } from '../../core/data/models';
import { ConfirmService } from '../../core/confirm.service';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { ITEM_ICONS } from '../../core/game/item-icons';
import { deleteItem, iconHue, modTag, pasteItem, toggleEquip } from '../../core/game/items';
import { CldSrc } from '../../ui/cld-src';
import { ItemEditor } from './item-editor';
import { Icon } from '../../ui/icon';

/** The copied item, kept for the session so it can be pasted onto any character. */
@Injectable({ providedIn: 'root' })
export class ItemClipboard {
  readonly item = signal<InventoryItem | null>(null);
}

/** Item cards with equip, copy, edit and delete, plus ADD ITEM and PASTE. */
@Component({
  selector: 'ss-inventory-panel',
  imports: [CldSrc, ItemEditor, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar">
      <button type="button" class="u-btn primary sm" (click)="editing.set('new')"><ss-icon name="plus" />ADD ITEM</button>
      @if (clip.item(); as it) { <button type="button" class="u-btn sm paste" (click)="paste()"><ss-icon name="bag" />PASTE "{{ it.name }}"</button> }
    </div>
    @if (items().length) {
      <div class="grid">
        @for (i of items(); track i.id) {
          <div class="item u-fr" [class.u-slate]="!i.equipped" [class.u-crystal]="i.equipped" [class.equipped]="i.equipped" [style.--hc]="hue(i.icon)" data-sfx-hover>
            <div class="pic">
              @if (i.iconImage) { <img [ssCldSrc]="i.iconImage" alt="" /> }
              @else if (i.icon && icons[i.icon]) { <span class="emoji">{{ icons[i.icon] }}</span> }
              @else { <span class="q">?</span> }
            </div>
            <div class="info">
              <span class="name">{{ i.name || 'Unnamed Item' }}</span>
              @if (i.desc) { <span class="desc">{{ i.desc }}</span> }
            </div>
            @if (i.mods?.length || i.passives?.length) {
              <span class="mods">
                @for (m of i.mods; track $index) { <span class="mod" [attr.data-op]="m.op">{{ tag(m) }}</span> }
                @for (p of i.passives; track $index) { @if (p) { <span class="passive">{{ p }}</span> } }
              </span>
            }
            <div class="foot">
              <button type="button" class="equip u-btn sm" [class.primary]="i.equipped" (click)="equip(i)">
                <i class="u-spr" [class.s-gem-s]="i.equipped" [class.s-gem-off]="!i.equipped" aria-hidden="true"></i>{{ i.equipped ? 'UNEQUIP' : 'EQUIP' }}
              </button>
              <div class="tools">
                <button type="button" class="tool u-btn icon sm" (click)="copy(i)" title="Copy item" aria-label="Copy item"><ss-icon name="bag" [soul]="false" /></button>
                <button type="button" class="tool u-btn icon sm" (click)="editing.set(i.id)" title="Edit" aria-label="Edit item"><ss-icon name="pencil" [soul]="false" /></button>
                <button type="button" class="tool danger u-btn icon sm" (click)="remove(i)" title="Delete" aria-label="Delete item"><ss-icon name="trash" [soul]="false" /></button>
              </div>
            </div>
          </div>
        }
      </div>
    } @else {
      <div class="none u-empty"><i class="u-spr s-soul soulf" aria-hidden="true"></i>NO ITEMS IN INVENTORY</div>
    }
    @if (editing(); as e) {
      <ss-item-editor [character]="character()" [itemId]="e === 'new' ? null : e" (closed)="editing.set(null)" />
    }
  `,
  styleUrl: './inventory-panel.scss',
})
export class InventoryPanel {
  private readonly store = inject(CharacterStore);
  private readonly sound = inject(SoundService);
  private readonly notifier = inject(NotifyService);
  private readonly confirm = inject(ConfirmService);
  protected readonly clip = inject(ItemClipboard);

  readonly character = input.required<Character>();
  protected readonly items = computed(() => this.character().inventory || []);
  protected readonly editing = signal<string | null>(null);
  protected readonly icons = ITEM_ICONS;
  protected readonly hue = iconHue;
  protected readonly tag = modTag;

  protected equip(i: InventoryItem): void {
    let on: boolean | null = null as boolean | null;
    void this.store.update(this.character().id, c => { on = toggleEquip(c, i.id); });
    if (on !== null) this.sound.play('equip', { rate: on ? 1.05 : 0.88, volume: 0.85 });
  }

  protected copy(i: InventoryItem): void {
    this.clip.item.set(JSON.parse(JSON.stringify(i)));
    this.notifier.notify(`"${i.name}" COPIED`, 'ok');
  }

  protected paste(): void {
    const it = this.clip.item();
    if (!it) return;
    void this.store.update(this.character().id, c => { pasteItem(c, it, genId()); });
    this.notifier.notify(`"${it.name}" PASTED`, 'ok');
  }

  protected async remove(i: InventoryItem): Promise<void> {
    if (!(await this.confirm.ask('Delete this item?'))) return;
    this.sound.play('delete');
    void this.store.update(this.character().id, c => deleteItem(c, i.id));
  }
}
