import { adminVerifySession } from "@testvibe/core";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60,
};

export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET ?? "";
}

export function safeSecretEquals(value: string, expected: string): boolean {
  if (!value || !expected) return false;
  const actualHash = createHash("sha256").update(value).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export function clientFingerprint(clientAddress: string, key: string): string {
  return createHmac("sha256", key).update(clientAddress || "unknown").digest("hex");
}

export function isAllowedOrigin(
  requestUrl: string,
  origin: string | null,
  host: string | null,
): boolean {
  if (!origin || !host) return false;
  try {
    const request = new URL(requestUrl);
    const submitted = new URL(origin);
    return submitted.protocol === request.protocol && submitted.host === host;
  } catch {
    return false;
  }
}

export async function authorizeMutationRequest(request: Request): Promise<401 | 403 | null> {
  const token = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
  if (!(await adminVerifySession(token))) return 401;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return isAllowedOrigin(request.url, request.headers.get("origin"), host) ? null : 403;
}

export async function requireAdminMutation(): Promise<void> {
  const cookieStore = await cookies();
  if (!(await adminVerifySession(cookieStore.get(SESSION_COOKIE_NAME)?.value))) {
    throw new Error("Unauthorized");
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  if (!isAllowedOrigin(`${protocol}://${host ?? "invalid"}/`, requestHeaders.get("origin"), host)) {
    throw new Error("Forbidden");
  }
}
