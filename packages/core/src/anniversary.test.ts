import { describe, expect, it } from "vitest";
import type { FamilyTimelineItem, Person } from "./types.js";
import { anniversariesForDate, isCompleteCalendarDate, localCalendarDate } from "./anniversary.js";

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
      ["event:1", 46], ["event:2", 46], ["event:3", 26],
    ]);
  });

  it("exclut les dates incomplètes, invalides, approximatives et futures", () => {
    const owner = person(1, "A", "A");
    const items = ["1980", "1980-08", "vers 1980-08-24", "2026-02-29", "2027-08-24"]
      .map((date, index) => entry(`event:${index}`, date, owner));
    expect(anniversariesForDate(items, "2026-08-24")).toEqual([]);
  });

  it("reporte le 29 février au 28 février uniquement les années non bissextiles", () => {
    const leapDay = entry("event:1", "2000-02-29", person(1, "A", "A"));
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
