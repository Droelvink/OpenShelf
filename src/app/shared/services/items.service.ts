import { Injectable, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { ShelfItem } from '../models/shelf-item.model';

@Injectable({ providedIn: 'root' })
export class ItemsService {
  private readonly _items = signal<ShelfItem[]>([]);
  private readonly _icons = signal<Map<string, string>>(new Map());

  readonly items = this._items.asReadonly();
  readonly icons = this._icons.asReadonly();

  async load(): Promise<void> {
    const items = await invoke<ShelfItem[]>('get_items');
    this._items.set(items);
    void this.loadIconsForItems(items);
  }

  async add(item: ShelfItem): Promise<void> {
    await invoke<void>('add_item', { item });
    this._items.update(items => [...items, item]);
    void this.loadIconsForItems([item]);
  }

  async update(item: ShelfItem): Promise<void> {
    await invoke<void>('update_item', { item });
    this._items.update(items => items.map(i => (i.id === item.id ? item : i)));
    // Clear cached icon so it re-fetches if the path changed
    this._icons.update(m => { const next = new Map(m); next.delete(item.id); return next; });
    void this.loadIconsForItems([item]);
  }

  async delete(id: string): Promise<void> {
    await invoke<void>('delete_item', { id });
    this._items.update(items => items.filter(i => i.id !== id));
    this._icons.update(m => { const next = new Map(m); next.delete(id); return next; });
  }

  private async loadIconsForItems(items: ShelfItem[]): Promise<void> {
    const existing = this._icons();
    const toLoad = items.filter(
      item => (item.type === 'folder' || item.type === 'file') && !existing.has(item.id),
    );

    await Promise.all(
      toLoad.map(async item => {
        const icon = await invoke<string | null>('get_icon', { path: item.path });
        if (icon) {
          this._icons.update(m => { const next = new Map(m); next.set(item.id, icon); return next; });
        }
      }),
    );
  }
}
