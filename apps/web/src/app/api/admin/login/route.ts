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
} from "@/lib/session";

export async function POST(request: Request) {
  if (!isAllowedOrigin(request.url, request.headers.get("origin"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const adminSecret = getAdminSecret();
  // A Web Request has no authenticated peer address. Treating forwarding
  // headers as identity lets clients rotate them, so use one deployment-wide
  // bucket unless a trusted transport supplies identity outside this handler.
  const fingerprint = clientFingerprint("admin-login-global", adminSecret || "unconfigured");
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
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url), 303);
  }

  await adminResetLoginFailures(fingerprint);
  const token = await adminCreateSession();
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
}
