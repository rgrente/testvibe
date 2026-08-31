/**
 * Opérations CRUD pures pour l'entité Person.
 * Aucune dépendance à Next.js/apps-web : uniquement Drizzle via
 * `@testvibe/db` (type `Database`).
 */
import { eq } from "drizzle-orm";
import { person, event, type Database } from "@testvibe/db";
import type { Person, PersonInput, EventType } from "./types.js";
import { NotFoundError, ValidationError } from "./errors.js";

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function assertValidPersonInput(input: PersonInput): void {
  if (!input.firstName || input.firstName.trim().length === 0) {
    throw new ValidationError("Le prénom (firstName) est requis.");
  }
  if (!input.lastName || input.lastName.trim().length === 0) {
    throw new ValidationError("Le nom (lastName) est requis.");
  }
  if (input.birthDate != null && !isValidDate(input.birthDate)) {
    throw new ValidationError(`birthDate invalide : ${input.birthDate}`);
  }
  if (input.deathDate != null && !isValidDate(input.deathDate)) {
    throw new ValidationError(`deathDate invalide : ${input.deathDate}`);
  }
  if (
    input.birthDate != null &&
    input.deathDate != null &&
    isValidDate(input.birthDate) &&
    isValidDate(input.deathDate) &&
    new Date(input.deathDate).getTime() < new Date(input.birthDate).getTime()
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

function toPerson(row: typeof person.$inferSelect): Person {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    birthName: row.birthName,
    birthDate: row.birthDate,
    deathDate: row.deathDate,
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
): Promise<void> {
  const typed: Array<{ type: EventType; date: string | null }> = [
    { type: "naissance", date: birthDate },
    { type: "décès", date: deathDate },
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
      await db.insert(event).values({
        personId,
        type,
        label: null,
        eventDate: date,
        description: null,
        unionId: null,
        place: null,
        latitude: null,
        longitude: null,
      });
    } else if (matches[0].eventDate !== date) {
      await db.update(event).set({ eventDate: date }).where(eq(event.id, matches[0].id));
    }
  }
}

export async function createPerson(db: Database, input: PersonInput): Promise<Person> {
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
      visibility: input.visibility ?? null,
    })
    .returning();
  await syncBiographicalEvents(db, row.id, input.birthDate ?? null, input.deathDate ?? null);
  return toPerson(row);
}

export async function getPersonById(db: Database, id: number): Promise<Person> {
  const [row] = await db.select().from(person).where(eq(person.id, id));
  if (!row) {
    throw new NotFoundError("Person", id);
  }
  return toPerson(row);
}

export async function listPersons(db: Database): Promise<Person[]> {
  const rows = await db.select().from(person);
  return rows.map(toPerson);
}

export async function updatePerson(
  db: Database,
  id: number,
  input: Partial<PersonInput>,
): Promise<Person> {
  const existing = await getPersonById(db, id); // lève NotFoundError si absent
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
  const [row] = await db
    .update(person)
    .set({
      firstName: merged.firstName,
      lastName: merged.lastName,
      birthName: merged.birthName?.trim() || null,
      birthDate: merged.birthDate ?? null,
      deathDate: merged.deathDate ?? null,
      gender: merged.gender ?? null,
      livingStatus: merged.livingStatus ?? null,
      visibility: merged.visibility ?? null,
    })
    .where(eq(person.id, id))
    .returning();
  await syncBiographicalEvents(db, row.id, merged.birthDate ?? null, merged.deathDate ?? null);
  return toPerson(row);
}

export async function deletePerson(db: Database, id: number): Promise<void> {
  await getPersonById(db, id); // lève NotFoundError si absent
  await db.delete(person).where(eq(person.id, id));
}
