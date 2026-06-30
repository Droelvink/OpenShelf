# OpenShelf

A keyboard-driven launcher for Windows that lets you open folders, files, websites, YouTube videos, and shell commands from a single global hotkey — without ever touching the mouse.

## What it does

OpenShelf sits in your system tray and waits. Press your configured shortcut (default: `Ctrl+K`) and a floating search overlay appears in the center of your screen. Start typing and it fuzzy-searches your saved items by name or tag. Hit `Enter` to open the selected item, or `Escape` to dismiss. The overlay closes automatically when it loses focus.

Items are managed through a separate editor window (the "shelf") where you can add, edit, and delete entries, filter them, and configure preferences.

## Item types

| Type | What happens when opened |
|---|---|
| **Folder** | Opens in Windows Explorer |
| **File** | Opens with the default application |
| **Website** | Opens in the default browser |
| **YouTube** | Opens in the default browser; shows thumbnail in results |
| **Run** | Executes as a shell command |

Folders and files show their native system icon in results. Websites and YouTube links show favicons/thumbnails fetched automatically.

## How it works

OpenShelf is a [Tauri 2](https://v2.tauri.app/) desktop app with an [Angular 22](https://angular.dev/) frontend.

- **Two windows:** a transparent, always-on-top, frameless search overlay (`/`) and a regular editor window (`/edit`). Both are webviews talking to the same Rust backend.
- **Data storage:** items and preferences are persisted locally via `tauri-plugin-store` (a JSON file in the app data directory). No cloud sync, no account required.
- **Global shortcut:** registered via `tauri-plugin-global-shortcut`. Triggering it emits a `search:show` event that brings the overlay to the front.
- **Opening items:** the frontend calls a `open_item` IPC command; the Rust backend resolves the item type and delegates to `tauri-plugin-opener` (files/folders/URLs) or spawns a shell process (run commands).
- **Icons:** file/folder icons are extracted from the OS via a `get_icon` IPC command that returns a base64-encoded image. URL icons are derived client-side using the Google favicon service.
- **Autostart:** opt-in via `tauri-plugin-autostart`. When enabled with "start minimized", the app launches without showing any window.
- **Single instance:** `tauri-plugin-single-instance` ensures a second launch focuses the existing editor window instead of opening a duplicate.

## Development

**Prerequisites:** [Node.js](https://nodejs.org/), [Rust](https://www.rust-lang.org/tools/install), and the [Tauri CLI prerequisites for Windows](https://v2.tauri.app/start/prerequisites/).

```bash
# Install dependencies
npm install

# Start in development mode (hot-reload Angular + Rust backend)
npm run tauri dev

# Build a release binary
npm run tauri build
```

The Angular dev server runs on `http://localhost:4200`. In dev mode Tauri spawns it automatically and points both webview windows at it.

```bash
# Run unit tests
ng test
```
