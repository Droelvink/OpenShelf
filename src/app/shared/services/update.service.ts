import { Injectable, signal } from '@angular/core';

export interface PendingUpdate {
  version: string;
  body: string | null;
}

@Injectable({ providedIn: 'root' })
export class UpdateService {
  private tauriUpdate: { downloadAndInstall(): Promise<void> } | null = null;

  readonly pendingUpdate = signal<PendingUpdate | null>(null);
  readonly installing = signal(false);

  async checkForUpdates(silent = true): Promise<void> {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (!update) {
        if (!silent) {
          const { message } = await import('@tauri-apps/plugin-dialog');
          await message("You're already on the latest version.", {
            title: 'No Updates Available',
            kind: 'info',
          });
        }
        return;
      }

      this.tauriUpdate = update;
      this.pendingUpdate.set({ version: update.version, body: update.body ?? null });
    } catch {
      if (!silent) {
        const { message } = await import('@tauri-apps/plugin-dialog');
        await message('Could not check for updates. Check your connection and try again.', {
          title: 'Update Check Failed',
          kind: 'error',
        });
      }
    }
  }

  dismiss(): void {
    this.tauriUpdate = null;
    this.pendingUpdate.set(null);
  }

  async install(): Promise<void> {
    if (!this.tauriUpdate) return;
    this.installing.set(true);
    try {
      await this.tauriUpdate.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      this.installing.set(false);
    }
  }
}
