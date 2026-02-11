use tauri_plugin_store::StoreExt;

#[tauri::command]
pub fn save_settings(
    settings: serde_json::Value,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set("settings", settings);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    match store.get("settings") {
        Some(val) => Ok(val.clone()),
        None => Ok(serde_json::Value::Null),
    }
}
