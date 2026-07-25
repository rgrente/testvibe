/**
 * Fonctions pures de mise en page pour la visualisation de l'arbre
 * généalogique (Phase 2, tâche #21). Ne dépend d'aucun framework UI :
 * transforme un `FamilyTree` (@testvibe/core, lecture seule) en
 * structures prêtes à consommer par react-flow (desktop) ou par la
 * vue liste hiérarchique (mobile).
 */
import type { FamilyTree } from "@testvibe/core";

export interface ReactFlowGraphNode {
  id: string;
  position: { x: number; y: number };
  data: {
    personId: number;
    label: string;
    isRoot: boolean;
    generation: number;
  };
  type: "person";
}

export interface ReactFlowGraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: Record<string, unknown>;
  animated?: boolean;
}

export interface ReactFlowGraph {
  nodes: ReactFlowGraphNode[];
  edges: ReactFlowGraphEdge[];
}

const GENERATION_ROW_HEIGHT = 140;
const NODE_COLUMN_WIDTH = 220;

function personLabel(tree: FamilyTree, personId: number): string {
  const node = tree.nodes.find((n) => n.person.id === personId);
  if (!node) return `#${personId}`;
  return `${node.person.firstName} ${node.person.lastName}`.trim();
}

/**
 * Calcule les positions (x, y) des noeuds pour react-flow : une ligne
 * par génération (y = generation * hauteur), les personnes d'une même
 * génération réparties horizontalement dans l'ordre de leur id (ordre
 * stable, suffisant pour un jeu de données de démonstration).
 */
export function buildReactFlowGraph(tree: FamilyTree): ReactFlowGraph {
  const sortedByGeneration = [...tree.nodes].sort(
    (a, b) => a.generation - b.generation || a.person.id - b.person.id,
  );

  const columnIndexByGeneration = new Map<number, number>();
  const nodes: ReactFlowGraphNode[] = sortedByGeneration.map((n) => {
    const column = columnIndexByGeneration.get(n.generation) ?? 0;
    columnIndexByGeneration.set(n.generation, column + 1);
    return {
      id: String(n.person.id),
      position: { x: column * NODE_COLUMN_WIDTH, y: n.generation * GENERATION_ROW_HEIGHT },
      data: {
        personId: n.person.id,
        label: `${n.person.firstName} ${n.person.lastName}`.trim(),
        isRoot: n.person.id === tree.rootId,
        generation: n.generation,
      },
      type: "person",
    };
  });

  const edges: ReactFlowGraphEdge[] = tree.edges.map((edge) => {
    if (edge.type === "filiation") {
      return {
        id: `filiation-${edge.filiationId}`,
        source: String(edge.parentId),
        target: String(edge.childId),
        label: edge.role,
      };
    }
    // Union : relie les partenaires entre eux (arête non dirigée,
    // représentée par une paire d'ids consécutive pour rester simple).
    const [first, second] = edge.personIds;
    return {
      id: `union-${edge.unionId}`,
      source: String(first),
      target: String(second ?? first),
      style: { strokeDasharray: "4 4" },
      animated: false,
    };
  });

  return { nodes, edges };
}

export interface HierarchyRow {
  personId: number;
  label: string;
  generation: number;
  isRoot: boolean;
  /** Nombre de niveaux d'indentation (0 pour la racine). */
  depth: number;
}

/**
 * Construit une liste plate triée par génération (ascendants d'abord,
 * puis racine, puis descendants), avec un niveau d'indentation dérivé
 * de la distance à la racine — utilisée par la vue mobile simplifiée
 * (pas de pan/zoom, juste une liste hiérarchique indentée).
 */
export function buildHierarchyRows(tree: FamilyTree): HierarchyRow[] {
  return [...tree.nodes]
    .sort((a, b) => a.generation - b.generation || a.person.id - b.person.id)
    .map((n) => ({
      personId: n.person.id,
      label: personLabel(tree, n.person.id),
      generation: n.generation,
      isRoot: n.person.id === tree.rootId,
      depth: Math.abs(n.generation),
    }));
}
