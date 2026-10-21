import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CharacterStore } from '../../core/data/character-store';
import { Character, Folder } from '../../core/data/models';

interface FolderGroup { folder: Folder; chars: Character[] }

/**
 * The character list: folders in their saved order, each with its characters,
 * then the characters in no folder. Typing in search shows one flat list of
 * name matches instead (case-insensitive), as on the old site.
 */
@Component({
  selector: 'ss-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <span class="title">// CHARACTERS</span>
    </div>
    <input class="search" type="search" placeholder="SEARCH..." aria-label="Search characters"
           [value]="query()" (input)="query.set($any($event.target).value)" />

    <div class="list" role="list">
      @if (store.status() === 'connecting') {
        <p class="empty">CONNECTING...</p>
      } @else if (query()) {
        @for (c of matches(); track c.id) {
          <ng-container *ngTemplateOutlet="entry; context: { $implicit: c }" />
        } @empty {
          <p class="empty">-- NO RESULTS --</p>
        }
      } @else {
        @for (g of groups(); track g.folder.id) {
          <div class="folder" [style.--folder]="g.folder.color || '#888'">
            <button class="folder-head" type="button" (click)="toggleFolder(g.folder)" [attr.aria-expanded]="!g.folder['collapsed']">
              <span class="caret">{{ g.folder['collapsed'] ? '&#9654;' : '&#9660;' }}</span>
              <span class="folder-name">{{ g.folder.name }}</span>
              <span class="count">({{ g.chars.length }})</span>
            </button>
            @if (!g.folder['collapsed']) {
              @for (c of g.chars; track c.id) {
                <ng-container *ngTemplateOutlet="entry; context: { $implicit: c }" />
              }
            }
          </div>
        }
        @for (c of store.drafts(); track c.id) {
          <ng-container *ngTemplateOutlet="entry; context: { $implicit: c }" />
        }
        @for (c of unfiled(); track c.id) {
          <ng-container *ngTemplateOutlet="entry; context: { $implicit: c }" />
        }
        @if (!store.characters().length && !store.folders().length) {
          <p class="empty">-- EMPTY --</p>
        }
      }
    </div>

    <ng-template #entry let-c>
      <button class="entry" type="button" role="listitem" data-sfx-silent data-sfx-hover
              [class.active]="c.id === activeId()" [class.draft]="c.isPlaceholder"
              [style.--char]="c.color || '#fff'" (click)="pick.emit(c)">
        <span class="avatar">
          @if (c.avatar) { <img [src]="c.avatar" alt="" loading="lazy" /> }
          @else { <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="12" y="2" width="8" height="8"/><rect x="10" y="10" width="12" height="10"/><rect x="8" y="20" width="6" height="8"/><rect x="18" y="20" width="6" height="8"/></svg> }
        </span>
        <span class="info">
          <span class="name">{{ c.name || 'UNNAMED' }}@if (c.isPlaceholder) { <small> [DRAFT]</small> }</span>
          @if (c.tags?.length) {
            <span class="tags">@for (t of c.tags; track t) { <span class="tag">{{ t }}</span> }</span>
          }
        </span>
      </button>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  protected readonly store = inject(CharacterStore);
  readonly activeId = input<string | null>(null);
  readonly pick = output<Character>();
  protected readonly query = signal('');

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

  protected toggleFolder(f: Folder): void {
    void this.store.setFolderCollapsed(f.id, !f['collapsed']);
  }
}

