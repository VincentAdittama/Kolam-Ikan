import { useCallback, useRef } from 'react';
import { GitBranch } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { BranchGraph } from './BranchGraph';

interface BranchVisualizationProps {
  className?: string;
  onNodeClick?: (node: import('@/types').BranchNode) => void;
  onNodeDoubleClick?: (node: import('@/types').BranchNode) => void;
}

export function SidebarBranchGraph({
  className,
  onNodeClick,
  onNodeDoubleClick,
}: BranchVisualizationProps) {
  const { entries, stagedEntryIds } = useAppStore();
  const fitToViewRef = useRef<(() => void) | null>(null);

  const handleFitToView = useCallback((fn: () => void) => {
    fitToViewRef.current = fn;
  }, []);

  if (entries.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="text-center text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No entries to visualize</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden bg-linear-to-b from-background to-muted/20 rounded-lg',
        className
      )}
    >
      <BranchGraph
        entries={entries}
        stagedEntryIds={stagedEntryIds}
        viewMode="sidebar"
        layoutMode="hierarchical"
        showLabels={true}
        showVersionNumbers={true}
        colorByProvider={false}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onFitToView={handleFitToView}
        enableDrag={false}
      />
    </div>
  );
}

export default SidebarBranchGraph;
