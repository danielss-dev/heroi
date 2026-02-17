use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub file_type: FileType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FileType {
    Code,
    Markdown,
    Image,
    Json,
    Config,
    Binary,
    Unknown,
}

impl FileType {
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "rs" | "ts" | "tsx" | "js" | "jsx" | "py" | "go" | "java" | "c" | "cpp" | "h"
            | "cs" | "rb" | "php" | "swift" | "kt" | "scala" | "html" | "css" | "scss"
            | "less" | "vue" | "svelte" | "sh" | "bash" | "zsh" | "fish" | "ps1" | "bat"
            | "sql" | "graphql" | "proto" | "lua" | "r" | "dart" | "zig" | "nim" | "ex"
            | "exs" | "erl" | "hs" | "ml" | "clj" | "lisp" | "el" => Self::Code,
            "md" | "mdx" | "rst" | "txt" | "adoc" => Self::Markdown,
            "png" | "jpg" | "jpeg" | "gif" | "svg" | "webp" | "ico" | "bmp" => Self::Image,
            "json" | "jsonc" | "json5" => Self::Json,
            "toml" | "yaml" | "yml" | "ini" | "cfg" | "conf" | "env" | "editorconfig"
            | "gitignore" | "dockerignore" | "prettierrc" | "eslintrc" => Self::Config,
            "exe" | "dll" | "so" | "dylib" | "wasm" | "o" | "a" | "lib" | "bin" | "zip"
            | "tar" | "gz" | "7z" | "rar" => Self::Binary,
            _ => Self::Unknown,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub file_type: FileType,
    pub size: u64,
}
