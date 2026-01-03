import { invoke } from '@tauri-apps/api/core';
import { devLog } from '@/lib/devLogger';
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
// API WRAPPER WITH LOGGING
// ============================================================

async function invokeWithLogging<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  devLog.apiCall('INVOKE', command, args);
  try {
    const result = await invoke<T>(command, args);
    devLog.apiSuccess(command, { hasResult: result !== undefined });
    return result;
  } catch (error) {
    devLog.apiError(command, error);
    throw error;
  }
}

// ============================================================
// STREAM API
// ============================================================

export async function createStream(input: CreateStreamInput): Promise<Stream> {
  return invokeWithLogging('create_stream', { input });
}

export async function getAllStreams(): Promise<StreamMetadata[]> {
  return invokeWithLogging('get_all_streams');
}

export async function getStreamDetails(streamId: string): Promise<{
  stream: Stream;
  entries: Entry[];
}> {
  return invokeWithLogging('get_stream_details', { streamId });
}

export async function deleteStream(streamId: string): Promise<void> {
  return invokeWithLogging('delete_stream', { streamId });
}

export async function updateStream(
  streamId: string,
  updates: {
    title?: string;
    description?: string;
    pinned?: boolean;
  }
): Promise<void> {
  return invokeWithLogging('update_stream', {
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
  return invokeWithLogging('create_entry', { input });
}

export async function updateEntryContent(
  entryId: string,
  content: JSONContent
): Promise<void> {
  return invokeWithLogging('update_entry_content', { entryId, content });
}

export async function toggleEntryStaging(
  entryId: string,
  isStaged: boolean
): Promise<void> {
  return invokeWithLogging('toggle_entry_staging', { entryId, isStaged });
}

export async function deleteEntry(entryId: string): Promise<void> {
  return invokeWithLogging('delete_entry', { entryId });
}

export async function getStagedEntries(streamId: string): Promise<Entry[]> {
  return invokeWithLogging('get_staged_entries', { streamId });
}

export async function clearAllStaging(streamId: string): Promise<void> {
  return invokeWithLogging('clear_all_staging', { streamId });
}

// ============================================================
// VERSION API
// ============================================================

export async function commitEntryVersion(
  entryId: string,
  commitMessage?: string
): Promise<EntryVersion> {
  return invokeWithLogging('commit_entry_version', { entryId, commitMessage });
}

export async function getEntryVersions(entryId: string): Promise<EntryVersion[]> {
  return invokeWithLogging('get_entry_versions', { entryId });
}

export async function getLatestVersion(entryId: string): Promise<EntryVersion | null> {
  return invokeWithLogging('get_latest_version', { entryId });
}

export async function getVersionByNumber(
  entryId: string,
  versionNumber: number
): Promise<EntryVersion | null> {
  return invokeWithLogging('get_version_by_number', { entryId, versionNumber });
}

export async function revertToVersion(
  entryId: string,
  versionNumber: number
): Promise<void> {
  return invokeWithLogging('revert_to_version', { entryId, versionNumber });
}

// ============================================================
// BRIDGE API
// ============================================================

export async function generateBridgeKey(): Promise<string> {
  return invokeWithLogging('generate_bridge_key');
}

export async function validateBridgeKey(
  inputText: string,
  expectedKey: string
): Promise<boolean> {
  return invokeWithLogging('validate_bridge_key', { inputText, expectedKey });
}

export async function extractBridgeKey(inputText: string): Promise<string | null> {
  return invokeWithLogging('extract_bridge_key', { inputText });
}

export async function createPendingBlock(
  streamId: string,
  bridgeKey: string,
  stagedContextIds: string[],
  directive: string
): Promise<PendingBlock> {
  return invokeWithLogging('create_pending_block', {
    streamId,
    bridgeKey,
    stagedContextIds,
    directive,
  });
}

export async function getPendingBlock(streamId: string): Promise<PendingBlock | null> {
  return invokeWithLogging('get_pending_block', { streamId });
}

export async function deletePendingBlock(pendingBlockId: string): Promise<void> {
  return invokeWithLogging('delete_pending_block', { pendingBlockId });
}

// ============================================================
// SEARCH API
// ============================================================

export async function searchEntries(query: string): Promise<Entry[]> {
  return invokeWithLogging('search_entries', { query });
}
