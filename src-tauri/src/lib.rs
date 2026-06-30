mod commands;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .setup(setup)
        .invoke_handler(tauri::generate_handler![
            commands::get_items,
            commands::add_item,
            commands::update_item,
            commands::delete_item,
            commands::open_item,
            commands::get_preferences,
            commands::set_hotkey,
            commands::set_autostart,
            commands::pick_file,
            commands::pick_folder,
            commands::open_url,
            commands::hide_search_window,
            commands::show_main_window,
            commands::get_icon,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Create the search overlay window (hidden by default)
    let search_window = WebviewWindowBuilder::new(app, "search", WebviewUrl::App("/".into()))
        .title("")
        .inner_size(680.0, 56.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .visible(false)
        .skip_taskbar(true)
        .center()
        .build()?;

    // Hide the search window whenever it loses focus
    let sw = search_window.clone();
    search_window.on_window_event(move |event| {
        if let WindowEvent::Focused(false) = event {
            let _ = sw.hide();
        }
    });

    // Show the main window unless this is an autostart minimized launch
    if let Some(main_window) = app.get_webview_window("main") {
        let mw = main_window.clone();
        main_window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = mw.hide();
            }
        });

        let prefs = commands::load_preferences(app.handle());
        let is_autostart_launch = std::env::args().any(|a| a == "--minimized");
        if !(prefs.autostart && prefs.start_minimized && is_autostart_launch) {
            let _ = main_window.show();
        }
    }

    // Build the system tray menu
    let open_item =
        MenuItem::with_id(app, "open", "Open OpenShelf", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("OpenShelf")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)?;

    // Register the configured global shortcut
    let hotkey = commands::load_preferences(app.handle()).hotkey;
    commands::register_global_shortcut(app.handle(), &hotkey)?;

    Ok(())
}
