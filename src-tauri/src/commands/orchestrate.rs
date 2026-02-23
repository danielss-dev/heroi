use tauri_plugin_store::StoreExt;

#[tauri::command]
pub fn save_orchestrations(
    workflows: serde_json::Value,
    active_workflow_id: serde_json::Value,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    store.set("workflows", workflows);
    store.set("activeWorkflowId", active_workflow_id);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_orchestrations(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let store = app.store("heroi-store.json").map_err(|e| e.to_string())?;
    let workflows = match store.get("workflows") {
        Some(val) => val.clone(),
        None => serde_json::Value::Null,
    };
    let active_id = match store.get("activeWorkflowId") {
        Some(val) => val.clone(),
        None => serde_json::Value::Null,
    };

    Ok(serde_json::json!({
        "workflows": workflows,
        "activeWorkflowId": active_id
    }))
}
