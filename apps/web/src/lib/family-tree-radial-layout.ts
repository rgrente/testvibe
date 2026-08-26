import type { FamilyTree } from "@testvibe/core";

export interface RadialPersonNode {
  personId: number;
  label: string;
  generation: number;
  x: number;
  y: number;
  isRoot: boolean;
  birthDate: string | null;
  deathDate: string | null;
}

export interface RadialLink {
  parentId: number;
  childId: number;
}

export interface RadialLayout {
  width: number;
  height: number;
  nodes: RadialPersonNode[];
  links: RadialLink[];
}

const MIN_WIDTH = 960;
const RING_GAP = 125;
const BOTTOM_PADDING = 70;
const NODE_HALF_WIDTH = 62;

/** Calcule un éventail d'ascendants, la personne racine étant au centre bas. */
export function buildRadialLayout(tree: FamilyTree): RadialLayout {
  const nodeById = new Map(tree.nodes.map((node) => [node.person.id, node]));
  const parentsByChild = new Map<number, number[]>();
  for (const edge of tree.edges) {
    if (edge.type !== "filiation") continue;
    const parents = parentsByChild.get(edge.childId) ?? [];
    parents.push(edge.parentId);
    parentsByChild.set(edge.childId, parents);
  }

  const depthById = new Map<number, number>([[tree.rootId, 0]]);
  const queue = [tree.rootId];
  while (queue.length > 0) {
    const childId = queue.shift()!;
    const depth = depthById.get(childId)!;
    for (const parentId of parentsByChild.get(childId) ?? []) {
      if (!nodeById.has(parentId) || depthById.has(parentId)) continue;
      depthById.set(parentId, depth + 1);
      queue.push(parentId);
    }
  }

  const maxDepth = Math.max(0, ...depthById.values());
  const radius = Math.max(150, maxDepth * RING_GAP);
  const width = Math.max(MIN_WIDTH, 2 * (radius + NODE_HALF_WIDTH));
  const height = radius + BOTTOM_PADDING + 35;
  const centerX = width / 2;
  const centerY = height - BOTTOM_PADDING;
  const idsByDepth = new Map<number, number[]>();
  for (const [personId, depth] of depthById) {
    const ids = idsByDepth.get(depth) ?? [];
    ids.push(personId);
    idsByDepth.set(depth, ids);
  }

  const nodes: RadialPersonNode[] = [];
  for (const [depth, ids] of [...idsByDepth].sort(([a], [b]) => a - b)) {
    ids.sort((a, b) => a - b);
    ids.forEach((personId, index) => {
      const source = nodeById.get(personId)!;
      const angle = depth === 0 ? -Math.PI / 2 : Math.PI + (Math.PI * (index + 0.5)) / ids.length;
      const distance = depth * RING_GAP;
      nodes.push({
        personId,
        label: `${source.person.firstName} ${source.person.lastName}`.trim(),
        generation: depth,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        isRoot: personId === tree.rootId,
        birthDate: source.person.birthDate,
        deathDate: source.person.deathDate,
      });
    });
  }

  const visibleIds = new Set(depthById.keys());
  const links = tree.edges
    .filter((edge): edge is Extract<FamilyTree["edges"][number], { type: "filiation" }> => edge.type === "filiation")
    .filter((edge) => visibleIds.has(edge.parentId) && visibleIds.has(edge.childId))
    .map((edge) => ({ parentId: edge.parentId, childId: edge.childId }));

  return { width, height, nodes, links };
}
