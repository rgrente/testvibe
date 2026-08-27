import { describe, expect, it } from "vitest";
import type { Event, FamilyTimelineItem, Person, Union } from "./types.js";
import { anniversariesForDate, isCompleteCalendarDate, localCalendarDate, upcomingFamilyAnniversaries } from "./anniversary.js";
import { projectFamilyFacts } from "./projection.js";

const person = (id: number, firstName: string, lastName: string): Person => ({
  id, firstName, lastName, birthName: null, birthDate: null, deathDate: null, gender: null,
});

function entry(key: string, eventDate: string | null, owner: Person, type: FamilyTimelineItem["event"]["type"] = "libre"): FamilyTimelineItem {
  return { key, person: owner, event: { type, eventDate, label: null, description: null } };
}

describe("anniversariesForDate", () => {
  it("compare uniquement le jour et le mois, calcule les années et trie par année puis personne", () => {
    const zoe = person(1, "Zoé", "Zulu");
    const alice = person(2, "Alice", "Alpha");
    const items = [
      entry("event:3", "2000-08-24", zoe),
      entry("event:2", "1980-08-24", zoe),
      entry("event:1", "1980-08-24", alice, "naissance"),
      entry("event:4", "2010-08-25", alice),
    ];

    expect(anniversariesForDate(items, "2026-08-24").map((item) => [item.key, item.yearsElapsed])).toEqual([
      ["event:1", 46],
    ]);
  });

  it("exclut les dates incomplètes, invalides, approximatives et futures", () => {
    const owner = person(1, "A", "A");
    const items = ["1980", "1980-08", "vers 1980-08-24", "2026-02-29", "2027-08-24"]
      .map((date, index) => entry(`event:${index}`, date, owner));
    expect(anniversariesForDate(items, "2026-08-24")).toEqual([]);
  });

  it("reporte le 29 février au 28 février uniquement les années non bissextiles", () => {
    const leapDay = entry("event:1", "2000-02-29", person(1, "A", "A"), "naissance");
    expect(anniversariesForDate([leapDay], "2023-02-28")).toHaveLength(1);
    expect(anniversariesForDate([leapDay], "2024-02-28")).toHaveLength(0);
    expect(anniversariesForDate([leapDay], "2024-02-29")).toHaveLength(1);
  });
});

describe("date locale configurée", () => {
  it("utilise le fuseau demandé autour d'un changement de jour et d'année", () => {
    const clock = new Date("2025-12-31T23:30:00.000Z");
    expect(localCalendarDate(clock, "Europe/Paris")).toBe("2026-01-01");
    expect(localCalendarDate(clock, "America/New_York")).toBe("2025-12-31");
  });

  it("valide strictement une date de calendrier complète", () => {
    expect(isCompleteCalendarDate("2024-02-29")).toBe(true);
    expect(isCompleteCalendarDate("2023-02-29")).toBe(false);
    expect(isCompleteCalendarDate("2024-02")).toBe(false);
  });
});

describe("upcomingFamilyAnniversaries", () => {
  it("retient les naissances et mariages à venir et les trie par proximité", () => {
    const alice = { ...person(1, "Alice", "Alpha"), birthDate: "1980-09-10" };
    const bob = { ...person(2, "Bob", "Beta"), birthDate: "1982-09-02" };
    const marriage: Union = {
      id: 4, type: "mariage", startDate: "2010-09-05", endDate: null, place: null,
      latitude: null, longitude: null, personIds: [1, 2],
    };

    const facts = projectFamilyFacts([alice, bob], [marriage], []);

    expect(upcomingFamilyAnniversaries(facts, [alice, bob], "2026-09-01", 7))
      .toEqual([
        expect.objectContaining({ key: "person:2:naissance", daysUntil: 1, yearsElapsed: 44, persons: [bob] }),
        expect.objectContaining({ key: "union:4", daysUntil: 4, yearsElapsed: 16, persons: [alice, bob] }),
      ]);
  });

  it("exclut aujourd'hui, les dates incomplètes et les unions qui ne sont pas des mariages", () => {
    const alice = { ...person(1, "Alice", "Alpha"), birthDate: "1980-09-01" };
    const union: Union = {
      id: 4, type: "pacs", startDate: "2010-09-02", endDate: null, place: null,
      latitude: null, longitude: null, personIds: [1],
    };
    const incomplete = { ...person(2, "Bob", "Beta"), birthDate: "1982-09" };

    const facts = projectFamilyFacts([alice, incomplete], [union], []);
    expect(upcomingFamilyAnniversaries(facts, [alice, incomplete], "2026-09-01", 7)).toEqual([]);
  });

  it("gère le passage d'année et le 29 février", () => {
    const newYear = { ...person(1, "Alice", "Alpha"), birthDate: "2000-01-01" };
    const leapDay = { ...person(2, "Bob", "Beta"), birthDate: "2000-02-29" };
    expect(upcomingFamilyAnniversaries(projectFamilyFacts([newYear], [], []), [newYear], "2026-12-31", 1)[0])
      .toMatchObject({ occurrenceDate: "2027-01-01", daysUntil: 1, yearsElapsed: 27 });
    expect(upcomingFamilyAnniversaries(projectFamilyFacts([leapDay], [], []), [leapDay], "2023-02-27", 1)[0])
      .toMatchObject({ occurrenceDate: "2023-02-28", yearsElapsed: 23 });
  });

  it("ignore les événements de naissance et mariage parallèles aux faits canoniques", () => {
    const alice = { ...person(1, "Alice", "Alpha"), birthDate: "1980-09-02" };
    const conflictingEvents: Event[] = [
      {
        id: 10, personId: 1, unionId: null, type: "naissance", label: null,
        eventDate: "1981-09-03", description: null, place: null, latitude: null, longitude: null,
      },
      {
        id: 11, personId: 1, unionId: null, type: "mariage", label: null,
        eventDate: "2010-09-04", description: null, place: null, latitude: null, longitude: null,
      },
    ];
    const facts = projectFamilyFacts([alice], [], conflictingEvents);

    expect(upcomingFamilyAnniversaries(facts, [alice], "2026-09-01", 7).map((item) => item.key))
      .toEqual(["person:1:naissance"]);
  });
});
