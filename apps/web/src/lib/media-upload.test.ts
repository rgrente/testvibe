import { describe, expect, it } from "vitest";
import { detectMediaType, hasSingleAttachment } from "./media-upload.js";

describe("media upload validation", () => {
  it.each([
    [Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg", "jpg"],
    [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png", "png"],
    [Buffer.from("GIF89a"), "image/gif", "gif"],
    [Buffer.from("%PDF-1.7"), "application/pdf", "pdf"],
  ])("derives %s from the real signature", (buffer, mimeType, extension) => {
    expect(detectMediaType(buffer)).toEqual({ mimeType, extension });
  });

  it("rejects spoofed or truncated content", () => {
    expect(detectMediaType(Buffer.from("not an image"))).toBeNull();
    expect(detectMediaType(Buffer.from([0x89, 0x50]))).toBeNull();
  });

  it("requires exactly one positive person or event attachment", () => {
    expect(hasSingleAttachment(1, null)).toBe(true);
    expect(hasSingleAttachment(null, 2)).toBe(true);
    expect(hasSingleAttachment(1, 2)).toBe(false);
    expect(hasSingleAttachment(null, null)).toBe(false);
    expect(hasSingleAttachment(Number.NaN, null)).toBe(false);
  });
});
