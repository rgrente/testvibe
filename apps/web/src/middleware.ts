/**
 * Middleware Next.js — protection des routes /admin (Phase 3, tâche #22).
 *
 * Toute requête vers /admin/* est vérifiée :
 * - Si le cookie de session est valide → laissée passer.
 * - Sinon → redirigée vers /admin/login.
 *
 * La route /admin/login elle-même est toujours accessible (sinon on
 * crée une boucle de redirection infinie).
 *
 * Ce fichier tourne dans le runtime Edge de Next.js (pas de Node.js
 * APIs). Il ne doit donc pas importer de module Node-only.
 */
import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, isValidSession, getAdminSecret } from "./lib/session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Les routes hors /admin ne sont pas concernées par ce middleware.
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // La page de login doit rester accessible sans session valide.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const adminSecret = getAdminSecret();

  if (!isValidSession(sessionCookie, adminSecret)) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
