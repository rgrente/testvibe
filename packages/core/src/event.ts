/**
 * Opérations CRUD pour l'entité Event (événements biographiques).
 * Liés à une Person (obligatoire) et optionnellement à une Union.
 */
import { eq } from "drizzle-orm";
import { event, type Database } from "@testvibe/db";
import type { Event, EventInput, FamilyTimelineItem } from "./types.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { listPersons } from "./person.js";

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function assertValidEventInput(input: EventInput): void {
  if (!input.personId || input.personId <= 0) {
    throw new ValidationError("personId est requis et doit être > 0.");
  }
  const validTypes = ["naissance", "décès", "mariage", "libre"] as const;
  if (!validTypes.includes(input.type as (typeof validTypes)[number])) {
    throw new ValidationError(`type invalide : ${input.type}`);
  }
  if (input.eventDate != null && !isValidDate(input.eventDate)) {
    throw new ValidationError(`eventDate invalide : ${input.eventDate}`);
  }
}

function toEvent(row: typeof event.$inferSelect): Event {
  return {
    id: row.id,
    personId: row.personId,
    unionId: row.unionId ?? null,
    type: row.type as Event["type"],
    label: row.label ?? null,
    eventDate: row.eventDate ?? null,
    description: row.description ?? null,
  };
}

export async function createEvent(db: Database, input: EventInput): Promise<Event> {
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
    })
    .returning();
  return toEvent(row);
}

export async function getEventById(db: Database, id: number): Promise<Event> {
  const [row] = await db.select().from(event).where(eq(event.id, id));
  if (!row) {
    throw new NotFoundError("Event", id);
  }
  return toEvent(row);
}

export async function listEventsByPerson(db: Database, personId: number): Promise<Event[]> {
  const rows = await db.select().from(event).where(eq(event.personId, personId));
  // Sort chronologically (nulls last)
  rows.sort((a, b) => {
    const da = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
    const db2 = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
    return da - db2;
  });
  return rows.map(toEvent);
}

export async function listAllEvents(db: Database): Promise<Event[]> {
  const rows = await db.select().from(event);
  return rows.map(toEvent);
}

/**
 * Charge les événements ainsi que les dates de naissance et de décès portées
 * par les personnes, puis les trie chronologiquement. Un événement métier déjà
 * présent pour le même fait biographique n'est pas dupliqué, quelle que soit
 * la précision de sa date ; la date portée par Person reste la référence affichée.
 * Les dates absentes ou inexploitables restent présentes à la fin de la liste.
 */
export async function listFamilyTimeline(db: Database): Promise<FamilyTimelineItem[]> {
  const [events, persons] = await Promise.all([listAllEvents(db), listPersons(db)]);
  const personsById = new Map(persons.map((person) => [person.id, person]));
  const representedBiographicalFacts = new Set<string>();

  const entries: FamilyTimelineItem[] = events
    .map((event) => {
      const person = personsById.get(event.personId);
      if (!person) return undefined;

      const personDate =
        event.type === "naissance"
          ? person.birthDate
          : event.type === "décès"
            ? person.deathDate
            : null;
      if (personDate) {
        const factKey = `${person.id}:${event.type}`;
        if (representedBiographicalFacts.has(factKey)) return undefined;
        representedBiographicalFacts.add(factKey);
      }

      return {
        key: `event:${event.id}`,
        event: {
          type: event.type,
          label: event.label,
          eventDate: personDate ?? event.eventDate,
          description: event.description,
        },
        person,
      };
    })
    .filter((entry): entry is FamilyTimelineItem => entry !== undefined);

  for (const person of persons) {
    for (const [type, eventDate] of [
      ["naissance", person.birthDate],
      ["décès", person.deathDate],
    ] as const) {
      const factKey = `${person.id}:${type}`;
      if (!eventDate || representedBiographicalFacts.has(factKey)) continue;

      entries.push({
        key: `person:${person.id}:${type}`,
        event: { type, eventDate, label: null, description: null },
        person,
      });
    }
  }

  return entries.sort((a, b) => {
    const aTimestamp = a.event.eventDate ? Date.parse(a.event.eventDate) : Number.POSITIVE_INFINITY;
    const bTimestamp = b.event.eventDate ? Date.parse(b.event.eventDate) : Number.POSITIVE_INFINITY;
    const safeATimestamp = Number.isNaN(aTimestamp) ? Number.POSITIVE_INFINITY : aTimestamp;
    const safeBTimestamp = Number.isNaN(bTimestamp) ? Number.POSITIVE_INFINITY : bTimestamp;

    if (safeATimestamp !== safeBTimestamp) return safeATimestamp - safeBTimestamp;

    const aEventId = a.key.startsWith("event:") ? Number(a.key.slice("event:".length)) : null;
    const bEventId = b.key.startsWith("event:") ? Number(b.key.slice("event:".length)) : null;
    if (aEventId !== null && bEventId !== null) return aEventId - bEventId;

    return a.key.localeCompare(b.key);
  });
}

export async function updateEvent(
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
    })
    .where(eq(event.id, id))
    .returning();
  return toEvent(row);
}

export async function deleteEvent(db: Database, id: number): Promise<void> {
  await getEventById(db, id);
  await db.delete(event).where(eq(event.id, id));
}
