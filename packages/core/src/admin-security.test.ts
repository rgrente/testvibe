import { createDb } from "@testvibe/db";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createAdminSession,
  isLoginRateLimited,
  recordLoginFailure,
  resetLoginFailures,
  revokeAdminSession,
  verifyAdminSession,
} from "./admin-security.js";

const clients: Array<{ close(): void }> = [];
const temporaryDirectories: string[] = [];

async function securityDb() {
  const directory = await mkdtemp(join(tmpdir(), "testvibe-admin-security-"));
  temporaryDirectories.push(directory);
  const instance = createDb(`file:${join(directory, "security.db")}`);
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

afterEach(async () => {
  clients.splice(0).forEach((client) => client.close());
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

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

  it("keeps exactly one valid session when logins rotate concurrently", async () => {
    const db = await securityDb();
    const now = new Date("2026-01-01T00:00:00.000Z");
    let entropy = 0;
    const tokens = await Promise.all(Array.from({ length: 5 }, () =>
      createAdminSession(db, now, () => Buffer.alloc(32, entropy += 1))));

    const validity = await Promise.all(tokens.map((token) => verifyAdminSession(db, token, now)));
    expect(validity.filter(Boolean)).toHaveLength(1);
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

  it("counts every concurrent login failure atomically", async () => {
    const db = await securityDb();
    const now = new Date("2026-01-01T00:00:00.000Z");
    await Promise.all(Array.from({ length: 5 }, () => recordLoginFailure(db, "client-hmac", now)));
    expect(await isLoginRateLimited(db, "client-hmac", now)).toBe(true);
  });
});
