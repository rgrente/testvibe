/**
 * Types de domaine partagés par les entités Person, Union et Filiation.
 * Volontairement indépendants du schéma Drizzle (packages/db) pour
 * garder packages/core exempt de toute dépendance directe à un ORM
 * particulier dans sa surface publique.
 */

export type FiliationRole = "biologique" | "adopte" | "beau-parent";

export interface Person {
  id: number;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  deathDate: string | null;
  gender: string | null;
}

export interface PersonInput {
  firstName: string;
  lastName: string;
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
