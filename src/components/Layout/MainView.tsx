import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import { devLog } from '@/lib/devLogger';
import { useStreamRefetch } from '@/hooks/useStreamRefetch';
import { EntryBlock } from '@/components/Stream/EntryBlock';
import * as api from '@/services/api';

export function MainView() {
  const {
    currentStream,
    entries,
    activeStreamId,
    isLoadingEntries,
    addEntry,
    setCurrentStream,
    setLastCreatedEntryId,
  } = useAppStore();

  const { refetchStreams } = useStreamRefetch();

  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [isEditingDescription, setIsEditingDescription] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');

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
    devLog.click('New Entry Button', { streamId: activeStreamId });

    const emptyContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [],
        },
      ],
    };

    devLog.apiCall('POST', 'create_entry', { streamId: activeStreamId, role: 'user' });

    try {
      const newEntry = await api.createEntry({
        streamId: activeStreamId,
        role: 'user',
        content: emptyContent,
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
    <div className="flex h-full flex-1 flex-col">
      {/* Stream Header */}
      <div className="border-b px-6 py-4">
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

      {/* Entries */}
      <ScrollArea className="flex-1">
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
                  <EntryBlock entry={entry} />
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
