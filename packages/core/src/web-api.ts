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
import type { ComparativeTimelineRow, Person, FamilyFact, FamilyTimelineItem, FamilyAnniversary, UpcomingFamilyAnniversary, Media, MapLocation } from "./types.js";
import { listPersons, getPersonById } from "./person.js";
import { getFamilyTree, getAncestorIds, getDescendantIds, type FamilyTree } from "./tree.js";
import { listFamilyTimeline } from "./event.js";
import { listMediaByPerson } from "./media.js";
import { searchPersons } from "./search.js";
import { listComparativeTimeline } from "./comparative-timeline.js";

import { listFamilyAnniversaries, listUpcomingFamilyAnniversaries } from "./anniversary.js";
import { getFamilyStatistics, type FamilyStatistics } from "./statistics.js";
import { listCanonicalFactsByPerson, listCanonicalFamilyFacts, mapLocationsFromFacts } from "./projection.js";

/** Liste toutes les Person (pour un sélecteur de racine d'arbre côté web). */
export async function listAllPersonsForWeb(): Promise<Person[]> {
  return listPersons(defaultDb);
}

/** Agrège les statistiques publiques de l'ensemble de l'arbre familial. */
export async function getFamilyStatisticsForWeb(): Promise<FamilyStatistics> {
  return getFamilyStatistics(defaultDb);
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
export async function getPersonTimelineForWeb(personId: number): Promise<FamilyFact[]> {
  return listCanonicalFactsByPerson(defaultDb, personId);
}

/** Retourne tous les événements familiaux avec leur personne, triés chronologiquement. */
export async function getFamilyTimelineForWeb(): Promise<FamilyTimelineItem[]> {
  return listFamilyTimeline(defaultDb);
}

/** Anniversaires familiaux publics correspondant à une date de calendrier. */
export async function getFamilyAnniversariesForWeb(targetDate: string): Promise<FamilyAnniversary[]> {
  return listFamilyAnniversaries(defaultDb, targetDate);
}

/** Anniversaires de naissance et de mariage à venir. */
export async function getUpcomingFamilyAnniversariesForWeb(targetDate: string, days: number): Promise<UpcomingFamilyAnniversary[]> {
  return listUpcomingFamilyAnniversaries(defaultDb, targetDate, days);
}

/** Retourne une ligne par personne pour la timeline horizontale comparative. */
export async function getComparativeTimelineForWeb(): Promise<ComparativeTimelineRow[]> {
  return listComparativeTimeline(defaultDb);
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

/**
 * Retourne les événements géolocalisés pour la carte publique.
 * Phase 6 (tâche lieux/carte).
 */
export async function getMapLocationsForWeb(): Promise<MapLocation[]> {
  const [facts, persons] = await Promise.all([listCanonicalFamilyFacts(defaultDb), listPersons(defaultDb)]);
  return mapLocationsFromFacts(facts, persons);
}

/**
 * Retourne les identifiants des ascendants d'une personne.
 * Phase 6 (tâche lieux/carte).
 */
export async function getAncestorIdsForWeb(personId: number): Promise<number[]> {
  const ids = await getAncestorIds(defaultDb, personId);
  return [...ids];
}

/**
 * Retourne les identifiants des descendants d'une personne.
 * Phase 6 (tâche lieux/carte).
 */
export async function getDescendantIdsForWeb(personId: number): Promise<number[]> {
  const ids = await getDescendantIds(defaultDb, personId);
  return [...ids];
}
