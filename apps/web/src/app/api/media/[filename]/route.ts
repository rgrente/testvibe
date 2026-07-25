import { type NextRequest, NextResponse } from "next/server";
import { adminDeleteMedia, adminGetMedia } from "@testvibe/core";
import { unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";

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
  const filePath = join(UPLOAD_DIR, safe);
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }
  const stream = createReadStream(filePath);
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
  const { filename } = await params;
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "id requis." }, { status: 400 });
  }
  try {
    const mediaRecord = await adminGetMedia(id);
    await adminDeleteMedia(id);
    const filePath = join(UPLOAD_DIR, mediaRecord.filename);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
