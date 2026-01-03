import { useEffect, useMemo, useState, useRef, useId } from 'react';
import * as d3 from 'd3';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import type { BranchNode, BranchLink, Entry } from '@/types';
import {
  ROLE_COLORS,
  DEFAULT_PHYSICS,
  HIERARCHICAL_PHYSICS,
  getNodeRadius,
  getNodeFill,
  buildBranchTree,
  createParticle,
  updateParticles,
  type Particle
} from './utils';

export type LayoutMode = 'force' | 'hierarchical' | 'radial';

interface BranchGraphProps {
  className?: string;
  entries: Entry[]; // Explicit type
  stagedEntryIds: Set<string>;
  viewMode?: 'sidebar' | 'fullscreen'; // Removed viewMode from usage, keeping in props for compatibility if needed, but making optional
  layoutMode?: LayoutMode;
  showParticles?: boolean;
  onNodeClick?: (node: BranchNode) => void;
  onNodeDoubleClick?: (node: BranchNode) => void;
  colorByProvider?: boolean;
  showLabels?: boolean;
  showVersionNumbers?: boolean;
  onFitToView?: (fn: (immediate?: boolean) => void) => void; // Expose fit function
  enableDrag?: boolean;
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
  enableDrag = true
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

  const { stageEntry, unstageEntry } = useAppStore();

  // Keep refs in sync
  useEffect(() => {
    stagedEntryIdsRef.current = stagedEntryIds;
  }, [stagedEntryIds]);

  
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Build tree
  const tree = useMemo(() => {
    const t = buildBranchTree(entries);
    // Restore positions or set smart defaults
    t.nodes.forEach((node, i) => {
      const savedPos = nodePositionsRef.current.get(node.id);
      if (savedPos) {
        node.x = savedPos.x;
        node.y = savedPos.y;
      } else if (dimensions.width > 0) {
        // Start near top-center instead of (0,0) to prevent long camera pans
        node.x = dimensions.width / 2 + (i % 5 - 2) * 20;
        node.y = 150 + Math.floor(i / 5) * 40;
      }
    });
    return t;
  }, [entries, dimensions.width]);

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
          .attr('refX', 30)
          .attr('refY', 0)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-4L10,0L0,4')
          .attr('fill', 'rgba(156, 163, 175, 0.5)');
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

    // Physics
    const physics = layoutMode === 'hierarchical' ? HIERARCHICAL_PHYSICS : DEFAULT_PHYSICS;
    
    // Dispose old simulation
    if (simulationRef.current) simulationRef.current.stop();

    const simulation = d3.forceSimulation<BranchNode>(tree.nodes)
      .force('link', d3.forceLink<BranchNode, BranchLink>(tree.links)
        .id(d => d.id)
        .distance(physics.linkDistance)
        .strength(d => d.strength * physics.linkStrength))
      .force('charge', d3.forceManyBody()
        .strength(physics.chargeStrength)
        .distanceMax(300))
      .force('center', d3.forceCenter(width / 2, 150).strength(physics.centerForce))
      .force('collision', d3.forceCollide<BranchNode>()
        .radius(d => getNodeRadius(d) + 10)
        .strength(0.8))
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

    // Pre-warm the simulation so nodes are in a stable place before rendering
    for (let i = 0; i < 150; i++) simulation.tick();

    // Draw Links
    const linkGroup = g.select('.links').empty() ? g.append('g').attr('class', 'links') : g.select('.links');
    const links = (linkGroup as any).selectAll('path') // eslint-disable-line @typescript-eslint/no-explicit-any
      .data(tree.links as any[], (d: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
        const targetId = typeof d.target === 'object' ? d.target.id : d.target;
        return `${sourceId}-${targetId}`;
      })
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', (d: BranchLink) => d.isBranch ? 'rgba(139, 92, 246, 0.6)' : 'rgba(156, 163, 175, 0.4)')
      .attr('stroke-width', (d: BranchLink) => d.isBranch ? 3 : 2)
      .attr('stroke-dasharray', (d: BranchLink) => d.isBranch ? '8,4' : 'none')
      .attr('marker-end', `url(#arrow-marker-${graphId})`);

    // Draw Nodes
    const nodeGroup = g.select('.nodes').empty() ? g.append('g').attr('class', 'nodes') : g.select('.nodes');
    const nodes = (nodeGroup as any).selectAll('g') // eslint-disable-line @typescript-eslint/no-explicit-any
      .data(tree.nodes as any[], (d: any) => d.id) // eslint-disable-line @typescript-eslint/no-explicit-any
      .join(
        (enter: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
            const el = enter.append('g')
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
                
            return el;
        },
        (update: any) => update, // eslint-disable-line @typescript-eslint/no-explicit-any
        (exit: any) => exit.remove() // eslint-disable-line @typescript-eslint/no-explicit-any
      );

    // Update Attributes for new and existing nodes
    nodes.each(function(this: SVGGElement, d: BranchNode) {
        const el = d3.select(this);
        const r = getNodeRadius(d);

        el.select('.node-main')
            .attr('r', r)
            .attr('fill', colorByProvider ? getNodeFill(d, true) : `url(#gradient-${d.role}-${graphId})`)
            .style('filter', d.isHead ? `url(#node-glow-${graphId})` : 'none');
        
        el.select('.glow-ring')
            .attr('r', r + 8)
            .attr('stroke', getNodeFill(d, colorByProvider))
            .attr('opacity', d.isHead ? 0.8 : 0);
        
        el.select('.staged-ring')
            .attr('r', r + 6)
            .attr('opacity', stagedEntryIdsRef.current.has(d.entryId) ? 1 : 0);
            
        el.select('.role-icon')
            .attr('font-size', d.isHead ? '18px' : '14px')
            .text(d.role === 'user' ? '👤' : '🤖');
        
        el.select('.head-dot')
            .attr('cx', r * 0.7)
            .attr('cy', -r * 0.7)
            .attr('display', d.isHead ? 'block' : 'none');
            
        el.select('.node-label')
            .attr('y', r + 18)
            .text(d.label)
            .attr('display', showLabels ? 'block' : 'none');

        el.select('.version-badge')
             .attr('transform', `translate(${r * 0.8}, ${r * 0.5})`)
             .attr('display', showVersionNumbers ? 'block' : 'none')
             .select('text')
             .text(`v${d.versionNumber}`);
    });

    // Events
    nodes
      .on('mouseenter', function(this: SVGGElement, _event: MouseEvent, d: BranchNode) {

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
          onNodeDoubleClick?.(d);
      });

    // Tick Handler
    simulation.on('tick', () => {
      links.attr('d', (d: BranchLink) => {
        const source = d.source as unknown as BranchNode;
        const target = d.target as unknown as BranchNode;
        if (!source.x || !source.y || !target.x || !target.y) return '';

        if (d.isBranch) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          return `M${source.x},${source.y}Q${source.x + dx / 2 + dy / 4},${source.y + dy / 2 - dx / 4} ${target.x},${target.y}`;
        }
        return `M${source.x},${source.y}L${target.x},${target.y}`;
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
  }, [tree.nodes.length, dimensions, layoutMode, colorByProvider, showLabels, showVersionNumbers, showParticles, entries.length, enableDrag]); // Intentionally minimal dependencies to avoid restarts

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
