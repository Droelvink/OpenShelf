import { Injectable } from '@angular/core';
import { ask, message } from '@tauri-apps/plugin-dialog';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  async checkForUpdates(): Promise<void> {
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (!update) return;

      const confirmed = await ask(
        `Version ${update.version} is available.\n\n${update.body ?? ''}\n\nInstall now?`,
        { title: 'Update Available', kind: 'info' },
      );

      if (!confirmed) return;

      await update.downloadAndInstall();

      await message('Update installed. Restart the app to apply it.', {
        title: 'Restart Required',
        kind: 'info',
      });

      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      // Silently ignore — updater not configured or no network
    }
  }
}
