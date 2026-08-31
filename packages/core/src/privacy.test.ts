import { describe, expect, it } from "vitest";
import {
  filterPrivacyDataset,
  effectiveVisibility,
  inferLivingStatus,
  isVisibleToAudience,
  privacyThresholdYears,
} from "./privacy.js";
import type { Event, Media, Person, Union } from "./types.js";

const person = (overrides: Partial<Person> = {}): Person => ({
  id: 1,
  firstName: "Ada",
  lastName: "Lovelace",
  birthName: null,
  birthDate: null,
  deathDate: null,
  gender: null,
  livingStatus: null,
  visibility: null,
  ...overrides,
});

describe("living-person privacy policy", () => {
  it("defaults missing visibility to public independently of inferred living status", () => {
    const now = new Date("2026-08-31T00:00:00.000Z");
    for (const birthDate of [null, "2000", "1906-09", "2030-01-01", "invalid"]) {
      expect(inferLivingStatus(person({ birthDate }), { now, thresholdYears: 120 })).toBe("living");
      expect(effectiveVisibility(person({ birthDate }), { now, thresholdYears: 120 })).toBe("public");
    }
  });

  it("honours explicit status and visibility while deceased defaults public", () => {
    const now = new Date("2026-08-31T00:00:00.000Z");
    expect(inferLivingStatus(person({ livingStatus: "deceased" }), { now })).toBe("deceased");
    expect(inferLivingStatus(person({ livingStatus: "living", deathDate: "2020" }), { now })).toBe("living");
    expect(effectiveVisibility(person({ livingStatus: "deceased" }), { now })).toBe("public");
    expect(effectiveVisibility(person({ deathDate: "2026" }), { now })).toBe("public");
    expect(effectiveVisibility(person({ birthDate: "1800-01-01" }), { now })).toBe("public");
    expect(effectiveVisibility(person({ visibility: "family" }), { now })).toBe("family");
    expect(effectiveVisibility(person({ deathDate: "2026", visibility: "private" }), { now })).toBe("private");
  });

  it("enforces public < family < private and the strictest linked visibility", () => {
    expect(isVisibleToAudience("public", "public")).toBe(true);
    expect(isVisibleToAudience("family", "public")).toBe(false);
    expect(isVisibleToAudience("family", "family")).toBe(true);
    expect(isVisibleToAudience("private", "family")).toBe(false);
    expect(isVisibleToAudience("private", "private")).toBe(true);
    expect(effectiveVisibility(["public", "private", "family"])).toBe("private");
    expect(effectiveVisibility([])).toBe("private");
  });

  it("accepts only a positive integer configured threshold", () => {
    expect(privacyThresholdYears("100")).toBe(100);
    for (const value of [undefined, "", "0", "-1", "12.5", "invalid"]) {
      expect(privacyThresholdYears(value)).toBe(120);
    }
  });

  it("filters every entity before projection without relationship or aggregate inference", () => {
    const publicPerson = person({ id: 1, deathDate: "1900-01-01" });
    const livingPerson = person({
      id: 2,
      firstName: "Hidden",
      birthDate: "2000-01-01",
      visibility: "family",
    });
    const publicEvent = { id: 1, personId: 1, unionId: null, visibility: null } as Event;
    const hiddenEvent = { id: 2, personId: 1, unionId: null, visibility: "private" } as Event;
    const mixedUnion = { id: 1, personIds: [1, 2] } as Union;
    const publicMedia = { id: 1, personId: 1, eventId: null, visibility: null } as Media;
    const hiddenMedia = { id: 2, personId: null, eventId: 2, visibility: null } as Media;
    const orphanMedia = { id: 3, personId: null, eventId: null, visibility: "public" } as Media;

    const view = filterPrivacyDataset({
      persons: [publicPerson, livingPerson],
      unions: [mixedUnion],
      filiations: [{ id: 1, parentId: 1, childId: 2, role: "biologique" }],
      events: [publicEvent, hiddenEvent],
      media: [publicMedia, hiddenMedia, orphanMedia],
    }, "public", { now: new Date("2026-08-31T00:00:00.000Z") });

    expect(view.persons.map(({ id }) => id)).toEqual([1]);
    expect(view.unions).toEqual([]);
    expect(view.filiations).toEqual([]);
    expect(view.events.map(({ id }) => id)).toEqual([1]);
    expect(view.media.map(({ id }) => id)).toEqual([1]);
  });
});
