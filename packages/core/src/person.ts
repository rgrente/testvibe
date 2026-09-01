/**
 * Opérations CRUD pures pour l'entité Person.
 * Aucune dépendance à Next.js/apps-web : uniquement Drizzle via
 * `@testvibe/db` (type `Database`).
 */
import { eq } from "drizzle-orm";
import { person, event, type Database } from "@testvibe/db";
import type { Person, PersonInput, EventType } from "./types.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { runTransaction } from "./transaction.js";
import { parseGenealogicalDate } from "./genealogical-date.js";
import { deleteGenealogicalDates, loadGenealogicalDates, persistGenealogicalDate } from "./genealogical-date-store.js";
import type { GenealogicalDate } from "./genealogical-date.js";

function assertValidPersonInput(input: PersonInput): void {
  if (!input.firstName || input.firstName.trim().length === 0) {
    throw new ValidationError("Le prénom (firstName) est requis.");
  }
  if (!input.lastName || input.lastName.trim().length === 0) {
    throw new ValidationError("Le nom (lastName) est requis.");
  }
  const birth = input.birthDate == null ? null : parseGenealogicalDate(input.birthDate);
  const death = input.deathDate == null ? null : parseGenealogicalDate(input.deathDate);
  if (
    input.birthDate != null &&
    input.deathDate != null &&
    birth?.lower != null && death?.upper != null && death.upper < birth.lower
  ) {
    throw new ValidationError("deathDate ne peut pas être antérieure à birthDate.");
  }
  if (input.livingStatus != null && !["living", "deceased"].includes(input.livingStatus)) {
    throw new ValidationError(`livingStatus invalide : ${input.livingStatus}`);
  }
  if (input.visibility != null && !["public", "family", "private"].includes(input.visibility)) {
    throw new ValidationError(`visibility invalide : ${input.visibility}`);
  }
}

function toPerson(row: typeof person.$inferSelect, dates: Map<string, GenealogicalDate> = new Map()): Person {
  const birth = dates.get("birth_date");
  const death = dates.get("death_date");
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    birthName: row.birthName,
    birthDate: row.birthDate,
    deathDate: row.deathDate,
    birthDateQualification: birth?.qualification,
    birthDatePrecision: birth?.precision,
    birthDateLowerBound: birth?.lower,
    birthDateUpperBound: birth?.upper,
    deathDateQualification: death?.qualification,
    deathDatePrecision: death?.precision,
    deathDateLowerBound: death?.lower,
    deathDateUpperBound: death?.upper,
    gender: row.gender,
    livingStatus: row.livingStatus,
    visibility: row.visibility,
  };
}

/**
 * Synchronisation naissance/décès (choix d'architecture : vit dans person.ts,
 * car il est déclenché à la création/maJ d'une Person — la source canonique de
 * la date — et non dans event.ts, pour éviter tout doublon manuel).
 *
 * Garantit pour chaque `birthDate`/`deathDate` présent exactement UN événement
 * `naissance`/`décès` rangé `event` pour cette Person (idempotent) :
 * - aucun événement du type → création avec `eventDate` = date de la Person ;
 * - événement existant → mise à jour de sa date si écart (la date affichée de
 *   l'événement suit toujours la source canonique Person) ;
 * - jamais de doublon par (person, type), même si un événement manuel du même
 *   type existait déjà.
 * Une Person sans date ⇒ aucun événement auto. Aucune suppression automatique :
 * un événement préexistant (avec un lieu saisi en admin) reste intact.
 */
export async function syncBiographicalEvents(
  db: Database,
  personId: number,
  birthDate: string | null,
  deathDate: string | null,
  fields: ReadonlySet<"birth" | "death"> = new Set(["birth", "death"]),
): Promise<void> {
  const typed: Array<{ type: EventType; date: string | null }> = [
    ...(fields.has("birth") ? [{ type: "naissance" as const, date: birthDate }] : []),
    ...(fields.has("death") ? [{ type: "décès" as const, date: deathDate }] : []),
  ];

  const existingRows = await db.select().from(event).where(eq(event.personId, personId));
  const byType = new Map<EventType, (typeof event.$inferSelect)[]>();
  for (const row of existingRows) {
    const type = row.type as EventType;
    const arr = byType.get(type) ?? [];
    arr.push(row);
    byType.set(type, arr);
  }

  for (const { type, date } of typed) {
    if (!date) continue;
    const matches = byType.get(type) ?? [];
    if (matches.length === 0) {
      const [created] = await db.insert(event).values({
        personId,
        type,
        label: null,
        eventDate: date,
        description: null,
        unionId: null,
        place: null,
        latitude: null,
        longitude: null,
      }).returning();
      await persistGenealogicalDate(db, "event", created.id, "event_date", date);
    } else {
      if (matches[0].eventDate !== date) {
        await db.update(event).set({ eventDate: date }).where(eq(event.id, matches[0].id));
      }
      await persistGenealogicalDate(db, "event", matches[0].id, "event_date", date);
    }
  }
}

/** Internal transaction-aware primitive used by composite operations. */
export async function createPersonInTransaction(db: Database, input: PersonInput): Promise<Person> {
  assertValidPersonInput(input);
  const [row] = await db
    .insert(person)
    .values({
      firstName: input.firstName,
      lastName: input.lastName,
      birthName: input.birthName?.trim() || null,
      birthDate: input.birthDate ?? null,
      deathDate: input.deathDate ?? null,
      gender: input.gender ?? null,
      livingStatus: input.livingStatus ?? null,
      visibility: input.visibility ?? "public",
    })
    .returning();
  await syncBiographicalEvents(db, row.id, input.birthDate ?? null, input.deathDate ?? null);
  await persistGenealogicalDate(db, "person", row.id, "birth_date", input.birthDate ?? null);
  await persistGenealogicalDate(db, "person", row.id, "death_date", input.deathDate ?? null);
  return getPersonById(db, row.id);
}

export async function createPerson(db: Database, input: PersonInput): Promise<Person> {
  return runTransaction(db, (transactionalDb) => createPersonInTransaction(transactionalDb, input));
}

export async function getPersonById(db: Database, id: number): Promise<Person> {
  const [row] = await db.select().from(person).where(eq(person.id, id));
  if (!row) {
    throw new NotFoundError("Person", id);
  }
  return toPerson(row, await loadGenealogicalDates(db, "person", id));
}

export async function listPersons(db: Database): Promise<Person[]> {
  const rows = await db.select().from(person);
  return Promise.all(rows.map(async (row) => toPerson(row, await loadGenealogicalDates(db, "person", row.id))));
}

export async function updatePerson(
  db: Database,
  id: number,
  input: Partial<PersonInput>,
): Promise<Person> {
  return runTransaction(db, async (transactionalDb) => {
    const existing = await getPersonById(transactionalDb, id);
    const merged: PersonInput = {
      firstName: input.firstName ?? existing.firstName,
      lastName: input.lastName ?? existing.lastName,
      birthName: input.birthName !== undefined ? input.birthName?.trim() || null : existing.birthName,
      birthDate: input.birthDate !== undefined ? input.birthDate : existing.birthDate,
      deathDate: input.deathDate !== undefined ? input.deathDate : existing.deathDate,
      gender: input.gender !== undefined ? input.gender : existing.gender,
      livingStatus: input.livingStatus !== undefined ? input.livingStatus : existing.livingStatus,
      visibility: input.visibility !== undefined ? input.visibility : existing.visibility,
    };
    assertValidPersonInput(merged);
    const [row] = await transactionalDb.update(person).set({
      firstName: merged.firstName,
      lastName: merged.lastName,
      birthName: merged.birthName?.trim() || null,
      birthDate: merged.birthDate ?? null,
      deathDate: merged.deathDate ?? null,
      gender: merged.gender ?? null,
      livingStatus: merged.livingStatus ?? null,
      visibility: merged.visibility ?? null,
    }).where(eq(person.id, id)).returning();
    const changedDateFields = new Set<"birth" | "death">();
    if (input.birthDate !== undefined) changedDateFields.add("birth");
    if (input.deathDate !== undefined) changedDateFields.add("death");
    await syncBiographicalEvents(
      transactionalDb,
      row.id,
      merged.birthDate ?? null,
      merged.deathDate ?? null,
      changedDateFields,
    );
    if (input.birthDate !== undefined) {
      await persistGenealogicalDate(transactionalDb, "person", row.id, "birth_date", merged.birthDate ?? null);
    }
    if (input.deathDate !== undefined) {
      await persistGenealogicalDate(transactionalDb, "person", row.id, "death_date", merged.deathDate ?? null);
    }
    return getPersonById(transactionalDb, row.id);
  });
}

export async function deletePerson(db: Database, id: number): Promise<void> {
  await runTransaction(db, async (transactionalDb) => {
    await getPersonById(transactionalDb, id); // lève NotFoundError si absent
    const cascadedEvents = await transactionalDb.select({ id: event.id }).from(event).where(eq(event.personId, id));
    for (const cascadedEvent of cascadedEvents) {
      await deleteGenealogicalDates(transactionalDb, "event", cascadedEvent.id);
    }
    await deleteGenealogicalDates(transactionalDb, "person", id);
    await transactionalDb.delete(person).where(eq(person.id, id));
  });
}
