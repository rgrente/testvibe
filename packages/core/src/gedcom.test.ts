/**
 * Tests GEDCOM — import/export (Phase 4, tâche #23).
 *
 * Couvre :
 * 1. Import d'un fichier GEDCOM valide multi-générations
 * 2. Rejet d'un fichier GEDCOM malformé (aucune donnée partielle insérée)
 * 3. Aller-retour import→export→import sans perte de données clés
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { Database } from "@testvibe/db";
import { createTestDb } from "./test-utils.js";
import { importGedcom, exportGedcom } from "./gedcom.js";
import { listPersons } from "./person.js";
import { listUnions } from "./union.js";
import { listFiliations } from "./filiation.js";
import { ValidationError } from "./errors.js";

// ─── Fixture GEDCOM multi-générations ────────────────────────────────────────
//
// Structure :
//   Henri MARTIN (I1) + Marie DUPONT (I2) → Louis MARTIN (I3)
//   Louis MARTIN (I3) + Jeanne BERNARD (I4) → Sophie MARTIN (I5)
//
// Soit 2 unions et 2 filiations (père → enfant dans chaque union),
// couvrant plusieurs générations.
const VALID_GEDCOM = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Henri /MARTIN/
1 SEX M
1 BIRT
2 DATE 15 MAR 1940
0 @I2@ INDI
1 NAME Marie /DUPONT/
1 SEX F
1 BIRT
2 DATE 20 JUN 1945
1 DEAT
2 DATE 10 NOV 2020
0 @I3@ INDI
1 NAME Louis /MARTIN/
1 SEX M
1 BIRT
2 DATE 5 APR 1968
0 @I4@ INDI
1 NAME Jeanne /BERNARD/
1 SEX F
1 BIRT
2 DATE 12 SEP 1970
0 @I5@ INDI
1 NAME Sophie /MARTIN/
1 SEX F
1 BIRT
2 DATE 22 JAN 1995
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 10 JUN 1965
1 CHIL @I3@
0 @F2@ FAM
1 HUSB @I3@
1 WIFE @I4@
1 MARR
2 DATE 15 MAY 1992
1 CHIL @I5@
0 TRLR
`;

// GEDCOM malformé : record INDI sans tag NAME valide + FAM référençant un
// individu inexistant — les parseurs robustes doivent détecter l'incohérence.
const MALFORMED_GEDCOM = `0 HEAD
1 GEDC
THIS IS NOT VALID GEDCOM AT ALL
NO LEVEL NUMBERS HERE
&&&%%%
0 TRLR
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("importGedcom", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("importe un fichier GEDCOM multi-générations et crée les Person/Union/Filiation", async () => {
    await importGedcom(db, VALID_GEDCOM);

    const persons = await listPersons(db);
    expect(persons).toHaveLength(5);

    // Vérifie noms et prénoms
    const names = persons.map((p) => `${p.firstName} ${p.lastName}`).sort();
    expect(names).toContain("Henri MARTIN");
    expect(names).toContain("Marie DUPONT");
    expect(names).toContain("Louis MARTIN");
    expect(names).toContain("Jeanne BERNARD");
    expect(names).toContain("Sophie MARTIN");

    // Vérifie dates de naissance
    const henri = persons.find((p) => p.firstName === "Henri");
    expect(henri?.birthDate).toBe("1940-03-15");
    const marie = persons.find((p) => p.firstName === "Marie");
    expect(marie?.deathDate).toBe("2020-11-10");

    // Vérifie genre
    expect(henri?.gender).toBe("M");
    expect(marie?.gender).toBe("F");

    // Vérifie unions (2 familles)
    const unions = await listUnions(db);
    expect(unions).toHaveLength(2);

    // Vérifie filiations : I3 fils de I1 et I2, I5 fils de I3 et I4
    const filiations = await listFiliations(db);
    expect(filiations).toHaveLength(4); // 2 familles × 2 parents = 4 filiations

    const childIds = filiations.map((f) => f.childId);
    const louiPerson = persons.find((p) => p.firstName === "Louis")!;
    const sophiePerson = persons.find((p) => p.firstName === "Sophie")!;
    expect(childIds).toContain(louiPerson.id);
    expect(childIds).toContain(sophiePerson.id);
  });

  it("est atomique : aucune donnée insérée en cas de GEDCOM malformé", async () => {
    await expect(importGedcom(db, MALFORMED_GEDCOM)).rejects.toBeInstanceOf(ValidationError);

    // Aucune donnée partielle ne doit exister
    const persons = await listPersons(db);
    expect(persons).toHaveLength(0);
    const unions = await listUnions(db);
    expect(unions).toHaveLength(0);
    const filiations = await listFiliations(db);
    expect(filiations).toHaveLength(0);
  });

  it("rejette un GEDCOM vide (sans individus ni familles)", async () => {
    const emptyGedcom = "0 HEAD\n1 GEDC\n2 VERS 5.5.1\n0 TRLR\n";
    await expect(importGedcom(db, emptyGedcom)).rejects.toBeInstanceOf(ValidationError);
    const persons = await listPersons(db);
    expect(persons).toHaveLength(0);
  });
});

describe("exportGedcom", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("génère un fichier GEDCOM non vide après import", async () => {
    await importGedcom(db, VALID_GEDCOM);
    const ged = await exportGedcom(db);
    expect(ged).toContain("0 HEAD");
    expect(ged).toContain("0 TRLR");
    expect(ged).toContain("INDI");
    expect(ged).toContain("FAM");
    expect(ged).toContain("MARTIN");
    expect(ged).toContain("DUPONT");
  });

  it("aller-retour import→export→import : pas de perte de données clés", async () => {
    // Import initial
    await importGedcom(db, VALID_GEDCOM);
    const personsAfterFirstImport = await listPersons(db);
    const unionsAfterFirstImport = await listUnions(db);
    const filiationsAfterFirstImport = await listFiliations(db);

    // Export
    const exported = await exportGedcom(db);

    // Second import dans une base fraîche
    const db2 = await createTestDb();
    await importGedcom(db2, exported);
    const personsAfterSecondImport = await listPersons(db2);
    const unionsAfterSecondImport = await listUnions(db2);
    const filiationsAfterSecondImport = await listFiliations(db2);

    // Vérifie la préservation des données clés (noms, dates, liens)
    expect(personsAfterSecondImport).toHaveLength(personsAfterFirstImport.length);
    expect(unionsAfterSecondImport).toHaveLength(unionsAfterFirstImport.length);
    expect(filiationsAfterSecondImport).toHaveLength(filiationsAfterFirstImport.length);

    const names1 = personsAfterFirstImport.map((p) => `${p.firstName} ${p.lastName}`).sort();
    const names2 = personsAfterSecondImport.map((p) => `${p.firstName} ${p.lastName}`).sort();
    expect(names2).toEqual(names1);

    // Dates clés préservées
    const henri1 = personsAfterFirstImport.find((p) => p.firstName === "Henri");
    const henri2 = personsAfterSecondImport.find((p) => p.firstName === "Henri");
    expect(henri2?.birthDate).toBe(henri1?.birthDate);
  });
});
