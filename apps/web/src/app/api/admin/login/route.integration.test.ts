import { createClient, type Client } from "@libsql/client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let directory: string;
let database: Client;
let POST: typeof import("./route").POST;

function loginRequest(forwardedFor: string, realIp: string) {
  return new Request("https://family.example/api/admin/login", {
    method: "POST",
    body: new URLSearchParams({ secret: "wrong" }),
    headers: {
      origin: "https://family.example",
      "x-forwarded-for": forwardedFor,
      "x-real-ip": realIp,
      "content-type": "application/x-www-form-urlencoded",
    },
  });
}

describe("POST /api/admin/login persistent rate limit", () => {
  beforeAll(async () => {
    directory = await mkdtemp(resolve(tmpdir(), "testvibe-login-route-"));
    const databasePath = resolve(directory, "login.db");
    database = createClient({ url: `file:${databasePath}` });
    await database.execute(`
      CREATE TABLE login_rate_limit (
        fingerprint text PRIMARY KEY NOT NULL,
        failures integer NOT NULL,
        window_started_at text NOT NULL
      );
    `);
    process.env.DATABASE_URL = `file:${databasePath}`;
    process.env.ADMIN_SECRET = "configured-admin-value";
    process.env.ADMIN_ORIGIN = "https://family.example";
    process.env.ADMIN_TRUSTED_PROXY = "1";
    vi.resetModules();
    ({ POST } = await import("./route"));
  });

  afterAll(async () => {
    vi.useRealTimers();
    database.close();
    delete process.env.DATABASE_URL;
    delete process.env.ADMIN_SECRET;
    delete process.env.ADMIN_ORIGIN;
    delete process.env.ADMIN_TRUSTED_PROXY;
    await rm(directory, { recursive: true, force: true });
  });

  it("persists five failures per trusted address despite rotating client headers and expires the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await POST(loginRequest("203.0.113.8", `198.51.100.${attempt}`))).status).toBe(303);
    }

    expect((await database.execute("select failures from login_rate_limit")).rows[0])
      .toMatchObject({ failures: 5 });
    expect((await POST(loginRequest("203.0.113.8", "192.0.2.44"))).status).toBe(429);
    expect((await POST(loginRequest("203.0.113.9", "192.0.2.44"))).status).toBe(303);

    vi.advanceTimersByTime(15 * 60 * 1000);
    expect((await POST(loginRequest("203.0.113.8", "192.0.2.44"))).status).toBe(303);
    expect((await database.execute("select failures from login_rate_limit order by failures desc limit 1")).rows[0])
      .toMatchObject({ failures: 1 });
  });
});
