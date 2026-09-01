import { describe, expect, it } from "vitest";
import { createTestDb } from "./test-utils.js";
import { createPerson } from "./person.js";
import { createEvent, listFamilyTimeline } from "./event.js";
import { createUnion } from "./union.js";
import { listComparativeTimeline } from "./comparative-timeline.js";
import { getFamilyStatistics } from "./statistics.js";
import { anniversariesForDate, upcomingFamilyAnniversaries } from "./anniversary.js";
import type { Event, Person, Union } from "./types.js";
import {
  countCanonicalFacts,
  formatFamilyDate,
  listCanonicalFamilyFacts,
  listCanonicalFactsByPerson,
  mapLocationsFromFacts,
  projectFamilyFacts,
} from "./projection.js";

const person = (id: number, overrides: Partial<Person> = {}): Person => ({
  id,
  firstName: `Personne ${id}`,
  lastName: "Test",
  birthName: null,
  birthDate: null,
  deathDate: null,
  gender: null,
  ...overrides,
});

const event = (
  id: number,
  personId: number,
  type: Event["type"],
  overrides: Partial<Event> = {},
): Event => ({
  id,
  personId,
  unionId: null,
  type,
  label: null,
  eventDate: null,
  description: null,
  place: null,
  latitude: null,
  longitude: null,
  ...overrides,
});

const union = (id: number, type: Union["type"], personIds: number[], overrides: Partial<Union> = {}): Union => ({
  id,
  type,
  personIds,
  startDate: null,
  endDate: null,
  place: null,
  latitude: null,
  longitude: null,
  ...overrides,
});

describe("projectFamilyFacts", () => {
  it("applique la taxonomie, les propriétaires et les cardinalités canoniques", () => {
    const persons = [person(1, { birthDate: "1980" }), person(2)];
    const unions = [
      union(10, "mariage", [1, 2], { startDate: "2000-01-01" }),
      union(11, "pacs", [1, 2], { startDate: "2010-02" }),
      union(12, "libre", [1, 2]),
    ];
    const events = [
      event(20, 1, "résidence", { place: "Lyon" }),
      event(21, 1, "libre", { label: "Voyage" }),
    ];

    expect(projectFamilyFacts(persons, unions, events).map((fact) => ({
      identity: fact.identity,
      category: fact.category,
      owner: fact.owner,
      personIds: fact.personIds,
    }))).toEqual([
      { identity: "person:1:naissance", category: "naissance", owner: "person:1", personIds: [1] },
      { identity: "union:10", category: "mariage", owner: "union:10", personIds: [1, 2] },
      { identity: "union:11", category: "pacs", owner: "union:11", personIds: [1, 2] },
      { identity: "event:20", category: "résidence", owner: "person:1", personIds: [1] },
      { identity: "event:21", category: "libre", owner: "person:1", personIds: [1] },
      { identity: "union:12", category: "union libre", owner: "union:12", personIds: [1, 2] },
    ]);
  });

  it("enrichit les singletons depuis le plus petit id tout en gardant Person prioritaire", () => {
    const facts = projectFamilyFacts(
      [person(1, { birthDate: "1980-05" })],
      [],
      [
        event(8, 1, "naissance", { eventDate: "1981", place: "Lyon" }),
        event(4, 1, "naissance", { eventDate: "1979", place: "Paris", description: "Acte" }),
      ],
    );

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      identity: "person:1:naissance",
      date: "1980-05",
      place: "Paris",
      description: "Acte",
      source: "person",
      sourceEventId: 4,
    });
    expect(facts[0].conflicts.map((item) => item.id)).toEqual([4, 8]);
  });

  it("adapte l'historique résidence sans label magique chez les consommateurs et déduplique", () => {
    const facts = projectFamilyFacts(
      [person(1)],
      [],
      [
        event(9, 1, "libre", { label: " Résidence ", eventDate: "2000", place: " Lyon " }),
        event(5, 1, "résidence", { label: null, eventDate: "2000", place: "lyon" }),
        event(3, 1, "libre", { label: "résidence", eventDate: "2000", place: "Lyon" }),
      ],
    );

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      identity: "event:5",
      category: "résidence",
      source: "event",
      sourceEventId: 5,
    });
  });

  it("trie les dates partielles par début d'intervalle, précision, catégorie et identité", () => {
    const facts = projectFamilyFacts(
      [person(1), person(2), person(3), person(4), person(5)],
      [],
      [
        event(5, 5, "libre"),
        event(4, 4, "libre", { eventDate: "2000-02" }),
        event(3, 3, "libre", { eventDate: "2000-01-01" }),
        event(2, 2, "résidence", { eventDate: "2000" }),
        event(1, 1, "libre", { eventDate: "2000" }),
      ],
    );

    expect(facts.map((fact) => fact.identity)).toEqual([
      "event:3",
      "event:1",
      "event:2",
      "event:4",
      "event:5",
    ]);
  });

  it("compte les clés logiques sans doubler une union projetée vers plusieurs partenaires", () => {
    const facts = projectFamilyFacts(
      [person(1, { birthDate: "1980" }), person(2, { birthDate: "1982" })],
      [union(4, "mariage", [1, 2], { startDate: "2001" })],
      [event(7, 1, "libre", { label: "Diplôme" })],
    );

    expect(countCanonicalFacts(facts)).toBe(4);
    expect(facts.filter((fact) => fact.personIds.includes(1))).toHaveLength(3);
    expect(facts.filter((fact) => fact.personIds.includes(2))).toHaveLength(2);
  });
});

describe("formatFamilyDate", () => {
  it.each([
    ["1980", "1980"],
    ["1980-05", "mai 1980"],
    ["1980-05-02", "2 mai 1980"],
    [null, "Date inconnue"],
  ])("formate %s sans inventer de précision", (value, expected) => {
    expect(formatFamilyDate(value)).toBe(expected);
  });
});

describe("projection cohérente des consommateurs", () => {
  it("expose les mêmes identités sans double comptage dans fiche, timelines et statistiques", async () => {
    const db = await createTestDb();
    const alice = await createPerson(db, {
      firstName: "Alice",
      lastName: "Martin",
      birthDate: "1980-05-02",
    });
    const bob = await createPerson(db, { firstName: "Bob", lastName: "Martin" });
    const marriage = await createUnion(db, {
      type: "mariage",
      personIds: [alice.id, bob.id],
      startDate: "2000-06-03",
      place: "Paris",
      latitude: 48.8566,
      longitude: 2.3522,
    });
    const residence = await createEvent(db, {
      personId: alice.id,
      type: "résidence",
      eventDate: "2001",
      place: "Lyon",
      latitude: 45.764,
      longitude: 4.8357,
    });

    const personFacts = await listCanonicalFactsByPerson(db, alice.id);
    const allFacts = await listCanonicalFamilyFacts(db);
    const familyTimeline = await listFamilyTimeline(db);
    const comparative = await listComparativeTimeline(db);
    const statistics = await getFamilyStatistics(db, new Date("2026-08-26T12:00:00Z"));
    const expected = [
      `person:${alice.id}:naissance`,
      `union:${marriage.id}`,
      `event:${residence.id}`,
    ];

    expect(personFacts.map((fact) => fact.identity)).toEqual(expected);
    expect(familyTimeline.filter((item) => item.person.id === alice.id).map((item) => item.key)).toEqual(expected);
    expect(comparative.find((row) => row.person.id === alice.id)?.events.map((fact) => fact.identity)).toEqual(expected);
    expect(statistics.totals.events).toBe(3);
    expect(statistics.topBirthPlaces).toEqual([]);
    expect(statistics.topResidencePlaces).toEqual([{ label: "Lyon", count: 1 }]);
    expect(mapLocationsFromFacts(allFacts, [alice, bob]).map((location) => location.eventId)).toEqual([
      -marriage.id,
      residence.id,
    ]);
    expect(anniversariesForDate(familyTimeline, "2026-06-03").map((item) => item.key)).toEqual([
      `union:${marriage.id}`,
    ]);
    expect(upcomingFamilyAnniversaries(allFacts, [alice, bob], "2026-06-01", 3).map((item) => item.key)).toEqual([
      `union:${marriage.id}`,
    ]);
  });
});
