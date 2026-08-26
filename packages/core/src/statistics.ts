import type { Database } from "@testvibe/db";
import type { Event, Filiation, Person, Union } from "./types.js";
import { listPersons } from "./person.js";
import { listUnions } from "./union.js";
import { listFiliations } from "./filiation.js";
import { listAllEvents } from "./event.js";
import { projectFamilyFacts } from "./projection.js";

export interface RankedStatistic {
  label: string;
  count: number;
}

export interface AgePyramidBucket {
  decade: number;
  women: number;
  men: number;
  other: number;
}

export interface FamilyStatistics {
  totals: {
    persons: number;
    unions: number;
    events: number;
    generations: number;
  };
  agePyramid: AgePyramidBucket[];
  averageLongevity: number | null;
  topFirstNames: RankedStatistic[];
  topBirthPlaces: RankedStatistic[];
  topResidencePlaces: RankedStatistic[];
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const frenchCollator = new Intl.Collator("fr", { sensitivity: "base" });

function parseIsoDate(value: string | null): DateParts | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

function parisDateParts(now: Date): DateParts {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function compareDateParts(left: DateParts, right: DateParts): number {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

function completedYears(birth: DateParts, today: DateParts): number {
  const beforeBirthday = today.month < birth.month ||
    (today.month === birth.month && today.day < birth.day);
  return today.year - birth.year - (beforeBirthday ? 1 : 0);
}

function normalizeKey(value: string): string {
  return value.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("fr");
}

function rank(values: Array<string | null | undefined>): RankedStatistic[] {
  const grouped = new Map<string, RankedStatistic>();
  for (const rawValue of values) {
    const label = rawValue?.trim();
    if (!label) continue;
    const key = normalizeKey(label);
    const current = grouped.get(key);
    if (current) current.count += 1;
    else grouped.set(key, { label, count: 1 });
  }
  return [...grouped.values()]
    .sort((left, right) => right.count - left.count || frenchCollator.compare(left.label, right.label))
    .slice(0, 5);
}

function generationCount(persons: Person[], filiations: Filiation[]): number {
  if (persons.length === 0) return 0;
  const personIds = new Set(persons.map((person) => person.id));
  const childrenByParent = new Map<number, number[]>();
  for (const relation of filiations) {
    if (!personIds.has(relation.parentId) || !personIds.has(relation.childId)) continue;
    const children = childrenByParent.get(relation.parentId) ?? [];
    children.push(relation.childId);
    childrenByParent.set(relation.parentId, children);
  }

  const longestFrom = (personId: number, path: Set<number>): number => {
    let longest = 1;
    path.add(personId);
    for (const childId of childrenByParent.get(personId) ?? []) {
      if (!path.has(childId)) longest = Math.max(longest, 1 + longestFrom(childId, path));
    }
    path.delete(personId);
    return longest;
  };

  return Math.max(...persons.map((person) => longestFrom(person.id, new Set<number>())));
}

export function calculateFamilyStatistics(
  persons: Person[],
  unions: Union[],
  filiations: Filiation[],
  events: Event[],
  now = new Date(),
): FamilyStatistics {
  const facts = projectFamilyFacts(persons, unions, events);
  const today = parisDateParts(now);
  const ageBuckets = new Map<number, AgePyramidBucket>();
  const lifeSpans: number[] = [];

  for (const person of persons) {
    const birth = parseIsoDate(person.birthDate);
    const death = parseIsoDate(person.deathDate);
    if (birth && !person.deathDate && compareDateParts(birth, today) <= 0) {
      const age = completedYears(birth, today);
      const decade = Math.floor(age / 10) * 10;
      const bucket = ageBuckets.get(decade) ?? { decade, women: 0, men: 0, other: 0 };
      if (person.gender?.toUpperCase() === "F") bucket.women += 1;
      else if (person.gender?.toUpperCase() === "M") bucket.men += 1;
      else bucket.other += 1;
      ageBuckets.set(decade, bucket);
    }
    if (birth && death && compareDateParts(birth, death) <= 0) {
      const birthTime = Date.UTC(birth.year, birth.month - 1, birth.day);
      const deathTime = Date.UTC(death.year, death.month - 1, death.day);
      lifeSpans.push((deathTime - birthTime) / 86_400_000 / 365.2425);
    }
  }

  const averageLongevity = lifeSpans.length === 0
    ? null
    : Math.round((lifeSpans.reduce((sum, years) => sum + years, 0) / lifeSpans.length) * 10) / 10;

  return {
    totals: {
      persons: persons.length,
      unions: unions.length,
      events: facts.length,
      generations: generationCount(persons, filiations),
    },
    agePyramid: [...ageBuckets.values()].sort((left, right) => left.decade - right.decade),
    averageLongevity,
    topFirstNames: rank(persons.map((person) => person.firstName)),
    topBirthPlaces: rank(facts.filter((item) => item.category === "naissance").map((item) => item.place)),
    topResidencePlaces: rank(facts.filter((item) => item.category === "résidence").map((item) => item.place)),
  };
}

export async function getFamilyStatistics(db: Database, now = new Date()): Promise<FamilyStatistics> {
  const [persons, unions, filiations, events] = await Promise.all([
    listPersons(db),
    listUnions(db),
    listFiliations(db),
    listAllEvents(db),
  ]);
  return calculateFamilyStatistics(persons, unions, filiations, events, now);
}
