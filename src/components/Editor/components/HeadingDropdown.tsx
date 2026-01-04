import type { Editor } from '@tiptap/react';
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Type,
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

interface HeadingDropdownProps {
  editor: Editor;
}

const headingOptions = [
  { level: 0, label: 'Paragraph', icon: Type },
  { level: 1, label: 'Heading 1', icon: Heading1 },
  { level: 2, label: 'Heading 2', icon: Heading2 },
  { level: 3, label: 'Heading 3', icon: Heading3 },
  { level: 4, label: 'Heading 4', icon: Heading4 },
  { level: 5, label: 'Heading 5', icon: Heading5 },
  { level: 6, label: 'Heading 6', icon: Heading6 },
] as const;

export function HeadingDropdown({ editor }: HeadingDropdownProps) {
  const getCurrentHeading = () => {
    for (let i = 1; i <= 6; i++) {
      if (editor.isActive('heading', { level: i })) {
        return headingOptions.find((h) => h.level === i);
      }
    }
    return headingOptions[0]; // Paragraph
  };

  const currentHeading = getCurrentHeading();
  const CurrentIcon = currentHeading?.icon ?? Type;

  const handleSelect = (level: number) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton
          className="w-auto px-2 gap-1"
          aria-label="Format text as heading"
        >
          <CurrentIcon className="h-4 w-4" />
          <ChevronDown className="h-3 w-3 opacity-50" />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {headingOptions.map((option) => {
          const Icon = option.icon;
          const isActive = option.level === 0
            ? !editor.isActive('heading')
            : editor.isActive('heading', { level: option.level });
          
          return (
            <DropdownMenuItem
              key={option.level}
              onClick={() => handleSelect(option.level)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isActive && 'bg-accent'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className={cn(
                option.level === 1 && 'text-xl font-bold',
                option.level === 2 && 'text-lg font-bold',
                option.level === 3 && 'text-base font-semibold',
                option.level === 4 && 'text-sm font-semibold',
                option.level === 5 && 'text-sm font-medium',
                option.level === 6 && 'text-xs font-medium',
              )}>
                {option.label}
              </span>
              {isActive && <span className="ml-auto text-primary">✓</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
