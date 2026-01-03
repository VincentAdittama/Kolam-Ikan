import type { BranchNode, BranchLink, BranchTree, Entry, BranchVisualizationConfig } from '@/types';
import { getAIProviderColor } from '@/types';

// ============================================================
// CONSTANTS & CONFIGURATION
// ============================================================

export const NODE_SIZE = 28;
export const HEAD_NODE_SIZE = 36;

// Legacy constants for backward compat if needed, but we should aim to use the above
export const NODE_RADIUS = 24;
export const HEAD_NODE_RADIUS = 30;

export const ROLE_COLORS = {
  user: { main: '#3B82F6', glow: '#60A5FA' },
  ai: { main: '#8B5CF6', glow: '#A78BFA' },
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
  return node.isHead ? HEAD_NODE_SIZE : NODE_SIZE;
}

export function getNodeFill(node: BranchNode, colorByProvider: boolean): string {
  if (colorByProvider && node.provider) {
    return getAIProviderColor(node.provider);
  }
  return ROLE_COLORS[node.role].main;
}

export function extractLabel(entry: Entry): string {
  try {
    const block = entry.content?.content?.[0];
    if (block?.content?.[0]?.text) {
      const text = block.content[0].text;
      return text.length > 24 ? text.slice(0, 24) + '…' : text;
    }
  } catch { /* ignore */ }
  return `Entry #${entry.sequenceId}`;
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
    const parentId = entry.parentContextIds?.[0] || (idx > 0 ? sorted[idx - 1].id : null);
    const parent = parentId ? nodeMap.get(parentId) : null;
    
    const depth = parent ? parent.depth + 1 : 0;
    const branchPath = parent ? [...parent.branchPath] : [0];
    const isBranch = parent && parent.children.length > 0;
    
    if (isBranch) {
      branchPath.push(parent!.children.length);
      branchCount++;
    }

    maxDepth = Math.max(maxDepth, depth);

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

  return { nodes, links, root: nodes[0]?.id ?? null, maxDepth, branchCount };
}

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
    .map(p => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vx: p.vx * 0.98,
      vy: p.vy * 0.98,
      life: p.life - 1 / p.maxLife,
    }))
    .filter(p => p.life > 0);
}
