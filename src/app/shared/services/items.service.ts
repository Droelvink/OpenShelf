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
    const toLoad = items.filter(item => !existing.has(item.id));

    for (const item of toLoad) {
      const urlIcon = this.deriveUrlIcon(item);
      if (urlIcon) {
        this._icons.update(m => { const next = new Map(m); next.set(item.id, urlIcon); return next; });
      }
    }

    await Promise.all(
      toLoad
        .filter(item => item.type === 'folder' || item.type === 'file')
        .map(async item => {
          const icon = await invoke<string | null>('get_icon', { path: item.path });
          if (icon) {
            this._icons.update(m => { const next = new Map(m); next.set(item.id, icon); return next; });
          }
        }),
    );
  }

  private deriveUrlIcon(item: ShelfItem): string | null {
    if (item.type === 'youtube') {
      const match = item.path.match(/[?&]v=([^&#]+)/) ?? item.path.match(/youtu\.be\/([^?&#]+)/);
      if (match) return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
      return `https://www.google.com/s2/favicons?sz=64&domain=youtube.com`;
    }
    if (item.type === 'website') {
      try {
        const { hostname } = new URL(item.path);
        return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
      } catch { return null; }
    }
    return null;
  }
}
