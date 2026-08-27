import { describe, expect, it } from "vitest";
import type { Event, Filiation, Person, Union } from "./types.js";
import { calculateFamilyStatistics } from "./statistics.js";

const person = (overrides: Partial<Person> & Pick<Person, "id" | "firstName">): Person => ({
  lastName: "Test",
  birthName: null,
  birthDate: null,
  deathDate: null,
  gender: null,
  ...overrides,
});

const event = (overrides: Partial<Event> & Pick<Event, "id" | "personId" | "type">): Event => ({
  unionId: null,
  label: null,
  eventDate: null,
  description: null,
  place: null,
  latitude: null,
  longitude: null,
  ...overrides,
});

const union = (id: number): Union => ({
  id,
  type: "mariage",
  startDate: null,
  endDate: null,
  place: null,
  latitude: null,
  longitude: null,
  personIds: [],
});

const filiation = (id: number, parentId: number, childId: number): Filiation => ({
  id,
  parentId,
  childId,
  role: "biologique",
});

describe("calculateFamilyStatistics", () => {
  it("calcule exactement les cinq familles de statistiques d'une fixture connue", () => {
    const persons = [
      person({ id: 1, firstName: " Élodie ", birthDate: "1990-08-27", gender: "F" }),
      person({ id: 2, firstName: "elodie", birthDate: "1980-08-26", deathDate: "2020-08-26", gender: "F" }),
      person({ id: 3, firstName: "Marc", birthDate: "2000-02-29", gender: "M" }),
      person({ id: 4, firstName: "Zoé", birthDate: "2016-08-26", gender: null }),
    ];
    const events = [
      event({ id: 1, personId: 1, type: "naissance", place: " Montréal " }),
      event({ id: 2, personId: 2, type: "naissance", place: "montreal" }),
      event({ id: 3, personId: 3, type: "naissance", place: "Paris" }),
      event({ id: 4, personId: 1, type: "libre", label: " Résidence ", place: "Lyon" }),
      event({ id: 5, personId: 2, type: "libre", label: "residence", place: " lyon " }),
      event({ id: 6, personId: 3, type: "libre", label: "Travail", place: "Lyon" }),
    ];

    expect(calculateFamilyStatistics(persons, [union(1)], [
      filiation(1, 1, 2),
      filiation(2, 2, 3),
      filiation(3, 3, 4),
    ], events, new Date("2026-08-26T12:00:00Z"))).toEqual({
      totals: { persons: 4, unions: 1, events: 9, generations: 4 },
      agePyramid: [
        { decade: 10, women: 0, men: 0, other: 1 },
        { decade: 20, women: 0, men: 1, other: 0 },
        { decade: 30, women: 1, men: 0, other: 0 },
      ],
      averageLongevity: 40,
      topFirstNames: [
        { label: "Élodie", count: 2 },
        { label: "Marc", count: 1 },
        { label: "Zoé", count: 1 },
      ],
      topBirthPlaces: [
        { label: "montreal", count: 2 },
        { label: "Paris", count: 1 },
      ],
      topResidencePlaces: [{ label: "Lyon", count: 2 }],
    });
  });

  it("ignore les dates absentes, partielles, invalides, futures et les personnes décédées dans la pyramide", () => {
    const persons = [
      person({ id: 1, firstName: "Sans date" }),
      person({ id: 2, firstName: "Partielle", birthDate: "1990" }),
      person({ id: 3, firstName: "Invalide", birthDate: "2024-02-30" }),
      person({ id: 4, firstName: "Future", birthDate: "2027-01-01" }),
      person({ id: 5, firstName: "Décédée", birthDate: "1990-01-01", deathDate: "2020-01-01", gender: "F" }),
      person({ id: 6, firstName: "Valide", birthDate: "2006-08-27", gender: "X" }),
    ];

    expect(calculateFamilyStatistics(persons, [], [], [], new Date("2026-08-26T22:30:00Z")).agePyramid)
      .toEqual([{ decade: 20, women: 0, men: 0, other: 1 }]);
  });

  it("calcule la longévité avec deux dates complètes valides et ordonnées, arrondie à une décimale", () => {
    const persons = [
      person({ id: 1, firstName: "A", birthDate: "1900-01-01", deathDate: "2000-01-01" }),
      person({ id: 2, firstName: "B", birthDate: "2000-01-01", deathDate: "2020-07-02" }),
      person({ id: 3, firstName: "Vivante", birthDate: "1980-01-01" }),
      person({ id: 4, firstName: "Partiel", birthDate: "1980", deathDate: "2020-01-01" }),
      person({ id: 5, firstName: "Inversé", birthDate: "2020-01-01", deathDate: "2000-01-01" }),
    ];

    expect(calculateFamilyStatistics(persons, [], [], [], new Date("2026-08-26T12:00:00Z")).averageLongevity)
      .toBe(60.3);
  });

  it("limite les classements à cinq et départage les égalités selon l'alphabet français", () => {
    const persons = ["Zoé", "Émile", "Alice", "Chloé", "Béatrice", "David"].map((firstName, index) =>
      person({ id: index + 1, firstName }),
    );

    expect(calculateFamilyStatistics(persons, [], [], [], new Date("2026-08-26T12:00:00Z")).topFirstNames)
      .toEqual([
        { label: "Alice", count: 1 },
        { label: "Béatrice", count: 1 },
        { label: "Chloé", count: 1 },
        { label: "David", count: 1 },
        { label: "Émile", count: 1 },
      ]);
  });

  it("compte le plus long chemin simple sur tous les composants sans boucler", () => {
    const persons = [1, 2, 3, 4, 5, 6].map((id) => person({ id, firstName: `P${id}` }));
    const filiations = [
      filiation(1, 1, 2),
      filiation(2, 2, 3),
      filiation(3, 3, 1),
      { ...filiation(4, 4, 5), role: "adopte" as const },
      { ...filiation(5, 5, 6), role: "beau-parent" as const },
    ];

    expect(calculateFamilyStatistics(persons, [], filiations, [], new Date()).totals.generations).toBe(3);
  });

  it("retourne des agrégats vides cohérents pour un arbre vide ou sans lieux", () => {
    expect(calculateFamilyStatistics([], [], [], [], new Date("2026-08-26T12:00:00Z"))).toEqual({
      totals: { persons: 0, unions: 0, events: 0, generations: 0 },
      agePyramid: [],
      averageLongevity: null,
      topFirstNames: [],
      topBirthPlaces: [],
      topResidencePlaces: [],
    });

    const stats = calculateFamilyStatistics(
      [person({ id: 1, firstName: "  " })],
      [],
      [],
      [event({ id: 1, personId: 1, type: "naissance", place: "  " })],
      new Date("2026-08-26T12:00:00Z"),
    );
    expect(stats.topFirstNames).toEqual([]);
    expect(stats.topBirthPlaces).toEqual([]);
    expect(stats.topResidencePlaces).toEqual([]);
    expect(stats.totals.generations).toBe(1);
  });
});
