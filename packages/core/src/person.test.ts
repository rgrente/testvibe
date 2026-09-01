import { describe, it, expect, beforeEach } from "vitest";
import { genealogicalDate, type Database } from "@testvibe/db";
import { createTestDb, genealogyState } from "./test-utils.js";
import { createPerson, getPersonById, listPersons, updatePerson, deletePerson } from "./person.js";
import { createEvent, listEventsByPerson } from "./event.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { sql } from "drizzle-orm";

describe("Person CRUD", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("persiste une date qualifiée et rejette une date grégorienne impossible sans écriture", async () => {
    const created = await createPerson(db, { firstName: "Ada", lastName: "Lovelace", birthDate: "vers 1815" });
    expect((await getPersonById(db, created.id)).birthDate).toBe("vers 1815");
    expect(await db.select().from(genealogicalDate)).toEqual(expect.arrayContaining([expect.objectContaining({
      ownerKind: "person", ownerId: created.id, field: "birth_date", original: "vers 1815",
      qualification: "about", precision: "year", lowerBound: "1814-01-01", upperBound: "1816-12-31",
    })]));
    const before = await listPersons(db);
    await expect(createPerson(db, { firstName: "X", lastName: "Y", birthDate: "1950-02-30" })).rejects.toBeInstanceOf(ValidationError);
    expect(await listPersons(db)).toEqual(before);
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

  it("conserve une qualification legacy tant que la date n'est pas explicitement validée", async () => {
    const created = await createPerson(db, {
      firstName: "Legacy",
      lastName: "Person",
      birthDate: "1950-01-01",
    });
    await db.update(genealogicalDate).set({ qualification: "legacy_unresolved" });

    const updated = await updatePerson(db, created.id, { firstName: "Renamed" });

    expect(updated.birthDateQualification).toBe("legacy_unresolved");
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

  it("persiste et valide le statut de vie et la visibilité", async () => {
    const created = await createPerson(db, {
      firstName: "Marie",
      lastName: "Curie",
      livingStatus: "deceased",
      visibility: "private",
    });
    expect(created).toMatchObject({ livingStatus: "deceased", visibility: "private" });
    await expect(createPerson(db, {
      firstName: "Valeur",
      lastName: "Invalide",
      livingStatus: "unknown" as never,
    })).rejects.toBeInstanceOf(ValidationError);
    await expect(updatePerson(db, created.id, { visibility: "shared" as never }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it("rend publique par défaut une Person sans visibilité explicite", async () => {
    const created = await createPerson(db, { firstName: "Publique", lastName: "Défaut" });
    expect(created.visibility).toBe("public");
  });

  it("supprime une Person existante", async () => {
    const created = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    await deletePerson(db, created.id);
    await expect(getPersonById(db, created.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("supprime atomiquement les métadonnées des événements cascadés", async () => {
    const created = await createPerson(db, {
      firstName: "Ada",
      lastName: "Lovelace",
      birthDate: "1815-12-10",
    });

    await deletePerson(db, created.id);

    expect(await db.select().from(genealogicalDate)).toEqual([]);
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

describe("Auto-sync naissance/décès (syncBiographicalEvents)", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it.each(["naissance", "décès"] as const)(
    "annule exactement la création si l'écriture de l'événement %s échoue",
    async (eventType) => {
    const before = await genealogyState(db);
    await db.run(sql.raw(`CREATE TRIGGER fail_person_event BEFORE INSERT ON event
      WHEN NEW.type = '${eventType}' BEGIN SELECT RAISE(FAIL, 'échec événement'); END`));
    await expect(createPerson(db, {
      firstName: "Atomic",
      lastName: "Create",
      birthDate: "2000-01-01",
      deathDate: "2020-01-01",
    })).rejects.toThrow();
    expect(await genealogyState(db)).toEqual(before);
    },
  );

  it.each(["naissance", "décès"] as const)(
    "annule exactement la mise à jour si l'écriture de l'événement %s échoue",
    async (eventType) => {
    const created = await createPerson(db, {
      firstName: "Atomic",
      lastName: "Update",
      birthDate: "2000-01-01",
      deathDate: "2020-01-01",
    });
    const before = await genealogyState(db);
    await db.run(sql.raw(`CREATE TRIGGER fail_person_event_update BEFORE UPDATE ON event
      WHEN NEW.type = '${eventType}' BEGIN SELECT RAISE(FAIL, 'échec événement'); END`));
    await expect(updatePerson(db, created.id, {
      birthDate: "2001-01-01",
      deathDate: "2021-01-01",
    })).rejects.toThrow();
    expect(await genealogyState(db)).toEqual(before);
    },
  );

  it("crée automatiquement un événement naissance et décès pour une Person datée", async () => {
    const person = await createPerson(db, {
      firstName: "Ada",
      lastName: "Lovelace",
      birthDate: "1815-12-10",
      deathDate: "1852-11-27",
    });

    const events = await listEventsByPerson(db, person.id);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.type).sort()).toEqual(["décès", "naissance"]);
    const birth = events.find((e) => e.type === "naissance");
    const death = events.find((e) => e.type === "décès");
    expect(birth?.eventDate).toBe("1815-12-10");
    expect(death?.eventDate).toBe("1852-11-27");
  });

  it("ne crée aucun événement pour une Person sans date", async () => {
    const person = await createPerson(db, { firstName: "Diane", lastName: "X" });
    expect(await listEventsByPerson(db, person.id)).toHaveLength(0);
  });

  it("ne crée qu'un seul événement si une date seule est présente", async () => {
    const person = await createPerson(db, {
      firstName: "Alan",
      lastName: "Turing",
      birthDate: "1912-06-23",
    });
    const events = await listEventsByPerson(db, person.id);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("naissance");
  });

  it("synchronise la date de l'événement quand la Person est mise à jour (idempotent, sans doublon)", async () => {
    const person = await createPerson(db, {
      firstName: "Ada",
      lastName: "Lovelace",
      birthDate: "1815-12-10",
    });
    expect(await listEventsByPerson(db, person.id)).toHaveLength(1);

    // Mise à jour de la date de naissance → l'événement suit, sans doublon.
    await updatePerson(db, person.id, { birthDate: "1815-12-12" });
    const events = await listEventsByPerson(db, person.id);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("naissance");
    expect(events[0].eventDate).toBe("1815-12-12");
  });

  it("crée l'événement lorsqu'une date est ajoutée à une Person sans date", async () => {
    const person = await createPerson(db, { firstName: "Marie", lastName: "Curie" });
    expect(await listEventsByPerson(db, person.id)).toHaveLength(0);

    await updatePerson(db, person.id, { deathDate: "1934-07-04" });
    const events = await listEventsByPerson(db, person.id);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("décès");
    expect(events[0].eventDate).toBe("1934-07-04");
  });

  it("ne duplique pas quand un événement manuel du même type existe déjà", async () => {
    const person = await createPerson(db, { firstName: "Ada", lastName: "Lovelace" });
    // Un événement naissance manuel (saisi en admin) préexiste, sans date Person.
    await createEvent(db, { personId: person.id, type: "naissance", place: "Londres" });
    expect((await listEventsByPerson(db, person.id)).filter((e) => e.type === "naissance")).toHaveLength(1);

    // On renseigne ensuite la date de naissance : l'auto-sync doit mettre à jour
    // l'événement existant, jamais en créer un second.
    await updatePerson(db, person.id, { birthDate: "1815-12-10" });
    const naissances = (await listEventsByPerson(db, person.id)).filter(
      (e) => e.type === "naissance",
    );
    expect(naissances).toHaveLength(1);
    expect(naissances[0].eventDate).toBe("1815-12-10");
    expect(naissances[0].place).toBe("Londres"); // le lieu saisi est conservé
  });
});
