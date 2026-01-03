# Kolam Ikan 🐟

**Personal Cognitive Operating System**

A chronological note-taking application designed to leverage free web-based AI (ChatGPT, Claude, Gemini) without API costs. Kolam Ikan acts as a structured bridge between local notes and external AI models.

## Features

- **Chronological Streams**: Notes flow in time-linear structure within Streams
- **Smart Context Staging**: Select specific entries to include in AI prompts
- **Bridge Protocol**: Export/import mechanism with validation keys
- **Three Directives**: DUMP (refactor), CRITIQUE (analyze), GENERATE (expand)
- **Version Control**: Commit and track changes to entries
- **Rich Text Editing**: Powered by Tiptap/ProseMirror
- **Token Counter**: Real-time estimation with model-specific limits
- **Dark Mode**: System default with manual toggle

## Tech Stack

- **Framework**: Tauri v2 (Rust + Webview)
- **Frontend**: React + TypeScript + Tailwind CSS
- **Editor**: Tiptap (Headless ProseMirror)
- **UI Components**: shadcn/ui (Radix UI)
- **State**: TanStack Query + Zustand
- **Database**: SQLite via Rusqlite
- **Icons**: Lucide React

## Project Structure

\`\`\`
kolam-ikan/
├── src/                    # Frontend source
│   ├── components/         # React components
│   │   ├── Layout/         # App layout (Sidebar, MainView, RightPanel)
│   │   ├── Stream/         # Entry blocks, editor
│   │   └── ui/             # shadcn/ui components
│   ├── hooks/              # React Query hooks
│   ├── lib/                # Utility functions
│   ├── services/           # API and bridge services
│   ├── store/              # Zustand store
│   └── types/              # TypeScript definitions
├── src-tauri/              # Rust backend
│   └── src/
│       ├── commands.rs     # Tauri IPC commands
│       ├── database.rs     # SQLite setup
│       └── models.rs       # Data structures
└── ...
\`\`\`

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri CLI](https://tauri.app/v2/guides/)

### Setup

\`\`\`bash
# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build
\`\`\`

## Keyboard Shortcuts

### Global
- \`Cmd+K\`: Open global search
- \`Cmd+N\`: Create new stream
- \`Cmd+/\`: Toggle shortcuts help

### Editing
- \`Cmd+Enter\`: Create new entry
- \`Cmd+Shift+V\`: Commit version

### Staging & Bridge
- \`Space\`: Toggle entry staging (when focused)
- \`Cmd+L\`: Stage selection as spotlight
- \`Cmd+Shift+C\`: Copy bridge prompt
- \`Cmd+Shift+V\`: Import AI response

### Directives
- \`Cmd+1\`: DUMP mode
- \`Cmd+2\`: CRITIQUE mode
- \`Cmd+3\`: GENERATE mode

## License

MIT
