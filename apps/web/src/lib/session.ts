/**
 * Utilitaires de session pour le mode édition protégé (Phase 3, tâche #22).
 *
 * La protection repose sur un secret simple défini via la variable
 * d'environnement ADMIN_SECRET (côté serveur uniquement — jamais NEXT_PUBLIC_).
 * Un cookie httpOnly est posé après saisie du bon secret et comparé à
 * chaque requête vers les routes protégées.
 *
 * Ce module exporte des fonctions PURES (isValidSession) testables
 * sans runtime Next.js, ainsi que des helpers pour les Server Actions.
 */

/** Nom du cookie de session admin. */
export const SESSION_COOKIE_NAME = "admin_session";

/**
 * Vérifie si une valeur de cookie correspond au secret attendu.
 * Retourne false si l'un ou l'autre est vide/absent (configuration manquante).
 * Aucune dépendance Next.js : testable directement avec vitest.
 */
export function isValidSession(
  cookieValue: string | undefined,
  expectedSecret: string | undefined,
): boolean {
  if (!cookieValue || !expectedSecret) return false;
  return cookieValue === expectedSecret;
}

/**
 * Retourne le secret admin depuis l'environnement serveur.
 * Ne lève pas d'erreur si absent : isValidSession gérera le cas.
 */
export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET ?? "";
}
