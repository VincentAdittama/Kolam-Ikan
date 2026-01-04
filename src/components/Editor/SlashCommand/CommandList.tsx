import {
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Editor, type Range } from '@tiptap/core';

interface CommandItem {
  title: string;
  description: string;
  icon: LucideIcon;
  command: (props: { editor: Editor; range: Range }) => void;
}

interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  onSelect?: () => void;
}

export const CommandList = forwardRef<{ onKeyDown: (props: { event: globalThis.KeyboardEvent }) => boolean }, CommandListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevItems, setPrevItems] = useState(props.items);

  if (props.items !== prevItems) {
    setPrevItems(props.items);
    setSelectedIndex(0);
  }

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
      if (props.onSelect) {
        props.onSelect();
      }
    }
  };


  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: globalThis.KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }

      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }

      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="z-50 min-w-[280px] overflow-y-auto max-h-[450px] rounded-xl border bg-popover/95 backdrop-blur-md p-1.5 text-popover-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-200">
      {props.items && props.items.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Commands
          </div>
          {props.items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={index}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-150',
                  index === selectedIndex 
                    ? 'bg-primary text-primary-foreground shadow-sm scale-[1.02]' 
                    : 'hover:bg-accent hover:text-accent-foreground'
                )}
                onClick={() => selectItem(index)}
              >
                <div className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border shadow-sm transition-colors",
                  index === selectedIndex 
                    ? "bg-primary-foreground/20 border-primary-foreground/30" 
                    : "bg-background group-hover:border-accent-foreground/20"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="text-sm font-semibold truncate leading-none">{item.title}</span>
                  <span className={cn(
                    "text-[11px] truncate leading-tight",
                    index === selectedIndex ? "text-primary-foreground/80" : "text-muted-foreground"
                  )}>{item.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
          <p>No commands found</p>
        </div>
      )}
    </div>
  );
});

CommandList.displayName = 'CommandList';
