import { describe, it, expect, beforeEach } from "vitest";
import { genealogicalDate, type Database } from "@testvibe/db";
import { createTestDb, genealogyState } from "./test-utils.js";
import { createPerson } from "./person.js";
import { createUnion, getUnionById, listUnions, updateUnion, deleteUnion } from "./union.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { sql } from "drizzle-orm";

describe("Union CRUD", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("persiste un intervalle qualifié et rejette un intervalle inversé", async () => {
    const person = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const created = await createUnion(db, { personIds: [person.id], startDate: "entre 1950 et 1952" });
    expect((await getUnionById(db, created.id)).startDate).toBe("entre 1950 et 1952");
    await expect(updateUnion(db, created.id, { startDate: "entre 1952 et 1950" })).rejects.toBeInstanceOf(ValidationError);
    expect((await getUnionById(db, created.id)).startDate).toBe("entre 1950 et 1952");
  });

  it("relit les bornes migrées et les conserve lors d'une modification sans date", async () => {
    const person = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const created = await createUnion(db, {
      type: "mariage",
      personIds: [person.id],
      startDate: "1950-01-01",
    });
    await db.update(genealogicalDate).set({ qualification: "legacy_unresolved" });

    const updated = await updateUnion(db, created.id, { place: "Paris" });

    expect(updated).toMatchObject({
      startDateQualification: "legacy_unresolved",
      startDatePrecision: "day",
      startDateLowerBound: "1950-01-01",
      startDateUpperBound: "1950-01-01",
    });
  });

  it.each([
    ["union", "AFTER INSERT ON unions"],
    ["partenaires", "BEFORE INSERT ON union_partner"],
  ])("annule exactement la création après l'étape %s", async (_step, triggerBoundary) => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const before = await genealogyState(db);
    await db.run(sql.raw(`CREATE TRIGGER fail_union_create ${triggerBoundary}
      BEGIN SELECT RAISE(FAIL, 'échec union'); END`));
    await expect(createUnion(db, { personIds: [a.id] })).rejects.toThrow();
    expect(await genealogyState(db)).toEqual(before);
  });

  it.each([
    ["union", "AFTER UPDATE ON unions"],
    ["suppression des partenaires", "AFTER DELETE ON union_partner"],
    ["ajout des partenaires", "BEFORE INSERT ON union_partner"],
  ])("annule exactement la mise à jour après l'étape %s", async (_step, triggerBoundary) => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const b = await createPerson(db, { firstName: "William", lastName: "King" });
    const created = await createUnion(db, { type: "libre", personIds: [a.id] });
    const before = await genealogyState(db);
    await db.run(sql.raw(`CREATE TRIGGER fail_union_update ${triggerBoundary}
      BEGIN SELECT RAISE(FAIL, 'échec union'); END`));
    await expect(updateUnion(db, created.id, { type: "mariage", personIds: [b.id] })).rejects.toThrow();
    expect(await genealogyState(db)).toEqual(before);
  });

  it("crée une Union nominale liant deux Person et la relit par id", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const b = await createPerson(db, { firstName: "William", lastName: "King" });

    const created = await createUnion(db, {
      type: "mariage",
      startDate: "1835-07-08",
      place: "Londres",
      latitude: 51.5074,
      longitude: -0.1278,
      personIds: [a.id, b.id],
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.personIds.sort()).toEqual([a.id, b.id].sort());
    expect(created).toMatchObject({
      type: "mariage",
      place: "Londres",
      latitude: 51.5074,
      longitude: -0.1278,
    });

    const fetched = await getUnionById(db, created.id);
    expect(fetched.personIds.sort()).toEqual([a.id, b.id].sort());
  });

  it("liste toutes les Union créées", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const b = await createPerson(db, { firstName: "William", lastName: "King" });
    await createUnion(db, { personIds: [a.id, b.id] });
    const all = await listUnions(db);
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe("libre");
  });

  it("met à jour la liste de personIds d'une Union", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const b = await createPerson(db, { firstName: "William", lastName: "King" });
    const c = await createPerson(db, { firstName: "Someone", lastName: "Else" });

    const created = await createUnion(db, { personIds: [a.id, b.id] });
    const updated = await updateUnion(db, created.id, {
      type: "pacs",
      place: "Paris",
      latitude: 48.8566,
      longitude: 2.3522,
      personIds: [a.id, c.id],
    });
    expect(updated.personIds.sort()).toEqual([a.id, c.id].sort());
    expect(updated).toMatchObject({ type: "pacs", place: "Paris" });
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

  it("rejette des coordonnées hors limites", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    await expect(createUnion(db, {
      personIds: [a.id],
      place: "Paris",
      latitude: 91,
      longitude: 2.3522,
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejette des coordonnées partielles ou sans lieu", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    await expect(createUnion(db, {
      personIds: [a.id],
      place: "Paris",
      latitude: 48.8566,
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(createUnion(db, {
      personIds: [a.id],
      place: "   ",
      latitude: 48.8566,
      longitude: 2.3522,
    })).rejects.toBeInstanceOf(ValidationError);
  });

  it("normalise les lieux vides", async () => {
    const a = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const created = await createUnion(db, { personIds: [a.id], place: "   " });
    expect(created.place).toBeNull();
  });
});
