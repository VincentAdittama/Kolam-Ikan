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
import * as Diff from 'diff';
import type { Entry, EntryVersion } from '@/types';
import type { JSONContent } from '@tiptap/react';

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: Entry;
}

// Simple text extraction from JSON content for diff comparison
function extractTextFromContent(content: JSONContent): string {
  // Improved extraction that preserves paragraph structure better
  function sophisticatedTraverse(node: JSONContent): string {
    if (node.type === 'text') {
      return node.text || '';
    }
    
    let content = '';
    if (node.content) {
      content = node.content.map(child => sophisticatedTraverse(child)).join('');
    }
    
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock') {
      return content + '\n';
    }
    
    return content;
  }
  
  // Let's use the sophisticated one for better diffing.
  return sophisticatedTraverse(content);
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

  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  return (
    <div className="rounded-md border bg-muted/30 p-4 h-full overflow-y-auto">
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
  const diffParams = useMemo(() => {
    const oldText = extractTextFromContent(oldVersion.contentSnapshot);
    const newText = extractTextFromContent(newVersion.contentSnapshot);
    return { oldText, newText };
  }, [oldVersion, newVersion]);

  // Use diffChars for granular diffs as requested
  const diffChanges = useMemo(() => {
    return Diff.diffChars(diffParams.oldText, diffParams.newText);
  }, [diffParams]);
  
  return (
    <div className="flex flex-col h-full bg-background rounded-md overflow-hidden border">
      <div className="grid grid-cols-2 divide-x border-b bg-muted/50 text-sm font-medium shrink-0">
        <div className="p-3 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-600"></span>
            <span className="font-mono">v{oldVersion.versionNumber}</span> 
            <span className="text-muted-foreground font-normal">(Original)</span>
          </span>
        </div>
        <div className="p-3 flex items-center justify-between bg-green-50/50 dark:bg-green-950/20">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-600"></span>
            <span className="font-mono">v{newVersion.versionNumber}</span>
            <span className="text-muted-foreground font-normal">(Modified)</span>
          </span>
        </div>
      </div>
      
      <div className="flex-1 grid grid-cols-2 divide-x min-h-0">
        {/* Left Pane: Old Version */}
        <ScrollArea className="h-full">
          <div className="p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed">
            {diffChanges.map((part, index) => {
              if (part.added) return null;
              if (part.removed) {
                return (
                  <span key={index} className="bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-100 rounded-sm border-b-2 border-red-400 dark:border-red-700">
                    {part.value}
                  </span>
                );
              }
              return <span key={index} className="opacity-70">{part.value}</span>;
            })}
          </div>
        </ScrollArea>

        {/* Right Pane: New Version */}
        <ScrollArea className="h-full">
          <div className="p-4 font-mono text-sm whitespace-pre-wrap leading-relaxed">
            {diffChanges.map((part, index) => {
              if (part.removed) return null;
              if (part.added) {
                return (
                  <span key={index} className="bg-green-200 dark:bg-green-900/40 text-green-900 dark:text-green-100 rounded-sm border-b-2 border-green-400 dark:border-green-700">
                    {part.value}
                  </span>
                );
              }
              return <span key={index} className="opacity-70">{part.value}</span>;
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="bg-muted/30 p-2 text-xs text-muted-foreground border-t flex justify-between px-4 shrink-0">
         <span>highlighted text indicates changes</span>
         <div className="flex gap-4">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-400 rounded-full"/> Removed content</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-green-400 rounded-full"/> New content</span>
         </div>
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
  
  // Reset state when dialog closes/opens
  useEffect(() => {
    if (open) {
      setCompareMode(false);
      setCompareVersionA(null);
      // Don't auto-select to allow user to see "Select a version" prompt or maybe select latest?
      // Let's not auto-select to keep the empty state unless requested.
    }
  }, [open]);

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
      // If we have a selected version that is different, keep it as the second version
      if (selectedVersion && selectedVersion.id !== version.id) {
        // do nothing, let them compare
      } else {
        setSelectedVersion(null); // Force them to select another
      }
    } else {
      // Already in compare mode, select second version
      setSelectedVersion(version);
    }
  };
  
  const exitCompareMode = () => {
    setCompareMode(false);
    setCompareVersionA(null);
    if (!selectedVersion && compareVersionA) {
      setSelectedVersion(compareVersionA);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[90vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="p-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <GitCommit className="h-5 w-5" />
              Version History
            </DialogTitle>
            <DialogDescription className="text-base mt-1.5">
              Entry #{entry.sequenceId} • {versions?.length || 0} committed versions
              {hasUncommittedChanges && (
                <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                  Draft changes exist
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {compareMode && (
            <div className="mt-4 flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-4 py-3">
              <span className="text-sm font-medium">
                {compareVersionA ? (
                  <div className="flex items-center gap-2">
                    <span className="bg-background px-2 py-1 rounded border shadow-sm">v{compareVersionA.versionNumber}</span>
                    <span className="text-muted-foreground">selected for comparison.</span>
                    {selectedVersion ? (
                      <>
                        <span className="text-muted-foreground">Comparing with</span>
                        <span className="bg-background px-2 py-1 rounded border shadow-sm">v{selectedVersion.versionNumber}</span>
                      </>
                    ) : (
                      <span className="text-primary animate-pulse">Select another version to compare...</span>
                    )}
                  </div>
                ) : (
                  'Select first version to compare'
                )}
              </span>
              <Button variant="ghost" size="sm" onClick={exitCompareMode} className="h-8">
                Exit Compare
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex-1 grid grid-cols-[280px_1fr] min-h-0 bg-muted/10">
          {/* Version list */}
          <div className="border-r bg-background/50 flex flex-col min-h-0">
             <div className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
               Versions
             </div>
             <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {/* Current draft */}
                {hasUncommittedChanges && (
                  <button
                    onClick={() => {
                      const draftVersion = {
                        id: 'current',
                        entryId: entry.id,
                        versionNumber: versions?.[0]?.versionNumber 
                          ? versions[0].versionNumber + 1 
                          : 1,
                        contentSnapshot: entry.content,
                        committedAt: Date.now(),
                      } as EntryVersion;

                      if (compareMode) {
                        if (compareVersionA?.id !== 'current') setSelectedVersion(draftVersion);
                      } else {
                        setSelectedVersion(draftVersion);
                      }
                    }}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border shadow-sm transition-all',
                      'hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700',
                      'group relative overflow-hidden',
                      (selectedVersion?.id === 'current' || compareVersionA?.id === 'current') 
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-md ring-1 ring-amber-500/20' 
                        : 'border-l-4 border-l-amber-500 bg-card'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">Current Draft</span>
                      <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-950/50 px-1.5 py-0.5 rounded-sm">Unsaved</span>
                    </div>
                    <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      Latest unsaved changes
                    </div>
                  </button>
                )}
                
                {isLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
                    Loading versions...
                  </div>
                ) : versions && versions.length > 0 ? (
                  versions.map((version) => (
                    <button
                      key={version.id}
                      onClick={() => {
                        if (compareMode) {
                          if (compareVersionA?.id !== version.id) setSelectedVersion(version);
                        } else {
                          setSelectedVersion(version);
                        }
                      }}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border shadow-sm transition-all',
                        'hover:shadow-md hover:border-primary/50',
                        (selectedVersion?.id === version.id || compareVersionA?.id === version.id)
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-md' 
                          : 'bg-card border-border',
                        compareVersionA?.id === version.id && 'ring-2 ring-primary border-primary'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm flex items-center gap-1.5">
                          <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
                          v{version.versionNumber}
                        </span>
                        <ChevronRight className={cn(
                          "h-3.5 w-3.5 text-muted-foreground transition-transform",
                          selectedVersion?.id === version.id && "rotate-90"
                        )} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatEntryTime(version.committedAt)}
                      </div>
                      {version.commitMessage && (
                        <div className="mt-2 text-xs border-t pt-2 text-muted-foreground line-clamp-2">
                          {version.commitMessage}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                    No history found.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Version preview / diff view */}
          <div className="flex flex-col min-h-0 bg-background p-6">
            {compareMode && compareVersionA && selectedVersion ? (
              <DiffView 
                oldVersion={compareVersionA} 
                newVersion={selectedVersion} 
              />
            ) : selectedVersion ? (
              <div className="flex flex-col h-full space-y-4">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      Version {selectedVersion.versionNumber}
                      {selectedVersion.id === 'current' && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Draft</span>}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {formatEntryTime(selectedVersion.committedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          onClick={() => handleCompare(selectedVersion)}
                        >
                          <GitCompare className="h-4 w-4 mr-2" />
                          Compare
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Compare this version with another</TooltipContent>
                    </Tooltip>
                    
                    {selectedVersion.id !== 'current' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="default"
                            onClick={() => handleRevert(selectedVersion)}
                            disabled={revertMutation.isPending}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Revert to this
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Revert content to Version {selectedVersion.versionNumber}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                
                {selectedVersion.commitMessage && (
                  <div className="bg-muted/50 p-3 rounded-md border text-sm flex gap-2">
                    <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{selectedVersion.commitMessage}</span>
                  </div>
                )}
                
                <div className="flex-1 min-h-0 border rounded-md overflow-hidden shadow-sm">
                  <VersionPreview content={selectedVersion.contentSnapshot} />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4 opacity-60">
                <div className="p-6 bg-muted/50 rounded-full">
                  <GitCommit className="h-16 w-16" />
                </div>
                <div className="text-center max-w-sm">
                  <h3 className="text-lg font-medium text-foreground mb-1">No Version Selected</h3>
                  <p className="text-sm">Select a version from the sidebar to view its content or compare different versions.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

