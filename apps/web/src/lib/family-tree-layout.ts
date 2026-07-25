/**
 * Fonctions pures de mise en page pour la visualisation de l'arbre
 * généalogique (Phase 2, tâche #21). Ne dépend d'aucun framework UI :
 * transforme un `FamilyTree` (@testvibe/core, lecture seule) en
 * structures prêtes à consommer par react-flow (desktop) ou par la
 * vue liste hiérarchique (mobile).
 */
import type { FamilyTree } from "@testvibe/core";

export interface PersonNodeData {
  personId: number;
  label: string;
  isRoot: boolean;
  generation: number;
  gender: string | null;
  birthDate: string | null;
  deathDate: string | null;
}

export interface UnionJunctionNodeData {
  unionId: number;
}

export type ReactFlowGraphNode =
  | {
      id: string;
      type: "person";
      position: { x: number; y: number };
      data: PersonNodeData;
    }
  | {
      id: string;
      type: "unionJunction";
      position: { x: number; y: number };
      data: UnionJunctionNodeData;
    };

export interface ReactFlowGraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  style?: Record<string, unknown>;
  animated?: boolean;
  /** "straight" pour le lien d'union (ligne droite entre partenaires) ; par défaut (bézier) sinon. */
  type?: string;
}

export interface ReactFlowGraph {
  nodes: ReactFlowGraphNode[];
  edges: ReactFlowGraphEdge[];
}

const GENERATION_ROW_HEIGHT = 140;
const NODE_COLUMN_WIDTH = 220;
/** Écart horizontal dédié entre les deux membres d'un couple (> écart standard entre personnes sans lien direct). */
const UNION_PARTNER_GAP = 300;
/** Demi-largeur approximative d'une carte Person, pour centrer le point de jonction d'union. */
const PERSON_NODE_HALF_WIDTH = 90;
/**
 * Décalage vertical fixe des handles latéraux d'une carte Person (cf.
 * `PersonNode`, `style={{ top: 20 }}`) : le point de jonction d'union
 * doit s'aligner sur ce même offset pour que le lien reste horizontal,
 * peu importe la hauteur réelle de la carte (avec ou sans dates).
 */
const PERSON_HANDLE_Y_OFFSET = 20;
/** Moitié de la taille du point de jonction (8px, cf. `UnionJunctionNode`). */
const JUNCTION_HALF_SIZE = 4;

const UNION_LINK_STYLE = { stroke: "#cbd5e1", strokeDasharray: "4 4" };

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
 *
 * Les Union à deux partenaires reçoivent en plus un noeud "jonction"
 * invisible placé entre eux : les arêtes de Filiation vers un enfant
 * commun aux deux partenaires partent de ce point unique plutôt que
 * de chaque parent séparément, pour éviter les traits dupliqués.
 */
export function buildReactFlowGraph(tree: FamilyTree): ReactFlowGraph {
  const sortedByGeneration = [...tree.nodes].sort(
    (a, b) => a.generation - b.generation || a.person.id - b.person.id,
  );

  // Partenaire d'Union à deux membres, pour un placement adjacent garanti
  // (cf. plus bas) : sans ça, deux partenaires ne se retrouvent côte à
  // côte que par accident de tri par id, et un tiers pourrait s'intercaler.
  const unionPartnerOf = new Map<number, number>();
  for (const e of tree.edges) {
    if (e.type !== "union" || e.personIds.length !== 2) continue;
    const [a, b] = e.personIds;
    unionPartnerOf.set(a, b);
    unionPartnerOf.set(b, a);
  }

  const byGeneration = new Map<number, typeof sortedByGeneration>();
  for (const n of sortedByGeneration) {
    if (!byGeneration.has(n.generation)) byGeneration.set(n.generation, []);
    byGeneration.get(n.generation)!.push(n);
  }

  // Curseur x (plutôt qu'un simple index de colonne) : permet un écart
  // dédié, plus large, entre les deux membres d'un couple, distinct de
  // l'écart standard entre personnes sans lien direct sur une même ligne.
  const xCursorByGeneration = new Map<number, number>();
  const placedPersonIds = new Set<number>();
  const personNodes: ReactFlowGraphNode[] = [];

  const placeNode = (n: (typeof sortedByGeneration)[number], x: number) => {
    placedPersonIds.add(n.person.id);
    personNodes.push({
      id: String(n.person.id),
      type: "person",
      position: { x, y: n.generation * GENERATION_ROW_HEIGHT },
      data: {
        personId: n.person.id,
        label: `${n.person.firstName} ${n.person.lastName}`.trim(),
        isRoot: n.person.id === tree.rootId,
        generation: n.generation,
        gender: n.person.gender,
        birthDate: n.person.birthDate,
        deathDate: n.person.deathDate,
      },
    });
  };

  for (const nodesInGeneration of byGeneration.values()) {
    const byPersonId = new Map(nodesInGeneration.map((n) => [n.person.id, n]));
    for (const n of nodesInGeneration) {
      if (placedPersonIds.has(n.person.id)) continue;
      const x = xCursorByGeneration.get(n.generation) ?? 0;
      placeNode(n, x);

      // Place le partenaire d'Union juste après, avec un écart dédié plus
      // large qu'entre deux personnes sans lien direct sur la même ligne.
      const partnerId = unionPartnerOf.get(n.person.id);
      const partnerNode = partnerId !== undefined ? byPersonId.get(partnerId) : undefined;
      if (partnerNode && !placedPersonIds.has(partnerNode.person.id)) {
        const partnerX = x + UNION_PARTNER_GAP;
        placeNode(partnerNode, partnerX);
        xCursorByGeneration.set(n.generation, partnerX + NODE_COLUMN_WIDTH);
      } else {
        xCursorByGeneration.set(n.generation, x + NODE_COLUMN_WIDTH);
      }
    }
  }

  const positionByPersonId = new Map(personNodes.map((n) => [n.id, n.position]));

  const filiationEdges = tree.edges.filter((e) => e.type === "filiation");
  const unionEdges = tree.edges.filter((e) => e.type === "union");

  /** Ensemble des parents connus (via Filiation) de chaque enfant. */
  const parentIdsByChild = new Map<number, Set<number>>();
  for (const f of filiationEdges) {
    if (!parentIdsByChild.has(f.childId)) parentIdsByChild.set(f.childId, new Set());
    parentIdsByChild.get(f.childId)!.add(f.parentId);
  }

  const unionJunctionNodes: ReactFlowGraphNode[] = [];
  const edges: ReactFlowGraphEdge[] = [];
  const consumedFiliationIds = new Set<number>();

  for (const union of unionEdges) {
    const [partnerA, partnerB] = union.personIds;
    const posA = partnerA !== undefined ? positionByPersonId.get(String(partnerA)) : undefined;
    const posB = partnerB !== undefined ? positionByPersonId.get(String(partnerB)) : undefined;

    if (union.personIds.length !== 2 || !posA || !posB) {
      // Union à un seul partenaire visible (ou cas inhabituel >2) :
      // pas de point de jonction pertinent, on ignore cette union.
      continue;
    }

    const junctionId = `union-${union.unionId}`;
    unionJunctionNodes.push({
      id: junctionId,
      type: "unionJunction",
      position: {
        x: (posA.x + posB.x) / 2 + PERSON_NODE_HALF_WIDTH,
        // Même partenaires nécessairement à la même génération (donc même y) :
        // aligné sur l'offset fixe des handles latéraux pour un lien horizontal.
        y: posA.y + PERSON_HANDLE_Y_OFFSET - JUNCTION_HALF_SIZE,
      },
      data: { unionId: union.unionId },
    });

    // Chaque partenaire sort du côté qui fait face à l'autre (celui de
    // gauche par sa droite, celui de droite par sa gauche), plutôt que
    // du bas de sa carte, pour un lien d'union direct et lisible.
    const [leftPartner, rightPartner] = posA.x <= posB.x ? [partnerA, partnerB] : [partnerB, partnerA];

    edges.push(
      {
        id: `${junctionId}-link-${leftPartner}`,
        source: String(leftPartner),
        sourceHandle: "right",
        target: junctionId,
        targetHandle: "target-left",
        type: "straight",
        style: UNION_LINK_STYLE,
      },
      {
        id: `${junctionId}-link-${rightPartner}`,
        source: String(rightPartner),
        sourceHandle: "left",
        target: junctionId,
        targetHandle: "target-right",
        type: "straight",
        style: UNION_LINK_STYLE,
      },
    );

    const partnerSet = new Set(union.personIds);
    for (const [childId, parentIds] of parentIdsByChild) {
      const isExactMatch = parentIds.size === partnerSet.size && [...parentIds].every((id) => partnerSet.has(id));
      if (!isExactMatch) continue;

      const matchingFiliations = filiationEdges.filter(
        (f) => f.childId === childId && partnerSet.has(f.parentId),
      );
      const roles = new Set(matchingFiliations.map((f) => f.role));

      edges.push({
        id: `${junctionId}-child-${childId}`,
        source: junctionId,
        sourceHandle: "bottom",
        target: String(childId),
        targetHandle: "top",
        label: roles.size === 1 ? [...roles][0] : undefined,
      });

      for (const f of matchingFiliations) consumedFiliationIds.add(f.filiationId);
    }
  }

  // Filiations non absorbées par un point de jonction (parent unique
  // connu, ou parents ne partageant pas d'Union commune) : arête directe.
  for (const f of filiationEdges) {
    if (consumedFiliationIds.has(f.filiationId)) continue;
    edges.push({
      id: `filiation-${f.filiationId}`,
      source: String(f.parentId),
      sourceHandle: "bottom",
      target: String(f.childId),
      targetHandle: "top",
      label: f.role,
    });
  }

  return { nodes: [...personNodes, ...unionJunctionNodes], edges };
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
