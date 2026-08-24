/**
 * Types de domaine partagés par les entités Person, Union et Filiation.
 * Volontairement indépendants du schéma Drizzle (packages/db) pour
 * garder packages/core exempt de toute dépendance directe à un ORM
 * particulier dans sa surface publique.
 */

export type FiliationRole = "biologique" | "adopte" | "beau-parent";

export type EventType = "naissance" | "décès" | "mariage" | "libre";
export type UnionType = "mariage" | "pacs" | "libre";

export interface Person {
  id: number;
  firstName: string;
  lastName: string;
  birthName: string | null;
  birthDate: string | null;
  deathDate: string | null;
  gender: string | null;
}

export interface PersonInput {
  firstName: string;
  lastName: string;
  birthName?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  gender?: string | null;
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
}

export interface FamilyTimelineEvent {
  type: EventType;
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

/** Ligne de la timeline comparative : une personne et ses événements métier. */
export interface ComparativeTimelineRow {
  person: Person;
  events: Event[];
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
}

export interface MediaInput {
  personId?: number | null;
  eventId?: number | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
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
  type: EventType | UnionType;
  label: string | null;
  eventDate: string | null;
  place: string;
  latitude: number;
  longitude: number;
}
