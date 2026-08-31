import sharp from "sharp";

export interface DetectedMediaType {
  mimeType: string;
  extension: string;
}

export async function detectMediaType(buffer: Buffer): Promise<DetectedMediaType | null> {
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
