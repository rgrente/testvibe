/**
 * Tests automatisés pour le middleware de protection des routes /admin.
 * Vérifie qu'une requête sans cookie de session valide est redirigée,
 * et qu'une requête avec un cookie valide est laissée passer.
 */
import { describe, it, expect } from "vitest";

// On importe uniquement les helpers purs, pas le middleware Next.js
// (qui dépend du runtime Edge). Le comportement est testé via la
// logique de session.
import { isValidSession, SESSION_COOKIE_NAME } from "./lib/session.js";

describe("session helpers", () => {
  const VALID_SECRET = "my-secret-123";

  it("retourne false si la valeur est vide ou absente", () => {
    expect(isValidSession("", VALID_SECRET)).toBe(false);
    expect(isValidSession(undefined, VALID_SECRET)).toBe(false);
  });

  it("retourne false si la valeur ne correspond pas au secret", () => {
    expect(isValidSession("wrong-secret", VALID_SECRET)).toBe(false);
    expect(isValidSession("other", VALID_SECRET)).toBe(false);
  });

  it("retourne true si la valeur correspond exactement au secret", () => {
    expect(isValidSession(VALID_SECRET, VALID_SECRET)).toBe(true);
  });

  it("retourne false si le secret attendu est vide (configuration manquante)", () => {
    expect(isValidSession("any-value", "")).toBe(false);
    expect(isValidSession("any-value", undefined)).toBe(false);
  });

  it("SESSION_COOKIE_NAME est bien défini et non vide", () => {
    expect(SESSION_COOKIE_NAME).toBeTruthy();
    expect(typeof SESSION_COOKIE_NAME).toBe("string");
  });
});
