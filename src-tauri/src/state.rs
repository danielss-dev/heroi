use std::sync::Mutex;

use crate::models::repo::RepoEntry;

#[derive(Default)]
pub struct AppData {
    pub repos: Vec<RepoEntry>,
}

pub struct AppState(pub Mutex<AppData>);

impl AppState {
    pub fn new() -> Self {
        Self(Mutex::new(AppData::default()))
    }
}
