import { beforeEach, describe, expect, it, vi } from "vitest";

const security = vi.hoisted(() => ({
  adminCreateSession: vi.fn(),
  adminIsLoginRateLimited: vi.fn(),
  adminRecordLoginFailure: vi.fn(),
  adminResetLoginFailures: vi.fn(),
}));

vi.mock("@testvibe/core", () => security);

import { POST } from "./route";

function loginRequest(secret: string, origin = "https://family.example") {
  const form = new URLSearchParams({ secret });
  return new Request("https://family.example/api/admin/login", {
    method: "POST",
    body: form,
    headers: {
      origin,
      host: "family.example",
      "x-forwarded-for": "203.0.113.8",
      "content-type": "application/x-www-form-urlencoded",
    },
  });
}

describe("POST /api/admin/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SECRET = "configured-admin-value";
    security.adminIsLoginRateLimited.mockResolvedValue(false);
    security.adminCreateSession.mockResolvedValue("opaque-session-token");
  });

  it("rejects foreign origins before checking credentials", async () => {
    const response = await POST(loginRequest("configured-admin-value", "https://evil.example"));
    expect(response.status).toBe(403);
    expect(security.adminCreateSession).not.toHaveBeenCalled();
  });

  it("returns 429 while the persistent failure window is blocked", async () => {
    security.adminIsLoginRateLimited.mockResolvedValue(true);
    const response = await POST(loginRequest("wrong"));
    expect(response.status).toBe(429);
  });

  it("sets only the opaque strict session cookie after a successful login", async () => {
    const response = await POST(loginRequest("configured-admin-value"));
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(response.status).toBe(303);
    expect(cookie).toContain("admin_session=opaque-session-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).not.toContain("configured-admin-value");
    expect(security.adminResetLoginFailures).toHaveBeenCalledOnce();
  });
});
