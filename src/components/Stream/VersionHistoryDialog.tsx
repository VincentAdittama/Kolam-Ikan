import { useState, useMemo, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { 
  GitCommit, 
  RotateCcw, 
  ChevronRight,
  Clock,
  MessageSquare,
  GitCompare,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatEntryTime } from '@/lib/utils';
import { useEntryVersions, useRevertToVersion, useCommitVersion } from '@/hooks/useQueries';
import type { Entry, EntryVersion } from '@/types';
import type { JSONContent } from '@tiptap/react';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: Entry;
}

// Simple text extraction from JSON content for diff comparison
function extractTextFromContent(content: JSONContent): string {
  const lines: string[] = [];
  
  function traverse(node: JSONContent) {
    if (node.text) {
      lines.push(node.text);
    }
    if (node.content) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  }
  
  traverse(content);
  return lines.join('\n');
}

// Simple diff algorithm - returns added and removed lines
function computeSimpleDiff(
  oldContent: JSONContent,
  newContent: JSONContent
): { added: string[]; removed: string[]; unchanged: number } {
  const oldText = extractTextFromContent(oldContent);
  const newText = extractTextFromContent(newContent);
  
  const oldLines = oldText.split('\n').filter(l => l.trim());
  const newLines = newText.split('\n').filter(l => l.trim());
  
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);
  
  const added = newLines.filter(l => !oldSet.has(l));
  const removed = oldLines.filter(l => !newSet.has(l));
  const unchanged = oldLines.filter(l => newSet.has(l)).length;
  
  return { added, removed, unchanged };
}

// Read-only editor for version preview
function VersionPreview({ content }: { content: JSONContent }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
    ],
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
      },
    },
  });

  // Update editor content when the content prop changes
  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  return (
    <div className="rounded-md border bg-muted/30 p-4 max-h-[300px] overflow-y-auto">
      <EditorContent editor={editor} />
    </div>
  );
}

// Diff view component
function DiffView({ 
  oldVersion, 
  newVersion 
}: { 
  oldVersion: EntryVersion; 
  newVersion: EntryVersion | { contentSnapshot: JSONContent; versionNumber: string };
}) {
  const diff = useMemo(
    () => computeSimpleDiff(oldVersion.contentSnapshot, newVersion.contentSnapshot),
    [oldVersion.contentSnapshot, newVersion.contentSnapshot]
  );
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <GitCompare className="h-4 w-4" />
        <span>
          Comparing v{oldVersion.versionNumber} → v{newVersion.versionNumber}
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Removed lines */}
        <div className="space-y-1">
          <div className="text-sm font-medium text-red-500 flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            Removed ({diff.removed.length})
          </div>
          <div className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 max-h-[150px] overflow-y-auto">
            {diff.removed.length > 0 ? (
              diff.removed.map((line, i) => (
                <div key={i} className="text-sm text-red-700 dark:text-red-300 font-mono">
                  - {line}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground italic">No removals</div>
            )}
          </div>
        </div>
        
        {/* Added lines */}
        <div className="space-y-1">
          <div className="text-sm font-medium text-green-500 flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-green-500" />
            Added ({diff.added.length})
          </div>
          <div className="rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-3 max-h-[150px] overflow-y-auto">
            {diff.added.length > 0 ? (
              diff.added.map((line, i) => (
                <div key={i} className="text-sm text-green-700 dark:text-green-300 font-mono">
                  + {line}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground italic">No additions</div>
            )}
          </div>
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground">
        {diff.unchanged} lines unchanged
      </div>
    </div>
  );
}

export function VersionHistoryDialog({ 
  open, 
  onOpenChange, 
  entry 
}: VersionHistoryDialogProps) {
  const [selectedVersion, setSelectedVersion] = useState<EntryVersion | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersionA, setCompareVersionA] = useState<EntryVersion | null>(null);
  
  const { data: versions, isLoading } = useEntryVersions(open ? entry.id : null);
  const revertMutation = useRevertToVersion();
  const commitMutation = useCommitVersion();
  
  // Check if current content differs from latest version
  const hasUncommittedChanges = useMemo(() => {
    if (!versions || versions.length === 0) return true;
    const latestVersion = versions[0];
    const currentText = extractTextFromContent(entry.content);
    const latestText = extractTextFromContent(latestVersion.contentSnapshot);
    return currentText !== latestText;
  }, [versions, entry.content]);
  
  const handleRevert = async (version: EntryVersion) => {
    await revertMutation.mutateAsync({
      entryId: entry.id,
      versionNumber: version.versionNumber,
    });
    // Auto-commit after revert
    await commitMutation.mutateAsync({
      entryId: entry.id,
      message: `Reverted to v${version.versionNumber}`,
    });
    onOpenChange(false);
  };
  
  const handleCompare = (version: EntryVersion) => {
    if (!compareMode) {
      setCompareMode(true);
      setCompareVersionA(version);
    } else {
      // Already in compare mode, select second version
      setSelectedVersion(version);
    }
  };
  
  const exitCompareMode = () => {
    setCompareMode(false);
    setCompareVersionA(null);
    setSelectedVersion(null);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            Entry #{entry.sequenceId} • {versions?.length || 0} committed versions
            {hasUncommittedChanges && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                Draft changes exist
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        {compareMode && (
          <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2">
            <span className="text-sm">
              {compareVersionA ? (
                <>
                  Selected v{compareVersionA.versionNumber}.{' '}
                  {selectedVersion 
                    ? 'Viewing diff...' 
                    : 'Select another version to compare.'}
                </>
              ) : (
                'Select first version to compare'
              )}
            </span>
            <Button variant="ghost" size="sm" onClick={exitCompareMode}>
              Exit Compare
            </Button>
          </div>
        )}
        
        <div className="flex-1 grid grid-cols-[250px_1fr] gap-4 min-h-0">
          {/* Version list */}
          <ScrollArea className="border rounded-md">
            <div className="p-2 space-y-1">
              {/* Current draft (if uncommitted changes exist) */}
              {hasUncommittedChanges && (
                <button
                  onClick={() => {
                    if (compareMode && compareVersionA) {
                      setSelectedVersion({
                        id: 'current',
                        entryId: entry.id,
                        versionNumber: versions?.[0]?.versionNumber 
                          ? versions[0].versionNumber + 1 
                          : 1,
                        contentSnapshot: entry.content,
                        committedAt: Date.now(),
                      } as EntryVersion);
                    } else {
                      setSelectedVersion(null);
                    }
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-md transition-colors',
                    'hover:bg-accent',
                    !selectedVersion && !compareMode && 'bg-accent',
                    'border-l-2 border-amber-500'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">Current Draft</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Modified just now
                  </div>
                </button>
              )}
              
              {isLoading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Loading versions...
                </div>
              ) : versions && versions.length > 0 ? (
                versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => {
                      if (compareMode) {
                        handleCompare(version);
                      } else {
                        setSelectedVersion(version);
                      }
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md transition-colors',
                      'hover:bg-accent',
                      selectedVersion?.id === version.id && 'bg-accent',
                      compareVersionA?.id === version.id && 'ring-2 ring-primary'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">v{version.versionNumber}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" />
                      {formatEntryTime(version.committedAt)}
                    </div>
                    {version.commitMessage && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
                        <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{version.commitMessage}</span>
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No versions yet. Commit your first version!
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Version preview / diff view */}
          <div className="border rounded-md p-4 overflow-hidden flex flex-col">
            {compareMode && compareVersionA && selectedVersion ? (
              <DiffView 
                oldVersion={compareVersionA} 
                newVersion={selectedVersion} 
              />
            ) : selectedVersion ? (
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Version {selectedVersion.versionNumber}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatEntryTime(selectedVersion.committedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCompare(selectedVersion)}
                        >
                          <GitCompare className="h-4 w-4 mr-1" />
                          Compare
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Compare with another version</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleRevert(selectedVersion)}
                          disabled={revertMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Revert
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Restore content to this version
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                
                {selectedVersion.commitMessage && (
                  <div className="flex items-start gap-2 text-sm bg-muted rounded-md p-2">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <span>{selectedVersion.commitMessage}</span>
                  </div>
                )}
                
                <div className="flex-1 overflow-hidden">
                  <VersionPreview content={selectedVersion.contentSnapshot} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <GitCommit className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Select a version to preview</p>
                  <p className="text-xs mt-1">or compare two versions</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
