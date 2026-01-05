import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/services/api";
import { useAppStore } from "@/store/appStore";
import type {
  CreateStreamInput,
  CreateEntryInput,
  CreateProfileInput,
  UpdateProfileInput,
} from "@/types";
import type { JSONContent } from "@tiptap/react";

// ============================================================
// PROFILE HOOKS
// ============================================================

export function useProfiles() {
  const { setProfiles, setLoadingProfiles } = useAppStore();

  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      setLoadingProfiles(true);
      try {
        const profiles = await api.getAllProfiles();
        setProfiles(profiles);
        return profiles;
      } finally {
        setLoadingProfiles(false);
      }
    },
  });
}

export function useDefaultProfile() {
  const { setDefaultProfile } = useAppStore();

  return useQuery({
    queryKey: ["defaultProfile"],
    queryFn: async () => {
      const profile = await api.getDefaultProfile();
      setDefaultProfile(profile);
      return profile;
    },
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  const { addProfile } = useAppStore();

  return useMutation({
    mutationFn: (input: CreateProfileInput) => api.createProfile(input),
    onSuccess: (profile) => {
      addProfile(profile);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { updateProfile } = useAppStore();

  return useMutation({
    mutationFn: ({
      profileId,
      input,
    }: {
      profileId: string;
      input: UpdateProfileInput;
    }) => api.updateProfile(profileId, input),
    onSuccess: (_, { profileId, input }) => {
      updateProfile(profileId, input);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  const { removeProfile, activeStreamId, entries, setEntries } = useAppStore();

  return useMutation({
    mutationFn: ({
      profileId,
      reassignToId,
    }: {
      profileId: string;
      reassignToId?: string;
    }) => api.deleteProfile(profileId, reassignToId),
    onSuccess: async (_, { profileId, reassignToId }) => {
      // 1. Remove from profiles list immediately
      removeProfile(profileId);

      // 2. Optimistically update all entries in the store
      // We MUST clear the 'profile' object since it's now stale
      const updatedEntries = entries.map((e) => {
        if (e.profileId === profileId) {
          return {
            ...e,
            profileId: reassignToId || undefined,
            profile: undefined, // Clear the stale nested object!
          };
        }
        return e;
      });
      setEntries(updatedEntries);

      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      // Invalidate stream metadata list
      await queryClient.invalidateQueries({ queryKey: ["streams"] });
      // Invalidate current stream details if active
      if (activeStreamId) {
        console.log("DEBUG: Refetching active stream", activeStreamId);
        await queryClient.refetchQueries({
          queryKey: ["stream", activeStreamId],
        });
      }
      // Also invalidate generic stream key just in case
      await queryClient.invalidateQueries({ queryKey: ["stream"] });
    },
  });
}

export function useProfileEntryCount(profileId: string | null) {
  return useQuery({
    queryKey: ["profileEntryCount", profileId],
    queryFn: () => api.getProfileEntryCount(profileId!),
    enabled: !!profileId,
  });
}

export function useUpdateEntryProfile() {
  const queryClient = useQueryClient();
  const { activeStreamId, updateEntry } = useAppStore();

  return useMutation({
    mutationFn: ({
      entryId,
      profileId,
    }: {
      entryId: string;
      profileId: string | null;
    }) => api.updateEntryProfile(entryId, profileId),
    onSuccess: async (_, { entryId, profileId }) => {
      // Optimistically update the store:
      // set profileId to the new ID, and CLEAR profile object (since it's now stale)
      // This forces EntryBlock to use the ID lookup or wait for the refetch
      updateEntry(entryId, {
        profileId: profileId || undefined,
        profile: undefined,
      });

      if (activeStreamId) {
        await queryClient.refetchQueries({
          queryKey: ["stream", activeStreamId],
        });
      }
    },
  });
}

export function useBulkUpdateEntryProfile() {
  const queryClient = useQueryClient();
  const { activeStreamId, updateEntry } = useAppStore();

  return useMutation({
    mutationFn: ({
      entryIds,
      profileId,
    }: {
      entryIds: string[];
      profileId: string | null;
    }) => api.bulkUpdateEntryProfile(entryIds, profileId),
    onSuccess: async (_, { entryIds, profileId }) => {
      // Optimistically update all entries in the store
      entryIds.forEach((entryId) => {
        updateEntry(entryId, {
          profileId: profileId || undefined,
          profile: undefined,
        });
      });

      if (activeStreamId) {
        await queryClient.refetchQueries({
          queryKey: ["stream", activeStreamId],
        });
      }
    },
  });
}

// ============================================================
// STREAM HOOKS
// ============================================================

export function useStreams() {
  const { setStreams } = useAppStore();

  return useQuery({
    queryKey: ["streams"],
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
    queryKey: ["stream", streamId],
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
      queryClient.invalidateQueries({ queryKey: ["streams"] });
      setActiveStreamId(stream.id);
    },
  });
}

export function useDeleteStream() {
  const queryClient = useQueryClient();
  const { activeStreamId, setActiveStreamId, setCurrentStream, setEntries } =
    useAppStore();

  return useMutation({
    mutationFn: (streamId: string) => api.deleteStream(streamId),
    onSuccess: (_, streamId) => {
      queryClient.invalidateQueries({ queryKey: ["streams"] });
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
      queryClient.invalidateQueries({ queryKey: ["streams"] });
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
      queryClient.invalidateQueries({ queryKey: ["stream", entry.streamId] });
    },
  });
}

export function useUpdateEntryContent() {
  return useMutation({
    mutationFn: ({
      entryId,
      content,
    }: {
      entryId: string;
      content: JSONContent;
    }) => api.updateEntryContent(entryId, content),
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
        queryClient.invalidateQueries({ queryKey: ["stream", activeStreamId] });
      }
    },
  });
}

export function useBulkDeleteEntries() {
  const queryClient = useQueryClient();
  const { removeEntry, activeStreamId, clearAllStaging } = useAppStore();

  return useMutation({
    mutationFn: (entryIds: string[]) => api.bulkDeleteEntries(entryIds),
    onSuccess: async (_, entryIds) => {
      // Optimistically remove all entries from the store
      entryIds.forEach((entryId) => {
        removeEntry(entryId);
      });

      // Clear all staging since the entries are gone
      clearAllStaging();

      if (activeStreamId) {
        await queryClient.invalidateQueries({
          queryKey: ["stream", activeStreamId],
        });
      }
    },
  });
}

export function useToggleStaging() {
  const { toggleStaging } = useAppStore();

  return useMutation({
    mutationFn: ({
      entryId,
      isStaged,
    }: {
      entryId: string;
      isStaged: boolean;
    }) => api.toggleEntryStaging(entryId, isStaged),
    onMutate: ({ entryId }) => {
      toggleStaging(entryId);
    },
  });
}

export function useClearAllStaging() {
  const { clearAllStaging, activeStreamId } = useAppStore();

  return useMutation({
    mutationFn: () => {
      if (!activeStreamId) throw new Error("No active stream");
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
      // Update both version head and content (content may have changed from revert)
      updateEntry(version.entryId, {
        versionHead: version.versionNumber,
        content: version.contentSnapshot,
      });
      queryClient.invalidateQueries({
        queryKey: ["versions", version.entryId],
      });
      queryClient.invalidateQueries({
        queryKey: ["latestVersion", version.entryId],
      });
      if (activeStreamId) {
        queryClient.invalidateQueries({ queryKey: ["stream", activeStreamId] });
      }
    },
  });
}

export function useEntryVersions(entryId: string | null) {
  return useQuery({
    queryKey: ["versions", entryId],
    queryFn: () => api.getEntryVersions(entryId!),
    enabled: !!entryId,
  });
}

export function useLatestVersion(entryId: string | null) {
  return useQuery({
    queryKey: ["latestVersion", entryId],
    queryFn: () => api.getLatestVersion(entryId!),
    enabled: !!entryId,
  });
}

export function useVersionByNumber(
  entryId: string | null,
  versionNumber: number | null
) {
  return useQuery({
    queryKey: ["version", entryId, versionNumber],
    queryFn: () => api.getVersionByNumber(entryId!, versionNumber!),
    enabled: !!entryId && versionNumber !== null,
  });
}

export function useRevertToVersion() {
  const queryClient = useQueryClient();
  const { activeStreamId } = useAppStore();

  return useMutation({
    mutationFn: ({
      entryId,
      versionNumber,
    }: {
      entryId: string;
      versionNumber: number;
    }) => api.revertToVersion(entryId, versionNumber),
    onSuccess: async (_, { entryId }) => {
      // Invalidate all version-related queries
      queryClient.invalidateQueries({ queryKey: ["versions", entryId] });
      queryClient.invalidateQueries({ queryKey: ["latestVersion", entryId] });
      if (activeStreamId) {
        // Refetch the stream to get updated entry content
        await queryClient.invalidateQueries({
          queryKey: ["stream", activeStreamId],
        });
      }
    },
  });
}

// ============================================================
// SEARCH HOOKS
// ============================================================

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => api.searchEntries(query),
    enabled: query.length >= 2,
  });
}
