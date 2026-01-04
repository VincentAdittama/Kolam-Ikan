import type {
  BranchNode,
  BranchLink,
  BranchTree,
  Entry,
  BranchVisualizationConfig,
  EntryVersion,
} from "@/types";
import { getAIProviderColor } from "@/types";

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

export const NODE_SIZE = 28;
export const HEAD_NODE_SIZE = 36;
export const VERSION_NODE_SIZE = 20; // Smaller for version sub-nodes

// Legacy constants for backward compat if needed, but we should aim to use the above
export const NODE_RADIUS = 24;
export const HEAD_NODE_RADIUS = 30;
export const VERSION_NODE_RADIUS = 16;

export const ROLE_COLORS = {
  user: { main: "#3B82F6", glow: "#60A5FA" },
  ai: { main: "#8B5CF6", glow: "#A78BFA" },
};

// Colors for version nodes (subtle variants)
export const VERSION_COLORS = {
  user: { main: "#2563EB", glow: "#3B82F6", group: "rgba(59, 130, 246, 0.1)" },
  ai: { main: "#7C3AED", glow: "#8B5CF6", group: "rgba(139, 92, 246, 0.1)" },
};

export interface PhysicsConfig {
  centerForce: number;
  chargeStrength: number;
  linkDistance: number;
  linkStrength: number;
  collisionRadius: number;
  velocityDecay: number;
  alphaDecay: number;
}

export const DEFAULT_PHYSICS: PhysicsConfig = {
  centerForce: 0.05,
  chargeStrength: -500,
  linkDistance: 100,
  linkStrength: 0.8,
  collisionRadius: 45,
  velocityDecay: 0.4,
  alphaDecay: 0.02,
};

export const HIERARCHICAL_PHYSICS: PhysicsConfig = {
  centerForce: 0.02,
  chargeStrength: -300,
  linkDistance: 80,
  linkStrength: 1,
  collisionRadius: 40,
  velocityDecay: 0.6,
  alphaDecay: 0.05,
};

export const DEFAULT_CONFIG: BranchVisualizationConfig = {
  showLabels: true,
  showVersionNumbers: true,
  colorByRole: true,
  colorByProvider: false,
  physicsEnabled: true,
  gravityStrength: 0.03, // Maps to centerForce roughly
  linkDistance: 100,
  chargeStrength: -500,
  collisionRadius: 45,
};

// ============================================================
// HELPERS
// ============================================================

export function getNodeRadius(node: BranchNode): number {
  if (node.isVersionNode && !node.isCurrentVersion) {
    return VERSION_NODE_SIZE;
  }
  return node.isHead ? HEAD_NODE_SIZE : NODE_SIZE;
}

export function getNodeFill(
  node: BranchNode,
  colorByProvider: boolean
): string {
  if (colorByProvider && node.provider) {
    return getAIProviderColor(node.provider);
  }
  // Use slightly different colors for version nodes
  if (node.isVersionNode && !node.isCurrentVersion) {
    return VERSION_COLORS[node.role].main;
  }
  return ROLE_COLORS[node.role].main;
}

export function extractLabel(entry: Entry): string {
  try {
    const block = entry.content?.content?.[0];
    if (block?.content?.[0]?.text) {
      const text = block.content[0].text;
      return text.length > 24 ? text.slice(0, 24) + "…" : text;
    }
  } catch {
    /* ignore */
  }
  return `Entry #${entry.sequenceId}`;
}

export function extractVersionLabel(version: EntryVersion): string {
  try {
    const block = version.contentSnapshot?.content?.[0];
    if (block?.content?.[0]?.text) {
      const text = block.content[0].text;
      const prefix = `v${version.versionNumber}: `;
      const maxLen = 20 - prefix.length;
      return (
        prefix + (text.length > maxLen ? text.slice(0, maxLen) + "…" : text)
      );
    }
  } catch {
    /* ignore */
  }
  return `v${version.versionNumber}`;
}

export function buildBranchTree(entries: Entry[]): BranchTree {
  if (!entries.length) {
    return { nodes: [], links: [], root: null, maxDepth: 0, branchCount: 0 };
  }

  const sorted = [...entries].sort((a, b) => a.sequenceId - b.sequenceId);
  const nodes: BranchNode[] = [];
  const links: BranchLink[] = [];
  const nodeMap = new Map<string, BranchNode>();

  let branchCount = 0;
  let maxDepth = 0;

  sorted.forEach((entry, idx) => {
    // Parse parent context ID - may be in format "entryId:versionNumber"
    // We need just the entryId part for structural linking
    let parentId: string | null = null;

    if (idx > 0) {
      // Always use previous entry for chronological linking
      parentId = sorted[idx - 1].id;
    }

    const parent = parentId ? nodeMap.get(parentId) : null;

    const depth = parent ? parent.depth + 1 : 0;
    const branchPath = parent ? [...parent.branchPath] : [0];
    const isBranch = parent && parent.children.length > 0;

    if (isBranch) {
      branchPath.push(parent!.children.length);
      branchCount++;
    }

    maxDepth = Math.max(maxDepth, depth);

    // Extract parent version info if available for the badge
    let parentVersionNumber: number | undefined;
    const rawParentId = entry.parentContextIds?.[0];
    if (rawParentId) {
      const colonIndex = rawParentId.indexOf(":");
      if (colonIndex > 0) {
        parentVersionNumber = parseInt(rawParentId.slice(colonIndex + 1), 10);
      }
    }

    const node: BranchNode = {
      id: entry.id,
      entryId: entry.id,
      label: extractLabel(entry),
      role: entry.role,
      provider: entry.aiMetadata?.provider,
      parentId,
      children: [],
      depth,
      branchPath,
      createdAt: entry.createdAt,
      versionNumber: entry.versionHead,
      isHead: idx === sorted.length - 1,
      isStaged: entry.isStaged ?? false,
      parentContextIds: entry.parentContextIds ?? undefined,
      parentVersionNumber,
    };

    nodes.push(node);
    nodeMap.set(node.id, node);

    if (parent) {
      parent.children.push(node.id);
      links.push({
        id: `${parentId}-${node.id}`,
        source: parentId!,
        target: node.id,
        isBranch: !!isBranch,
        strength: isBranch ? 0.6 : 1,
      });
    }
  });

  // === BUILD CONTEXT DEPENDENCY LINKS (SYNAPSES) ===
  // These visualize which blocks were staged to create an AI response
  // We iterate again now that all nodes exist in the map

  // Helper to parse context ID which may be in format "entryId:versionNumber"
  const parseContextId = (
    contextStr: string
  ): { entryId: string; versionNumber?: number } => {
    const parts = contextStr.split(":");
    return {
      entryId: parts[0],
      versionNumber: parts[1] ? parseInt(parts[1], 10) : undefined,
    };
  };

  // Debug: Log all entries with their parentContextIds
  console.log(
    "[BranchTree] Checking entries for synapses:",
    sorted.map((e) => ({
      id: e.id.slice(0, 8),
      role: e.role,
      parentContextIds: e.parentContextIds,
    }))
  );

  sorted.forEach((entry) => {
    // Only process entries that have explicit parentContextIds
    if (entry.parentContextIds && entry.parentContextIds.length > 0) {
      console.log(
        `[BranchTree] Entry ${entry.id.slice(0, 8)} (${entry.role}) has ${
          entry.parentContextIds.length
        } parent contexts:`,
        entry.parentContextIds
      );

      entry.parentContextIds.forEach((contextStr) => {
        // Parse the context string (may be "entryId" or "entryId:versionNumber")
        const { entryId: contextId } = parseContextId(contextStr);

        // Check if this context link already exists as a structural link
        const existingStructuralLink = links.find(
          (l) =>
            l.source === contextId && l.target === entry.id && !l.isContextLink
        );

        // Create context link if:
        // 1. The context ID exists in our node map
        // 2. Either there's no structural link to this node, OR there are multiple parent contexts
        // (Multiple contexts = user staged multiple blocks, so show all the synapses)
        const hasMultipleContexts = entry.parentContextIds!.length > 1;

        console.log(
          `[BranchTree] Context ${contextId.slice(0, 8)}: exists=${nodeMap.has(
            contextId
          )}, hasStructural=${!!existingStructuralLink}, multipleContexts=${hasMultipleContexts}`
        );

        if (nodeMap.has(contextId)) {
          // Always create synapse for AI entries - they represent the context that was used
          links.push({
            id: `ctx-${contextId}-${entry.id}`,
            source: contextId,
            target: entry.id,
            isBranch: false,
            isContextLink: true, // Marker for synaptic styling
            strength: 0, // Zero strength so it doesn't pull nodes together physically
          });
          console.log(
            `[BranchTree] ✓ Created synapse: ${contextId.slice(
              0,
              8
            )} -> ${entry.id.slice(0, 8)}`
          );
        }
      });
    }
  });

  // Debug: Log synapse count
  const synapseCount = links.filter((l) => l.isContextLink).length;
  console.log(
    `[BranchTree] Total synapse links: ${synapseCount}, Total links: ${links.length}`
  );

  return { nodes, links, root: nodes[0]?.id ?? null, maxDepth, branchCount };
}

// ============================================================
// DETAILED BRANCH TREE (WITH VERSION SUB-NODES)
// ============================================================

export interface VersionData {
  entryId: string;
  versions: EntryVersion[];
}

/**
 * Builds a detailed branch tree where each block can be expanded to show
 * its version history as sub-nodes. This allows visualizing:
 * 1. Which version of a parent block created a child block
 * 2. The complete version history of each block
 * 3. Visual grouping of versions belonging to the same block
 */
export function buildDetailedBranchTree(
  entries: Entry[],
  versionsMap: Map<string, EntryVersion[]>,
  expandedEntryIds: Set<string> = new Set()
): BranchTree {
  if (!entries.length) {
    return {
      nodes: [],
      links: [],
      root: null,
      maxDepth: 0,
      branchCount: 0,
      isDetailedView: true,
      versionGroups: new Map(),
    };
  }

  const sorted = [...entries].sort((a, b) => a.sequenceId - b.sequenceId);
  const nodes: BranchNode[] = [];
  const links: BranchLink[] = [];
  const nodeMap = new Map<string, BranchNode>();
  const versionGroups = new Map<string, { nodeIds: string[] }>();

  let branchCount = 0;
  let maxDepth = 0;

  sorted.forEach((entry, idx) => {
    // We still parse this for detailed version info, but NOT for structural parentId
    const rawParentContextId = entry.parentContextIds?.[0];
    let parentContextId: string | null = null;
    let parentVersionFromContext: number | undefined;

    if (rawParentContextId) {
      const colonIndex = rawParentContextId.indexOf(":");
      if (colonIndex > 0) {
        parentContextId = rawParentContextId.slice(0, colonIndex);
        parentVersionFromContext = parseInt(
          rawParentContextId.slice(colonIndex + 1),
          10
        );
      } else {
        parentContextId = rawParentContextId;
      }
    }

    const versions = versionsMap.get(entry.id) || [];
    const isExpanded = expandedEntryIds.has(entry.id);
    const sortedVersions = [...versions].sort(
      (a, b) => a.versionNumber - b.versionNumber
    );

    // Determine parent node and version connection
    let parentNode: BranchNode | null = null;
    let parentVersionNumber: number | undefined = parentVersionFromContext;

    // We still try to identify the relevant parent version for display purposes (the "<-vX" badge)
    if (parentContextId) {
      const parentVersions = versionsMap.get(parentContextId) || [];
      const relevantParentVersion = parentVersions
        .filter((v) => v.committedAt <= entry.createdAt)
        .sort((a, b) => b.versionNumber - a.versionNumber)[0];

      if (relevantParentVersion) {
        parentVersionNumber = relevantParentVersion.versionNumber;
      }
    }

    if (idx > 0) {
      // Link to previous entry for chronological flow (THE FIX: Always use sequence order)
      const prevEntry = sorted[idx - 1];
      const prevIsExpanded = expandedEntryIds.has(prevEntry.id);
      const prevVersions = versionsMap.get(prevEntry.id) || [];

      if (prevIsExpanded && prevVersions.length > 0) {
        // Connect to the HEAD version of previous entry
        const prevHeadVersion = prevVersions.sort(
          (a, b) => b.versionNumber - a.versionNumber
        )[0];
        parentNode =
          nodeMap.get(`${prevEntry.id}-v${prevHeadVersion.versionNumber}`) ||
          nodeMap.get(prevEntry.id) ||
          null;
      } else {
        parentNode = nodeMap.get(prevEntry.id) || null;
      }
    }

    const depth = parentNode ? parentNode.depth + 1 : 0;
    const branchPath = parentNode ? [...parentNode.branchPath] : [0];
    const isBranch = parentNode && parentNode.children.length > 0;

    if (isBranch) {
      branchPath.push(parentNode!.children.length);
      branchCount++;
    }

    maxDepth = Math.max(maxDepth, depth);

    // If this entry is expanded, create version sub-nodes
    if (isExpanded && sortedVersions.length > 0) {
      const groupNodeIds: string[] = [];
      const versionGroupId = `group-${entry.id}`;

      sortedVersions.forEach((version, vIdx) => {
        const isCurrentVersion = version.versionNumber === entry.versionHead;
        const versionNodeId = `${entry.id}-v${version.versionNumber}`;
        const prevVersionNode =
          vIdx > 0
            ? nodeMap.get(
                `${entry.id}-v${sortedVersions[vIdx - 1].versionNumber}`
              )
            : null;

        const versionNode: BranchNode = {
          id: versionNodeId,
          entryId: entry.id,
          label: extractVersionLabel(version),
          role: entry.role,
          provider: entry.aiMetadata?.provider,
          parentId: prevVersionNode?.id || parentNode?.id || null,
          children: [],
          depth: depth + vIdx * 0.3, // Slight depth offset for visual stacking
          branchPath: [...branchPath, vIdx],
          createdAt: version.committedAt,
          versionNumber: version.versionNumber,
          isHead: idx === sorted.length - 1 && isCurrentVersion,
          isStaged: entry.isStaged ?? false,
          // Version-specific properties
          isVersionNode: true,
          representedVersion: version.versionNumber,
          blockEntryId: entry.id,
          versionGroupId,
          versionGroupIndex: vIdx,
          versionGroupTotal: sortedVersions.length,
          isCurrentVersion,
          parentVersionNumber: vIdx === 0 ? parentVersionNumber : undefined,
        };

        nodes.push(versionNode);
        nodeMap.set(versionNodeId, versionNode);
        groupNodeIds.push(versionNodeId);

        // Link from previous version or parent
        if (prevVersionNode) {
          prevVersionNode.children.push(versionNodeId);
          links.push({
            id: `${prevVersionNode.id}-${versionNodeId}`,
            source: prevVersionNode.id,
            target: versionNodeId,
            isBranch: false,
            strength: 1.2,
            isVersionLink: true,
            linkStyle: "solid",
          });
        } else if (parentNode) {
          parentNode.children.push(versionNodeId);
          links.push({
            id: `${parentNode.id}-${versionNodeId}`,
            source: parentNode.id,
            target: versionNodeId,
            isBranch: !!isBranch,
            strength: isBranch ? 0.6 : 1,
            // Removed isVersionConnection: these are now pure chronological links
          });
        }
      });

      versionGroups.set(entry.id, { nodeIds: groupNodeIds });
    } else {
      // Create regular block node (collapsed view)
      const node: BranchNode = {
        id: entry.id,
        entryId: entry.id,
        label: extractLabel(entry),
        role: entry.role,
        provider: entry.aiMetadata?.provider,
        parentId: parentNode?.id || null,
        children: [],
        depth,
        branchPath,
        createdAt: entry.createdAt,
        versionNumber: entry.versionHead,
        isHead: idx === sorted.length - 1,
        isStaged: entry.isStaged ?? false,
        parentVersionNumber,
      };

      nodes.push(node);
      nodeMap.set(node.id, node);

      if (parentNode) {
        parentNode.children.push(node.id);
        links.push({
          id: `${parentNode.id}-${node.id}`,
          source: parentNode.id,
          target: node.id,
          isBranch: !!isBranch,
          strength: isBranch ? 0.6 : 1,
          // Removed isVersionConnection: these are now pure chronological links
        });
      }
    }
  });

  // === BUILD CONTEXT DEPENDENCY LINKS (SYNAPSES) FOR DETAILED VIEW ===
  // Use version info from parentContextIds (format: "entryId:versionNumber")

  // Helper to parse context ID which may be in format "entryId:versionNumber"
  const parseContextId = (
    contextStr: string
  ): { entryId: string; versionNumber?: number } => {
    const parts = contextStr.split(":");
    return {
      entryId: parts[0],
      versionNumber: parts[1] ? parseInt(parts[1], 10) : undefined,
    };
  };

  sorted.forEach((entry) => {
    if (entry.parentContextIds && entry.parentContextIds.length > 0) {
      const targetNodeId = expandedEntryIds.has(entry.id)
        ? `${entry.id}-v${entry.versionHead}` // Connect to current version node if expanded
        : entry.id;

      entry.parentContextIds.forEach((contextStr) => {
        // Parse the context string to get entryId and optional versionNumber
        const { entryId: contextId, versionNumber: stagedVersionNumber } =
          parseContextId(contextStr);

        let sourceNodeId: string;

        if (expandedEntryIds.has(contextId)) {
          // Source is expanded - use the specific version that was staged
          if (stagedVersionNumber !== undefined) {
            // Use the exact version that was staged (new format: entryId:versionNumber)
            sourceNodeId = `${contextId}-v${stagedVersionNumber}`;
          } else {
            // Fallback for old format (just entryId) - use HEAD version
            const sourceEntry = sorted.find((e) => e.id === contextId);
            sourceNodeId = sourceEntry
              ? `${contextId}-v${sourceEntry.versionHead}`
              : contextId;
          }
        } else {
          // Source is collapsed - just use the entry ID
          sourceNodeId = contextId;
        }

        if (nodeMap.has(sourceNodeId) && nodeMap.has(targetNodeId)) {
          links.push({
            id: `ctx-${sourceNodeId}-${targetNodeId}`,
            source: sourceNodeId,
            target: targetNodeId,
            isBranch: false,
            isContextLink: true,
            strength: 0,
          });
        }
      });
    }
  });

  // Debug: Log synapse count for detailed view
  const synapseCount = links.filter((l) => l.isContextLink).length;
  if (synapseCount > 0) {
    console.log(
      `[BranchTree:Detailed] Generated ${synapseCount} synapse links`
    );
  }

  return {
    nodes,
    links,
    root: nodes[0]?.id ?? null,
    maxDepth,
    branchCount,
    isDetailedView: true,
    versionGroups,
  };
}

/**
 * Physics config for detailed view - tighter grouping for version nodes
 */
export const DETAILED_VIEW_PHYSICS: PhysicsConfig = {
  centerForce: 0.03,
  chargeStrength: -400,
  linkDistance: 60, // Shorter for version links
  linkStrength: 1.2,
  collisionRadius: 35,
  velocityDecay: 0.5,
  alphaDecay: 0.03,
};

// ============================================================
// PARTICLE SYSTEM
// ============================================================

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export function createParticle(x: number, y: number, color: string): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.5 + Math.random() * 1.5;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1,
    maxLife: 60 + Math.random() * 40,
    size: 2 + Math.random() * 3,
    color,
  };
}

export function updateParticles(particles: Particle[]): Particle[] {
  return particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vx: p.vx * 0.98,
      vy: p.vy * 0.98,
      life: p.life - 1 / p.maxLife,
    }))
    .filter((p) => p.life > 0);
}
