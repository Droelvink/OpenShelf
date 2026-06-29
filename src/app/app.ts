import { Component, afterNextRender, inject, signal } from '@angular/core';
import { SearchComponent } from './search/search.component';
import { EditComponent } from './edit/edit.component';
import { UpdateService } from './shared/services/update.service';

@Component({
  selector: 'app-root',
  imports: [SearchComponent, EditComponent],
  template: `
    @if (windowLabel() === 'search') {
      <app-search />
    } @else if (windowLabel() !== null) {
      <app-edit />
    }
  `,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
})
export class App {
  protected readonly windowLabel = signal<string | null>(null);
  private readonly updateService = inject(UpdateService);

  constructor() {
    afterNextRender(async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const label = getCurrentWindow().label;
      this.windowLabel.set(label);

      if (label === 'main') {
        this.updateService.checkForUpdates();
      }
    });
  }
}
