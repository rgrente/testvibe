import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { detectMediaType, hasSingleAttachment } from "./media-upload.js";

function validPdf(): Buffer {
  const header = "%PDF-1.4\n";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] >>\nendobj\n",
  ];
  const offsets: number[] = [];
  let body = header;
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xrefOffset = Buffer.byteLength(body);
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f ",
    ...offsets.map((offset) => `${offset.toString().padStart(10, "0")} 00000 n `)].join("\n");
  return Buffer.from(`${body}${xref}\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
}

describe("media upload validation", () => {
  it.each([
    [Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"), "image/png", "png"],
    [Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"), "image/gif", "gif"],
  ])("derives the type only from a fully decodable file", async (buffer, mimeType, extension) => {
    await expect(detectMediaType(buffer)).resolves.toEqual({ mimeType, extension });
  });

  it.each([
    Buffer.from("not an image"),
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.from("GIF89a"),
    Buffer.from("%PDF-1.7"),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  ])("rejects spoofed, truncated, or unsupported content", async (buffer) => {
    await expect(detectMediaType(buffer)).resolves.toBeNull();
  });

  it("accepts a structurally complete PDF and rejects truncated or spoofed PDFs", async () => {
    const complete = validPdf();
    await expect(detectMediaType(complete)).resolves.toEqual({
      mimeType: "application/pdf",
      extension: "pdf",
    });
    await expect(detectMediaType(complete.subarray(0, complete.length - 6))).resolves.toBeNull();
    await expect(detectMediaType(Buffer.from("%PDF-1.7\nnot a document\n%%EOF\n"))).resolves.toBeNull();
  });

  it.each([
    ["jpeg", "image/jpeg", "jpg"],
    ["png", "image/png", "png"],
    ["gif", "image/gif", "gif"],
    ["webp", "image/webp", "webp"],
    ["avif", "image/avif", "avif"],
  ] as const)("decodes complete %s fixtures and rejects their truncation", async (format, mimeType, extension) => {
    const fixture = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#336699" },
    }).toFormat(format).toBuffer();
    await expect(detectMediaType(fixture)).resolves.toEqual({ mimeType, extension });
    await expect(detectMediaType(fixture.subarray(0, Math.floor(fixture.length / 2))))
      .resolves.toBeNull();
  });

  it("requires exactly one positive person or event attachment", () => {
    expect(hasSingleAttachment(1, null)).toBe(true);
    expect(hasSingleAttachment(null, 2)).toBe(true);
    expect(hasSingleAttachment(1, 2)).toBe(false);
    expect(hasSingleAttachment(null, null)).toBe(false);
    expect(hasSingleAttachment(Number.NaN, null)).toBe(false);
  });
});
