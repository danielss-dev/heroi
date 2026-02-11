use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub staged: FileState,
    pub unstaged: FileState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FileState {
    Unmodified,
    Added,
    Modified,
    Deleted,
    Renamed,
    Typechange,
    Untracked,
    Conflicted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffOutput {
    pub file_path: String,
    pub diff_text: String,
}
