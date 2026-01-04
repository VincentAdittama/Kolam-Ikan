import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { Link, ExternalLink, Unlink } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ToolbarButton } from '@/components/ui/toolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LinkPopoverProps {
  editor: Editor;
}

export function LinkPopover({ editor }: LinkPopoverProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  
  const isActive = editor.isActive('link');
  const currentUrl = editor.getAttributes('link').href || '';

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      // Sync URL when opening
      setUrl(currentUrl);
    }
    setOpen(newOpen);
  };

  const handleSetLink = useCallback(() => {
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      // Ensure URL has protocol
      let finalUrl = url;
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: finalUrl })
        .run();
    }
    setOpen(false);
  }, [editor, url]);

  const handleRemoveLink = useCallback(() => {
    editor.chain().focus().unsetLink().run();
    setOpen(false);
  }, [editor]);

  const handleOpenLink = useCallback(() => {
    if (currentUrl) {
      window.open(currentUrl, '_blank');
    }
  }, [currentUrl]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSetLink();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <ToolbarButton
          isActive={isActive}
          aria-label="Link"
        >
          <Link className="h-4 w-4" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="link-url" className="text-xs font-medium">
              URL
            </Label>
            <Input
              id="link-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSetLink}
              className="flex-1 h-7 text-xs"
            >
              {isActive ? 'Update Link' : 'Add Link'}
            </Button>
            {isActive && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenLink}
                  className="h-7 w-7 p-0"
                  title="Open link"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRemoveLink}
                  className="h-7 w-7 p-0"
                  title="Remove link"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
