/**
 * Opérations CRUD pures pour l'entité Union (couple), incluant la
 * gestion de la table de jonction `union_partner` (personnes liées).
 */
import { eq } from "drizzle-orm";
import { unions, unionPartner, person, type Database } from "@testvibe/db";
import type { Union, UnionInput } from "./types.js";
import { NotFoundError, ValidationError } from "./errors.js";

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

async function assertPersonsExist(db: Database, personIds: number[]): Promise<void> {
  for (const id of personIds) {
    const [row] = await db.select().from(person).where(eq(person.id, id));
    if (!row) {
      throw new ValidationError(`personIds fait référence à une Person inexistante : ${id}`);
    }
  }
}

function assertValidUnionInput(input: UnionInput): void {
  if (!Array.isArray(input.personIds) || input.personIds.length === 0) {
    throw new ValidationError("Une Union doit référencer au moins une Person (personIds).");
  }
  if (new Set(input.personIds).size !== input.personIds.length) {
    throw new ValidationError("personIds contient des doublons.");
  }
  if (input.startDate != null && !isValidDate(input.startDate)) {
    throw new ValidationError(`startDate invalide : ${input.startDate}`);
  }
  if (input.endDate != null && !isValidDate(input.endDate)) {
    throw new ValidationError(`endDate invalide : ${input.endDate}`);
  }
  if (
    input.startDate != null &&
    input.endDate != null &&
    isValidDate(input.startDate) &&
    isValidDate(input.endDate) &&
    new Date(input.endDate).getTime() < new Date(input.startDate).getTime()
  ) {
    throw new ValidationError("endDate ne peut pas être antérieure à startDate.");
  }
}

async function loadUnion(db: Database, id: number): Promise<Union> {
  const [row] = await db.select().from(unions).where(eq(unions.id, id));
  if (!row) {
    throw new NotFoundError("Union", id);
  }
  const partners = await db
    .select()
    .from(unionPartner)
    .where(eq(unionPartner.unionId, id));
  return {
    id: row.id,
    startDate: row.startDate,
    endDate: row.endDate,
    personIds: partners.map((p) => p.personId),
  };
}

export async function createUnion(db: Database, input: UnionInput): Promise<Union> {
  assertValidUnionInput(input);
  await assertPersonsExist(db, input.personIds);
  const [row] = await db
    .insert(unions)
    .values({
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
    })
    .returning();
  await db.insert(unionPartner).values(
    input.personIds.map((personId) => ({ unionId: row.id, personId })),
  );
  return loadUnion(db, row.id);
}

export async function getUnionById(db: Database, id: number): Promise<Union> {
  return loadUnion(db, id);
}

export async function listUnions(db: Database): Promise<Union[]> {
  const rows = await db.select().from(unions);
  return Promise.all(rows.map((row) => loadUnion(db, row.id)));
}

export async function updateUnion(
  db: Database,
  id: number,
  input: Partial<UnionInput>,
): Promise<Union> {
  const existing = await loadUnion(db, id); // lève NotFoundError si absent
  const merged: UnionInput = {
    startDate: input.startDate !== undefined ? input.startDate : existing.startDate,
    endDate: input.endDate !== undefined ? input.endDate : existing.endDate,
    personIds: input.personIds ?? existing.personIds,
  };
  assertValidUnionInput(merged);
  await assertPersonsExist(db, merged.personIds);

  await db
    .update(unions)
    .set({
      startDate: merged.startDate ?? null,
      endDate: merged.endDate ?? null,
    })
    .where(eq(unions.id, id));

  if (input.personIds !== undefined) {
    await db.delete(unionPartner).where(eq(unionPartner.unionId, id));
    await db.insert(unionPartner).values(
      merged.personIds.map((personId) => ({ unionId: id, personId })),
    );
  }

  return loadUnion(db, id);
}

export async function deleteUnion(db: Database, id: number): Promise<void> {
  await loadUnion(db, id); // lève NotFoundError si absent
  await db.delete(unionPartner).where(eq(unionPartner.unionId, id));
  await db.delete(unions).where(eq(unions.id, id));
}
