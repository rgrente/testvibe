/**
 * Frontière d'accès aux données pour apps/web (Phase 2, tâche #21).
 *
 * apps/web ne doit jamais importer @testvibe/db directement (lecture
 * seule via packages/core uniquement, cf. contrat de la tâche #21).
 * Ce module est le seul endroit de packages/core qui connaît la
 * connexion par défaut (`DATABASE_URL` ou `file:./local.db`, cf.
 * `@testvibe/db#createDb`) : il l'utilise en interne pour exposer des
 * fonctions de lecture prêtes à l'emploi côté web, sans jamais exposer
 * le type `Database` ni l'instance de connexion elle-même.
 *
 * Volontairement non testé unitairement : ce fichier ne fait que
 * relier les fonctions déjà couvertes (person.ts, tree.ts) à la
 * connexion par défaut, à l'image de packages/db/src/migrate.ts.
 */
import { db as defaultDb } from "@testvibe/db";
import type { Person } from "./types.js";
import { listPersons } from "./person.js";
import { getFamilyTree, type FamilyTree } from "./tree.js";

/** Liste toutes les Person (pour un sélecteur de racine d'arbre côté web). */
export async function listAllPersonsForWeb(): Promise<Person[]> {
  return listPersons(defaultDb);
}

/** Construit l'arbre généalogique complet visible depuis une Person racine. */
export async function getFamilyTreeForWeb(rootId: number): Promise<FamilyTree> {
  return getFamilyTree(defaultDb, rootId);
}
