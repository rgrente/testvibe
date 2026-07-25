/**
 * Opérations CRUD pures pour l'entité Filiation (lien parent/enfant
 * avec un rôle biologique/adopté/beau-parent).
 */
import { eq } from "drizzle-orm";
import { filiation, person, type Database } from "@testvibe/db";
import type { Filiation, FiliationInput, FiliationRole } from "./types.js";
import { NotFoundError, ValidationError } from "./errors.js";

const VALID_ROLES: FiliationRole[] = ["biologique", "adopte", "beau-parent"];

async function assertPersonExists(db: Database, id: number, label: string): Promise<void> {
  const [row] = await db.select().from(person).where(eq(person.id, id));
  if (!row) {
    throw new ValidationError(`${label} fait référence à une Person inexistante : ${id}`);
  }
}

function assertValidFiliationInput(input: FiliationInput): void {
  if (input.parentId === input.childId) {
    throw new ValidationError("parentId et childId ne peuvent pas être identiques.");
  }
  if (!VALID_ROLES.includes(input.role)) {
    throw new ValidationError(
      `role invalide : ${input.role}. Valeurs autorisées : ${VALID_ROLES.join(", ")}.`,
    );
  }
}

function toFiliation(row: typeof filiation.$inferSelect): Filiation {
  return {
    id: row.id,
    parentId: row.parentId,
    childId: row.childId,
    role: row.role as FiliationRole,
  };
}

export async function createFiliation(db: Database, input: FiliationInput): Promise<Filiation> {
  assertValidFiliationInput(input);
  await assertPersonExists(db, input.parentId, "parentId");
  await assertPersonExists(db, input.childId, "childId");
  const [row] = await db
    .insert(filiation)
    .values({
      parentId: input.parentId,
      childId: input.childId,
      role: input.role,
    })
    .returning();
  return toFiliation(row);
}

export async function getFiliationById(db: Database, id: number): Promise<Filiation> {
  const [row] = await db.select().from(filiation).where(eq(filiation.id, id));
  if (!row) {
    throw new NotFoundError("Filiation", id);
  }
  return toFiliation(row);
}

export async function listFiliations(db: Database): Promise<Filiation[]> {
  const rows = await db.select().from(filiation);
  return rows.map(toFiliation);
}

export async function updateFiliation(
  db: Database,
  id: number,
  input: Partial<FiliationInput>,
): Promise<Filiation> {
  const existing = await getFiliationById(db, id); // lève NotFoundError si absent
  const merged: FiliationInput = {
    parentId: input.parentId ?? existing.parentId,
    childId: input.childId ?? existing.childId,
    role: input.role ?? existing.role,
  };
  assertValidFiliationInput(merged);
  if (input.parentId !== undefined) {
    await assertPersonExists(db, merged.parentId, "parentId");
  }
  if (input.childId !== undefined) {
    await assertPersonExists(db, merged.childId, "childId");
  }
  const [row] = await db
    .update(filiation)
    .set({
      parentId: merged.parentId,
      childId: merged.childId,
      role: merged.role,
    })
    .where(eq(filiation.id, id))
    .returning();
  return toFiliation(row);
}

export async function deleteFiliation(db: Database, id: number): Promise<void> {
  await getFiliationById(db, id); // lève NotFoundError si absent
  await db.delete(filiation).where(eq(filiation.id, id));
}
