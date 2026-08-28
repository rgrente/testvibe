import { describe, expect, it } from "vitest";
import type { FamilyTree, Person } from "@testvibe/core";
import { selectPersonRelations } from "./person-relations";

const person = (id: number, firstName: string, gender: string | null): Person => ({
  id,
  firstName,
  lastName: "Test",
  birthName: null,
  birthDate: null,
  deathDate: null,
  gender,
});

describe("selectPersonRelations", () => {
  it("dérive et ordonne parents, partenaires et enfants avec un rôle explicite", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [
        { person: person(1, "Léni", "X"), generation: 0 },
        { person: person(2, "Mathilde", "F"), generation: -1 },
        { person: person(3, "Romain", "M"), generation: -1 },
        { person: person(4, "Camille", null), generation: 0 },
        { person: person(5, "Lou", "F"), generation: 1 },
      ],
      edges: [
        { type: "filiation", filiationId: 10, parentId: 2, childId: 1, role: "biologique" },
        { type: "filiation", filiationId: 11, parentId: 3, childId: 1, role: "beau-parent" },
        { type: "union", unionId: 20, personIds: [1, 4] },
        { type: "filiation", filiationId: 12, parentId: 1, childId: 5, role: "adopte" },
      ],
    };

    expect(selectPersonRelations(tree, 1)).toEqual({
      parents: [
        { person: tree.nodes[1]!.person, role: "Mère · biologique" },
        { person: tree.nodes[2]!.person, role: "Père · beau-parent" },
      ],
      partners: [{ person: tree.nodes[3]!.person, role: "Partenaire" }],
      children: [{ person: tree.nodes[4]!.person, role: "Fille · adopté" }],
    });
  });

  it("ignore les arêtes sans personne disponible et déduplique les unions", () => {
    const root = person(1, "Léni", null);
    const partner = person(2, "Alex", null);
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [{ person: root, generation: 0 }, { person: partner, generation: 0 }],
      edges: [
        { type: "union", unionId: 1, personIds: [1, 2] },
        { type: "union", unionId: 2, personIds: [2, 1] },
        { type: "filiation", filiationId: 3, parentId: 99, childId: 1, role: "biologique" },
      ],
    };

    expect(selectPersonRelations(tree, 1)).toEqual({
      parents: [],
      partners: [{ person: partner, role: "Partenaire" }],
      children: [],
    });
  });
});
