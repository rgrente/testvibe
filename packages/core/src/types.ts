/**
 * Types de domaine partagés par les entités Person, Union et Filiation.
 * Volontairement indépendants du schéma Drizzle (packages/db) pour
 * garder packages/core exempt de toute dépendance directe à un ORM
 * particulier dans sa surface publique.
 */

export type FiliationRole = "biologique" | "adopte" | "beau-parent";

export type EventType = "naissance" | "décès" | "mariage" | "résidence" | "libre";
export type UnionType = "mariage" | "pacs" | "libre";
export type Visibility = "public" | "family" | "private";
export type LivingStatus = "living" | "deceased";

export type FamilyFactCategory = EventType | "pacs" | "union libre";
export type FamilyFactOwner = `person:${number}` | `union:${number}`;

/** Fait familial canonique partagé par toutes les projections de lecture. */
export interface FamilyFact {
  /** Alias numérique compatible UI : ids d'union négatifs, ids d'événement positifs. */
  id: number;
  identity: `person:${number}:naissance` | `person:${number}:décès` | `union:${number}` | `event:${number}`;
  category: FamilyFactCategory;
  type: FamilyFactCategory;
  owner: FamilyFactOwner;
  personIds: number[];
  date: string | null;
  eventDate: string | null;
  label: string | null;
  description: string | null;
  place: string | null;
  latitude: number | null;
  longitude: number | null;
  source: "person" | "union" | "event";
  sourceEventId: number | null;
  /** Lignes source divergentes d'un singleton, conservées pour diagnostic. */
  conflicts: Event[];
}

export interface Person {
  id: number;
  firstName: string;
  lastName: string;
  birthName: string | null;
  birthDate: string | null;
  deathDate: string | null;
  gender: string | null;
  livingStatus?: LivingStatus | null;
  visibility?: Visibility | null;
}

export interface PersonInput {
  firstName: string;
  lastName: string;
  birthName?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  gender?: string | null;
  livingStatus?: LivingStatus | null;
  visibility?: Visibility | null;
}

export interface Union {
  id: number;
  type: UnionType;
  startDate: string | null;
  endDate: string | null;
  place: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Identifiants des personnes liées à cette union (ordre non garanti). */
  personIds: number[];
}

export interface UnionInput {
  type?: UnionType;
  startDate?: string | null;
  endDate?: string | null;
  place?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  personIds: number[];
}

export interface Filiation {
  id: number;
  parentId: number;
  childId: number;
  role: FiliationRole;
}

export interface FiliationInput {
  parentId: number;
  childId: number;
  role: FiliationRole;
}

export interface FiliationBatchInput {
  parentIds: number[];
  childIds: number[];
  role: FiliationRole;
}

export interface Event {
  id: number;
  personId: number;
  unionId: number | null;
  type: EventType;
  label: string | null;
  eventDate: string | null;
  description: string | null;
  place: string | null;
  latitude: number | null;
  longitude: number | null;
  visibility?: Visibility | null;
}

export interface EventInput {
  personId: number;
  unionId?: number | null;
  type: EventType;
  label?: string | null;
  eventDate?: string | null;
  description?: string | null;
  place?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  visibility?: Visibility | null;
}

export interface FamilyTimelineEvent {
  type: FamilyFactCategory;
  label: string | null;
  eventDate: string | null;
  description: string | null;
}

export interface FamilyTimelineEntry {
  event: Event;
  person: Person;
}

/** Élément de rendu pouvant provenir d'un Event ou d'une date portée par Person. */
export interface FamilyTimelineItem {
  /** Clé stable de rendu, sans fabriquer d'identifiant d'événement métier. */
  key: string;
  event: FamilyTimelineEvent;
  person: Person;
}

/** Anniversaire d'un événement familial pour une date de calendrier donnée. */
export interface FamilyAnniversary {
  key: string;
  eventId: number | null;
  event: FamilyTimelineEvent;
  person: Person;
  /** Nombre d'années révolues, seulement lorsque l'année est exploitable. */
  yearsElapsed: number | null;
}

/** Anniversaire de naissance ou de mariage à venir. */
export interface UpcomingFamilyAnniversary {
  key: string;
  type: "naissance" | "mariage";
  occurrenceDate: string;
  daysUntil: number;
  yearsElapsed: number;
  persons: Person[];
}

/** Ligne de la timeline comparative : une personne et ses événements métier. */
export interface ComparativeTimelineEvent {
  id: number;
  identity?: FamilyFact["identity"];
  type: FamilyFactCategory;
  label: string | null;
  eventDate: string | null;
}

export interface ComparativeTimelineRow {
  person: Person;
  events: ComparativeTimelineEvent[];
}

export interface Media {
  id: number;
  personId: number | null;
  eventId: number | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  visibility?: Visibility | null;
}

export interface MediaInput {
  personId?: number | null;
  eventId?: number | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility?: Visibility | null;
}

/** Événement géolocalisé pour la carte publique (filtré par confidentialité). */
export interface MapLocation {
  eventId: number;
  /** Origine métier du point, nécessaire car certains types sont partagés. */
  source: "event" | "union";
  personId: number;
  /** Toutes les personnes concernées (notamment pour un lieu porté par une union). */
  personIds?: number[];
  personName: string;
  type: FamilyFactCategory;
  label: string | null;
  eventDate: string | null;
  place: string;
  latitude: number;
  longitude: number;
}
