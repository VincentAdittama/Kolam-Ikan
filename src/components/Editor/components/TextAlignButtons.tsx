import type { Editor } from '@tiptap/react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from 'lucide-react';
import { ToolbarButton, ToolbarGroup } from '@/components/ui/toolbar';

interface TextAlignButtonsProps {
  editor: Editor;
}

const alignOptions = [
  { alignment: 'left', icon: AlignLeft, label: 'Align left' },
  { alignment: 'center', icon: AlignCenter, label: 'Align center' },
  { alignment: 'right', icon: AlignRight, label: 'Align right' },
  { alignment: 'justify', icon: AlignJustify, label: 'Align justify' },
] as const;

export function TextAlignButtons({ editor }: TextAlignButtonsProps) {
  return (
    <ToolbarGroup>
      {alignOptions.map((option) => {
        const Icon = option.icon;
        return (
          <ToolbarButton
            key={option.alignment}
            isActive={editor.isActive({ textAlign: option.alignment })}
            onClick={() => editor.chain().focus().setTextAlign(option.alignment).run()}
            aria-label={option.label}
          >
            <Icon className="h-4 w-4" />
          </ToolbarButton>
        );
      })}
    </ToolbarGroup>
  );
}
