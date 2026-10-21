import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CharacterStore } from '../../core/data/character-store';
import { Character, Folder } from '../../core/data/models';
import { ConfirmService } from '../../core/confirm.service';
import { NotifyService } from '../../core/notify.service';
import { SoundService } from '../../core/sound.service';
import { Icon } from '../../ui/icon';
import { Modal } from '../../ui/modal';
import { ChatModal } from '../chat/chat-modal';

interface FolderGroup { folder: Folder; chars: Character[] }
type DropCls = 'before' | 'after' | 'into';

const FOLDER_SWATCHES = ['#4a9eff', '#ff4a4a', '#4aff9e', '#ffcc4a', '#cc4aff', '#ff884a', '#4affee', '#ff4a88', '#ffffff'];
const FOLDER_NAME_MAX = 30;

/**
 * The character list: folders in their saved order, each with its characters,
 * then the characters in no folder. Typing in search shows one flat list of
 * name matches instead (case-insensitive), as on the old site.
 *
 * Characters and folders reorder by drag and drop; a right click (or the
 * menu key) on a character opens EDIT / DUPLICATE / DELETE / MOVE TO FOLDER.
 */
@Component({
  selector: 'ss-sidebar',
  imports: [NgTemplateOutlet, RouterLink, Modal, ChatModal, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'u-fr u-stone', '(document:click)': 'closeMenu()', '(document:keydown.escape)': 'closeMenu()' },
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly store = inject(CharacterStore);
  private readonly confirm = inject(ConfirmService);
  private readonly notifier = inject(NotifyService);
  private readonly sound = inject(SoundService);
  private readonly router = inject(Router);

  readonly activeId = input<string | null>(null);
  /**
   * Off while the list is a closed drawer on a phone: every avatar is a full
   * picture inside the character, and handing all of them to their images
   * cost a phone most of a second before anyone looked at the list.
   */
  readonly avatars = input(true);
  readonly pick = output<Character>();
  protected readonly query = signal('');
  /** Whose inbox is open. */
  protected readonly chatFor = signal<string | null>(null);

  protected readonly matches = computed(() => {
    const q = this.query().toLowerCase();
    return this.store.characters().filter(c => c.name?.toLowerCase().includes(q));
  });

  protected readonly groups = computed<FolderGroup[]>(() => {
    const chars = this.store.characters();
    return this.store.folders().map(folder => ({ folder, chars: chars.filter(c => c.folderId === folder.id) }));
  });

  /** Characters in no folder. Unlike the old site, a character whose folder was deleted shows up here instead of vanishing. */
  protected readonly unfiled = computed(() => {
    const ids = new Set(this.store.folders().map(f => f.id));
    return this.store.characters().filter(c => !c.folderId || !ids.has(c.folderId));
  });

  protected link(c: Character): string[] {
    return c.isPlaceholder ? ['/edit', c.id] : ['/c', c.id];
  }

  protected toggleFolder(f: Folder): void {
    void this.store.setFolderCollapsed(f.id, !f['collapsed']);
  }

  // ── drag and drop: one highlighted target at a time ──
  private drag: { kind: 'char' | 'folder'; id: string } | null = null;
  protected readonly drop = signal<{ id: string; cls: DropCls } | null>(null);
  protected readonly dragging = signal<string | null>(null);

  protected dragStart(e: DragEvent, kind: 'char' | 'folder', id: string): void {
    e.stopPropagation();
    this.drag = { kind, id };
    e.dataTransfer?.setData('text/plain', kind === 'folder' ? 'folder:' + id : id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    // after this frame, so the drag image is the solid row and not the faded one
    requestAnimationFrame(() => this.dragging.set(id));
  }

  protected dragEnd(): void {
    this.drag = null;
    this.dragging.set(null);
    this.drop.set(null);
  }

  /** Over a character: drop above or below it (folders pass straight through). */
  protected overEntry(e: DragEvent, c: Character): void {
    if (this.drag?.kind !== 'char') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    this.setDrop(c.id, this.half(e));
  }

  protected dropOnEntry(e: DragEvent, c: Character, folderId: string | null): void {
    if (this.drag?.kind !== 'char') return;
    e.preventDefault();
    e.stopPropagation();
    const after = this.drop()?.id === c.id && this.drop()?.cls === 'after';
    const from = this.drag.id;
    this.dragEnd();
    this.store.moveCharacter(from, c.id, after, folderId);
  }

  /** Over a folder: a folder drag reorders (on its header), a character drag files it there. */
  protected overFolder(e: DragEvent, f: Folder, onHeader: boolean): void {
    if (!this.drag) return;
    e.preventDefault();
    e.stopPropagation();
    if (this.drag.kind === 'folder') {
      if (onHeader && f.id !== this.drag.id) this.setDrop('folder:' + f.id, this.half(e));
    } else {
      this.setDrop('folder:' + f.id, 'into');
    }
  }

  protected dropOnFolder(e: DragEvent, f: Folder): void {
    if (!this.drag) return;
    e.preventDefault();
    e.stopPropagation();
    const { kind, id } = this.drag;
    const after = this.drop()?.id === 'folder:' + f.id && this.drop()?.cls === 'after';
    this.dragEnd();
    if (kind === 'folder') this.store.moveFolder(id, f.id, after);
    else this.store.moveCharacter(id, null, false, f.id);
  }

  protected dropClass(id: string): DropCls | null {
    const d = this.drop();
    return d && d.id === id ? d.cls : null;
  }

  private half(e: DragEvent): DropCls {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY - r.top < r.height / 2 ? 'before' : 'after';
  }

  private setDrop(id: string, cls: DropCls): void {
    const d = this.drop();
    if (!d || d.id !== id || d.cls !== cls) this.drop.set({ id, cls });
  }

  // ── the right-click menu ──
  protected readonly menu = signal<{ char: Character; x: number; y: number } | null>(null);
  private readonly menuEl = viewChild<ElementRef<HTMLElement>>('menuEl');

  protected openMenu(e: MouseEvent, c: Character): void {
    e.preventDefault();
    e.stopPropagation();
    // keyboard (menu key, shift+F10) reports 0,0: open by the row instead
    let { clientX: x, clientY: y } = e;
    if (!x && !y) { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); x = r.left + 24; y = r.bottom; }
    this.menu.set({ char: c, x, y });
    // flip away from the edges once it has a size, then focus the first item
    requestAnimationFrame(() => {
      const el = this.menuEl()?.nativeElement;
      if (!el) return;
      const { offsetWidth: w, offsetHeight: h } = el;
      this.menu.update(m => m && { ...m, x: x + w > innerWidth ? Math.max(0, x - w) : x, y: y + h > innerHeight ? Math.max(0, y - h) : y });
      el.querySelector<HTMLElement>('button')?.focus();
    });
  }

  protected closeMenu(): void {
    if (this.menu()) this.menu.set(null);
  }

  protected menuKeys(e: KeyboardEvent): void {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(this.menuEl()?.nativeElement.querySelectorAll<HTMLElement>('button') || [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }

  protected menuEdit(c: Character): void {
    this.closeMenu();
    void this.router.navigate(['/edit', c.id]);
  }

  protected menuDuplicate(c: Character): void {
    this.closeMenu();
    const copy = this.store.duplicate(c.id);
    if (copy) this.notifier.notify(`"${copy.name}" CREATED`, 'ok');
  }

  protected async menuDelete(c: Character): Promise<void> {
    this.closeMenu();
    if (!(await this.confirm.ask(`DELETE "${c.name}"?\n\nThis cannot be undone.`))) return;
    this.sound.play('delete');
    this.notifier.notify('DELETED', 'err');
    if (c.id === this.activeId()) await this.router.navigate(['/']);
    void this.store.remove(c.id);
  }

  protected menuMove(c: Character, folderId: string | null): void {
    this.closeMenu();
    if ((c.folderId || null) === folderId) return;
    void this.store.update(c.id, x => { x.folderId = folderId; });
  }

  // ── the folder window ──
  protected readonly swatches = FOLDER_SWATCHES;
  protected readonly nameMax = FOLDER_NAME_MAX;
  protected readonly folderForm = signal<{ id: string | null; name: string; color: string } | null>(null);

  protected newFolder(): void {
    this.folderForm.set({ id: null, name: '', color: '#4a9eff' });
    this.focusName();
  }

  protected editFolder(f: Folder): void {
    this.folderForm.set({ id: f.id, name: f.name || '', color: f.color || '#4a9eff' });
    this.focusName();
  }

  private focusName(): void {
    setTimeout(() => document.querySelector<HTMLInputElement>('.folder-form input[type=text]')?.focus(), 30);
  }

  protected patchFolder(fields: Partial<{ name: string; color: string }>): void {
    this.folderForm.update(f => f && { ...f, ...fields });
  }

  protected async saveFolder(): Promise<void> {
    const f = this.folderForm();
    if (!f) return;
    this.folderForm.set(null);
    try {
      await this.store.saveFolder(f.id, f.name.trim() || 'New Folder', f.color || '#4a9eff');
    } catch (err) {
      console.error('Folder save failed:', err);
      this.notifier.notify('SAVE FAILED', 'err');
    }
  }

  protected async deleteFolder(f: Folder): Promise<void> {
    if (!(await this.confirm.ask('Delete this folder? Characters inside will become ungrouped.'))) return;
    await this.store.deleteFolder(f.id);
  }
}
