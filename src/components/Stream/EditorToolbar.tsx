import { useEffect, useState, useRef, useLayoutEffect } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Quote,
  Minus,
  Table,
  Undo,
  Redo,
  Superscript,
  Subscript,
  MoreHorizontal,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarButton,
} from '@/components/ui/toolbar';
import {
  HeadingDropdown,
  ListDropdown,
  ColorHighlightPopover,
  TextAlignButtons,
  LinkPopover,
} from '@/components/Editor/components';
import { devLog } from '@/lib/devLogger';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editor: Editor;
}

interface ToolbarItemProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToolbarItem({ icon, label, shortcut, isActive, disabled, onClick }: ToolbarItemProps) {
  const handleClick = () => {
    devLog.editorAction(`Toolbar: ${label}`, { shortcut, wasActive: isActive });
    onClick();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToolbarButton
          isActive={isActive}
          disabled={disabled}
          onClick={handleClick}
          aria-label={label}
        >
          {icon}
        </ToolbarButton>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={5}>
        <p className="font-medium">{label}</p>
        {shortcut && <p className="text-xs text-muted-foreground">{shortcut}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

// Items that go in overflow menu when space is limited
interface OverflowItem {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  isActive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  separator?: boolean;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const [, setUpdateCount] = useState(0);
  const [toolbarWidth, setToolbarWidth] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Measure toolbar width
  useLayoutEffect(() => {
    const measure = () => {
      if (toolbarRef.current) {
        setToolbarWidth(toolbarRef.current.offsetWidth);
      }
    };
    
    measure();
    
    const observer = new ResizeObserver(measure);
    if (toolbarRef.current) {
      observer.observe(toolbarRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      setUpdateCount((c) => c + 1);
    };

    editor.on('selectionUpdate', handleUpdate);
    editor.on('transaction', handleUpdate);

    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('transaction', handleUpdate);
    };
  }, [editor]);

  if (!editor) return null;

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  // Breakpoints for responsive toolbar
  const isCompact = toolbarWidth < 600;
  const isVeryCompact = toolbarWidth < 400;

  // Define overflow items
  const overflowItems: OverflowItem[] = [
    ...(isCompact ? [
      {
        icon: <Superscript className="h-4 w-4" />,
        label: 'Superscript',
        isActive: editor.isActive('superscript'),
        onClick: () => editor.chain().focus().toggleSuperscript().run(),
      },
      {
        icon: <Subscript className="h-4 w-4" />,
        label: 'Subscript',
        isActive: editor.isActive('subscript'),
        onClick: () => editor.chain().focus().toggleSubscript().run(),
        separator: true,
      },
      {
        icon: <Minus className="h-4 w-4" />,
        label: 'Horizontal Rule',
        onClick: () => editor.chain().focus().setHorizontalRule().run(),
      },
      {
        icon: <Table className="h-4 w-4" />,
        label: 'Insert Table',
        onClick: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
        separator: true,
      },
      {
        icon: <Quote className="h-4 w-4" />,
        label: 'Blockquote',
        isActive: editor.isActive('blockquote'),
        onClick: () => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        icon: <Code className="h-4 w-4" />,
        label: 'Code Block',
        shortcut: '⌘⌥C',
        isActive: editor.isActive('codeBlock'),
        onClick: () => editor.chain().focus().toggleCodeBlock().run(),
      },
    ] : []),
    ...(isVeryCompact ? [
      { separator: true } as OverflowItem,
      {
        icon: <Strikethrough className="h-4 w-4" />,
        label: 'Strikethrough',
        shortcut: '⌘⇧S',
        isActive: editor.isActive('strike'),
        onClick: () => editor.chain().focus().toggleStrike().run(),
      },
      {
        icon: <Code className="h-4 w-4" />,
        label: 'Inline Code',
        shortcut: '⌘⇧C',
        isActive: editor.isActive('code'),
        onClick: () => editor.chain().focus().toggleCode().run(),
      },
    ] : []),
  ];

  return (
    <Toolbar>
      <div ref={toolbarRef} className="flex items-center gap-1 flex-wrap">
        {/* Undo / Redo - Always visible */}
        <ToolbarGroup>
          <ToolbarItem
            icon={<Undo className="h-4 w-4" />}
            label="Undo"
            shortcut="⌘Z"
            disabled={!canUndo}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarItem
            icon={<Redo className="h-4 w-4" />}
            label="Redo"
            shortcut="⌘⇧Z"
            disabled={!canRedo}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </ToolbarGroup>

        <ToolbarSeparator />

        {/* Headings & Lists - Always visible (dropdowns) */}
        <ToolbarGroup>
          <HeadingDropdown editor={editor} />
          <ListDropdown editor={editor} />
          {!isCompact && (
            <>
              <ToolbarItem
                icon={<Quote className="h-4 w-4" />}
                label="Blockquote"
                isActive={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              />
              <ToolbarItem
                icon={<Code className="h-4 w-4" />}
                label="Code Block"
                shortcut="⌘⌥C"
                isActive={editor.isActive('codeBlock')}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              />
            </>
          )}
        </ToolbarGroup>

        <ToolbarSeparator />

        {/* Text Formatting - Core always visible */}
        <ToolbarGroup>
          <ToolbarItem
            icon={<Bold className="h-4 w-4" />}
            label="Bold"
            shortcut="⌘B"
            isActive={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarItem
            icon={<Italic className="h-4 w-4" />}
            label="Italic"
            shortcut="⌘I"
            isActive={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarItem
            icon={<Underline className="h-4 w-4" />}
            label="Underline"
            shortcut="⌘U"
            isActive={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          {!isVeryCompact && (
            <>
              <ToolbarItem
                icon={<Strikethrough className="h-4 w-4" />}
                label="Strikethrough"
                shortcut="⌘⇧S"
                isActive={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}
              />
              <ToolbarItem
                icon={<Code className="h-4 w-4" />}
                label="Inline Code"
                shortcut="⌘⇧C"
                isActive={editor.isActive('code')}
                onClick={() => editor.chain().focus().toggleCode().run()}
              />
            </>
          )}
        </ToolbarGroup>

        <ToolbarSeparator />

        {/* Highlight & Link - Always visible */}
        <ToolbarGroup>
          <ColorHighlightPopover editor={editor} />
          <LinkPopover editor={editor} />
        </ToolbarGroup>

        {/* Text Alignment - Visible on medium+ screens */}
        {!isCompact && (
          <>
            <ToolbarSeparator />
            <TextAlignButtons editor={editor} />
          </>
        )}

        {/* Superscript / Subscript - Visible on large screens */}
        {!isCompact && (
          <>
            <ToolbarSeparator />
            <ToolbarGroup>
              <ToolbarItem
                icon={<Superscript className="h-4 w-4" />}
                label="Superscript"
                isActive={editor.isActive('superscript')}
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
              />
              <ToolbarItem
                icon={<Subscript className="h-4 w-4" />}
                label="Subscript"
                isActive={editor.isActive('subscript')}
                onClick={() => editor.chain().focus().toggleSubscript().run()}
              />
            </ToolbarGroup>
          </>
        )}

        {/* Blocks - Visible on large screens */}
        {!isCompact && (
          <>
            <ToolbarSeparator />
            <ToolbarGroup>
              <ToolbarItem
                icon={<Minus className="h-4 w-4" />}
                label="Horizontal Rule"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              />
              <ToolbarItem
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
            </ToolbarGroup>
          </>
        )}

        {/* Overflow Menu - Visible when compact */}
        {overflowItems.length > 0 && (
          <>
            <ToolbarSeparator />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarButton aria-label="More options">
                  <MoreHorizontal className="h-4 w-4" />
                </ToolbarButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {/* Text Alignment in overflow when compact */}
                {isCompact && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Text Alignment
                    </div>
                    <div className="flex items-center justify-center gap-1 px-2 py-1">
                      <TextAlignButtons editor={editor} />
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                
                {overflowItems.map((item, idx) => {
                  if (item.separator) {
                    return <DropdownMenuSeparator key={`sep-${idx}`} />;
                  }
                  return (
                    <DropdownMenuItem
                      key={item.label}
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className={cn(
                        'flex items-center gap-2 cursor-pointer',
                        item.isActive && 'bg-accent'
                      )}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {item.shortcut}
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </Toolbar>
  );
}
