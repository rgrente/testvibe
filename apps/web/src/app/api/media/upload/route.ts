import { type NextRequest, NextResponse } from "next/server";
import { adminCreateMedia } from "@testvibe/core";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
];

/**
 * POST /api/media/upload
 * Multipart form-data : champ "file" (obligatoire), "personId" ou "eventId" (au moins un).
 * Retourne le Media créé en JSON.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const personIdRaw = formData.get("personId")?.toString();
    const eventIdRaw = formData.get("eventId")?.toString();

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Type non supporté : ${file.type}` },
        { status: 400 },
      );
    }
    const personId = personIdRaw ? Number(personIdRaw) : null;
    const eventId = eventIdRaw ? Number(eventIdRaw) : null;
    if (!personId && !eventId) {
      return NextResponse.json(
        { error: "personId ou eventId requis." },
        { status: 400 },
      );
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename to avoid collisions
    const ext = file.name.split(".").pop() ?? "bin";
    const filename = `${randomUUID()}.${ext}`;
    const filePath = join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const media = await adminCreateMedia({
      personId,
      eventId,
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
    });

    return NextResponse.json(media, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
