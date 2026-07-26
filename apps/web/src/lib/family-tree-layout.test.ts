import { describe, it, expect } from "vitest";
import type { FamilyTree } from "@testvibe/core";
import { buildReactFlowGraph, buildHierarchyRows, type PersonNodeData } from "./family-tree-layout";

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

function personData(node: ReturnType<typeof buildReactFlowGraph>["nodes"][number]): PersonNodeData {
  return node.data as PersonNodeData;
}

describe("buildReactFlowGraph", () => {
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
    const merged = graph.edges.find((e) => e.id === "union-20-child-4");
    expect(merged).toMatchObject({ source: "union-20", target: "4", label: "biologique" });

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
        { person: { id: 1, firstName: "Pascal", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: -1 },
        { person: { id: 2, firstName: "Laurence", lastName: "Grente", birthDate: null, deathDate: null, gender: "F" } as any, generation: -1 },
        { person: { id: 3, firstName: "Didier", lastName: "Renault", birthDate: null, deathDate: null, gender: "M" } as any, generation: -1 },
        { person: { id: 4, firstName: "Martine", lastName: "Renault", birthDate: null, deathDate: null, gender: "F" } as any, generation: -1 },
        { person: { id: 10, firstName: "Mathilde", lastName: "Renault", birthDate: null, deathDate: null, gender: "F" } as any, generation: 0 },
        { person: { id: 11, firstName: "Romain", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
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
  });

  it("garde une arête de Filiation directe quand le parent n'a pas d'Union commune avec un autre parent", () => {
    const graph = buildReactFlowGraph(makeTree());
    expect(graph.edges.find((e) => e.id === "filiation-10")).toMatchObject({
      source: "1",
      target: "2",
      label: "biologique",
    });
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
