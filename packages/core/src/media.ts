/**
 * Opérations CRUD pour l'entité Media (photos, documents).
 * Un média est associé à une Person (optionnel) et/ou un Event (optionnel).
 * Le fichier physique est stocké sur le système de fichiers local par l'appelant ;
 * ce module gère uniquement les métadonnées en base.
 */
import { eq } from "drizzle-orm";
import { media, type Database } from "@testvibe/db";
import type { Media, MediaInput } from "./types.js";
import { NotFoundError, ValidationError } from "./errors.js";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
];

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function assertValidMediaInput(input: MediaInput): void {
  if (!input.filename || input.filename.trim().length === 0) {
    throw new ValidationError("filename est requis.");
  }
  if (!input.originalName || input.originalName.trim().length === 0) {
    throw new ValidationError("originalName est requis.");
  }
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType)) {
    throw new ValidationError(
      `mimeType non supporté : ${input.mimeType}. Types acceptés : ${ALLOWED_MIME_TYPES.join(", ")}`,
    );
  }
  if (input.size <= 0 || input.size > MAX_SIZE_BYTES) {
    throw new ValidationError(`size invalide : ${input.size} (max ${MAX_SIZE_BYTES} octets).`);
  }
  if (input.personId == null && input.eventId == null) {
    throw new ValidationError("Un média doit être associé à une Person ou un Event.");
  }
  if (input.visibility != null && !["public", "family", "private"].includes(input.visibility)) {
    throw new ValidationError(`visibility invalide : ${input.visibility}`);
  }
}

function toMedia(row: typeof media.$inferSelect): Media {
  return {
    id: row.id,
    personId: row.personId ?? null,
    eventId: row.eventId ?? null,
    filename: row.filename,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt,
    visibility: row.visibility,
  };
}

export async function createMedia(db: Database, input: MediaInput): Promise<Media> {
  assertValidMediaInput(input);
  const [row] = await db
    .insert(media)
    .values({
      personId: input.personId ?? null,
      eventId: input.eventId ?? null,
      filename: input.filename,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      createdAt: new Date().toISOString(),
      visibility: input.visibility ?? null,
    })
    .returning();
  return toMedia(row);
}

export async function getMediaById(db: Database, id: number): Promise<Media> {
  const [row] = await db.select().from(media).where(eq(media.id, id));
  if (!row) {
    throw new NotFoundError("Media", id);
  }
  return toMedia(row);
}

export async function getMediaByFilename(db: Database, filename: string): Promise<Media> {
  const [row] = await db.select().from(media).where(eq(media.filename, filename));
  if (!row) throw new NotFoundError("Media", filename);
  return toMedia(row);
}

export async function listMediaByPerson(db: Database, personId: number): Promise<Media[]> {
  const rows = await db.select().from(media).where(eq(media.personId, personId));
  return rows.map(toMedia);
}

export async function listMediaByEvent(db: Database, eventId: number): Promise<Media[]> {
  const rows = await db.select().from(media).where(eq(media.eventId, eventId));
  return rows.map(toMedia);
}

export async function listAllMedia(db: Database): Promise<Media[]> {
  return (await db.select().from(media)).map(toMedia);
}

export async function deleteMedia(db: Database, id: number): Promise<void> {
  await getMediaById(db, id);
  await db.delete(media).where(eq(media.id, id));
}
