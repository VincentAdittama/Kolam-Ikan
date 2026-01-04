import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  } = useAppStore();

  const { refetchStreams } = useStreamRefetch();

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
        <h1 className="text-2xl font-bold">{currentStream.title}</h1>
        {currentStream.description && (
          <p className="text-muted-foreground mt-1">{currentStream.description}</p>
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
