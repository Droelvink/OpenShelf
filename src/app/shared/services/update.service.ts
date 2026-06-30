import { Injectable, signal } from '@angular/core';

const DISMISSED_KEY = 'dismissed_update_version';

export type UpdateCheckResult =
  | { status: 'update-found'; version: string }
  | { status: 'up-to-date' }
  | { status: 'error' };

@Injectable({ providedIn: 'root' })
export class UpdateService {
  readonly pendingUpdate = signal<string | null>(null);
  readonly currentVersion = signal<string | null>(null);

  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      const current = await getVersion();
      this.currentVersion.set(current);

      const response = await fetch('https://api.github.com/repos/Droelvink/OpenShelf/releases/latest');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const latest = (data.tag_name as string).replace(/^v/, '');

      if (isNewerVersion(latest, current)) {
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed !== latest) {
          this.pendingUpdate.set(latest);
        }
        return { status: 'update-found', version: latest };
      }
      return { status: 'up-to-date' };
    } catch {
      return { status: 'error' };
    }
  }

  async openDownloadPage(): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_url', { url: 'https://github.com/Droelvink/OpenShelf/releases/latest' });
  }

  dismiss(): void {
    const version = this.pendingUpdate();
    if (version) {
      localStorage.setItem(DISMISSED_KEY, version);
    }
    this.pendingUpdate.set(null);
  }
}

function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [la, lb, lc] = parse(latest);
  const [ca, cb, cc] = parse(current);
  if (la !== ca) return la > ca;
  if (lb !== cb) return lb > cb;
  return lc > cc;
}
