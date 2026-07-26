/**
 * Tests unitaires pour search.ts (recherche par nom).
 * Phase 5, tâche #24.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./test-utils.js";
import type { Database } from "@testvibe/db";
import { createPerson } from "./person.js";
import { searchPersons } from "./search.js";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe("searchPersons", () => {
  beforeEach(async () => {
    await createPerson(db, { firstName: "Jean", lastName: "Dupont" });
    await createPerson(db, { firstName: "Marie", lastName: "Martin", birthName: "Durand" });
    await createPerson(db, { firstName: "Jean-Paul", lastName: "Sartre" });
    await createPerson(db, { firstName: "Simone", lastName: "De Beauvoir" });
  });

  it("retourne toutes les personnes si query vide", async () => {
    const results = await searchPersons(db, "");
    expect(results).toHaveLength(4);
  });

  it("retourne toutes les personnes si query est uniquement des espaces", async () => {
    const results = await searchPersons(db, "   ");
    expect(results).toHaveLength(4);
  });

  it("filtre par prénom (partiel, insensible à la casse)", async () => {
    const results = await searchPersons(db, "jean");
    expect(results).toHaveLength(2);
    const names = results.map((p) => p.firstName);
    expect(names).toContain("Jean");
    expect(names).toContain("Jean-Paul");
  });

  it("filtre par nom (partiel)", async () => {
    const results = await searchPersons(db, "mar");
    // "Martin" contient "mar"
    expect(results.some((p) => p.lastName === "Martin")).toBe(true);
    // "Marie" ne contient pas "mar" en lastName mais en firstName
    // (Marie Martin) — les deux matchent
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("retourne un résultat unique pour une recherche précise", async () => {
    const results = await searchPersons(db, "sartre");
    expect(results).toHaveLength(1);
    expect(results[0].lastName).toBe("Sartre");
  });

  it("retourne un tableau vide si aucune correspondance", async () => {
    const results = await searchPersons(db, "zzz-inexistant");
    expect(results).toHaveLength(0);
  });

  it("supporte une recherche prénom+nom combinés", async () => {
    const results = await searchPersons(db, "jean dupont");
    expect(results.some((p) => p.firstName === "Jean" && p.lastName === "Dupont")).toBe(true);
  });

  it("filtre par nom de naissance partiel et sans tenir compte de la casse", async () => {
    const results = await searchPersons(db, "URAN");
    expect(results).toHaveLength(1);
    expect(results[0].birthName).toBe("Durand");
  });
});
