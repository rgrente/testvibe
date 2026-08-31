/**
 * Frontière d'accès aux données pour le mode édition admin (Phase 3, tâche #22).
 *
 * Symétrique de web-api.ts (lecture publique), ce module expose des
 * fonctions d'écriture (create/update/delete) pour Person, Union et
 * Filiation, en utilisant la connexion par défaut (`DATABASE_URL` ou
 * `file:./local.db`).
 *
 * Inclut également les fonctions d'import/export GEDCOM (Phase 4, tâche #23).
 *
 * apps/web n'appelle jamais @testvibe/db directement — toute la
 * logique métier reste dans packages/core.
 */
import { db as defaultDb } from "@testvibe/db";
import type {
  Person,
  PersonInput,
  Union,
  UnionInput,
  Filiation,
  FiliationInput,
  Event,
  EventInput,
  FiliationBatchInput,
  Media,
  MediaInput,
} from "./types.js";
import {
  createPerson,
  getPersonById,
  listPersons,
  updatePerson,
  deletePerson,
} from "./person.js";
import { createUnion, getUnionById, listUnions, updateUnion, deleteUnion } from "./union.js";
import {
  createFiliation,
  createFiliations,
  getFiliationById,
  listFiliations,
  updateFiliation,
  deleteFiliation,
} from "./filiation.js";
import {
  createEvent,
  getEventById,
  listEventsByPerson,
  listAllEvents,
  updateEvent,
  deleteEvent,
} from "./event.js";
import {
  createMedia,
  getMediaById,
  getMediaByFilename,
  listMediaByPerson,
  listMediaByEvent,
  deleteMedia,
} from "./media.js";
import { importGedcom, exportGedcom } from "./gedcom.js";

// ─── Person ──────────────────────────────────────────────────────────────────

export async function adminCreatePerson(input: PersonInput): Promise<Person> {
  return createPerson(defaultDb, input);
}

export async function adminGetPerson(id: number): Promise<Person> {
  return getPersonById(defaultDb, id);
}

export async function adminListPersons(): Promise<Person[]> {
  return listPersons(defaultDb);
}

export async function adminUpdatePerson(
  id: number,
  input: Partial<PersonInput>,
): Promise<Person> {
  return updatePerson(defaultDb, id, input);
}

export async function adminDeletePerson(id: number): Promise<void> {
  return deletePerson(defaultDb, id);
}

// ─── Union ────────────────────────────────────────────────────────────────────

export async function adminCreateUnion(input: UnionInput): Promise<Union> {
  return createUnion(defaultDb, input);
}

export async function adminGetUnion(id: number): Promise<Union> {
  return getUnionById(defaultDb, id);
}

export async function adminListUnions(): Promise<Union[]> {
  return listUnions(defaultDb);
}

export async function adminUpdateUnion(id: number, input: Partial<UnionInput>): Promise<Union> {
  return updateUnion(defaultDb, id, input);
}

export async function adminDeleteUnion(id: number): Promise<void> {
  return deleteUnion(defaultDb, id);
}

// ─── Filiation ────────────────────────────────────────────────────────────────

export async function adminCreateFiliation(input: FiliationInput): Promise<Filiation> {
  return createFiliation(defaultDb, input);
}

export async function adminCreateFiliations(input: FiliationBatchInput): Promise<Filiation[]> {
  return createFiliations(defaultDb, input);
}

export async function adminGetFiliation(id: number): Promise<Filiation> {
  return getFiliationById(defaultDb, id);
}

export async function adminListFiliations(): Promise<Filiation[]> {
  return listFiliations(defaultDb);
}

export async function adminUpdateFiliation(
  id: number,
  input: Partial<FiliationInput>,
): Promise<Filiation> {
  return updateFiliation(defaultDb, id, input);
}

export async function adminDeleteFiliation(id: number): Promise<void> {
  return deleteFiliation(defaultDb, id);
}

// ─── GEDCOM ───────────────────────────────────────────────────────────────────

/**
 * Importe un fichier GEDCOM dans la base de données par défaut.
 * Opération atomique : aucune donnée n'est persistée en cas d'erreur.
 *
 * @param gedcomText  Contenu textuel du fichier .ged.
 * @throws ValidationError si le fichier est malformé ou invalide.
 */
export async function adminImportGedcom(gedcomText: string): Promise<void> {
  return importGedcom(defaultDb, gedcomText);
}

/**
 * Exporte les données de la base par défaut vers un fichier GEDCOM 5.5.1.
 *
 * @returns Contenu textuel du fichier .ged généré.
 */
export async function adminExportGedcom(): Promise<string> {
  return exportGedcom(defaultDb);
}

// ─── Event ────────────────────────────────────────────────────────────────────

export async function adminCreateEvent(input: EventInput): Promise<Event> {
  return createEvent(defaultDb, input);
}

export async function adminGetEvent(id: number): Promise<Event> {
  return getEventById(defaultDb, id);
}

export async function adminListEventsByPerson(personId: number): Promise<Event[]> {
  return listEventsByPerson(defaultDb, personId);
}

export async function adminListAllEvents(): Promise<Event[]> {
  return listAllEvents(defaultDb);
}

export async function adminUpdateEvent(id: number, input: Partial<EventInput>): Promise<Event> {
  return updateEvent(defaultDb, id, input);
}

export async function adminDeleteEvent(id: number): Promise<void> {
  return deleteEvent(defaultDb, id);
}

// ─── Media ────────────────────────────────────────────────────────────────────

export async function adminCreateMedia(input: MediaInput): Promise<Media> {
  return createMedia(defaultDb, input);
}

export async function adminGetMedia(id: number): Promise<Media> {
  return getMediaById(defaultDb, id);
}

export async function adminGetMediaByFilename(filename: string): Promise<Media> {
  return getMediaByFilename(defaultDb, filename);
}

export async function adminListMediaByPerson(personId: number): Promise<Media[]> {
  return listMediaByPerson(defaultDb, personId);
}

export async function adminListMediaByEvent(eventId: number): Promise<Media[]> {
  return listMediaByEvent(defaultDb, eventId);
}

export async function adminDeleteMedia(id: number): Promise<void> {
  return deleteMedia(defaultDb, id);
}
