// ============================================================
// KOLAM IKAN - TYPE DEFINITIONS
// ============================================================

import type { JSONContent } from "@tiptap/react";

// ============================================================
// AI PROVIDER TYPES (declared early for use in Entry)
// ============================================================

export type AIProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "meta"
  | "mistral"
  | "xai"
  | "other";

// ============================================================
// PROFILE TYPES
// ============================================================

export type ProfileRole = "self" | "friend" | "reference" | "ai";

export interface Profile {
  id: string;
  userId: string;
  name: string;
  role: ProfileRole;
  avatarUrl?: string;
  color?: string;
  initials?: string;
  bio?: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateProfileInput {
  userId: string;
  name: string;
  role: ProfileRole;
  color?: string;
  initials?: string;
  bio?: string;
}

export interface UpdateProfileInput {
  name?: string;
  role?: ProfileRole;
  color?: string;
  initials?: string;
  bio?: string;
  avatarUrl?: string;
}

// Profile color palette for visual distinction
export const PROFILE_COLORS = [
  "#3B82F6", // Blue (default for self)
  "#FF6B9D", // Pink
  "#C44569", // Rose
  "#5F27CD", // Purple
  "#0ABDE3", // Cyan
  "#10AC84", // Green
  "#F79F1F", // Orange
  "#EE5A6F", // Coral
  "#4834DF", // Indigo
  "#6C5CE7", // Lavender
  "#00CEC9", // Teal
  "#FDCB6E", // Yellow
  "#E17055", // Terra Cotta
  "#74B9FF", // Light Blue
  "#A29BFE", // Periwinkle
  "#FD79A8", // Hot Pink
  "#55EFC4", // Mint
  "#81ECEC", // Aqua
  "#FAB1A0", // Salmon
  "#636E72", // Gray
];

// ============================================================
// STREAM TYPES
// ============================================================

export interface Stream {
  id: string;
  userId: string;
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
  userId: string;
  title: string;
  entryCount: number;
  lastUpdated: number;
  pinned: boolean;
  color?: string;
  tags: string[];
}

export interface CreateStreamInput {
  userId: string;
  title: string;
  description?: string;
  tags?: string[];
  color?: string;
}

// ============================================================
// ENTRY TYPES
// ============================================================

export type EntryRole = "user" | "ai";

export interface AiMetadata {
  model: string; // e.g., "Claude 3.5 Sonnet"
  provider: AIProvider; // e.g., "anthropic"
  directive: DirectiveType; // which directive generated this
  bridgeKey: string; // link back to the prompt
  summary?: string; // AI's summary of what it did
}

export interface Entry {
  id: string;
  userId: string;
  streamId: string;
  profileId?: string;
  role: EntryRole;
  content: JSONContent; // ProseMirror JSON
  sequenceId: number;
  versionHead: number;
  isStaged: boolean;
  parentContextIds: string[] | null;
  createdAt: number;
  updatedAt: number;
  // AI-generated entry metadata (only for role === 'ai')
  aiMetadata?: AiMetadata;
  // Optional: Profile data when fetched with entry
  profile?: Profile;
}

export interface EntryNode extends Entry {
  spotlights?: Spotlight[];
  hasUncommittedChanges?: boolean;
}

export interface CreateEntryInput {
  userId: string;
  streamId: string;
  profileId?: string;
  role: EntryRole;
  content: JSONContent;
  aiMetadata?: AiMetadata;
  /** IDs of entries that were staged/used as context for this entry (for AI responses) */
  parentContextIds?: string[];
  insertAfterId?: string;
  insertBeforeId?: string;
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

export type DirectiveType = "DUMP" | "CRITIQUE" | "GENERATE";

export interface DirectiveConfig {
  type: DirectiveType;
  label: string;
  description: string;
  icon: string;
  template: string;
}

export const DIRECTIVES: Record<DirectiveType, DirectiveConfig> = {
  DUMP: {
    type: "DUMP",
    label: "Dump",
    description: "Refactor & Restructure",
    icon: "RefreshCw",
    template: `<directive>
You are a thinking partner helping to refactor and restructure notes.

TASK: Analyze the provided context and improve its organization, clarity, and coherence.

Focus on:
- Logical flow and structure
- Removing redundancy
- Clarifying ambiguous points
- Suggesting better organization (headings, lists, groupings)
- Preserving all original information (do not omit important details)
</directive>

<context>
{STAGED_BLOCKS}
</context>

<output_format>
You MUST wrap your entire response in the following structure:

<kolam_response bridge="{BRIDGE_KEY}" directive="DUMP">
<ai_model>YOUR_MODEL_NAME (e.g., Claude 3.5 Sonnet, GPT-4, Gemini Pro)</ai_model>
<summary>One-sentence summary of what you did</summary>
<content>
[Your refactored content here in Markdown format]
</content>
<changes>
- [Brief explanation of major change 1]
- [Brief explanation of major change 2]
</changes>
</kolam_response>

This structured format is REQUIRED for the application to process your response correctly.
</output_format>`,
  },
  CRITIQUE: {
    type: "CRITIQUE",
    label: "Critique",
    description: "Find Gaps & Issues",
    icon: "Search",
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
</context>

<output_format>
You MUST wrap your entire response in the following structure:

<kolam_response bridge="{BRIDGE_KEY}" directive="CRITIQUE">
<ai_model>YOUR_MODEL_NAME (e.g., Claude 3.5 Sonnet, GPT-4, Gemini Pro)</ai_model>
<summary>One-sentence summary of your critique</summary>
<content>
[Your critique content here in Markdown format, following the structure above]
</content>
<references>
- entry_id: [ID of entry referenced] | point: [What you referenced]
</references>
</kolam_response>

This structured format is REQUIRED for the application to process your response correctly.
</output_format>`,
  },
  GENERATE: {
    type: "GENERATE",
    label: "Generate",
    description: "Expand & Elaborate",
    icon: "Sparkles",
    template: `<directive>
You are a creative thinking partner helping to expand these notes.

TASK: Generate new content that builds upon, complements, or extends the provided context.

Guidelines:
- Maintain consistency with existing ideas
- Add concrete examples, details, or elaborations
- Explore implications or applications
- Suggest related concepts or connections
- Clearly mark speculative ideas vs. extensions of stated facts
</directive>

<context>
{STAGED_BLOCKS}
</context>

<output_format>
You MUST wrap your entire response in the following structure:

<kolam_response bridge="{BRIDGE_KEY}" directive="GENERATE">
<ai_model>YOUR_MODEL_NAME (e.g., Claude 3.5 Sonnet, GPT-4, Gemini Pro)</ai_model>
<summary>One-sentence summary of what you generated</summary>
<content>
[Your generated content here in Markdown format]
</content>
<sources>
- entry_id: [ID of entry this builds upon] | aspect: [What aspect you expanded]
</sources>
</kolam_response>

This structured format is REQUIRED for the application to process your response correctly.
</output_format>`,
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
  userId: string;
  streamId: string;
  bridgeKey: string;
  stagedContextIds: string[];
  directive: DirectiveType;
  createdAt: number;
}

// ============================================================
// AI PROVIDER UTILITIES
// ============================================================

export interface AIModelInfo {
  provider: AIProvider;
  modelName: string;
  displayName: string;
}

/**
 * Parse AI model string to provider info
 * e.g., "Claude 3.5 Sonnet" → { provider: 'anthropic', modelName: 'claude-3.5-sonnet', displayName: 'Claude 3.5 Sonnet' }
 */
export function parseAIModelString(modelString: string): AIModelInfo {
  const lower = modelString.toLowerCase();

  // Anthropic models
  if (lower.includes("claude")) {
    return {
      provider: "anthropic",
      modelName: lower.replace(/\s+/g, "-"),
      displayName: modelString,
    };
  }

  // OpenAI models
  if (
    lower.includes("gpt") ||
    lower.includes("openai") ||
    lower.includes("o1") ||
    lower.includes("o3")
  ) {
    return {
      provider: "openai",
      modelName: lower.replace(/\s+/g, "-"),
      displayName: modelString,
    };
  }

  // Google models
  if (
    lower.includes("gemini") ||
    lower.includes("palm") ||
    lower.includes("bard")
  ) {
    return {
      provider: "google",
      modelName: lower.replace(/\s+/g, "-"),
      displayName: modelString,
    };
  }

  // Meta models
  if (lower.includes("llama") || lower.includes("meta")) {
    return {
      provider: "meta",
      modelName: lower.replace(/\s+/g, "-"),
      displayName: modelString,
    };
  }

  // Mistral models
  if (lower.includes("mistral") || lower.includes("mixtral")) {
    return {
      provider: "mistral",
      modelName: lower.replace(/\s+/g, "-"),
      displayName: modelString,
    };
  }

  // xAI models (Grok)
  if (lower.includes("grok") || lower.includes("xai")) {
    return {
      provider: "xai",
      modelName: lower.replace(/\s+/g, "-"),
      displayName: modelString,
    };
  }

  return {
    provider: "other",
    modelName: lower.replace(/\s+/g, "-"),
    displayName: modelString,
  };
}

/**
 * Get avatar/icon path for AI provider
 */
export function getAIProviderIcon(provider: AIProvider): string {
  const icons: Record<AIProvider, string> = {
    anthropic: "/icons/ai/anthropic.svg",
    openai: "/icons/ai/openai.svg",
    google: "/icons/ai/google.svg",
    meta: "/icons/ai/meta.svg",
    mistral: "/icons/ai/mistral.svg",
    xai: "/icons/ai/grok.svg",
    other: "/icons/ai/generic.svg",
  };
  return icons[provider];
}

/**
 * Get brand color for AI provider
 */
export function getAIProviderColor(provider: AIProvider): string {
  const colors: Record<AIProvider, string> = {
    anthropic: "#D97757", // Anthropic orange/terra cotta
    openai: "#10A37F", // OpenAI/ChatGPT teal green
    google: "#4285F4", // Google blue
    meta: "#0668E1", // Meta blue
    mistral: "#F2A900", // Mistral orange/gold
    xai: "#F3F4F6", // xAI/Grok light gray (for contrast with black icons)
    other: "#9CA3AF", // Gray
  };
  return colors[provider];
}

// ============================================================
// TOKEN COUNTER TYPES
// ============================================================

export type ModelType =
  | "gpt4-turbo"
  | "claude-sonnet"
  | "gemini-pro"
  | "default";

export interface ModelConfig {
  id: ModelType;
  name: string;
  tokenLimit: number;
  warningThreshold: number;
}

export const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  "gpt4-turbo": {
    id: "gpt4-turbo",
    name: "GPT-4 Turbo",
    tokenLimit: 128000,
    warningThreshold: 100000,
  },
  "claude-sonnet": {
    id: "claude-sonnet",
    name: "Claude Sonnet",
    tokenLimit: 200000,
    warningThreshold: 180000,
  },
  "gemini-pro": {
    id: "gemini-pro",
    name: "Gemini Pro",
    tokenLimit: 128000,
    warningThreshold: 100000,
  },
  default: {
    id: "default",
    name: "Default",
    tokenLimit: 4000,
    warningThreshold: 3200,
  },
};

export interface TokenUsage {
  used: number;
  limit: number;
  percentage: number;
  status: "normal" | "warning" | "critical" | "exceeded";
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
  theme: "light" | "dark" | "system";
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
  | "EMPTY_CLIPBOARD"
  | "INVALID_CONTENT"
  | "BRIDGE_KEY_MISMATCH"
  | "BRIDGE_KEY_MISSING";

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

// ============================================================
// BRANCH VISUALIZATION TYPES
// ============================================================

export interface BranchNode {
  id: string;
  entryId: string;
  label: string;
  role: EntryRole;
  provider?: AIProvider;
  parentId: string | null;
  children: string[];
  depth: number;
  branchPath: number[]; // e.g., [0, 1, 0] means main -> first branch -> second sub-branch
  createdAt: number;
  versionNumber: number;
  isHead: boolean;
  isStaged: boolean;
  // Context dependency tracking
  parentContextIds?: string[];
  // Physics properties (populated by D3)
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null; // Fixed position
  fy?: number | null;

  // === VERSION-AWARE PROPERTIES (for detailed view) ===
  /** If this node is a version sub-node, this is the version number it represents */
  representedVersion?: number;
  /** True if this is a version sub-node (not the main block node) */
  isVersionNode?: boolean;
  /** The parent block's entry ID (for version nodes, this links back to the block) */
  blockEntryId?: string;
  /** If this block was created from a specific version of a parent, track it */
  parentVersionNumber?: number;
  /** Group ID for visual grouping of version nodes belonging to same block */
  versionGroupId?: string;
  /** Position within version group (0 = oldest, n = newest/current) */
  versionGroupIndex?: number;
  /** Total versions in this block's group */
  versionGroupTotal?: number;
  /** True if this version node is the "current" (HEAD) version of the block */
  isCurrentVersion?: boolean;
}

/** Extended link type for version-aware connections */
export interface BranchLink {
  id: string;
  source: string;
  target: string;
  isBranch: boolean; // true if this creates a new branch, false if linear
  strength: number;
  // === VERSION-AWARE PROPERTIES ===
  /** True if this link connects version nodes within same block */
  isVersionLink?: boolean;
  /** True if this link connects to a specific version (not just the block) */
  isVersionConnection?: boolean;
  /** The version number this link originates from (for version connections) */
  sourceVersionNumber?: number;
  /** Visual style hint */
  linkStyle?: "solid" | "dashed" | "dotted";
  // === CONTEXT DEPENDENCY (SYNAPSE) PROPERTIES ===
  /** True if this is a context dependency link (synapse) - shows which blocks were staged to create an AI response */
  isContextLink?: boolean;
}

export interface BranchTree {
  nodes: BranchNode[];
  links: BranchLink[];
  root: string | null;
  maxDepth: number;
  branchCount: number;
  // === VERSION-AWARE PROPERTIES ===
  /** Map of entry ID to version group boundaries for visual grouping */
  versionGroups?: Map<
    string,
    {
      nodeIds: string[];
      bounds?: { x: number; y: number; width: number; height: number };
    }
  >;
  /** True if this tree was built in detailed (version-expanded) mode */
  isDetailedView?: boolean;
}

export interface BranchVisualizationConfig {
  showLabels: boolean;
  showVersionNumbers: boolean;
  colorByRole: boolean;
  colorByProvider: boolean;
  physicsEnabled: boolean;
  gravityStrength: number;
  linkDistance: number;
  chargeStrength: number;
  collisionRadius: number;
  // === VERSION-AWARE PROPERTIES ===
  /** Show detailed view with version sub-nodes */
  detailedView?: boolean;
  /** Show version connections (which version created which child) */
  showVersionConnections?: boolean;
}
