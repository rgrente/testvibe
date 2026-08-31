import { type NextRequest, NextResponse } from "next/server";
import { adminCreateMedia, adminGetEvent, adminGetMedia, adminGetMediaByFilename, adminGetPerson } from "@testvibe/core";
import { readdir, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { authorizeMutationRequest } from "@/lib/session";
import { detectMediaType, hasSingleAttachment } from "@/lib/media-upload";
import { recoverMediaArtifacts } from "@/lib/media-recovery";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
export const uploadFileOps = {
  existsSync, mkdir, readdir, rename, writeFile, unlink,
  getMedia: adminGetMedia,
  getMediaByFilename: adminGetMediaByFilename,
};

async function cleanUpPartialUpload(filePath: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await uploadFileOps.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    }
  }
  return false;
}

/**
 * POST /api/media/upload
 * Multipart form-data : champ "file" (obligatoire), "personId" ou "eventId" (au moins un).
 * Retourne le Media créé en JSON.
 */
export async function POST(request: NextRequest) {
  const authorization = await authorizeMutationRequest(request);
  if (authorization) return NextResponse.json({ error: authorization === 401 ? "Unauthorized" : "Forbidden" }, { status: authorization });
  try {
    if (!uploadFileOps.existsSync(/* turbopackIgnore: true */ UPLOAD_DIR)) {
      await uploadFileOps.mkdir(UPLOAD_DIR, { recursive: true });
    }
    await recoverMediaArtifacts(UPLOAD_DIR, uploadFileOps);
  } catch {
    return NextResponse.json({ error: "Media recovery pending." }, { status: 503 });
  }
  let filePath: string | undefined;
  let metadataCommitted = false;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const personIdRaw = formData.get("personId")?.toString();
    const eventIdRaw = formData.get("eventId")?.toString();
    const visibility = formData.get("visibility")?.toString() as "public" | "family" | "private" | undefined;

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
    const detected = await detectMediaType(buffer);
    if (!detected) {
      return NextResponse.json({ error: "Contenu de fichier non supporté." }, { status: 400 });
    }

    // Generate unique filename to avoid collisions
    const filename = `${randomUUID()}.${detected.extension}`;
    const finalPath = join(/* turbopackIgnore: true */ UPLOAD_DIR, filename);
    filePath = join(/* turbopackIgnore: true */ UPLOAD_DIR, `.uploading-pending-${filename}`);

    await uploadFileOps.writeFile(filePath, buffer);

    const media = await adminCreateMedia({
      personId,
      eventId,
      filename,
      originalName: file.name,
      mimeType: detected.mimeType,
      size: buffer.length,
      visibility,
    });
    metadataCommitted = true;
    await uploadFileOps.rename(filePath, finalPath);

    return NextResponse.json(media, { status: 201 });
  } catch {
    if (metadataCommitted) {
      return NextResponse.json({ error: "Upload staged; automatic recovery pending." }, { status: 503 });
    }
    const recovered = !filePath || await cleanUpPartialUpload(filePath);
    return NextResponse.json(
      { error: recovered ? "Échec atomique de l’upload." : "Upload incohérent, récupération requise." },
      { status: recovered ? 500 : 503 },
    );
  }
}
