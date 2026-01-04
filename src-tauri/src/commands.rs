use crate::database::Database;
use crate::models::*;
use rusqlite::params;
use tauri::State;

// ============================================================
// STREAM COMMANDS
// ============================================================

#[tauri::command]
pub fn create_stream(
    db: State<Database>,
    input: CreateStreamInput,
) -> Result<Stream, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();
    let id = uuid::Uuid::new_v4().to_string();
    let tags = input.tags.unwrap_or_default();
    let tags_json = serde_json::to_string(&tags)
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO streams (id, title, description, tags, color, pinned, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            id,
            input.title,
            input.description,
            tags_json,
            input.color,
            0,
            now,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(Stream {
        id,
        title: input.title,
        description: input.description,
        tags,
        color: input.color,
        pinned: false,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub fn get_all_streams(db: State<Database>) -> Result<Vec<StreamMetadata>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT 
                s.id, s.title, s.pinned, s.color, s.tags, s.updated_at,
                COUNT(e.id) as entry_count
            FROM streams s
            LEFT JOIN entries e ON s.id = e.stream_id
            GROUP BY s.id
            ORDER BY s.pinned DESC, s.updated_at DESC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let streams = stmt
        .query_map([], |row| {
            let tags_str: Option<String> = row.get(4)?;
            let tags: Vec<String> = tags_str
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();
            
            Ok(StreamMetadata {
                id: row.get(0)?,
                title: row.get(1)?,
                pinned: row.get::<_, i32>(2)? != 0,
                color: row.get(3)?,
                tags,
                last_updated: row.get(5)?,
                entry_count: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(streams)
}

#[tauri::command]
pub fn get_stream_details(
    db: State<Database>,
    stream_id: String,
) -> Result<StreamWithEntries, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Get stream
    let stream = conn
        .query_row(
            "SELECT id, title, description, tags, color, pinned, created_at, updated_at 
             FROM streams WHERE id = ?1",
            params![stream_id],
            |row| {
                let tags_str: Option<String> = row.get(3)?;
                let tags: Vec<String> = tags_str
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default();
                
                Ok(Stream {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    tags,
                    color: row.get(4)?,
                    pinned: row.get::<_, i32>(5)? != 0,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    // Get entries
    let mut stmt = conn
        .prepare(
            "SELECT id, stream_id, role, content, sequence_id, version_head, is_staged, 
                    parent_context_ids, ai_metadata, created_at, updated_at 
             FROM entries 
             WHERE stream_id = ?1 
             ORDER BY sequence_id ASC",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(params![stream_id], |row| {
            let content_str: String = row.get(3)?;
            let content: serde_json::Value = serde_json::from_str(&content_str).unwrap_or_default();
            let parent_ids_str: Option<String> = row.get(7)?;
            let parent_context_ids: Option<Vec<String>> = parent_ids_str
                .and_then(|s| serde_json::from_str(&s).ok());
            let ai_metadata_str: Option<String> = row.get(8)?;
            let ai_metadata: Option<AiMetadata> = ai_metadata_str
                .and_then(|s| serde_json::from_str(&s).ok());

            Ok(Entry {
                id: row.get(0)?,
                stream_id: row.get(1)?,
                role: row.get(2)?,
                content,
                sequence_id: row.get(4)?,
                version_head: row.get(5)?,
                is_staged: row.get::<_, i32>(6)? != 0,
                parent_context_ids,
                ai_metadata,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(StreamWithEntries { stream, entries })
}

#[tauri::command]
pub fn delete_stream(db: State<Database>, stream_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM streams WHERE id = ?1", params![stream_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_stream(
    db: State<Database>,
    stream_id: String,
    title: Option<String>,
    description: Option<String>,
    pinned: Option<bool>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();

    if let Some(t) = title {
        conn.execute(
            "UPDATE streams SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![t, now, stream_id],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(d) = description {
        conn.execute(
            "UPDATE streams SET description = ?1, updated_at = ?2 WHERE id = ?3",
            params![d, now, stream_id],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(p) = pinned {
        conn.execute(
            "UPDATE streams SET pinned = ?1, updated_at = ?2 WHERE id = ?3",
            params![if p { 1 } else { 0 }, now, stream_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ============================================================
// ENTRY COMMANDS
// ============================================================

#[tauri::command]
pub fn create_entry(db: State<Database>, input: CreateEntryInput) -> Result<Entry, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();
    let id = uuid::Uuid::new_v4().to_string();

    // Get next sequence ID
    let max_seq: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sequence_id), 0) FROM entries WHERE stream_id = ?1",
            params![input.stream_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let sequence_id = max_seq + 1;
    let content_str = serde_json::to_string(&input.content).map_err(|e| e.to_string())?;
    let ai_metadata_str = input.ai_metadata.as_ref()
        .map(|m| serde_json::to_string(m))
        .transpose()
        .map_err(|e| e.to_string())?;
    
    // Serialize parent_context_ids if provided
    let parent_context_ids_str = input.parent_context_ids.as_ref()
        .map(|ids| serde_json::to_string(ids))
        .transpose()
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO entries (id, stream_id, role, content, sequence_id, version_head, is_staged, parent_context_ids, ai_metadata, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![id, input.stream_id, input.role, content_str, sequence_id, 0, 0, parent_context_ids_str, ai_metadata_str, now, now],
    )
    .map_err(|e| e.to_string())?;

    // Update stream's updated_at
    conn.execute(
        "UPDATE streams SET updated_at = ?1 WHERE id = ?2",
        params![now, input.stream_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(Entry {
        id,
        stream_id: input.stream_id,
        role: input.role,
        content: input.content,
        sequence_id,
        version_head: 0,
        is_staged: false,
        parent_context_ids: input.parent_context_ids,
        ai_metadata: input.ai_metadata,
        created_at: now,
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_entry_content(
    db: State<Database>,
    entry_id: String,
    content: serde_json::Value,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();
    let content_str = serde_json::to_string(&content).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE entries SET content = ?1, updated_at = ?2 WHERE id = ?3",
        params![content_str, now, entry_id],
    )
    .map_err(|e| e.to_string())?;

    // Update stream's updated_at
    conn.execute(
        r#"UPDATE streams SET updated_at = ?1 
           WHERE id = (SELECT stream_id FROM entries WHERE id = ?2)"#,
        params![now, entry_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn toggle_entry_staging(
    db: State<Database>,
    entry_id: String,
    is_staged: bool,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE entries SET is_staged = ?1 WHERE id = ?2",
        params![if is_staged { 1 } else { 0 }, entry_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_entry(db: State<Database>, entry_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM entries WHERE id = ?1", params![entry_id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_staged_entries(db: State<Database>, stream_id: String) -> Result<Vec<Entry>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, stream_id, role, content, sequence_id, version_head, is_staged, 
                    parent_context_ids, ai_metadata, created_at, updated_at 
             FROM entries 
             WHERE stream_id = ?1 AND is_staged = 1
             ORDER BY sequence_id ASC",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(params![stream_id], |row| {
            let content_str: String = row.get(3)?;
            let content: serde_json::Value = serde_json::from_str(&content_str).unwrap_or_default();
            let parent_ids_str: Option<String> = row.get(7)?;
            let parent_context_ids: Option<Vec<String>> = parent_ids_str
                .and_then(|s| serde_json::from_str(&s).ok());
            let ai_metadata_str: Option<String> = row.get(8)?;
            let ai_metadata: Option<AiMetadata> = ai_metadata_str
                .and_then(|s| serde_json::from_str(&s).ok());

            Ok(Entry {
                id: row.get(0)?,
                stream_id: row.get(1)?,
                role: row.get(2)?,
                content,
                sequence_id: row.get(4)?,
                version_head: row.get(5)?,
                is_staged: true,
                parent_context_ids,
                ai_metadata,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

#[tauri::command]
pub fn clear_all_staging(db: State<Database>, stream_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE entries SET is_staged = 0 WHERE stream_id = ?1",
        params![stream_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================
// VERSION COMMANDS
// ============================================================

#[tauri::command]
pub fn commit_entry_version(
    db: State<Database>,
    entry_id: String,
    commit_message: Option<String>,
) -> Result<EntryVersion, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();
    let version_id = uuid::Uuid::new_v4().to_string();

    // Get current entry content and version
    let (content_str, current_version): (String, i32) = conn
        .query_row(
            "SELECT content, version_head FROM entries WHERE id = ?1",
            params![entry_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let new_version = current_version + 1;

    // Create version snapshot
    conn.execute(
        "INSERT INTO entry_versions (id, entry_id, version_number, content_snapshot, commit_message, committed_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![version_id, entry_id, new_version, content_str, commit_message, now],
    )
    .map_err(|e| e.to_string())?;

    // Update entry's version_head
    conn.execute(
        "UPDATE entries SET version_head = ?1 WHERE id = ?2",
        params![new_version, entry_id],
    )
    .map_err(|e| e.to_string())?;

    let content: serde_json::Value = serde_json::from_str(&content_str).unwrap_or_default();

    Ok(EntryVersion {
        id: version_id,
        entry_id,
        version_number: new_version,
        content_snapshot: content,
        commit_message,
        committed_at: now,
    })
}

#[tauri::command]
pub fn get_entry_versions(db: State<Database>, entry_id: String) -> Result<Vec<EntryVersion>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, entry_id, version_number, content_snapshot, commit_message, committed_at 
             FROM entry_versions 
             WHERE entry_id = ?1 
             ORDER BY version_number DESC",
        )
        .map_err(|e| e.to_string())?;

    let versions = stmt
        .query_map(params![entry_id], |row| {
            let content_str: String = row.get(3)?;
            let content: serde_json::Value = serde_json::from_str(&content_str).unwrap_or_default();

            Ok(EntryVersion {
                id: row.get(0)?,
                entry_id: row.get(1)?,
                version_number: row.get(2)?,
                content_snapshot: content,
                commit_message: row.get(4)?,
                committed_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(versions)
}

#[tauri::command]
pub fn get_latest_version(db: State<Database>, entry_id: String) -> Result<Option<EntryVersion>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT id, entry_id, version_number, content_snapshot, commit_message, committed_at 
         FROM entry_versions 
         WHERE entry_id = ?1 
         ORDER BY version_number DESC 
         LIMIT 1",
        params![entry_id],
        |row| {
            let content_str: String = row.get(3)?;
            let content: serde_json::Value = serde_json::from_str(&content_str).unwrap_or_default();

            Ok(EntryVersion {
                id: row.get(0)?,
                entry_id: row.get(1)?,
                version_number: row.get(2)?,
                content_snapshot: content,
                commit_message: row.get(4)?,
                committed_at: row.get(5)?,
            })
        },
    );

    match result {
        Ok(version) => Ok(Some(version)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_version_by_number(
    db: State<Database>,
    entry_id: String,
    version_number: i32,
) -> Result<Option<EntryVersion>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT id, entry_id, version_number, content_snapshot, commit_message, committed_at 
         FROM entry_versions 
         WHERE entry_id = ?1 AND version_number = ?2",
        params![entry_id, version_number],
        |row| {
            let content_str: String = row.get(3)?;
            let content: serde_json::Value = serde_json::from_str(&content_str).unwrap_or_default();

            Ok(EntryVersion {
                id: row.get(0)?,
                entry_id: row.get(1)?,
                version_number: row.get(2)?,
                content_snapshot: content,
                commit_message: row.get(4)?,
                committed_at: row.get(5)?,
            })
        },
    );

    match result {
        Ok(version) => Ok(Some(version)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn revert_to_version(
    db: State<Database>,
    entry_id: String,
    version_number: i32,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();

    // Get the version's content
    let content_str: String = conn
        .query_row(
            "SELECT content_snapshot FROM entry_versions WHERE entry_id = ?1 AND version_number = ?2",
            params![entry_id, version_number],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Update entry with reverted content
    conn.execute(
        "UPDATE entries SET content = ?1, updated_at = ?2 WHERE id = ?3",
        params![content_str, now, entry_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================
// BRIDGE COMMANDS
// ============================================================

#[tauri::command]
pub fn generate_bridge_key() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let chars: Vec<char> = "abcdefghijklmnopqrstuvwxyz0123456789".chars().collect();
    (0..4)
        .map(|_| chars[rng.gen_range(0..chars.len())])
        .collect()
}

#[tauri::command]
pub fn validate_bridge_key(input_text: String, expected_key: String) -> bool {
    // Robust regex to handle HTML entities
    let pattern = regex::Regex::new(
        r#"(?:<|&lt;)!-{2}\s*bridge\s*:\s*([a-zA-Z0-9]+)\s*-{2}(?:>|&gt;)"#
    ).unwrap();
    
    if let Some(captures) = pattern.captures(&input_text) {
        if let Some(found_key) = captures.get(1) {
            return found_key.as_str().to_lowercase() == expected_key.to_lowercase();
        }
    }
    
    false
}

#[tauri::command]
pub fn extract_bridge_key(input_text: String) -> Option<String> {
    let pattern = regex::Regex::new(
        r#"(?:<|&lt;)!-{2}\s*bridge\s*:\s*([a-zA-Z0-9]+)\s*-{2}(?:>|&gt;)"#
    ).unwrap();
    
    pattern.captures(&input_text)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_lowercase())
}

#[tauri::command]
pub fn create_pending_block(
    db: State<Database>,
    stream_id: String,
    bridge_key: String,
    staged_context_ids: Vec<String>,
    directive: String,
) -> Result<PendingBlock, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp_millis();
    let id = uuid::Uuid::new_v4().to_string();
    let context_ids_json = serde_json::to_string(&staged_context_ids).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO pending_blocks (id, stream_id, bridge_key, staged_context_ids, directive, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, stream_id, bridge_key, context_ids_json, directive, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(PendingBlock {
        id,
        stream_id,
        bridge_key,
        staged_context_ids,
        directive,
        created_at: now,
    })
}

#[tauri::command]
pub fn get_pending_block(db: State<Database>, stream_id: String) -> Result<Option<PendingBlock>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT id, stream_id, bridge_key, staged_context_ids, directive, created_at 
         FROM pending_blocks 
         WHERE stream_id = ?1 
         ORDER BY created_at DESC 
         LIMIT 1",
        params![stream_id],
        |row| {
            let context_ids_str: String = row.get(3)?;
            let staged_context_ids: Vec<String> = serde_json::from_str(&context_ids_str).unwrap_or_default();

            Ok(PendingBlock {
                id: row.get(0)?,
                stream_id: row.get(1)?,
                bridge_key: row.get(2)?,
                staged_context_ids,
                directive: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    );

    match result {
        Ok(block) => Ok(Some(block)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn delete_pending_block(db: State<Database>, pending_block_id: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM pending_blocks WHERE id = ?1",
        params![pending_block_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================
// SEARCH COMMANDS
// ============================================================

#[tauri::command]
pub fn search_entries(db: State<Database>, query: String) -> Result<Vec<Entry>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let search_pattern = format!("%{}%", query);

    let mut stmt = conn
        .prepare(
            "SELECT id, stream_id, role, content, sequence_id, version_head, is_staged, 
                    parent_context_ids, ai_metadata, created_at, updated_at 
             FROM entries 
             WHERE content LIKE ?1
             ORDER BY updated_at DESC
             LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(params![search_pattern], |row| {
            let content_str: String = row.get(3)?;
            let content: serde_json::Value = serde_json::from_str(&content_str).unwrap_or_default();
            let parent_ids_str: Option<String> = row.get(7)?;
            let parent_context_ids: Option<Vec<String>> = parent_ids_str
                .and_then(|s| serde_json::from_str(&s).ok());
            let ai_metadata_str: Option<String> = row.get(8)?;
            let ai_metadata: Option<AiMetadata> = ai_metadata_str
                .and_then(|s| serde_json::from_str(&s).ok());

            Ok(Entry {
                id: row.get(0)?,
                stream_id: row.get(1)?,
                role: row.get(2)?,
                content,
                sequence_id: row.get(4)?,
                version_head: row.get(5)?,
                is_staged: row.get::<_, i32>(6)? != 0,
                parent_context_ids,
                ai_metadata,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}
