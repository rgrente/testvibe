import type { LivingStatus, Person, Visibility } from "./types.js";

const RANK: Record<Visibility, number> = { public: 0, family: 1, private: 2 };

export interface LivingPolicyOptions {
  now?: Date;
  thresholdYears?: number;
}

export function privacyThresholdYears(value = process.env.LIVING_PERSON_AGE_THRESHOLD): number {
  if (!/^\d+$/.test(value ?? "")) return 120;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 120;
}

export function inferLivingStatus(person: Person, options: LivingPolicyOptions = {}): LivingStatus {
  if (person.livingStatus === "deceased" || person.deathDate) return "deceased";
  if (person.livingStatus === "living") return "living";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(person.birthDate ?? "")) return "living";
  const birth = new Date(`${person.birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return "living";
  const now = options.now ?? new Date();
  if (birth.getTime() > now.getTime()) return "living";
  const threshold = options.thresholdYears ?? privacyThresholdYears();
  const boundary = new Date(now.getTime());
  boundary.setUTCFullYear(boundary.getUTCFullYear() - threshold);
  return birth.getTime() <= boundary.getTime() ? "deceased" : "living";
}

export function strictestVisibility(values: readonly Visibility[]): Visibility {
  if (values.length === 0) return "private";
  return values.reduce((strictest, value) => RANK[value] > RANK[strictest] ? value : strictest);
}

export function effectiveVisibility(
  subject: Person | readonly Visibility[],
  options: LivingPolicyOptions = {},
): Visibility {
  if (Array.isArray(subject)) return strictestVisibility(subject);
  const person = subject as Person;
  if (person.visibility === "public" || person.visibility === "family" || person.visibility === "private") {
    return person.visibility;
  }
  return inferLivingStatus(person, options) === "deceased" ? "public" : "family";
}

export function isVisibleToAudience(required: Visibility, audience: Visibility): boolean {
  return RANK[audience] >= RANK[required];
}