/**
 * Calcul du lien de parenté entre deux personnes (« carte de parenté »).
 *
 * Fonction pure : ne dépend ni de packages/db ni d'un framework. Elle
 * reçoit l'intégralité des Person et Filiation et traverse le graphe en
 * mémoire, à l'image de ./tree.ts.
 *
 * Toutes les filiations comptent comme lien de parenté, quel que soit
 * leur rôle : un parent adoptif ou un beau-parent est traité comme un
 * parent pour la structure du lien. Le rôle n'est conservé que comme
 * annotation des arêtes du chemin (`KinshipStep.edgeRole`).
 */
import type {
  Filiation,
  FiliationRole,
  KinshipLink,
  KinshipPath,
  KinshipResult,
  KinshipStep,
  Person,
} from "./types.js";

/** Arête ascendante enfant → parent, avec le rôle de la filiation d'origine. */
interface ParentEdge {
  parentId: number;
  role: FiliationRole;
}

/**
 * Entrée d'ascendance : distance minimale depuis le point de départ, et
 * chaînage arrière permettant de reconstruire le chemin (`viaChild` est
 * l'enfant par lequel cet ancêtre a été atteint, `role` le rôle de la
 * filiation reliant cet ancêtre à cet enfant).
 */
interface AncestorEntry {
  dist: number;
  viaChild: number | null;
  role: FiliationRole | null;
}

/** Nombre maximal d'explorations du DFS de comptage des chemins simples. */
const MAX_PATH_EXPLORATION_STEPS = 50_000;

/**
 * Calcule le lien de parenté orienté de `fromId` vers `toId` :
 * « from est le <label> de to ».
 *
 * Le genre des libellés est celui de `from` : `gender === "F"` donne le
 * féminin, toute autre valeur donne le masculin. Un genre `null` (inconnu)
 * retombe donc sur le masculin, utilisé ici comme forme neutre par défaut.
 */
export function computeKinship(
  persons: Person[],
  filiations: Filiation[],
  fromId: number,
  toId: number,
): KinshipResult {
  const personById = new Map(persons.map((p) => [p.id, p]));
  const nameOf = (personId: number): string => {
    const person = personById.get(personId);
    return person ? `${person.firstName} ${person.lastName}` : `#${personId}`;
  };
  const isFeminine = personById.get(fromId)?.gender === "F";

  // ── 1. Même personne ──────────────────────────────────────────────────────
  if (fromId === toId) {
    return {
      fromId,
      toId,
      samePerson: true,
      unrelated: false,
      link: {
        label: isFeminine ? "elle-même" : "lui-même",
        relation: "same",
        degree: 0,
        generationGap: 0,
      },
      commonAncestors: [],
      paths: [],
      multipleRelationships: false,
    };
  }

  // ── 2. Ascendances ────────────────────────────────────────────────────────
  const parentOf = buildParentAdjacency(filiations);
  const fromAscendance = ascendance(fromId, parentOf);
  const toAscendance = ascendance(toId, parentOf);

  // Ancêtres communs STRICTS : l'ascendance calculée inclut la personne de
  // départ à la distance 0 pour permettre la reconstruction du chemin, mais
  // personne n'est son propre ancêtre.
  const commonAncestorIds = [...fromAscendance.keys()]
    .filter((id) => id !== fromId && id !== toId && toAscendance.has(id))
    .sort((a, b) => a - b);
  const commonAncestors = commonAncestorIds.map((id) => ({ id, name: nameOf(id) }));

  // Plusieurs chemins simples distincts entre les deux personnes = plusieurs
  // liens de parenté (fratrie complète reliée par ses deux parents,
  // consanguinité, double cousinage…). Calculé paresseusement : le DFS n'est
  // lancé que si le critère des ancêtres communs n'a pas déjà tranché.
  const hasSeveralPaths = (): boolean => countSimplePaths(filiations, fromId, toId) > 1;

  // ── 3. Liens directs, prioritaires sur l'analyse collatérale ──────────────
  const asAscendant = toAscendance.get(fromId);
  if (asAscendant) {
    return {
      fromId,
      toId,
      samePerson: false,
      unrelated: false,
      link: {
        label: ascendantLabel(asAscendant.dist, isFeminine),
        relation: "ascendant",
        degree: asAscendant.dist,
        generationGap: 0,
      },
      commonAncestors,
      // Le pivot du chemin est `from` lui-même : il n'y a que la descente.
      paths: [
        { steps: buildPath(fromAscendance, toAscendance, fromId, nameOf), commonAncestorId: fromId },
      ],
      multipleRelationships: hasSeveralPaths(),
    };
  }

  const asDescendant = fromAscendance.get(toId);
  if (asDescendant) {
    return {
      fromId,
      toId,
      samePerson: false,
      unrelated: false,
      link: {
        label: descendantLabel(asDescendant.dist, isFeminine),
        relation: "descendant",
        degree: asDescendant.dist,
        generationGap: 0,
      },
      commonAncestors,
      // Le pivot du chemin est `to` lui-même : il n'y a que la montée.
      paths: [
        { steps: buildPath(fromAscendance, toAscendance, toId, nameOf), commonAncestorId: toId },
      ],
      multipleRelationships: hasSeveralPaths(),
    };
  }

  // ── 4. Aucun ancêtre commun → aucun lien ──────────────────────────────────
  if (commonAncestorIds.length === 0) {
    return {
      fromId,
      toId,
      samePerson: false,
      unrelated: true,
      link: null,
      commonAncestors: [],
      paths: [],
      multipleRelationships: false,
    };
  }

  // ── 5. Lien collatéral via l'ancêtre commun le plus proche ────────────────
  const sumOf = (id: number): number =>
    fromAscendance.get(id)!.dist + toAscendance.get(id)!.dist;
  // `commonAncestorIds` est trié par id croissant : garder le premier minimum
  // strict revient à départager les ex æquo par le plus petit id.
  const lca = commonAncestorIds.reduce((best, id) => (sumOf(id) < sumOf(best) ? id : best));
  const minSum = sumOf(lca);

  const dA = fromAscendance.get(lca)!.dist;
  const dB = toAscendance.get(lca)!.dist;

  // Plusieurs ancêtres communs à la somme de distances minimale = plusieurs
  // liens de même proximité (les deux parents d'une fratrie complète, les deux
  // grands-parents de cousins germains, un double cousinage…).
  const closestCount = commonAncestorIds.filter((id) => sumOf(id) === minSum).length;

  return {
    fromId,
    toId,
    samePerson: false,
    unrelated: false,
    link: describeCollateralLink(dA, dB, fromId, toId, parentOf, isFeminine),
    commonAncestors,
    paths: [{ steps: buildPath(fromAscendance, toAscendance, lca, nameOf), commonAncestorId: lca }],
    multipleRelationships: closestCount > 1 || hasSeveralPaths(),
  };
}

/**
 * Adjacence enfant → parents, toutes filiations confondues. Les listes sont
 * triées (parentId puis id de filiation) pour que le parcours, et donc le
 * chemin retenu, ne dépendent pas de l'ordre des lignes reçues de la base.
 */
function buildParentAdjacency(filiations: Filiation[]): Map<number, ParentEdge[]> {
  const parentOf = new Map<number, ParentEdge[]>();
  const ordered = [...filiations].sort((a, b) => a.parentId - b.parentId || a.id - b.id);
  for (const filiation of ordered) {
    if (!parentOf.has(filiation.childId)) parentOf.set(filiation.childId, []);
    parentOf.get(filiation.childId)!.push({
      parentId: filiation.parentId,
      role: filiation.role,
    });
  }
  return parentOf;
}

/**
 * Remontée BFS sans limite de profondeur : Map<ancêtreId, entrée>, la
 * personne de départ incluse à la distance 0. Les distances retenues sont
 * minimales et un ancêtre déjà atteint n'est jamais réexploré, ce qui borne
 * naturellement le parcours même sur un graphe cyclique.
 */
function ascendance(startId: number, parentOf: Map<number, ParentEdge[]>): Map<number, AncestorEntry> {
  const entries = new Map<number, AncestorEntry>([
    [startId, { dist: 0, viaChild: null, role: null }],
  ]);
  const queue = [startId];
  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index]!;
    const currentDist = entries.get(currentId)!.dist;
    for (const { parentId, role } of parentOf.get(currentId) ?? []) {
      if (!entries.has(parentId)) {
        entries.set(parentId, { dist: currentDist + 1, viaChild: currentId, role });
        queue.push(parentId);
      }
    }
  }
  return entries;
}

/**
 * Libellé et classification d'un lien collatéral (aucune des deux personnes
 * n'est ancêtre de l'autre) : `dA` et `dB` valent donc au moins 1.
 */
function describeCollateralLink(
  dA: number,
  dB: number,
  fromId: number,
  toId: number,
  parentOf: Map<number, ParentEdge[]>,
  isFeminine: boolean,
): KinshipLink {
  const m = Math.min(dA, dB);
  const n = Math.abs(dA - dB);

  // Ancêtre commun au niveau 1 des deux côtés : même fratrie.
  if (m === 1 && n === 0) {
    const sharedParents = countSharedParents(fromId, toId, parentOf);
    return {
      label:
        sharedParents >= 2
          ? isFeminine
            ? "sœur"
            : "frère"
          : isFeminine
            ? "demi-sœur"
            : "demi-frère",
      relation: "frere-soeur",
      degree: 0,
      generationGap: 0,
    };
  }

  if (m === 1) {
    // dA < dB : from est d'une génération au-dessus de to. Au-delà d'un écart
    // d'une génération (grand-oncle, petit-neveu…), la spec ne fixe pas de
    // libellé dédié : on réutilise le suffixe d'écart des cousins.
    const base = dA < dB ? (isFeminine ? "tante" : "oncle") : isFeminine ? "nièce" : "neveu";
    return {
      label: base + (n > 1 ? generationGapSuffix(n) : ""),
      relation: "collateral",
      degree: 0,
      generationGap: n,
    };
  }

  const degree = m - 1;
  return {
    label: cousinLabel(degree, isFeminine) + generationGapSuffix(n),
    relation: "collateral",
    degree,
    generationGap: n,
  };
}

/** Nombre de personnes distinctes parents à la fois de `fromId` et de `toId`. */
function countSharedParents(
  fromId: number,
  toId: number,
  parentOf: Map<number, ParentEdge[]>,
): number {
  const fromParents = new Set((parentOf.get(fromId) ?? []).map((edge) => edge.parentId));
  const toParents = new Set((parentOf.get(toId) ?? []).map((edge) => edge.parentId));
  let shared = 0;
  for (const parentId of fromParents) if (toParents.has(parentId)) shared += 1;
  return shared;
}

function ascendantLabel(d: number, isFeminine: boolean): string {
  if (d <= 1) return isFeminine ? "mère" : "père";
  return "arrière-".repeat(d - 2) + (isFeminine ? "grand-mère" : "grand-père");
}

function descendantLabel(d: number, isFeminine: boolean): string {
  if (d <= 1) return isFeminine ? "fille" : "fils";
  return "arrière-".repeat(d - 2) + (isFeminine ? "petite-fille" : "petit-fils");
}

function cousinLabel(degree: number, isFeminine: boolean): string {
  if (degree === 1) return isFeminine ? "cousine germaine" : "cousin germain";
  if (degree === 2) return isFeminine ? "cousine issue de germaine" : "cousin issu de germain";
  return `${isFeminine ? "cousine" : "cousin"} au ${degree}e degré`;
}

function generationGapSuffix(n: number): string {
  if (n === 0) return "";
  return ` à ${n} ${n === 1 ? "degré" : "degrés"} de différence`;
}

/**
 * Chemin canonique ordonné from → lca → to. Chaque pas porte le rôle de la
 * filiation qui le relie au pas précédent, dans le sens du parcours.
 */
function buildPath(
  fromAscendance: Map<number, AncestorEntry>,
  toAscendance: Map<number, AncestorEntry>,
  lca: number,
  nameOf: (personId: number) => string,
): KinshipStep[] {
  const up = ascendingChain(fromAscendance, lca); // [from, …, lca]
  const down = ascendingChain(toAscendance, lca); // [to, …, lca]

  const steps: KinshipStep[] = [{ personId: up[0]!.personId, name: nameOf(up[0]!.personId) }];
  for (const node of up.slice(1)) {
    steps.push({ personId: node.personId, name: nameOf(node.personId), edgeRole: node.role! });
  }
  // Descente : la montée de `to` parcourue à l'envers. Le rôle de l'arête
  // menant au pas courant est porté par le parent, c'est-à-dire le pas
  // précédent dans le sens de la descente.
  for (let index = down.length - 1; index >= 1; index -= 1) {
    const child = down[index - 1]!;
    steps.push({
      personId: child.personId,
      name: nameOf(child.personId),
      edgeRole: down[index]!.role!,
    });
  }
  return steps;
}

/**
 * Reconstruit la chaîne ascendante [départ, …, lca] via le chaînage arrière
 * du BFS. Le `role` porté par un élément est celui de l'arête le reliant à
 * l'élément précédent (son enfant sur le chemin) ; il est `null` pour le départ.
 */
function ascendingChain(
  entries: Map<number, AncestorEntry>,
  lca: number,
): { personId: number; role: FiliationRole | null }[] {
  const chain: { personId: number; role: FiliationRole | null }[] = [];
  let currentId: number | null = lca;
  while (currentId !== null) {
    const entry: AncestorEntry = entries.get(currentId)!;
    chain.push({ personId: currentId, role: entry.role });
    currentId = entry.viaChild;
  }
  return chain.reverse();
}

/**
 * Nombre de chemins simples distincts entre `fromId` et `toId` dans le graphe
 * non orienté parent-enfant. Le parcours s'arrête dès qu'il en a trouvé `limit`
 * (donc au plus `limit`), et reste borné par `MAX_PATH_EXPLORATION_STEPS` pour
 * ne pas exploser sur un graphe dense : sur un très grand graphe où un seul
 * chemin existe, le comptage peut donc être tronqué et sous-estimer le nombre
 * réel de chemins.
 */
function countSimplePaths(
  filiations: Filiation[],
  fromId: number,
  toId: number,
  limit = 2,
): number {
  const adjacency = new Map<number, Set<number>>();
  const connect = (a: number, b: number): void => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)!.add(b);
  };
  for (const filiation of filiations) {
    connect(filiation.parentId, filiation.childId);
    connect(filiation.childId, filiation.parentId);
  }

  const visited = new Set<number>([fromId]);
  let found = 0;
  let explorations = 0;
  const walk = (currentId: number): void => {
    explorations += 1;
    for (const neighborId of adjacency.get(currentId) ?? []) {
      if (found >= limit || explorations >= MAX_PATH_EXPLORATION_STEPS) return;
      if (neighborId === toId) {
        found += 1;
        continue;
      }
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      walk(neighborId);
      visited.delete(neighborId);
    }
  };
  walk(fromId);
  return found;
}
