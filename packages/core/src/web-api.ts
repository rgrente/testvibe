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
import type { Person, Event, FamilyTimelineItem, Media } from "./types.js";
import { listPersons, getPersonById } from "./person.js";
import { getFamilyTree, type FamilyTree } from "./tree.js";
import { listEventsByPerson, listFamilyTimeline } from "./event.js";
import { listMediaByPerson } from "./media.js";
import { searchPersons } from "./search.js";

/** Liste toutes les Person (pour un sélecteur de racine d'arbre côté web). */
export async function listAllPersonsForWeb(): Promise<Person[]> {
  return listPersons(defaultDb);
}

/** Construit l'arbre généalogique complet visible depuis une Person racine. */
export async function getFamilyTreeForWeb(rootId: number): Promise<FamilyTree> {
  return getFamilyTree(defaultDb, rootId);
}

/**
 * Recherche des personnes par nom (partielle, insensible à la casse).
 * Phase 5 (tâche #24).
 */
export async function searchPersonsForWeb(query: string): Promise<Person[]> {
  return searchPersons(defaultDb, query);
}

/**
 * Retourne la timeline chronologique d'une personne (ses événements triés).
 * Phase 5 (tâche #24).
 */
export async function getPersonTimelineForWeb(personId: number): Promise<Event[]> {
  return listEventsByPerson(defaultDb, personId);
}

/** Retourne tous les événements familiaux avec leur personne, triés chronologiquement. */
export async function getFamilyTimelineForWeb(): Promise<FamilyTimelineItem[]> {
  return listFamilyTimeline(defaultDb);
}

/**
 * Retourne les médias associés à une personne.
 * Phase 5 (tâche #24).
 */
export async function getPersonMediaForWeb(personId: number): Promise<Media[]> {
  return listMediaByPerson(defaultDb, personId);
}

/**
 * Retourne une personne par son id (pour la page de détail).
 * Phase 5 (tâche #24).
 */
export async function getPersonForWeb(personId: number): Promise<Person> {
  return getPersonById(defaultDb, personId);
}
