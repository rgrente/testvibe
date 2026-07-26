import { describe, expect, it } from "vitest";
import type { Person } from "@testvibe/core";
import { sortPersonsChronologically } from "./sort-persons";

function person(
  id: number,
  firstName: string,
  lastName: string,
  birthDate: string | null,
): Person {
  return {
    id,
    firstName,
    lastName,
    birthName: null,
    birthDate,
    deathDate: null,
    gender: null,
  };
}

describe("sortPersonsChronologically", () => {
  it("trie les dates connues de la plus ancienne à la plus récente sans modifier la liste source", () => {
    const source = [
      person(3, "Zoé", "Martin", "2001-03-04"),
      person(1, "Anne", "Martin", "1920-01-02"),
      person(2, "Luc", "Martin", "1980-06-05"),
    ];

    expect(sortPersonsChronologically(source).map(({ id }) => id)).toEqual([1, 2, 3]);
    expect(source.map(({ id }) => id)).toEqual([3, 1, 2]);
  });

  it("trie chronologiquement les dates valides non ISO", () => {
    const source = [
      person(1, "Anne", "Martin", "2000-01-01"),
      person(2, "Luc", "Martin", "12/31/1999"),
      person(3, "Zoé", "Martin", "1/1/2001"),
    ];

    expect(sortPersonsChronologically(source).map(({ id }) => id)).toEqual([2, 1, 3]);
  });

  it("place les dates absentes après les dates connues", () => {
    const source = [
      person(1, "Anne", "Martin", null),
      person(2, "Luc", "Martin", "1980-06-05"),
    ];

    expect(sortPersonsChronologically(source).map(({ id }) => id)).toEqual([2, 1]);
  });

  it("départage les dates égales ou absentes par nom, prénom puis identifiant", () => {
    const source = [
      person(8, "Zoé", "Bernard", null),
      person(7, "Anne", "Bernard", null),
      person(6, "Anne", "Bernard", null),
      person(5, "Anne", "Durand", null),
      person(4, "Zoé", "Bernard", "2000-01-01"),
      person(3, "Anne", "Bernard", "2000-01-01"),
    ];

    expect(sortPersonsChronologically(source).map(({ id }) => id)).toEqual([
      3, 4, 6, 7, 8, 5,
    ]);
  });
});
