/**
 * Opérations CRUD pures pour l'entité Person.
 * Aucune dépendance à Next.js/apps-web : uniquement Drizzle via
 * `@testvibe/db` (type `Database`).
 */
import { eq } from "drizzle-orm";
import { person, type Database } from "@testvibe/db";
import type { Person, PersonInput } from "./types.js";
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
}

function toPerson(row: typeof person.$inferSelect): Person {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    birthDate: row.birthDate,
    deathDate: row.deathDate,
    gender: row.gender,
  };
}

export async function createPerson(db: Database, input: PersonInput): Promise<Person> {
  assertValidPersonInput(input);
  const [row] = await db
    .insert(person)
    .values({
      firstName: input.firstName,
      lastName: input.lastName,
      birthDate: input.birthDate ?? null,
      deathDate: input.deathDate ?? null,
      gender: input.gender ?? null,
    })
    .returning();
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
    birthDate: input.birthDate !== undefined ? input.birthDate : existing.birthDate,
    deathDate: input.deathDate !== undefined ? input.deathDate : existing.deathDate,
    gender: input.gender !== undefined ? input.gender : existing.gender,
  };
  assertValidPersonInput(merged);
  const [row] = await db
    .update(person)
    .set({
      firstName: merged.firstName,
      lastName: merged.lastName,
      birthDate: merged.birthDate ?? null,
      deathDate: merged.deathDate ?? null,
      gender: merged.gender ?? null,
    })
    .where(eq(person.id, id))
    .returning();
  return toPerson(row);
}

export async function deletePerson(db: Database, id: number): Promise<void> {
  await getPersonById(db, id); // lève NotFoundError si absent
  await db.delete(person).where(eq(person.id, id));
}
