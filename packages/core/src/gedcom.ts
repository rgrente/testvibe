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
import { createEvent, updateEvent, deleteEvent, listAllEvents, listEventsByPerson } from "./event.js";
import type { FiliationRole } from "./types.js";
import { projectFamilyFacts } from "./projection.js";

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
  /** Lieu de naissance (PLAC sous BIRT). */
  birthPlace: string | null;
  /** Lieu de décès (PLAC sous DEAT). */
  deathPlace: string | null;
}

interface GedcomFam {
  xref: string;
  husbXref: string | null;
  wifeXref: string | null;
  hasMarriage: boolean;
  marriageDate: string | null;
  /** Lieu du mariage (PLAC sous MARR). */
  marriagePlace: string | null;
  /** Type explicite porté par un événement familial EVEN. */
  partnershipType: "pacs" | "libre" | null;
  partnershipDate: string | null;
  partnershipPlace: string | null;
  childXrefs: string[];
}

/** Événement libre (EVEN) avec PLAC. */
interface GedcomEven {
  personXref: string;
  type: "résidence" | "libre";
  value: string | null;
  date: string | null;
  place: string | null;
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
 * Convertit une date GEDCOM en représentation ISO de même précision
 * (ex: "15 MAR 1940" → "1940-03-15", "MAR 1940" → "1940-03").
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
    return `${monthYear[2]}-${month}`;
  }

  // Format "YYYY" seul
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    return yearOnly[1];
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

  const m = isoDate.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return isoDate;
  const month = MONTHS_REV[m[2]];
  if (!month) return isoDate;
  if (!m[3]) return `${month} ${m[1]}`;
  const day = parseInt(m[3], 10).toString();
  return `${day} ${month} ${m[1]}`;
}

/**
 * Parse le texte GEDCOM complet et retourne les individus et familles.
 * Lève ValidationError si le fichier est malformé ou vide.
 */
function parseGedcom(text: string): { indis: GedcomIndi[]; fams: GedcomFam[]; evens: GedcomEven[] } {
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
  const evens: GedcomEven[] = [];

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
      let birthPlace: string | null = null;
      let deathPlace: string | null = null;
      let inBirt = false;
      let inDeat = false;

      i++;
      while (i < parsed.length && parsed[i].level > 0) {
        const sub = parsed[i];
        if (sub.level === 1 && sub.tag === "NAME") {
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
        } else if (sub.level === 2 && sub.tag === "PLAC") {
          if (inBirt) {
            birthPlace = sub.value || null;
          } else if (inDeat) {
            deathPlace = sub.value || null;
          }
        } else if (sub.level === 1 && sub.tag === "RESI") {
          let residenceDate: string | null = null;
          let residencePlace: string | null = null;
          let residenceSubIdx = i + 1;
          while (residenceSubIdx < parsed.length && parsed[residenceSubIdx].level >= 2) {
            const residenceSub = parsed[residenceSubIdx];
            if (residenceSub.level === 2 && residenceSub.tag === "DATE") {
              residenceDate = parseGedcomDate(residenceSub.value);
            }
            if (residenceSub.level === 2 && residenceSub.tag === "PLAC") {
              residencePlace = residenceSub.value || null;
            }
            residenceSubIdx++;
          }
          evens.push({ personXref: xref, type: "résidence", value: null, date: residenceDate, place: residencePlace });
          inBirt = false;
          inDeat = false;
        } else if (sub.level === 1 && sub.tag === "EVEN") {
          // Événement libre sous INDI (ex: 1 EVEN, 2 TYPE ..., 2 DATE ..., 2 PLAC ...)
          // GEDCOM 5.5.1 porte normalement le libellé dans 2 TYPE. Certains
          // producteurs le placent directement sur 1 EVEN : gardons ce fallback.
          let evenLabel = sub.value || null;
          let evenDate: string | null = null;
          let evenPlace: string | null = null;
          let evenSubIdx = i + 1;
          while (evenSubIdx < parsed.length && parsed[evenSubIdx].level >= 2) {
            const esub = parsed[evenSubIdx];
            if (esub.level === 2 && esub.tag === "TYPE") {
              evenLabel = esub.value || evenLabel;
              evenSubIdx++;
              continue;
            }
            if (esub.level === 2 && esub.tag === "DATE") {
              evenDate = parseGedcomDate(esub.value);
            }
            if (esub.level === 2 && esub.tag === "PLAC") {
              evenPlace = esub.value || null;
            }
            evenSubIdx++;
          }
          evens.push({ personXref: xref, type: "libre", value: evenLabel, date: evenDate, place: evenPlace });
          inBirt = false;
          inDeat = false;
        }
        i++;
      }

      indis.push({ xref, firstName, lastName, birthName, gender, birthDate, deathDate, birthPlace, deathPlace });
      continue;
    }

    if (line.level === 0 && line.xref && line.tag === "FAM") {
      const xref = line.xref;
      let husbXref: string | null = null;
      let wifeXref: string | null = null;
      let hasMarriage = false;
      let marriageDate: string | null = null;
      let marriagePlace: string | null = null;
      let partnershipType: "pacs" | "libre" | null = null;
      let partnershipDate: string | null = null;
      let partnershipPlace: string | null = null;
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
          hasMarriage = true;
          inMarr = true;
        } else if (sub.level === 1 && sub.tag === "EVEN") {
          inMarr = false;
          let eventType: string | null = null;
          let eventDate: string | null = null;
          let eventPlace: string | null = null;
          let eventIndex = i + 1;
          while (eventIndex < parsed.length && parsed[eventIndex].level > 1) {
            const eventSub = parsed[eventIndex];
            if (eventSub.level === 2 && eventSub.tag === "TYPE") eventType = eventSub.value;
            if (eventSub.level === 2 && eventSub.tag === "DATE") eventDate = parseGedcomDate(eventSub.value);
            if (eventSub.level === 2 && eventSub.tag === "PLAC") eventPlace = eventSub.value || null;
            eventIndex++;
          }
          const normalizedType = eventType?.trim().toUpperCase();
          if (normalizedType === "PACS" || normalizedType === "UNION LIBRE") {
            partnershipType = normalizedType === "PACS" ? "pacs" : "libre";
            partnershipDate = eventDate;
            partnershipPlace = eventPlace;
          }
          i = eventIndex;
          continue;
        } else if (sub.level === 2 && sub.tag === "DATE" && inMarr) {
          marriageDate = parseGedcomDate(sub.value);
        } else if (sub.level === 2 && sub.tag === "PLAC" && inMarr) {
          marriagePlace = sub.value || null;
        } else if (sub.level === 1) {
          inMarr = false;
        }
        i++;
      }

      fams.push({
        xref,
        husbXref,
        wifeXref,
        hasMarriage,
        marriageDate,
        marriagePlace,
        partnershipType,
        partnershipDate,
        partnershipPlace,
        childXrefs,
      });
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

  return { indis, fams, evens };
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
  const { indis, fams, evens } = parseGedcom(text);

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
  const insertedEventIds: number[] = [];

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

    // 1b. Attacher le lieu (PLAC) aux événements naissance/décès. Grâce à
    // l'auto-sync (createPerson → syncBiographicalEvents), les événements
    // naissance/décès existent déjà pour toute Person avec une date. On met ici
    // à jour leur `place` (sans créer de doublon). Une Person avec un lieu mais
    // SANS date n'a pas d'événement auto : on le crée alors à la volée.
    for (const indi of indis) {
      const personId = xrefToId.get(indi.xref);
      if (!personId) continue;
      if (indi.birthPlace) {
        const existing = (await listEventsByPerson(db, personId)).find(
          (e) => e.type === "naissance",
        );
        if (existing) {
          if (existing.place !== indi.birthPlace) {
            await updateEvent(db, existing.id, { place: indi.birthPlace });
          }
        } else {
          const ev = await createEvent(db, {
            personId,
            type: "naissance",
            eventDate: indi.birthDate ?? null,
            place: indi.birthPlace,
          });
          insertedEventIds.push(ev.id);
        }
      }
      if (indi.deathPlace) {
        const existing = (await listEventsByPerson(db, personId)).find(
          (e) => e.type === "décès",
        );
        if (existing) {
          if (existing.place !== indi.deathPlace) {
            await updateEvent(db, existing.id, { place: indi.deathPlace });
          }
        } else {
          const ev = await createEvent(db, {
            personId,
            type: "décès",
            eventDate: indi.deathDate ?? null,
            place: indi.deathPlace,
          });
          insertedEventIds.push(ev.id);
        }
      }
    }

    // 1c. Créer les événements EVEN
    for (const even of evens) {
      const personId = xrefToId.get(even.personXref);
      if (!personId) continue;
      const ev = await createEvent(db, {
        personId,
        type: even.type,
        label: even.value,
        eventDate: even.date ?? null,
        place: even.place ?? null,
      });
      insertedEventIds.push(ev.id);
    }

    // 2. Insérer les familles (unions), leurs événements et filiations
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
        const unionType = fam.hasMarriage ? "mariage" : (fam.partnershipType ?? "libre");
        const unionDate = fam.hasMarriage ? fam.marriageDate : fam.partnershipDate;
        const unionPlace = fam.hasMarriage ? fam.marriagePlace : fam.partnershipPlace;
        const union = await createUnion(db, {
          type: unionType,
          startDate: unionDate,
          endDate: null,
          place: unionPlace,
          personIds,
        });
        insertedUnionIds.push(union.id);

        if (fam.hasMarriage && fam.marriagePlace) {
          for (const personId of personIds) {
            const ev = await createEvent(db, {
              personId,
              unionId: union.id,
              type: "mariage",
              eventDate: fam.marriageDate ?? null,
              place: fam.marriagePlace,
            });
            insertedEventIds.push(ev.id);
          }
        }

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
    // Rollback manuel : supprimer dans l'ordre inverse (filiations, events, unions, personnes)
    // Les fonctions delete sont importées en haut du module.
    for (const id of insertedFiliationIds.reverse()) {
      try { await deleteFiliation(db, id); } catch { /* ignoré lors du rollback */ }
    }
    for (const id of insertedEventIds.reverse()) {
      try { await deleteEvent(db, id); } catch { /* ignoré lors du rollback */ }
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
  const [persons, unions, filiations, events] = await Promise.all([
    listPersons(db),
    listUnions(db),
    listFiliations(db),
    listAllEvents(db),
  ]);
  const facts = projectFamilyFacts(persons, unions, events);

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

  // Indexer les événements par personne et type
  const birthEventByPersonId = new Map<number, string | null>(); // place
  const deathEventByPersonId = new Map<number, string | null>(); // place
  const individualEventsByPersonId = new Map<number, { type: "résidence" | "libre"; label: string | null; date: string | null; place: string | null }[]>();

  for (const person of persons) {
    individualEventsByPersonId.set(person.id, []);
  }

  for (const fact of facts) {
    const personId = fact.personIds[0];
    if (fact.category === "naissance" && fact.place) {
      if (!birthEventByPersonId.has(personId) || !birthEventByPersonId.get(personId)) {
        birthEventByPersonId.set(personId, fact.place);
      }
    }
    if (fact.category === "décès" && fact.place) {
      if (!deathEventByPersonId.has(personId) || !deathEventByPersonId.get(personId)) {
        deathEventByPersonId.set(personId, fact.place);
      }
    }
    if (fact.category === "résidence" || fact.category === "libre") {
      const arr = individualEventsByPersonId.get(personId) || [];
      arr.push({
        type: fact.category,
        label: fact.label,
        date: fact.date,
        place: fact.place,
      });
      individualEventsByPersonId.set(personId, arr);
    }
  }

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
        const birthPlace = birthEventByPersonId.get(p.id);
        if (birthPlace) lines.push(`2 PLAC ${birthPlace}`);
      }
    } else {
      // Date-less birth event with place only
      const birthPlace = birthEventByPersonId.get(p.id);
      if (birthPlace) {
        lines.push("1 BIRT");
        lines.push(`2 PLAC ${birthPlace}`);
      }
    }
    if (p.deathDate) {
      const gDate = toGedcomDate(p.deathDate);
      if (gDate) {
        lines.push("1 DEAT");
        lines.push(`2 DATE ${gDate}`);
        const deathPlace = deathEventByPersonId.get(p.id);
        if (deathPlace) lines.push(`2 PLAC ${deathPlace}`);
      }
    } else {
      const deathPlace = deathEventByPersonId.get(p.id);
      if (deathPlace) {
        lines.push("1 DEAT");
        lines.push(`2 PLAC ${deathPlace}`);
      }
    }
    // Free events with place
    const freeEvents = individualEventsByPersonId.get(p.id) || [];
    for (const freeEv of freeEvents) {
      lines.push(freeEv.type === "résidence" ? "1 RESI" : "1 EVEN");
      if (freeEv.type === "libre" && freeEv.label) lines.push(`2 TYPE ${freeEv.label}`);
      if (freeEv.date) {
        const gd = toGedcomDate(freeEv.date);
        if (gd) lines.push(`2 DATE ${gd}`);
      }
      if (freeEv.place) lines.push(`2 PLAC ${freeEv.place}`);
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

    const unionDate = union.startDate ? toGedcomDate(union.startDate) : null;
    if (union.type === "mariage") {
      lines.push("1 MARR");
      if (unionDate) lines.push(`2 DATE ${unionDate}`);
      if (union.place) lines.push(`2 PLAC ${union.place}`);
    } else {
      // GEDCOM 5.5.1 n'a pas de balise dédiée au PACS ou à l'union libre.
      // Un événement familial EVEN + TYPE préserve explicitement leur nature.
      lines.push("1 EVEN");
      lines.push(`2 TYPE ${union.type === "pacs" ? "PACS" : "UNION LIBRE"}`);
      if (unionDate) lines.push(`2 DATE ${unionDate}`);
      if (union.place) lines.push(`2 PLAC ${union.place}`);
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
