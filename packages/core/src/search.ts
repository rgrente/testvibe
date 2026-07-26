/**
 * Recherche simple par nom (prénom + nom, partielle, insensible à la casse).
 * Retourne les Person dont le prénom, le nom courant ou le nom de naissance contient la query.
 */
import type { Database } from "@testvibe/db";
import type { Person } from "./types.js";
import { listPersons } from "./person.js";

/**
 * Recherche des personnes dont le prénom OU le nom contient `query`
 * (partielle, insensible à la casse). Retourne toutes les personnes si
 * `query` est vide ou blanc.
 */
export async function searchPersons(db: Database, query: string): Promise<Person[]> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return listPersons(db);
  }
  const all = await listPersons(db);
  return all.filter(
    (p) =>
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.birthName?.toLowerCase().includes(q) ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
  );
}
