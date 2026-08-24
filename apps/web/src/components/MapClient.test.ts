import { describe, expect, it } from "vitest";
import type { MapLocation } from "@testvibe/core";
import { filterMapLocations, getEventDateRange, getMapLocationTypeLabel } from "./MapClient";

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
