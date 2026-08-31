/**
 * Opérations CRUD pures pour l'entité Filiation (lien parent/enfant
 * avec un rôle biologique/adopté/beau-parent).
 */
import { eq } from "drizzle-orm";
import { filiation, person, type Database } from "@testvibe/db";
import type {
  Filiation,
  FiliationBatchInput,
  FiliationInput,
  FiliationRole,
} from "./types.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { runTransaction } from "./transaction.js";

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

async function assertFiliationIntegrity(
  db: Database,
  input: FiliationInput,
  excludedId?: number,
): Promise<void> {
  assertValidFiliationInput(input);
  await assertPersonExists(db, input.parentId, "parentId");
  await assertPersonExists(db, input.childId, "childId");
  const existing = (await listFiliations(db)).filter((link) => link.id !== excludedId);
  if (existing.some((link) => link.parentId === input.parentId && link.childId === input.childId)) {
    throw new ValidationError(`La filiation ${input.parentId} → ${input.childId} existe déjà.`);
  }
  const adjacency = new Map<number, number[]>();
  for (const link of [...existing, input]) {
    adjacency.set(link.parentId, [...(adjacency.get(link.parentId) ?? []), link.childId]);
  }
  const reaches = (from: number, target: number, seen = new Set<number>()): boolean => {
    if (from === target) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return (adjacency.get(from) ?? []).some((next) => reaches(next, target, seen));
  };
  if (reaches(input.childId, input.parentId)) {
    throw new ValidationError("Cette filiation créerait un cycle.");
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

/** Internal transaction-aware primitive used by composite operations. */
export async function createFiliationInTransaction(
  db: Database,
  input: FiliationInput,
): Promise<Filiation> {
  await assertFiliationIntegrity(db, input);
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

export async function createFiliation(db: Database, input: FiliationInput): Promise<Filiation> {
  return runTransaction(db, (transactionalDb) => createFiliationInTransaction(transactionalDb, input));
}

/** Crée atomiquement le produit cartésien parents × enfants. */
export async function createFiliations(
  db: Database,
  input: FiliationBatchInput,
): Promise<Filiation[]> {
  const { parentIds, childIds, role } = input;
  if (parentIds.length < 1 || parentIds.length > 2) {
    throw new ValidationError("Il faut sélectionner un ou deux parents.");
  }
  if (childIds.length < 1) {
    throw new ValidationError("Il faut sélectionner au moins un enfant.");
  }
  if (new Set(parentIds).size !== parentIds.length) {
    throw new ValidationError("Les parents doivent être distincts.");
  }
  if (new Set(childIds).size !== childIds.length) {
    throw new ValidationError("Les enfants doivent être distincts.");
  }
  if (parentIds.some((id) => childIds.includes(id))) {
    throw new ValidationError("Une personne ne peut pas être parent et enfant dans le même lot.");
  }
  if (!VALID_ROLES.includes(role)) {
    throw new ValidationError(`role invalide : ${role}.`);
  }

  const requestedIds = [...new Set([...parentIds, ...childIds])];
  const existingPersons = await db.select({ id: person.id }).from(person);
  const existingPersonIds = new Set(existingPersons.map((row) => row.id));
  const missing = requestedIds.filter((id) => !existingPersonIds.has(id));
  if (missing.length > 0) {
    throw new ValidationError(`Person inexistante : ${missing.join(", ")}`);
  }

  const existing = await listFiliations(db);
  const pairs = parentIds.flatMap((parentId) =>
    childIds.map((childId) => ({ parentId, childId, role })),
  );
  const existingPairs = new Set(existing.map((link) => `${link.parentId}:${link.childId}`));
  const duplicate = pairs.find((link) => existingPairs.has(`${link.parentId}:${link.childId}`));
  if (duplicate) {
    throw new ValidationError(
      `La filiation ${duplicate.parentId} → ${duplicate.childId} existe déjà.`,
    );
  }

  const adjacency = new Map<number, number[]>();
  for (const link of [...existing, ...pairs]) {
    const children = adjacency.get(link.parentId) ?? [];
    children.push(link.childId);
    adjacency.set(link.parentId, children);
  }
  const reaches = (from: number, target: number, seen = new Set<number>()): boolean => {
    if (from === target) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return (adjacency.get(from) ?? []).some((next) => reaches(next, target, seen));
  };
  if (pairs.some((link) => reaches(link.childId, link.parentId))) {
    throw new ValidationError("Ce lot créerait un cycle de filiation.");
  }

  return runTransaction(db, async (transactionalDb) => {
    const created: Filiation[] = [];
    for (const link of pairs) {
      await assertFiliationIntegrity(transactionalDb, link);
      const [row] = await transactionalDb.insert(filiation).values(link).returning();
      created.push(toFiliation(row));
    }
    return created;
  });
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
  return runTransaction(db, async (transactionalDb) => {
    const existing = await getFiliationById(transactionalDb, id);
    const merged: FiliationInput = {
      parentId: input.parentId ?? existing.parentId,
      childId: input.childId ?? existing.childId,
      role: input.role ?? existing.role,
    };
    await assertFiliationIntegrity(transactionalDb, merged, id);
    const [row] = await transactionalDb.update(filiation).set({
      parentId: merged.parentId,
      childId: merged.childId,
      role: merged.role,
    }).where(eq(filiation.id, id)).returning();
    return toFiliation(row);
  });
}

export async function deleteFiliation(db: Database, id: number): Promise<void> {
  await getFiliationById(db, id); // lève NotFoundError si absent
  await db.delete(filiation).where(eq(filiation.id, id));
}
