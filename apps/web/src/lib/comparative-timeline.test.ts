import type { ComparativeTimelineRow, Event, Person } from "@testvibe/core";
import { describe, expect, it } from "vitest";
import { prepareComparativeTimeline, summarizeComparativeTimeline } from "./comparative-timeline";

function person(overrides: Partial<Person> & Pick<Person, "id" | "firstName" | "lastName">): Person {
  return {
    birthName: null,
    birthDate: null,
    deathDate: null,
    gender: null,
    ...overrides,
  };
}

function event(overrides: Partial<Event> & Pick<Event, "id" | "personId" | "type">): Event {
  return {
    unionId: null,
    label: null,
    eventDate: null,
    description: null,
    place: null,
    latitude: null,
    longitude: null,
    ...overrides,
  };
}

describe("prepareComparativeTimeline", () => {
  it("résume la fixture sans compter deux fois un fait d’union partagé", () => {
    const rows: ComparativeTimelineRow[] = [
      {
        person: person({ id: 1, firstName: "A", lastName: "Test", birthDate: "1962" }),
        events: [{ id: 10, identity: "union:7", type: "mariage", label: null, eventDate: "1990" }],
      },
      {
        person: person({ id: 2, firstName: "B", lastName: "Test", birthDate: "1964" }),
        events: [{ id: 11, identity: "union:7", type: "mariage", label: null, eventDate: "1990" }],
      },
    ];

    expect(summarizeComparativeTimeline(rows, 2026)).toEqual({
      startYear: 1960,
      endYear: 2030,
      personCount: 2,
      eventCount: 1,
    });
  });

  it("peut préserver l'ordre fourni pour une vue d'ascendance", () => {
    const recent = person({ id: 50, firstName: "Recent", lastName: "First", birthDate: "2000" });
    const old = person({ id: 51, firstName: "Old", lastName: "Second", birthDate: "1900" });
    expect(prepareComparativeTimeline([{ person: recent, events: [] }, { person: old, events: [] }], { preserveRowOrder: true }).rows.map((row) => row.person.id)).toEqual([50, 51]);
    expect(prepareComparativeTimeline([{ person: recent, events: [] }, { person: old, events: [] }]).rows.map((row) => row.person.id)).toEqual([51, 50]);
  });
  it("place les vies et événements sur une échelle commune", () => {
    const ada = person({
      id: 1,
      firstName: "Ada",
      lastName: "Lovelace",
      birthDate: "1815-12-10",
      deathDate: "1852-11-27",
    });
    const alan = person({
      id: 2,
      firstName: "Alan",
      lastName: "Turing",
      birthDate: "1912-06-23",
      deathDate: "1954-06-07",
    });
    const rows: ComparativeTimelineRow[] = [
      {
        person: ada,
        events: [
          event({ id: 10, personId: ada.id, type: "libre", label: "Publication", eventDate: "1843" }),
        ],
      },
      { person: alan, events: [] },
    ];

    const timeline = prepareComparativeTimeline(rows);

    expect(timeline?.startYear).toBe(1810);
    expect(timeline?.endYear).toBe(1960);
    expect(timeline?.rows.map(({ person }) => person.firstName)).toEqual(["Ada", "Alan"]);
    expect(timeline?.rows[0].life).not.toBeNull();
    expect(timeline?.rows[0].life?.endPosition).toBeLessThan(timeline!.rows[1].life!.startPosition);
    expect(timeline?.rows[0].datedEvents[0]).toMatchObject({ label: "Publication", displayDate: "1843" });
    expect(timeline?.rows[0].datedEvents[0].position).toBeGreaterThan(timeline!.rows[0].life!.startPosition);
  });

  it("garde explicitement les personnes et événements impossibles à placer", () => {
    const unknown = person({ id: 3, firstName: "Date", lastName: "Inconnue" });
    const known = person({ id: 4, firstName: "Vie", lastName: "Ouverte", birthDate: "2001" });
    const rows: ComparativeTimelineRow[] = [
      {
        person: unknown,
        events: [
          event({ id: 11, personId: unknown.id, type: "libre", label: "Souvenir" }),
          event({ id: 12, personId: unknown.id, type: "libre", eventDate: "2020-02-31", label: "Date invalide" }),
        ],
      },
      { person: known, events: [] },
    ];

    const timeline = prepareComparativeTimeline(rows);

    expect(timeline?.rows.find(({ person }) => person.id === unknown.id)).toMatchObject({
      life: null,
      undatedEvents: [{ label: "Souvenir" }, { label: "Date invalide" }],
    });
    expect(timeline?.rows.find(({ person }) => person.id === known.id)?.life).toMatchObject({
      openEnded: true,
      endPosition: 100,
    });
  });

  it("retourne une échelle absente sans supprimer les lignes quand aucune date n'est exploitable", () => {
    const unknown = person({ id: 5, firstName: "Sans", lastName: "Date" });

    expect(prepareComparativeTimeline([{ person: unknown, events: [] }])).toEqual({
      startYear: null,
      endYear: null,
      ticks: [],
      rows: [
        {
          person: unknown,
          life: null,
          datedEvents: [],
          undatedEvents: [],
          maxLanes: 0,
        },
      ],
    });
  });
});
