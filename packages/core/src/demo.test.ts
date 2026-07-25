import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "@testvibe/db";
import { createTestDb } from "./test-utils.js";
import { seedDemoFamily } from "./demo.js";
import { getFamilyTree } from "./tree.js";
import { listPersons } from "./person.js";
import { listUnions } from "./union.js";

describe("seedDemoFamily", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("crée un jeu de données de démonstration d'au moins 3 générations avec une union à plusieurs enfants", async () => {
    const { rootId } = await seedDemoFamily(db);

    const persons = await listPersons(db);
    expect(persons.length).toBeGreaterThanOrEqual(5);

    const unions = await listUnions(db);
    const unionWithManyChildren = unions.find((u) => u.personIds.length >= 2);
    expect(unionWithManyChildren).toBeDefined();

    const tree = await getFamilyTree(db, rootId);
    const generations = new Set(tree.nodes.map((n) => n.generation));
    // 3 générations distinctes minimum (ex. -1, 0, 1).
    expect(generations.size).toBeGreaterThanOrEqual(3);

    // Au moins une union du jeu de données a 3 enfants ou plus rattachés.
    const filiationEdges = tree.edges.filter((e) => e.type === "filiation");
    const childrenByParent = new Map<number, Set<number>>();
    for (const edge of filiationEdges) {
      if (edge.type !== "filiation") continue;
      if (!childrenByParent.has(edge.parentId)) childrenByParent.set(edge.parentId, new Set());
      childrenByParent.get(edge.parentId)!.add(edge.childId);
    }
    const maxChildrenForOneParent = Math.max(
      0,
      ...Array.from(childrenByParent.values()).map((set) => set.size),
    );
    expect(maxChildrenForOneParent).toBeGreaterThanOrEqual(3);
  });

  it("est idempotent-safe : peut être appelé sur une base fraîche sans lever d'erreur", async () => {
    await expect(seedDemoFamily(db)).resolves.toBeDefined();
  });
});
