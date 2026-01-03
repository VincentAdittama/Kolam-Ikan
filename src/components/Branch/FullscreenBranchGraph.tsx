import { useState } from 'react';
import {
  Maximize,
  X,
  Share2,
  GitGraph,
  CircleDot,
  Sparkles,
  Type,
  Info,
  GitBranch
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
import { BranchGraph } from './BranchGraph';

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
  
  const [fitToViewFn, setFitToViewFn] = useState<(() => void) | null>(null);

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
            </div>
          </div>

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
              />
        </div>

        {/* Footer Info */}
        <div className="absolute bottom-6 left-6 z-50 pointer-events-none">
          <div className="bg-background/80 backdrop-blur-md rounded-lg border p-3 shadow-lg max-w-sm pointer-events-auto">
             <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                  <Info className="h-3 w-3" />
                  Graph Controls
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Double-click node</span>
                  <span className="text-foreground">Expand/Focus</span>
                  <span>Drag node</span>
                  <span className="text-foreground">Move manually</span>
                  <span>Scroll</span>
                  <span className="text-foreground">Zoom in/out</span>
                  <span>Click empty space</span>
                  <span className="text-foreground">Drag to pan</span>
                </div>
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
