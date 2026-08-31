import { beforeEach, describe, expect, it, vi } from "vitest";

const rateLimit = vi.hoisted(() => ({ failures: new Map<string, number>(), startedAt: new Map<string, number>() }));
const security = vi.hoisted(() => ({
  adminCreateSession: vi.fn(),
  adminIsLoginRateLimited: vi.fn(async (fingerprint: string) => (rateLimit.failures.get(fingerprint) ?? 0) >= 5
    && Date.now() - (rateLimit.startedAt.get(fingerprint) ?? 0) < 15 * 60 * 1000),
  adminRecordLoginFailure: vi.fn(async (fingerprint: string) => {
    const startedAt = rateLimit.startedAt.get(fingerprint);
    if (!startedAt || Date.now() - startedAt >= 15 * 60 * 1000) {
      rateLimit.failures.set(fingerprint, 0);
      rateLimit.startedAt.set(fingerprint, Date.now());
    }
    rateLimit.failures.set(fingerprint, (rateLimit.failures.get(fingerprint) ?? 0) + 1);
  }),
  adminResetLoginFailures: vi.fn(async (fingerprint: string) => { rateLimit.failures.delete(fingerprint); }),
}));

vi.mock("@testvibe/core", () => security);

import { POST } from "./route";

function loginRequest(
  secret: string,
  origin = "https://family.example",
  host = "family.example",
  forwardedFor = "203.0.113.8",
  requestUrl = "https://family.example/api/admin/login",
) {
  const form = new URLSearchParams({ secret });
  return new Request(requestUrl, {
    method: "POST",
    body: form,
    headers: {
      origin,
      host,
      "x-forwarded-host": host,
      "x-forwarded-for": forwardedFor,
      "content-type": "application/x-www-form-urlencoded",
    },
  });
}

describe("POST /api/admin/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_SECRET = "configured-admin-value";
    process.env.ADMIN_ORIGIN = "https://family.example";
    process.env.ADMIN_TRUSTED_PROXY = "1";
    rateLimit.failures.clear();
    rateLimit.startedAt.clear();
    security.adminCreateSession.mockResolvedValue("opaque-session-token");
  });

  it("accepts the configured HTTPS origin when the internal request URL uses HTTP", async () => {
    const response = await POST(loginRequest(
      "configured-admin-value",
      undefined,
      undefined,
      undefined,
      "http://testvibe-web.testvibe.svc.cluster.local/api/admin/login",
    ));
    expect(response.status).toBe(303);
    expect(security.adminCreateSession).toHaveBeenCalledOnce();
  });

  it("rejects foreign origins before checking credentials", async () => {
    const response = await POST(loginRequest("configured-admin-value", "https://evil.example"));
    expect(response.status).toBe(403);
    expect(security.adminCreateSession).not.toHaveBeenCalled();
  });

  it("rejects requests without an Origin header", async () => {
    const request = loginRequest("configured-admin-value");
    request.headers.delete("origin");
    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(security.adminCreateSession).not.toHaveBeenCalled();
  });

  it("fails closed when ADMIN_ORIGIN is missing", async () => {
    delete process.env.ADMIN_ORIGIN;
    const response = await POST(loginRequest("configured-admin-value"));
    expect(response.status).toBe(403);
    expect(security.adminCreateSession).not.toHaveBeenCalled();
  });

  it("fails closed when ADMIN_ORIGIN is invalid", async () => {
    process.env.ADMIN_ORIGIN = "not a URL";
    const response = await POST(loginRequest("configured-admin-value"));
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

  it("fails closed without a trusted proxy instead of sharing a global denial-of-service bucket", async () => {
    delete process.env.ADMIN_TRUSTED_PROXY;
    const response = await POST(loginRequest("wrong", undefined, undefined, "203.0.113.8"));
    expect(response.status).toBe(503);
    expect(security.adminRecordLoginFailure).not.toHaveBeenCalled();
  });

  it("uses the trusted proxy address per client and ignores alternate client IP headers", async () => {
    process.env.ADMIN_TRUSTED_PROXY = "1";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const request = loginRequest("wrong", undefined, undefined, "203.0.113.8");
      request.headers.set("x-real-ip", `198.51.100.${attempt}`);
      expect((await POST(request)).status)
        .toBe(303);
    }
    expect((await POST(loginRequest("wrong", undefined, undefined, "203.0.113.8"))).status)
      .toBe(429);
    expect((await POST(loginRequest("wrong", undefined, undefined, "198.51.100.99"))).status)
      .toBe(303);
    expect(new Set(security.adminRecordLoginFailure.mock.calls.map(([fingerprint]) => fingerprint)).size).toBe(2);
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
