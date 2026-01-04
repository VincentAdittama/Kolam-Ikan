import React, { useState, useRef } from 'react';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import { devLog } from '@/lib/devLogger';
import { useStreamRefetch } from '@/hooks/useStreamRefetch';
import { EntryBlock } from '@/components/Stream/EntryBlock';
import * as api from '@/services/api';

interface SelectionRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function MainView() {
  const {
    currentStream,
    entries,
    activeStreamId,
    isLoadingEntries,
    addEntry,
    setCurrentStream,
    setLastCreatedEntryId,
    activeProfileId,
    stagedEntryIds,
    toggleStaging,
  } = useAppStore();

  const { refetchStreams } = useStreamRefetch();

  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [isEditingDescription, setIsEditingDescription] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  
  // Compact mode state
  const [isCompactMode, setIsCompactMode] = useState(false);

  // Rectangle selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleUpdateStream = async (updates: { title?: string; description?: string }) => {
    if (!activeStreamId) return;

    try {
      await api.updateStream(activeStreamId, updates);
      const updatedData = await api.getStreamDetails(activeStreamId);
      setCurrentStream(updatedData.stream);
      refetchStreams();
    } catch (error) {
      devLog.apiError('update_stream', error);
    }
  };

  const handleCreateEntry = async () => {
    if (!activeStreamId) return;

    devLog.createEntry(activeStreamId, 'user');
    devLog.click('New Entry Button', { streamId: activeStreamId, profileId: activeProfileId });

    const emptyContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [],
        },
      ],
    };

    devLog.apiCall('POST', 'create_entry', { streamId: activeStreamId, role: 'user', profileId: activeProfileId });

    try {
      const newEntry = await api.createEntry({
        streamId: activeStreamId,
        role: 'user',
        content: emptyContent,
        profileId: activeProfileId || undefined, // Use active profile as default author
      });

      devLog.apiSuccess('create_entry', { entryId: newEntry.id, sequenceId: newEntry.sequenceId });
      addEntry(newEntry);
      setLastCreatedEntryId(newEntry.id);
      // Refetch streams to update entry counts
      refetchStreams();
    } catch (error) {
      devLog.apiError('create_entry', error);
      throw error;
    }
  };

  // Rectangle Selection Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start selection if clicking directly on the scroll area background
    // (not on buttons, inputs, or inside entries if we want to avoid conflict)
    // For now, let's allow it if the target is the container or close to it
    if ((e.target as HTMLElement).closest('button, input, [role="button"], .ProseMirror')) {
        return;
    }

    setIsSelecting(true);
    const rect = scrollAreaRef.current?.getBoundingClientRect();
    if (rect) {
      setSelectionRect({
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selectionRect) return;
    
    setSelectionRect(prev => prev ? ({
      ...prev,
      currentX: e.clientX,
      currentY: e.clientY,
    }) : null);
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
     if (!isSelecting || !selectionRect) return;

    const isInverse = e.metaKey || e.ctrlKey; // Inverse selection with Cmd/Ctrl

    // Calculate selection bounds
    const left = Math.min(selectionRect.startX, selectionRect.currentX);
    const top = Math.min(selectionRect.startY, selectionRect.currentY);
    const width = Math.abs(selectionRect.currentX - selectionRect.startX);
    const height = Math.abs(selectionRect.currentY - selectionRect.startY);
    const right = left + width;
    const bottom = top + height;

    // Minimum drag distance to trigger selection (avoid accidental clicks)
    if (width > 5 || height > 5) {
      const entryElements = document.querySelectorAll('[data-entry-id]');
      
      const newStagings = new Map<string, boolean>();

      entryElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const entryId = el.getAttribute('data-entry-id');
        
        if (entryId) {
             // Check intersection
            const intersect = !(rect.left > right || 
                              rect.right < left || 
                              rect.top > bottom || 
                              rect.bottom < top);

            if (intersect) {
                // If inverse, flip state. If not inverse, select.
                // We need to know current state. We have stagedEntryIds from store.
                const isCurrentlyStaged = stagedEntryIds.has(entryId);
                
                if (isInverse) {
                    newStagings.set(entryId, !isCurrentlyStaged);
                } else {
                    newStagings.set(entryId, true);
                }
            }
        }
      });
      
      // Batch update logic would be ideal here if the store supports it,
      // but for now we'll iterate. To avoid race conditions or excessive renders,
      // it might be better to have a batchStaging action.
      // Assuming toggleStaging is fast enough for now.
      
      for (const [id, shouldStage] of newStagings) {
          // Optimization: only call if state needs to change
          if (stagedEntryIds.has(id) !== shouldStage) {
             toggleStaging(id);
             // We can fire async api calls here without awaiting them to keep UI snappy
             api.toggleEntryStaging(id, shouldStage).catch(console.error);
          }
      }
    }

    setIsSelecting(false);
    setSelectionRect(null);
  };

  // Selection Box Style
  const getSelectionBoxStyle = () => {
    if (!selectionRect) return {};
    const left = Math.min(selectionRect.startX, selectionRect.currentX);
    const top = Math.min(selectionRect.startY, selectionRect.currentY);
    const width = Math.abs(selectionRect.currentX - selectionRect.startX);
    const height = Math.abs(selectionRect.currentY - selectionRect.startY);

    return {
      left: left, // Relative to viewport, likely need to adjust if scroll area is positioned
      top: top,
      width,
      height,
    };
  };

  if (!currentStream) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">
            No stream selected
          </h2>
          <p className="text-muted-foreground">
            Select a stream from the sidebar or create a new one
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col relative">
      {/* Stream Header */}
      <div className="border-b px-6 py-4 flex items-start justify-between">
        <div className="flex-1">
            {isEditingTitle ? (
            <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => {
                if (editTitle.trim() && editTitle !== currentStream.title) {
                    handleUpdateStream({ title: editTitle.trim() });
                }
                setIsEditingTitle(false);
                }}
                onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    if (editTitle.trim() && editTitle !== currentStream.title) {
                    handleUpdateStream({ title: editTitle.trim() });
                    }
                    setIsEditingTitle(false);
                }
                if (e.key === 'Escape') {
                    setIsEditingTitle(false);
                }
                }}
                className="text-2xl font-bold h-auto py-0 px-0 border-none focus-visible:ring-0"
                autoFocus
            />
            ) : (
            <h1 
                className="text-2xl font-bold cursor-pointer hover:bg-accent/50 rounded px-1 -ml-1 transition-colors"
                onClick={() => {
                setEditTitle(currentStream.title);
                setIsEditingTitle(true);
                }}
            >
                {currentStream.title}
            </h1>
            )}
            
            {isEditingDescription ? (
            <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                onBlur={() => {
                if (editDescription !== (currentStream.description || '')) {
                    handleUpdateStream({ description: editDescription });
                }
                setIsEditingDescription(false);
                }}
                onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    if (editDescription !== (currentStream.description || '')) {
                    handleUpdateStream({ description: editDescription });
                    }
                    setIsEditingDescription(false);
                }
                if (e.key === 'Escape') {
                    setIsEditingDescription(false);
                }
                }}
                className="text-muted-foreground mt-1 h-auto py-0 px-0 border-none focus-visible:ring-0"
                placeholder="Add a description..."
                autoFocus
            />
            ) : (
            <p 
                className={cn(
                "text-muted-foreground mt-1 cursor-pointer hover:bg-accent/50 rounded px-1 -ml-1 transition-colors min-h-[1.5em]",
                !currentStream.description && "text-muted-foreground/50 italic text-sm"
                )}
                onClick={() => {
                setEditDescription(currentStream.description || '');
                setIsEditingDescription(true);
                }}
            >
                {currentStream.description || 'Add a description...'}
            </p>
            )}
        </div>
        
        {/* Toggle View Button */}
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCompactMode(!isCompactMode)}
            className="ml-4 text-muted-foreground hover:text-foreground"
            title={isCompactMode ? "Switch to Expanded View" : "Switch to Compact View"}
        >
            {isCompactMode ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        </Button>
      </div>

      {/* Entries */}
      <ScrollArea 
        className="flex-1 select-none" 
        ref={scrollAreaRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        >
        <div className="px-6 py-4 space-y-4">
          {isLoadingEntries ? (
            // Skeleton loaders
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="h-4 w-24 rounded bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-muted" />
                  <div className="h-4 w-3/4 rounded bg-muted" />
                </div>
              </div>
            ))
          ) : (
            <>
              {entries.map((entry, index) => (
                <React.Fragment key={entry.id}>
                  {/* Time gap indicator */}
                  {index > 0 && (
                    <TimeGapIndicator
                      prevTimestamp={entries[index - 1].createdAt}
                      currentTimestamp={entry.createdAt}
                    />
                  )}
                  <EntryBlock entry={entry} isCompact={isCompactMode} />
                </React.Fragment>
              ))}

              {/* New entry button */}
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={handleCreateEntry}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Entry
              </Button>
            </>
          )}
        </div>
      </ScrollArea>
      
      {/* Selection Box Overlay */}
      {isSelecting && selectionRect && (
        <div
            className="fixed border bg-primary/20 border-primary pointer-events-none z-50"
            style={getSelectionBoxStyle()}
        />
      )}
    </div>
  );
}

function TimeGapIndicator({
  prevTimestamp,
  currentTimestamp,
}: {
  prevTimestamp: number;
  currentTimestamp: number;
}) {
  const gap = currentTimestamp - prevTimestamp;
  const hours = gap / (1000 * 60 * 60);

  // Only show if gap is greater than 24 hours
  if (hours < 24) return null;

  const days = Math.floor(hours / 24);
  const prevDate = new Date(prevTimestamp).toLocaleDateString();
  const currentDate = new Date(currentTimestamp).toLocaleDateString();

  return (
    <div className="flex items-center justify-center py-2">
      <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-1 text-xs text-muted-foreground">
        <span>⏱️</span>
        <span>
          Time gap: {days} day{days > 1 ? 's' : ''} ({prevDate} → {currentDate})
        </span>
      </div>
    </div>
  );
}
