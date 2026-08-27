/**
 * Tests unitaires pour event.ts (CRUD événements biographiques).
 * Phase 5, tâche #24.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./test-utils.js";
import type { Database } from "@testvibe/db";
import { createPerson } from "./person.js";
import {
  createEvent,
  deleteEvent,
  getEventById,
  listEventsByPerson,
  listFamilyTimeline,
  listMapLocations,
  updateEvent,
} from "./event.js";
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

  it("lève ValidationError pour une latitude hors bornes", async () => {
    const person = await createPerson(db, { firstName: "Eve", lastName: "Blanc" });
    await expect(
      createEvent(db, { personId: person.id, type: "naissance", latitude: 91 }),
    ).rejects.toThrow(ValidationError);
    await expect(
      createEvent(db, { personId: person.id, type: "naissance", latitude: -91 }),
    ).rejects.toThrow(ValidationError);
  });

  it("lève ValidationError pour une longitude hors bornes", async () => {
    const person = await createPerson(db, { firstName: "Eve", lastName: "Blanc" });
    await expect(
      createEvent(db, { personId: person.id, type: "naissance", longitude: 181 }),
    ).rejects.toThrow(ValidationError);
    await expect(
      createEvent(db, { personId: person.id, type: "naissance", longitude: -181 }),
    ).rejects.toThrow(ValidationError);
  });

  it("lève ValidationError pour des coordonnées non finies", async () => {
    const person = await createPerson(db, { firstName: "Eve", lastName: "Blanc" });
    await expect(
      createEvent(db, { personId: person.id, type: "naissance", latitude: Infinity }),
    ).rejects.toThrow(ValidationError);
    await expect(
      createEvent(db, { personId: person.id, type: "naissance", longitude: NaN }),
    ).rejects.toThrow(ValidationError);
  });

  it("accepte un événement avec lieu et coordonnées valides", async () => {
    const person = await createPerson(db, { firstName: "Geo", lastName: "Test" });
    const ev = await createEvent(db, {
      personId: person.id,
      type: "naissance",
      place: "  Paris, France  ",
      latitude: 48.8566,
      longitude: 2.3522,
    });
    expect(ev.place).toBe("Paris, France");
    expect(ev.latitude).toBeCloseTo(48.8566);
    expect(ev.longitude).toBeCloseTo(2.3522);
  });

  it("rejette des coordonnées incomplètes ou sans libellé de lieu", async () => {
    const person = await createPerson(db, { firstName: "Geo", lastName: "Test" });

    await expect(
      createEvent(db, {
        personId: person.id,
        type: "libre",
        place: "Paris",
        latitude: 48.8566,
      }),
    ).rejects.toThrow(ValidationError);
    await expect(
      createEvent(db, {
        personId: person.id,
        type: "libre",
        latitude: 48.8566,
        longitude: 2.3522,
      }),
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

describe("listFamilyTimeline", () => {
  it("charge les dates de naissance et de décès portées par les personnes", async () => {
    const ada = await createPerson(db, {
      firstName: "Ada",
      lastName: "Lovelace",
      birthDate: "1815-12-10",
      deathDate: "1852-11-27",
    });

    const timeline = await listFamilyTimeline(db);

    expect(
      timeline.map(({ event, person }) => ({
        type: event.type,
        eventDate: event.eventDate,
        personId: person.id,
      })),
    ).toEqual([
      { type: "naissance", eventDate: "1815-12-10", personId: ada.id },
      { type: "décès", eventDate: "1852-11-27", personId: ada.id },
    ]);
  });

  it("ne duplique pas une date biographique quand un événement sémantique existe", async () => {
    const ada = await createPerson(db, {
      firstName: "Ada",
      lastName: "Lovelace",
      birthDate: "1815-12-10",
      deathDate: "1852",
    });
    await createEvent(db, { personId: ada.id, type: "naissance" });
    await createEvent(db, {
      personId: ada.id,
      type: "décès",
      eventDate: "1852-11-27",
    });

    const timeline = await listFamilyTimeline(db);

    expect(timeline.map(({ event }) => ({ type: event.type, eventDate: event.eventDate }))).toEqual([
      { type: "naissance", eventDate: "1815-12-10" },
      { type: "décès", eventDate: "1852" },
    ]);
  });

  it("charge les événements de toutes les personnes dans un ordre chronologique déterministe", async () => {
    const alice = await createPerson(db, { firstName: "Alice", lastName: "Martin" });
    const bob = await createPerson(db, { firstName: "Bob", lastName: "Dupont" });
    const later = await createEvent(db, {
      personId: alice.id,
      type: "mariage",
      eventDate: "2010-06-15",
    });
    const firstSameDay = await createEvent(db, {
      personId: bob.id,
      type: "naissance",
      eventDate: "1985-03-10",
    });
    const secondSameDay = await createEvent(db, {
      personId: alice.id,
      type: "libre",
      label: "Diplôme",
      eventDate: "1985-03-10",
    });
    const undated = await createEvent(db, {
      personId: bob.id,
      type: "libre",
      label: "Déménagement",
    });

    const timeline = await listFamilyTimeline(db);

    expect(timeline.map(({ key }) => key)).toEqual([
      `event:${secondSameDay.id}`,
      `person:${bob.id}:naissance`,
      `event:${undated.id}`,
    ]);
    expect(timeline.map(({ person }) => person.firstName)).toEqual(["Alice", "Bob", "Bob"]);
  });

  it("départage de façon stable les événements de même date (naissance auto incluse)", async () => {
    const alice = await createPerson(db, {
      firstName: "Alice",
      lastName: "Martin",
      birthDate: "1985-03-10",
    });
    const bob = await createPerson(db, { firstName: "Bob", lastName: "Dupont" });
    // L'auto-sync crée un événement naissance réel dès la création de la Person.
    const [autoBirth] = await listEventsByPerson(db, alice.id);
    const sameDayEvent = await createEvent(db, {
      personId: bob.id,
      type: "libre",
      eventDate: "1985-03-10",
    });

    const timeline = await listFamilyTimeline(db);

    expect(timeline.map(({ key }) => key)).toEqual([
      `event:${sameDayEvent.id}`,
      `person:${alice.id}:naissance`,
    ]);
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

describe("listMapLocations", () => {
  it("retourne les événements avec coordonnées et lieu, personnes vivantes incluses", async () => {
    const alive = await createPerson(db, { firstName: "Vivant", lastName: "X" }); // pas de deathDate
    const dead = await createPerson(db, { firstName: "Mort", lastName: "Y", deathDate: "2000-01-01" });
    await createEvent(db, {
      personId: alive.id,
      type: "naissance",
      place: "Paris",
      latitude: 48.8,
      longitude: 2.3,
    });
    await createEvent(db, {
      personId: dead.id,
      type: "décès",
      place: "Lyon",
      latitude: 45.7,
      longitude: 4.8,
    });
    await createEvent(db, {
      personId: dead.id,
      type: "mariage",
      place: "Marseille",
      latitude: 43.3,
      longitude: 5.4,
    });
    // Événement sans coordonnées ni lieu (ignoré)
    await createEvent(db, {
      personId: dead.id,
      type: "libre",
      label: "Sans lieu",
    });

    const locations = await listMapLocations(db);
    expect(locations).toHaveLength(3);
    const places = locations.map((l) => l.event.place);
    expect(places).toContain("Paris");
    expect(places).toContain("Lyon");
    expect(places).toContain("Marseille");
    // Aucun lieu sans coordonnées
    expect(places).not.toContain("Sans lieu");
  });

  it("retourne un tableau vide si aucun événement n'a de coordonnées", async () => {
    const dead = await createPerson(db, { firstName: "Mort2", lastName: "Z", deathDate: "1990-01-01" });
    await createEvent(db, { personId: dead.id, type: "naissance", place: "Ville" });
    const locations = await listMapLocations(db);
    expect(locations).toHaveLength(0);
  });
});
