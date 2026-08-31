import sharp from "sharp";

export interface DetectedMediaType {
  mimeType: string;
  extension: string;
}

function isStructurallyValidPdf(buffer: Buffer): boolean {
  const text = buffer.toString("latin1");
  if (!/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(text)) return false;
  const startXref = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(text);
  if (!startXref) return false;
  const xrefOffset = Number(startXref[1]);
  if (!Number.isSafeInteger(xrefOffset) || !text.startsWith("xref", xrefOffset)) return false;

  const trailerOffset = text.indexOf("trailer", xrefOffset + 4);
  if (trailerOffset < 0 || trailerOffset > startXref.index) return false;
  const xrefLines = text.slice(xrefOffset + 4, trailerOffset).trim().split(/\r?\n/);
  const objects = new Map<string, number>();
  for (let line = 0; line < xrefLines.length;) {
    const subsection = /^(\d+)\s+(\d+)$/.exec(xrefLines[line]?.trim() ?? "");
    if (!subsection) return false;
    const firstObject = Number(subsection[1]);
    const count = Number(subsection[2]);
    line += 1;
    if (!Number.isSafeInteger(firstObject) || !Number.isSafeInteger(count) || count < 1) return false;
    for (let entryIndex = 0; entryIndex < count; entryIndex += 1, line += 1) {
      const entry = /^(\d{10})\s(\d{5})\s([fn])\s*$/.exec(xrefLines[line] ?? "");
      if (!entry) return false;
      if (entry[3] === "n") objects.set(`${firstObject + entryIndex} ${Number(entry[2])}`, Number(entry[1]));
    }
  }

  const trailer = text.slice(trailerOffset, startXref.index);
  const root = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(trailer);
  if (!root) return false;
  const rootOffset = objects.get(`${root[1]} ${Number(root[2])}`);
  if (rootOffset === undefined) return false;
  const rootObject = text.slice(rootOffset, text.indexOf("endobj", rootOffset) + 6);
  if (!rootObject.startsWith(`${root[1]} ${Number(root[2])} obj`) || !/\/Type\s*\/Catalog\b/.test(rootObject)) {
    return false;
  }
  const pages = /\/Pages\s+(\d+)\s+(\d+)\s+R/.exec(rootObject);
  if (!pages) return false;
  const pagesOffset = objects.get(`${pages[1]} ${Number(pages[2])}`);
  if (pagesOffset === undefined) return false;
  const pagesObject = text.slice(pagesOffset, text.indexOf("endobj", pagesOffset) + 6);
  return pagesObject.startsWith(`${pages[1]} ${Number(pages[2])} obj`)
    && /\/Type\s*\/Pages\b/.test(pagesObject);
}

export async function detectMediaType(buffer: Buffer): Promise<DetectedMediaType | null> {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return isStructurallyValidPdf(buffer) ? { mimeType: "application/pdf", extension: "pdf" } : null;
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
