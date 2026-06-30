import { Component, computed, inject, output, signal } from '@angular/core';
import { PreferencesService } from '../../shared/services/preferences.service';
import { UpdateService } from '../../shared/services/update.service';

const DEFAULT_HOTKEY = 'alt+space';

@Component({
  selector: 'app-preferences',
  template: `
    <div class="modal-overlay" (click)="onOverlayClick($event)">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Preferences">
        <div class="modal-header">
          <h2>Preferences</h2>
          <button class="btn-icon" (click)="closed.emit()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="section">
            <p class="section-label">Shortcut</p>
            <div class="field">
              <label>Global search shortcut</label>
              <div class="hotkey-row">
                <div class="hotkey-display" [class.recording]="recording()">
                  {{ displayValue() }}
                </div>
                @if (recording()) {
                  <button class="btn btn-ghost btn-danger-text" (click)="cancelRecording()">Cancel</button>
                } @else {
                  <button class="btn btn-ghost" (click)="startRecording()">Change</button>
                  <button class="btn btn-ghost" [disabled]="isAtDefault()" (click)="resetToDefault()">Reset</button>
                }
              </div>
              @if (recording()) {
                <p class="hint">Press your desired key combination (e.g. Ctrl+K)…</p>
              }
            </div>
          </div>

          <div class="divider"></div>

          <div class="section">
            <p class="section-label">Startup</p>

            <button
              class="toggle-row"
              role="switch"
              type="button"
              [attr.aria-checked]="autostart()"
              [disabled]="isDev()"
              (click)="toggleAutostart()"
            >
              <span>Start when Windows starts</span>
              <div class="toggle" [class.on]="autostart()"></div>
            </button>

            @if (isDev()) {
              <p class="hint">Only available in production builds</p>
            }

            @if (autostart() && !isDev()) {
              <button
                class="toggle-row toggle-row-sub"
                role="switch"
                type="button"
                [attr.aria-checked]="startMinimized()"
                (click)="toggleStartMinimized()"
              >
                <span>Start minimized</span>
                <div class="toggle" [class.on]="startMinimized()"></div>
              </button>
            }
          </div>

          <div class="divider"></div>

          <div class="section">
            <p class="section-label">Version</p>
            @if (updateService.currentVersion(); as version) {
              <p class="current-version">Current version: <strong>{{ version }}</strong></p>
            }
            <div class="update-row">
              <button
                class="btn btn-ghost"
                [disabled]="checking()"
                (click)="checkForUpdates()"
              >
                {{ checking() ? 'Checking…' : 'Check for Updates' }}
              </button>
              @if (updateMsg()) {
                <span class="update-msg" [class.update-msg--error]="updateMsg() === 'Could not check for updates'">
                  {{ updateMsg() }}
                  @if (updateFound()) {
                    <button class="btn-link" (click)="updateService.openDownloadPage()">Download</button>
                  }
                </span>
              }
            </div>
          </div>

          @if (error()) {
            <p class="error-msg" role="alert">{{ error() }}</p>
          }
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost" (click)="closed.emit()">Close</button>
          <button
            class="btn btn-primary"
            [disabled]="saving() || !pendingHotkey()"
            (click)="save()"
          >
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  `,
  host: {
    '(document:keydown)': 'onKeyDown($event)',
  },
  styles: [`
    .section { display: flex; flex-direction: column; gap: 10px; }

    .section-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 0;
    }

    .divider {
      height: 1px;
      background: var(--border);
      margin: 4px 0;
    }

    .hotkey-row {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .hotkey-display {
      flex: 1;
      padding: 8px 14px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      font-family: 'Consolas', monospace;
      font-size: 13px;
      color: var(--text-primary);
      min-height: 36px;
      display: flex;
      align-items: center;

      &.recording {
        border-color: var(--accent);
        color: var(--accent);
      }
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 8px 0;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-primary);
      text-align: left;

      &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
        border-radius: var(--radius-sm);
      }
    }

    .toggle-row-sub {
      padding-left: 16px;
      color: var(--text-secondary);
    }

    .toggle {
      position: relative;
      width: 36px;
      height: 20px;
      border-radius: 10px;
      background: var(--border);
      transition: background 0.2s;
      flex-shrink: 0;

      &::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        top: 2px;
        left: 2px;
        transition: transform 0.2s;
      }

      &.on {
        background: var(--accent);

        &::after {
          transform: translateX(16px);
        }
      }
    }

    .current-version {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 0;
    }

    .update-row { display: flex; align-items: center; gap: 10px; }

    .update-msg {
      font-size: 12px;
      color: var(--text-secondary);

      &.update-msg--error { color: var(--danger); }
    }

    .btn-link {
      background: none;
      border: none;
      padding: 0;
      margin-left: 4px;
      font-size: 12px;
      color: var(--accent);
      cursor: pointer;
      text-decoration: underline;

      &:hover { opacity: 0.8; }
    }

    .btn-danger-text { color: var(--danger) !important; }

    .hint {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .error-msg {
      font-size: 12px;
      color: var(--danger);
      background: var(--danger-dim);
      padding: 8px 12px;
      border-radius: var(--radius-sm);
    }
  `],
})
export class PreferencesComponent {
  readonly closed = output<void>();

  private readonly prefsService = inject(PreferencesService);
  protected readonly updateService = inject(UpdateService);

  readonly recording = signal(false);
  readonly pendingHotkey = signal('');
  readonly liveInput = signal('');
  readonly saving = signal(false);
  readonly checking = signal(false);
  readonly updateMsg = signal('');
  readonly updateFound = signal(false);
  readonly error = signal('');

  readonly isAtDefault = computed(() => {
    const pending = this.pendingHotkey();
    const saved = this.prefsService.preferences().hotkey;
    return (pending || saved) === DEFAULT_HOTKEY;
  });

  readonly autostart = computed(() => this.prefsService.preferences().autostart);
  readonly startMinimized = computed(() => this.prefsService.preferences().startMinimized);
  readonly isDev = computed(() => this.prefsService.preferences().isDev);

  protected displayValue(): string {
    if (this.recording()) return this.liveInput() || 'Waiting for input…';
    return this.pendingHotkey() || this.prefsService.preferences().hotkey;
  }

  protected startRecording(): void {
    this.liveInput.set('');
    this.recording.set(true);
    this.error.set('');
  }

  protected cancelRecording(): void {
    this.recording.set(false);
    this.liveInput.set('');
  }

  protected resetToDefault(): void {
    this.pendingHotkey.set(DEFAULT_HOTKEY);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.recording()) {
        this.cancelRecording();
      } else {
        this.closed.emit();
      }
      return;
    }

    if (!this.recording()) return;
    event.preventDefault();
    event.stopPropagation();

    const modifiers: string[] = [];
    if (event.ctrlKey)  modifiers.push('ctrl');
    if (event.altKey)   modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');
    if (event.metaKey)  modifiers.push('super');

    const key = event.key.toLowerCase();
    const modifierKeys = ['control', 'alt', 'shift', 'meta', 'super'];

    if (modifierKeys.includes(key)) {
      this.liveInput.set(modifiers.join('+') + '+');
      return;
    }

    const combo = [...modifiers, key].join('+');
    this.pendingHotkey.set(combo);
    this.liveInput.set(combo);
    this.recording.set(false);
  }

  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closed.emit();
    }
  }

  protected async toggleAutostart(): Promise<void> {
    this.error.set('');
    try {
      await this.prefsService.setAutostart(!this.autostart(), this.startMinimized());
    } catch (err) {
      this.error.set(`Failed to update startup setting: ${err}`);
    }
  }

  protected async toggleStartMinimized(): Promise<void> {
    this.error.set('');
    try {
      await this.prefsService.setAutostart(this.autostart(), !this.startMinimized());
    } catch (err) {
      this.error.set(`Failed to update startup setting: ${err}`);
    }
  }

  protected async checkForUpdates(): Promise<void> {
    this.checking.set(true);
    this.updateMsg.set('');
    this.updateFound.set(false);
    try {
      const result = await this.updateService.checkForUpdates();
      if (result.status === 'update-found') {
        this.updateMsg.set(`Version ${result.version} is available.`);
        this.updateFound.set(true);
      } else if (result.status === 'up-to-date') {
        this.updateMsg.set('You\'re up to date');
      } else {
        this.updateMsg.set('Could not check for updates');
      }
    } finally {
      this.checking.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (!this.pendingHotkey()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await this.prefsService.setHotkey(this.pendingHotkey());
      this.closed.emit();
    } catch (err) {
      this.error.set(`Failed to set shortcut: ${err}`);
    } finally {
      this.saving.set(false);
    }
  }
}
