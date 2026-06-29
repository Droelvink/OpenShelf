import { Injectable, signal } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { AppPreferences } from '../models/preferences.model';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly _preferences = signal<AppPreferences>({
    hotkey: 'ctrl+k',
    autostart: false,
    startMinimized: false,
    isDev: false,
  });
  readonly preferences = this._preferences.asReadonly();

  async load(): Promise<void> {
    const prefs = await invoke<AppPreferences>('get_preferences');
    this._preferences.set(prefs);
  }

  async setHotkey(hotkey: string): Promise<void> {
    await invoke<void>('set_hotkey', { hotkey });
    this._preferences.update(p => ({ ...p, hotkey }));
  }

  async setAutostart(autostart: boolean, startMinimized: boolean): Promise<void> {
    const prev = this._preferences();
    this._preferences.update(p => ({ ...p, autostart, startMinimized }));
    try {
      await invoke<void>('set_autostart', { autostart, startMinimized });
    } catch (e) {
      this._preferences.set(prev);
      throw e;
    }
  }
}
