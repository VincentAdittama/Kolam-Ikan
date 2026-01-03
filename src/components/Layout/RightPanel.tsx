import React, { useMemo } from 'react';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import {
  RefreshCw,
  Search,
  Sparkles,
  Copy,
  ArrowDownToLine,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, estimateTokens, formatTokenCount, getTokenStatus } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import { MODEL_CONFIGS, type DirectiveType, type ModelType } from '@/types';
import { generateBridgePrompt, parseAIResponse, contentToProseMirror } from '@/services/bridge';
import * as api from '@/services/api';

const DIRECTIVE_OPTIONS: { value: DirectiveType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'DUMP', label: 'Dump', icon: <RefreshCw className="h-4 w-4" />, description: 'Refactor & Restructure' },
  { value: 'CRITIQUE', label: 'Critique', icon: <Search className="h-4 w-4" />, description: 'Find Gaps & Issues' },
  { value: 'GENERATE', label: 'Generate', icon: <Sparkles className="h-4 w-4" />, description: 'Expand & Elaborate' },
];

export function RightPanel() {
  const {
    entries,
    stagedEntryIds,
    selectedDirective,
    selectedModel,
    setSelectedDirective,
    setSelectedModel,
    unstageEntry,
    clearAllStaging,
    activeStreamId,
    addEntry,
    setPendingBlock,
    pendingBlock,
  } = useAppStore();

  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  // Get staged entries
  const stagedEntries = useMemo(() => {
    return entries.filter((e) => stagedEntryIds.has(e.id));
  }, [entries, stagedEntryIds]);

  // Calculate token usage
  const tokenUsage = useMemo(() => {
    const stagedContent = stagedEntries
      .map((e) => JSON.stringify(e.content))
      .join('\n\n');
    const used = estimateTokens(stagedContent);
    const modelConfig = MODEL_CONFIGS[selectedModel];
    const limit = modelConfig.tokenLimit;
    const percentage = (used / limit) * 100;

    return {
      used,
      limit,
      percentage: Math.min(percentage, 100),
      status: getTokenStatus(percentage),
    };
  }, [stagedEntries, selectedModel]);

  // Handle copy bridge prompt
  const handleCopyBridgePrompt = async () => {
    if (!activeStreamId || stagedEntries.length === 0) return;

    setIsExporting(true);
    setExportError(null);

    try {
      // Check token limit
      if (tokenUsage.percentage >= 100) {
        setExportError('Token limit exceeded. Remove some staged entries.');
        return;
      }

      // Generate bridge prompt
      const bridgeExport = await generateBridgePrompt(stagedEntries, selectedDirective);

      // Copy to clipboard
      await writeText(bridgeExport.prompt);

      // Create pending block
      const pending = await api.createPendingBlock(
        activeStreamId,
        bridgeExport.bridgeKey,
        bridgeExport.stagedEntryIds,
        selectedDirective
      );
      setPendingBlock(pending);

      // Clear staging
      clearAllStaging();
    } catch (error) {
      setExportError(`Failed to export: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle bridge response (import AI response)
  const handleBridgeResponse = async () => {
    if (!activeStreamId || !pendingBlock) return;

    setIsImporting(true);
    setExportError(null);

    try {
      // Read from clipboard
      const clipboardText = await readText();
      if (!clipboardText || clipboardText.trim() === '') {
        setExportError('Clipboard is empty. Copy AI response first.');
        return;
      }

      // Parse the response
      const { content, bridgeKey } = parseAIResponse(clipboardText);

      // Validate bridge key
      if (!bridgeKey) {
        // Show warning but allow import
        console.warn('No bridge key detected');
      } else if (bridgeKey !== pendingBlock.bridgeKey) {
        setExportError(`Bridge key mismatch. Expected: ${pendingBlock.bridgeKey}, Found: ${bridgeKey}`);
        return;
      }

      // Convert to ProseMirror JSON
      const prosemirrorContent = contentToProseMirror(content);

      // Create AI entry
      const newEntry = await api.createEntry({
        streamId: activeStreamId,
        role: 'ai',
        content: prosemirrorContent,
      });

      // Add to store
      addEntry(newEntry);

      // Delete pending block
      await api.deletePendingBlock(pendingBlock.id);
      setPendingBlock(null);
    } catch (error) {
      setExportError(`Failed to import: ${error}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex h-full w-[320px] flex-col border-l bg-muted/30">
      {/* Directive Selector */}
      <div className="border-b p-4">
        <h3 className="text-sm font-medium mb-3">Directive</h3>
        <div className="space-y-2">
          {DIRECTIVE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedDirective(option.value)}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                selectedDirective === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {option.icon}
              <div>
                <div className="font-medium">{option.label}</div>
                <div className={cn(
                  'text-xs',
                  selectedDirective === option.value
                    ? 'text-primary-foreground/80'
                    : 'text-muted-foreground'
                )}>
                  {option.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Staging Preview */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">
            Staged Context
            {stagedEntries.length > 0 && (
              <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {stagedEntries.length}
              </span>
            )}
          </h3>
          {stagedEntries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllStaging}
              className="h-6 text-xs"
            >
              Clear all
            </Button>
          )}
        </div>

        {stagedEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Select entries to include in your prompt
          </p>
        ) : (
          <ScrollArea className="max-h-[120px]">
            <div className="space-y-1">
              {stagedEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-md bg-accent/50 px-2 py-1 text-sm"
                >
                  <span className="truncate">
                    #{entry.sequenceId} ({entry.role})
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => unstageEntry(entry.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Token Counter */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Context Size</h3>
          <Select
            value={selectedModel}
            onValueChange={(v) => setSelectedModel(v as ModelType)}
          >
            <SelectTrigger className="h-7 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(MODEL_CONFIGS).map((config) => (
                <SelectItem key={config.id} value={config.id}>
                  {config.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Progress
            value={tokenUsage.percentage}
            className="h-2"
            indicatorClassName={cn(
              tokenUsage.status === 'normal' && 'bg-blue-500',
              tokenUsage.status === 'warning' && 'bg-orange-500',
              tokenUsage.status === 'critical' && 'bg-red-500 animate-pulse',
              tokenUsage.status === 'exceeded' && 'bg-red-600'
            )}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTokenCount(tokenUsage.used)} tokens</span>
            <span>{Math.round(tokenUsage.percentage)}% of {formatTokenCount(tokenUsage.limit)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-1" />

      <div className="p-4 space-y-2">
        {exportError && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">{exportError}</span>
          </div>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="w-full"
              disabled={stagedEntries.length === 0 || isExporting}
              onClick={handleCopyBridgePrompt}
            >
              <Copy className="mr-2 h-4 w-4" />
              {isExporting ? 'Preparing...' : 'Copy Bridge Prompt'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy the staged context with directive to clipboard</p>
            <p className="text-xs text-muted-foreground">Cmd+Shift+C</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="w-full"
              disabled={!pendingBlock || isImporting}
              onClick={handleBridgeResponse}
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              {isImporting ? 'Processing...' : 'Bridge Response'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Import AI response from clipboard</p>
            <p className="text-xs text-muted-foreground">Cmd+Shift+V</p>
          </TooltipContent>
        </Tooltip>

        {pendingBlock && (
          <p className="text-center text-xs text-muted-foreground">
            Waiting for response (key: {pendingBlock.bridgeKey})
          </p>
        )}
      </div>
    </div>
  );
}
