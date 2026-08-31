import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  clientFingerprint,
  isAllowedOrigin,
  safeSecretEquals,
} from "./lib/session.js";

describe("admin HTTP security helpers", () => {
  it("compares configured secrets without accepting empty or partial values", () => {
    expect(safeSecretEquals("correct horse", "correct horse")).toBe(true);
    expect(safeSecretEquals("correct horse", "correct")).toBe(false);
    expect(safeSecretEquals("", "")).toBe(false);
  });

  it("accepts same-origin mutations and rejects absent or foreign origins", () => {
    expect(isAllowedOrigin("https://family.example/admin", "https://family.example")).toBe(true);
    expect(isAllowedOrigin("https://family.example/admin", null)).toBe(false);
    expect(isAllowedOrigin("https://family.example/admin", "https://evil.example")).toBe(false);
  });

  it("uses the canonical request URL rather than a spoofable host header", () => {
    expect(isAllowedOrigin("https://family.example/admin", "https://evil.example")).toBe(false);
  });

  it("creates a stable non-reversible client fingerprint", () => {
    const fingerprint = clientFingerprint("203.0.113.7", "server-key");
    expect(fingerprint).toBe(clientFingerprint("203.0.113.7", "server-key"));
    expect(fingerprint).not.toContain("203.0.113.7");
  });

  it("defines a root-scoped strict opaque session cookie", () => {
    expect(SESSION_COOKIE_NAME).toBe("admin_session");
    expect(SESSION_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/" });
  });
});
