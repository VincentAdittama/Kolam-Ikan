import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Pin,
  MoreVertical,
  Trash2,
  Edit2,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import * as api from '@/services/api';

export function Sidebar() {
  const {
    streams,
    activeStreamId,
    setActiveStreamId,
    setStreams,
    setCurrentStream,
    setEntries,
    setLoadingEntries,
  } = useAppStore();

  const [isNewStreamOpen, setIsNewStreamOpen] = React.useState(false);
  const [newStreamTitle, setNewStreamTitle] = React.useState('');

  // Fetch streams
  const { data: streamsData, refetch: refetchStreams } = useQuery({
    queryKey: ['streams'],
    queryFn: api.getAllStreams,
  });

  // Update store when streams are fetched
  useEffect(() => {
    if (streamsData) {
      setStreams(streamsData);
      // Auto-select first stream if none selected
      if (!activeStreamId && streamsData.length > 0) {
        setActiveStreamId(streamsData[0].id);
      }
    }
  }, [streamsData, activeStreamId, setStreams, setActiveStreamId]);

  // Fetch stream details when active stream changes
  useEffect(() => {
    if (activeStreamId) {
      setLoadingEntries(true);
      api
        .getStreamDetails(activeStreamId)
        .then((data) => {
          setCurrentStream(data.stream);
          setEntries(data.entries);
        })
        .finally(() => {
          setLoadingEntries(false);
        });
    }
  }, [activeStreamId, setCurrentStream, setEntries, setLoadingEntries]);

  const handleCreateStream = async () => {
    if (!newStreamTitle.trim()) return;

    await api.createStream({
      title: newStreamTitle.trim(),
    });

    setNewStreamTitle('');
    setIsNewStreamOpen(false);
    refetchStreams();
  };

  const handleDeleteStream = async (streamId: string) => {
    await api.deleteStream(streamId);
    if (activeStreamId === streamId) {
      setActiveStreamId(null);
      setCurrentStream(null);
      setEntries([]);
    }
    refetchStreams();
  };

  const handlePinStream = async (streamId: string, currentPinned: boolean) => {
    await api.updateStream(streamId, { pinned: !currentPinned });
    refetchStreams();
  };

  return (
    <div className="flex h-full w-[280px] flex-col border-r bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold text-lg">Streams</h2>
        <Dialog open={isNewStreamOpen} onOpenChange={setIsNewStreamOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Stream</DialogTitle>
              <DialogDescription>
                Start a new stream of thoughts. Give it a meaningful name.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Stream title..."
                value={newStreamTitle}
                onChange={(e) => setNewStreamTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateStream();
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewStreamOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateStream}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stream List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {streams.map((stream) => (
            <div
              key={stream.id}
              className={cn(
                'group flex items-center justify-between rounded-md px-3 py-2 cursor-pointer transition-colors',
                activeStreamId === stream.id
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
              onClick={() => setActiveStreamId(stream.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {stream.pinned && (
                    <Pin className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="font-medium truncate">{stream.title}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{stream.entryCount} entries</span>
                  <span>•</span>
                  <span>{formatRelativeTime(stream.lastUpdated)}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePinStream(stream.id, stream.pinned);
                    }}
                  >
                    <Pin className="mr-2 h-4 w-4" />
                    {stream.pinned ? 'Unpin' : 'Pin'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Open rename dialog
                    }}
                  >
                    <Edit2 className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStream(stream.id);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-2">
        <Button variant="ghost" className="w-full justify-start gap-2" size="sm">
          <HelpCircle className="h-4 w-4" />
          Quick Start Guide
        </Button>
      </div>
    </div>
  );
}
