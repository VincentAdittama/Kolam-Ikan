import React from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Link,
  Table,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editor: Editor;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  isActive?: boolean;
  onClick: () => void;
}

function ToolbarButton({ icon, label, shortcut, isActive, onClick }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7', isActive && 'bg-accent')}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
        {shortcut && <p className="text-xs text-muted-foreground">{shortcut}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 border-b px-2 py-1 overflow-x-auto">
      {/* Text Formatting */}
      <ToolbarButton
        icon={<Bold className="h-4 w-4" />}
        label="Bold"
        shortcut="Cmd+B"
        isActive={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={<Italic className="h-4 w-4" />}
        label="Italic"
        shortcut="Cmd+I"
        isActive={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={<Underline className="h-4 w-4" />}
        label="Underline"
        shortcut="Cmd+U"
        isActive={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        icon={<Strikethrough className="h-4 w-4" />}
        label="Strikethrough"
        shortcut="Cmd+Shift+S"
        isActive={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolbarButton
        icon={<Code className="h-4 w-4" />}
        label="Inline Code"
        shortcut="Cmd+Shift+C"
        isActive={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Headings */}
      <ToolbarButton
        icon={<Heading1 className="h-4 w-4" />}
        label="Heading 1"
        shortcut="Cmd+Alt+1"
        isActive={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        icon={<Heading2 className="h-4 w-4" />}
        label="Heading 2"
        shortcut="Cmd+Alt+2"
        isActive={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        icon={<Heading3 className="h-4 w-4" />}
        label="Heading 3"
        shortcut="Cmd+Alt+3"
        isActive={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Lists */}
      <ToolbarButton
        icon={<List className="h-4 w-4" />}
        label="Bullet List"
        shortcut="Cmd+Shift+8"
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={<ListOrdered className="h-4 w-4" />}
        label="Ordered List"
        shortcut="Cmd+Shift+7"
        isActive={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={<CheckSquare className="h-4 w-4" />}
        label="Task List"
        shortcut="Cmd+Shift+9"
        isActive={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Blocks */}
      <ToolbarButton
        icon={<Quote className="h-4 w-4" />}
        label="Blockquote"
        isActive={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        icon={<Minus className="h-4 w-4" />}
        label="Horizontal Rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <ToolbarButton
        icon={<Code className="h-4 w-4" />}
        label="Code Block"
        shortcut="Cmd+Alt+C"
        isActive={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />

      <div className="mx-1 h-4 w-px bg-border" />

      {/* Links & Tables */}
      <ToolbarButton
        icon={<Link className="h-4 w-4" />}
        label="Link"
        shortcut="Cmd+K"
        isActive={editor.isActive('link')}
        onClick={() => {
          const url = window.prompt('Enter URL:');
          if (url) {
            editor.chain().focus().setLink({ href: url }).run();
          }
        }}
      />
      <ToolbarButton
        icon={<Table className="h-4 w-4" />}
        label="Insert Table"
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      />
    </div>
  );
}
