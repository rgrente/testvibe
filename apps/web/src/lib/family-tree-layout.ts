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
  birthName: string | null;
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

function filiationLabel(role: string): string | undefined {
  return role === "biologique" ? undefined : role;
}

type FamilyTreeNode = FamilyTree["nodes"][number];

function personLabel(tree: FamilyTree, personId: number): string {
  const node = tree.nodes.find((n) => n.person.id === personId);
  if (!node) return `#${personId}`;
  return `${node.person.firstName} ${node.person.lastName}`.trim();
}

/**
 * Ordre d'affichage par génération croissante, puis par date de naissance
 * (plutôt que par id) au sein d'une même génération — pour que les enfants
 * d'une fratrie apparaissent dans leur ordre de naissance réel. Personnes
 * sans date connue reléguées en fin de groupe ; id en dernier recours pour
 * un ordre stable et déterministe.
 */
function compareSiblingOrder(a: FamilyTreeNode, b: FamilyTreeNode): number {
  if (a.generation !== b.generation) return a.generation - b.generation;
  const aDate = a.person.birthDate;
  const bDate = b.person.birthDate;
  if (aDate && bDate && aDate !== bDate) return aDate < bDate ? -1 : 1;
  if (aDate && !bDate) return -1;
  if (!aDate && bDate) return 1;
  return a.person.id - b.person.id;
}

/**
 * Ordonne un couple gauche→droite : l'homme à gauche, la femme à droite.
 * En cas d'ambiguïté (deux hommes, deux femmes, ou genre(s) inconnu(s)),
 * conserve l'ordre de rencontre (déjà trié par date de naissance puis id).
 */
function orderCoupleLeftToRight(a: FamilyTreeNode, b: FamilyTreeNode): [FamilyTreeNode, FamilyTreeNode] {
  const aMale = a.person.gender === "M";
  const bMale = b.person.gender === "M";
  if (aMale && !bMale) return [a, b];
  if (bMale && !aMale) return [b, a];
  return [a, b];
}

/**
 * Calcule les positions (x, y) des noeuds pour react-flow : une ligne par
 * génération (y = generation * hauteur). Au sein d'une génération, l'ordre
 * horizontal part de la génération de la racine (0) puis s'étend vers les
 * ascendants et descendants : chaque personne (ou couple) se positionne au
 * barycentre x de ses enfants/parents déjà placés dans la génération
 * adjacente déjà traitée, plutôt que par simple ordre d'id — ce qui évite
 * les croisements de lignes quand deux couples d'une même génération se
 * rattachent à des branches opposées (gauche/droite) de la génération
 * suivante.
 *
 * Les Union à deux partenaires reçoivent en plus un noeud "jonction"
 * invisible placé entre eux : les arêtes de Filiation vers un enfant
 * commun aux deux partenaires partent de ce point unique plutôt que
 * de chaque parent séparément, pour éviter les traits dupliqués.
 */
export function buildReactFlowGraph(tree: FamilyTree): ReactFlowGraph {
  const sortedByGeneration = [...tree.nodes].sort(compareSiblingOrder);

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

  const filiationEdges = tree.edges.filter((e) => e.type === "filiation");
  const unionEdges = tree.edges.filter((e) => e.type === "union");

  // Voisins par Filiation, pour ancrer chaque génération sur la position
  // déjà connue de la génération adjacente la plus proche de la racine.
  const childrenOfParent = new Map<number, number[]>();
  const parentsOfChild = new Map<number, number[]>();
  for (const f of filiationEdges) {
    if (!childrenOfParent.has(f.parentId)) childrenOfParent.set(f.parentId, []);
    childrenOfParent.get(f.parentId)!.push(f.childId);
    if (!parentsOfChild.has(f.childId)) parentsOfChild.set(f.childId, []);
    parentsOfChild.get(f.childId)!.push(f.parentId);
  }

  const byGeneration = new Map<number, typeof sortedByGeneration>();
  for (const n of sortedByGeneration) {
    if (!byGeneration.has(n.generation)) byGeneration.set(n.generation, []);
    byGeneration.get(n.generation)!.push(n);
  }

  // Ordre de traitement des générations : la génération 0 (racine) d'abord,
  // puis en s'éloignant — ascendants (-1, -2, ...) et descendants (1, 2, ...)
  // — pour que chaque génération puisse s'ancrer sur la précédente déjà placée.
  const generationKeys = [...byGeneration.keys()];
  const generationOrder = [
    0,
    ...generationKeys.filter((g) => g < 0).sort((a, b) => b - a),
    ...generationKeys.filter((g) => g > 0).sort((a, b) => a - b),
  ].filter((g) => byGeneration.has(g));

  const placedPersonIds = new Set<number>();
  const xByPersonId = new Map<number, number>();
  const personNodes: ReactFlowGraphNode[] = [];

  const placeNode = (n: (typeof sortedByGeneration)[number], x: number) => {
    placedPersonIds.add(n.person.id);
    xByPersonId.set(n.person.id, x);
    personNodes.push({
      id: String(n.person.id),
      type: "person",
      position: { x, y: n.generation * GENERATION_ROW_HEIGHT },
      data: {
        personId: n.person.id,
        label: `${n.person.firstName} ${n.person.lastName}`.trim(),
        birthName: n.person.birthName,
        isRoot: n.person.id === tree.rootId,
        generation: n.generation,
        gender: n.person.gender,
        birthDate: n.person.birthDate,
        deathDate: n.person.deathDate,
      },
    });
  };

  type Unit = { first: (typeof sortedByGeneration)[number]; partner?: (typeof sortedByGeneration)[number] };

  /** Largeur (écart entre le premier membre et son partenaire) occupée par l'unité ; 0 pour une personne seule. */
  const widthOf = (unit: Unit) => (unit.partner ? UNION_PARTNER_GAP : 0);

  const placeUnit = (unit: Unit, x: number) => {
    placeNode(unit.first, x);
    if (unit.partner) placeNode(unit.partner, x + UNION_PARTNER_GAP);
  };

  for (const generation of generationOrder) {
    const nodesInGeneration = byGeneration.get(generation)!;
    const byPersonId = new Map(nodesInGeneration.map((n) => [n.person.id, n]));

    // Regroupe en "unités" de placement (personne seule, ou couple adjacent).
    const units: Unit[] = [];
    const grouped = new Set<number>();
    for (const n of nodesInGeneration) {
      if (grouped.has(n.person.id)) continue;
      grouped.add(n.person.id);
      const partnerId = unionPartnerOf.get(n.person.id);
      const partnerNode = partnerId !== undefined ? byPersonId.get(partnerId) : undefined;
      if (partnerNode && !grouped.has(partnerNode.person.id)) {
        grouped.add(partnerNode.person.id);
        const [first, partner] = orderCoupleLeftToRight(n, partnerNode);
        units.push({ first, partner });
      } else {
        units.push({ first: n });
      }
    }

    if (generation === 0) {
      // Génération racine : pas d'ancrage possible (rien n'est encore placé),
      // simple empilement dans l'ordre id/adjacence d'union.
      let cursorX = 0;
      for (const unit of units) {
        placeUnit(unit, cursorX);
        cursorX += widthOf(unit) + NODE_COLUMN_WIDTH;
      }
      continue;
    }

    // Ancre chaque unité sur le barycentre x de ses voisins (enfants pour
    // les ascendants, parents pour les descendants) déjà positionnés.
    const neighborsOf = (personId: number) =>
      generation < 0 ? (childrenOfParent.get(personId) ?? []) : (parentsOfChild.get(personId) ?? []);

    const anchorOf = (unit: Unit): number | undefined => {
      const memberIds = unit.partner ? [unit.first.person.id, unit.partner.person.id] : [unit.first.person.id];
      const neighborXs = memberIds
        .flatMap(neighborsOf)
        .map((id) => xByPersonId.get(id))
        .filter((x): x is number => x !== undefined);
      if (neighborXs.length === 0) return undefined;
      return neighborXs.reduce((sum, x) => sum + x, 0) / neighborXs.length;
    };

    const withAnchor = units.map((unit, index) => ({ unit, index, anchor: anchorOf(unit) }));
    withAnchor.sort((a, b) => {
      const aAnchor = a.anchor ?? Number.POSITIVE_INFINITY;
      const bAnchor = b.anchor ?? Number.POSITIVE_INFINITY;
      if (aAnchor !== bAnchor) return aAnchor - bAnchor;
      return a.index - b.index; // ordre d'id d'origine, stable
    });

    // Regroupe les unités contiguës partageant le même ancrage (ex. une
    // fratrie entière rattachée aux mêmes parents) : le groupe entier doit
    // être centré sur cet ancrage, pas seulement sa première unité — sinon
    // toute la fratrie se retrouve décalée à droite du parent plutôt que
    // centrée sous lui.
    const clusters: { anchor: number | undefined; units: Unit[] }[] = [];
    for (const { unit, anchor } of withAnchor) {
      const last = clusters[clusters.length - 1];
      if (last && last.anchor !== undefined && anchor === last.anchor) {
        last.units.push(unit);
      } else {
        clusters.push({ anchor, units: [unit] });
      }
    }

    const clusterWidthOf = (cluster: (typeof clusters)[number]) =>
      cluster.units.reduce((sum, u) => sum + widthOf(u), 0) + (cluster.units.length - 1) * NODE_COLUMN_WIDTH;

    const placeSequence = (clustersToPlace: typeof clusters, startX: number) => {
      let x = startX;
      for (const cluster of clustersToPlace) {
        for (const unit of cluster.units) {
          placeUnit(unit, x);
          x += widthOf(unit) + NODE_COLUMN_WIDTH;
        }
      }
      return x;
    };

    // Le tri ci-dessus place les unités sans ancrage (aucun voisin encore
    // placé, ex. un parent sans enfant connu dans cette vue) en fin de
    // ligne — elles forment donc toujours un bloc de fin contigu. On les
    // exclut du calcul de centrage : sans ça, l'unité de fin, dépourvue de
    // position réelle, ne peut que "deviner" une valeur pour se chaîner à
    // la précédente, et cette valeur arbitraire vient ensuite contraindre
    // à tort — via la passe droite→gauche — la position du groupe ancré
    // juste avant elle, le tirant loin de son véritable centre.
    const anchoredClusters = clusters.filter((c) => c.anchor !== undefined);
    const trailingUnanchoredClusters = clusters.filter((c) => c.anchor === undefined);

    // Résout les chevauchements entre clusters ancrés voisins par une passe
    // gauche→droite (ne repousse qu'à droite) puis une passe droite→gauche
    // (ne repousse qu'à gauche), et moyenne les deux. Une seule passe
    // gauche→droite ferait porter tout le décalage nécessaire sur le
    // cluster de droite alors que celui de gauche resterait pile sur son
    // ancrage ; la moyenne des deux passes répartit le décalage de part et
    // d'autre du point médian, pour un rendu plus symétrique/compact.
    const leftPass: number[] = [];
    {
      let prevEnd = Number.NEGATIVE_INFINITY;
      for (const cluster of anchoredClusters) {
        const width = clusterWidthOf(cluster);
        const ideal = cluster.anchor! - width / 2;
        const start = Number.isFinite(prevEnd) ? Math.max(ideal, prevEnd + NODE_COLUMN_WIDTH) : ideal;
        leftPass.push(start);
        prevEnd = start + width;
      }
    }

    const rightPass: number[] = new Array(anchoredClusters.length);
    {
      let nextStart = Number.POSITIVE_INFINITY;
      for (let i = anchoredClusters.length - 1; i >= 0; i--) {
        const cluster = anchoredClusters[i];
        const width = clusterWidthOf(cluster);
        const ideal = cluster.anchor! - width / 2;
        const start = Number.isFinite(nextStart) ? Math.min(ideal, nextStart - NODE_COLUMN_WIDTH - width) : ideal;
        rightPass[i] = start;
        nextStart = start;
      }
    }

    // Moyenne des deux passes, puis correction gauche→droite finale (filet
    // de sécurité au cas où moyenner réintroduirait un léger chevauchement).
    let prevEnd = Number.NEGATIVE_INFINITY;
    anchoredClusters.forEach((cluster, i) => {
      const averaged = (leftPass[i] + rightPass[i]) / 2;
      const start = Number.isFinite(prevEnd) ? Math.max(averaged, prevEnd + NODE_COLUMN_WIDTH) : averaged;
      prevEnd = start + clusterWidthOf(cluster);

      let x = start;
      for (const unit of cluster.units) {
        placeUnit(unit, x);
        x += widthOf(unit) + NODE_COLUMN_WIDTH;
      }
    });

    // Les unités sans ancrage viennent enfin s'enchaîner après le dernier
    // groupe ancré (ou depuis 0 si la génération n'en a aucun).
    placeSequence(trailingUnanchoredClusters, Number.isFinite(prevEnd) ? prevEnd + NODE_COLUMN_WIDTH : 0);
  }

  const positionByPersonId = new Map(personNodes.map((n) => [n.id, n.position]));

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
        label: roles.size === 1 ? filiationLabel([...roles][0]) : undefined,
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
      label: filiationLabel(f.role),
    });
  }

  return { nodes: [...personNodes, ...unionJunctionNodes], edges };
}

export interface HierarchyRow {
  personId: number;
  label: string;
  birthName: string | null;
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
    .sort(compareSiblingOrder)
    .map((n) => ({
      personId: n.person.id,
      label: personLabel(tree, n.person.id),
      birthName: n.person.birthName,
      generation: n.generation,
      isRoot: n.person.id === tree.rootId,
      depth: Math.abs(n.generation),
    }));
}
