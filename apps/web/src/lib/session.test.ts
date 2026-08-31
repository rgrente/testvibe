import { beforeEach, describe, expect, it, vi } from "vitest";

const requestState = vi.hoisted(() => ({
  cookie: "opaque",
  origin: "https://family.example",
  host: "family.example",
  validSession: true,
}));

vi.mock("@testvibe/core", () => ({ adminVerifySession: vi.fn(async () => requestState.validSession) }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: requestState.cookie }) })),
  headers: vi.fn(async () => new Headers({
    origin: requestState.origin,
    host: requestState.host,
    "x-forwarded-host": requestState.host,
  })),
}));

import { requireAdminMutation } from "./session";

describe("Server Action mutation origin", () => {
  beforeEach(() => {
    process.env.ADMIN_ORIGIN = "https://family.example";
    requestState.origin = "https://family.example";
    requestState.host = "family.example";
    requestState.validSession = true;
  });

  it("rejects an absent or invalid session before evaluating the mutation origin", async () => {
    requestState.validSession = false;
    await expect(requireAdminMutation()).rejects.toThrow("Unauthorized");
  });

  it("accepts the configured canonical origin", async () => {
    await expect(requireAdminMutation()).resolves.toBeUndefined();
  });

  it("rejects matching spoofed Host and Origin headers", async () => {
    requestState.origin = "https://evil.example";
    requestState.host = "evil.example";
    await expect(requireAdminMutation()).rejects.toThrow("Forbidden");
  });

  it("fails closed when no canonical origin is configured", async () => {
    delete process.env.ADMIN_ORIGIN;
    await expect(requireAdminMutation()).rejects.toThrow("Forbidden");
  });
});
