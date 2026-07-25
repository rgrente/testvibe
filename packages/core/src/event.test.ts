/**
 * Tests unitaires pour event.ts (CRUD événements biographiques).
 * Phase 5, tâche #24.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./test-utils.js";
import type { Database } from "@testvibe/db";
import { createPerson } from "./person.js";
import { createEvent, getEventById, listEventsByPerson, updateEvent, deleteEvent } from "./event.js";
import { NotFoundError, ValidationError } from "./errors.js";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("createEvent", () => {
  it("crée un événement lié à une personne", async () => {
    const person = await createPerson(db, { firstName: "Alice", lastName: "Martin" });
    const ev = await createEvent(db, {
      personId: person.id,
      type: "naissance",
      eventDate: "1990-05-20",
      description: "Naissance à Paris",
    });
    expect(ev.id).toBeGreaterThan(0);
    expect(ev.personId).toBe(person.id);
    expect(ev.type).toBe("naissance");
    expect(ev.eventDate).toBe("1990-05-20");
    expect(ev.description).toBe("Naissance à Paris");
    expect(ev.unionId).toBeNull();
    expect(ev.label).toBeNull();
  });

  it("accepte un événement libre avec label", async () => {
    const person = await createPerson(db, { firstName: "Bob", lastName: "Dupont" });
    const ev = await createEvent(db, {
      personId: person.id,
      type: "libre",
      label: "Voyage en Asie",
    });
    expect(ev.type).toBe("libre");
    expect(ev.label).toBe("Voyage en Asie");
    expect(ev.eventDate).toBeNull();
  });

  it("lève ValidationError pour un type invalide", async () => {
    const person = await createPerson(db, { firstName: "Eve", lastName: "Blanc" });
    await expect(
      createEvent(db, { personId: person.id, type: "inconnu" as never }),
    ).rejects.toThrow(ValidationError);
  });

  it("lève ValidationError pour une date invalide", async () => {
    const person = await createPerson(db, { firstName: "Eve", lastName: "Blanc" });
    await expect(
      createEvent(db, { personId: person.id, type: "naissance", eventDate: "pas-une-date" }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("getEventById", () => {
  it("retrouve un événement par son id", async () => {
    const person = await createPerson(db, { firstName: "Alice", lastName: "Martin" });
    const ev = await createEvent(db, { personId: person.id, type: "décès", eventDate: "2020-01-01" });
    const fetched = await getEventById(db, ev.id);
    expect(fetched).toEqual(ev);
  });

  it("lève NotFoundError si inexistant", async () => {
    await expect(getEventById(db, 9999)).rejects.toThrow(NotFoundError);
  });
});

describe("listEventsByPerson", () => {
  it("retourne les événements triés chronologiquement", async () => {
    const person = await createPerson(db, { firstName: "Charles", lastName: "Dup" });
    await createEvent(db, { personId: person.id, type: "mariage", eventDate: "2010-06-15" });
    await createEvent(db, { personId: person.id, type: "naissance", eventDate: "1985-03-10" });
    await createEvent(db, { personId: person.id, type: "libre", label: "Retraite" });

    const events = await listEventsByPerson(db, person.id);
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("naissance");
    expect(events[1].type).toBe("mariage");
    expect(events[2].type).toBe("libre"); // null date → fin
  });

  it("retourne un tableau vide si la personne n'a pas d'événements", async () => {
    const person = await createPerson(db, { firstName: "Diane", lastName: "X" });
    const events = await listEventsByPerson(db, person.id);
    expect(events).toHaveLength(0);
  });
});

describe("updateEvent", () => {
  it("met à jour la description d'un événement", async () => {
    const person = await createPerson(db, { firstName: "Eva", lastName: "Z" });
    const ev = await createEvent(db, { personId: person.id, type: "libre", label: "Voyage" });
    const updated = await updateEvent(db, ev.id, { description: "Voyage en Espagne" });
    expect(updated.description).toBe("Voyage en Espagne");
    expect(updated.label).toBe("Voyage"); // inchangé
  });
});

describe("deleteEvent", () => {
  it("supprime un événement", async () => {
    const person = await createPerson(db, { firstName: "Fred", lastName: "Y" });
    const ev = await createEvent(db, { personId: person.id, type: "naissance" });
    await deleteEvent(db, ev.id);
    await expect(getEventById(db, ev.id)).rejects.toThrow(NotFoundError);
  });
});
