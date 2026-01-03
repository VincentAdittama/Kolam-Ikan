import { useState } from 'react';
import { GitCommit, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCommitVersion } from '@/hooks/useQueries';
import type { Entry } from '@/types';

interface CommitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: Entry;
  onSuccess?: () => void;
}

export function CommitDialog({ 
  open, 
  onOpenChange, 
  entry,
  onSuccess 
}: CommitDialogProps) {
  const [message, setMessage] = useState('');
  const commitMutation = useCommitVersion();
  
  const handleCommit = async () => {
    await commitMutation.mutateAsync({
      entryId: entry.id,
      message: message.trim() || undefined,
    });
    setMessage('');
    onOpenChange(false);
    onSuccess?.();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommit();
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Commit Version
          </DialogTitle>
          <DialogDescription>
            Create a snapshot of entry #{entry.sequenceId}. 
            This will be version {entry.versionHead + 1}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="commit-message" className="text-sm font-medium">
              Commit message <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              id="commit-message"
              placeholder="Describe what changed..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              A brief description helps you remember why you made this change.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCommit}
            disabled={commitMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {commitMutation.isPending ? 'Committing...' : 'Commit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
