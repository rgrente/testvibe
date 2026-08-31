import { type NextRequest, NextResponse } from "next/server";
import { adminCreateMedia, adminGetEvent, adminGetPerson } from "@testvibe/core";
import { unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { authorizeMutationRequest } from "@/lib/session";
import { detectMediaType, hasSingleAttachment } from "@/lib/media-upload";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB


/**
 * POST /api/media/upload
 * Multipart form-data : champ "file" (obligatoire), "personId" ou "eventId" (au moins un).
 * Retourne le Media créé en JSON.
 */
export async function POST(request: NextRequest) {
  const authorization = await authorizeMutationRequest(request);
  if (authorization) return NextResponse.json({ error: authorization === 401 ? "Unauthorized" : "Forbidden" }, { status: authorization });
  let filePath: string | undefined;
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
    const personId = personIdRaw ? Number(personIdRaw) : null;
    const eventId = eventIdRaw ? Number(eventIdRaw) : null;
    if (!hasSingleAttachment(personId, eventId)) {
      return NextResponse.json(
        { error: "Un seul rattachement personId ou eventId est requis." },
        { status: 400 },
      );
    }

    try {
      if (personId) await adminGetPerson(personId);
      if (eventId) await adminGetEvent(eventId);
    } catch {
      return NextResponse.json({ error: "Rattachement inconnu." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectMediaType(buffer);
    if (!detected) {
      return NextResponse.json({ error: "Contenu de fichier non supporté." }, { status: 400 });
    }

    // Ensure upload directory exists
    if (!existsSync(/* turbopackIgnore: true */ UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Generate unique filename to avoid collisions
    const filename = `${randomUUID()}.${detected.extension}`;
    filePath = join(/* turbopackIgnore: true */ UPLOAD_DIR, filename);

    await writeFile(filePath, buffer);

    const media = await adminCreateMedia({
      personId,
      eventId,
      filename,
      originalName: file.name,
      mimeType: detected.mimeType,
      size: buffer.length,
    });

    return NextResponse.json(media, { status: 201 });
  } catch {
    if (filePath) await unlink(filePath).catch(() => undefined);
    return NextResponse.json({ error: "Échec atomique de l’upload." }, { status: 500 });
  }
}
