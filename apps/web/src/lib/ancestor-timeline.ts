import type { FamilyTree } from "@testvibe/core";
import type { TimelineConnection } from "./comparative-timeline";

export interface AncestorTimelineSelection {
  personIds: number[];
  connections: TimelineConnection[];
  branchByPersonId: Map<number, number>;
}

function year(date: string | null): number | null {
  const match = date?.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

/** Select only direct ancestry paths (tree also contains partners and siblings). */
export function selectAncestorTimeline(tree: FamilyTree, generations: number): AncestorTimelineSelection {
  const people = new Map(tree.nodes.map((node) => [node.person.id, node.person]));
  const parentsByChild = new Map<number, number[]>();
  for (const edge of tree.edges) {
    if (edge.type !== "filiation") continue;
    const parents = parentsByChild.get(edge.childId) ?? [];
    parents.push(edge.parentId);
    parentsByChild.set(edge.childId, parents);
  }
  for (const parents of parentsByChild.values()) parents.sort((a, b) => a - b);

  const depth = new Map<number, number>([[tree.rootId, 0]]);
  const branchByPersonId = new Map<number, number>([[tree.rootId, -1]]);
  const queue = [tree.rootId];
  const connections: AncestorTimelineSelection["connections"] = [];
  for (let index = 0; index < queue.length; index++) {
    const childId = queue[index]!;
    const childDepth = depth.get(childId)!;
    if (childDepth >= generations) continue;
    for (const [parentIndex, parentId] of (parentsByChild.get(childId) ?? []).entries()) {
      if (!people.has(parentId)) continue;
      const branch = childId === tree.rootId ? parentIndex : branchByPersonId.get(childId) ?? parentIndex;
      if (!depth.has(parentId)) {
        depth.set(parentId, childDepth + 1);
        branchByPersonId.set(parentId, branch);
        queue.push(parentId);
      }
      const parentBirth = year(people.get(parentId)!.birthDate);
      const childBirth = year(people.get(childId)!.birthDate);
      connections.push({
        parentId,
        childId,
        age: parentBirth !== null && childBirth !== null && childBirth >= parentBirth ? childBirth - parentBirth : null,
      });
    }
  }

  const personIds = [...depth.keys()].sort((a, b) => {
    const depthDifference = depth.get(b)! - depth.get(a)!;
    if (depthDifference !== 0) return depthDifference;
    const branchDifference = (branchByPersonId.get(a) ?? -1) - (branchByPersonId.get(b) ?? -1);
    return branchDifference || a - b;
  });
  const included = new Set(personIds);
  return { personIds, connections: connections.filter((edge) => included.has(edge.parentId)), branchByPersonId };
}
