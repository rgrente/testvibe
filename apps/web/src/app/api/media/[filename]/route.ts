import { type NextRequest, NextResponse } from "next/server";
import { adminDeleteMedia, adminGetMedia, adminGetMediaByFilename, adminVerifySession, getMediaForWebByFilename } from "@testvibe/core";
import { readdir, rename, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { authorizeMutationRequest, SESSION_COOKIE_NAME } from "@/lib/session";
import { recoverMediaArtifacts } from "@/lib/media-recovery";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
export const mediaFileOps = {
  existsSync, readdir, rename, unlink,
  getMedia: adminGetMedia,
  getMediaByFilename: adminGetMediaByFilename,
  getPublicMedia: getMediaForWebByFilename,
};

async function restoreQuarantine(quarantinePath: string, filePath: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await mediaFileOps.rename(quarantinePath, filePath);
      return true;
    } catch {
      // The quarantine remains durable for automatic recovery after retries.
    }
  }
  return false;
}

function mediaNotFound() {
  return NextResponse.json({ error: "Fichier introuvable." }, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function sessionToken(request: Request): string | undefined {
  return request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
}

/**
 * GET /api/media/[filename]
 * Sert un fichier média par son filename (UUID-based, sans traversal).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  // Sanitize: no path traversal
  const safe = filename.replace(/[^a-zA-Z0-9.\-_]/g, "");
  if (safe !== filename) return mediaNotFound();
  let metadata;
  try {
    metadata = await adminVerifySession(sessionToken(request))
      ? await mediaFileOps.getMediaByFilename(safe)
      : await mediaFileOps.getPublicMedia(safe);
  } catch {
    return mediaNotFound();
  }
  const filePath = join(/* turbopackIgnore: true */ UPLOAD_DIR, safe);
  if (!mediaFileOps.existsSync(/* turbopackIgnore: true */ filePath)) return mediaNotFound();
  const stream = createReadStream(/* turbopackIgnore: true */ filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": metadata.mimeType,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * DELETE /api/media/[filename]?id=<mediaId>
 * Supprime le média de la base et le fichier du disque.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const authorization = await authorizeMutationRequest(request);
  if (authorization) return NextResponse.json({ error: authorization === 401 ? "Unauthorized" : "Forbidden" }, { status: authorization });
  try {
    await recoverMediaArtifacts(UPLOAD_DIR, mediaFileOps);
  } catch {
    return NextResponse.json({ error: "Media recovery pending." }, { status: 503 });
  }
  const { filename } = await params;
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "id requis." }, { status: 400 });
  }
  try {
    const mediaRecord = await adminGetMedia(id);
    if (mediaRecord.filename !== filename) {
      return NextResponse.json({ error: "Association id/filename invalide." }, { status: 400 });
    }
    const filePath = join(/* turbopackIgnore: true */ UPLOAD_DIR, mediaRecord.filename);
    if (!mediaFileOps.existsSync(/* turbopackIgnore: true */ filePath)) {
      return NextResponse.json({ error: "Fichier et base incohérents." }, { status: 409 });
    }
    const quarantinePath = join(UPLOAD_DIR, `.deleting-${id}-${mediaRecord.filename}`);
    await mediaFileOps.rename(filePath, quarantinePath);
    try {
      await adminDeleteMedia(id);
    } catch {
      if (await restoreQuarantine(quarantinePath, filePath)) {
        return NextResponse.json({ error: "Échec atomique de la suppression." }, { status: 500 });
      }
      return NextResponse.json({ error: "Suppression staged; automatic recovery pending." }, { status: 503 });
    }
    try {
      await mediaFileOps.unlink(quarantinePath);
    } catch {
      return NextResponse.json({ error: "Suppression committed; automatic cleanup pending." }, { status: 503 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Échec atomique de la suppression." }, { status: 500 });
  }
}
