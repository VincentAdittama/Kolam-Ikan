import React, { useMemo, useState } from "react";
import { writeText, readText } from "@tauri-apps/plugin-clipboard-manager";
import {
  RefreshCw,
  Search,
  Sparkles,
  Copy,
  ArrowDownToLine,
  X,
  AlertCircle,
  GitBranch,
  Settings,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  cn,
  estimateTokens,
  formatTokenCount,
  getTokenStatus,
} from "@/lib/utils";
import { devLog } from "@/lib/devLogger";
import { useAppStore } from "@/store/appStore";
import { useStreamRefetch } from "@/hooks/useStreamRefetch";
import {
  MODEL_CONFIGS,
  type DirectiveType,
  type ModelType,
  type AiMetadata,
  parseAIModelString,
} from "@/types";
import {
  generateBridgePrompt,
  parseAIResponse,
  contentToProseMirror,
  formatParseErrors,
} from "@/services/bridge";
import { SidebarBranchGraph } from "@/components/Branch/SidebarBranchGraph";
import { FullscreenBranchGraph } from "@/components/Branch/FullscreenBranchGraph";
import { ProfilePicker, ManageProfilesDialog } from "@/components/Profile";
import * as api from "@/services/api";

type PanelTab = "context" | "branches";

const DIRECTIVE_OPTIONS: {
  value: DirectiveType;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: "DUMP",
    label: "Dump",
    icon: <RefreshCw className="h-4 w-4" />,
    description: "Refactor & Restructure",
  },
  {
    value: "CRITIQUE",
    label: "Critique",
    icon: <Search className="h-4 w-4" />,
    description: "Find Gaps & Issues",
  },
  {
    value: "GENERATE",
    label: "Generate",
    icon: <Sparkles className="h-4 w-4" />,
    description: "Expand & Elaborate",
  },
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
    stageEntry,
    clearAllStaging,
    activeStreamId,
    addEntry,
    setPendingBlock,
    pendingBlock,
    setActiveProfileId,
    dragRegionHeight,
  } = useAppStore();

  const { refetchStreams } = useStreamRefetch();
  const [isExporting, setIsExporting] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>("context");
  const [isFullscreenGraphOpen, setIsFullscreenGraphOpen] = useState(false);
  const [showManageProfiles, setShowManageProfiles] = useState(false);

  // Get staged entries
  const stagedEntries = useMemo(() => {
    return entries.filter((e) => stagedEntryIds.has(e.id));
  }, [entries, stagedEntryIds]);

  // Calculate token usage
  const tokenUsage = useMemo(() => {
    const stagedContent = stagedEntries
      .map((e) => JSON.stringify(e.content))
      .join("\n\n");
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

    devLog.click("Copy Bridge Prompt", {
      directive: selectedDirective,
      stagedCount: stagedEntries.length,
      tokenUsage: tokenUsage.used,
    });

    setIsExporting(true);
    setExportError(null);

    try {
      // Check token limit
      if (tokenUsage.percentage >= 100) {
        devLog.error("Bridge export failed", "Token limit exceeded");
        setExportError("Token limit exceeded. Remove some staged entries.");
        return;
      }

      // Generate bridge prompt
      devLog.action("Generating bridge prompt", {
        directive: selectedDirective,
      });
      const bridgeExport = await generateBridgePrompt(
        stagedEntries,
        selectedDirective
      );

      // Copy to clipboard
      await writeText(bridgeExport.prompt);
      devLog.bridgeCopy(
        selectedDirective,
        bridgeExport.tokenEstimate,
        stagedEntries.length
      );

      // Create pending block
      devLog.apiCall("POST", "create_pending_block", {
        bridgeKey: bridgeExport.bridgeKey,
      });
      const pending = await api.createPendingBlock(
        activeStreamId,
        bridgeExport.bridgeKey,
        bridgeExport.stagedEntryIds,
        selectedDirective
      );
      devLog.apiSuccess("create_pending_block", { pendingBlockId: pending.id });
      setPendingBlock(pending);

      // Clear staging
      devLog.clearStaging(stagedEntries.length);
      clearAllStaging();
    } catch (error) {
      devLog.apiError("bridge_export", error);
      setExportError(`Failed to export: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle cancel bridge (undo)
  const handleCancelBridge = async () => {
    if (!pendingBlock) return;

    devLog.click("Cancel Bridge", { pendingBlockId: pendingBlock.id });

    try {
      // Restore staged entries
      devLog.action("Restoring staged entries", {
        count: pendingBlock.stagedContextIds.length,
      });
      pendingBlock.stagedContextIds.forEach((idWithVersion) => {
        const entryId = idWithVersion.split(":")[0];
        stageEntry(entryId);
      });

      // Delete pending block
      devLog.apiCall("DELETE", "delete_pending_block", {
        pendingBlockId: pendingBlock.id,
      });
      await api.deletePendingBlock(pendingBlock.id);
      devLog.apiSuccess("delete_pending_block");

      setPendingBlock(null);
      setExportError(null);
    } catch (error) {
      devLog.apiError("cancel_bridge", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setExportError(`Failed to cancel: ${errorMessage}`);
    }
  };

  // Handle bridge response (import AI response)
  const handleBridgeResponse = async () => {
    if (!activeStreamId || !pendingBlock) return;

    devLog.click("Bridge Response", {
      pendingBlockId: pendingBlock.id,
      bridgeKey: pendingBlock.bridgeKey,
    });

    setIsImporting(true);
    setExportError(null);

    try {
      // Read from clipboard
      devLog.action("Reading clipboard for AI response");
      const clipboardText = await readText();
      if (!clipboardText || clipboardText.trim() === "") {
        devLog.error("Bridge import failed", "Clipboard is empty");
        setExportError("Clipboard is empty. Copy AI response first.");
        return;
      }

      // Parse the response (now includes AI metadata)
      devLog.action("Parsing AI response", {
        textLength: clipboardText.length,
      });
      const parsedResponse = parseAIResponse(clipboardText);
      const {
        content,
        bridgeKey,
        aiModel,
        directive,
        summary,
        isStructured,
        parseWarnings,
      } = parsedResponse;

      devLog.action("Parsed response", {
        bridgeKey,
        aiModel,
        directive,
        isStructured,
        hasContent: !!content,
        parseWarnings,
      });

      // Validate structured response
      if (!isStructured) {
        const errorMsg = formatParseErrors(parseWarnings);
        devLog.error("Bridge import blocked", { errorMsg, parseWarnings });
        setExportError(errorMsg);
        return;
      }

      // Strict bridge key validation
      if (bridgeKey !== pendingBlock.bridgeKey) {
        const errorMsg = bridgeKey 
          ? `Bridge key mismatch. Expected "${pendingBlock.bridgeKey}" but found "${bridgeKey}".`
          : `Bridge key missing in the AI response. Expected "${pendingBlock.bridgeKey}".`;
          
        devLog.error("Bridge key mismatch", {
          expected: pendingBlock.bridgeKey,
          found: bridgeKey,
        });
        setExportError(errorMsg);
        return;
      }

      devLog.action("Parsed response", {
        bridgeKey,
        aiModel,
        directive,
        isStructured,
        hasContent: !!content,
        parseWarnings,
      });

      // Log warnings to console for debugging but don't show to user (user sees formatted error if it blocks)
      if (parseWarnings && parseWarnings.length > 0) {
        console.debug("[Bridge Import] Internal parse warnings:", parseWarnings);
      }

      // Safety check - ensure we have content
      if (!content || content.trim().length === 0) {
        setExportError(
          "Failed to extract content from AI response. Please check the response format."
        );
        return;
      }

      // Convert to ProseMirror JSON
      const prosemirrorContent = contentToProseMirror(content);

      // Build AI metadata - be lenient with missing fields
      const effectiveModel = aiModel || "Unknown AI";
      const modelInfo = parseAIModelString(effectiveModel);
      const aiMetadata: AiMetadata = {
        model: modelInfo.displayName,
        provider: modelInfo.provider,
        directive: directive || pendingBlock.directive,
        bridgeKey: bridgeKey || pendingBlock.bridgeKey,
        summary: summary || undefined,
      };
      devLog.action("Built AI metadata", {
        model: aiMetadata.model,
        provider: aiMetadata.provider,
        directive: aiMetadata.directive,
      });

      // Create AI entry with metadata and parent context IDs (staged blocks)
      devLog.createEntry(activeStreamId, "ai");
      devLog.apiCall("POST", "create_entry", {
        streamId: activeStreamId,
        role: "ai",
        hasMetadata: !!aiMetadata,
        parentContextIds: pendingBlock.stagedContextIds,
      });
      const newEntry = await api.createEntry({
        streamId: activeStreamId,
        role: "ai",
        content: prosemirrorContent,
        aiMetadata,
        // Pass the staged entry IDs as parent context - this enables synapse visualization
        parentContextIds: pendingBlock.stagedContextIds,
      });

      devLog.apiSuccess("create_entry", {
        entryId: newEntry.id,
        sequenceId: newEntry.sequenceId,
      });

      // Add to store
      addEntry(newEntry);

      // Refetch streams to update entry counts
      refetchStreams();

      // Delete pending block
      devLog.apiCall("DELETE", "delete_pending_block", {
        pendingBlockId: pendingBlock.id,
      });
      await api.deletePendingBlock(pendingBlock.id);
      devLog.apiSuccess("delete_pending_block");
      devLog.bridgeImport(pendingBlock.bridgeKey, true);
      setPendingBlock(null);
      setExportError(null);
    } catch (error) {
      devLog.apiError("bridge_import", error);
      devLog.bridgeImport(pendingBlock?.bridgeKey || "unknown", false);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setExportError(`Failed to import: ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex h-full w-[320px] flex-col border-l bg-muted/30 overflow-hidden">
      {/* Tab Navigation - Sticky Header */}
      <div className="sticky top-0 z-20 flex border-b bg-background/80 backdrop-blur-md" style={{ height: `${dragRegionHeight}px` }}>
        <button
          onClick={() => setActiveTab("context")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 text-sm font-medium transition-colors border-b-2",
            activeTab === "context"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          Context
        </button>
        <button
          onClick={() => setActiveTab("branches")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 text-sm font-medium transition-colors border-b-2",
            activeTab === "branches"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <GitBranch className="h-4 w-4" />
          Branches
        </button>
      </div>

      {/* Branch Visualization Tab */}
      {activeTab === "branches" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <SidebarBranchGraph className="h-full" />
          </div>
          <div className="p-3 border-t">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setIsFullscreenGraphOpen(true)}
                >
                  <Maximize2 className="h-4 w-4" />
                  Open Fullscreen View
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Open an immersive fullscreen branch visualization with particles
              </TooltipContent>
            </Tooltip>
          </div>
          <FullscreenBranchGraph
            isOpen={isFullscreenGraphOpen}
            onClose={() => setIsFullscreenGraphOpen(false)}
          />
        </div>
      )}

      {/* Context Tab */}
      {activeTab === "context" && (
        <ScrollArea className="flex-1">
          <div className="flex flex-col min-h-full">
            {/* Profile Selector - Sets default profile for new entries */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Active Profile</h3>
                <div className="flex items-center gap-2">
                   <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowManageProfiles(true)}
                   >
                      <Settings className="h-3 w-3 mr-1" />
                      Manage
                   </Button>
                </div>
              </div>
              <div className="mt-2">
                <ProfilePicker
                  onProfileSelect={(profile) => {
                    devLog.action("Set active profile", { profileId: profile.id, name: profile.name });
                    setActiveProfileId(profile.id);
                  }}
                  showCreateButton={true}
                />
              </div>
            </div>

            {/* Directive Selector */}
            <div className="border-b p-4">
              <h3 className="text-sm font-medium mb-3">Directive</h3>
              <div className="space-y-2">
                {DIRECTIVE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      devLog.selectDirective(option.value);
                      setSelectedDirective(option.value);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                      selectedDirective === option.value
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    )}
                  >
                    {option.icon}
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div
                        className={cn(
                          "text-xs",
                          selectedDirective === option.value
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        )}
                      >
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
                    onClick={() => {
                      devLog.clearStaging(stagedEntries.length);
                      clearAllStaging();
                    }}
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
                <div className="max-h-[200px] overflow-y-auto">
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
                          onClick={() => {
                            devLog.unstage(entry.id, entry.sequenceId);
                            unstageEntry(entry.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Token Counter */}
            <div className="border-b p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Context Size</h3>
                <Select
                  value={selectedModel}
                  onValueChange={(v) => {
                    devLog.selectModel(v);
                    setSelectedModel(v as ModelType);
                  }}
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
                    tokenUsage.status === "normal" && "bg-blue-500",
                    tokenUsage.status === "warning" && "bg-orange-500",
                    tokenUsage.status === "critical" &&
                      "bg-red-500 animate-pulse",
                    tokenUsage.status === "exceeded" && "bg-red-600"
                  )}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatTokenCount(tokenUsage.used)} tokens</span>
                  <span>
                    {Math.round(tokenUsage.percentage)}% of{" "}
                    {formatTokenCount(tokenUsage.limit)}
                  </span>
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

            {pendingBlock && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-destructive gap-2"
                    onClick={handleCancelBridge}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Cancel Bridge (Undo)
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Cancel this bridge and restore staged context</p>
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="w-full"
                  disabled={stagedEntries.length === 0 || isExporting}
                  onClick={handleCopyBridgePrompt}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {isExporting ? "Preparing..." : "Launch Bridge"}
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
                  {isImporting ? "Processing..." : "Bridge Response"}
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
      </ScrollArea>
      )}
      
      <ManageProfilesDialog 
        open={showManageProfiles} 
        onOpenChange={setShowManageProfiles} 
      />
    </div>
  );
}
