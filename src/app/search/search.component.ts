import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { ItemsService } from '../shared/services/items.service';
import { ShelfItem, ITEM_TYPE_LABELS, itemTypeColor } from '../shared/models/shelf-item.model';
import { fuzzyScore } from '../shared/utils/fuzzy';

const SEARCH_BAR_H = 58;
const RESULT_ROW_H = 52;
const RESULTS_PADDING = 8;
const NO_RESULTS_H = 56;

@Component({
  selector: 'app-search',
  host: {
    '(document:keydown)': 'onKeyDown($event)',
  },
  template: `
    <div class="shell">

      <div class="bar">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          #searchInput
          class="input"
          type="text"
          placeholder="Search items, tags…"
          autocomplete="off"
          spellcheck="false"
          aria-label="Search"
          role="combobox"
          aria-haspopup="listbox"
          [attr.aria-expanded]="results().length > 0"
          [attr.aria-activedescendant]="results().length ? 'r-' + selectedIndex() : null"
          [value]="query()"
          (input)="onInput($event)"
        />
        @if (query()) {
          <button class="clear" (click)="clearQuery()" aria-label="Clear search">&#x2715;</button>
        }
      </div>

      @if (results().length > 0) {
        <ul class="results" role="listbox" aria-label="Search results">
          @for (item of results(); track item.id; let i = $index) {
            <li
              [id]="'r-' + i"
              class="result"
              role="option"
              [attr.aria-selected]="i === selectedIndex()"
              [class.active]="i === selectedIndex()"
              (click)="selectItem(item)"
              (mouseenter)="selectedIndex.set(i)"
            >
              <span class="badge" aria-hidden="true">
                @if (icons().get(item.id); as iconSrc) {
                  <img class="item-icon" [src]="iconSrc" alt="" />
                  <span class="type-pip" aria-hidden="true">
                    @switch (item.type) {
                      @case ('folder') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                      }
                      @case ('file') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                          <polyline points="13 2 13 9 20 9"/>
                        </svg>
                      }
                      @case ('youtube') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                          <polygon fill="currentColor" stroke="none" points="10 12 10 17 15 14.5"/>
                        </svg>
                      }
                      @case ('website') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                      }
                      @case ('run') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="4 17 10 11 4 5"/>
                          <line x1="12" y1="19" x2="20" y2="19"/>
                        </svg>
                      }
                    }
                  </span>
                } @else {
                  <span class="badge-svg" [style.color]="badgeFg(item.type)">
                    @switch (item.type) {
                      @case ('folder') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                      }
                      @case ('file') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                          <polyline points="13 2 13 9 20 9"/>
                        </svg>
                      }
                      @case ('youtube') {
                        <svg viewBox="0 0 24 24">
                          <path fill="currentColor" d="M22.54 6.42a2.78 2.78 0 0 0-1.96-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                          <polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
                        </svg>
                      }
                      @case ('website') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                      }
                      @case ('run') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="4 17 10 11 4 5"/>
                          <line x1="12" y1="19" x2="20" y2="19"/>
                        </svg>
                      }
                    }
                  </span>
                  <span class="type-pip" aria-hidden="true">
                    @switch (item.type) {
                      @case ('folder') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                      }
                      @case ('file') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                          <polyline points="13 2 13 9 20 9"/>
                        </svg>
                      }
                      @case ('youtube') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
                          <polygon fill="currentColor" stroke="none" points="10 12 10 17 15 14.5"/>
                        </svg>
                      }
                      @case ('website') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                      }
                      @case ('run') {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="4 17 10 11 4 5"/>
                          <line x1="12" y1="19" x2="20" y2="19"/>
                        </svg>
                      }
                    }
                  </span>
                }
              </span>
              <div class="meta">
                <span class="name">{{ item.name }}</span>
                <span class="path">{{ item.path }}</span>
              </div>
              @if (item.tags.length > 0) {
                <span class="alias-list" aria-hidden="true">
                  @for (tag of item.tags; track tag) {
                    <span class="alias-tag">{{ tag }}</span>
                  }
                </span>
              }
            </li>
          }
        </ul>
      } @else if (query()) {
        <div class="empty">No results for "{{ query() }}"</div>
      }

    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .shell {
      background: #181818;
      border: 1px solid #2a2a2a;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 16px 48px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.5);
    }

    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      height: 58px;
      padding: 0 16px;
      border-bottom: 1px solid transparent;
      transition: border-color 0.1s;

      .shell:has(.results) &,
      .shell:has(.empty) & { border-bottom-color: #2a2a2a; }
    }

    .icon {
      width: 18px;
      height: 18px;
      color: #535353;
      flex-shrink: 0;
    }

    .input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      font-size: 15px;
      color: #ffffff;
      font-family: inherit;

      &::placeholder { color: #535353; }
    }

    .clear {
      background: transparent;
      border: none;
      color: #535353;
      font-size: 14px;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      line-height: 1;
      flex-shrink: 0;
      transition: color 0.15s, background 0.15s;

      &:hover { color: #ffffff; background: #282828; }
    }

    .results {
      list-style: none;
      margin: 0;
      padding: 4px 0;
    }

    .result {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 52px;
      padding: 0 16px;
      cursor: pointer;
      transition: background 0.08s;
      user-select: none;

      &:hover { background: #282828; }
      &.active { background: #282828; }
    }

    .badge {
      position: relative;
      width: 36px;
      height: 36px;
      border-radius: 4px;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: visible;
    }

    .type-pip {
      position: absolute;
      top: -4px;
      left: -4px;
      width: 15px;
      height: 15px;
      border-radius: 4px;
      border: 1.5px solid #181818;
      background: #3a3a3a;
      color: #c0c0c0;
      display: flex;
      align-items: center;
      justify-content: center;

      svg {
        width: 9px;
        height: 9px;
      }
    }

    .item-icon {
      width: 36px;
      height: 36px;
      object-fit: cover;
      display: block;
      border-radius: 4px;
    }

    .badge-svg {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;

      svg {
        width: 32px;
        height: 32px;
      }
    }

    .meta {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .name {
      font-size: 14px;
      font-weight: 500;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .path {
      font-size: 12px;
      color: #b3b3b3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .alias-list {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap;
      gap: 4px;
      flex-shrink: 0;
      max-width: 220px;
      overflow: hidden;
    }

    .alias-tag {
      font-size: 11px;
      font-weight: 500;
      padding: 2px 8px;
      background: #2a2a2a;
      color: #888;
      border-radius: 4px;
      white-space: nowrap;
      border: 1px solid #3a3a3a;
    }

    .empty {
      padding: 18px 16px;
      color: #535353;
      font-size: 13px;
      text-align: center;
    }
  `],
})
export class SearchComponent {
  private readonly itemsSvc = inject(ItemsService);
  protected readonly icons = this.itemsSvc.icons;
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly query = signal('');
  readonly selectedIndex = signal(0);

  readonly results = computed(() => {
    const q = this.query().toLowerCase().trim();
    if (!q) return [] as ShelfItem[];

    const scored: Array<{ item: ShelfItem; score: number }> = [];

    for (const item of this.itemsSvc.items()) {
      const nameScore = fuzzyScore(item.name.toLowerCase(), q);
      const tagScore = item.tags.reduce((best, t) => Math.max(best, fuzzyScore(t.toLowerCase(), q)), -1);
      const score = Math.max(nameScore, tagScore);
      if (score >= 0) scored.push({ item, score });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(s => s.item);
  });

  constructor() {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';

    effect(() => {
      this.results();
      this.selectedIndex.set(0);
      void this.resize();
    });

    afterNextRender(async () => {
      await this.itemsSvc.load();

      const onShow = async () => {
        await this.itemsSvc.load();
        this.query.set('');
        this.selectedIndex.set(0);
        await getCurrentWindow().setSize(new LogicalSize(680, SEARCH_BAR_H));
        this.inputRef()?.nativeElement.focus();
      };

      await getCurrentWindow().listen('search:show', onShow);
      await getCurrentWindow().listen('tauri://focus', onShow);
    });
  }

  private async resize(): Promise<void> {
    const count = this.results().length;
    const extra = count > 0
      ? count * RESULT_ROW_H + RESULTS_PADDING
      : this.query() ? NO_RESULTS_H : 0;
    await getCurrentWindow().setSize(new LogicalSize(680, SEARCH_BAR_H + extra));
  }

  private async close(): Promise<void> {
    this.query.set('');
    await getCurrentWindow().setSize(new LogicalSize(680, SEARCH_BAR_H));
    await invoke('hide_search_window');
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected clearQuery(): void {
    this.query.set('');
    this.inputRef()?.nativeElement.focus();
  }

  protected onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex.update(i => Math.min(i + 1, this.results().length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex.update(i => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const item = this.results()[this.selectedIndex()];
        if (item) void this.selectItem(item);
        break;
      }
      case 'Escape':
        event.preventDefault();
        void this.close();
        break;
      case 'k':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          void this.close();
        }
        break;
    }
  }

  protected async selectItem(item: ShelfItem): Promise<void> {
    await invoke('open_item', { id: item.id });
    void this.close();
  }

  protected typeLabel(type: string): string {
    return ITEM_TYPE_LABELS[type as keyof typeof ITEM_TYPE_LABELS] ?? type;
  }

  protected badgeFg(type: string): string {
    return itemTypeColor(type as never);
  }
}
