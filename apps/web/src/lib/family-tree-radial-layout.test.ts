import { describe, expect, it } from "vitest";
import type { FamilyTree } from "@testvibe/core";
import { buildRadialLayout } from "./family-tree-radial-layout";

const person = (id: number, firstName: string) => ({
  person: { id, firstName, lastName: "Test", birthName: null, birthDate: null, deathDate: null, gender: null },
  generation: id === 1 ? 0 : -1,
});

describe("buildRadialLayout", () => {
  it("place la racine au centre bas et répartit ses ascendants sur un anneau", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [person(1, "Racine"), person(2, "Parent A"), person(3, "Parent B")] as FamilyTree["nodes"],
      edges: [
        { type: "filiation", filiationId: 1, parentId: 2, childId: 1, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 3, childId: 1, role: "biologique" },
      ],
    };
    const layout = buildRadialLayout(tree);
    const root = layout.nodes.find((node) => node.personId === 1)!;
    const parents = layout.nodes.filter((node) => node.generation === 1);

    expect(root.isRoot).toBe(true);
    expect(root.x).toBe(layout.width / 2);
    expect(parents).toHaveLength(2);
    expect(parents.every((node) => node.y < root.y)).toBe(true);
    expect(layout.links).toHaveLength(2);
  });

  it("écarte les descendants et partenaires qui ne sont pas des ascendants", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [person(1, "Racine"), person(2, "Enfant"), person(3, "Partenaire")] as FamilyTree["nodes"],
      edges: [
        { type: "filiation", filiationId: 1, parentId: 1, childId: 2, role: "biologique" },
        { type: "union", unionId: 1, personIds: [1, 3] },
      ],
    };
    expect(buildRadialLayout(tree).nodes.map((node) => node.personId)).toEqual([1]);
  });

  it("dimensionne le canevas pour contenir toutes les générations", () => {
    const nodes = Array.from({ length: 31 }, (_, index) => person(index + 1, `Personne ${index + 1}`));
    const edges = Array.from({ length: 30 }, (_, index) => ({
      type: "filiation" as const,
      filiationId: index + 1,
      parentId: index + 2,
      childId: Math.floor(index / 2) + 1,
      role: "biologique" as const,
    }));
    const layout = buildRadialLayout({ rootId: 1, nodes, edges } as FamilyTree);

    expect(Math.max(...layout.nodes.map((node) => node.generation))).toBe(4);
    for (const node of layout.nodes) {
      expect(node.x - 62).toBeGreaterThanOrEqual(0);
      expect(node.x + 62).toBeLessThanOrEqual(layout.width);
      expect(node.y - 25).toBeGreaterThanOrEqual(0);
      expect(node.y + 25).toBeLessThanOrEqual(layout.height);
    }
  });
});
