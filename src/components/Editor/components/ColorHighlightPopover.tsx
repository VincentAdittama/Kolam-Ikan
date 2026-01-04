import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Highlighter } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ToolbarButton } from '@/components/ui/toolbar';
import { cn } from '@/lib/utils';

interface ColorHighlightPopoverProps {
  editor: Editor;
}

const highlightColors = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Lime', value: '#bef264' },
  { name: 'Cyan', value: '#67e8f9' },
  { name: 'Pink', value: '#f9a8d4' },
  { name: 'Orange', value: '#fdba74' },
  { name: 'Purple', value: '#c4b5fd' },
  { name: 'Red', value: '#fca5a5' },
  { name: 'Blue', value: '#93c5fd' },
];

export function ColorHighlightPopover({ editor }: ColorHighlightPopoverProps) {
  const [open, setOpen] = useState(false);
  
  const currentColor = editor.getAttributes('highlight').color;
  const isActive = editor.isActive('highlight');

  const handleColorSelect = (color: string) => {
    editor.chain().focus().toggleHighlight({ color }).run();
    setOpen(false);
  };

  const handleClearHighlight = () => {
    editor.chain().focus().unsetHighlight().run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton
          isActive={isActive}
          aria-label="Highlight"
          className="relative"
        >
          <Highlighter className="h-4 w-4" />
          {currentColor && (
            <div 
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full"
              style={{ backgroundColor: currentColor }}
            />
          )}
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Highlight Color</p>
          <div className="grid grid-cols-4 gap-1.5">
            {highlightColors.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => handleColorSelect(color.value)}
                className={cn(
                  'h-7 w-7 rounded-md border transition-all hover:scale-110',
                  currentColor === color.value && 'ring-2 ring-primary ring-offset-1'
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
          {isActive && (
            <button
              type="button"
              onClick={handleClearHighlight}
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              Remove highlight
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
