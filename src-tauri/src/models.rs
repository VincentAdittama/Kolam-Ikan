use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Stream {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub color: Option<String>,
    pub pinned: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StreamMetadata {
    pub id: String,
    pub title: String,
    pub entry_count: i64,
    pub last_updated: i64,
    pub pinned: bool,
    pub color: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AiMetadata {
    pub model: String,
    pub provider: String,
    pub directive: String,
    pub bridge_key: String,
    pub summary: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: String,
    pub stream_id: String,
    pub role: String,
    pub content: serde_json::Value,
    pub sequence_id: i32,
    pub version_head: i32,
    pub is_staged: bool,
    pub parent_context_ids: Option<Vec<String>>,
    pub ai_metadata: Option<AiMetadata>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EntryVersion {
    pub id: String,
    pub entry_id: String,
    pub version_number: i32,
    pub content_snapshot: serde_json::Value,
    pub commit_message: Option<String>,
    pub committed_at: i64,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Spotlight {
    pub id: String,
    pub entry_id: String,
    pub context_text: String,
    pub highlighted_text: String,
    pub start_offset: i32,
    pub end_offset: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PendingBlock {
    pub id: String,
    pub stream_id: String,
    pub bridge_key: String,
    pub staged_context_ids: Vec<String>,
    pub directive: String,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStreamInput {
    pub title: String,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntryInput {
    pub stream_id: String,
    pub role: String,
    pub content: serde_json::Value,
    pub ai_metadata: Option<AiMetadata>,
    pub parent_context_ids: Option<Vec<String>>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntryContentInput {
    pub entry_id: String,
    pub content: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamWithEntries {
    pub stream: Stream,
    pub entries: Vec<Entry>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

#[allow(dead_code)]
impl AppError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: None,
        }
    }

    pub fn with_details(code: &str, message: &str, details: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            details: Some(details.to_string()),
        }
    }
}
