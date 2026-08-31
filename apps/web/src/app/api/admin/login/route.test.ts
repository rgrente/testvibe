import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.hoisted(() => ({ failures: 0, startedAt: 0 }));
const security = vi.hoisted(() => ({
  adminCreateSession: vi.fn(),
  adminIsLoginRateLimited: vi.fn(async () => rateLimit.failures >= 5
    && Date.now() - rateLimit.startedAt < 15 * 60 * 1000),
  adminRecordLoginFailure: vi.fn(async () => {
    if (!rateLimit.startedAt || Date.now() - rateLimit.startedAt >= 15 * 60 * 1000) {
      rateLimit.failures = 0;
      rateLimit.startedAt = Date.now();
    }
    rateLimit.failures += 1;
  }),
  adminResetLoginFailures: vi.fn(async () => { rateLimit.failures = 0; }),
}));

vi.mock("@testvibe/core", () => security);

import { POST } from "./route";

function loginRequest(secret: string, origin = "https://family.example", host = "family.example") {
  const form = new URLSearchParams({ secret });
  return new Request("https://family.example/api/admin/login", {
    method: "POST",
    body: form,
    headers: {
      origin,
      host,
      "x-forwarded-host": host,
      "x-forwarded-for": "203.0.113.8",
      "content-type": "application/x-www-form-urlencoded",
    },
  });
}

describe("POST /api/admin/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SECRET = "configured-admin-value";
    rateLimit.failures = 0;
    rateLimit.startedAt = 0;
    security.adminCreateSession.mockResolvedValue("opaque-session-token");
  });

  it("rejects foreign origins before checking credentials", async () => {
    const response = await POST(loginRequest("configured-admin-value", "https://evil.example"));
    expect(response.status).toBe(403);
    expect(security.adminCreateSession).not.toHaveBeenCalled();
  });

  it("rejects spoofed Host and X-Forwarded-Host values", async () => {
    const response = await POST(loginRequest("configured-admin-value", "https://evil.example", "evil.example"));
    expect(response.status).toBe(403);
    expect(security.adminCreateSession).not.toHaveBeenCalled();
  });

  it("returns 429 while the persistent failure window is blocked", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await POST(loginRequest("wrong"))).status).toBe(303);
    }
    expect(security.adminRecordLoginFailure).toHaveBeenCalledTimes(5);
    expect((await POST(loginRequest("wrong"))).status).toBe(429);
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect((await POST(loginRequest("wrong"))).status).toBe(303);
    vi.useRealTimers();
  });

  it("sets only the opaque strict session cookie after a successful login", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await POST(loginRequest("configured-admin-value"));
    const cookie = response.headers.get("set-cookie") ?? "";
    const body = await response.clone().text();
    expect(response.status).toBe(303);
    expect(cookie).toContain("admin_session=opaque-session-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("configured-admin-value");
    expect(body).not.toContain("configured-admin-value");
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(security.adminResetLoginFailures).toHaveBeenCalledOnce();
    vi.unstubAllEnvs();
  });
});
