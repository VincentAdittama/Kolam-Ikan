use rusqlite::{params, Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

        let db_path = app_data_dir.join("kolam_ikan.db");
        let conn = Connection::open(&db_path)?;

        // Initialize schema
        Self::initialize_schema(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn initialize_schema(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            r#"
            -- STREAMS
            CREATE TABLE IF NOT EXISTS streams (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                tags TEXT DEFAULT '[]',
                color TEXT,
                pinned INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            -- PROFILES (Authors/Personas)
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT CHECK(role IN ('self', 'friend', 'reference', 'ai')) NOT NULL,
                avatar_url TEXT,
                color TEXT,
                initials TEXT,
                bio TEXT,
                is_default INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            -- ENTRIES (The "Blocks")
            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                stream_id TEXT NOT NULL,
                profile_id TEXT,
                role TEXT CHECK(role IN ('user', 'ai')) NOT NULL,
                content TEXT NOT NULL,
                sequence_id INTEGER NOT NULL,
                version_head INTEGER DEFAULT 0,
                is_staged INTEGER DEFAULT 0,
                parent_context_ids TEXT,
                ai_metadata TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                FOREIGN KEY(stream_id) REFERENCES streams(id) ON DELETE CASCADE,
                FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE SET NULL
            );

            -- VERSIONS (The "Commits")
            CREATE TABLE IF NOT EXISTS entry_versions (
                id TEXT PRIMARY KEY,
                entry_id TEXT NOT NULL,
                version_number INTEGER NOT NULL,
                content_snapshot TEXT NOT NULL,
                commit_message TEXT,
                committed_at INTEGER NOT NULL,
                FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
            );

            -- SPOTLIGHTS (Cmd+L selections)
            CREATE TABLE IF NOT EXISTS spotlights (
                id TEXT PRIMARY KEY,
                entry_id TEXT NOT NULL,
                context_text TEXT NOT NULL,
                highlighted_text TEXT NOT NULL,
                start_offset INTEGER NOT NULL,
                end_offset INTEGER NOT NULL,
                FOREIGN KEY(entry_id) REFERENCES entries(id) ON DELETE CASCADE
            );

            -- PENDING BLOCKS (Awaiting AI response)
            CREATE TABLE IF NOT EXISTS pending_blocks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                stream_id TEXT NOT NULL,
                bridge_key TEXT NOT NULL,
                staged_context_ids TEXT NOT NULL,
                directive TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(stream_id) REFERENCES streams(id) ON DELETE CASCADE
            );

            -- Indexes for performance (excluding profile_id which is added in migration)
            CREATE INDEX IF NOT EXISTS idx_entries_stream_id ON entries(stream_id);
            CREATE INDEX IF NOT EXISTS idx_entries_sequence ON entries(stream_id, sequence_id);
            CREATE INDEX IF NOT EXISTS idx_entry_versions_entry_id ON entry_versions(entry_id);
            CREATE INDEX IF NOT EXISTS idx_spotlights_entry_id ON spotlights(entry_id);
            "#,
        )?;

        // Run migrations for existing databases BEFORE creating profile-related indexes
        Self::run_migrations(conn)?;

        Ok(())
    }

    fn run_migrations(conn: &Connection) -> Result<()> {
        let tables = ["streams", "profiles", "entries", "pending_blocks"];

        for table in tables {
            let has_user_id: bool = conn
                .prepare(&format!(
                    "SELECT 1 FROM pragma_table_info('{}') WHERE name = 'user_id'",
                    table
                ))?
                .exists([])?;

            if !has_user_id {
                // Migration: Add user_id column with a dummy default for now
                conn.execute(
                    &format!(
                        "ALTER TABLE {} ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default-user'",
                        table
                    ),
                    [],
                )
                .ok();
            }
        }

        // Check if profile_id column exists in entries
        let has_profile_id: bool = conn
            .prepare("SELECT 1 FROM pragma_table_info('entries') WHERE name = 'profile_id'")?
            .exists([])?;

        if !has_profile_id {
            // Migration: Add profile_id column to existing entries table
            conn.execute(
                "ALTER TABLE entries ADD COLUMN profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL",
                [],
            ).ok(); // Ignore errors if column already exists
        }

        // Now create the indexes
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id)",
            [],
        )
        .ok();
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id)",
            [],
        )
        .ok();
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id)",
            [],
        )
        .ok();
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_entries_profile_id ON entries(profile_id)",
            [],
        )
        .ok();

        Ok(())
    }

    pub fn create_tutorial_stream(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Check if any streams exist
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM streams", [], |row| row.get(0))?;

        if count == 0 {
            let now = chrono::Utc::now().timestamp_millis();
            let stream_id = uuid::Uuid::new_v4().to_string();

            // Create welcome stream
            conn.execute(
                "INSERT INTO streams (id, user_id, title, description, tags, pinned, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    stream_id,
                    "default-user",
                    "Welcome to Kolam Ikan",
                    "Your first stream - feel free to experiment here!",
                    "[\"tutorial\"]",
                    1,
                    now,
                    now
                ],
            )?;

            // Create first entry
            let entry1_id = uuid::Uuid::new_v4().to_string();
            let entry1_content = serde_json::json!({
                "type": "doc",
                "content": [
                    {
                        "type": "heading",
                        "attrs": { "level": 1 },
                        "content": [
                            { "type": "text", "text": "Welcome! 👋" }
                        ]
                    },
                    {
                        "type": "paragraph",
                        "content": [
                            { "type": "text", "text": "Kolam Ikan is your personal thinking space. Here's how it works:" }
                        ]
                    },
                    {
                        "type": "orderedList",
                        "content": [
                            {
                                "type": "listItem",
                                "content": [{
                                    "type": "paragraph",
                                    "content": [
                                        { "type": "text", "marks": [{ "type": "bold" }], "text": "Write freely" },
                                        { "type": "text", "text": " - Just start typing your thoughts." }
                                    ]
                                }]
                            },
                            {
                                "type": "listItem",
                                "content": [{
                                    "type": "paragraph",
                                    "content": [
                                        { "type": "text", "marks": [{ "type": "bold" }], "text": "Stage context" },
                                        { "type": "text", "text": " - Check the boxes next to entries you want to send to AI." }
                                    ]
                                }]
                            },
                            {
                                "type": "listItem",
                                "content": [{
                                    "type": "paragraph",
                                    "content": [
                                        { "type": "text", "marks": [{ "type": "bold" }], "text": "Choose a directive" },
                                        { "type": "text", "text": " - DUMP (refactor), CRITIQUE (find gaps), or GENERATE (expand)." }
                                    ]
                                }]
                            },
                            {
                                "type": "listItem",
                                "content": [{
                                    "type": "paragraph",
                                    "content": [
                                        { "type": "text", "marks": [{ "type": "bold" }], "text": "Copy & paste" },
                                        { "type": "text", "text": " - Use the bridge buttons to connect with ChatGPT, Claude, or Gemini." }
                                    ]
                                }]
                            }
                        ]
                    }
                ]
            });

            conn.execute(
                "INSERT INTO entries (id, user_id, stream_id, role, content, sequence_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    entry1_id,
                    "default-user",
                    stream_id,
                    "user",
                    entry1_content.to_string(),
                    1,
                    now,
                    now
                ],
            )?;

            // Create second empty entry
            let entry2_id = uuid::Uuid::new_v4().to_string();
            let entry2_content = serde_json::json!({
                "type": "doc",
                "content": [
                    {
                        "type": "paragraph",
                        "content": []
                    }
                ]
            });

            conn.execute(
                "INSERT INTO entries (id, user_id, stream_id, role, content, sequence_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    entry2_id,
                    "default-user",
                    stream_id,
                    "user",
                    entry2_content.to_string(),
                    2,
                    now + 1,
                    now + 1
                ],
            )?;
        }

        Ok(())
    }
}
