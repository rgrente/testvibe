import { type NextRequest, NextResponse } from "next/server";
import { adminDeleteMedia, adminGetMedia } from "@testvibe/core";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { authorizeMutationRequest } from "@/lib/session";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");

/**
 * GET /api/media/[filename]
 * Sert un fichier média par son filename (UUID-based, sans traversal).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  // Sanitize: no path traversal
  const safe = filename.replace(/[^a-zA-Z0-9.\-_]/g, "");
  if (safe !== filename) {
    return NextResponse.json({ error: "Nom de fichier invalide." }, { status: 400 });
  }
  const filePath = join(/* turbopackIgnore: true */ UPLOAD_DIR, safe);
  if (!existsSync(/* turbopackIgnore: true */ filePath)) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }
  const stream = createReadStream(/* turbopackIgnore: true */ filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;
  const ext = safe.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    pdf: "application/pdf",
  };
  const contentType = mimeMap[ext] ?? "application/octet-stream";
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
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
    if (!existsSync(/* turbopackIgnore: true */ filePath)) {
      return NextResponse.json({ error: "Fichier et base incohérents." }, { status: 409 });
    }
    const contents = await readFile(filePath);
    await unlink(filePath);
    try {
      await adminDeleteMedia(id);
    } catch {
      await writeFile(filePath, contents);
      throw new Error("database delete failed");
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Échec atomique de la suppression." }, { status: 500 });
  }
}
