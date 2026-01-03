import { invoke } from '@tauri-apps/api/core';
import type {
  Stream,
  StreamMetadata,
  Entry,
  EntryVersion,
  PendingBlock,
  CreateStreamInput,
  CreateEntryInput,
} from '@/types';
import type { JSONContent } from '@tiptap/react';

// ============================================================
// STREAM API
// ============================================================

export async function createStream(input: CreateStreamInput): Promise<Stream> {
  return invoke('create_stream', { input });
}

export async function getAllStreams(): Promise<StreamMetadata[]> {
  return invoke('get_all_streams');
}

export async function getStreamDetails(streamId: string): Promise<{
  stream: Stream;
  entries: Entry[];
}> {
  return invoke('get_stream_details', { streamId });
}

export async function deleteStream(streamId: string): Promise<void> {
  return invoke('delete_stream', { streamId });
}

export async function updateStream(
  streamId: string,
  updates: {
    title?: string;
    description?: string;
    pinned?: boolean;
  }
): Promise<void> {
  return invoke('update_stream', {
    streamId,
    title: updates.title,
    description: updates.description,
    pinned: updates.pinned,
  });
}

// ============================================================
// ENTRY API
// ============================================================

export async function createEntry(input: CreateEntryInput): Promise<Entry> {
  return invoke('create_entry', { input });
}

export async function updateEntryContent(
  entryId: string,
  content: JSONContent
): Promise<void> {
  return invoke('update_entry_content', { entryId, content });
}

export async function toggleEntryStaging(
  entryId: string,
  isStaged: boolean
): Promise<void> {
  return invoke('toggle_entry_staging', { entryId, isStaged });
}

export async function deleteEntry(entryId: string): Promise<void> {
  return invoke('delete_entry', { entryId });
}

export async function getStagedEntries(streamId: string): Promise<Entry[]> {
  return invoke('get_staged_entries', { streamId });
}

export async function clearAllStaging(streamId: string): Promise<void> {
  return invoke('clear_all_staging', { streamId });
}

// ============================================================
// VERSION API
// ============================================================

export async function commitEntryVersion(
  entryId: string,
  commitMessage?: string
): Promise<EntryVersion> {
  return invoke('commit_entry_version', { entryId, commitMessage });
}

export async function getEntryVersions(entryId: string): Promise<EntryVersion[]> {
  return invoke('get_entry_versions', { entryId });
}

export async function revertToVersion(
  entryId: string,
  versionNumber: number
): Promise<void> {
  return invoke('revert_to_version', { entryId, versionNumber });
}

// ============================================================
// BRIDGE API
// ============================================================

export async function generateBridgeKey(): Promise<string> {
  return invoke('generate_bridge_key');
}

export async function validateBridgeKey(
  inputText: string,
  expectedKey: string
): Promise<boolean> {
  return invoke('validate_bridge_key', { inputText, expectedKey });
}

export async function extractBridgeKey(inputText: string): Promise<string | null> {
  return invoke('extract_bridge_key', { inputText });
}

export async function createPendingBlock(
  streamId: string,
  bridgeKey: string,
  stagedContextIds: string[],
  directive: string
): Promise<PendingBlock> {
  return invoke('create_pending_block', {
    streamId,
    bridgeKey,
    stagedContextIds,
    directive,
  });
}

export async function getPendingBlock(streamId: string): Promise<PendingBlock | null> {
  return invoke('get_pending_block', { streamId });
}

export async function deletePendingBlock(pendingBlockId: string): Promise<void> {
  return invoke('delete_pending_block', { pendingBlockId });
}

// ============================================================
// SEARCH API
// ============================================================

export async function searchEntries(query: string): Promise<Entry[]> {
  return invoke('search_entries', { query });
}
