/**
 * Opérations CRUD pour l'entité Event (événements biographiques).
 * Liés à une Person (obligatoire) et optionnellement à une Union.
 */
import { eq } from "drizzle-orm";
import { event, type Database } from "@testvibe/db";
import type { Event, EventInput, FamilyTimelineItem } from "./types.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { listPersons } from "./person.js";
import { normalizePlace, assertValidCoordinates } from "./geo.js";
import { listCanonicalFamilyFacts } from "./projection.js";
import { compareGenealogicalDates, parseGenealogicalDate, type GenealogicalDate } from "./genealogical-date.js";
import { deleteGenealogicalDates, loadGenealogicalDates, persistGenealogicalDate } from "./genealogical-date-store.js";
import { runTransaction } from "./transaction.js";

function assertValidEventInput(input: EventInput): void {
  if (!input.personId || input.personId <= 0) {
    throw new ValidationError("personId est requis et doit être > 0.");
  }
  const validTypes = ["naissance", "décès", "mariage", "résidence", "libre"] as const;
  if (!validTypes.includes(input.type as (typeof validTypes)[number])) {
    throw new ValidationError(`type invalide : ${input.type}`);
  }
  if (input.eventDate != null) parseGenealogicalDate(input.eventDate);
  assertValidCoordinates(input.latitude, input.longitude);
  if (input.latitude != null && !input.place?.trim()) {
    throw new ValidationError("place est requis lorsque des coordonnées sont renseignées.");
  }
  if (input.visibility != null && !["public", "family", "private"].includes(input.visibility)) {
    throw new ValidationError(`visibility invalide : ${input.visibility}`);
  }
}

function toEvent(row: typeof event.$inferSelect, date?: GenealogicalDate): Event {
  return {
    id: row.id,
    personId: row.personId,
    unionId: row.unionId ?? null,
    type: row.type as Event["type"],
    label: row.label ?? null,
    eventDate: row.eventDate ?? null,
    dateQualification: date?.qualification,
    datePrecision: date?.precision,
    dateLowerBound: date?.lower,
    dateUpperBound: date?.upper,
    description: row.description ?? null,
    place: row.place ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    visibility: row.visibility,
  };
}

export async function createEventInTransaction(db: Database, input: EventInput): Promise<Event> {
  assertValidEventInput(input);
  const [row] = await db
    .insert(event)
    .values({
      personId: input.personId,
      unionId: input.unionId ?? null,
      type: input.type,
      label: input.label ?? null,
      eventDate: input.eventDate ?? null,
      description: input.description ?? null,
      place: normalizePlace(input.place),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      visibility: input.visibility ?? null,
    })
    .returning();
  await persistGenealogicalDate(db, "event", row.id, "event_date", input.eventDate ?? null);
  return getEventById(db, row.id);
}

export async function createEvent(db: Database, input: EventInput): Promise<Event> {
  return runTransaction(db, (transactionalDb) => createEventInTransaction(transactionalDb, input));
}

export async function getEventById(db: Database, id: number): Promise<Event> {
  const [row] = await db.select().from(event).where(eq(event.id, id));
  if (!row) {
    throw new NotFoundError("Event", id);
  }
  const date = (await loadGenealogicalDates(db, "event", id)).get("event_date");
  return toEvent(row, date);
}

export async function listEventsByPerson(db: Database, personId: number): Promise<Event[]> {
  const rows = await db.select().from(event).where(eq(event.personId, personId));
  const values = await Promise.all(rows.map(async (row) => toEvent(
    row,
    (await loadGenealogicalDates(db, "event", row.id)).get("event_date"),
  )));
  // Sort chronologically (nulls last)
  values.sort((a, b) => compareGenealogicalDates(
    eventGenealogicalDate(a),
    eventGenealogicalDate(b),
    String(a.id), String(b.id),
  ));
  return values;
}

export async function listAllEvents(db: Database): Promise<Event[]> {
  const rows = await db.select().from(event);
  return Promise.all(rows.map(async (row) => toEvent(
    row,
    (await loadGenealogicalDates(db, "event", row.id)).get("event_date"),
  )));
}

function eventGenealogicalDate(value: Event): GenealogicalDate | null {
  if (!value.eventDate) return null;
  if (value.dateQualification && value.datePrecision) {
    return {
      original: value.eventDate,
      qualification: value.dateQualification,
      precision: value.datePrecision,
      lower: value.dateLowerBound ?? null,
      upper: value.dateUpperBound ?? null,
    };
  }
  return parseGenealogicalDate(value.eventDate);
}

/**
 * Charge les événements ainsi que les dates de naissance et de décès portées
 * par les personnes, puis les trie chronologiquement. Un événement métier déjà
 * présent pour le même fait biographique n'est pas dupliqué, quelle que soit
 * la précision de sa date ; la date portée par Person reste la référence affichée.
 * Les dates absentes ou inexploitables restent présentes à la fin de la liste.
 */
export async function listFamilyTimeline(db: Database): Promise<FamilyTimelineItem[]> {
  const [facts, persons] = await Promise.all([listCanonicalFamilyFacts(db), listPersons(db)]);
  const personsById = new Map(persons.map((person) => [person.id, person]));
  return facts.flatMap((fact) => fact.personIds.flatMap((personId) => {
    const person = personsById.get(personId);
    if (!person) return [];
    return [{
      key: fact.identity,
      event: {
        type: fact.category,
        label: fact.label,
        eventDate: fact.date,
        dateQualification: fact.dateQualification,
        description: fact.description,
      },
      person,
    }];
  }));
}

async function updateEventInTransaction(
  db: Database,
  id: number,
  input: Partial<EventInput>,
): Promise<Event> {
  const existing = await getEventById(db, id);
  const merged: EventInput = {
    personId: input.personId ?? existing.personId,
    unionId: input.unionId !== undefined ? input.unionId : existing.unionId,
    type: input.type ?? existing.type,
    label: input.label !== undefined ? input.label : existing.label,
    eventDate: input.eventDate !== undefined ? input.eventDate : existing.eventDate,
    description: input.description !== undefined ? input.description : existing.description,
    place: input.place !== undefined ? normalizePlace(input.place) : existing.place,
    latitude: input.latitude !== undefined ? input.latitude : existing.latitude,
    longitude: input.longitude !== undefined ? input.longitude : existing.longitude,
    visibility: input.visibility !== undefined ? input.visibility : existing.visibility,
  };
  assertValidEventInput(merged);
  const [row] = await db
    .update(event)
    .set({
      personId: merged.personId,
      unionId: merged.unionId ?? null,
      type: merged.type,
      label: merged.label ?? null,
      eventDate: merged.eventDate ?? null,
      description: merged.description ?? null,
      place: merged.place ?? null,
      latitude: merged.latitude ?? null,
      longitude: merged.longitude ?? null,
      visibility: merged.visibility ?? null,
    })
    .where(eq(event.id, id))
    .returning();
  if (input.eventDate !== undefined) {
    await persistGenealogicalDate(db, "event", row.id, "event_date", merged.eventDate ?? null);
  }
  return getEventById(db, row.id);
}

export async function updateEvent(db: Database, id: number, input: Partial<EventInput>): Promise<Event> {
  return runTransaction(db, (transactionalDb) => updateEventInTransaction(transactionalDb, id, input));
}

async function deleteEventInTransaction(db: Database, id: number): Promise<void> {
  await getEventById(db, id);
  await deleteGenealogicalDates(db, "event", id);
  await db.delete(event).where(eq(event.id, id));
}

export async function deleteEvent(db: Database, id: number): Promise<void> {
  return runTransaction(db, (transactionalDb) => deleteEventInTransaction(transactionalDb, id));
}

/**
 * Retourne les événements géolocalisés (avec latitude ET longitude) destinés
 * à la carte publique. Conserve uniquement les événements ayant à la fois des
 * coordonnées et un lieu.
 */
export async function listMapLocations(
  db: Database,
  persons?: import("./types.js").Person[],
): Promise<{ event: Event; person: import("./types.js").Person }[]> {
  const [allPersons, allEvents] = await Promise.all([
    persons ?? listPersons(db),
    listAllEvents(db),
  ]);
  const personsById = new Map(allPersons.map((p) => [p.id, p]));
  return allEvents
    .filter((ev) => {
      // Doit avoir des coordonnées
      if (ev.latitude == null || ev.longitude == null) return false;
      // Doit avoir une place
      if (!ev.place) return false;
      return true;
    })
    .map((ev) => {
      const person = personsById.get(ev.personId)!;
      return { event: ev, person };
    });
}
