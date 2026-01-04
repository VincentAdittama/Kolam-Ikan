import { useState, useCallback, useEffect } from 'react';
import {
  Maximize,
  X,
  Share2,
  GitGraph,
  CircleDot,
  Sparkles,
  Type,
  Info,
  GitBranch,
  Layers,
  Link2,
  ChevronDown,
  ChevronUp,
  Zap,
  Settings2,
  RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import * as api from '@/services/api';
import { BranchGraph } from './BranchGraph';
import { DEFAULT_PHYSICS } from './utils';
import type { EntryVersion } from '@/types';

// ============================================================
// PHYSICS CONFIG TYPE
// ============================================================

interface PhysicsSettings {
  centerForce: number;
  chargeStrength: number;
  linkDistance: number;
  linkStrength: number;
  collisionRadius: number;
  velocityDecay: number;
  alphaDecay: number;
}

// ============================================================
// FULLSCREEN GRAPH DIALOG
// ============================================================

interface BranchGraphDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type LayoutMode = 'force' | 'hierarchical' | 'radial';

export function FullscreenBranchGraph({ isOpen, onClose }: BranchGraphDialogProps) {
  const { entries, stagedEntryIds } = useAppStore();
  
  // State
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force');
  const [showParticles, setShowParticles] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [detailedView, setDetailedView] = useState(false);
  const [showVersionConnections, setShowVersionConnections] = useState(true);
  const [showSynapses, setShowSynapses] = useState(false); // Synapse visualization
  const [synapseDepth, setSynapseDepth] = useState(1); // How many parent levels to show
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set());
  const [versionsMap, setVersionsMap] = useState<Map<string, EntryVersion[]>>(new Map());
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showPhysicsPanel, setShowPhysicsPanel] = useState(false);
  
  // Physics settings
  const [physicsSettings, setPhysicsSettings] = useState<PhysicsSettings>({
    centerForce: DEFAULT_PHYSICS.centerForce,
    chargeStrength: DEFAULT_PHYSICS.chargeStrength,
    linkDistance: DEFAULT_PHYSICS.linkDistance,
    linkStrength: DEFAULT_PHYSICS.linkStrength,
    collisionRadius: DEFAULT_PHYSICS.collisionRadius,
    velocityDecay: DEFAULT_PHYSICS.velocityDecay,
    alphaDecay: DEFAULT_PHYSICS.alphaDecay,
  });
  
  const resetPhysics = useCallback(() => {
    setPhysicsSettings({
      centerForce: DEFAULT_PHYSICS.centerForce,
      chargeStrength: DEFAULT_PHYSICS.chargeStrength,
      linkDistance: DEFAULT_PHYSICS.linkDistance,
      linkStrength: DEFAULT_PHYSICS.linkStrength,
      collisionRadius: DEFAULT_PHYSICS.collisionRadius,
      velocityDecay: DEFAULT_PHYSICS.velocityDecay,
      alphaDecay: DEFAULT_PHYSICS.alphaDecay,
    });
  }, []);
  
  const [fitToViewFn, setFitToViewFn] = useState<(() => void) | null>(null);

  // Fetch versions for all entries when detailed view is enabled
  useEffect(() => {
    if (!detailedView || !isOpen || entries.length === 0) {
      return;
    }
    
    const fetchVersions = async () => {
      setVersionsLoading(true);
      const newMap = new Map<string, EntryVersion[]>();
      
      try {
        await Promise.all(
          entries.map(async (entry) => {
            try {
              const versions = await api.getEntryVersions(entry.id);
              if (versions && versions.length > 0) {
                newMap.set(entry.id, versions);
              }
            } catch (e) {
              console.error(`Failed to fetch versions for entry ${entry.id}:`, e);
            }
          })
        );
        setVersionsMap(newMap);
      } finally {
        setVersionsLoading(false);
      }
    };
    
    fetchVersions();
  }, [detailedView, isOpen, entries]);
  
  // Handler for toggling entry expansion
  const handleToggleExpand = useCallback((entryId: string) => {
    setExpandedEntryIds(prev => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  }, []);
  
  // Expand all / collapse all
  const handleExpandAll = useCallback(() => {
    const entriesWithVersions = entries.filter(e => {
      const versions = versionsMap.get(e.id);
      return versions && versions.length > 0;
    });
    setExpandedEntryIds(new Set(entriesWithVersions.map(e => e.id)));
  }, [entries, versionsMap]);
  
  const handleCollapseAll = useCallback(() => {
    setExpandedEntryIds(new Set());
  }, []);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0 gap-0 bg-background/95 backdrop-blur-xl border-border/50 shadow-2xl overflow-hidden [&>button]:hidden">
        <DialogTitle className="sr-only">Branch Visualization</DialogTitle>
        <DialogDescription className="sr-only">
          Interactive visualization of conversation branches and history.
        </DialogDescription>
        
        {/* Header / Controls */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              Branch Visualization
            </h2>
            
            <div className="flex bg-background/50 backdrop-blur-md rounded-lg border p-1 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={layoutMode === 'force' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setLayoutMode('force')}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Force Layout</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={layoutMode === 'hierarchical' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setLayoutMode('hierarchical')}
                  >
                    <GitGraph className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Hierarchical Layout</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={layoutMode === 'radial' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setLayoutMode('radial')}
                  >
                    <CircleDot className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Radial Layout</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex bg-background/50 backdrop-blur-md rounded-lg border p-1 gap-1">
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showParticles ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowParticles(!showParticles)}
                  >
                    <Sparkles className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Particles</TooltipContent>
              </Tooltip>
              
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showLabels ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowLabels(!showLabels)}
                  >
                    <Type className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Labels</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showSynapses ? 'secondary' : 'ghost'}
                    size="icon"
                    className={cn("h-8 w-8", showSynapses && "bg-amber-500 text-white hover:bg-amber-600")}
                    onClick={() => setShowSynapses(!showSynapses)}
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {showSynapses ? 'Hide' : 'Show'} Context Synapses (which blocks created AI responses)
                </TooltipContent>
              </Tooltip>
              
              {showSynapses && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs font-mono"
                      onClick={() => setSynapseDepth((d) => (d % 3) + 1)}
                    >
                      {synapseDepth}×
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Synapse Depth: {synapseDepth} level{synapseDepth !== 1 ? 's' : ''} (click to cycle)
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            
            {/* Detailed View Controls */}
            <div className="flex bg-background/50 backdrop-blur-md rounded-lg border p-1 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={detailedView ? 'secondary' : 'ghost'}
                    size="icon"
                    className={cn("h-8 w-8", detailedView && "bg-primary text-primary-foreground")}
                    onClick={() => setDetailedView(!detailedView)}
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {detailedView ? 'Disable' : 'Enable'} Detailed View (Show Versions)
                </TooltipContent>
              </Tooltip>
              
              {detailedView && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={showVersionConnections ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowVersionConnections(!showVersionConnections)}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle Version Connections</TooltipContent>
                  </Tooltip>
                  
                  <div className="w-px h-6 bg-border mx-1" />
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleExpandAll}
                        disabled={versionsLoading}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Expand All Blocks</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleCollapseAll}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Collapse All Blocks</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>            
            {/* Physics Settings Toggle */}
            <div className="flex bg-background/50 backdrop-blur-md rounded-lg border p-1 gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showPhysicsPanel ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowPhysicsPanel(!showPhysicsPanel)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Physics Settings</TooltipContent>
              </Tooltip>
            </div>          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <Button variant="outline" size="icon" onClick={() => fitToViewFn?.()}>
              <Maximize className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-destructive/10 hover:text-destructive">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Visualization area */}
        <div className="w-full h-full relative bg-linear-to-br from-background via-background/95 to-muted/20">
             {versionsLoading && detailedView && (
               <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-background/90 backdrop-blur-md rounded-lg border px-4 py-2 shadow-lg">
                 <span className="text-sm text-muted-foreground">Loading version data...</span>
               </div>
             )}
             
             {/* Physics Settings Panel */}
             {showPhysicsPanel && (
               <div className="absolute top-20 right-6 z-50 bg-background/95 backdrop-blur-md rounded-lg border shadow-xl w-72 pointer-events-auto">
                 <div className="flex items-center justify-between p-3 border-b">
                   <h3 className="text-sm font-semibold flex items-center gap-2">
                     <Settings2 className="h-4 w-4" />
                     Physics Settings
                   </h3>
                   <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetPhysics}>
                     <RotateCcw className="h-3 w-3" />
                   </Button>
                 </div>
                 <div className="p-3 space-y-4">
                   <div className="space-y-2">
                     <div className="flex justify-between text-xs">
                       <span className="text-muted-foreground">Center Force</span>
                       <span className="font-mono">{physicsSettings.centerForce.toFixed(2)}</span>
                     </div>
                     <input
                       type="range"
                       min="0"
                       max="1"
                       step="0.05"
                       value={physicsSettings.centerForce}
                       onChange={(e) => setPhysicsSettings(s => ({ ...s, centerForce: parseFloat(e.target.value) }))}
                       className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                     />
                   </div>
                   
                   <div className="space-y-2">
                     <div className="flex justify-between text-xs">
                       <span className="text-muted-foreground">Repulsion Force</span>
                       <span className="font-mono">{Math.abs(physicsSettings.chargeStrength)}</span>
                     </div>
                     <input
                       type="range"
                       min="100"
                       max="2000"
                       step="50"
                       value={Math.abs(physicsSettings.chargeStrength)}
                       onChange={(e) => setPhysicsSettings(s => ({ ...s, chargeStrength: -parseFloat(e.target.value) }))}
                       className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                     />
                   </div>
                   
                   <div className="space-y-2">
                     <div className="flex justify-between text-xs">
                       <span className="text-muted-foreground">Link Distance</span>
                       <span className="font-mono">{physicsSettings.linkDistance}</span>
                     </div>
                     <input
                       type="range"
                       min="50"
                       max="300"
                       step="10"
                       value={physicsSettings.linkDistance}
                       onChange={(e) => setPhysicsSettings(s => ({ ...s, linkDistance: parseFloat(e.target.value) }))}
                       className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                     />
                   </div>
                   
                   <div className="space-y-2">
                     <div className="flex justify-between text-xs">
                       <span className="text-muted-foreground">Link Strength</span>
                       <span className="font-mono">{physicsSettings.linkStrength.toFixed(2)}</span>
                     </div>
                     <input
                       type="range"
                       min="0.1"
                       max="2"
                       step="0.1"
                       value={physicsSettings.linkStrength}
                       onChange={(e) => setPhysicsSettings(s => ({ ...s, linkStrength: parseFloat(e.target.value) }))}
                       className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                     />
                   </div>
                   
                   <div className="space-y-2">
                     <div className="flex justify-between text-xs">
                       <span className="text-muted-foreground">Collision Radius</span>
                       <span className="font-mono">{physicsSettings.collisionRadius}</span>
                     </div>
                     <input
                       type="range"
                       min="10"
                       max="100"
                       step="5"
                       value={physicsSettings.collisionRadius}
                       onChange={(e) => setPhysicsSettings(s => ({ ...s, collisionRadius: parseFloat(e.target.value) }))}
                       className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                     />
                   </div>
                   
                   <div className="space-y-2">
                     <div className="flex justify-between text-xs">
                       <span className="text-muted-foreground">Velocity Decay</span>
                       <span className="font-mono">{physicsSettings.velocityDecay.toFixed(2)}</span>
                     </div>
                     <input
                       type="range"
                       min="0.1"
                       max="0.9"
                       step="0.05"
                       value={physicsSettings.velocityDecay}
                       onChange={(e) => setPhysicsSettings(s => ({ ...s, velocityDecay: parseFloat(e.target.value) }))}
                       className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                     />
                   </div>
                 </div>
               </div>
             )}
             
             <BranchGraph
                entries={entries}
                stagedEntryIds={stagedEntryIds}
                viewMode="fullscreen"
                layoutMode={layoutMode}
                showParticles={showParticles}
                showLabels={showLabels}
                showVersionNumbers={true}
                colorByProvider={false}
                onNodeClick={() => {
                    // Optional: Close dialog or show details?
                    // For now, default staging behavior in BranchGraph is good.
                }}
                onFitToView={(fn) => setFitToViewFn(() => fn)}
                // Version-aware props
                detailedView={detailedView}
                versionsMap={versionsMap}
                expandedEntryIds={expandedEntryIds}
                onToggleExpand={handleToggleExpand}
                showVersionConnections={showVersionConnections}
                // Synapse visualization
                showSynapses={showSynapses}
                synapseDepth={synapseDepth}
                // Physics config
                physicsConfig={physicsSettings}
              />
        </div>

        {/* Footer Info */}
        <div className="absolute bottom-6 left-6 z-50 pointer-events-none">
          <div className="bg-background/80 backdrop-blur-md rounded-lg border p-3 shadow-lg max-w-md pointer-events-auto">
             <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                  <Info className="h-3 w-3" />
                  Graph Controls
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Double-click node</span>
                  <span className="text-foreground">{detailedView ? 'Expand/Collapse versions' : 'Expand/Focus'}</span>
                  <span>Drag node</span>
                  <span className="text-foreground">Move manually</span>
                  <span>Scroll</span>
                  <span className="text-foreground">Zoom in/out</span>
                  <span>Click empty space</span>
                  <span className="text-foreground">Drag to pan</span>
                  {detailedView && (
                    <>
                      <span>Click +/− button</span>
                      <span className="text-foreground">Toggle version history</span>
                    </>
                  )}
                </div>
                {detailedView && (
                  <div className="pt-2 border-t mt-2 space-y-1">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground">Legend</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500/50" />
                        <span>Version node</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 bg-green-500" />
                        <span>Version connection</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-green-500 text-white px-1 rounded">←v2</span>
                        <span>Created from v2</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>📌</span>
                        <span>Current version</span>
                      </div>
                    </div>
                  </div>
                )}
                {showSynapses && (
                  <div className="pt-2 border-t mt-2 space-y-1">
                    <h4 className="text-xs font-semibold uppercase text-amber-500 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      Context Synapses (Depth: {synapseDepth})
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Amber arcs show which blocks were staged to create AI responses. Brighter = closer parents.
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          <div className="w-2 h-3 bg-amber-300 rounded-sm" />
                          <div className="w-2 h-3 bg-amber-400 rounded-sm" />
                          <div className="w-2 h-3 bg-amber-600 rounded-sm" />
                        </div>
                        <span>Depth gradient</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Hover node</span>
                        <span className="text-foreground">→ Show {synapseDepth} parent level{synapseDepth !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// LAUNCH BUTTON
// ============================================================

export function FullscreenBranchGraphButton({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { entries } = useAppStore();

  if (entries.length === 0) {
    return null;
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('gap-2', className)}
            onClick={() => setIsOpen(true)}
          >
            <GitBranch className="h-4 w-4" />
            View Branches
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open interactive branch visualization</TooltipContent>
      </Tooltip>
      
      <FullscreenBranchGraph isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default FullscreenBranchGraph;
