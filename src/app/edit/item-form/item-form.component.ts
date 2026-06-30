import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { invoke } from '@tauri-apps/api/core';
import { ItemsService } from '../../shared/services/items.service';
import { ItemType, ITEM_TYPE_LABELS, ShelfItem } from '../../shared/models/shelf-item.model';

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule],
  template: `
    <div class="modal-overlay" (click)="onOverlayClick($event)">
      <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="editItem() ? 'Edit item' : 'Add item'">
        <div class="modal-header">
          <h2>{{ editItem() ? 'Edit Item' : 'Add Item' }}</h2>
          <button class="btn-icon" (click)="closed.emit()" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="modal-body">
            <!-- Type -->
            <div class="field">
              <label for="type">Type</label>
              <select id="type" class="input" formControlName="type">
                @for (entry of typeOptions; track entry.value) {
                  <option [value]="entry.value">{{ entry.label }}</option>
                }
              </select>
            </div>

            <!-- Name -->
            <div class="field">
              <label for="name">Name</label>
              <input id="name" class="input" type="text" formControlName="name" placeholder="My Workspace" />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <span class="field-error">Name is required</span>
              }
            </div>

            <!-- Path / URL / Command(s) -->
            <div class="field">
              <label for="path">{{ isUrlType() ? 'URL' : isRunType() ? 'Command(s)' : 'Path' }}</label>
              <div class="path-row">
                @if (isRunType()) {
                  <textarea
                    id="path"
                    class="input cmd-input"
                    formControlName="path"
                    placeholder="npm start&#10;echo Done"
                    rows="4"
                    spellcheck="false"
                  ></textarea>
                } @else {
                  <input
                    id="path"
                    class="input"
                    type="text"
                    formControlName="path"
                    [placeholder]="isUrlType() ? 'https://...' : 'C:/path/to/...'"
                  />
                  @if (!isUrlType()) {
                    <button
                      type="button"
                      class="btn btn-ghost browse-btn"
                      (click)="browse()"
                    >Browse</button>
                  }
                }
              </div>
              @if (form.controls.path.invalid && form.controls.path.touched) {
                <span class="field-error">{{ isUrlType() ? 'URL' : isRunType() ? 'Command(s)' : 'Path' }} is required</span>
              }
            </div>

            <!-- Tags -->
            <div class="field">
              <label>Tags / Aliases</label>
              <div class="tags-input-area" (click)="tagInput.focus()">
                @for (tag of tags(); track tag) {
                  <span class="chip">
                    {{ tag }}
                    <button type="button" (click)="removeTag(tag)" [attr.aria-label]="'Remove ' + tag">×</button>
                  </span>
                }
                <input
                  #tagInput
                  class="tag-input"
                  type="text"
                  [value]="tagInputValue()"
                  (input)="tagInputValue.set($any($event.target).value)"
                  (keydown)="onTagKeydown($event)"
                  placeholder="Add alias, press Enter…"
                  aria-label="Add tag"
                />
              </div>
            </div>

            @if (error()) {
              <p class="error-msg" role="alert">{{ error() }}</p>
            }
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" (click)="closed.emit()">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving()">
              {{ saving() ? 'Saving…' : (editItem() ? 'Save Changes' : 'Add Item') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .path-row {
      display: flex;
      gap: 8px;
      align-items: stretch;
    }

    .browse-btn {
      flex-shrink: 0;
      white-space: nowrap;
    }

    .tags-input-area {
      min-height: 40px;
      padding: 6px 10px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      cursor: text;
      transition: border-color 0.15s;

      &:focus-within { border-color: var(--border-focus); }
    }

    .tag-input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 13px;
      color: var(--text-primary);
      font-family: inherit;
      min-width: 140px;
      flex: 1;

      &::placeholder { color: var(--text-dim); }
    }

    .cmd-input {
      resize: vertical;
      min-height: 80px;
      font-family: 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.5;
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
export class ItemFormComponent implements OnInit {
  readonly editItem = input<ShelfItem | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly itemsService = inject(ItemsService);

  readonly typeOptions: { value: ItemType; label: string }[] = (
    Object.entries(ITEM_TYPE_LABELS) as [ItemType, string][]
  ).map(([value, label]) => ({ value, label }));

  readonly form = new FormGroup({
    type: new FormControl<ItemType>('folder', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    path: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly tags = signal<string[]>([]);
  readonly tagInputValue = signal('');
  readonly saving = signal(false);
  readonly error = signal('');

  readonly isUrlType = () => {
    const t = this.form.controls.type.value;
    return t === 'website' || t === 'youtube';
  };

  readonly isRunType = () => this.form.controls.type.value === 'run';

  ngOnInit(): void {
    const item = this.editItem();
    if (item) {
      this.form.setValue({ type: item.type as ItemType, name: item.name, path: item.path });
      this.tags.set([...item.tags]);
    }
  }

  protected onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commitTag();
    } else if (event.key === 'Backspace' && this.tagInputValue() === '') {
      this.tags.update(t => t.slice(0, -1));
    }
  }

  protected removeTag(tag: string): void {
    this.tags.update(t => t.filter(t2 => t2 !== tag));
  }

  protected async browse(): Promise<void> {
    const command = this.form.controls.type.value === 'folder' ? 'pick_folder' : 'pick_file';
    const result = await invoke<string | null>(command);
    if (result) this.form.controls.path.setValue(result);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.commitTag();

    if (this.form.invalid) return;

    this.saving.set(true);
    this.error.set('');
    try {
      const { type, name, path } = this.form.getRawValue();
      const existing = this.editItem();
      const item: ShelfItem = {
        id: existing?.id ?? crypto.randomUUID(),
        type,
        name,
        path,
        tags: this.tags(),
        createdAt: existing?.createdAt ?? Date.now(),
      };
      if (existing) {
        await this.itemsService.update(item);
      } else {
        await this.itemsService.add(item);
      }
      this.saved.emit();
    } catch (err) {
      this.error.set(`Failed to save: ${err}`);
    } finally {
      this.saving.set(false);
    }
  }

  protected onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closed.emit();
    }
  }

  private commitTag(): void {
    const val = this.tagInputValue().trim().replace(/,$/, '');
    if (val && !this.tags().includes(val)) {
      this.tags.update(t => [...t, val]);
    }
    this.tagInputValue.set('');
  }
}
