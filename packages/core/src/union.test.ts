import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "@testvibe/db";
import { createTestDb } from "./test-utils.js";
import { createPerson } from "./person.js";
import { createUnion, getUnionById, listUnions, updateUnion, deleteUnion } from "./union.js";
import { NotFoundError, ValidationError } from "./errors.js";

describe("Union CRUD", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("crée une Union nominale liant deux Person et la relit par id", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const b = await createPerson(db, { firstName: "William", lastName: "King" });

    const created = await createUnion(db, {
      startDate: "1835-07-08",
      personIds: [a.id, b.id],
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.personIds.sort()).toEqual([a.id, b.id].sort());

    const fetched = await getUnionById(db, created.id);
    expect(fetched.personIds.sort()).toEqual([a.id, b.id].sort());
  });

  it("liste toutes les Union créées", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const b = await createPerson(db, { firstName: "William", lastName: "King" });
    await createUnion(db, { personIds: [a.id, b.id] });
    const all = await listUnions(db);
    expect(all).toHaveLength(1);
  });

  it("met à jour la liste de personIds d'une Union", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const b = await createPerson(db, { firstName: "William", lastName: "King" });
    const c = await createPerson(db, { firstName: "Someone", lastName: "Else" });

    const created = await createUnion(db, { personIds: [a.id, b.id] });
    const updated = await updateUnion(db, created.id, { personIds: [a.id, c.id] });
    expect(updated.personIds.sort()).toEqual([a.id, c.id].sort());
  });

  it("supprime une Union existante", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const b = await createPerson(db, { firstName: "William", lastName: "King" });
    const created = await createUnion(db, { personIds: [a.id, b.id] });
    await deleteUnion(db, created.id);
    await expect(getUnionById(db, created.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejette la lecture d'une Union inexistante (NotFoundError)", async () => {
    await expect(getUnionById(db, 9999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejette la création d'une Union référençant une Person inexistante (ValidationError)", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    await expect(
      createUnion(db, { personIds: [a.id, 9999] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejette la création d'une Union sans personIds (ValidationError)", async () => {
    await expect(createUnion(db, { personIds: [] })).rejects.toBeInstanceOf(ValidationError);
  });
});
