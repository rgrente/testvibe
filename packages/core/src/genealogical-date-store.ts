import { and, eq } from "drizzle-orm";
import { genealogicalDate, type Database } from "@testvibe/db";
import { parseGenealogicalDate } from "./genealogical-date.js";

export type GenealogicalDateOwner = "person" | "union" | "event";

export async function persistGenealogicalDate(
  db: Database,
  ownerKind: GenealogicalDateOwner,
  ownerId: number,
  field: string,
  original: string | null,
): Promise<void> {
  const selector = and(
    eq(genealogicalDate.ownerKind, ownerKind),
    eq(genealogicalDate.ownerId, ownerId),
    eq(genealogicalDate.field, field),
  );
  if (!original) {
    await db.delete(genealogicalDate).where(selector);
    return;
  }
  const value = parseGenealogicalDate(original);
  await db.insert(genealogicalDate).values({
    ownerKind,
    ownerId,
    field,
    original: value.original,
    qualification: value.qualification,
    precision: value.precision,
    lowerBound: value.lower,
    upperBound: value.upper,
  }).onConflictDoUpdate({
    target: [genealogicalDate.ownerKind, genealogicalDate.ownerId, genealogicalDate.field],
    set: {
      original: value.original,
      qualification: value.qualification,
      precision: value.precision,
      lowerBound: value.lower,
      upperBound: value.upper,
    },
  });
}

export async function deleteGenealogicalDates(db: Database, ownerKind: GenealogicalDateOwner, ownerId: number): Promise<void> {
  await db.delete(genealogicalDate).where(and(
    eq(genealogicalDate.ownerKind, ownerKind),
    eq(genealogicalDate.ownerId, ownerId),
  ));
}
