import sharp from "sharp";

export interface DetectedMediaType {
  mimeType: string;
  extension: string;
}

async function isStructurallyValidPdf(buffer: Buffer): Promise<boolean> {
  let task: ReturnType<typeof import("pdfjs-dist/legacy/build/pdf.mjs")["getDocument"]> | undefined;
  try {
    const text = buffer.toString("latin1");
    if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(text)
      || !/startxref\s+\d+\s+%%EOF\s*$/.test(text)) return false;
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    task = getDocument({ data: Uint8Array.from(buffer), stopAtErrors: true, verbosity: 0 });
    const document = await task.promise;
    if (document.numPages < 1) return false;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      await page.getOperatorList();
    }
    return true;
  } catch {
    return false;
  } finally {
    await task?.destroy();
  }
}

export async function detectMediaType(buffer: Buffer): Promise<DetectedMediaType | null> {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return await isStructurallyValidPdf(buffer) ? { mimeType: "application/pdf", extension: "pdf" } : null;
  }
  try {
    const image = sharp(buffer, { animated: true, failOn: "truncated" });
    const metadata = await image.metadata();
    await image.toBuffer();
    if (metadata.format === "heif") {
      return metadata.compression === "av1" ? { mimeType: "image/avif", extension: "avif" } : null;
    }
    const supported: Partial<Record<NonNullable<typeof metadata.format>, DetectedMediaType>> = {
      jpeg: { mimeType: "image/jpeg", extension: "jpg" },
      png: { mimeType: "image/png", extension: "png" },
      gif: { mimeType: "image/gif", extension: "gif" },
      webp: { mimeType: "image/webp", extension: "webp" },
    };
    return metadata.format ? supported[metadata.format] ?? null : null;
  } catch {
    return null;
  }
}

export function hasSingleAttachment(personId: number | null, eventId: number | null): boolean {
  const person = personId !== null && Number.isInteger(personId) && personId > 0;
  const event = eventId !== null && Number.isInteger(eventId) && eventId > 0;
  return person !== event;
}
