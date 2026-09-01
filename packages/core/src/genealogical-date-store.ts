import { and, eq } from "drizzle-orm";
import { genealogicalDate, type Database } from "@testvibe/db";
import { parseGenealogicalDate, type GenealogicalDate } from "./genealogical-date.js";

export type GenealogicalDateOwner = "person" | "union" | "event";

export async function loadGenealogicalDates(
  db: Database,
  ownerKind: GenealogicalDateOwner,
  ownerId: number,
): Promise<Map<string, GenealogicalDate>> {
  const rows = await db.select().from(genealogicalDate).where(and(
    eq(genealogicalDate.ownerKind, ownerKind),
    eq(genealogicalDate.ownerId, ownerId),
  ));
  return new Map(rows.map((row) => [row.field, {
    original: row.original,
    qualification: row.qualification,
    precision: row.precision,
    lower: row.lowerBound,
    upper: row.upperBound,
  }]));
}

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
