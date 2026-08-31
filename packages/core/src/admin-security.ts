import { adminSession, db as defaultDb, loginRateLimit, type Database } from "@testvibe/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const sessionRotationQueues = new WeakMap<object, Promise<void>>();

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isDatabaseBusy(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error
    && (error as { code?: unknown }).code === "SQLITE_BUSY";
}

export async function createAdminSession(
  database: Database,
  now = new Date(),
  entropy: (size: number) => Buffer = randomBytes,
): Promise<string> {
  const token = entropy(32).toString("base64url");
  const timestamp = now.toISOString();
  const previousRotation = sessionRotationQueues.get(database) ?? Promise.resolve();
  let releaseRotation!: () => void;
  const currentRotation = new Promise<void>((resolve) => { releaseRotation = resolve; });
  sessionRotationQueues.set(database, previousRotation.catch(() => undefined).then(() => currentRotation));
  await previousRotation.catch(() => undefined);
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await database.transaction(async (tx) => {
          await tx.update(adminSession).set({ revokedAt: timestamp }).where(isNull(adminSession.revokedAt));
          await tx.insert(adminSession).values({
            tokenHash: tokenHash(token),
            createdAt: timestamp,
            expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
          });
        }, { behavior: "immediate" });
        break;
      } catch (error) {
        if (!isDatabaseBusy(error) || attempt >= 9) throw error;
        await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 5));
      }
    }
  } finally {
    releaseRotation();
  }
  return token;
}

export async function verifyAdminSession(
  database: Database,
  token: string | undefined,
  now = new Date(),
): Promise<boolean> {
  if (!token) return false;
  const rows = await database.select({ tokenHash: adminSession.tokenHash })
    .from(adminSession)
    .where(and(
      eq(adminSession.tokenHash, tokenHash(token)),
      isNull(adminSession.revokedAt),
      gt(adminSession.expiresAt, now.toISOString()),
    ))
    .limit(1);
  return rows.length === 1;
}

export async function revokeAdminSession(
  database: Database,
  token: string | undefined,
  now = new Date(),
): Promise<void> {
  if (!token) return;
  await database.update(adminSession)
    .set({ revokedAt: now.toISOString() })
    .where(eq(adminSession.tokenHash, tokenHash(token)));
}

export async function isLoginRateLimited(
  database: Database,
  fingerprint: string,
  now = new Date(),
): Promise<boolean> {
  const rows = await database.select().from(loginRateLimit)
    .where(eq(loginRateLimit.fingerprint, fingerprint)).limit(1);
  const record = rows[0];
  if (!record) return false;
  return now.getTime() - Date.parse(record.windowStartedAt) < RATE_LIMIT_WINDOW_MS
    && record.failures >= MAX_LOGIN_FAILURES;
}

export async function recordLoginFailure(
  database: Database,
  fingerprint: string,
  now = new Date(),
): Promise<void> {
  const windowStartedAt = now.toISOString();
  const cutoff = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
  await database.insert(loginRateLimit).values({
    fingerprint,
    failures: 1,
    windowStartedAt,
  }).onConflictDoUpdate({
    target: loginRateLimit.fingerprint,
    set: {
      failures: sql`case when ${loginRateLimit.windowStartedAt} <= ${cutoff} then 1 else ${loginRateLimit.failures} + 1 end`,
      windowStartedAt: sql`case when ${loginRateLimit.windowStartedAt} <= ${cutoff} then ${windowStartedAt} else ${loginRateLimit.windowStartedAt} end`,
    },
  });
}

export async function resetLoginFailures(database: Database, fingerprint: string): Promise<void> {
  await database.delete(loginRateLimit).where(eq(loginRateLimit.fingerprint, fingerprint));
}

export const adminCreateSession = (now?: Date) => createAdminSession(defaultDb, now);
export const adminVerifySession = (token: string | undefined, now?: Date) => verifyAdminSession(defaultDb, token, now);
export const adminRevokeSession = (token: string | undefined, now?: Date) => revokeAdminSession(defaultDb, token, now);
export const adminIsLoginRateLimited = (fingerprint: string, now?: Date) => isLoginRateLimited(defaultDb, fingerprint, now);
export const adminRecordLoginFailure = (fingerprint: string, now?: Date) => recordLoginFailure(defaultDb, fingerprint, now);
export const adminResetLoginFailures = (fingerprint: string) => resetLoginFailures(defaultDb, fingerprint);
