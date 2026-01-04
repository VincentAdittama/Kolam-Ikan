import { useEffect, useMemo, useState, useRef, useId } from 'react';
import * as d3 from 'd3';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import type { BranchNode, BranchLink, Entry, EntryVersion } from '@/types';
import {
  ROLE_COLORS,
  DEFAULT_PHYSICS,
  HIERARCHICAL_PHYSICS,
  DETAILED_VIEW_PHYSICS,
  getNodeRadius,
  getNodeFill,
  buildBranchTree,
  buildDetailedBranchTree,
  createParticle,
  updateParticles,
  type Particle
} from './utils';

export type LayoutMode = 'force' | 'hierarchical' | 'radial';

// Type for version group data used in D3 rendering
interface VersionGroupData {
  entryId: string;
  nodeIds: string[];
}

interface BranchGraphProps {
  className?: string;
  entries: Entry[];
  stagedEntryIds: Set<string>;
  viewMode?: 'sidebar' | 'fullscreen';
  layoutMode?: LayoutMode;
  showParticles?: boolean;
  onNodeClick?: (node: BranchNode) => void;
  onNodeDoubleClick?: (node: BranchNode) => void;
  colorByProvider?: boolean;
  showLabels?: boolean;
  showVersionNumbers?: boolean;
  onFitToView?: (fn: (immediate?: boolean) => void) => void;
  enableDrag?: boolean;
  // === VERSION-AWARE PROPS ===
  /** Enable detailed view with version sub-nodes */
  detailedView?: boolean;
  /** Map of entry ID to its versions (required for detailed view) */
  versionsMap?: Map<string, EntryVersion[]>;
  /** Set of entry IDs that are expanded to show versions */
  expandedEntryIds?: Set<string>;
  /** Callback when a node is expanded/collapsed */
  onToggleExpand?: (entryId: string) => void;
  /** Show version connection indicators */
  showVersionConnections?: boolean;
  // === SYNAPSE (CONTEXT DEPENDENCY) PROPS ===
  /** Show context dependency links (synapses) - visualizes which blocks were staged to create AI responses */
  showSynapses?: boolean;
  /** Number of parent levels to highlight when hovering (1 = direct parents only, 2 = parents + grandparents, etc.) */
  synapseDepth?: number;
  // === PHYSICS CONFIGURATION ===
  /** Custom physics settings - overrides defaults based on layoutMode */
  physicsConfig?: {
    centerForce?: number;
    chargeStrength?: number;
    linkDistance?: number;
    linkStrength?: number;
    collisionRadius?: number;
    velocityDecay?: number;
    alphaDecay?: number;
  };
}

export function BranchGraph({
  className,
  entries,
  stagedEntryIds,
  layoutMode = 'force',
  showParticles = false,
  onNodeClick,
  onNodeDoubleClick,
  colorByProvider = false,
  showLabels = true,
  showVersionNumbers = true,
  onFitToView,
  enableDrag = true,
  // Version-aware props
  detailedView = false,
  versionsMap = new Map(),
  expandedEntryIds = new Set(),
  onToggleExpand,
  showVersionConnections = true,
  // Synapse props
  showSynapses = false,
  synapseDepth = 1,
  // Physics config
  physicsConfig,
}: BranchGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<BranchNode, BranchLink> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const graphId = useId().replace(/:/g, '');
  const stagedEntryIdsRef = useRef<Set<string>>(stagedEntryIds);
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const prevEntriesLengthRef = useRef(0);
  const isInitializedRef = useRef(false);
  const isFirstRenderRef = useRef(true);
  const activeLinksRef = useRef<BranchLink[]>([]);
  const prevTreeNodeIdsRef = useRef<string>(''); // Track tree changes by stringified node IDs

  // Synapse: Track focused node for dependency highlighting
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const focusedNodeIdRef = useRef<string | null>(null);

  const { stageEntry, unstageEntry } = useAppStore();

  // Keep refs in sync
  useEffect(() => {
    stagedEntryIdsRef.current = stagedEntryIds;
  }, [stagedEntryIds]);

  useEffect(() => {
    focusedNodeIdRef.current = focusedNodeId;
  }, [focusedNodeId]);

  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Build tree (regular or detailed based on detailedView prop)
  const tree = useMemo(() => {
    const t = detailedView 
      ? buildDetailedBranchTree(entries, versionsMap, expandedEntryIds)
      : buildBranchTree(entries);
    
    // Restore positions or set smart defaults
    t.nodes.forEach((node, i) => {
      const savedPos = nodePositionsRef.current.get(node.id);
      if (savedPos) {
        node.x = savedPos.x;
        node.y = savedPos.y;
      } else if (dimensions.width > 0) {
        // For version nodes, position them in a vertical stack within their group
        if (node.isVersionNode && node.versionGroupIndex !== undefined) {
          const baseX = dimensions.width / 2;
          const baseY = 150 + (node.depth * 100);
          node.x = baseX + (node.versionGroupIndex * 15);
          node.y = baseY + (node.versionGroupIndex * 40);
        } else {
          // Start near top-center instead of (0,0) to prevent long camera pans
          node.x = dimensions.width / 2 + (i % 5 - 2) * 20;
          node.y = 150 + Math.floor(i / 5) * 40;
        }
      }
    });
    return t;
  }, [entries, dimensions.width, detailedView, versionsMap, expandedEntryIds]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    
    // Initial size
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Particle System
  useEffect(() => {
    if (!canvasRef.current || !showParticles) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      if (!canvasRef.current) return;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      particlesRef.current = updateParticles(particlesRef.current);
      
      const transform = transformRef.current;
      particlesRef.current.forEach(p => {
        ctx.beginPath();
        ctx.arc(
          transform.applyX(p.x),
          transform.applyY(p.y),
          p.size * p.life * transform.k,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationRef.current);
  }, [showParticles, dimensions]);

  // Main D3 Effect
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || dimensions.width === 0) return;

    const { width, height } = dimensions;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // If no nodes, clear and return
    if (tree.nodes.length === 0) {
        svg.selectAll('*').remove();
        isInitializedRef.current = false;
        return;
    }

    // Initial clear or if we need to re-initialize
    if (!isInitializedRef.current) {
        svg.selectAll('*').remove();
    }

    // Reuse or create defs
    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) {
        defs = svg.append('defs');
        
        // Glow Filter
        const glow = defs.append('filter')
          .attr('id', `node-glow-${graphId}`)
          .attr('x', '-100%')
          .attr('y', '-100%')
          .attr('width', '300%')
          .attr('height', '300%');
        
        glow.append('feGaussianBlur')
          .attr('stdDeviation', '4')
          .attr('result', 'blur');
        
        glow.append('feComposite')
          .attr('in', 'SourceGraphic')
          .attr('in2', 'blur')
          .attr('operator', 'over');

        // Gradients
        ['user', 'ai'].forEach(role => {
          const gradient = defs.append('radialGradient')
            .attr('id', `gradient-${role}-${graphId}`)
            .attr('cx', '30%')
            .attr('cy', '30%');
          gradient.append('stop').attr('offset', '0%').attr('stop-color', ROLE_COLORS[role as 'user' | 'ai'].glow);
          gradient.append('stop').attr('offset', '100%').attr('stop-color', ROLE_COLORS[role as 'user' | 'ai'].main);
        });

        // Arrow Marker
        defs.append('marker')
          .attr('id', `arrow-marker-${graphId}`)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 10)
          .attr('refY', 0)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-4L10,0L0,4')
          .attr('fill', 'rgba(100, 116, 139, 0.9)'); // Slate-500 for better visibility
        
        // Synapse Arrow Marker (Amber for context dependencies)
        defs.append('marker')
          .attr('id', `arrow-synapse-${graphId}`)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 10)
          .attr('refY', 0)
          .attr('markerWidth', 5)
          .attr('markerHeight', 5)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-4L10,0L0,4')
          .attr('fill', '#F59E0B');
    }

    // Zoom Container
    let g = svg.select<SVGGElement>('.zoom-container');
    if (g.empty()) {
        g = svg.append('g').attr('class', 'zoom-container');
    }

    // Zoom Behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 5])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr('transform', event.transform.toString());
        transformRef.current = event.transform;
      });

    svg.call(zoom);
    zoomRef.current = zoom;

    // Physics - use detailed view physics when version nodes are present, or custom config
    const basePhysics = detailedView && expandedEntryIds.size > 0
      ? DETAILED_VIEW_PHYSICS
      : layoutMode === 'hierarchical' 
        ? HIERARCHICAL_PHYSICS 
        : DEFAULT_PHYSICS;
    
    // Merge with custom physics config if provided
    const physics = physicsConfig 
      ? { ...basePhysics, ...physicsConfig }
      : basePhysics;
    
    // Filter links BEFORE creating simulation: only include context links if showSynapses is true
    // This ensures the simulation and rendering use the same set of links
    const activeLinks = tree.links.filter((d: BranchLink) => {
      if (d.isContextLink) return showSynapses;
      return true;
    });
    
    // Store in ref for event handlers to access current value
    activeLinksRef.current = activeLinks;
    
    // Dispose old simulation
    if (simulationRef.current) simulationRef.current.stop();

    const simulation = d3.forceSimulation<BranchNode>(tree.nodes)
      .force('link', d3.forceLink<BranchNode, BranchLink>(activeLinks)
        .id(d => d.id)
        .distance(d => {
          // Shorter distance for version links to keep them grouped
          if ((d as BranchLink).isVersionLink) return physics.linkDistance * 0.6;
          return physics.linkDistance;
        })
        .strength(d => {
          // Context links (synapses) should have zero force strength - they don't affect physics
          if ((d as BranchLink).isContextLink) return 0;
          return d.strength * physics.linkStrength;
        }))
      .force('charge', d3.forceManyBody()
        .strength(d => {
          // Weaker repulsion for version nodes to keep them clustered
          if ((d as BranchNode).isVersionNode) return physics.chargeStrength * 0.5;
          return physics.chargeStrength;
        })
        .distanceMax(300))
      .force('center', d3.forceCenter(width / 2, 150).strength(physics.centerForce))
      .force('collision', d3.forceCollide<BranchNode>()
        .radius(d => getNodeRadius(d) + (d.isVersionNode ? 5 : 10))
        .strength(0.8))
      // Bounding box force - keep nodes within viewport
      .force('bounds', () => {
        const padding = 60;
        for (const node of tree.nodes) {
          if (node.x !== undefined) {
            // Soft boundary using elastic force
            if (node.x < padding) {
              node.vx = (node.vx || 0) + (padding - node.x) * 0.1;
            } else if (node.x > width - padding) {
              node.vx = (node.vx || 0) + (width - padding - node.x) * 0.1;
            }
          }
          if (node.y !== undefined) {
            if (node.y < padding) {
              node.vy = (node.vy || 0) + (padding - node.y) * 0.1;
            } else if (node.y > height - padding) {
              node.vy = (node.vy || 0) + (height - padding - node.y) * 0.1;
            }
          }
        }
      })
      .velocityDecay(physics.velocityDecay)
      .alphaDecay(physics.alphaDecay);

     if (layoutMode === 'hierarchical') {
      simulation
        .force('y', d3.forceY<BranchNode>()
          .y(d => 100 + d.depth * 120)
          .strength(0.5))
        .force('x', d3.forceX<BranchNode>()
          .x(d => {
            const offset = d.branchPath.reduce((acc, v, i) => acc + v * 100 / (i + 1), 0);
            return width / 2 + offset - (tree.branchCount * 50) / 2;
          })
          .strength(0.3));
    } else if (layoutMode === 'radial') {
      simulation.force('radial', d3.forceRadial<BranchNode>(
        d => 80 + d.depth * 80,
        width / 2,
        height / 2
      ).strength(0.8));
    }

    simulationRef.current = simulation;

    // Check if tree structure has changed by comparing node IDs
    const currentTreeNodeIds = tree.nodes.map(n => n.id).join(',');
    const treeStructureChanged = currentTreeNodeIds !== prevTreeNodeIdsRef.current;
    prevTreeNodeIdsRef.current = currentTreeNodeIds;

    // Pre-warm the simulation ONLY if tree structure changed (new/removed nodes)
    // Skip pre-warming on dimension-only changes to preserve layout stability
    if (treeStructureChanged || !isInitializedRef.current) {
      for (let i = 0; i < 150; i++) simulation.tick();
    }

    // === DRAW VERSION GROUPS (background containers) ===
    // Always ensure the container exists and manage groups properly
    let groupsContainer = g.select<SVGGElement>('.version-groups');
    if (groupsContainer.empty()) {
      groupsContainer = g.insert<SVGGElement>('g', ':first-child').attr('class', 'version-groups');
    }
    
    // Determine if we should show version groups
    const shouldShowGroups = detailedView && tree.versionGroups && tree.versionGroups.size > 0;
    
    // Build group data - empty array if not showing
    const groupData: VersionGroupData[] = shouldShowGroups 
      ? Array.from(tree.versionGroups!.entries()).map(([entryId, group]) => ({
          entryId,
          nodeIds: group.nodeIds,
        }))
      : [];
    
    // Data join - this will properly remove all groups when groupData is empty
    groupsContainer.selectAll<SVGRectElement, VersionGroupData>('.version-group')
      .data(groupData, (d) => d.entryId)
      .join(
        enter => enter.append('rect')
          .attr('class', 'version-group')
          .attr('rx', 12)
          .attr('ry', 12)
          .attr('fill', 'rgba(139, 92, 246, 0.08)')
          .attr('stroke', 'rgba(139, 92, 246, 0.25)')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,4'),
        update => update,
        exit => exit.remove()
      );

    // Draw Links (use the same activeLinks that the simulation is using)
    const linkGroup = g.select('.links').empty() ? g.append('g').attr('class', 'links') : g.select('.links');
    
    const links = (linkGroup as d3.Selection<SVGGElement, unknown, null, undefined>).selectAll<SVGPathElement, BranchLink>('path')
      .data(activeLinks, (d) => {
        const sourceId = typeof d.source === 'object' ? (d.source as BranchNode).id : d.source;
        const targetId = typeof d.target === 'object' ? (d.target as BranchNode).id : d.target;
        return `${sourceId}-${targetId}`;
      })
      .join('path')
      .attr('class', (d: BranchLink) => d.isContextLink ? 'context-link synapse' : 'structural-link')
      .attr('fill', 'none')
      .attr('stroke', (d: BranchLink) => {
        if (d.isContextLink) return '#F59E0B'; // Amber for context dependencies (synapses)
        if (d.isVersionLink) return 'rgba(139, 92, 246, 0.4)'; // Muted purple for internal version links
        if (d.isVersionConnection && showVersionConnections) return 'rgba(34, 197, 94, 0.5)'; // Muted green for cross-version
        if (d.isBranch) return 'rgba(99, 102, 241, 0.7)'; // Indigo for branches
        return 'rgba(148, 163, 184, 0.8)'; // Slate-400 with high opacity for structural linear links
      })
      .attr('stroke-width', (d: BranchLink) => {
        if (d.isContextLink) return 1.5;
        if (d.isVersionLink) return 2;
        if (d.isBranch) return 3;
        return 2.5; // Thicker than 2, thinner than 3
      })
      .attr('stroke-dasharray', (d: BranchLink) => {
        if (d.isContextLink) return '5,5'; // Dashed for synapses
        if (d.isVersionLink) return '3,3';
        if (d.isBranch) return '8,4';
        return 'none';
      })
      .attr('marker-end', (d: BranchLink) => 
        d.isContextLink ? `url(#arrow-synapse-${graphId})` : `url(#arrow-marker-${graphId})`)
      .attr('opacity', (d: BranchLink) => {
        if (!d.isContextLink) return 1;
        // Context links (synapses) are faint by default, light up when their source or target is focused
        const focused = focusedNodeIdRef.current;
        if (focused) {
          const srcId = typeof d.source === 'object' ? (d.source as BranchNode).id : d.source;
          const tgtId = typeof d.target === 'object' ? (d.target as BranchNode).id : d.target;
          return (srcId === focused || tgtId === focused) ? 1 : 0.15;
        }
        return 0.25; // Faint default
      })
      .style('pointer-events', (d: BranchLink) => d.isContextLink ? 'none' : 'auto');

    // Draw Nodes
    const nodeGroup = g.select('.nodes').empty() ? g.append('g').attr('class', 'nodes') : g.select('.nodes');
    const nodes = (nodeGroup as d3.Selection<SVGGElement, unknown, null, undefined>).selectAll<SVGGElement, BranchNode>('g.node-group')
      .data(tree.nodes, (d) => d.id)
      .join(
        (enter) => {
            const el = enter.append('g')
                .attr('class', 'node-group')
                .style('cursor', enableDrag ? 'grab' : 'pointer');

            if (enableDrag) {
                el.call(d3.drag<SVGGElement, BranchNode>()
                    .on('start', (event: d3.D3DragEvent<SVGGElement, BranchNode, unknown>, d: BranchNode) => {
                        if (!event.active) simulation.alphaTarget(0.3).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                        if (showParticles && d.x && d.y) {
                             const color = getNodeFill(d, colorByProvider);
                             for (let i = 0; i < 8; i++) {
                               particlesRef.current.push(createParticle(d.x, d.y, color));
                             }
                        }
                    })
                    .on('drag', (event: d3.D3DragEvent<SVGGElement, BranchNode, BranchNode>, d: BranchNode) => {
                        d.fx = event.x;
                        d.fy = event.y;
                    })
                    .on('end', (event: d3.D3DragEvent<SVGGElement, BranchNode, unknown>, d: BranchNode) => {
                        if (!event.active) simulation.alphaTarget(0);
                        d.fx = null;
                        d.fy = null;
                    })
                );
            }
            
            // 1. Main Node
            el.append('circle')
                .attr('class', 'node-main')
                .attr('stroke', 'rgba(255,255,255,0.2)')
                .attr('stroke-width', 2)
                .style('transition', 'r 0.2s ease');

            // 2. Glow Ring
            el.append('circle')
                .attr('class', 'glow-ring')
                .attr('fill', 'none')
                .attr('stroke-width', 2)
                .attr('filter', `url(#node-glow-${graphId})`);

            // 3. Staged Ring
            el.append('circle')
                .attr('class', 'staged-ring')
                .attr('fill', 'none')
                .attr('stroke', '#FBBF24')
                .attr('stroke-width', 3)
                .attr('stroke-dasharray', '6,3');
            
            // 4. Icon
            el.append('text')
                .attr('class', 'role-icon')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central');

            // 5. Head Dot
            el.append('circle')
                .attr('class', 'head-dot')
                .attr('r', 6)
                .attr('fill', '#22C55E')
                .attr('stroke', '#fff')
                .attr('stroke-width', 2);
            
            // 6. Label
             el.append('text')
                .attr('class', 'node-label')
                .attr('text-anchor', 'middle')
                .attr('fill', 'currentColor')
                .attr('font-size', '11px')
                .attr('opacity', 0.8);
            
            // 7. Version Badge
            const badge = el.append('g').attr('class', 'version-badge');
            badge.append('circle')
                .attr('r', 10)
                .attr('fill', 'hsl(var(--background))')
                .attr('stroke', 'hsl(var(--border))')
                .attr('stroke-width', 1);
            badge.append('text')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('font-size', '9px')
                .attr('font-weight', 'bold')
                .attr('fill', 'currentColor');
            
            // 8. Version Connection Badge (shows which parent version created this)
            const versionConnectionBadge = el.append('g').attr('class', 'version-connection-badge');
            versionConnectionBadge.append('rect')
                .attr('rx', 4)
                .attr('ry', 4)
                .attr('fill', 'rgba(34, 197, 94, 0.9)')
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
            versionConnectionBadge.append('text')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('font-size', '8px')
                .attr('font-weight', 'bold')
                .attr('fill', '#fff');

            // 9. Expand/Collapse Indicator (for detailed view)
            const expandIndicator = el.append('g').attr('class', 'expand-indicator');
            expandIndicator.append('circle')
                .attr('r', 8)
                .attr('fill', 'hsl(var(--primary))')
                .attr('stroke', '#fff')
                .attr('stroke-width', 1.5)
                .style('cursor', 'pointer');
            expandIndicator.append('text')
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'central')
                .attr('font-size', '10px')
                .attr('font-weight', 'bold')
                .attr('fill', '#fff');
                
            return el;
        },
        (update) => update,
        (exit) => exit.remove()
      );

    // Update Attributes for new and existing nodes
    nodes.each(function(this: SVGGElement, d: BranchNode) {
        const el = d3.select(this);
        const r = getNodeRadius(d);
        const isVersionNode = d.isVersionNode ?? false;

        // Main node - different style for version sub-nodes
        el.select('.node-main')
            .attr('r', r)
            .attr('fill', () => {
              if (isVersionNode && !d.isCurrentVersion) {
                // Slightly transparent for non-current versions
                return getNodeFill(d, colorByProvider);
              }
              return colorByProvider ? getNodeFill(d, true) : `url(#gradient-${d.role}-${graphId})`;
            })
            .attr('opacity', isVersionNode && !d.isCurrentVersion ? 0.7 : 1)
            .style('filter', d.isHead || d.isCurrentVersion ? `url(#node-glow-${graphId})` : 'none');
        
        el.select('.glow-ring')
            .attr('r', r + 8)
            .attr('stroke', getNodeFill(d, colorByProvider))
            .attr('opacity', (d.isHead || d.isCurrentVersion) ? 0.8 : 0);
        
        el.select('.staged-ring')
            .attr('r', r + 6)
            .attr('opacity', stagedEntryIdsRef.current.has(d.entryId) ? 1 : 0);
            
        // Different icons for version nodes
        el.select('.role-icon')
            .attr('font-size', isVersionNode ? '12px' : (d.isHead ? '18px' : '14px'))
            .text(() => {
              if (isVersionNode) {
                return d.isCurrentVersion ? '📌' : '📄';
              }
              return d.role === 'user' ? '👤' : '🤖';
            });
        
        el.select('.head-dot')
            .attr('cx', r * 0.7)
            .attr('cy', -r * 0.7)
            .attr('display', (d.isHead || d.isCurrentVersion) ? 'block' : 'none');
            
        el.select('.node-label')
            .attr('y', r + 18)
            .text(d.label)
            .attr('font-size', isVersionNode ? '9px' : '11px')
            .attr('display', showLabels ? 'block' : 'none');

        // Version badge
        // Always show version badge if showVersionNumbers is enabled - use fallback version 1 for entries without versionHead
        const versionNum = isVersionNode ? d.representedVersion : (d.versionNumber ?? 1);
        const hasVersionNumber = versionNum !== undefined && versionNum !== null;
        const versionBadge = el.select('.version-badge');
        versionBadge
             .attr('transform', `translate(${r * 0.8}, ${r * 0.5})`)
             .attr('display', (showVersionNumbers && hasVersionNumber) ? 'block' : 'none');
        // Update text separately to ensure it's always set correctly
        versionBadge.select('text')
             .text(`v${versionNum ?? 1}`);
        
        // Version connection badge - show which parent version created this node
        const hasVersionConnection = d.parentVersionNumber !== undefined && showVersionConnections;
        const vcBadge = el.select('.version-connection-badge');
        vcBadge
            .attr('display', hasVersionConnection ? 'block' : 'none')
            .attr('transform', `translate(${-r * 0.8}, ${-r * 0.8})`);
        if (hasVersionConnection) {
            const labelText = `←v${d.parentVersionNumber}`;
            vcBadge.select('rect')
                .attr('x', -16)
                .attr('y', -7)
                .attr('width', 32)
                .attr('height', 14);
            vcBadge.select('text')
                .text(labelText);
        }
        
        // Expand/collapse indicator - only show for blocks with versions in detailed mode
        const versions = versionsMap.get(d.entryId);
        const hasVersions = versions && versions.length > 0;
        const isExpanded = expandedEntryIds.has(d.entryId);
        const showExpandIndicator = detailedView && hasVersions && !isVersionNode;
        
        const expandIndicator = el.select('.expand-indicator');
        expandIndicator
            .attr('display', showExpandIndicator ? 'block' : 'none')
            .attr('transform', `translate(${-r * 0.8}, ${r * 0.5})`);
        if (showExpandIndicator) {
            expandIndicator.select('text')
                .text(isExpanded ? '−' : '+');
            expandIndicator.select('circle')
                .attr('fill', isExpanded ? 'hsl(var(--destructive))' : 'hsl(var(--primary))');
        }
    });

    // Events
    nodes
      .on('mouseenter', function(this: SVGGElement, _event: MouseEvent, d: BranchNode) {
        // Set focused node for synapse highlighting
        if (showSynapses) {
          setFocusedNodeId(d.id);
          
          // Build map of parent nodes to their depth level
          const parentDepthMap = new Map<string, number>();
          // Build map of links to their depth level for coloring
          const linkDepthMap = new Map<string, number>();
          
          const findParents = (nodeId: string, depth: number) => {
            if (depth > synapseDepth) return;
            
            const currentLinks = activeLinksRef.current;
            currentLinks.forEach((link: BranchLink) => {
              if (!link.isContextLink) return;
              const tgtId = typeof link.target === 'object' ? (link.target as BranchNode).id : link.target;
              const srcId = typeof link.source === 'object' ? (link.source as BranchNode).id : link.source;
              
              // If this node is the target, the source is a parent
              if (tgtId === nodeId) {
                // Store parent with its depth (keep the shallowest depth if already visited)
                if (!parentDepthMap.has(srcId) || parentDepthMap.get(srcId)! > depth) {
                  parentDepthMap.set(srcId, depth);
                }
                // Store this link with its depth
                const linkKey = `${srcId}-${tgtId}`;
                if (!linkDepthMap.has(linkKey) || linkDepthMap.get(linkKey)! > depth) {
                  linkDepthMap.set(linkKey, depth);
                }
                // Recursively find parents of this parent
                findParents(srcId, depth + 1);
              }
            });
          };
          findParents(d.id, 1);
          
          // Color gradient for depth: amber tones from bright (depth 1) to darker (higher depth)
          const getDepthColor = (depth: number): string => {
            // Amber shades: bright -> dark as depth increases
            const colors = ['#FCD34D', '#FBBF24', '#F59E0B', '#D97706', '#B45309'];
            return colors[Math.min(depth - 1, colors.length - 1)];
          };
          
          // Update synapse link opacities and colors - show all links in parent chain
          const synapseLinks = (linkGroup as d3.Selection<SVGGElement, unknown, null, undefined>).selectAll<SVGPathElement, BranchLink>('path.synapse');
          synapseLinks
            .transition().duration(150)
            .attr('opacity', function(this: SVGPathElement) {
              const link = d3.select(this).datum() as BranchLink;
              if (!link) return 0.08;
              const srcId = typeof link.source === 'object' ? (link.source as BranchNode).id : link.source;
              const tgtId = typeof link.target === 'object' ? (link.target as BranchNode).id : link.target;
              const linkKey = `${srcId}-${tgtId}`;
              // Show link if it's in our chain
              return linkDepthMap.has(linkKey) ? 1 : 0.08;
            })
            .attr('stroke', function(this: SVGPathElement) {
              const link = d3.select(this).datum() as BranchLink;
              if (!link) return '#F59E0B';
              const srcId = typeof link.source === 'object' ? (link.source as BranchNode).id : link.source;
              const tgtId = typeof link.target === 'object' ? (link.target as BranchNode).id : link.target;
              const linkKey = `${srcId}-${tgtId}`;
              const depth = linkDepthMap.get(linkKey);
              return depth ? getDepthColor(depth) : '#F59E0B';
            })
            .attr('stroke-width', function(this: SVGPathElement) {
              const link = d3.select(this).datum() as BranchLink;
              if (!link) return 1.5;
              const srcId = typeof link.source === 'object' ? (link.source as BranchNode).id : link.source;
              const tgtId = typeof link.target === 'object' ? (link.target as BranchNode).id : link.target;
              const linkKey = `${srcId}-${tgtId}`;
              return linkDepthMap.has(linkKey) ? 2.5 : 1.5;
            });
        }

        const radius = getNodeRadius(d);
        
        d3.select(this).select('.node-main')
          .transition().duration(150)
          .attr('r', radius * 1.15);

        d3.select(this).select('.glow-ring')
           .transition().duration(150)
          .attr('r', (radius * 1.15) + 10)
          .attr('opacity', 0.6);

        d3.select(this).select('.staged-ring')
           .transition().duration(150)
          .attr('r', (radius * 1.15) + 8);
          
        if (showParticles && d.x && d.y) {
           const color = getNodeFill(d, colorByProvider);
           for (let i = 0; i < 5; i++) {
             particlesRef.current.push(createParticle(d.x, d.y, color));
           }
        }
      })
      .on('mouseleave', function(this: SVGGElement, _event: MouseEvent, d: BranchNode) {
        // Clear focused node
        if (showSynapses) {
          setFocusedNodeId(null);
          // Reset synapse link opacities
          const synapseLinksReset = (linkGroup as d3.Selection<SVGGElement, unknown, null, undefined>).selectAll<SVGPathElement, BranchLink>('path.synapse');
          synapseLinksReset
            .transition().duration(150)
            .attr('opacity', 0.25)
            .attr('stroke-width', 1.5);
        }

        const radius = getNodeRadius(d);
        
        d3.select(this).select('.node-main')
          .transition().duration(150)
          .attr('r', radius);

        d3.select(this).select('.glow-ring')
          .transition().duration(150)
          .attr('r', radius + 8)
          .attr('opacity', d.isHead ? 0.8 : 0);

        d3.select(this).select('.staged-ring')
           .transition().duration(150)
          .attr('r', radius + 6);
          
      })
      .on('click', (event: MouseEvent, d: BranchNode) => {
        event.stopPropagation();
        onNodeClick?.(d);
        if (stagedEntryIdsRef.current.has(d.entryId)) {
          unstageEntry(d.entryId);
        } else {
          stageEntry(d.entryId);
        }
        
        if (showParticles && d.x && d.y) {
          const color = getNodeFill(d, colorByProvider);
          for (let i = 0; i < 15; i++) {
            particlesRef.current.push(createParticle(d.x, d.y, color));
          }
        }
      })
      .on('dblclick', (event: MouseEvent, d: BranchNode) => {
          event.stopPropagation();
          
          // In detailed view, double-click toggles expansion
          if (detailedView && !d.isVersionNode && onToggleExpand) {
            const versions = versionsMap.get(d.entryId);
            if (versions && versions.length > 0) {
              onToggleExpand(d.entryId);
              return;
            }
          }
          
          onNodeDoubleClick?.(d);
      });
    
    // Add click handler for expand indicator
    if (detailedView) {
      (nodes as d3.Selection<SVGGElement, BranchNode, SVGGElement, unknown>)
        .selectAll<SVGGElement, BranchNode>('.expand-indicator')
        .on('click', function(this: SVGGElement, event: MouseEvent) {
          event.stopPropagation();
          // Get parent node data
          const parentNode = this.parentNode as Element;
          const nodeData = d3.select<Element, BranchNode>(parentNode).datum();
          if (onToggleExpand && nodeData && !nodeData.isVersionNode) {
            onToggleExpand(nodeData.entryId);
          }
        });
    }

    // Tick Handler
    simulation.on('tick', () => {
      // Update version group backgrounds
      if (detailedView && tree.versionGroups && tree.versionGroups.size > 0) {
        const zoomG = d3.select(svgRef.current).select<SVGGElement>('.zoom-container');
        zoomG.selectAll<SVGRectElement, VersionGroupData>('.version-group')
          .each(function(groupData: VersionGroupData) {
            const groupNodes = tree.nodes.filter(n => groupData.nodeIds.includes(n.id));
            if (groupNodes.length === 0) return;
            
            // Calculate bounding box with padding
            const padding = 20;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            groupNodes.forEach(n => {
              const r = getNodeRadius(n);
              if (n.x !== undefined && n.y !== undefined) {
                minX = Math.min(minX, n.x - r - padding);
                maxX = Math.max(maxX, n.x + r + padding);
                minY = Math.min(minY, n.y - r - padding);
                maxY = Math.max(maxY, n.y + r + padding);
              }
            });
            
            d3.select(this)
              .attr('x', minX)
              .attr('y', minY)
              .attr('width', maxX - minX)
              .attr('height', maxY - minY);
          });
      }

      links.attr('d', (d: BranchLink) => {
        const source = d.source as unknown as BranchNode;
        const target = d.target as unknown as BranchNode;
        if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return '';

        // Calculate the source and target radii
        const sourceRadius = getNodeRadius(source);
        const targetRadius = getNodeRadius(target);

        // Helper function to calculate edge point on circle perimeter
        const getEdgePoint = (fromX: number, fromY: number, toX: number, toY: number, radius: number) => {
          const dx = toX - fromX;
          const dy = toY - fromY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance === 0) return { x: fromX, y: fromY };

          const ratio = radius / distance;
          return {
            x: fromX + dx * (1 - ratio),
            y: fromY + dy * (1 - ratio)
          };
        };

        // Calculate actual start and end points on circle edges
        const sourceEdge = getEdgePoint(source.x, source.y, target.x, target.y, sourceRadius);
        const targetEdge = getEdgePoint(target.x, target.y, source.x, source.y, targetRadius);

        // === CONTEXT LINK (SYNAPSE) VISUALIZATION ===
        // Draw a wide curved arc that goes to the side to avoid crossing the main spine
        if (d.isContextLink) {
          const dy = targetEdge.y - sourceEdge.y;
          
          // Artificial curvature based on vertical distance
          // The further apart, the wider the arc
          const curveOffset = 80 + (Math.abs(dy) * 0.15);
          
          // Determine side: user nodes curve left, ai nodes curve right
          // This creates a visual "handedness" that separates sources
          const direction = source.role === 'user' ? -1 : 1;
          
          // Control point for quadratic bezier - creates wide "C" curve
          const cpX = sourceEdge.x + (direction * curveOffset);
          const cpY = (sourceEdge.y + targetEdge.y) / 2;
          
          return `M${sourceEdge.x},${sourceEdge.y} Q${cpX},${cpY} ${targetEdge.x},${targetEdge.y}`;
        }

        // Curved path for version links to make them visually distinct
        if (d.isVersionLink) {
          const dx = targetEdge.x - sourceEdge.x;
          const dy = targetEdge.y - sourceEdge.y;
          const midX = sourceEdge.x + dx * 0.5;
          const midY = sourceEdge.y + dy * 0.5 - 10; // Slight arc
          return `M${sourceEdge.x},${sourceEdge.y}Q${midX},${midY} ${targetEdge.x},${targetEdge.y}`;
        }

        if (d.isBranch) {
          const dx = targetEdge.x - sourceEdge.x;
          const dy = targetEdge.y - sourceEdge.y;
          return `M${sourceEdge.x},${sourceEdge.y}Q${sourceEdge.x + dx / 2 + dy / 4},${sourceEdge.y + dy / 2 - dx / 4} ${targetEdge.x},${targetEdge.y}`;
        }

        // Straight line from edge to edge
        return `M${sourceEdge.x},${sourceEdge.y}L${targetEdge.x},${targetEdge.y}`;
      });

      nodes.attr('transform', (d: BranchNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      
      // Ambient particles for head
      if (showParticles) {
        const head = tree.nodes.find(n => n.isHead);
        if (head?.x && head.y && Math.random() > 0.92) {
          particlesRef.current.push(createParticle(head.x, head.y, ROLE_COLORS[head.role].glow));
        }
      }
    });
    
    // Fit to View
    const fitToView = (immediate = false) => {
        if (!svgRef.current || !zoomRef.current || tree.nodes.length === 0) return;
        
        // Calculate bounds from node data instead of DOM for absolute accuracy
        const nodes = tree.nodes;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        nodes.forEach(n => {
          const r = getNodeRadius(n);
          if (n.x !== undefined && n.y !== undefined) {
             minX = Math.min(minX, n.x - r);
             maxX = Math.max(maxX, n.x + r);
             minY = Math.min(minY, n.y - r);
             maxY = Math.max(maxY, n.y + r);
          }
        });

        const bWidth = maxX - minX;
        const bHeight = maxY - minY;
        
        if (bWidth <= 0 || bHeight <= 0) return;

        const padding = 60;
        const scale = Math.min(
            (width - padding * 2) / bWidth,
            (height - padding * 2) / bHeight,
            1.1
        );
        
        // Accurately center horizontally and align to top with padding
        const tx = width / 2 - (minX + bWidth / 2) * scale;
        const ty = padding - minY * scale;
        
        const target = d3.zoomIdentity.translate(tx, ty).scale(scale);

        if (immediate) {
          d3.select(svgRef.current).interrupt().call(zoomRef.current.transform, target);
        } else {
          d3.select(svgRef.current)
              .interrupt()
              .transition()
              .duration(600)
              .ease(d3.easeCubicInOut)
              .call(zoomRef.current.transform, target);
        }
    };

    if (onFitToView) {
        onFitToView(fitToView);
    }
    
    // Auto fit on entry change or initial load
    if (prevEntriesLengthRef.current !== entries.length || isFirstRenderRef.current) {
        const isInitial = isFirstRenderRef.current;
        isFirstRenderRef.current = false;
        
        // No delay needed because simulation is pre-warmed
        fitToView(isInitial);
        
        prevEntriesLengthRef.current = entries.length;
    }

    // Save positions
    simulation.on('tick.savePositions', () => {
      tree.nodes.forEach(node => {
        if (node.x !== undefined && node.y !== undefined) {
          nodePositionsRef.current.set(node.id, { x: node.x, y: node.y });
        }
      });
    });
    
    isInitializedRef.current = true;
    
    return () => {
      simulation.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, dimensions, layoutMode, colorByProvider, showLabels, showVersionNumbers, showParticles, enableDrag, detailedView, expandedEntryIds.size, showVersionConnections, showSynapses, synapseDepth, physicsConfig]); // Use tree instead of entries.length to catch version updates

  // Effect for STAGING updates only (lightweight)
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGCircleElement, BranchNode>('.staged-ring')
       .transition().duration(200)
       .attr('opacity', d => stagedEntryIds.has(d.entryId) ? 1 : 0);
  }, [stagedEntryIds]);

  return (
    <div ref={containerRef} className={cn("relative w-full h-full overflow-hidden", className)}>
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 pointer-events-none"
        />
        <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
