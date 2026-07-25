import { describe, it, expect } from "vitest";
import type { FamilyTree } from "@testvibe/core";
import { buildReactFlowGraph, buildHierarchyRows } from "./family-tree-layout";

function makeTree(): FamilyTree {
  return {
    rootId: 2,
    nodes: [
      { person: { id: 1, firstName: "Ada", lastName: "Lovelace", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
      { person: { id: 2, firstName: "Byron", lastName: "King", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
      { person: { id: 3, firstName: "Anne", lastName: "Fontaine", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
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

describe("buildReactFlowGraph", () => {
  it("crée un noeud react-flow par Person avec sa génération et si c'est la racine", () => {
    const graph = buildReactFlowGraph(makeTree());
    expect(graph.nodes).toHaveLength(4);
    const root = graph.nodes.find((n) => n.id === "2")!;
    expect(root.data.isRoot).toBe(true);
    expect(root.data.generation).toBe(0);
    expect(root.data.label).toBe("Byron King");

    const nonRoot = graph.nodes.find((n) => n.id === "1")!;
    expect(nonRoot.data.isRoot).toBe(false);
  });

  it("place les générations sur des lignes y distinctes et croissantes", () => {
    const graph = buildReactFlowGraph(makeTree());
    const yByGeneration = new Map(graph.nodes.map((n) => [n.data.generation, n.position.y]));
    expect(yByGeneration.get(-1)!).toBeLessThan(yByGeneration.get(0)!);
    expect(yByGeneration.get(0)!).toBeLessThan(yByGeneration.get(1)!);
  });

  it("répartit horizontalement les noeuds d'une même génération (positions x distinctes)", () => {
    const graph = buildReactFlowGraph(makeTree());
    const gen0 = graph.nodes.filter((n) => n.data.generation === 0);
    expect(gen0).toHaveLength(2);
    expect(gen0[0].position.x).not.toBe(gen0[1].position.x);
  });

  it("crée une arête react-flow par Filiation et par Union", () => {
    const graph = buildReactFlowGraph(makeTree());
    expect(graph.edges).toHaveLength(4);
    expect(graph.edges.find((e) => e.id === "filiation-10")).toMatchObject({
      source: "1",
      target: "2",
      label: "biologique",
    });
    expect(graph.edges.find((e) => e.id === "union-20")).toMatchObject({
      source: "2",
      target: "3",
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
