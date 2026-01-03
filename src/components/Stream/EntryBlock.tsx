import { useState, useMemo, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
// Removed unused Link import
// Removed unused Link import-list';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { common, createLowlight } from 'lowlight';
import {
  User,
  Bot,
  History,
  MoreVertical,
  Trash2,
  GitCommit,
  Link as LinkIcon,
  Sparkles,
  FileDiff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
// Removed unused Dialog imports
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatEntryTime, debounce } from '@/lib/utils';
import { devLog } from '@/lib/devLogger';
import { useAppStore } from '@/store/appStore';
import { useLatestVersion } from '@/hooks/useQueries';
import type { Entry } from '@/types';
import type { JSONContent } from '@tiptap/react';
import { getAIProviderIcon, getAIProviderColor } from '@/types';
import * as api from '@/services/api';
import { EditorToolbar } from './EditorToolbar';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { CommitDialog } from './CommitDialog';

const lowlight = createLowlight(common);

interface EntryBlockProps {
  entry: Entry;
}

// Simple text extraction from JSON content for comparison
function extractTextFromContent(content: JSONContent): string {
  const lines: string[] = [];
  
  function traverse(node: JSONContent) {
    if (node.text) {
      lines.push(node.text);
    }
    if (node.content) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  }
  
  traverse(content);
  return lines.join('\n');
}

export function EntryBlock({ entry }: EntryBlockProps) {
  const {
    stagedEntryIds,
    toggleStaging,
    updateEntry,
    removeEntry,
  } = useAppStore();

  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  
  // Fetch latest version to check for uncommitted changes
  const { data: latestVersion } = useLatestVersion(entry.id);

  const isStaged = stagedEntryIds.has(entry.id);
  const isUser = entry.role === 'user';
  
  // Check if there are uncommitted changes
  const hasUncommittedChanges = useMemo(() => {
    if (!latestVersion) {
      // No versions exist yet - any content is uncommitted
      return entry.versionHead === 0;
    }
    const currentText = extractTextFromContent(entry.content);
    const latestText = extractTextFromContent(latestVersion.contentSnapshot);
    return currentText !== latestText;
  }, [latestVersion, entry.content, entry.versionHead]);

  // Debounced save function
  const debouncedSave = useMemo(
    () =>
      debounce(async (content: unknown) => {
        devLog.editorContent('Auto-save entry', entry.id);
        devLog.apiCall('PATCH', 'update_entry_content', { entryId: entry.id });
        try {
          await api.updateEntryContent(entry.id, content as import('@tiptap/react').JSONContent);
          devLog.apiSuccess('update_entry_content', { entryId: entry.id });
        } catch (error) {
          devLog.apiError('update_entry_content', error);
        }
      }, 500),
    [entry.id]
  );

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false,
      }),
      Underline,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands or just start writing...",
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: entry.content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60px]',
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      devLog.editorAction('Content update', { entryId: entry.id, sequenceId: entry.sequenceId });
      updateEntry(entry.id, { content: json });
      debouncedSave(json);
    },
    onFocus: () => {
      devLog.focus(`Entry editor #${entry.sequenceId}`, { entryId: entry.id });
    },
    onBlur: () => {
      devLog.blur(`Entry editor #${entry.sequenceId}`, { entryId: entry.id });
    },
  });

  // Update editor content if entry changes externally
  useEffect(() => {
    if (editor && entry.content) {
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(entry.content);
      if (currentContent !== newContent) {
        editor.commands.setContent(entry.content);
      }
    }
  }, [editor, entry.content]);

  const handleDelete = async () => {
    devLog.deleteEntry(entry.id, entry.sequenceId);
    devLog.apiCall('DELETE', 'delete_entry', { entryId: entry.id });
    try {
      await api.deleteEntry(entry.id);
      devLog.apiSuccess('delete_entry', { entryId: entry.id });
      removeEntry(entry.id);
    } catch (error) {
      devLog.apiError('delete_entry', error);
      throw error;
    }
  };

  const handleShowCommitDialog = () => {
    devLog.commitVersion(entry.id, entry.versionHead + 1);
    setShowCommitDialog(true);
  };

  const handleShowVersionHistory = () => {
    devLog.click('Show Version History', { entryId: entry.id, sequenceId: entry.sequenceId });
    setShowVersionHistory(true);
  };

  const handleToggleStaging = async () => {
    if (isStaged) {
      devLog.unstage(entry.id, entry.sequenceId);
    } else {
      devLog.stage(entry.id, entry.sequenceId);
    }
    toggleStaging(entry.id);
    devLog.apiCall('PATCH', 'toggle_entry_staging', { entryId: entry.id, isStaged: !isStaged });
    try {
      await api.toggleEntryStaging(entry.id, !isStaged);
      devLog.apiSuccess('toggle_entry_staging');
    } catch (error) {
      devLog.apiError('toggle_entry_staging', error);
    }
  };

  return (
    <div
      className={cn(
        'group relative rounded-lg border transition-all',
        isStaged && 'ring-2 ring-primary ring-offset-2',
        isUser ? 'bg-background' : 'bg-muted/50'
      )}
    >
      {/* Entry Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Staging checkbox (only for user entries) */}
          {isUser && (
            <Checkbox
              checked={isStaged}
              onCheckedChange={handleToggleStaging}
            />
          )}

          {/* Avatar */}
          {isUser ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="h-4 w-4" />
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary overflow-hidden"
                  style={entry.aiMetadata ? { 
                    backgroundColor: `${getAIProviderColor(entry.aiMetadata.provider)}15`,
                    border: `1.5px solid ${getAIProviderColor(entry.aiMetadata.provider)}40`
                  } : undefined}
                >
                  {entry.aiMetadata ? (
                    <img 
                      src={getAIProviderIcon(entry.aiMetadata.provider)} 
                      alt={entry.aiMetadata.provider}
                      className="h-4 w-4"
                      style={{ filter: 'none' }}
                    />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
              </TooltipTrigger>
              {entry.aiMetadata && (
                <TooltipContent side="right" className="max-w-xs">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3 w-3" style={{ color: getAIProviderColor(entry.aiMetadata.provider) }} />
                      <span className="font-medium">{entry.aiMetadata.model}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Directive: {entry.aiMetadata.directive}
                    </span>
                    {entry.aiMetadata.summary && (
                      <span className="text-xs text-muted-foreground italic">
                        "{entry.aiMetadata.summary}"
                      </span>
                    )}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          )}

          {/* Sequence ID */}
          <span className="text-sm font-medium text-muted-foreground">
            #{entry.sequenceId}
          </span>

          {/* AI Model badge (for AI entries with metadata) */}
          {!isUser && entry.aiMetadata && (
            <span 
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ 
                backgroundColor: `${getAIProviderColor(entry.aiMetadata.provider)}15`,
                color: getAIProviderColor(entry.aiMetadata.provider),
              }}
            >
              <img 
                src={getAIProviderIcon(entry.aiMetadata.provider)} 
                alt={entry.aiMetadata.provider}
                className="h-3 w-3"
              />
              {entry.aiMetadata.model}
            </span>
          )}

          {/* Timestamp */}
          <span className="text-xs text-muted-foreground">
            {formatEntryTime(entry.createdAt)}
          </span>

          {/* Version badge */}
          {entry.versionHead > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleShowVersionHistory}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors",
                    "hover:bg-accent cursor-pointer",
                    hasUncommittedChanges 
                      ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300" 
                      : "bg-secondary"
                  )}
                >
                  <GitCommit className="h-3 w-3" />
                  v{entry.versionHead}
                  {hasUncommittedChanges && (
                    <FileDiff className="h-3 w-3 ml-0.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {entry.versionHead} committed version(s)
                  {hasUncommittedChanges && ' • Draft changes exist'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Click to view history</p>
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Uncommitted changes indicator (when no versions yet) */}
          {entry.versionHead === 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <FileDiff className="h-3 w-3" />
                  Draft
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Not yet committed</p>
                <p className="text-xs text-muted-foreground">Click the commit button to save a version</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Parent link indicator (for AI entries) */}
          {!isUser && entry.parentContextIds && entry.parentContextIds.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <LinkIcon className="h-3 w-3" />
                  Linked to #{entry.parentContextIds.length} entries
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Response to context entries</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7",
                  hasUncommittedChanges && "text-amber-600 dark:text-amber-400"
                )}
                onClick={() => {
                  devLog.click('Commit Version Button', { entryId: entry.id, sequenceId: entry.sequenceId });
                  handleShowCommitDialog();
                }}
              >
                <GitCommit className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Commit Version (Cmd+Shift+V)</p>
              {hasUncommittedChanges && (
                <p className="text-xs text-amber-500">Uncommitted changes</p>
              )}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => devLog.openMenu('Entry Options', { entryId: entry.id, sequenceId: entry.sequenceId })}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  devLog.menuAction('Entry Options', 'Show History', { entryId: entry.id });
                  handleShowVersionHistory();
                }}
              >
                <History className="mr-2 h-4 w-4" />
                Show History
                {entry.versionHead > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {entry.versionHead} versions
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  devLog.menuAction('Entry Options', 'Delete Entry', { entryId: entry.id });
                  handleDelete();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Entry
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Editor Toolbar (appears on focus) */}
      {editor && <EditorToolbar editor={editor} />}

      {/* Editor Content */}
      <div className="px-4 py-3">
        <EditorContent editor={editor} />
      </div>
      
      {/* Version History Dialog */}
      <VersionHistoryDialog
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
        entry={entry}
      />
      
      {/* Commit Dialog */}
      <CommitDialog
        open={showCommitDialog}
        onOpenChange={setShowCommitDialog}
        entry={entry}
      />
    </div>
  );
}
