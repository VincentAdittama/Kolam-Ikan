// ============================================================
// KOLAM IKAN - TYPE DEFINITIONS
// ============================================================

import type { JSONContent } from '@tiptap/react';

// ============================================================
// STREAM TYPES
// ============================================================

export interface Stream {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  color?: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StreamMetadata {
  id: string;
  title: string;
  entryCount: number;
  lastUpdated: number;
  pinned: boolean;
  color?: string;
  tags: string[];
}

export interface CreateStreamInput {
  title: string;
  description?: string;
  tags?: string[];
  color?: string;
}

// ============================================================
// ENTRY TYPES
// ============================================================

export type EntryRole = 'user' | 'ai';

export interface Entry {
  id: string;
  streamId: string;
  role: EntryRole;
  content: JSONContent; // ProseMirror JSON
  sequenceId: number;
  versionHead: number;
  isStaged: boolean;
  parentContextIds: string[] | null;
  createdAt: number;
  updatedAt: number;
}

export interface EntryNode extends Entry {
  spotlights?: Spotlight[];
  hasUncommittedChanges?: boolean;
}

export interface CreateEntryInput {
  streamId: string;
  role: EntryRole;
  content: JSONContent;
}

export interface UpdateEntryContentInput {
  entryId: string;
  content: JSONContent;
}

// ============================================================
// VERSION TYPES
// ============================================================

export interface EntryVersion {
  id: string;
  entryId: string;
  versionNumber: number;
  contentSnapshot: JSONContent;
  commitMessage?: string;
  committedAt: number;
}

export interface CreateVersionInput {
  entryId: string;
  commitMessage?: string;
}

export interface VersionDiff {
  added: string[];
  removed: string[];
  versionA: number;
  versionB: number;
}

// ============================================================
// SPOTLIGHT TYPES (Cmd+L Feature)
// ============================================================

export interface Spotlight {
  id: string;
  entryId: string;
  contextText: string;
  highlightedText: string;
  startOffset: number;
  endOffset: number;
}

export interface CreateSpotlightInput {
  entryId: string;
  contextText: string;
  highlightedText: string;
  startOffset: number;
  endOffset: number;
}

// ============================================================
// DIRECTIVE TYPES
// ============================================================

export type DirectiveType = 'DUMP' | 'CRITIQUE' | 'GENERATE';

export interface DirectiveConfig {
  type: DirectiveType;
  label: string;
  description: string;
  icon: string;
  template: string;
}

export const DIRECTIVES: Record<DirectiveType, DirectiveConfig> = {
  DUMP: {
    type: 'DUMP',
    label: 'Dump',
    description: 'Refactor & Restructure',
    icon: 'RefreshCw',
    template: `<directive>
You are a thinking partner helping to refactor and restructure notes.

TASK: Analyze the provided context and improve its organization, clarity, and coherence.

Focus on:
- Logical flow and structure
- Removing redundancy
- Clarifying ambiguous points
- Suggesting better organization (headings, lists, groupings)
- Preserving all original information (do not omit important details)

Provide your refactored version with a brief explanation of major changes.
</directive>

<context>
{STAGED_BLOCKS}
</context>`,
  },
  CRITIQUE: {
    type: 'CRITIQUE',
    label: 'Critique',
    description: 'Find Gaps & Issues',
    icon: 'Search',
    template: `<directive>
You are a critical thinking partner analyzing these notes.

TASK: Identify logical gaps, inconsistencies, missing information, and potential improvements.

Structure your critique:
1. **Strengths:** What works well (be brief)
2. **Gaps:** Missing information or unexplored angles
3. **Inconsistencies:** Conflicting statements or logic errors
4. **Questions:** Key questions that need answers
5. **Recommendations:** Specific next steps

Be constructive and specific. Cite which parts you're referencing.
</directive>

<context>
{STAGED_BLOCKS}
</context>`,
  },
  GENERATE: {
    type: 'GENERATE',
    label: 'Generate',
    description: 'Expand & Elaborate',
    icon: 'Sparkles',
    template: `<directive>
You are a creative thinking partner helping to expand these notes.

TASK: Generate new content that builds upon, complements, or extends the provided context.

Guidelines:
- Maintain consistency with existing ideas
- Add concrete examples, details, or elaborations
- Explore implications or applications
- Suggest related concepts or connections
- Clearly mark speculative ideas vs. extensions of stated facts

Format your additions in a way that integrates naturally with the existing notes.
</directive>

<context>
{STAGED_BLOCKS}
</context>`,
  },
};

// ============================================================
// BRIDGE TYPES
// ============================================================

export interface BridgeExport {
  bridgeKey: string;
  prompt: string;
  stagedEntryIds: string[];
  directive: DirectiveType;
  timestamp: number;
  tokenEstimate: number;
}

export interface BridgeImportResult {
  success: boolean;
  entry?: Entry;
  warning?: string;
  bridgeKeyMatch: boolean;
}

export interface PendingBlock {
  id: string;
  streamId: string;
  bridgeKey: string;
  stagedContextIds: string[];
  directive: DirectiveType;
  createdAt: number;
}

// ============================================================
// TOKEN COUNTER TYPES
// ============================================================

export type ModelType = 'gpt4-turbo' | 'claude-sonnet' | 'gemini-pro' | 'default';

export interface ModelConfig {
  id: ModelType;
  name: string;
  tokenLimit: number;
  warningThreshold: number;
}

export const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  'gpt4-turbo': {
    id: 'gpt4-turbo',
    name: 'GPT-4 Turbo',
    tokenLimit: 128000,
    warningThreshold: 100000,
  },
  'claude-sonnet': {
    id: 'claude-sonnet',
    name: 'Claude Sonnet',
    tokenLimit: 200000,
    warningThreshold: 180000,
  },
  'gemini-pro': {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    tokenLimit: 128000,
    warningThreshold: 100000,
  },
  default: {
    id: 'default',
    name: 'Default',
    tokenLimit: 4000,
    warningThreshold: 3200,
  },
};

export interface TokenUsage {
  used: number;
  limit: number;
  percentage: number;
  status: 'normal' | 'warning' | 'critical' | 'exceeded';
}

// ============================================================
// UI STATE TYPES
// ============================================================

export interface AppState {
  activeStreamId: string | null;
  selectedDirective: DirectiveType;
  selectedModel: ModelType;
  sidebarVisible: boolean;
  rightPanelVisible: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface SearchResult {
  streamId: string;
  streamTitle: string;
  entryId: string;
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

// ============================================================
// ERROR TYPES
// ============================================================

export interface AppError {
  code: string;
  message: string;
  details?: string;
}

export type ClipboardErrorType = 
  | 'EMPTY_CLIPBOARD'
  | 'INVALID_CONTENT'
  | 'BRIDGE_KEY_MISMATCH'
  | 'BRIDGE_KEY_MISSING';

export interface ClipboardError extends AppError {
  type: ClipboardErrorType;
  expectedKey?: string;
  foundKey?: string;
}

// ============================================================
// IPC COMMAND TYPES (Tauri)
// ============================================================

export interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
}
