use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShelfItem {
    pub id: String,
    pub r#type: String,
    pub name: String,
    pub path: String,
    pub tags: Vec<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPreferences {
    pub hotkey: String,
    #[serde(default)]
    pub autostart: bool,
    #[serde(default)]
    pub start_minimized: bool,
    /// Always set at runtime; never read from the store.
    #[serde(default, skip_deserializing)]
    pub is_dev: bool,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            hotkey: "alt+space".to_string(),
            autostart: false,
            start_minimized: false,
            is_dev: false,
        }
    }
}

pub fn load_preferences(app: &AppHandle) -> AppPreferences {
    let Ok(store) = app.store("store.json") else {
        let mut p = AppPreferences::default();
        p.is_dev = cfg!(debug_assertions);
        return p;
    };
    let mut prefs: AppPreferences = store
        .get("preferences")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();
    prefs.is_dev = cfg!(debug_assertions);
    prefs
}

fn save_preferences(app: &AppHandle, prefs: &AppPreferences) {
    let Ok(store) = app.store("store.json") else {
        return;
    };
    store.set("preferences", serde_json::to_value(prefs).unwrap_or_default());
    let _ = store.save();
}

fn load_items(app: &AppHandle) -> Vec<ShelfItem> {
    let Ok(store) = app.store("store.json") else {
        return vec![];
    };
    store
        .get("items")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

fn save_items(app: &AppHandle, items: &[ShelfItem]) {
    let Ok(store) = app.store("store.json") else {
        return;
    };
    store.set("items", serde_json::to_value(items).unwrap_or_default());
    let _ = store.save();
}

pub fn toggle_search_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window("search") else {
        return;
    };
    let is_visible = window.is_visible().unwrap_or(false);
    if is_visible {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
        // Emit a guaranteed event so the Angular app can reload items and focus
        // the input reliably, regardless of whether the OS focus event fires.
        let _ = window.emit("search:show", ());
    }
}

pub fn register_global_shortcut(app: &AppHandle, hotkey: &str) -> Result<(), String> {
    let app_clone = app.clone();
    app.global_shortcut()
        .on_shortcut(hotkey, move |_, _, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_search_window(&app_clone);
            }
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_items(app: AppHandle) -> Vec<ShelfItem> {
    load_items(&app)
}

#[tauri::command]
pub fn add_item(app: AppHandle, item: ShelfItem) {
    let mut items = load_items(&app);
    items.push(item);
    save_items(&app, &items);
}

#[tauri::command]
pub fn update_item(app: AppHandle, item: ShelfItem) {
    let mut items = load_items(&app);
    if let Some(pos) = items.iter().position(|i| i.id == item.id) {
        items[pos] = item;
        save_items(&app, &items);
    }
}

#[tauri::command]
pub fn delete_item(app: AppHandle, id: String) {
    let mut items = load_items(&app);
    items.retain(|i| i.id != id);
    save_items(&app, &items);
}

#[tauri::command]
pub fn open_item(app: AppHandle, id: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    let items = load_items(&app);
    let item = items.iter().find(|i| i.id == id).ok_or("Item not found")?;

    match item.r#type.as_str() {
        "website" | "youtube" => app
            .opener()
            .open_url(&item.path, None::<&str>)
            .map_err(|e| e.to_string()),
        "run" => {
            let commands: String = item
                .path
                .lines()
                .filter(|l| !l.trim().is_empty())
                .collect::<Vec<_>>()
                .join(" & ");
            std::process::Command::new("cmd")
                .args(["/c", "start", "cmd", "/k", &commands])
                .spawn()
                .map_err(|e| e.to_string())?;
            Ok(())
        }
        _ => app
            .opener()
            .open_path(&item.path, None::<&str>)
            .map_err(|e| e.to_string()),
    }
}

#[tauri::command]
pub fn get_preferences(app: AppHandle) -> AppPreferences {
    load_preferences(&app)
}

#[tauri::command]
pub fn set_hotkey(app: AppHandle, hotkey: String) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| e.to_string())?;

    register_global_shortcut(&app, &hotkey)?;

    let mut prefs = load_preferences(&app);
    prefs.hotkey = hotkey;
    save_preferences(&app, &prefs);

    Ok(())
}

#[tauri::command]
pub fn pick_file(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;

    app.dialog()
        .file()
        .blocking_pick_file()
        .map(|fp| fp.to_string())
}

#[tauri::command]
pub fn pick_folder(app: AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;

    app.dialog()
        .file()
        .blocking_pick_folder()
        .map(|fp| fp.to_string())
}

#[tauri::command]
pub fn get_icon(path: String) -> Option<String> {
    extract_icon_base64(&path)
}

#[cfg(target_os = "windows")]
fn extract_icon_base64(path: &str) -> Option<String> {
    use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
    use image::{codecs::png::PngEncoder, ExtendedColorType, ImageEncoder};
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

    let wide: Vec<u16> = path.encode_utf16().chain(Some(0)).collect();
    let mut fi = SHFILEINFOW::default();

    let result = unsafe {
        SHGetFileInfoW(
            windows::core::PCWSTR(wide.as_ptr()),
            FILE_FLAGS_AND_ATTRIBUTES(0),
            Some(&mut fi),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        )
    };

    if result == 0 || fi.hIcon.is_invalid() {
        return None;
    }

    let mut icon_info = ICONINFO::default();
    if unsafe { GetIconInfo(fi.hIcon, &mut icon_info) }.is_err() {
        unsafe { let _ = DestroyIcon(fi.hIcon); }
        return None;
    }

    let mut bmp = unsafe { std::mem::zeroed::<BITMAP>() };
    let obj_size = unsafe {
        GetObjectW(
            HGDIOBJ(icon_info.hbmColor.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some((&mut bmp as *mut BITMAP).cast()),
        )
    };

    if obj_size == 0 {
        unsafe {
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmColor.0));
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmMask.0));
            let _ = DestroyIcon(fi.hIcon);
        }
        return None;
    }

    let width = bmp.bmWidth as u32;
    let height = bmp.bmHeight.unsigned_abs();
    let mut pixels = vec![0u8; (width * height * 4) as usize];

    let mut bmi = unsafe { std::mem::zeroed::<BITMAPINFO>() };
    bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    bmi.bmiHeader.biWidth = width as i32;
    bmi.bmiHeader.biHeight = -(height as i32); // top-down
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB.0;

    let dc = unsafe { CreateCompatibleDC(None) };
    let scan_lines = unsafe {
        GetDIBits(
            dc,
            icon_info.hbmColor,
            0,
            height,
            Some(pixels.as_mut_ptr().cast()),
            &mut bmi,
            DIB_RGB_COLORS,
        )
    };
    unsafe {
        let _ = DeleteDC(dc);
        let _ = DeleteObject(HGDIOBJ(icon_info.hbmColor.0));
        let _ = DeleteObject(HGDIOBJ(icon_info.hbmMask.0));
        let _ = DestroyIcon(fi.hIcon);
    }

    if scan_lines == 0 {
        return None;
    }

    // Windows gives BGRA; convert to RGBA for PNG
    for chunk in pixels.chunks_mut(4) {
        chunk.swap(0, 2);
    }

    let mut png_bytes: Vec<u8> = Vec::new();
    PngEncoder::new(&mut png_bytes)
        .write_image(&pixels, width, height, ExtendedColorType::Rgba8)
        .ok()?;

    Some(format!("data:image/png;base64,{}", BASE64.encode(&png_bytes)))
}

#[cfg(not(target_os = "windows"))]
fn extract_icon_base64(_path: &str) -> Option<String> {
    None
}

#[tauri::command]
pub fn set_autostart(
    app: AppHandle,
    autostart: bool,
    start_minimized: bool,
) -> Result<(), String> {
    let mut prefs = load_preferences(&app);
    prefs.autostart = autostart;
    prefs.start_minimized = start_minimized;
    save_preferences(&app, &prefs);

    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_autostart::ManagerExt;
        let launcher = app.autolaunch();
        if autostart {
            launcher.enable().map_err(|e| e.to_string())?;
        } else {
            launcher.disable().map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn hide_search_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("search") {
        let _ = window.hide();
    }
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
