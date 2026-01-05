import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Pin,
  MoreVertical,
  Trash2,
  Edit2,
  HelpCircle,
  PanelLeft,
  Calendar,
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
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
import { devLog } from '@/lib/devLogger';
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
    toggleSidebar,
    dragRegionHeight,
  } = useAppStore();

  const [isNewStreamOpen, setIsNewStreamOpen] = React.useState(false);
  const [newStreamTitle, setNewStreamTitle] = React.useState('');
  
  const [isRenameOpen, setIsRenameOpen] = React.useState(false);
  const [editingStreamId, setEditingStreamId] = React.useState<string | null>(null);
  const [renameTitle, setRenameTitle] = React.useState('');

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
          // Refetch stream list to update entry counts
          refetchStreams();
        })
        .finally(() => {
          setLoadingEntries(false);
        });
    }
  }, [activeStreamId, setCurrentStream, setEntries, setLoadingEntries, refetchStreams]);

  const handleCreateStream = async () => {
    if (!newStreamTitle.trim()) return;

    devLog.createStream(newStreamTitle.trim());
    devLog.apiCall('POST', 'create_stream', { title: newStreamTitle.trim() });

    try {
      await api.createStream({
        title: newStreamTitle.trim(),
      });
      devLog.apiSuccess('create_stream');
    } catch (error) {
      devLog.apiError('create_stream', error);
      throw error;
    }

    setNewStreamTitle('');
    setIsNewStreamOpen(false);
    refetchStreams();
  };

  const handleDeleteStream = async (streamId: string) => {
    devLog.deleteStream(streamId);
    devLog.apiCall('DELETE', 'delete_stream', { streamId });

    try {
      await api.deleteStream(streamId);
      devLog.apiSuccess('delete_stream');
      
      if (activeStreamId === streamId) {
        setActiveStreamId(null);
        setCurrentStream(null);
        setEntries([]);
      }
      await refetchStreams();
    } catch (error) {
      devLog.apiError('delete_stream', error);
      throw error;
    }
  };

  const handlePinStream = async (streamId: string, currentPinned: boolean) => {
    devLog.pinStream(streamId, !currentPinned);
    devLog.apiCall('PATCH', 'update_stream', { streamId, pinned: !currentPinned });

    try {
      await api.updateStream(streamId, { pinned: !currentPinned });
      devLog.apiSuccess('update_stream');
    } catch (error) {
      devLog.apiError('update_stream', error);
      throw error;
    }

    refetchStreams();
  };

  const handleRenameStream = async () => {
    if (!editingStreamId || !renameTitle.trim()) return;

    devLog.apiCall('PATCH', 'update_stream', { streamId: editingStreamId, title: renameTitle.trim() });

    try {
      await api.updateStream(editingStreamId, { title: renameTitle.trim() });
      devLog.apiSuccess('update_stream');
      
      // Update local state if it's the current stream
      if (activeStreamId === editingStreamId) {
        await api.getStreamDetails(activeStreamId).then((data) => {
          setCurrentStream(data.stream);
        });
      }
      
      setIsRenameOpen(false);
      setEditingStreamId(null);
      setRenameTitle('');
      refetchStreams();
    } catch (error) {
      devLog.apiError('update_stream', error);
      throw error;
    }
  };

  const handleDailyStream = async () => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    devLog.action('Daily Stream Button Clicked', { date: today });

    // Check if stream already exists
    const existing = streams.find((s) => s.title === today);

    if (existing) {
      devLog.action('Switching to existing daily stream', { streamId: existing.id });
      setActiveStreamId(existing.id);
    } else {
      devLog.action('Creating new daily stream', { title: today });
      devLog.apiCall('POST', 'create_stream', { title: today });
      try {
        const newStream = await api.createStream({ title: today });
        devLog.apiSuccess('create_stream');
        setActiveStreamId(newStream.id);
        refetchStreams();
      } catch (error) {
        devLog.apiError('create_stream', error);
      }
    }
  };

  return (
    <div className="flex h-full w-[280px] flex-col border-r bg-muted/30">
      {/* Header - pl-(--macos-traffic-light-width) accounts for macOS traffic light buttons */}
      <div className="flex items-center justify-between border-b pl-(--macos-traffic-light-width) pr-4" style={{ height: `${dragRegionHeight}px` }}>
        <h3 className="font-semibold text-base">Streams</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleDailyStream}
            title="Daily Stream"
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <Dialog open={isNewStreamOpen} onOpenChange={(open) => {
            if (open) devLog.openDialog('New Stream');
            else devLog.closeDialog('New Stream');
            setIsNewStreamOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => devLog.click('New Stream Button (Plus)')}
                title="New Stream"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              {/* ... dialog content remains the same ... */}
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
                    if (e.key === 'Enter') {
                      devLog.shortcut('Enter', 'Create stream from dialog');
                      handleCreateStream();
                    }
                  }}
                  onFocus={() => devLog.focus('New Stream Title Input')}
                  onBlur={() => devLog.blur('New Stream Title Input')}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  devLog.click('Cancel New Stream Button');
                  setIsNewStreamOpen(false);
                }}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  devLog.click('Create Stream Button', { title: newStreamTitle });
                  handleCreateStream();
                }}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={toggleSidebar}
            title="Hide Sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Rename Stream Dialog */}
        <Dialog open={isRenameOpen} onOpenChange={(open) => {
          if (!open) {
            setIsRenameOpen(false);
            setEditingStreamId(null);
            setRenameTitle('');
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Stream</DialogTitle>
              <DialogDescription>
                Enter a new name for this stream.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Stream title..."
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameStream();
                  }
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsRenameOpen(false);
                setEditingStreamId(null);
                setRenameTitle('');
              }}>
                Cancel
              </Button>
              <Button onClick={handleRenameStream}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stream List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {streams.map((stream) => (
            <ContextMenu key={stream.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={cn(
                    'group flex items-center justify-between rounded-md px-3 py-2 cursor-pointer transition-colors',
                    activeStreamId === stream.id
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50'
                  )}
                  onClick={() => {
                    devLog.selectStream(stream.id, stream.title);
                    setActiveStreamId(stream.id);
                  }}
                  onContextMenu={() => {
                    devLog.openMenu('Stream Options (Context)', { streamId: stream.id, streamTitle: stream.title });
                  }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          devLog.openMenu('Stream Options', { streamId: stream.id, streamTitle: stream.title });
                        }}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          devLog.menuAction('Stream Options', stream.pinned ? 'Unpin' : 'Pin', { streamId: stream.id });
                          handlePinStream(stream.id, stream.pinned);
                        }}
                      >
                        <Pin className="mr-2 h-4 w-4" />
                        {stream.pinned ? 'Unpin' : 'Pin'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          devLog.menuAction('Stream Options', 'Rename', { streamId: stream.id });
                          setEditingStreamId(stream.id);
                          setRenameTitle(stream.title);
                          setIsRenameOpen(true);
                        }}
                      >
                        <Edit2 className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          devLog.menuAction('Stream Options', 'Delete', { streamId: stream.id });
                          handleDeleteStream(stream.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => {
                    devLog.menuAction('Stream Options (Context)', stream.pinned ? 'Unpin' : 'Pin', { streamId: stream.id });
                    handlePinStream(stream.id, stream.pinned);
                  }}
                >
                  <Pin className="mr-2 h-4 w-4" />
                  {stream.pinned ? 'Unpin' : 'Pin'}
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    devLog.menuAction('Stream Options (Context)', 'Rename', { streamId: stream.id });
                    setEditingStreamId(stream.id);
                    setRenameTitle(stream.title);
                    setIsRenameOpen(true);
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Rename
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-destructive"
                  onClick={() => {
                    devLog.menuAction('Stream Options (Context)', 'Delete', { streamId: stream.id });
                    handleDeleteStream(stream.id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-2">
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2" 
          size="sm"
          onClick={() => devLog.click('Quick Start Guide Button')}
        >
          <HelpCircle className="h-4 w-4" />
          Quick Start Guide
        </Button>
      </div>
    </div>
  );
}
