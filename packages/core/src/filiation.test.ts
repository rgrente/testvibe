import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "@testvibe/db";
import { createTestDb } from "./test-utils.js";
import { createPerson } from "./person.js";
import {
  createFiliations,
  createFiliation,
  getFiliationById,
  listFiliations,
  updateFiliation,
  deleteFiliation,
} from "./filiation.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { sql } from "drizzle-orm";

describe("Filiation CRUD", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("crée une Filiation nominale (rôle biologique) et la relit par id", async () => {
    const parent = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const child = await createPerson(db, { firstName: "Byron", lastName: "King" });

    const created = await createFiliation(db, {
      parentId: parent.id,
      childId: child.id,
      role: "biologique",
    });
    expect(created.role).toBe("biologique");

    const fetched = await getFiliationById(db, created.id);
    expect(fetched).toEqual(created);
  });

  it("liste toutes les Filiation créées", async () => {
    const parent = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const child = await createPerson(db, { firstName: "Byron", lastName: "King" });
    await createFiliation(db, { parentId: parent.id, childId: child.id, role: "adopte" });
    const all = await listFiliations(db);
    expect(all).toHaveLength(1);
    expect(all[0].role).toBe("adopte");
  });

  it("met à jour le rôle d'une Filiation existante", async () => {
    const parent = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const child = await createPerson(db, { firstName: "Byron", lastName: "King" });
    const created = await createFiliation(db, {
      parentId: parent.id,
      childId: child.id,
      role: "biologique",
    });
    const updated = await updateFiliation(db, created.id, { role: "beau-parent" });
    expect(updated.role).toBe("beau-parent");
  });

  it("supprime une Filiation existante", async () => {
    const parent = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const child = await createPerson(db, { firstName: "Byron", lastName: "King" });
    const created = await createFiliation(db, {
      parentId: parent.id,
      childId: child.id,
      role: "biologique",
    });
    await deleteFiliation(db, created.id);
    await expect(getFiliationById(db, created.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejette la lecture d'une Filiation inexistante (NotFoundError)", async () => {
    await expect(getFiliationById(db, 9999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejette la création avec un parentId inexistant (ValidationError)", async () => {
    const child = await createPerson(db, { firstName: "Byron", lastName: "King" });
    await expect(
      createFiliation(db, { parentId: 9999, childId: child.id, role: "biologique" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejette la création avec un childId inexistant (ValidationError)", async () => {
    const parent = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    await expect(
      createFiliation(db, { parentId: parent.id, childId: 9999, role: "biologique" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejette parentId === childId (ValidationError)", async () => {
    const p = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    await expect(
      createFiliation(db, { parentId: p.id, childId: p.id, role: "biologique" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("création de filiations par lot", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  async function persons(count: number) {
    return Promise.all(
      Array.from({ length: count }, (_, index) =>
        createPerson(db, { firstName: `P${index}`, lastName: "Test" }),
      ),
    );
  }

  it.each([
    [1, 1, 1],
    [1, 3, 3],
    [2, 1, 2],
    [2, 3, 6],
  ])("crée le produit cartésien %sx%s (%s liens)", async (parentCount, childCount, expected) => {
    const all = await persons(parentCount + childCount);
    const created = await createFiliations(db, {
      parentIds: all.slice(0, parentCount).map((p) => p.id),
      childIds: all.slice(parentCount).map((p) => p.id),
      role: "biologique",
    });
    expect(created).toHaveLength(expected);
    expect(await listFiliations(db)).toHaveLength(expected);
  });

  it.each([
    [[], [1], "zéro parent"],
    [[1, 2, 3], [4], "plus de deux parents"],
    [[1], [], "zéro enfant"],
    [[1, 1], [2], "parents dupliqués"],
    [[1], [2, 2], "enfants dupliqués"],
    [[1], [1], "chevauchement"],
  ])("rejette les cardinalités ou identifiants invalides (%s / %s : %s)", async (parentIds, childIds) => {
    await expect(
      createFiliations(db, { parentIds, childIds, role: "biologique" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await listFiliations(db)).toHaveLength(0);
  });

  it("rejette un rôle invalide et les personnes inexistantes", async () => {
    const [parent, child] = await persons(2);
    await expect(
      createFiliations(db, {
        parentIds: [parent.id],
        childIds: [child.id],
        role: "invalide" as never,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createFiliations(db, { parentIds: [parent.id], childIds: [9999], role: "adopte" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejette un couple déjà existant", async () => {
    const [parent, child] = await persons(2);
    await createFiliation(db, { parentId: parent.id, childId: child.id, role: "biologique" });
    await expect(
      createFiliations(db, { parentIds: [parent.id], childIds: [child.id], role: "adopte" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await listFiliations(db)).toHaveLength(1);
  });

  it("rejette un cycle induit par le lot complet", async () => {
    const [a, b, c] = await persons(3);
    await createFiliation(db, { parentId: a.id, childId: b.id, role: "biologique" });
    await createFiliation(db, { parentId: b.id, childId: c.id, role: "biologique" });
    await expect(
      createFiliations(db, { parentIds: [c.id], childIds: [a.id], role: "biologique" }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await listFiliations(db)).toHaveLength(2);
  });

  it("annule les liens précédents si une écriture tardive échoue", async () => {
    const [parent, child1, child2] = await persons(3);
    await db.run(sql.raw(
      `CREATE TRIGGER fail_second_filiation BEFORE INSERT ON filiation
       WHEN NEW.child_id = ${child2.id} BEGIN SELECT RAISE(FAIL, 'échec simulé'); END`,
    ));
    await expect(
      createFiliations(db, {
        parentIds: [parent.id],
        childIds: [child1.id, child2.id],
        role: "beau-parent",
      }),
    ).rejects.toThrow("échec simulé");
    expect(await listFiliations(db)).toHaveLength(0);
  });
});
