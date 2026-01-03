import { create } from 'zustand';
import type {
  Stream,
  StreamMetadata,
  Entry,
  DirectiveType,
  ModelType,
  PendingBlock,
} from '@/types';

interface AppState {
  // UI State
  activeStreamId: string | null;
  selectedDirective: DirectiveType;
  selectedModel: ModelType;
  sidebarVisible: boolean;
  rightPanelVisible: boolean;
  theme: 'light' | 'dark' | 'system';
  
  // Data State
  streams: StreamMetadata[];
  currentStream: Stream | null;
  entries: Entry[];
  stagedEntryIds: Set<string>;
  pendingBlock: PendingBlock | null;
  
  // Search State
  isSearchOpen: boolean;
  searchQuery: string;
  
  // Loading States
  isLoadingStreams: boolean;
  isLoadingEntries: boolean;
  
  // Actions
  setActiveStreamId: (id: string | null) => void;
  setSelectedDirective: (directive: DirectiveType) => void;
  setSelectedModel: (model: ModelType) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  setStreams: (streams: StreamMetadata[]) => void;
  setCurrentStream: (stream: Stream | null) => void;
  setEntries: (entries: Entry[]) => void;
  addEntry: (entry: Entry) => void;
  updateEntry: (entryId: string, updates: Partial<Entry>) => void;
  removeEntry: (entryId: string) => void;
  
  toggleStaging: (entryId: string) => void;
  stageEntry: (entryId: string) => void;
  unstageEntry: (entryId: string) => void;
  clearAllStaging: () => void;
  
  setPendingBlock: (block: PendingBlock | null) => void;
  
  setSearchOpen: (isOpen: boolean) => void;
  setSearchQuery: (query: string) => void;
  
  setLoadingStreams: (loading: boolean) => void;
  setLoadingEntries: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set, _get) => ({
  // Initial UI State
  activeStreamId: null,
  selectedDirective: 'DUMP',
  selectedModel: 'gpt4-turbo',
  sidebarVisible: true,
  rightPanelVisible: true,
  theme: 'system',
  
  // Initial Data State
  streams: [],
  currentStream: null,
  entries: [],
  stagedEntryIds: new Set(),
  pendingBlock: null,
  
  // Initial Search State
  isSearchOpen: false,
  searchQuery: '',
  
  // Initial Loading States
  isLoadingStreams: false,
  isLoadingEntries: false,
  
  // UI Actions
  setActiveStreamId: (id) => set({ activeStreamId: id }),
  setSelectedDirective: (directive) => set({ selectedDirective: directive }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  toggleRightPanel: () => set((state) => ({ rightPanelVisible: !state.rightPanelVisible })),
  setTheme: (theme) => set({ theme }),
  
  // Data Actions
  setStreams: (streams) => set({ streams }),
  setCurrentStream: (stream) => set({ currentStream: stream }),
  setEntries: (entries) => set({ entries }),
  addEntry: (entry) => set((state) => ({
    entries: [...state.entries, entry],
  })),
  updateEntry: (entryId, updates) => set((state) => ({
    entries: state.entries.map((e) =>
      e.id === entryId ? { ...e, ...updates } : e
    ),
  })),
  removeEntry: (entryId) => set((state) => ({
    entries: state.entries.filter((e) => e.id !== entryId),
    stagedEntryIds: new Set([...state.stagedEntryIds].filter((id) => id !== entryId)),
  })),
  
  // Staging Actions
  toggleStaging: (entryId) => set((state) => {
    const newStaged = new Set(state.stagedEntryIds);
    if (newStaged.has(entryId)) {
      newStaged.delete(entryId);
    } else {
      newStaged.add(entryId);
    }
    return { stagedEntryIds: newStaged };
  }),
  stageEntry: (entryId) => set((state) => {
    const newStaged = new Set(state.stagedEntryIds);
    newStaged.add(entryId);
    return { stagedEntryIds: newStaged };
  }),
  unstageEntry: (entryId) => set((state) => {
    const newStaged = new Set(state.stagedEntryIds);
    newStaged.delete(entryId);
    return { stagedEntryIds: newStaged };
  }),
  clearAllStaging: () => set({ stagedEntryIds: new Set() }),
  
  setPendingBlock: (block) => set({ pendingBlock: block }),
  
  // Search Actions
  setSearchOpen: (isOpen) => set({ isSearchOpen: isOpen }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  // Loading Actions
  setLoadingStreams: (loading) => set({ isLoadingStreams: loading }),
  setLoadingEntries: (loading) => set({ isLoadingEntries: loading }),
}));
