import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/services/api';
import { useAppStore } from '@/store/appStore';
import type { CreateStreamInput, CreateEntryInput } from '@/types';
import type { JSONContent } from '@tiptap/react';

// ============================================================
// STREAM HOOKS
// ============================================================

export function useStreams() {
  const { setStreams } = useAppStore();

  return useQuery({
    queryKey: ['streams'],
    queryFn: async () => {
      const streams = await api.getAllStreams();
      setStreams(streams);
      return streams;
    },
  });
}

export function useStreamDetails(streamId: string | null) {
  const { setCurrentStream, setEntries, setLoadingEntries } = useAppStore();

  return useQuery({
    queryKey: ['stream', streamId],
    queryFn: async () => {
      if (!streamId) return null;
      setLoadingEntries(true);
      try {
        const data = await api.getStreamDetails(streamId);
        setCurrentStream(data.stream);
        setEntries(data.entries);
        return data;
      } finally {
        setLoadingEntries(false);
      }
    },
    enabled: !!streamId,
  });
}

export function useCreateStream() {
  const queryClient = useQueryClient();
  const { setActiveStreamId } = useAppStore();

  return useMutation({
    mutationFn: (input: CreateStreamInput) => api.createStream(input),
    onSuccess: (stream) => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      setActiveStreamId(stream.id);
    },
  });
}

export function useDeleteStream() {
  const queryClient = useQueryClient();
  const { activeStreamId, setActiveStreamId, setCurrentStream, setEntries } = useAppStore();

  return useMutation({
    mutationFn: (streamId: string) => api.deleteStream(streamId),
    onSuccess: (_, streamId) => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      if (activeStreamId === streamId) {
        setActiveStreamId(null);
        setCurrentStream(null);
        setEntries([]);
      }
    },
  });
}

export function useUpdateStream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      streamId,
      updates,
    }: {
      streamId: string;
      updates: { title?: string; description?: string; pinned?: boolean };
    }) => api.updateStream(streamId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
    },
  });
}

// ============================================================
// ENTRY HOOKS
// ============================================================

export function useCreateEntry() {
  const queryClient = useQueryClient();
  const { addEntry } = useAppStore();

  return useMutation({
    mutationFn: (input: CreateEntryInput) => api.createEntry(input),
    onSuccess: (entry) => {
      addEntry(entry);
      queryClient.invalidateQueries({ queryKey: ['stream', entry.streamId] });
    },
  });
}

export function useUpdateEntryContent() {
  return useMutation({
    mutationFn: ({ entryId, content }: { entryId: string; content: JSONContent }) =>
      api.updateEntryContent(entryId, content),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  const { removeEntry, activeStreamId } = useAppStore();

  return useMutation({
    mutationFn: (entryId: string) => api.deleteEntry(entryId),
    onSuccess: (_, entryId) => {
      removeEntry(entryId);
      if (activeStreamId) {
        queryClient.invalidateQueries({ queryKey: ['stream', activeStreamId] });
      }
    },
  });
}

export function useToggleStaging() {
  const { toggleStaging } = useAppStore();

  return useMutation({
    mutationFn: ({ entryId, isStaged }: { entryId: string; isStaged: boolean }) =>
      api.toggleEntryStaging(entryId, isStaged),
    onMutate: ({ entryId }) => {
      toggleStaging(entryId);
    },
  });
}

export function useClearAllStaging() {
  const { clearAllStaging, activeStreamId } = useAppStore();

  return useMutation({
    mutationFn: () => {
      if (!activeStreamId) throw new Error('No active stream');
      return api.clearAllStaging(activeStreamId);
    },
    onSuccess: () => {
      clearAllStaging();
    },
  });
}

// ============================================================
// VERSION HOOKS
// ============================================================

export function useCommitVersion() {
  const queryClient = useQueryClient();
  const { updateEntry, activeStreamId } = useAppStore();

  return useMutation({
    mutationFn: ({ entryId, message }: { entryId: string; message?: string }) =>
      api.commitEntryVersion(entryId, message),
    onSuccess: (version) => {
      updateEntry(version.entryId, { versionHead: version.versionNumber });
      if (activeStreamId) {
        queryClient.invalidateQueries({ queryKey: ['stream', activeStreamId] });
      }
    },
  });
}

export function useEntryVersions(entryId: string) {
  return useQuery({
    queryKey: ['versions', entryId],
    queryFn: () => api.getEntryVersions(entryId),
    enabled: !!entryId,
  });
}

export function useRevertToVersion() {
  const queryClient = useQueryClient();
  const { activeStreamId } = useAppStore();

  return useMutation({
    mutationFn: ({ entryId, versionNumber }: { entryId: string; versionNumber: number }) =>
      api.revertToVersion(entryId, versionNumber),
    onSuccess: () => {
      if (activeStreamId) {
        queryClient.invalidateQueries({ queryKey: ['stream', activeStreamId] });
      }
    },
  });
}

// ============================================================
// SEARCH HOOKS
// ============================================================

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => api.searchEntries(query),
    enabled: query.length >= 2,
  });
}
