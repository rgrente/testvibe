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
import { listAllEvents, listFamilyTimeline } from "./event.js";
import { anniversariesForDate } from "./anniversary.js";
import { ValidationError } from "./errors.js";
import { sql } from "drizzle-orm";

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
2 PLAC Paris, France
0 @I2@ INDI
1 NAME Marie /DUPONT/
1 NAME Marie /DURAND/
2 TYPE birth
1 SEX F
1 BIRT
2 DATE 20 JUN 1945
1 DEAT
2 DATE 10 NOV 2020
2 PLAC Lyon, France
1 EVEN
2 TYPE Déménagement
2 DATE 15 JAN 1970
2 PLAC Bordeaux, France
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
2 PLAC Mairie de Paris
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
    expect(marie?.birthName).toBe("DURAND");
    expect(persons.every((person) => person.visibility === "public")).toBe(true);

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

  it("annule tout l'import lorsqu'une écriture tardive échoue", async () => {
    await db.run(sql.raw(`CREATE TRIGGER fail_gedcom_partner BEFORE INSERT ON union_partner
      BEGIN SELECT RAISE(FAIL, 'échec GEDCOM injecté'); END`));

    await expect(importGedcom(db, VALID_GEDCOM)).rejects.toThrow();

    expect(await listPersons(db)).toHaveLength(0);
    expect(await listUnions(db)).toHaveLength(0);
    expect(await listFiliations(db)).toHaveLength(0);
    expect(await listAllEvents(db)).toHaveLength(0);
  });

  it("preserve le libellé d'un EVEN porté par 2 TYPE, et retombe sur 1 EVEN sinon", async () => {
    // 2 TYPE doit primer sur une éventuelle valeur de 1 EVEN.
    const withType = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Henri /MARTIN/
1 SEX M
1 EVEN Fallback
2 TYPE Déménagement
2 PLAC Bordeaux, France
0 TRLR
`;
    await importGedcom(db, withType);
    let events = await listAllEvents(db);
    const typeEv = events.find((e) => e.type === "libre" && e.place === "Bordeaux, France");
    expect(typeEv?.label).toBe("Déménagement");

    // Sans 2 TYPE, la valeur portée par 1 EVEN sert de libellé (fallback).
    const withoutType = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I2@ INDI
1 NAME Marie /DUPONT/
1 SEX F
1 EVEN Voyage à Rome
2 PLAC Rome, Italie
0 TRLR
`;
    await importGedcom(db, withoutType);
    events = await listAllEvents(db);
    const fallbackEv = events.find((e) => e.type === "libre" && e.place === "Rome, Italie");
    expect(fallbackEv?.label).toBe("Voyage à Rome");
  });

  it("préserve la précision des dates partielles sans créer de faux anniversaire", async () => {
    const partialDates = `0 HEAD
0 @I1@ INDI
1 NAME Année /SEULE/
1 BIRT
2 DATE 1980
0 @I2@ INDI
1 NAME Mois /SEUL/
1 BIRT
2 DATE AUG 1990
1 EVEN
2 TYPE Voyage
2 DATE AUG 2010
2 PLAC Paris
0 TRLR
`;

    await importGedcom(db, partialDates);

    const persons = await listPersons(db);
    expect(persons.find((person) => person.firstName === "Année")?.birthDate).toBe("1980");
    expect(persons.find((person) => person.firstName === "Mois")?.birthDate).toBe("1990-08");
    expect((await listAllEvents(db)).find((event) => event.label === "Voyage")?.eventDate).toBe("2010-08");
    expect(anniversariesForDate(await listFamilyTimeline(db), "2026-08-01")).toEqual([]);

    const exported = await exportGedcom(db);
    expect(exported).toContain("2 DATE 1980");
    expect(exported.match(/2 DATE AUG 1990/g)).toHaveLength(1);
    expect(exported.match(/2 DATE AUG 2010/g)).toHaveLength(1);
  });

  it("préserve RESI comme résidence explicite à l'aller-retour", async () => {
    const residenceGedcom = `0 HEAD
0 @I1@ INDI
1 NAME Alice /MARTIN/
1 RESI
2 DATE MAR 2005
2 PLAC Lyon, France
0 TRLR
`;

    await importGedcom(db, residenceGedcom);
    expect(await listAllEvents(db)).toMatchObject([
      { type: "résidence", label: null, eventDate: "2005-03", place: "Lyon, France" },
    ]);

    const exported = await exportGedcom(db);
    expect(exported).toContain("1 RESI\n2 DATE MAR 2005\n2 PLAC Lyon, France");
    expect(exported).not.toContain("2 TYPE Résidence");

    const db2 = await createTestDb();
    await importGedcom(db2, exported);
    expect(await listAllEvents(db2)).toMatchObject([
      { type: "résidence", label: null, eventDate: "2005-03", place: "Lyon, France" },
    ]);
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
    expect(ged).toContain("1 NAME Marie /DURAND/\n2 TYPE birth");
  });

  it("aller-retour import→export→import : pas de perte de données clés", async () => {
    // Import initial
    await importGedcom(db, VALID_GEDCOM);
    const personsAfterFirstImport = await listPersons(db);
    const unionsAfterFirstImport = await listUnions(db);
    const filiationsAfterFirstImport = await listFiliations(db);
    const moveAfterFirstImport = (await listAllEvents(db)).find(
      (event) => event.type === "libre" && event.place === "Bordeaux, France",
    );
    expect(moveAfterFirstImport).toMatchObject({
      label: "Déménagement",
      eventDate: "1970-01-15",
      place: "Bordeaux, France",
    });

    // Export
    const exported = await exportGedcom(db);
    expect(exported).toContain("1 EVEN\n2 TYPE Déménagement\n2 DATE 15 JAN 1970\n2 PLAC Bordeaux, France");

    // Second import dans une base fraîche
    const db2 = await createTestDb();
    await importGedcom(db2, exported);
    const personsAfterSecondImport = await listPersons(db2);
    const unionsAfterSecondImport = await listUnions(db2);
    const filiationsAfterSecondImport = await listFiliations(db2);
    const moveAfterSecondImport = (await listAllEvents(db2)).find(
      (event) => event.type === "libre" && event.place === "Bordeaux, France",
    );
    expect(moveAfterSecondImport).toMatchObject({
      label: "Déménagement",
      eventDate: "1970-01-15",
      place: "Bordeaux, France",
    });

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
    const marie2 = personsAfterSecondImport.find((p) => p.firstName === "Marie");
    expect(marie2?.lastName).toBe("DUPONT");
    expect(marie2?.birthName).toBe("DURAND");
  });

  it("préserve le lieu propre à chaque mariage quand une personne a plusieurs unions", async () => {
    const multipleMarriages = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Alex /MARTIN/
0 @I2@ INDI
1 NAME Camille /DUPONT/
0 @I3@ INDI
1 NAME Sam /BERNARD/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 1 JAN 1980
2 PLAC Paris
0 @F2@ FAM
1 HUSB @I1@
1 WIFE @I3@
1 MARR
2 DATE 2 FEB 1990
2 PLAC Lyon
0 TRLR
`;

    await importGedcom(db, multipleMarriages);
    const importedMarriageEvents = (await listAllEvents(db)).filter(
      (event) => event.type === "mariage",
    );
    expect(importedMarriageEvents).toHaveLength(4);
    expect(importedMarriageEvents.every((event) => event.unionId !== null)).toBe(true);
    expect(new Set(importedMarriageEvents.map((event) => event.unionId)).size).toBe(2);

    const exported = await exportGedcom(db);
    expect(exported).toMatch(/0 @F1@ FAM[\s\S]*?2 PLAC Paris/);
    expect(exported).toMatch(/0 @F2@ FAM[\s\S]*?2 PLAC Lyon/);

    const db2 = await createTestDb();
    await importGedcom(db2, exported);
    const roundTripPlaces = (await listAllEvents(db2))
      .filter((event) => event.type === "mariage")
      .map((event) => `${event.unionId}:${event.place}`);
    expect(new Set(roundTripPlaces).size).toBe(2);
    expect(roundTripPlaces.filter((value) => value.endsWith(":Paris"))).toHaveLength(2);
    expect(roundTripPlaces.filter((value) => value.endsWith(":Lyon"))).toHaveLength(2);
  });

  it("préserve les types mariage, PACS et union libre à l'aller-retour", async () => {
    const unionTypes = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Alice /A/
0 @I2@ INDI
1 NAME Bob /B/
0 @I3@ INDI
1 NAME Camille /C/
0 @I4@ INDI
1 NAME Dan /D/
0 @I5@ INDI
1 NAME Eve /E/
0 @I6@ INDI
1 NAME Fred /F/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR
2 DATE 1 JAN 2000
2 PLAC Paris
0 @F2@ FAM
1 HUSB @I3@
1 WIFE @I4@
1 EVEN
2 TYPE PACS
2 DATE 2 FEB 2002
2 PLAC Lyon
0 @F3@ FAM
1 HUSB @I5@
1 WIFE @I6@
1 EVEN
2 TYPE Union libre
2 DATE 3 MAR 2003
2 PLAC Lille
0 TRLR
`;

    await importGedcom(db, unionTypes);
    const importedByPlace = new Map((await listUnions(db)).map((union) => [union.place, union]));
    expect(importedByPlace.get("Paris")).toMatchObject({ type: "mariage", startDate: "2000-01-01" });
    expect(importedByPlace.get("Lyon")).toMatchObject({ type: "pacs", startDate: "2002-02-02" });
    expect(importedByPlace.get("Lille")).toMatchObject({ type: "libre", startDate: "2003-03-03" });

    const exported = await exportGedcom(db);
    expect(exported.match(/^1 MARR$/gm)).toHaveLength(1);
    expect(exported).toContain("1 EVEN\n2 TYPE PACS\n2 DATE 2 FEB 2002\n2 PLAC Lyon");
    expect(exported).toContain("1 EVEN\n2 TYPE UNION LIBRE\n2 DATE 3 MAR 2003\n2 PLAC Lille");

    const db2 = await createTestDb();
    await importGedcom(db2, exported);
    const roundTripByPlace = new Map((await listUnions(db2)).map((union) => [union.place, union]));
    expect(roundTripByPlace.get("Paris")?.type).toBe("mariage");
    expect(roundTripByPlace.get("Lyon")?.type).toBe("pacs");
    expect(roundTripByPlace.get("Lille")?.type).toBe("libre");
  });

  it("importe une famille sans événement comme union libre", async () => {
    const bareFamily = `0 HEAD
0 @I1@ INDI
1 NAME Alice /A/
0 @I2@ INDI
1 NAME Bob /B/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
0 TRLR
`;

    await importGedcom(db, bareFamily);
    expect(await listUnions(db)).toMatchObject([
      { type: "libre", startDate: null, place: null },
    ]);
  });
});

describe("GEDCOM naissance/décès : auto-sync + PLAC aller-retour", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("crée les événements naissance/décès à partir des dates et garde le PLAC à l'aller-retour", async () => {
    const ged = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Henri /MARTIN/
1 SEX M
1 BIRT
2 DATE 15 MAR 1940
2 PLAC Paris, France
1 DEAT
2 DATE 10 NOV 2020
2 PLAC Lyon, France
0 @I2@ INDI
1 NAME Louis /MARTIN/
1 SEX M
1 BIRT
2 DATE 5 APR 1968
0 TRLR
`;
    // Import initial : l'auto-sync (via createPerson) crée naissance/décès pour
    // toute Person datée ; le PLAC est attaché au bon événement, sans doublon.
    await importGedcom(db, ged);
    let events = await listAllEvents(db);
    const henriNaissance = events.find((e) => e.personId === 1 && e.type === "naissance");
    const henriDeces = events.find((e) => e.personId === 1 && e.type === "décès");
    const louisNaissance = events.find((e) => e.personId === 2 && e.type === "naissance");
    expect(henriNaissance).toMatchObject({ eventDate: "1940-03-15", place: "Paris, France" });
    expect(henriDeces).toMatchObject({ eventDate: "2020-11-10", place: "Lyon, France" });
    // Louis (date sans PLAC) a bien un événement naissance auto, sans lieu.
    expect(louisNaissance).toMatchObject({ eventDate: "1968-04-05", place: null });
    // Exactement un naissance par personne datée, jamais de doublon.
    expect(events.filter((e) => e.type === "naissance")).toHaveLength(2);

    // Aller-retour import → export → import sans perte.
    const exported = await exportGedcom(db);
    expect(exported).toContain("1 BIRT\n2 DATE 15 MAR 1940\n2 PLAC Paris, France");

    const db2 = await createTestDb();
    await importGedcom(db2, exported);
    events = await listAllEvents(db2);
    const henriNaissance2 = events.find((e) => e.type === "naissance" && e.place === "Paris, France");
    const henriDeces2 = events.find((e) => e.type === "décès" && e.place === "Lyon, France");
    expect(henriNaissance2).toMatchObject({ eventDate: "1940-03-15", place: "Paris, France" });
    expect(henriDeces2).toMatchObject({ eventDate: "2020-11-10", place: "Lyon, France" });
    // Deux personnes datées à la naissance → toujours exactement 2 naissances.
    expect(events.filter((e) => e.type === "naissance" && e.place)).toHaveLength(1);
  });

  it("préserve un PLAC naissance même sans date (événement non-auto créé à la volée)", async () => {
    const ged = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Marie /MARTIN/
1 SEX F
1 BIRT
2 PLAC Rome, Italie
0 TRLR
`;
    await importGedcom(db, ged);
    const birth = (await listAllEvents(db)).find((e) => e.type === "naissance");
    expect(birth).toMatchObject({ eventDate: null, place: "Rome, Italie" });

    const exported = await exportGedcom(db);
    expect(exported).toContain("1 BIRT\n2 PLAC Rome, Italie");

    const db2 = await createTestDb();
    await importGedcom(db2, exported);
    const roundTrip = (await listAllEvents(db2)).find((e) => e.type === "naissance");
    expect(roundTrip).toMatchObject({ eventDate: null, place: "Rome, Italie" });
  });
});
