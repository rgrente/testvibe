/**
 * Import/export GEDCOM 5.5.1 pour packages/core (Phase 4, tâche #23).
 *
 * Implémente :
 * - `importGedcom(db, gedcomText)` : parsing GEDCOM → Person/Union/Filiation
 *   atomique (rollback complet en cas d'erreur).
 * - `exportGedcom(db)` : Person/Union/Filiation → fichier .ged GEDCOM 5.5.1.
 *
 * Périmètre : sous-ensemble GEDCOM 5.5.1 standard.
 * Hors périmètre : formats non-standard, fusion/dédoublonnage.
 */
import type { Database } from "@testvibe/db";
import { ValidationError } from "./errors.js";
import { createPerson, listPersons, deletePerson } from "./person.js";
import { createUnion, listUnions, deleteUnion } from "./union.js";
import { createFiliation, listFiliations, deleteFiliation } from "./filiation.js";
import type { FiliationRole } from "./types.js";

// ─── Types internes ───────────────────────────────────────────────────────────

interface GedcomLine {
  level: number;
  xref: string | null; // ex: "@I1@"
  tag: string;
  value: string;
}

interface GedcomIndi {
  xref: string;
  firstName: string;
  lastName: string;
  birthName: string | null;
  gender: string | null;
  birthDate: string | null;
  deathDate: string | null;
}

interface GedcomFam {
  xref: string;
  husbXref: string | null;
  wifeXref: string | null;
  marriageDate: string | null;
  childXrefs: string[];
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

/**
 * Parse une ligne GEDCOM.
 * Format : `LEVEL [XREF] TAG [VALUE]`
 */
function parseLine(raw: string): GedcomLine | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Le premier token doit être un nombre (niveau)
  const match = trimmed.match(/^(\d+)\s+(@[^@]+@)?\s*([A-Z_0-9]+)(\s+(.*))?$/);
  if (!match) return null;

  return {
    level: parseInt(match[1], 10),
    xref: match[2]?.trim() ?? null,
    tag: match[3].trim(),
    value: (match[5] ?? "").trim(),
  };
}

/**
 * Convertit une date GEDCOM (ex: "15 MAR 1940") en ISO 8601 (ex: "1940-03-15").
 * Retourne null si la date ne peut pas être parsée.
 */
function parseGedcomDate(raw: string): string | null {
  if (!raw) return null;

  const MONTHS: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  };

  // Format "DD MON YYYY"
  const full = raw.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
  if (full) {
    const month = MONTHS[full[2]];
    if (!month) return null;
    const day = full[1].padStart(2, "0");
    return `${full[3]}-${month}-${day}`;
  }

  // Format "MON YYYY"
  const monthYear = raw.match(/^([A-Z]{3})\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1]];
    if (!month) return null;
    return `${monthYear[2]}-${month}-01`;
  }

  // Format "YYYY" seul
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    return `${yearOnly[1]}-01-01`;
  }

  // Format ISO direct
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;

  return null;
}

/**
 * Convertit une date ISO en date GEDCOM (ex: "1940-03-15" → "15 MAR 1940").
 */
function toGedcomDate(isoDate: string | null): string | null {
  if (!isoDate) return null;

  const MONTHS_REV: Record<string, string> = {
    "01": "JAN", "02": "FEB", "03": "MAR", "04": "APR",
    "05": "MAY", "06": "JUN", "07": "JUL", "08": "AUG",
    "09": "SEP", "10": "OCT", "11": "NOV", "12": "DEC",
  };

  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const day = parseInt(m[3], 10).toString();
  const month = MONTHS_REV[m[2]];
  if (!month) return isoDate;
  return `${day} ${month} ${m[1]}`;
}

/**
 * Parse le texte GEDCOM complet et retourne les individus et familles.
 * Lève ValidationError si le fichier est malformé ou vide.
 */
function parseGedcom(text: string): { indis: GedcomIndi[]; fams: GedcomFam[] } {
  const lines = text.split(/\r?\n/);
  const parsed: GedcomLine[] = [];

  for (const raw of lines) {
    const line = parseLine(raw);
    if (line !== null) {
      parsed.push(line);
    }
  }

  // Vérifie la présence minimale d'un HEAD et TRLR
  const hasHead = parsed.some((l) => l.level === 0 && l.tag === "HEAD");
  const hasTrlr = parsed.some((l) => l.level === 0 && l.tag === "TRLR");

  if (!hasHead || !hasTrlr) {
    throw new ValidationError(
      "Fichier GEDCOM malformé : les balises HEAD et TRLR sont requises.",
    );
  }

  // Extraction des individus (INDI)
  const indis: GedcomIndi[] = [];
  const fams: GedcomFam[] = [];

  let i = 0;
  while (i < parsed.length) {
    const line = parsed[i];

    if (line.level === 0 && line.xref && line.tag === "INDI") {
      const xref = line.xref;
      let firstName = "";
      let lastName = "";
      let birthName: string | null = null;
      let gender: string | null = null;
      let birthDate: string | null = null;
      let deathDate: string | null = null;
      let inBirt = false;
      let inDeat = false;

      i++;
      while (i < parsed.length && parsed[i].level > 0) {
        const sub = parsed[i];
        if (sub.level === 1 && sub.tag === "NAME") {
          // Le NAME principal reste le nom courant. Un NAME immédiatement suivi
          // de `2 TYPE birth` porte uniquement le nom de naissance.
          const nameVal = sub.value;
          const nameMatch = nameVal.match(/^(.*?)\s*\/([^/]*)\//);
          const parts = nameVal.trim().split(/\s+/);
          const parsedFirstName = nameMatch
            ? nameMatch[1].trim()
            : parts.length >= 2 ? parts.slice(0, -1).join(" ") : nameVal.trim();
          const parsedLastName = nameMatch
            ? nameMatch[2].trim()
            : parts.length >= 2 ? parts[parts.length - 1] : "";
          const next = parsed[i + 1];
          const isBirthName =
            next?.level === 2 && next.tag === "TYPE" && next.value.toLowerCase() === "birth";
          if (isBirthName) {
            birthName = parsedLastName || null;
          } else {
            firstName = parsedFirstName;
            lastName = parsedLastName;
          }
          inBirt = false;
          inDeat = false;
        } else if (sub.level === 1 && sub.tag === "SEX") {
          gender = sub.value || null;
          inBirt = false;
          inDeat = false;
        } else if (sub.level === 1 && sub.tag === "BIRT") {
          inBirt = true;
          inDeat = false;
        } else if (sub.level === 1 && sub.tag === "DEAT") {
          inDeat = true;
          inBirt = false;
        } else if (sub.level === 2 && sub.tag === "DATE") {
          if (inBirt) {
            birthDate = parseGedcomDate(sub.value);
          } else if (inDeat) {
            deathDate = parseGedcomDate(sub.value);
          }
        } else if (sub.level === 1) {
          inBirt = false;
          inDeat = false;
        }
        i++;
      }

      indis.push({ xref, firstName, lastName, birthName, gender, birthDate, deathDate });
      continue;
    }

    if (line.level === 0 && line.xref && line.tag === "FAM") {
      const xref = line.xref;
      let husbXref: string | null = null;
      let wifeXref: string | null = null;
      let marriageDate: string | null = null;
      const childXrefs: string[] = [];
      let inMarr = false;

      i++;
      while (i < parsed.length && parsed[i].level > 0) {
        const sub = parsed[i];
        if (sub.level === 1 && sub.tag === "HUSB") {
          husbXref = sub.value;
          inMarr = false;
        } else if (sub.level === 1 && sub.tag === "WIFE") {
          wifeXref = sub.value;
          inMarr = false;
        } else if (sub.level === 1 && sub.tag === "CHIL") {
          childXrefs.push(sub.value);
          inMarr = false;
        } else if (sub.level === 1 && sub.tag === "MARR") {
          inMarr = true;
        } else if (sub.level === 2 && sub.tag === "DATE" && inMarr) {
          marriageDate = parseGedcomDate(sub.value);
        } else if (sub.level === 1) {
          inMarr = false;
        }
        i++;
      }

      fams.push({ xref, husbXref, wifeXref, marriageDate, childXrefs });
      continue;
    }

    i++;
  }

  // Validation : au moins un individu
  if (indis.length === 0) {
    throw new ValidationError(
      "Fichier GEDCOM invalide : aucun individu (INDI) trouvé.",
    );
  }

  // Validation : toutes les références de familles pointent vers des INDI connus
  const indiXrefs = new Set(indis.map((i) => i.xref));
  for (const fam of fams) {
    if (fam.husbXref && !indiXrefs.has(fam.husbXref)) {
      throw new ValidationError(
        `Famille ${fam.xref} référence un mari inconnu : ${fam.husbXref}`,
      );
    }
    if (fam.wifeXref && !indiXrefs.has(fam.wifeXref)) {
      throw new ValidationError(
        `Famille ${fam.xref} référence une épouse inconnue : ${fam.wifeXref}`,
      );
    }
    for (const childXref of fam.childXrefs) {
      if (!indiXrefs.has(childXref)) {
        throw new ValidationError(
          `Famille ${fam.xref} référence un enfant inconnu : ${childXref}`,
        );
      }
    }
  }

  return { indis, fams };
}

// ─── Import GEDCOM ────────────────────────────────────────────────────────────

/**
 * Importe un fichier GEDCOM dans la base de données.
 *
 * L'opération est atomique : si une erreur survient (GEDCOM malformé ou
 * échec d'insertion), aucune donnée n'est persistée.
 *
 * @param db    Instance de base de données Drizzle.
 * @param text  Contenu textuel du fichier .ged.
 * @throws ValidationError si le fichier est malformé ou invalide.
 */
export async function importGedcom(db: Database, text: string): Promise<void> {
  // Parse d'abord (lève ValidationError si malformé, avant toute écriture)
  const { indis, fams } = parseGedcom(text);

  // Insertion atomique via manual rollback-on-error.
  // Note : libSQL en mode :memory: ne supporte pas db.transaction() de façon
  // fiable avec plusieurs connexions (chaque tx peut ouvrir une connexion
  // séparée sur une base vide). On implémente l'atomicité manuellement :
  // on insère séquentiellement, et en cas d'erreur on supprime tout ce qu'on
  // a inséré pour garantir qu'aucune donnée partielle ne persiste.
  //
  // Map xref GEDCOM → id base de données
  const xrefToId = new Map<string, number>();
  const insertedPersonIds: number[] = [];
  const insertedUnionIds: number[] = [];
  const insertedFiliationIds: number[] = [];

  try {
    // 1. Insérer les individus
    for (const indi of indis) {
      const person = await createPerson(db, {
        firstName: indi.firstName || "(inconnu)",
        lastName: indi.lastName || "(inconnu)",
        birthName: indi.birthName,
        birthDate: indi.birthDate ?? null,
        deathDate: indi.deathDate ?? null,
        gender: indi.gender ?? null,
      });
      xrefToId.set(indi.xref, person.id);
      insertedPersonIds.push(person.id);
    }

    // 2. Insérer les familles (unions) et filiations
    for (const fam of fams) {
      const personIds: number[] = [];
      if (fam.husbXref) {
        const id = xrefToId.get(fam.husbXref);
        if (id !== undefined) personIds.push(id);
      }
      if (fam.wifeXref) {
        const id = xrefToId.get(fam.wifeXref);
        if (id !== undefined) personIds.push(id);
      }

      // Crée l'union si elle a au moins un partenaire
      if (personIds.length > 0) {
        const union = await createUnion(db, {
          startDate: fam.marriageDate ?? null,
          endDate: null,
          personIds,
        });
        insertedUnionIds.push(union.id);

        // 3. Créer les filiations : chaque partenaire → enfant
        for (const childXref of fam.childXrefs) {
          const childId = xrefToId.get(childXref);
          if (childId === undefined) continue;

          for (const parentId of personIds) {
            const fil = await createFiliation(db, {
              parentId,
              childId,
              role: "biologique" as FiliationRole,
            });
            insertedFiliationIds.push(fil.id);
          }
        }
      }
    }
  } catch (error) {
    // Rollback manuel : supprimer dans l'ordre inverse (filiations, unions, personnes)
    // Les fonctions delete sont importées en haut du module.
    for (const id of insertedFiliationIds.reverse()) {
      try { await deleteFiliation(db, id); } catch { /* ignoré lors du rollback */ }
    }
    for (const id of insertedUnionIds.reverse()) {
      try { await deleteUnion(db, id); } catch { /* ignoré lors du rollback */ }
    }
    for (const id of insertedPersonIds.reverse()) {
      try { await deletePerson(db, id); } catch { /* ignoré lors du rollback */ }
    }
    throw error;
  }
}

// ─── Export GEDCOM ────────────────────────────────────────────────────────────

/**
 * Exporte les données de la base vers un fichier GEDCOM 5.5.1.
 *
 * @param db  Instance de base de données Drizzle.
 * @returns   Contenu textuel du fichier .ged généré.
 */
export async function exportGedcom(db: Database): Promise<string> {
  const [persons, unions, filiations] = await Promise.all([
    listPersons(db),
    listUnions(db),
    listFiliations(db),
  ]);

  const lines: string[] = [];

  // ─── HEAD ─────────────────────────────────────────────────────────────────
  lines.push("0 HEAD");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("1 CHAR UTF-8");

  // ─── Individus ────────────────────────────────────────────────────────────
  // Map id → xref pour les familles
  const idToXref = new Map<number, string>();
  persons.forEach((p, idx) => {
    const xref = `@I${idx + 1}@`;
    idToXref.set(p.id, xref);
  });

  for (const [idx, p] of persons.entries()) {
    const xref = `@I${idx + 1}@`;
    lines.push(`0 ${xref} INDI`);
    lines.push(`1 NAME ${p.firstName} /${p.lastName}/`);
    if (p.birthName) {
      lines.push(`1 NAME ${p.firstName} /${p.birthName}/`);
      lines.push("2 TYPE birth");
    }
    if (p.gender) {
      lines.push(`1 SEX ${p.gender}`);
    }
    if (p.birthDate) {
      const gDate = toGedcomDate(p.birthDate);
      if (gDate) {
        lines.push("1 BIRT");
        lines.push(`2 DATE ${gDate}`);
      }
    }
    if (p.deathDate) {
      const gDate = toGedcomDate(p.deathDate);
      if (gDate) {
        lines.push("1 DEAT");
        lines.push(`2 DATE ${gDate}`);
      }
    }
  }

  // ─── Familles ─────────────────────────────────────────────────────────────
  // On reconstitue les familles à partir des unions et filiations.
  // Une union avec personIds → famille ; filiations → CHIL dans cette famille.
  for (const [idx, union] of unions.entries()) {
    const famXref = `@F${idx + 1}@`;
    lines.push(`0 ${famXref} FAM`);

    // Partenaires de l'union — sépare husb/wife par genre si connu
    const partners = union.personIds
      .map((pid) => persons.find((p) => p.id === pid))
      .filter((p): p is (typeof persons)[number] => p !== undefined);

    let husb: (typeof persons)[number] | undefined = partners.find((p) => p.gender === "M");
    let wife: (typeof persons)[number] | undefined = partners.find((p) => p.gender === "F");

    // Si pas de genre défini, utiliser l'ordre de personIds
    if (!husb && !wife && partners.length >= 2) {
      husb = partners[0];
      wife = partners[1];
    } else if (!husb && partners.length >= 1) {
      husb = partners.find((p) => p !== wife);
    } else if (!wife && partners.length >= 1) {
      wife = partners.find((p) => p !== husb);
    }

    if (husb) {
      const xref = idToXref.get(husb.id);
      if (xref) lines.push(`1 HUSB ${xref}`);
    }
    if (wife) {
      const xref = idToXref.get(wife.id);
      if (xref) lines.push(`1 WIFE ${xref}`);
    }

    if (union.startDate) {
      const gDate = toGedcomDate(union.startDate);
      if (gDate) {
        lines.push("1 MARR");
        lines.push(`2 DATE ${gDate}`);
      }
    }

    // Enfants : filiations où parentId ∈ union.personIds
    // Déduplique les enfants (un enfant peut avoir deux parents dans la même union)
    const partnerIds = new Set(union.personIds);
    const childIds = new Set<number>();
    for (const fil of filiations) {
      if (partnerIds.has(fil.parentId)) {
        childIds.add(fil.childId);
      }
    }
    for (const childId of childIds) {
      const xref = idToXref.get(childId);
      if (xref) lines.push(`1 CHIL ${xref}`);
    }
  }

  // ─── TRLR ─────────────────────────────────────────────────────────────────
  lines.push("0 TRLR");

  return lines.join("\n") + "\n";
}
