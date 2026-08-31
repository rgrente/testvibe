import {
  adminCreateSession,
  adminIsLoginRateLimited,
  adminRecordLoginFailure,
  adminResetLoginFailures,
} from "@testvibe/core";
import { NextResponse } from "next/server";
import {
  clientFingerprint,
  getAdminSecret,
  isAllowedOrigin,
  safeSecretEquals,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  trustedClientAddress,
} from "@/lib/session";

export async function POST(request: Request) {
  const canonicalOrigin = process.env.ADMIN_ORIGIN;
  if (!canonicalOrigin || !isAllowedOrigin(canonicalOrigin, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminSecret = getAdminSecret();
  const clientAddress = trustedClientAddress(request);
  if (!clientAddress) {
    return NextResponse.json({ error: "Trusted proxy identity unavailable" }, { status: 503 });
  }
  const fingerprint = clientFingerprint(clientAddress, adminSecret || "unconfigured");
  if (await adminIsLoginRateLimited(fingerprint)) {
    return NextResponse.json({ error: "Too many attempts" }, {
      status: 429,
      headers: { "Retry-After": "900" },
    });
  }

  const formData = await request.formData();
  const entered = formData.get("secret")?.toString() ?? "";
  if (!safeSecretEquals(entered, adminSecret)) {
    await adminRecordLoginFailure(fingerprint);
    return NextResponse.redirect(new URL("/admin/login?error=1", canonicalOrigin), 303);
  }

  await adminResetLoginFailures(fingerprint);
  const token = await adminCreateSession();
  const response = NextResponse.redirect(new URL("/admin", canonicalOrigin), 303);
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
}
