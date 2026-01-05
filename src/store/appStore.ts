import { create } from "zustand";
import { devLog } from "@/lib/devLogger";
import type {
  Stream,
  StreamMetadata,
  Entry,
  DirectiveType,
  ModelType,
  PendingBlock,
  Profile,
} from "@/types";
import type { User, Session } from "@supabase/supabase-js";

interface AppState {
  // UI State
  activeStreamId: string | null;
  selectedDirective: DirectiveType;
  selectedModel: ModelType;
  sidebarVisible: boolean;
  rightPanelVisible: boolean;
  theme: "light" | "dark" | "system";
  showEditorToolbar: boolean;
  dragRegionHeight: number;

  // User State
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;

  // Profile State
  profiles: Profile[];
  activeProfileId: string | null;
  defaultProfile: Profile | null;
  isLoadingProfiles: boolean;

  // Data State
  streams: StreamMetadata[];
  currentStream: Stream | null;
  entries: Entry[];
  stagedEntryIds: Set<string>;
  pendingBlock: PendingBlock | null;
  lastCreatedEntryId: string | null;

  // Search State
  isSearchOpen: boolean;
  searchQuery: string;

  // Bulk Action State
  bulkAction: { type: "collapse" | "expand" | null; timestamp: number };

  // Loading States
  isLoadingStreams: boolean;
  isLoadingEntries: boolean;

  // Actions
  setActiveStreamId: (id: string | null) => void;
  setSelectedDirective: (directive: DirectiveType) => void;
  setSelectedModel: (model: ModelType) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setDragRegionHeight: (height: number) => void;
  toggleEditorToolbar: () => void;

  setStreams: (streams: StreamMetadata[]) => void;
  setCurrentStream: (stream: Stream | null) => void;
  setEntries: (entries: Entry[]) => void;
  addEntry: (entry: Entry) => void;
  updateEntry: (entryId: string, updates: Partial<Entry>) => void;
  removeEntry: (entryId: string) => void;

  setStagedEntryIds: (ids: Set<string>) => void;
  toggleStaging: (entryId: string) => void;
  stageEntry: (entryId: string) => void;
  unstageEntry: (entryId: string) => void;
  clearAllStaging: () => void;

  setPendingBlock: (block: PendingBlock | null) => void;
  setLastCreatedEntryId: (id: string | null) => void;

  setSearchOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;

  triggerBulkAction: (type: "collapse" | "expand") => void;

  setLoadingStreams: (loading: boolean) => void;
  setLoadingEntries: (loading: boolean) => void;

  // Profile Actions
  setProfiles: (profiles: Profile[]) => void;
  addProfile: (profile: Profile) => void;
  updateProfile: (profileId: string, updates: Partial<Profile>) => void;
  removeProfile: (profileId: string) => void;
  setActiveProfileId: (id: string | null) => void;
  setDefaultProfile: (profile: Profile | null) => void;
  setLoadingProfiles: (loading: boolean) => void;

  // User Actions
  setUser: (user: User | null, session: Session | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial UI State
  activeStreamId: null,
  selectedDirective: "DUMP",
  selectedModel: "gpt4-turbo",
  sidebarVisible: true,
  rightPanelVisible: true,
  theme: "system",
  showEditorToolbar: true,
  dragRegionHeight: 53,

  // Initial User State
  user: null,
  session: null,
  isAuthenticated: false,

  // Initial Profile State
  profiles: [],
  activeProfileId: null,
  defaultProfile: null,
  isLoadingProfiles: false,

  // Initial Data State
  streams: [],
  currentStream: null,
  entries: [],
  stagedEntryIds: new Set(),
  pendingBlock: null,
  lastCreatedEntryId: null,

  // Initial Search State
  isSearchOpen: false,
  searchQuery: "",

  // Initial Bulk Action State
  bulkAction: { type: null, timestamp: 0 },

  // Initial Loading States
  isLoadingStreams: false,
  isLoadingEntries: false,

  // UI Actions
  setActiveStreamId: (id) => {
    devLog.action("Store: setActiveStreamId", { streamId: id });
    set({ activeStreamId: id });
  },
  setSelectedDirective: (directive) => {
    devLog.action("Store: setSelectedDirective", { directive });
    set({ selectedDirective: directive });
  },
  setSelectedModel: (model) => {
    devLog.action("Store: setSelectedModel", { model });
    set({ selectedModel: model });
  },
  toggleSidebar: () =>
    set((state) => {
      const newVisible = !state.sidebarVisible;
      devLog.toggleSidebar(newVisible);
      return { sidebarVisible: newVisible };
    }),
  toggleRightPanel: () =>
    set((state) => {
      const newVisible = !state.rightPanelVisible;
      devLog.toggleRightPanel(newVisible);
      return { rightPanelVisible: newVisible };
    }),
  setTheme: (theme) => {
    devLog.action("Store: setTheme", { theme });
    set({ theme });
  },
  setDragRegionHeight: (height) => {
    devLog.action("Store: setDragRegionHeight", { height });
    set({ dragRegionHeight: height });
  },
  toggleEditorToolbar: () =>
    set((state) => {
      const newVisible = !state.showEditorToolbar;
      devLog.action("Store: toggleEditorToolbar", { visible: newVisible });
      return { showEditorToolbar: newVisible };
    }),

  // Data Actions
  setStreams: (streams) => {
    devLog.action("Store: setStreams", { count: streams.length });
    set({ streams });
  },
  setCurrentStream: (stream) => {
    devLog.action("Store: setCurrentStream", {
      streamId: stream?.id,
      title: stream?.title,
    });
    set({ currentStream: stream });
  },
  setEntries: (entries) => {
    devLog.action("Store: setEntries", { count: entries.length });
    set({ entries });
  },
  addEntry: (entry) => {
    devLog.action("Store: addEntry", {
      entryId: entry.id,
      sequenceId: entry.sequenceId,
      role: entry.role,
    });
    set((state) => ({
      entries: [...state.entries, entry],
    }));
  },
  updateEntry: (entryId, updates) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === entryId ? { ...e, ...updates } : e
      ),
    })),
  removeEntry: (entryId) => {
    devLog.action("Store: removeEntry", { entryId });
    set((state) => ({
      entries: state.entries.filter((e) => e.id !== entryId),
      stagedEntryIds: new Set(
        [...state.stagedEntryIds].filter((id) => id !== entryId)
      ),
    }));
  },

  setStagedEntryIds: (ids) => {
    devLog.action("Store: setStagedEntryIds", { count: ids.size });
    set({ stagedEntryIds: ids });
  },
  // Staging Actions
  toggleStaging: (entryId) =>
    set((state) => {
      const newStaged = new Set(state.stagedEntryIds);
      if (newStaged.has(entryId)) {
        newStaged.delete(entryId);
        devLog.action("Store: toggleStaging (unstage)", { entryId });
      } else {
        newStaged.add(entryId);
        devLog.action("Store: toggleStaging (stage)", { entryId });
      }
      return { stagedEntryIds: newStaged };
    }),
  stageEntry: (entryId) =>
    set((state) => {
      devLog.action("Store: stageEntry", { entryId });
      const newStaged = new Set(state.stagedEntryIds);
      newStaged.add(entryId);
      return { stagedEntryIds: newStaged };
    }),
  unstageEntry: (entryId) =>
    set((state) => {
      devLog.action("Store: unstageEntry", { entryId });
      const newStaged = new Set(state.stagedEntryIds);
      newStaged.delete(entryId);
      return { stagedEntryIds: newStaged };
    }),
  clearAllStaging: () => {
    devLog.action("Store: clearAllStaging");
    set({ stagedEntryIds: new Set() });
  },

  setPendingBlock: (block) => {
    devLog.action("Store: setPendingBlock", {
      blockId: block?.id,
      bridgeKey: block?.bridgeKey,
    });
    set({ pendingBlock: block });
  },

  setLastCreatedEntryId: (id) => {
    devLog.action("Store: setLastCreatedEntryId", { entryId: id });
    set({ lastCreatedEntryId: id });
  },

  // Search Actions
  setSearchOpen: (isOpen) => {
    devLog.action("Store: setSearchOpen", { isOpen });
    set({ isSearchOpen: isOpen });
  },

  triggerBulkAction: (type) => {
    devLog.action("Store: triggerBulkAction", { type });
    set({ bulkAction: { type, timestamp: Date.now() } });
  },
  setSearchQuery: (query) => {
    if (query) devLog.search(query);
    set({ searchQuery: query });
  },

  // Bulk Action
  // (triggerBulkAction is already defined above)

  // Loading Actions
  setLoadingStreams: (loading) => set({ isLoadingStreams: loading }),
  setLoadingEntries: (loading) => set({ isLoadingEntries: loading }),

  // Profile Actions
  setProfiles: (profiles) => {
    devLog.action("Store: setProfiles", { count: profiles.length });
    set({ profiles });
  },
  addProfile: (profile) => {
    devLog.action("Store: addProfile", {
      profileId: profile.id,
      name: profile.name,
    });
    set((state) => ({
      profiles: [...state.profiles, profile],
    }));
  },
  updateProfile: (profileId, updates) => {
    devLog.action("Store: updateProfile", { profileId, updates });
    set((state) => ({
      profiles: state.profiles.map((p) =>
        p.id === profileId ? { ...p, ...updates } : p
      ),
    }));
  },
  removeProfile: (profileId) => {
    devLog.action("Store: removeProfile", { profileId });
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== profileId),
    }));
  },
  setActiveProfileId: (id) => {
    devLog.action("Store: setActiveProfileId", { profileId: id });
    set({ activeProfileId: id });
  },
  setDefaultProfile: (profile) => {
    devLog.action("Store: setDefaultProfile", { profileId: profile?.id });
    set({ defaultProfile: profile, activeProfileId: profile?.id ?? null });
  },
  setLoadingProfiles: (loading) => set({ isLoadingProfiles: loading }),

  // User Actions
  setUser: (user, session) => {
    devLog.action("Store: setUser", { userId: user?.id });
    set({ user, session, isAuthenticated: !!user });
  },
  logout: () => {
    devLog.action("Store: logout");
    set({
      user: null,
      session: null,
      isAuthenticated: false,
      activeProfileId: null,
    });
  },
}));
