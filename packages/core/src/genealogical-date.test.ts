import { describe, expect, it } from "vitest";
import {
  compareGenealogicalDates,
  formatGenealogicalDate,
  fromGedcomDate,
  parseGenealogicalDate,
  toGedcomDate,
} from "./genealogical-date.js";

describe("GenealogicalDate", () => {
  it.each([
    ["1950", "exact", "year", "1950-01-01", "1950-12-31"],
    ["1950-03", "exact", "month", "1950-03-01", "1950-03-31"],
    ["1950-03-14", "exact", "day", "1950-03-14", "1950-03-14"],
    ["vers 1950", "about", "year", "1949-01-01", "1951-12-31"],
    ["avant 1950", "before", "year", null, "1949-12-31"],
    ["après 1950-03", "after", "month", "1950-04-01", null],
    ["entre 1950 et 1952", "between", "year", "1950-01-01", "1952-12-31"],
  ] as const)("normalise %s sans perdre la valeur originale", (original, qualification, precision, lower, upper) => {
    expect(parseGenealogicalDate(original)).toEqual({ original, qualification, precision, lower, upper });
  });

  it.each(["1950-02-30", "1950-13", "entre 1952 et 1950", "entre 1950 et 1952-03", "vers avant 1950", "1950-1"])(
    "rejette strictement %s",
    (value) => expect(() => parseGenealogicalDate(value)).toThrow(),
  );

  it.each([
    ["vers 2024-02-29", "2023-02-28", "2025-02-28"],
    ["vers 2024-02", "2023-02-01", "2025-02-28"],
  ])("conserve des bornes grégoriennes valides et inclusives pour %s", (original, lower, upper) => {
    expect(parseGenealogicalDate(original)).toMatchObject({ lower, upper });
  });

  it("affiche fidèlement les formes françaises", () => {
    expect(formatGenealogicalDate(parseGenealogicalDate("1950"))).toBe("1950");
    expect(formatGenealogicalDate(parseGenealogicalDate("1950-03"))).toBe("mars 1950");
    expect(formatGenealogicalDate(parseGenealogicalDate("vers 1950"))).toBe("vers 1950");
  });

  it("trie par borne basse, haute, qualification puis identifiant et place les inconnues en dernier", () => {
    const values = [null, parseGenealogicalDate("après 1950"), parseGenealogicalDate("1950"), parseGenealogicalDate("avant 1950")];
    expect(values.sort((a, b) => compareGenealogicalDates(a, b, "a", "b")).map((value) => value?.original ?? null))
      .toEqual(["avant 1950", "1950", "après 1950", null]);
  });

  it.each([
    ["ABT 1950", "vers 1950"],
    ["BEF MAR 1950", "avant 1950-03"],
    ["AFT 14 MAR 1950", "après 1950-03-14"],
    ["BET 1950 AND 1952", "entre 1950 et 1952"],
  ])("préserve la qualification GEDCOM %s", (gedcom, original) => {
    const value = fromGedcomDate(gedcom);
    expect(value.original).toBe(original);
    expect(toGedcomDate(value)).toBe(gedcom);
  });
});
