import { adminVerifySession } from "@testvibe/core";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { cookies, headers } from "next/headers";

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60,
};

export function sessionCookieOptions() {
  return { ...SESSION_COOKIE_OPTIONS, secure: process.env.NODE_ENV === "production" };
}

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

export function trustedClientAddress(request: Request): string | null {
  // The edge proxy must strip client-supplied forwarding headers before this
  // explicit trust switch is enabled. Without that boundary login fails closed.
  if (process.env.ADMIN_TRUSTED_PROXY !== "1") return null;
  const address = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "";
  return isIP(address) ? address : null;
}

export function isAllowedOrigin(
  requestUrl: string,
  origin: string | null,
): boolean {
  if (!origin) return false;
  try {
    const request = new URL(requestUrl);
    const submitted = new URL(origin);
    return submitted.origin === request.origin;
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
  return isAllowedOrigin(request.url, request.headers.get("origin")) ? null : 403;
}

export async function requireAdminMutation(): Promise<void> {
  const cookieStore = await cookies();
  if (!(await adminVerifySession(cookieStore.get(SESSION_COOKIE_NAME)?.value))) {
    throw new Error("Unauthorized");
  }
  const requestHeaders = await headers();
  const canonicalOrigin = process.env.ADMIN_ORIGIN;
  if (!canonicalOrigin || !isAllowedOrigin(canonicalOrigin, requestHeaders.get("origin"))) {
    throw new Error("Forbidden");
  }
}
