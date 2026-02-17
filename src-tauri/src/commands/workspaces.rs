use tauri_plugin_store::StoreExt;

#[tauri::command]
pub fn save_workspaces(
    workspaces: serde_json::Value,
    active_workspace_id: serde_json::Value,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set("workspaces", workspaces);
    store.set("activeWorkspaceId", active_workspace_id);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_workspaces(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    let workspaces = match store.get("workspaces") {
        Some(val) => val.clone(),
        None => serde_json::Value::Null,
    };
    let active_id = match store.get("activeWorkspaceId") {
        Some(val) => val.clone(),
        None => serde_json::Value::Null,
    };

    Ok(serde_json::json!({
        "workspaces": workspaces,
        "activeWorkspaceId": active_id
    }))
}
