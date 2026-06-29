export type ItemType = 'folder' | 'file' | 'youtube' | 'website';

export interface ShelfItem {
  id: string;
  type: ItemType;
  name: string;
  path: string;
  tags: string[];
  createdAt: number;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  folder: 'Folder',
  file: 'File',
  youtube: 'YouTube',
  website: 'Website',
};

export const ITEM_TYPE_ABBR: Record<ItemType, string> = {
  folder: 'DIR',
  file: 'FILE',
  youtube: 'YT',
  website: 'URL',
};

export function itemTypeColor(type: ItemType): string {
  const colors: Record<ItemType, string> = {
    folder: '#6c63ff',
    file:   '#ffa040',
    youtube:'#ff4545',
    website:'#00c896',
  };
  return colors[type] ?? '#8b90a0';
}
