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
import type { ComparativeTimelineRow, Person, FamilyFact, FamilyTimelineItem, FamilyAnniversary, UpcomingFamilyAnniversary, Media, MapLocation, Visibility } from "./types.js";
import { listPersons, getPersonById } from "./person.js";
import {
  buildFamilyTree,
  getAncestorIdsFromFiliations,
  getDescendantIdsFromFiliations,
  type FamilyTree,
} from "./tree.js";
import { listAllEvents } from "./event.js";
import { listAllMedia } from "./media.js";
import { searchPersons } from "./search.js";
import { projectComparativeTimeline } from "./comparative-timeline.js";

import { anniversariesForDate, upcomingFamilyAnniversaries } from "./anniversary.js";
import { calculateFamilyStatistics, type FamilyStatistics } from "./statistics.js";
import { mapLocationsFromFacts, projectFamilyFacts } from "./projection.js";
import { listUnions } from "./union.js";
import { listFiliations } from "./filiation.js";
import { filterPrivacyDataset } from "./privacy.js";
import { NotFoundError } from "./errors.js";

async function privacyView(audience: Visibility = "public") {
  const [persons, unions, filiations, events, media] = await Promise.all([
    listPersons(defaultDb), listUnions(defaultDb), listFiliations(defaultDb),
    listAllEvents(defaultDb), listAllMedia(defaultDb),
  ]);
  return filterPrivacyDataset({ persons, unions, filiations, events, media }, audience);
}

/** Liste toutes les Person (pour un sélecteur de racine d'arbre côté web). */
export async function listAllPersonsForWeb(): Promise<Person[]> {
  return (await privacyView()).persons;
}

/** Agrège les statistiques publiques de l'ensemble de l'arbre familial. */
export async function getFamilyStatisticsForWeb(): Promise<FamilyStatistics> {
  const view = await privacyView();
  return calculateFamilyStatistics(view.persons, view.unions, view.filiations, view.events);
}

/** Construit l'arbre généalogique complet visible depuis une Person racine. */
export async function getFamilyTreeForWeb(rootId: number): Promise<FamilyTree> {
  const view = await privacyView();
  const root = view.persons.find(({ id }) => id === rootId);
  if (!root) throw new NotFoundError("Person", rootId);
  return buildFamilyTree(root, view.persons, view.unions, view.filiations);
}

/**
 * Recherche des personnes par nom (partielle, insensible à la casse).
 * Phase 5 (tâche #24).
 */
export async function searchPersonsForWeb(query: string): Promise<Person[]> {
  const visibleIds = new Set((await privacyView()).persons.map(({ id }) => id));
  return (await searchPersons(defaultDb, query)).filter(({ id }) => visibleIds.has(id));
}

/**
 * Retourne la timeline chronologique d'une personne (ses événements triés).
 * Phase 5 (tâche #24).
 */
export async function getPersonTimelineForWeb(personId: number): Promise<FamilyFact[]> {
  const view = await privacyView();
  if (!view.persons.some(({ id }) => id === personId)) throw new NotFoundError("Person", personId);
  return projectFamilyFacts(view.persons, view.unions, view.events)
    .filter((fact) => fact.personIds.includes(personId));
}

/** Retourne tous les événements familiaux avec leur personne, triés chronologiquement. */
export async function getFamilyTimelineForWeb(): Promise<FamilyTimelineItem[]> {
  const view = await privacyView();
  const byId = new Map(view.persons.map((person) => [person.id, person]));
  return projectFamilyFacts(view.persons, view.unions, view.events).flatMap((fact) =>
    fact.personIds.flatMap((personId) => {
      const person = byId.get(personId);
      return person ? [{ key: fact.identity, event: {
        type: fact.category, label: fact.label, eventDate: fact.date, description: fact.description,
      }, person }] : [];
    }));
}

/** Anniversaires familiaux publics correspondant à une date de calendrier. */
export async function getFamilyAnniversariesForWeb(targetDate: string): Promise<FamilyAnniversary[]> {
  const view = await privacyView();
  const byId = new Map(view.persons.map((person) => [person.id, person]));
  const timeline = projectFamilyFacts(view.persons, view.unions, view.events).flatMap((fact) =>
    fact.personIds.flatMap((personId) => {
      const person = byId.get(personId);
      return person ? [{
        key: fact.identity,
        event: {
          type: fact.category,
          label: fact.label,
          eventDate: fact.date,
          dateQualification: fact.dateQualification,
          description: fact.description,
        },
        person,
      }] : [];
    }));
  return anniversariesForDate(timeline, targetDate);
}

/** Anniversaires de naissance et de mariage à venir. */
export async function getUpcomingFamilyAnniversariesForWeb(targetDate: string, days: number): Promise<UpcomingFamilyAnniversary[]> {
  const view = await privacyView();
  return upcomingFamilyAnniversaries(
    projectFamilyFacts(view.persons, view.unions, view.events),
    view.persons,
    targetDate,
    days,
  );
}

/** Retourne une ligne par personne pour la timeline horizontale comparative. */
export async function getComparativeTimelineForWeb(): Promise<ComparativeTimelineRow[]> {
  const view = await privacyView();
  return projectComparativeTimeline(
    view.persons,
    projectFamilyFacts(view.persons, view.unions, view.events),
  );
}

/**
 * Retourne les médias associés à une personne.
 * Phase 5 (tâche #24).
 */
export async function getPersonMediaForWeb(personId: number): Promise<Media[]> {
  const view = await privacyView();
  if (!view.persons.some(({ id }) => id === personId)) throw new NotFoundError("Person", personId);
  return view.media.filter(({ personId: ownerId }) => ownerId === personId);
}

/**
 * Retourne une personne par son id (pour la page de détail).
 * Phase 5 (tâche #24).
 */
export async function getPersonForWeb(personId: number): Promise<Person> {
  const found = (await privacyView()).persons.find(({ id }) => id === personId);
  if (!found) throw new NotFoundError("Person", personId);
  return found;
}

/**
 * Retourne les événements géolocalisés pour la carte publique.
 * Phase 6 (tâche lieux/carte).
 */
export async function getMapLocationsForWeb(): Promise<MapLocation[]> {
  const view = await privacyView();
  return mapLocationsFromFacts(projectFamilyFacts(view.persons, view.unions, view.events), view.persons);
}

/**
 * Retourne les identifiants des ascendants d'une personne.
 * Phase 6 (tâche lieux/carte).
 */
export async function getAncestorIdsForWeb(personId: number): Promise<number[]> {
  const view = await privacyView();
  if (!view.persons.some(({ id }) => id === personId)) throw new NotFoundError("Person", personId);
  return [...getAncestorIdsFromFiliations(view.filiations, personId)];
}

/**
 * Retourne les identifiants des descendants d'une personne.
 * Phase 6 (tâche lieux/carte).
 */
export async function getDescendantIdsForWeb(personId: number): Promise<number[]> {
  const view = await privacyView();
  if (!view.persons.some(({ id }) => id === personId)) throw new NotFoundError("Person", personId);
  return [...getDescendantIdsFromFiliations(view.filiations, personId)];
}

export async function getMediaForWebByFilename(filename: string): Promise<Media> {
  const found = (await privacyView()).media.find((item) => item.filename === filename);
  if (!found) throw new NotFoundError("Media", filename);
  return found;
}
