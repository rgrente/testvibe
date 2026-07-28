import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "@testvibe/db";
import { createTestDb } from "./test-utils.js";
import { createPerson } from "./person.js";
import { createUnion } from "./union.js";
import { createFiliation } from "./filiation.js";
import { getFamilyTree } from "./tree.js";
import { NotFoundError } from "./errors.js";

describe("getFamilyTree", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("construit un arbre à une seule Person quand la racine n'a aucune relation", async () => {
    const root = await createPerson(db, { firstName: "Solo", lastName: "Racine" });

    const tree = await getFamilyTree(db, root.id);

    expect(tree.rootId).toBe(root.id);
    expect(tree.nodes).toEqual([{ person: root, generation: 0 }]);
    expect(tree.edges).toEqual([]);
  });

  it("inclut les ascendants et descendants sur 3 générations", async () => {
    const grandParent = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const parent = await createPerson(db, { firstName: "Byron", lastName: "King" });
    const child = await createPerson(db, { firstName: "Anne", lastName: "King" });

    const gpToParent = await createFiliation(db, {
      parentId: grandParent.id,
      childId: parent.id,
      role: "biologique",
    });
    const parentToChild = await createFiliation(db, {
      parentId: parent.id,
      childId: child.id,
      role: "biologique",
    });

    const tree = await getFamilyTree(db, parent.id);

    expect(tree.rootId).toBe(parent.id);
    const byId = new Map(tree.nodes.map((n) => [n.person.id, n.generation]));
    expect(byId.get(grandParent.id)).toBe(-1);
    expect(byId.get(parent.id)).toBe(0);
    expect(byId.get(child.id)).toBe(1);
    expect(tree.nodes).toHaveLength(3);

    expect(tree.edges).toEqual(
      expect.arrayContaining([
        {
          type: "filiation",
          filiationId: gpToParent.id,
          parentId: grandParent.id,
          childId: parent.id,
          role: "biologique",
        },
        {
          type: "filiation",
          filiationId: parentToChild.id,
          parentId: parent.id,
          childId: child.id,
          role: "biologique",
        },
      ]),
    );
    expect(tree.edges).toHaveLength(2);
  });

  it("inclut le partenaire d'union et tous les enfants d'une union avec plusieurs enfants", async () => {
    const parentA = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const parentB = await createPerson(db, { firstName: "William", lastName: "King" });
    const child1 = await createPerson(db, { firstName: "Byron", lastName: "King" });
    const child2 = await createPerson(db, { firstName: "Anne", lastName: "King" });
    const child3 = await createPerson(db, { firstName: "Ralph", lastName: "King" });
    const unrelatedChild = await createPerson(db, {
      firstName: "Hors",
      lastName: "Branche",
    });

    const union = await createUnion(db, { personIds: [parentA.id, parentB.id] });
    await createFiliation(db, { parentId: parentA.id, childId: child1.id, role: "biologique" });
    await createFiliation(db, { parentId: parentB.id, childId: child1.id, role: "biologique" });
    await createFiliation(db, { parentId: parentA.id, childId: child2.id, role: "biologique" });
    await createFiliation(db, { parentId: parentB.id, childId: child2.id, role: "biologique" });
    await createFiliation(db, { parentId: parentA.id, childId: child3.id, role: "biologique" });
    await createFiliation(db, { parentId: parentB.id, childId: child3.id, role: "biologique" });
    await createFiliation(db, {
      parentId: parentB.id,
      childId: unrelatedChild.id,
      role: "biologique",
    });

    const tree = await getFamilyTree(db, parentA.id);

    const byId = new Map(tree.nodes.map((n) => [n.person.id, n.generation]));
    expect(byId.get(parentA.id)).toBe(0);
    expect(byId.get(parentB.id)).toBe(0); // partenaire d'union, même génération
    expect(byId.get(child1.id)).toBe(1);
    expect(byId.get(child2.id)).toBe(1);
    expect(byId.get(child3.id)).toBe(1);
    expect(byId.has(unrelatedChild.id)).toBe(false);
    expect(tree.nodes).toHaveLength(5);

    expect(tree.edges).toContainEqual({
      type: "union",
      unionId: union.id,
      personIds: expect.arrayContaining([parentA.id, parentB.id]),
    });
    const filiationEdges = tree.edges.filter((e) => e.type === "filiation");
    expect(filiationEdges).toHaveLength(6);
  });

  it("inclut les frères et sœurs via tous les types de filiation, sans duplication", async () => {
    const grandParent = await createPerson(db, { firstName: "Grand", lastName: "Parent" });
    const parent = await createPerson(db, { firstName: "Parent", lastName: "Commun" });
    const otherParent = await createPerson(db, { firstName: "Autre", lastName: "Parent" });
    const root = await createPerson(db, { firstName: "Mathilde", lastName: "Famille" });
    const adoptedSibling = await createPerson(db, { firstName: "Maxime", lastName: "Famille" });
    const stepSibling = await createPerson(db, { firstName: "Léni", lastName: "Famille" });
    const child = await createPerson(db, { firstName: "Petit", lastName: "Enfant" });

    await createFiliation(db, { parentId: grandParent.id, childId: parent.id, role: "biologique" });
    await createFiliation(db, { parentId: parent.id, childId: root.id, role: "biologique" });
    await createFiliation(db, { parentId: otherParent.id, childId: root.id, role: "biologique" });
    await createFiliation(db, { parentId: parent.id, childId: adoptedSibling.id, role: "adopte" });
    await createFiliation(db, { parentId: parent.id, childId: adoptedSibling.id, role: "beau-parent" });
    await createFiliation(db, { parentId: otherParent.id, childId: adoptedSibling.id, role: "biologique" });
    await createFiliation(db, { parentId: parent.id, childId: stepSibling.id, role: "beau-parent" });
    await createFiliation(db, { parentId: root.id, childId: child.id, role: "biologique" });

    const tree = await getFamilyTree(db, root.id);
    const byId = new Map(tree.nodes.map((node) => [node.person.id, node.generation]));

    expect(byId.get(grandParent.id)).toBe(-2);
    expect(byId.get(parent.id)).toBe(-1);
    expect(byId.get(otherParent.id)).toBe(-1);
    expect(byId.get(root.id)).toBe(0);
    expect(byId.get(adoptedSibling.id)).toBe(0);
    expect(byId.get(stepSibling.id)).toBe(0);
    expect(byId.get(child.id)).toBe(1);
    expect(tree.nodes.filter((node) => node.person.id === adoptedSibling.id)).toHaveLength(1);
    expect(tree.rootId).toBe(root.id);
    expect(tree.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ parentId: parent.id, childId: adoptedSibling.id, role: "adopte" }),
      expect.objectContaining({ parentId: parent.id, childId: adoptedSibling.id, role: "beau-parent" }),
    ]));
  });

  it("ne crée aucun frère ou sœur quand la racine est enfant unique", async () => {
    const parent = await createPerson(db, { firstName: "Parent", lastName: "Unique" });
    const root = await createPerson(db, { firstName: "Solo", lastName: "Racine" });
    await createFiliation(db, { parentId: parent.id, childId: root.id, role: "biologique" });

    const tree = await getFamilyTree(db, root.id);

    expect(tree.nodes.map((node) => node.person.id)).toEqual([root.id, parent.id]);
    expect(tree.nodes.filter((node) => node.generation === 0).map((node) => node.person.id)).toEqual([root.id]);
  });

  it("lève NotFoundError si la Person racine n'existe pas", async () => {
    await expect(getFamilyTree(db, 9999)).rejects.toBeInstanceOf(NotFoundError);
  });
});
