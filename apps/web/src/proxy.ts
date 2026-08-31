/**
 * Proxy Next.js — protection des routes /admin (Phase 3, tâche #22).
 *
 * Toute requête vers /admin/* est vérifiée :
 * - Si le cookie de session est valide → laissée passer.
 * - Sinon → redirigée vers /admin/login.
 *
 * La route /admin/login elle-même est toujours accessible (sinon on
 * crée une boucle de redirection infinie).
 *
 * Next.js 16 exécute ce fichier dans le runtime Node.js.
 */
import { type NextRequest, NextResponse } from "next/server";
import { adminVerifySession } from "@testvibe/core";
import { SESSION_COOKIE_NAME } from "./lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Les routes hors /admin ne sont pas concernées par ce proxy.
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // La page de login doit rester accessible sans session valide.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!(await adminVerifySession(sessionCookie))) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
