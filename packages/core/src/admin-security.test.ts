import { createDb } from "@testvibe/db";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAdminSession,
  isLoginRateLimited,
  recordLoginFailure,
  resetLoginFailures,
  revokeAdminSession,
  verifyAdminSession,
} from "./admin-security.js";

const clients: Array<{ close(): void }> = [];

async function securityDb() {
  const instance = createDb(":memory:");
  clients.push(instance.client);
  await instance.db.run(sql`create table admin_session (
    token_hash text primary key not null,
    expires_at text not null,
    created_at text not null,
    revoked_at text
  )`);
  await instance.db.run(sql`create table login_rate_limit (
    fingerprint text primary key not null,
    failures integer not null,
    window_started_at text not null
  )`);
  return instance.db;
}

afterEach(() => clients.splice(0).forEach((client) => client.close()));

describe("admin security persistence", () => {
  it("accepts only the newest opaque unexpired and unrevoked session", async () => {
    const db = await securityDb();
    const now = new Date("2026-01-01T00:00:00.000Z");
    const first = await createAdminSession(db, now, () => Buffer.alloc(32, 1));
    const second = await createAdminSession(db, now, () => Buffer.alloc(32, 2));

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await verifyAdminSession(db, first, now)).toBe(false);
    expect(await verifyAdminSession(db, second, now)).toBe(true);
    expect(await verifyAdminSession(db, second, new Date(now.getTime() + 8 * 60 * 60 * 1000))).toBe(false);

    await revokeAdminSession(db, second, now);
    expect(await verifyAdminSession(db, second, now)).toBe(false);
  });

  it("blocks after five failures for fifteen minutes and can reset on success", async () => {
    const db = await securityDb();
    const now = new Date("2026-01-01T00:00:00.000Z");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await isLoginRateLimited(db, "client-hmac", now)).toBe(false);
      await recordLoginFailure(db, "client-hmac", now);
    }
    expect(await isLoginRateLimited(db, "client-hmac", now)).toBe(true);
    expect(await isLoginRateLimited(db, "client-hmac", new Date(now.getTime() + 15 * 60 * 1000))).toBe(false);

    await resetLoginFailures(db, "client-hmac");
    expect(await isLoginRateLimited(db, "client-hmac", now)).toBe(false);
  });
});
