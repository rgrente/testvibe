/**
 * Tests unitaires pour media.ts (CRUD médias).
 * Phase 5, tâche #24.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./test-utils.js";
import type { Database } from "@testvibe/db";
import { createPerson } from "./person.js";
import { createEvent } from "./event.js";
import {
  createMedia,
  getMediaById,
  getMediaByFilename,
  listMediaByPerson,
  listMediaByEvent,
  deleteMedia,
} from "./media.js";
import { NotFoundError, ValidationError } from "./errors.js";

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

const VALID_MEDIA: Parameters<typeof createMedia>[1] = {
  personId: null,
  eventId: null,
  filename: "photo-abc.jpg",
  originalName: "photo.jpg",
  mimeType: "image/jpeg",
  size: 512000,
};

describe("createMedia", () => {
  it("crée un média associé à une personne", async () => {
    const person = await createPerson(db, { firstName: "Alice", lastName: "Martin" });
    const m = await createMedia(db, { ...VALID_MEDIA, personId: person.id, visibility: "private" });
    expect(m.id).toBeGreaterThan(0);
    expect(m.personId).toBe(person.id);
    expect(m.filename).toBe("photo-abc.jpg");
    expect(m.mimeType).toBe("image/jpeg");
    expect(m.createdAt).toBeTruthy();
    expect(m.visibility).toBe("private");
  });

  it("rejette une visibilité inconnue", async () => {
    const person = await createPerson(db, { firstName: "Alice", lastName: "Martin" });
    await expect(createMedia(db, {
      ...VALID_MEDIA,
      personId: person.id,
      visibility: "shared" as never,
    })).rejects.toThrow(ValidationError);
  });

  it("crée un média associé à un événement", async () => {
    const person = await createPerson(db, { firstName: "Bob", lastName: "Dupont" });
    const ev = await createEvent(db, { personId: person.id, type: "naissance" });
    const m = await createMedia(db, {
      ...VALID_MEDIA,
      personId: null,
      eventId: ev.id,
      filename: "certificat.pdf",
      mimeType: "application/pdf",
    });
    expect(m.eventId).toBe(ev.id);
    expect(m.mimeType).toBe("application/pdf");
  });

  it("lève ValidationError si ni personId ni eventId", async () => {
    await expect(createMedia(db, { ...VALID_MEDIA, personId: null, eventId: null })).rejects.toThrow(
      ValidationError,
    );
  });

  it("lève ValidationError pour un mime type non supporté", async () => {
    const person = await createPerson(db, { firstName: "Eve", lastName: "Blanc" });
    await expect(
      createMedia(db, { ...VALID_MEDIA, personId: person.id, mimeType: "text/plain" }),
    ).rejects.toThrow(ValidationError);
  });

  it("lève ValidationError si size <= 0", async () => {
    const person = await createPerson(db, { firstName: "Eve", lastName: "Blanc" });
    await expect(
      createMedia(db, { ...VALID_MEDIA, personId: person.id, size: 0 }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("getMediaById", () => {
  it("retrouve un média par son id", async () => {
    const person = await createPerson(db, { firstName: "Alice", lastName: "Martin" });
    const m = await createMedia(db, { ...VALID_MEDIA, personId: person.id });
    const fetched = await getMediaById(db, m.id);
    expect(fetched).toEqual(m);
  });

  it("lève NotFoundError si inexistant", async () => {
    await expect(getMediaById(db, 9999)).rejects.toThrow(NotFoundError);
  });
});

describe("getMediaByFilename", () => {
  it("retrouve les métadonnées nécessaires à la reprise d'un upload", async () => {
    const person = await createPerson(db, { firstName: "Alice", lastName: "Martin" });
    const created = await createMedia(db, { ...VALID_MEDIA, personId: person.id, filename: "recovery.pdf" });
    await expect(getMediaByFilename(db, "recovery.pdf")).resolves.toEqual(created);
    await expect(getMediaByFilename(db, "missing.pdf")).rejects.toThrow(NotFoundError);
  });
});

describe("listMediaByPerson", () => {
  it("retourne les médias d'une personne", async () => {
    const person = await createPerson(db, { firstName: "Charles", lastName: "Dup" });
    await createMedia(db, { ...VALID_MEDIA, personId: person.id, filename: "a.jpg" });
    await createMedia(db, { ...VALID_MEDIA, personId: person.id, filename: "b.jpg" });
    const medias = await listMediaByPerson(db, person.id);
    expect(medias).toHaveLength(2);
  });

  it("retourne un tableau vide si la personne n'a pas de médias", async () => {
    const person = await createPerson(db, { firstName: "Diane", lastName: "X" });
    const medias = await listMediaByPerson(db, person.id);
    expect(medias).toHaveLength(0);
  });
});

describe("listMediaByEvent", () => {
  it("retourne les médias d'un événement", async () => {
    const person = await createPerson(db, { firstName: "Fred", lastName: "Y" });
    const ev = await createEvent(db, { personId: person.id, type: "mariage" });
    await createMedia(db, {
      ...VALID_MEDIA,
      personId: null,
      eventId: ev.id,
      filename: "mariage.jpg",
    });
    const medias = await listMediaByEvent(db, ev.id);
    expect(medias).toHaveLength(1);
    expect(medias[0].eventId).toBe(ev.id);
  });
});

describe("deleteMedia", () => {
  it("supprime un média", async () => {
    const person = await createPerson(db, { firstName: "Gina", lastName: "Z" });
    const m = await createMedia(db, { ...VALID_MEDIA, personId: person.id });
    await deleteMedia(db, m.id);
    await expect(getMediaById(db, m.id)).rejects.toThrow(NotFoundError);
  });
});
