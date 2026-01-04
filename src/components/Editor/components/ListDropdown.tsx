import type { Editor } from '@tiptap/react';
import {
  List,
  ListOrdered,
  CheckSquare,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToolbarButton } from '@/components/ui/toolbar';
import { cn } from '@/lib/utils';

interface ListDropdownProps {
  editor: Editor;
}

const listOptions = [
  { 
    type: 'bulletList', 
    label: 'Bullet List', 
    icon: List,
    toggle: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
  },
  { 
    type: 'orderedList', 
    label: 'Numbered List', 
    icon: ListOrdered,
    toggle: (editor: Editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  { 
    type: 'taskList', 
    label: 'Task List', 
    icon: CheckSquare,
    toggle: (editor: Editor) => editor.chain().focus().toggleTaskList().run(),
  },
] as const;

export function ListDropdown({ editor }: ListDropdownProps) {
  const getCurrentList = () => {
    for (const option of listOptions) {
      if (editor.isActive(option.type)) {
        return option;
      }
    }
    return null;
  };

  const currentList = getCurrentList();
  const CurrentIcon = currentList?.icon ?? List;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className="w-auto px-2 gap-1"
          isActive={!!currentList}
          aria-label="List options"
        >
          <CurrentIcon className="h-4 w-4" />
          <ChevronDown className="h-3 w-3 opacity-50" />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {listOptions.map((option) => {
          const Icon = option.icon;
          const isActive = editor.isActive(option.type);
          
          return (
            <DropdownMenuItem
              key={option.type}
              onClick={() => option.toggle(editor)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isActive && 'bg-accent'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{option.label}</span>
              {isActive && <span className="ml-auto text-primary">✓</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
