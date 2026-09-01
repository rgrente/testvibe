import { describe, expect, it } from "vitest";
import type { MapLocation } from "@testvibe/core";
import { filterMapLocations, getEventDateRange, getMapLocationTypeLabel } from "./MapClient";
import { formatFamilyDate } from "../lib/family-date";

function location(
  eventId: number,
  personId: number,
  eventDate: string | null,
): MapLocation {
  return {
    eventId,
    source: "event",
    personId,
    personName: `Personne ${personId}`,
    type: "libre",
    label: null,
    eventDate,
    place: "Paris",
    latitude: 48.8566,
    longitude: 2.3522,
  };
}

describe("getEventDateRange", () => {
  it("interprète une année et un mois comme des intervalles", () => {
    expect(getEventDateRange("1900")).toEqual({
      start: Date.UTC(1900, 0, 1),
      end: Date.UTC(1900, 11, 31, 23, 59, 59, 999),
    });
    expect(getEventDateRange("1900-02")).toEqual({
      start: Date.UTC(1900, 1, 1),
      end: Date.UTC(1900, 2, 1) - 1,
    });
  });

  it.each([
    ["vers 1900", "1899-01-01", "1901-12-31"],
    ["avant 1900-03", "0001-01-01", "1900-02-28"],
    ["après 1900-03", "1900-04-01", "9999-12-31"],
    ["entre 1900-03 et 1902-04", "1900-03-01", "1902-04-30"],
  ])("interprète les bornes inclusives de %s", (value, start, end) => {
    expect(getEventDateRange(value)).toEqual({
      start: Date.parse(`${start}T00:00:00.000Z`),
      end: Date.parse(`${end}T23:59:59.999Z`),
    });
  });

  it.each(["vers avant 1900", "entre 1900 et 1902-03", "avant 0001", "après 9999", "1900-02-30"])(
    "rejette la forme qualifiée invalide %s",
    (value) => expect(getEventDateRange(value)).toBeNull(),
  );
});

describe("formatFamilyDate côté navigateur", () => {
  it("préserve les précisions année, mois et jour du contrat domaine", () => {
    expect(formatFamilyDate("1900")).toBe("1900");
    expect(formatFamilyDate("1900-02")).toBe("février 1900");
    expect(formatFamilyDate("1900-02-03")).toBe("3 février 1900");
    expect(formatFamilyDate("1900-02-30")).toBe("Date inconnue");
  });

  it.each([
    ["vers 1900-02", "vers février 1900"],
    ["avant 1900-02-03", "avant 3 février 1900"],
    ["après 1900", "après 1900"],
    ["entre 1900-02 et 1902-03", "entre février 1900 et mars 1902"],
  ])("affiche la forme qualifiée %s", (value, expected) => {
    expect(formatFamilyDate(value)).toBe(expected);
  });
});

describe("filterMapLocations", () => {
  const locations = [
    location(1, 1, "1899-12-31"),
    location(2, 2, "1900"),
    location(3, 3, "1900-06"),
    location(4, 4, null),
  ];

  it("cumule personne et période", () => {
    expect(filterMapLocations(locations, [], 2, "none", "1900-06-01", "1900-06-30"))
      .toEqual([locations[1]]);
  });

  it("inclut la personne racine avec sa branche et exclut les dates absentes", () => {
    expect(filterMapLocations(locations, [2, 3], 1, "descendants", "1900-01-01", "1900-12-31"))
      .toEqual([locations[1], locations[2]]);
  });

  it("filtre les événements qualifiés d'après leurs bornes", () => {
    const qualified = [
      location(5, 5, "vers 1900"),
      location(6, 6, "avant 1900"),
      location(7, 7, "après 1900"),
      location(8, 8, "entre 1900 et 1902"),
    ];

    expect(filterMapLocations(qualified, [], null, "none", "1901-01-01", "1901-12-31"))
      .toEqual([qualified[0], qualified[2], qualified[3]]);
  });
});

describe("getMapLocationTypeLabel", () => {
  it("distingue une union libre d'un événement libre", () => {
    const freeEvent = location(1, 1, null);
    const freeUnion: MapLocation = {
      ...freeEvent,
      eventId: -1,
      source: "union",
      personIds: [1, 2],
    };

    expect(getMapLocationTypeLabel(freeEvent)).toBe("Événement");
    expect(getMapLocationTypeLabel(freeUnion)).toBe("Union libre");
  });
});
