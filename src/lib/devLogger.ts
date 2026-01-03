/**
 * Development Logger Utility
 * 
 * Provides comprehensive logging for user interactions in dev mode.
 * All logging is disabled in production builds.
 */

const isDev = import.meta.env.DEV;

// Color-coded console styling for different log types
const styles = {
  interaction: 'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  navigation: 'background: #2196F3; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  data: 'background: #9C27B0; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  action: 'background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  editor: 'background: #607D8B; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  staging: 'background: #E91E63; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  api: 'background: #00BCD4; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  bridge: 'background: #795548; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  ui: 'background: #3F51B5; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
  error: 'background: #F44336; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
};

type LogCategory = keyof typeof styles;

interface LogPayload {
  [key: string]: unknown;
}

function formatTimestamp(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
}

function log(category: LogCategory, action: string, payload?: LogPayload): void {
  if (!isDev) return;

  const timestamp = formatTimestamp();
  const style = styles[category];
  
  if (payload && Object.keys(payload).length > 0) {
    console.groupCollapsed(`%c${category.toUpperCase()}%c ${action} [${timestamp}]`, style, 'color: inherit;');
    console.log('Details:', payload);
    console.groupEnd();
  } else {
    console.log(`%c${category.toUpperCase()}%c ${action} [${timestamp}]`, style, 'color: inherit;');
  }
}

// ============================================================
// INTERACTION LOGGING
// ============================================================

export const devLog = {
  // UI Interactions
  click: (element: string, payload?: LogPayload) => {
    log('interaction', `Click: ${element}`, payload);
  },

  hover: (element: string, payload?: LogPayload) => {
    log('interaction', `Hover: ${element}`, payload);
  },

  focus: (element: string, payload?: LogPayload) => {
    log('interaction', `Focus: ${element}`, payload);
  },

  blur: (element: string, payload?: LogPayload) => {
    log('interaction', `Blur: ${element}`, payload);
  },

  // Navigation
  navigate: (from: string, to: string, payload?: LogPayload) => {
    log('navigation', `${from} → ${to}`, payload);
  },

  selectStream: (streamId: string, streamTitle?: string) => {
    log('navigation', `Select stream`, { streamId, streamTitle });
  },

  // Data Operations
  fetch: (resource: string, payload?: LogPayload) => {
    log('data', `Fetch: ${resource}`, payload);
  },

  create: (resource: string, payload?: LogPayload) => {
    log('data', `Create: ${resource}`, payload);
  },

  update: (resource: string, payload?: LogPayload) => {
    log('data', `Update: ${resource}`, payload);
  },

  delete: (resource: string, payload?: LogPayload) => {
    log('data', `Delete: ${resource}`, payload);
  },

  // Actions
  action: (actionName: string, payload?: LogPayload) => {
    log('action', actionName, payload);
  },

  // Editor Operations
  editorAction: (action: string, payload?: LogPayload) => {
    log('editor', action, payload);
  },

  editorContent: (action: string, entryId: string, contentPreview?: string) => {
    log('editor', action, { 
      entryId, 
      contentPreview: contentPreview?.substring(0, 100) + (contentPreview && contentPreview.length > 100 ? '...' : '') 
    });
  },

  // Staging Operations
  stage: (entryId: string, sequenceId: number) => {
    log('staging', `Stage entry`, { entryId, sequenceId });
  },

  unstage: (entryId: string, sequenceId?: number) => {
    log('staging', `Unstage entry`, { entryId, sequenceId });
  },

  clearStaging: (count: number) => {
    log('staging', `Clear all staging`, { entriesCleared: count });
  },

  // API Calls
  apiCall: (method: string, endpoint: string, payload?: LogPayload) => {
    log('api', `${method.toUpperCase()} ${endpoint}`, payload);
  },

  apiSuccess: (endpoint: string, payload?: LogPayload) => {
    log('api', `✓ Success: ${endpoint}`, payload);
  },

  apiError: (endpoint: string, error: unknown) => {
    log('error', `✗ API Error: ${endpoint}`, { error: String(error) });
  },

  // Bridge Operations
  bridgeCopy: (directive: string, tokenCount: number, entryCount: number) => {
    log('bridge', `Copy prompt`, { directive, tokenCount, entryCount });
  },

  bridgeImport: (bridgeKey: string, success: boolean) => {
    log('bridge', `Import response`, { bridgeKey, success });
  },

  // UI State
  toggleSidebar: (visible: boolean) => {
    log('ui', `Toggle sidebar`, { visible });
  },

  toggleRightPanel: (visible: boolean) => {
    log('ui', `Toggle right panel`, { visible });
  },

  openDialog: (dialogName: string) => {
    log('ui', `Open dialog: ${dialogName}`);
  },

  closeDialog: (dialogName: string) => {
    log('ui', `Close dialog: ${dialogName}`);
  },

  selectDirective: (directive: string) => {
    log('ui', `Select directive`, { directive });
  },

  selectModel: (model: string) => {
    log('ui', `Select model`, { model });
  },

  // Dropdown Menu
  openMenu: (menuName: string, payload?: LogPayload) => {
    log('ui', `Open menu: ${menuName}`, payload);
  },

  menuAction: (menuName: string, action: string, payload?: LogPayload) => {
    log('action', `${menuName}: ${action}`, payload);
  },

  // Keyboard Shortcuts
  shortcut: (keys: string, action: string) => {
    log('interaction', `Keyboard: ${keys}`, { action });
  },

  // Generic error logging
  error: (context: string, error: unknown) => {
    log('error', context, { error: String(error) });
  },

  // Version Control
  commitVersion: (entryId: string, versionNumber?: number) => {
    log('action', `Commit version`, { entryId, versionNumber });
  },

  revertVersion: (entryId: string, toVersion: number) => {
    log('action', `Revert to version`, { entryId, toVersion });
  },

  // Search
  search: (query: string) => {
    log('action', `Search`, { query });
  },

  // Stream Operations
  createStream: (title: string) => {
    log('data', `Create stream`, { title });
  },

  deleteStream: (streamId: string) => {
    log('data', `Delete stream`, { streamId });
  },

  pinStream: (streamId: string, pinned: boolean) => {
    log('action', `${pinned ? 'Pin' : 'Unpin'} stream`, { streamId });
  },

  renameStream: (streamId: string, newTitle: string) => {
    log('action', `Rename stream`, { streamId, newTitle });
  },

  // Entry Operations
  createEntry: (streamId: string, role: string) => {
    log('data', `Create entry`, { streamId, role });
  },

  deleteEntry: (entryId: string, sequenceId?: number) => {
    log('data', `Delete entry`, { entryId, sequenceId });
  },
};

// Export isDev for conditional rendering of debug components
export { isDev };
