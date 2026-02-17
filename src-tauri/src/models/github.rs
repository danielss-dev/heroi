use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrInfo {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub url: String,
    pub head_branch: String,
    pub base_branch: String,
    pub draft: bool,
    pub mergeable: Option<String>,
    pub additions: u64,
    pub deletions: u64,
    pub changed_files: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckRun {
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MergeMethod {
    Merge,
    Squash,
    Rebase,
}

impl MergeMethod {
    pub fn as_flag(&self) -> &str {
        match self {
            MergeMethod::Merge => "--merge",
            MergeMethod::Squash => "--squash",
            MergeMethod::Rebase => "--rebase",
        }
    }
}
