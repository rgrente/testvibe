/**
 * Types de domaine partagés par les entités Person, Union et Filiation.
 * Volontairement indépendants du schéma Drizzle (packages/db) pour
 * garder packages/core exempt de toute dépendance directe à un ORM
 * particulier dans sa surface publique.
 */

export type FiliationRole = "biologique" | "adopte" | "beau-parent";

export type EventType = "naissance" | "décès" | "mariage" | "libre";

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
  startDate: string | null;
  endDate: string | null;
  /** Identifiants des personnes liées à cette union (ordre non garanti). */
  personIds: number[];
}

export interface UnionInput {
  startDate?: string | null;
  endDate?: string | null;
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
}

export interface EventInput {
  personId: number;
  unionId?: number | null;
  type: EventType;
  label?: string | null;
  eventDate?: string | null;
  description?: string | null;
}

export interface FamilyTimelineEntry {
  event: Event;
  person: Person;
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
