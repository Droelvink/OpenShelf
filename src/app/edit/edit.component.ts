import {
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ItemsService } from '../shared/services/items.service';
import { PreferencesService } from '../shared/services/preferences.service';
import { ShelfItem, ITEM_TYPE_LABELS, ITEM_TYPE_ABBR } from '../shared/models/shelf-item.model';
import { ItemFormComponent } from './item-form/item-form.component';
import { PreferencesComponent } from './preferences/preferences.component';

@Component({
  selector: 'app-edit',
  imports: [ItemFormComponent, PreferencesComponent],
  template: `
    <div class="edit-root">
      <!-- Header -->
      <header class="topbar">
        <div class="topbar-brand">
          <span class="brand-icon">◧</span>
          <span class="brand-name">OpenShelf</span>
        </div>
        <div class="topbar-actions">
          <div class="search-wrap">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              class="filter-input"
              type="text"
              placeholder="Filter items…"
              [value]="filterQuery()"
              (input)="filterQuery.set($any($event.target).value)"
              aria-label="Filter items"
            />
          </div>
          <button class="btn btn-ghost" (click)="showPrefs.set(true)" aria-label="Preferences">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>
          <button class="btn btn-primary" (click)="openAdd()" aria-label="Add new item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Item
          </button>
        </div>
      </header>

      <!-- Item list -->
      <main class="item-list-wrap">
        @if (loading()) {
          <div class="state-msg">Loading…</div>
        } @else if (filteredItems().length === 0 && !filterQuery()) {
          <div class="empty-state">
            <div class="empty-icon">◧</div>
            <h2>Your shelf is empty</h2>
            <p>Add folders, files, websites, or YouTube links and open them instantly with your shortcut.</p>
            <button class="btn btn-primary" (click)="openAdd()">Add your first item</button>
          </div>
        } @else if (filteredItems().length === 0) {
          <div class="state-msg">No items match "{{ filterQuery() }}"</div>
        } @else {
          <div class="item-list" role="list">
            @for (item of filteredItems(); track item.id) {
              <div class="item-row" role="listitem">
                <span class="type-badge" [attr.title]="typeLabel(item.type)" aria-hidden="true">
                  @if (icons().get(item.id); as iconSrc) {
                    <img class="item-icon" [src]="iconSrc" alt="" />
                  } @else if (item.type === 'youtube') {
                    <svg class="type-icon" viewBox="0 0 24 24">
                      <path fill="#ff4545" d="M22.54 6.42a2.78 2.78 0 0 0-1.96-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                      <polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
                    </svg>
                  } @else if (item.type === 'website') {
                    <svg class="type-icon" viewBox="0 0 24 24" fill="none" stroke="#00c896" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  } @else {
                    <span class="type-abbr">{{ typeAbbr(item.type) }}</span>
                  }
                </span>

                <div class="item-info">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-path">{{ item.path }}</span>
                </div>

                <div class="item-tags">
                  @for (tag of item.tags; track tag) {
                    <span class="chip">{{ tag }}</span>
                  }
                </div>

                <div class="item-actions">
                  <button
                    class="btn-icon"
                    (click)="openEdit(item)"
                    [attr.aria-label]="'Edit ' + item.name"
                    title="Edit"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    class="btn-icon danger"
                    (click)="confirmDelete(item)"
                    [attr.aria-label]="'Delete ' + item.name"
                    title="Delete"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </main>

      <!-- Delete confirm bar -->
      @if (pendingDelete()) {
        <div class="delete-bar" role="alert">
          <span>Delete <strong>{{ pendingDelete()!.name }}</strong>?</span>
          <div class="delete-bar-actions">
            <button class="btn btn-ghost" (click)="pendingDelete.set(null)">Cancel</button>
            <button class="btn btn-danger" (click)="doDelete()">Delete</button>
          </div>
        </div>
      }
    </div>

    <!-- Modals -->
    @if (showForm()) {
      <app-item-form
        [editItem]="editingItem()"
        (closed)="closeForm()"
        (saved)="onSaved()"
      />
    }

    @if (showPrefs()) {
      <app-preferences (closed)="showPrefs.set(false)" />
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      background: #121212;
    }

    .edit-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #121212;
    }

    /* Topbar */
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      height: 58px;
      background: #181818;
      border-bottom: 1px solid #2a2a2a;
      flex-shrink: 0;
    }

    .topbar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 15px;
      color: var(--text-primary);
    }

    .brand-icon {
      font-size: 20px;
      color: var(--accent);
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .search-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 10px;
      width: 14px;
      height: 14px;
      color: var(--text-dim);
      pointer-events: none;
    }

    .filter-input {
      width: 200px;
      padding: 6px 12px 6px 30px;
      background: #282828;
      border: 1px solid #3e3e3e;
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 13px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;

      &::placeholder { color: var(--text-dim); }
      &:focus { border-color: var(--accent); }
    }

    /* Item list */
    .item-list-wrap {
      flex: 1;
      overflow-y: auto;
    }

    .state-msg {
      text-align: center;
      color: var(--text-dim);
      padding: 60px 0;
      font-size: 13px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 80px 20px;
      text-align: center;
    }

    .empty-icon {
      font-size: 40px;
      color: var(--text-dim);
      margin-bottom: 8px;
    }

    .empty-state h2 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .empty-state p {
      font-size: 13px;
      color: var(--text-secondary);
      max-width: 320px;
      line-height: 1.6;
    }

    .item-list {
      display: flex;
      flex-direction: column;
      padding: 4px 0;
    }

    .item-row {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 52px;
      padding: 0 16px;
      transition: background 0.08s;
      cursor: default;

      &:hover { background: #282828; }
    }

    .type-badge {
      width: 36px;
      height: 36px;
      border-radius: 4px;
      background: transparent;
      color: #b3b3b3;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.05em;
      flex-shrink: 0;
      overflow: hidden;
    }

    .item-icon {
      width: 36px;
      height: 36px;
      object-fit: contain;
      display: block;
      border-radius: 4px;
    }

    .type-icon {
      width: 32px;
      height: 32px;
    }

    .type-abbr {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: #b3b3b3;
    }

    .item-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .item-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-path {
      font-size: 11px;
      color: #b3b3b3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: 'Consolas', monospace;
    }

    .item-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      max-width: 220px;
    }

    .item-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    /* Delete confirmation bar */
    .delete-bar {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #282828;
      border: 1px solid #3e3e3e;
      border-radius: 8px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      z-index: 50;
      font-size: 13px;
      color: var(--text-primary);
    }

    .delete-bar-actions {
      display: flex;
      gap: 8px;
    }
  `],
})
export class EditComponent {
  private readonly itemsService = inject(ItemsService);
  private readonly prefsService = inject(PreferencesService);
  protected readonly icons = this.itemsService.icons;

  readonly loading = signal(true);
  readonly filterQuery = signal('');
  readonly showForm = signal(false);
  readonly editingItem = signal<ShelfItem | null>(null);
  readonly showPrefs = signal(false);
  readonly pendingDelete = signal<ShelfItem | null>(null);

  readonly filteredItems = computed(() => {
    const q = this.filterQuery().toLowerCase();
    if (!q) return this.itemsService.items();
    return this.itemsService.items().filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.tags.some(tag => tag.toLowerCase().includes(q))
    );
  });

  constructor() {
    afterNextRender(async () => {
      await Promise.all([this.itemsService.load(), this.prefsService.load()]);
      this.loading.set(false);
    });
  }

  protected openAdd(): void {
    this.editingItem.set(null);
    this.showForm.set(true);
  }

  protected openEdit(item: ShelfItem): void {
    this.editingItem.set(item);
    this.showForm.set(true);
  }

  protected closeForm(): void {
    this.showForm.set(false);
    this.editingItem.set(null);
  }

  protected onSaved(): void {
    this.closeForm();
  }

  protected confirmDelete(item: ShelfItem): void {
    this.pendingDelete.set(item);
  }

  protected async doDelete(): Promise<void> {
    const item = this.pendingDelete();
    if (!item) return;
    await this.itemsService.delete(item.id);
    this.pendingDelete.set(null);
  }

  protected typeAbbr(type: string): string {
    return ITEM_TYPE_ABBR[type as keyof typeof ITEM_TYPE_ABBR] ?? '?';
  }

  protected typeLabel(type: string): string {
    return ITEM_TYPE_LABELS[type as keyof typeof ITEM_TYPE_LABELS] ?? type;
  }
}
