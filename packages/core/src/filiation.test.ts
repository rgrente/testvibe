import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "@testvibe/db";
import { createTestDb } from "./test-utils.js";
import { createPerson } from "./person.js";
import {
  createFiliation,
  getFiliationById,
  listFiliations,
  updateFiliation,
  deleteFiliation,
} from "./filiation.js";
import { NotFoundError, ValidationError } from "./errors.js";

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
