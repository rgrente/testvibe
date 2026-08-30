import { describe, it, expect } from "vitest";
import type { FamilyTree } from "@testvibe/core";
import {
  buildReactFlowGraph,
  buildHierarchyRows,
  GENERATION_ROW_HEIGHT,
  PERSON_NODE_WIDTH,
  PERSON_NODE_HEIGHT,
  SIBLING_PITCH,
  type OrthogonalSegment,
  type PersonNodeData,
  type RoutedFiliationEdgeData,
} from "./family-tree-layout";

function makeTree(): FamilyTree {
  return {
    rootId: 2,
    nodes: [
      { person: { id: 1, firstName: "Ada", lastName: "Lovelace", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
      { person: { id: 2, firstName: "Byron", lastName: "King", birthDate: "1950-05-12", deathDate: null, gender: "M" } as any, generation: 0 },
      { person: { id: 3, firstName: "Anne", lastName: "Fontaine", birthDate: null, deathDate: null, gender: "F" } as any, generation: 0 },
      { person: { id: 4, firstName: "Ralph", lastName: "King", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
    ],
    edges: [
      { type: "filiation", filiationId: 10, parentId: 1, childId: 2, role: "biologique" },
      { type: "union", unionId: 20, personIds: [2, 3] },
      { type: "filiation", filiationId: 11, parentId: 2, childId: 4, role: "biologique" },
      { type: "filiation", filiationId: 12, parentId: 3, childId: 4, role: "biologique" },
    ],
  };
}

function makeBlockedFiliationTree(): FamilyTree {
  return {
    rootId: 1,
    nodes: [
      { person: { id: 1, firstName: "Parent", lastName: "Gauche", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
      { person: { id: 2, firstName: "Parent", lastName: "Droite", birthDate: null, deathDate: null, gender: "F" } as any, generation: 0 },
      { person: { id: 3, firstName: "Carte", lastName: "Bloquante", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
      ...[10, 11, 12, 13, 14, 15, 16].map((id) => ({
        person: { id, firstName: "Enfant", lastName: String(id), birthDate: null, deathDate: null, gender: null } as any,
        generation: 1,
      })),
      { person: { id: 30, firstName: "Enfant", lastName: "Obstacle", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
      { person: { id: 20, firstName: "Petit-enfant", lastName: "Test", birthDate: null, deathDate: null, gender: null } as any, generation: 2 },
    ],
    edges: [
      { type: "union", unionId: 100, personIds: [1, 2] },
      ...[10, 11, 12, 13, 14, 15, 16].flatMap((childId, index) => [
        { type: "filiation" as const, filiationId: 10 + index * 2, parentId: 1, childId, role: "biologique" as const },
        { type: "filiation" as const, filiationId: 11 + index * 2, parentId: 2, childId, role: "biologique" as const },
      ]),
      { type: "filiation", filiationId: 30, parentId: 3, childId: 30, role: "biologique" },
      { type: "filiation", filiationId: 31, parentId: 16, childId: 20, role: "biologique" },
    ],
  };
}

function makeImpossibleFiliationTree(): FamilyTree {
  return {
    rootId: 1,
    nodes: [1, 2, 3].map((id) => ({
      person: { id, firstName: "Parent", lastName: String(id), birthDate: null, deathDate: null, gender: null } as any,
      generation: 0,
    })).concat({
      person: { id: 10, firstName: "Enfant", lastName: "Test", birthDate: null, deathDate: null, gender: null } as any,
      generation: 1,
    }),
    edges: [
      { type: "union", unionId: 100, personIds: [1, 2] },
      { type: "union", unionId: 101, personIds: [1, 3] },
      { type: "union", unionId: 102, personIds: [2, 3] },
      { type: "filiation", filiationId: 10, parentId: 2, childId: 10, role: "biologique" },
      { type: "filiation", filiationId: 11, parentId: 3, childId: 10, role: "biologique" },
    ],
  };
}

function personData(node: ReturnType<typeof buildReactFlowGraph>["nodes"][number]): PersonNodeData {
  return node.data as PersonNodeData;
}

describe("buildReactFlowGraph", () => {
  it("applique les constantes desktop et centre l'enfant médian d'une fratrie de trois sur la jonction", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [
        { person: { id: 8, firstName: "Aïeul", lastName: "Test", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
        { person: { id: 1, firstName: "Parent", lastName: "Test", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
        { person: { id: 2, firstName: "Partenaire", lastName: "Test", birthDate: null, deathDate: null, gender: "F" } as any, generation: 0 },
        { person: { id: 3, firstName: "Aîné", lastName: "Test", birthDate: "2010-01-01", deathDate: null, gender: null } as any, generation: 1 },
        { person: { id: 4, firstName: "Cadet", lastName: "Test", birthDate: "2012-01-01", deathDate: null, gender: null } as any, generation: 1 },
        { person: { id: 5, firstName: "Benjamin", lastName: "Test", birthDate: "2014-01-01", deathDate: null, gender: null } as any, generation: 1 },
        { person: { id: 9, firstName: "Petit-enfant", lastName: "Test", birthDate: null, deathDate: null, gender: null } as any, generation: 2 },
      ],
      edges: [
        { type: "union", unionId: 10, personIds: [1, 2] },
        ...[3, 4, 5].flatMap((childId, index) => [
          { type: "filiation" as const, filiationId: 20 + index * 2, parentId: 1, childId, role: "biologique" as const },
          { type: "filiation" as const, filiationId: 21 + index * 2, parentId: 2, childId, role: "biologique" as const },
        ]),
        { type: "filiation", filiationId: 30, parentId: 8, childId: 1, role: "biologique" },
        { type: "filiation", filiationId: 31, parentId: 4, childId: 9, role: "biologique" },
      ],
    };

    const graph = buildReactFlowGraph(tree);
    const person = (id: number) => graph.nodes.find((node) => node.id === String(id))!;
    const junction = graph.nodes.find((node) => node.id === "union-10")!;

    expect(PERSON_NODE_WIDTH).toBe(184);
    expect(GENERATION_ROW_HEIGHT).toBe(140);
    expect(SIBLING_PITCH).toBe(220);
    expect(person(8).position.y).toBe(-140);
    expect(person(9).position.y).toBe(280);
    expect(person(1).style).toMatchObject({ width: 184 });
    expect(person(4).position.x + PERSON_NODE_WIDTH / 2).toBe(junction.position.x + 4);
    expect(person(4).position.x - person(3).position.x).toBe(220);
    expect(person(5).position.x - person(4).position.x).toBe(220);
  });

  it("produit une seule jonction et un seul bus horizontal par union et fratrie", () => {
    const tree = makeTree();
    tree.nodes.push(
      { person: { id: 5, firstName: "Grace", lastName: "King", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
      { person: { id: 6, firstName: "Alan", lastName: "King", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
    );
    tree.edges.push(
      { type: "filiation", filiationId: 13, parentId: 2, childId: 5, role: "adopte" },
      { type: "filiation", filiationId: 14, parentId: 3, childId: 5, role: "adopte" },
      { type: "filiation", filiationId: 15, parentId: 2, childId: 6, role: "beau-parent" },
      { type: "filiation", filiationId: 16, parentId: 3, childId: 6, role: "beau-parent" },
    );

    const graph = buildReactFlowGraph(tree);
    const junctions = graph.nodes.filter((node) => node.id === "union-20");
    const siblingEdges = graph.edges.filter((edge) => edge.id === "union-20-children");
    const data = siblingEdges[0]?.data as RoutedFiliationEdgeData;

    expect(junctions).toHaveLength(1);
    expect(siblingEdges).toHaveLength(1);
    expect(data.bus).toBeDefined();
    expect(data.targets).toHaveLength(3);
    expect(data.segments.filter((segment) => segment.kind === "bus")).toHaveLength(1);
  });

  it("place une personne ayant deux unions entre ses partenaires et ignore une union incomplète", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [
        { person: { id: 1, firstName: "Parent", lastName: "Commun", birthDate: "1980-01-01", deathDate: null, gender: "M" } as any, generation: 0 },
        { person: { id: 2, firstName: "Partenaire", lastName: "A", birthDate: "1981-01-01", deathDate: null, gender: "F" } as any, generation: 0 },
        { person: { id: 3, firstName: "Partenaire", lastName: "B", birthDate: "1982-01-01", deathDate: null, gender: "F" } as any, generation: 0 },
        { person: { id: 4, firstName: "Personne", lastName: "Seule", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        { person: { id: 5, firstName: "Enfant", lastName: "A", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
        { person: { id: 6, firstName: "Enfant", lastName: "B", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
      ],
      edges: [
        { type: "union", unionId: 10, personIds: [1, 2] },
        { type: "union", unionId: 20, personIds: [1, 3] },
        { type: "union", unionId: 30, personIds: [4] },
        { type: "filiation", filiationId: 1, parentId: 1, childId: 5, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 2, childId: 5, role: "biologique" },
        { type: "filiation", filiationId: 3, parentId: 1, childId: 6, role: "biologique" },
        { type: "filiation", filiationId: 4, parentId: 3, childId: 6, role: "biologique" },
        { type: "filiation", filiationId: 5, parentId: 99, childId: 6, role: "biologique" },
      ],
    };

    const graph = buildReactFlowGraph(tree);
    const x = (id: number) => graph.nodes.find((node) => node.id === String(id))!.position.x;

    expect(x(1)).toBeGreaterThan(Math.min(x(2), x(3)));
    expect(x(1)).toBeLessThan(Math.max(x(2), x(3)));
    expect(Math.abs(x(1) - x(2))).toBe(300);
    expect(Math.abs(x(1) - x(3))).toBe(300);
    expect(graph.nodes.filter((node) => node.id === "union-10")).toHaveLength(1);
    expect(graph.nodes.filter((node) => node.id === "union-20")).toHaveLength(1);
    expect(graph.nodes.some((node) => node.id === "union-30")).toBe(false);
    expect(graph.edges.filter((edge) => edge.id.endsWith("-children"))).toHaveLength(2);
    expect(graph.edges.some((edge) => edge.source === "99")).toBe(false);
  });

  it("route les filiations sans couper l'intérieur des cartes", () => {
    const graph = buildReactFlowGraph(makeTree());
    const cards = graph.nodes
      .filter((node) => node.type === "person")
      .map((node) => ({ left: node.position.x, right: node.position.x + PERSON_NODE_WIDTH, top: node.position.y, bottom: node.position.y + PERSON_NODE_HEIGHT }));
    const routedSegments = graph.edges.flatMap((edge) =>
      edge.type === "filiation" ? ((edge.data as RoutedFiliationEdgeData).segments ?? []) : [],
    );
    const crossesInterior = (segment: OrthogonalSegment, card: (typeof cards)[number]) => {
      if (segment.x1 === segment.x2) {
        return segment.x1 > card.left && segment.x1 < card.right
          && Math.max(segment.y1, segment.y2) > card.top && Math.min(segment.y1, segment.y2) < card.bottom;
      }
      return segment.y1 > card.top && segment.y1 < card.bottom
        && Math.max(segment.x1, segment.x2) > card.left && Math.min(segment.x1, segment.x2) < card.right;
    };

    expect(routedSegments.length).toBeGreaterThan(0);
    for (const segment of routedSegments) {
      expect(cards.filter((card) => crossesInterior(segment, card))).toHaveLength(0);
    }
  });

  it("ne plante pas quand une fratrie nombreuse étend son bus derrière une carte de la génération source", () => {
    const graph = buildReactFlowGraph(makeBlockedFiliationTree());
    const data = graph.edges.find((edge) => edge.id === "union-100-children")!.data as RoutedFiliationEdgeData;
    const blocker = graph.nodes.find((node) => node.id === "3")!;
    const blockerBottom = blocker.position.y + PERSON_NODE_HEIGHT + 12;
    const sourceX = graph.nodes.find((node) => node.id === "union-100")!.position.x + 4;

    expect(sourceX).not.toBe(data.targets[Math.floor(data.targets.length / 2)].x);
    expect(data.bus.y1).toBe(blockerBottom);
    expect(data.segments.every((segment) => {
      if (segment.x1 === segment.x2) return true;
      return segment.y1 <= blocker.position.y - 12 || segment.y1 >= blockerBottom
        || Math.max(segment.x1, segment.x2) <= blocker.position.x - 12
        || Math.min(segment.x1, segment.x2) >= blocker.position.x + PERSON_NODE_WIDTH + 12;
    })).toBe(true);
  });

  it("retourne un fallback orthogonal déterministe quand la source se trouve derrière une carte obstacle", () => {
    const tree = makeImpossibleFiliationTree();
    const permuted = { ...tree, nodes: [...tree.nodes].reverse(), edges: [...tree.edges].reverse() };
    const route = (input: FamilyTree) => {
      const graph = buildReactFlowGraph(input);
      return graph.edges.find((edge) => edge.id === "union-102-children")!.data as RoutedFiliationEdgeData;
    };

    const first = route(tree);
    const second = route(tree);
    const reordered = route(permuted);
    expect(second.segments).toEqual(first.segments);
    expect(reordered.segments).toEqual(first.segments);
    expect(first.segments.every((segment) =>
      [segment.x1, segment.y1, segment.x2, segment.y2].every(Number.isFinite)
      && (segment.x1 === segment.x2 || segment.y1 === segment.y2))).toBe(true);
    expect(first.segments[0]).toMatchObject({ x1: 392, y1: 24, kind: "stem" });
    expect(first.segments.some((segment) => segment.x2 === first.targets[0].x && segment.y2 === first.targets[0].y)).toBe(true);
  });

  it("utilise un profil mobile compact sans changer la sémantique du graphe", () => {
    const desktop = buildReactFlowGraph(makeTree(), "desktop");
    const mobile = buildReactFlowGraph(makeTree(), "mobile");
    const x = (graph: typeof desktop, id: string) => graph.nodes.find((node) => node.id === id)!.position.x;
    const y = (graph: typeof desktop, id: string) => graph.nodes.find((node) => node.id === id)!.position.y;

    expect(x(mobile, "3") - x(mobile, "2")).toBe(210);
    expect(x(desktop, "3") - x(desktop, "2")).toBe(300);
    expect(Math.abs(y(mobile, "1"))).toBeLessThan(Math.abs(y(desktop, "1")));
    expect(mobile.edges.map((edge) => edge.id)).toEqual(desktop.edges.map((edge) => edge.id));
    expect(personData(mobile.nodes.find((node) => node.id === "2")!).layoutProfile).toBe("mobile");
  });
  it("crée un noeud react-flow par Person avec sa génération et si c'est la racine", () => {
    const graph = buildReactFlowGraph(makeTree());
    const personNodes = graph.nodes.filter((n) => n.type === "person");
    expect(personNodes).toHaveLength(4);

    const root = graph.nodes.find((n) => n.id === "2")!;
    expect(personData(root).isRoot).toBe(true);
    expect(personData(root).generation).toBe(0);
    expect(personData(root).label).toBe("Byron King");

    const nonRoot = graph.nodes.find((n) => n.id === "1")!;
    expect(personData(nonRoot).isRoot).toBe(false);
  });

  it("propage le genre et les dates de naissance/décès dans les données du noeud", () => {
    const graph = buildReactFlowGraph(makeTree());
    const byron = personData(graph.nodes.find((n) => n.id === "2")!);
    expect(byron.gender).toBe("M");
    expect(byron.birthDate).toBe("1950-05-12");
    expect(byron.deathDate).toBeNull();

    const ada = personData(graph.nodes.find((n) => n.id === "1")!);
    expect(ada.gender).toBeNull();
  });

  it("place les générations sur des lignes y distinctes et croissantes", () => {
    const graph = buildReactFlowGraph(makeTree());
    const personNodes = graph.nodes.filter((n) => n.type === "person");
    const yByGeneration = new Map(personNodes.map((n) => [personData(n).generation, n.position.y]));
    expect(yByGeneration.get(-1)!).toBeLessThan(yByGeneration.get(0)!);
    expect(yByGeneration.get(0)!).toBeLessThan(yByGeneration.get(1)!);
  });

  it("répartit horizontalement les noeuds d'une même génération (positions x distinctes)", () => {
    const graph = buildReactFlowGraph(makeTree());
    const gen0 = graph.nodes.filter((n) => n.type === "person" && personData(n).generation === 0);
    expect(gen0).toHaveLength(2);
    expect(gen0[0].position.x).not.toBe(gen0[1].position.x);
  });

  it("place les deux partenaires d'une Union sur des colonnes adjacentes même si un tiers de la même génération les sépare par ordre d'id", () => {
    const tree: FamilyTree = {
      rootId: 2,
      nodes: [
        { person: { id: 2, firstName: "Byron", lastName: "King", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        // Id 5 s'intercale entre les deux partenaires (2 et 9) par tri naïf.
        { person: { id: 5, firstName: "Autre", lastName: "Personne", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        { person: { id: 9, firstName: "Anne", lastName: "Fontaine", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
      ],
      edges: [{ type: "union", unionId: 30, personIds: [2, 9] }],
    };
    const graph = buildReactFlowGraph(tree);
    const byron = graph.nodes.find((n) => n.id === "2")!;
    const anne = graph.nodes.find((n) => n.id === "9")!;
    expect(Math.abs(anne.position.x - byron.position.x)).toBe(300);
  });

  it("place l'homme à gauche et la femme à droite dans un couple, même si l'ordre de rencontre suggère l'inverse", () => {
    const tree: FamilyTree = {
      rootId: 9,
      nodes: [
        // Anne (F, id 2) rencontrée avant Byron (M, id 9) par tri id/date :
        // sans la règle de genre, Anne se retrouverait à gauche.
        { person: { id: 2, firstName: "Anne", lastName: "Fontaine", birthDate: null, deathDate: null, gender: "F" } as any, generation: 0 },
        { person: { id: 9, firstName: "Byron", lastName: "King", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
      ],
      edges: [{ type: "union", unionId: 30, personIds: [2, 9] }],
    };
    const graph = buildReactFlowGraph(tree);
    const byronX = graph.nodes.find((n) => n.id === "9")!.position.x;
    const anneX = graph.nodes.find((n) => n.id === "2")!.position.x;
    expect(byronX).toBeLessThan(anneX);
  });

  it("conserve l'ordre de rencontre pour départager un couple de même genre (ex. deux hommes)", () => {
    const tree: FamilyTree = {
      rootId: 9,
      nodes: [
        { person: { id: 2, firstName: "Marc", lastName: "Fontaine", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
        { person: { id: 9, firstName: "Byron", lastName: "King", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
      ],
      edges: [{ type: "union", unionId: 30, personIds: [2, 9] }],
    };
    const graph = buildReactFlowGraph(tree);
    const byronX = graph.nodes.find((n) => n.id === "9")!.position.x;
    const marcX = graph.nodes.find((n) => n.id === "2")!.position.x;
    // Aucun des deux n'est prioritaire par genre : Marc (id 2, rencontré en
    // premier par tri id) reste à gauche.
    expect(marcX).toBeLessThan(byronX);
  });

  it("ordonne les enfants par date de naissance plutôt que par id", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [
        { person: { id: 1, firstName: "Parent", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        // Ids volontairement en désordre par rapport aux dates de naissance.
        { person: { id: 20, firstName: "Cadet", lastName: "Grente", birthDate: "2018-01-01", deathDate: null, gender: null } as any, generation: 1 },
        { person: { id: 21, firstName: "Aine", lastName: "Grente", birthDate: "2016-01-01", deathDate: null, gender: null } as any, generation: 1 },
        { person: { id: 22, firstName: "Benjamin", lastName: "Grente", birthDate: "2020-01-01", deathDate: null, gender: null } as any, generation: 1 },
      ],
      edges: [
        { type: "filiation", filiationId: 1, parentId: 1, childId: 20, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 1, childId: 21, role: "biologique" },
        { type: "filiation", filiationId: 3, parentId: 1, childId: 22, role: "biologique" },
      ],
    };
    const graph = buildReactFlowGraph(tree);
    const xOf = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;
    // Aine (2016) < Cadet (2018) < Benjamin (2020), indépendamment de l'ordre des id (21, 20, 22).
    expect(xOf("21")).toBeLessThan(xOf("20"));
    expect(xOf("20")).toBeLessThan(xOf("22"));
  });

  it("crée un point de jonction pour une Union à deux partenaires, relié aux deux partenaires", () => {
    const graph = buildReactFlowGraph(makeTree());
    const junction = graph.nodes.find((n) => n.id === "union-20");
    expect(junction).toBeDefined();
    expect(junction!.type).toBe("unionJunction");

    expect(graph.edges.find((e) => e.id === "union-20-link-2")).toMatchObject({
      source: "2",
      target: "union-20",
    });
    expect(graph.edges.find((e) => e.id === "union-20-link-3")).toMatchObject({
      source: "3",
      target: "union-20",
    });
  });

  it("fusionne les Filiation d'un enfant commun aux deux partenaires en une seule arête depuis le point de jonction", () => {
    const graph = buildReactFlowGraph(makeTree());
    const merged = graph.edges.find((e) => e.id === "union-20-children");
    expect(merged).toMatchObject({ source: "union-20", target: "4" });
    expect(merged!.label).toBeUndefined();

    // Les arêtes de Filiation individuelles (11 et 12) ne doivent plus apparaître telles quelles.
    expect(graph.edges.find((e) => e.id === "filiation-11")).toBeUndefined();
    expect(graph.edges.find((e) => e.id === "filiation-12")).toBeUndefined();
  });

  it("ancre chaque couple d'ascendants sur la position de son propre enfant, plutôt que de trier par id", () => {
    // Reproduit le cas où deux couples d'une même génération d'ascendants
    // se rattachent chacun à un enfant différent de la génération 0 :
    // sans ancrage, l'ordre par id placerait Pascal+Laurence à gauche et
    // Didier+Martine à droite, alors que Mathilde (leur fille) est à
    // gauche et Romain (fils de Pascal+Laurence) à droite — provoquant
    // un croisement des liens de Filiation.
    const tree: FamilyTree = {
      rootId: 11,
      nodes: [
        // Genre neutre partout : ce test porte sur l'anti-croisement par
        // ancrage, indépendamment de la règle homme-à-gauche (cf. tests dédiés).
        { person: { id: 1, firstName: "Pascal", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
        { person: { id: 2, firstName: "Laurence", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
        { person: { id: 3, firstName: "Didier", lastName: "Renault", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
        { person: { id: 4, firstName: "Martine", lastName: "Renault", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
        { person: { id: 10, firstName: "Mathilde", lastName: "Renault", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        { person: { id: 11, firstName: "Romain", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
      ],
      edges: [
        { type: "union", unionId: 100, personIds: [10, 11] },
        { type: "union", unionId: 200, personIds: [1, 2] },
        { type: "union", unionId: 201, personIds: [3, 4] },
        { type: "filiation", filiationId: 1, parentId: 1, childId: 11, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 2, childId: 11, role: "biologique" },
        { type: "filiation", filiationId: 3, parentId: 3, childId: 10, role: "biologique" },
        { type: "filiation", filiationId: 4, parentId: 4, childId: 10, role: "biologique" },
      ],
    };

    const graph = buildReactFlowGraph(tree);
    const xOf = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;

    const mathildeX = xOf("10");
    const romainX = xOf("11");
    const didierMartineMaxX = Math.max(xOf("3"), xOf("4"));
    const pascalLaurenceMinX = Math.min(xOf("1"), xOf("2"));

    expect(mathildeX).toBeLessThan(romainX);
    // Didier+Martine (parents de Mathilde) entièrement à gauche de Pascal+Laurence (parents de Romain).
    expect(didierMartineMaxX).toBeLessThan(pascalLaurenceMinX);

    // Les deux couples d'ascendants ont la même largeur et sont tous deux
    // gênés par l'autre : l'écart nécessaire pour respecter l'espacement
    // minimal doit être réparti à parts égales (chacun s'éloigne autant de
    // son propre ancrage), plutôt que d'être entièrement absorbé par un
    // seul des deux couples.
    const didierMartineMidpoint = (xOf("3") + xOf("4")) / 2;
    const pascalLaurenceMidpoint = (xOf("1") + xOf("2")) / 2;
    const leftShift = mathildeX - didierMartineMidpoint;
    const rightShift = pascalLaurenceMidpoint - romainX;
    expect(leftShift).toBeGreaterThan(0);
    expect(leftShift).toBeCloseTo(rightShift, 5);
  });

  it("centre un couple d'ascendants exactement sur son enfant unique", () => {
    const tree: FamilyTree = {
      rootId: 11,
      nodes: [
        { person: { id: 1, firstName: "Pascal", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: -1 },
        { person: { id: 2, firstName: "Laurence", lastName: "Grente", birthDate: null, deathDate: null, gender: "F" } as any, generation: -1 },
        { person: { id: 11, firstName: "Romain", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
      ],
      edges: [
        { type: "union", unionId: 200, personIds: [1, 2] },
        { type: "filiation", filiationId: 1, parentId: 1, childId: 11, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 2, childId: 11, role: "biologique" },
      ],
    };

    const graph = buildReactFlowGraph(tree);
    const xOf = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;
    const coupleMidpoint = (xOf("1") + xOf("2")) / 2;

    expect(coupleMidpoint).toBe(xOf("11"));
  });

  it("centre un couple d'ascendants sur la largeur occupée par ses deux enfants (fratrie)", () => {
    const tree: FamilyTree = {
      rootId: 11,
      nodes: [
        { person: { id: 1, firstName: "Pascal", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: -1 },
        { person: { id: 2, firstName: "Laurence", lastName: "Grente", birthDate: null, deathDate: null, gender: "F" } as any, generation: -1 },
        { person: { id: 11, firstName: "Romain", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
        { person: { id: 12, firstName: "Sophie", lastName: "Grente", birthDate: null, deathDate: null, gender: "F" } as any, generation: 0 },
      ],
      edges: [
        { type: "union", unionId: 200, personIds: [1, 2] },
        { type: "filiation", filiationId: 1, parentId: 1, childId: 11, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 2, childId: 11, role: "biologique" },
        { type: "filiation", filiationId: 3, parentId: 1, childId: 12, role: "biologique" },
        { type: "filiation", filiationId: 4, parentId: 2, childId: 12, role: "biologique" },
      ],
    };

    const graph = buildReactFlowGraph(tree);
    const xOf = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;
    const coupleMidpoint = (xOf("1") + xOf("2")) / 2;
    const childrenMidpoint = (xOf("11") + xOf("12")) / 2;

    expect(coupleMidpoint).toBe(childrenMidpoint);
  });

  it("n'utilise pas une unité sans ancrage pour contraindre la position d'un cluster ancré voisin", () => {
    // Maxime (frère de Mathilde) est dans la même génération que le couple
    // Romain+Mathilde, mais n'a aucun enfant connu dans cette vue : il ne
    // doit pas décentrer Romain+Mathilde de la fratrie Léni/Mahé.
    const tree: FamilyTree = {
      rootId: 30,
      nodes: [
        { person: { id: 1, firstName: "Romain", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: -1 },
        { person: { id: 2, firstName: "Mathilde", lastName: "Renault", birthDate: null, deathDate: null, gender: "F" } as any, generation: -1 },
        { person: { id: 3, firstName: "Maxime", lastName: "Renault", birthDate: null, deathDate: null, gender: "M" } as any, generation: -1 },
        { person: { id: 30, firstName: "Leni", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        { person: { id: 31, firstName: "Mahe", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
      ],
      edges: [
        { type: "union", unionId: 100, personIds: [1, 2] },
        { type: "filiation", filiationId: 1, parentId: 1, childId: 30, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 2, childId: 30, role: "biologique" },
        { type: "filiation", filiationId: 3, parentId: 1, childId: 31, role: "biologique" },
        { type: "filiation", filiationId: 4, parentId: 2, childId: 31, role: "biologique" },
      ],
    };

    const graph = buildReactFlowGraph(tree);
    const xOf = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;
    const coupleMidpoint = (xOf("1") + xOf("2")) / 2;
    const childrenMidpoint = (xOf("30") + xOf("31")) / 2;

    expect(coupleMidpoint).toBe(childrenMidpoint);
  });

  it("conserve les rôles de filiation dans le routage sans exposer de libellé par défaut", () => {
    const tree = makeTree();
    tree.edges.push({ type: "filiation", filiationId: 13, parentId: 1, childId: 3, role: "adopte" });
    const graph = buildReactFlowGraph(tree);
    const edge = graph.edges.find((candidate) => candidate.id === "parent-1-children")!;
    const data = edge.data as RoutedFiliationEdgeData;

    expect(edge.label).toBeUndefined();
    expect(data.targets.find((target) => target.personId === 2)?.roles).toEqual(["biologique"]);
    expect(data.targets.find((target) => target.personId === 3)?.roles).toEqual(["adopte"]);
  });

  it("déduplique une cible par enfant et agrège ses rôles uniques", () => {
    const tree = makeTree();
    tree.edges.push(
      { type: "filiation", filiationId: 40, parentId: 1, childId: 2, role: "adopte" },
      { type: "filiation", filiationId: 41, parentId: 1, childId: 2, role: "biologique" },
    );
    const graph = buildReactFlowGraph(tree);
    const data = graph.edges.find((edge) => edge.id === "parent-1-children")!.data as RoutedFiliationEdgeData;

    expect(data.targets.filter((target) => target.personId === 2)).toHaveLength(1);
    expect(data.targets.find((target) => target.personId === 2)?.roles).toEqual(["biologique", "adopte"]);
  });

  it("évite les rectangles augmentés de 12 px par le canal libre le plus court avec tie-break gauche", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [
        { person: { id: 1, firstName: "Parent", lastName: "Source", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        { person: { id: 2, firstName: "Obstacle", lastName: "Central", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
        { person: { id: 3, firstName: "Enfant", lastName: "Cible", birthDate: null, deathDate: null, gender: null } as any, generation: 2 },
      ],
      edges: [{ type: "filiation", filiationId: 1, parentId: 1, childId: 3, role: "biologique" }],
    };
    const graph = buildReactFlowGraph(tree);
    const data = graph.edges.find((edge) => edge.id === "parent-1-children")!.data as RoutedFiliationEdgeData;
    const obstacle = graph.nodes.find((node) => node.id === "2")!;
    const expanded = { left: obstacle.position.x - 12, right: obstacle.position.x + PERSON_NODE_WIDTH + 12, top: obstacle.position.y - 12, bottom: obstacle.position.y + 72 + 12 };
    const crosses = (segment: OrthogonalSegment) => segment.x1 === segment.x2
      ? segment.x1 > expanded.left && segment.x1 < expanded.right && Math.max(segment.y1, segment.y2) > expanded.top && Math.min(segment.y1, segment.y2) < expanded.bottom
      : segment.y1 > expanded.top && segment.y1 < expanded.bottom && Math.max(segment.x1, segment.x2) > expanded.left && Math.min(segment.x1, segment.x2) < expanded.right;

    expect(data.segments.every((segment) => !crosses(segment))).toBe(true);
    expect(Math.min(...data.segments.flatMap((segment) => [segment.x1, segment.x2]))).toBe(expanded.left);
  });

  it("revalide chaque branche d'une fratrie nombreuse contre les cartes des autres enfants", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [
        { person: { id: 1, firstName: "Parent", lastName: "Source", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        { person: { id: 10, firstName: "Obstacle", lastName: "Gauche", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
        { person: { id: 11, firstName: "Obstacle", lastName: "Droite", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
        ...[20, 21, 22, 23].map((id) => ({ person: { id, firstName: "Enfant", lastName: String(id), birthDate: null, deathDate: null, gender: null } as any, generation: 2 })),
      ],
      edges: [20, 21, 22, 23].map((childId, index) => ({ type: "filiation" as const, filiationId: index + 1, parentId: 1, childId, role: "biologique" as const })),
    };
    const graph = buildReactFlowGraph(tree);
    const data = graph.edges.find((edge) => edge.id === "parent-1-children")!.data as RoutedFiliationEdgeData;
    const cards = graph.nodes.filter((node) => node.type === "person").map((node) => ({
      personId: Number(node.id),
      anchorX: node.position.x + PERSON_NODE_WIDTH / 2,
      anchorY: node.position.y,
      left: node.position.x - 12,
      right: node.position.x + PERSON_NODE_WIDTH + 12,
      top: node.position.y - 12,
      bottom: node.position.y + PERSON_NODE_HEIGHT + 12,
    }));
    const crosses = (segment: OrthogonalSegment, card: (typeof cards)[number]) => segment.x1 === segment.x2
      ? segment.x1 > card.left && segment.x1 < card.right && Math.max(segment.y1, segment.y2) > card.top && Math.min(segment.y1, segment.y2) < card.bottom
      : segment.y1 > card.top && segment.y1 < card.bottom && Math.max(segment.x1, segment.x2) > card.left && Math.min(segment.x1, segment.x2) < card.right;
    const isOwnTargetIngress = (segment: OrthogonalSegment, card: (typeof cards)[number]) =>
      segment.x1 === segment.x2 && segment.x1 === card.anchorX
      && ((segment.x1 === card.anchorX && segment.y1 === card.anchorY) || (segment.x2 === card.anchorX && segment.y2 === card.anchorY));

    for (const segment of data.segments) {
      expect(cards.filter((card) => card.personId !== 1 && crosses(segment, card) && !isOwnTargetIngress(segment, card))).toEqual([]);
    }
  });
});

describe("buildHierarchyRows", () => {
  it("trie par génération croissante (ascendants avant la racine, descendants après)", () => {
    const rows = buildHierarchyRows(makeTree());
    expect(rows.map((r) => r.personId)).toEqual([1, 2, 3, 4]);
    expect(rows[0].generation).toBe(-1);
    expect(rows[3].generation).toBe(1);
  });

  it("marque isRoot uniquement sur la racine et calcule la profondeur d'indentation", () => {
    const rows = buildHierarchyRows(makeTree());
    const root = rows.find((r) => r.personId === 2)!;
    expect(root.isRoot).toBe(true);
    expect(root.depth).toBe(0);

    const grandParent = rows.find((r) => r.personId === 1)!;
    expect(grandParent.depth).toBe(1);
    expect(grandParent.isRoot).toBe(false);
  });

  it("inclut le label complet (prénom + nom)", () => {
    const rows = buildHierarchyRows(makeTree());
    expect(rows.find((r) => r.personId === 4)!.label).toBe("Ralph King");
  });
});
