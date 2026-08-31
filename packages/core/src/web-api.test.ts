import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Event, Filiation, Person, Union } from "./types.js";

const fixtures = vi.hoisted(() => ({
  persons: [] as Person[],
  unions: [] as Union[],
  filiations: [] as Filiation[],
  events: [] as Event[],
}));

vi.mock("./person.js", () => ({
  listPersons: vi.fn(async () => fixtures.persons),
  getPersonById: vi.fn(async (_db, id: number) => fixtures.persons.find((person) => person.id === id)),
}));
vi.mock("./union.js", () => ({ listUnions: vi.fn(async () => fixtures.unions) }));
vi.mock("./filiation.js", () => ({ listFiliations: vi.fn(async () => fixtures.filiations) }));
vi.mock("./event.js", () => ({ listAllEvents: vi.fn(async () => fixtures.events) }));
vi.mock("./media.js", () => ({ listAllMedia: vi.fn(async () => []) }));
vi.mock("./anniversary.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./anniversary.js")>();
  return {
    ...original,
    listFamilyAnniversaries: vi.fn(async () => [{
      key: "event:10",
      eventId: 10,
      event: { type: "naissance", label: null, eventDate: "2000-06-15", description: null },
      person: fixtures.persons[0],
      yearsElapsed: 26,
    }]),
    listUpcomingFamilyAnniversaries: vi.fn(async () => [{
      key: "union:20",
      type: "mariage",
      occurrenceDate: "2026-06-15",
      daysUntil: 1,
      yearsElapsed: 26,
      persons: fixtures.persons,
    }]),
  };
});

import {
  getAncestorIdsForWeb,
  getComparativeTimelineForWeb,
  getDescendantIdsForWeb,
  getFamilyAnniversariesForWeb,
  getFamilyTreeForWeb,
  getUpcomingFamilyAnniversariesForWeb,
} from "./web-api.js";

const publicPerson = (id: number, firstName: string): Person => ({
  id,
  firstName,
  lastName: "Public",
  birthName: null,
  birthDate: null,
  deathDate: "2020-01-01",
  gender: null,
  livingStatus: "deceased",
  visibility: "public",
});

beforeEach(() => {
  fixtures.persons = [];
  fixtures.unions = [];
  fixtures.filiations = [];
  fixtures.events = [];
});

function hiddenBridgeFamily() {
  fixtures.persons = [
    publicPerson(1, "Root"),
    { ...publicPerson(2, "Hidden"), livingStatus: "living", deathDate: null, visibility: "private" },
    publicPerson(3, "Grandchild"),
  ];
  fixtures.filiations = [
    { id: 11, parentId: 1, childId: 2, role: "biologique" },
    { id: 12, parentId: 2, childId: 3, role: "biologique" },
  ];
}

describe("web-api anniversary privacy boundary", () => {
  it("does not disclose a private event attached to a public person", async () => {
    fixtures.persons = [publicPerson(1, "Alice")];
    fixtures.events = [{
      id: 10,
      personId: 1,
      unionId: null,
      type: "naissance",
      label: null,
      eventDate: "2000-06-15",
      description: null,
      place: null,
      latitude: null,
      longitude: null,
      visibility: "private",
    }];

    await expect(getFamilyAnniversariesForWeb("2026-06-15")).resolves.toEqual([]);
  });

  it("does not disclose an anniversary from a union with a hidden partner", async () => {
    fixtures.persons = [
      publicPerson(1, "Alice"),
      { ...publicPerson(2, "Bob"), livingStatus: "living", deathDate: null, visibility: "private" },
    ];
    fixtures.unions = [{
      id: 20,
      type: "mariage",
      startDate: "2000-06-15",
      endDate: null,
      place: null,
      latitude: null,
      longitude: null,
      personIds: [1, 2],
    }];

    await expect(getUpcomingFamilyAnniversariesForWeb("2026-06-14", 2)).resolves.toEqual([]);
  });
});

describe("web-api relationship privacy boundary", () => {
  it("does not include a visible tree node reached through a hidden person", async () => {
    hiddenBridgeFamily();

    const tree = await getFamilyTreeForWeb(1);

    expect(tree.nodes.map(({ person, generation }) => [person.id, generation])).toEqual([[1, 0]]);
    expect(tree.edges).toEqual([]);
  });

  it("does not find a visible ancestor through a hidden filiation", async () => {
    hiddenBridgeFamily();

    await expect(getAncestorIdsForWeb(3)).resolves.toEqual([]);
  });

  it("does not find a visible descendant through a hidden filiation", async () => {
    hiddenBridgeFamily();

    await expect(getDescendantIdsForWeb(1)).resolves.toEqual([]);
  });
});

describe("web-api comparative timeline privacy boundary", () => {
  it("does not disclose a mixed-visibility union in a public person's row", async () => {
    fixtures.persons = [
      publicPerson(1, "Alice"),
      { ...publicPerson(2, "Bob"), livingStatus: "living", deathDate: null, visibility: "private" },
    ];
    fixtures.unions = [{
      id: 20,
      type: "mariage",
      startDate: "2000-06-15",
      endDate: null,
      place: null,
      latitude: null,
      longitude: null,
      personIds: [1, 2],
    }];

    const rows = await getComparativeTimelineForWeb();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.events.map(({ identity }) => identity)).not.toContain("union:20");
    expect(JSON.stringify(rows)).not.toContain("2000-06-15");
    expect(JSON.stringify(rows)).not.toContain('"personIds":[1,2]');
  });
});
