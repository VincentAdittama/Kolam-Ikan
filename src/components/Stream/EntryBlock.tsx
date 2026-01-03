import { useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatEntryTime, debounce } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import type { Entry } from '@/types';
import * as api from '@/services/api';
import { EditorToolbar } from './EditorToolbar';

const lowlight = createLowlight(common);

interface EntryBlockProps {
  entry: Entry;
}

export function EntryBlock({ entry }: EntryBlockProps) {
  const {
    stagedEntryIds,
    toggleStaging,
    updateEntry,
    removeEntry,
  } = useAppStore();

  const isStaged = stagedEntryIds.has(entry.id);
  const isUser = entry.role === 'user';

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (content: unknown) => {
      await api.updateEntryContent(entry.id, content as import('@tiptap/react').JSONContent);
    }, 500),
    [entry.id]
  );

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Use CodeBlockLowlight instead
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
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
      updateEntry(entry.id, { content: json });
      debouncedSave(json);
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
    await api.deleteEntry(entry.id);
    removeEntry(entry.id);
  };

  const handleCommitVersion = async () => {
    await api.commitEntryVersion(entry.id);
    // Could show a toast notification here
  };

  const handleToggleStaging = async () => {
    toggleStaging(entry.id);
    await api.toggleEntryStaging(entry.id, !isStaged);
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
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full',
              isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary'
            )}
          >
            {isUser ? (
              <User className="h-4 w-4" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
          </div>

          {/* Sequence ID */}
          <span className="text-sm font-medium text-muted-foreground">
            #{entry.sequenceId}
          </span>

          {/* Timestamp */}
          <span className="text-xs text-muted-foreground">
            {formatEntryTime(entry.createdAt)}
          </span>

          {/* Version badge */}
          {entry.versionHead > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                  <GitCommit className="h-3 w-3" />
                  v{entry.versionHead}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{entry.versionHead} committed version(s)</p>
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
                className="h-7 w-7"
                onClick={handleCommitVersion}
              >
                <GitCommit className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Commit Version</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <History className="mr-2 h-4 w-4" />
                Show History
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleDelete}
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
    </div>
  );
}
