import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "@testvibe/db";
import { createTestDb } from "./test-utils.js";
import { createPerson, getPersonById, listPersons, updatePerson, deletePerson } from "./person.js";
import { NotFoundError, ValidationError } from "./errors.js";

describe("Person CRUD", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("crée une Person nominale et la relit par id", async () => {
    const created = await createPerson(db, {
      firstName: "Ada",
      lastName: "Lovelace",
      birthDate: "1815-12-10",
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.firstName).toBe("Ada");
    expect(created.deathDate).toBeNull();

    const fetched = await getPersonById(db, created.id);
    expect(fetched).toEqual(created);
  });

  it("liste toutes les Person créées", async () => {
    await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    await createPerson(db, { firstName: "Alan", lastName: "Turing" });
    const all = await listPersons(db);
    expect(all).toHaveLength(2);
    expect(all.map((p) => p.firstName).sort()).toEqual(["Ada", "Alan"]);
  });

  it("met à jour une Person existante (mise à jour partielle)", async () => {
    const created = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    const updated = await updatePerson(db, created.id, { deathDate: "1852-11-27" });
    expect(updated.deathDate).toBe("1852-11-27");
    expect(updated.firstName).toBe("Ada"); // inchangé
  });

  it("persiste puis efface un nom de naissance optionnel", async () => {
    const created = await createPerson(db, {
      firstName: "Simone",
      lastName: "Signoret",
      birthName: "Kaminker",
    });
    expect(created.birthName).toBe("Kaminker");
    expect((await getPersonById(db, created.id)).birthName).toBe("Kaminker");
    expect((await updatePerson(db, created.id, { birthName: null })).birthName).toBeNull();
  });

  it("normalise un nom de naissance vide en valeur absente", async () => {
    const created = await createPerson(db, {
      firstName: "Marie",
      lastName: "Curie",
      birthName: "   ",
    });
    expect(created.birthName).toBeNull();
  });

  it("supprime une Person existante", async () => {
    const created = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    await deletePerson(db, created.id);
    await expect(getPersonById(db, created.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejette la lecture d'une Person inexistante (NotFoundError)", async () => {
    await expect(getPersonById(db, 9999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejette la création sans firstName (ValidationError)", async () => {
    await expect(
      createPerson(db, { firstName: "", lastName: "Lovelace" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejette une deathDate antérieure à birthDate (ValidationError)", async () => {
    await expect(
      createPerson(db, {
        firstName: "Ada",
        lastName: "Lovelace",
        birthDate: "1900-01-01",
        deathDate: "1899-01-01",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
