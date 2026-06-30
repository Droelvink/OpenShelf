---
name: release
description: Bump version and publish a new release. Only invoke when the user explicitly types /release — never trigger automatically.
---

## Instructions

Ask the user which version bump to apply — **patch**, **minor**, or **major** — using AskUserQuestion before doing anything else.

Then execute these steps in order:

### 1. Read current version

Read `src-tauri/tauri.conf.json` and extract the current `version` field (semver, e.g. `1.0.0`).

### 2. Compute new version

- **patch**: increment the patch number (e.g. `1.0.0` → `1.0.1`)
- **minor**: increment the middle number, reset patch to 0 (e.g. `1.0.0` → `1.1.0`)
- **major**: increment the first number, reset minor and patch to 0 (e.g. `1.0.0` → `2.0.0`)

### 3. Update version in both files

- `src-tauri/tauri.conf.json` — update the `"version"` field
- `src-tauri/Cargo.toml` — update the `version` field under `[package]`

### 4. Commit, tag, and push

Run these git commands in sequence:

```
git add src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "release: v<NEW_VERSION>"
git tag v<NEW_VERSION>
git push origin master
git push origin v<NEW_VERSION>
```

### 5. Confirm

Tell the user the tag has been pushed and that the GitHub Actions release workflow is now running at https://github.com/Droelvink/OpenShelf/actions.
