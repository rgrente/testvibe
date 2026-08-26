import type { Database } from "@testvibe/db";
import { listAllEvents } from "./event.js";
import { listPersons } from "./person.js";
import { listUnions } from "./union.js";
import type {
  Event,
  FamilyFact,
  FamilyFactCategory,
  Person,
  Union,
} from "./types.js";

const FAMILY_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export interface FamilyDateInterval {
  start: number;
  end: number;
  precision: 1 | 2 | 3;
}

export function familyDateInterval(value: string | null): FamilyDateInterval | null {
  const match = value?.match(FAMILY_DATE);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2] ?? "1");
  const day = Number(match[3] ?? "1");
  if (month < 1 || month > 12) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > lastDay) return null;
  const precision = (match[3] ? 3 : match[2] ? 2 : 1) as 1 | 2 | 3;
  const start = Date.UTC(year, month - 1, day);
  const end = precision === 1
    ? Date.UTC(year, 11, 31, 23, 59, 59, 999)
    : precision === 2
      ? Date.UTC(year, month, 1) - 1
      : start;
  return { start, end, precision };
}

export function formatFamilyDate(value: string | null, locale = "fr-FR"): string {
  const interval = familyDateInterval(value);
  if (!interval || !value) return "Date inconnue";
  if (interval.precision === 1) return value;
  const date = new Date(interval.start);
  return new Intl.DateTimeFormat(locale, interval.precision === 2
    ? { month: "long", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function normalize(value: string | null): string {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");
}

function isLegacyResidence(item: Event): boolean {
  return item.type === "libre" && normalize(item.label) === "residence";
}

function eventCategory(item: Event): FamilyFactCategory {
  return item.type === "résidence" || isLegacyResidence(item) ? "résidence" : item.type;
}

function logicalKey(fact: FamilyFact): string {
  return [
    fact.category,
    fact.owner,
    normalize(fact.date),
    normalize(fact.place),
    normalize(fact.category === "résidence" ? null : fact.label),
  ].join("\u0000");
}

function compareFacts(left: FamilyFact, right: FamilyFact): number {
  const leftInterval = familyDateInterval(left.date);
  const rightInterval = familyDateInterval(right.date);
  if (leftInterval && !rightInterval) return -1;
  if (!leftInterval && rightInterval) return 1;
  if (leftInterval && rightInterval) {
    if (leftInterval.start !== rightInterval.start) return leftInterval.start - rightInterval.start;
    if (leftInterval.precision !== rightInterval.precision) return rightInterval.precision - leftInterval.precision;
  }
  return left.category.localeCompare(right.category, "fr") || left.identity.localeCompare(right.identity, "fr");
}

function singletonFact(person: Person, type: "naissance" | "décès", events: Event[]): FamilyFact | null {
  const matches = events
    .filter((item) => item.personId === person.id && item.type === type)
    .sort((left, right) => left.id - right.id);
  const date = type === "naissance" ? person.birthDate : person.deathDate;
  const enrichment = matches[0];
  if (!date && !enrichment) return null;
  return {
    identity: `person:${person.id}:${type}`,
    category: type,
    owner: `person:${person.id}`,
    personIds: [person.id],
    date: date ?? enrichment.eventDate,
    label: enrichment?.label ?? null,
    description: enrichment?.description ?? null,
    place: enrichment?.place ?? null,
    latitude: enrichment?.latitude ?? null,
    longitude: enrichment?.longitude ?? null,
    source: "person",
    sourceEventId: enrichment?.id ?? null,
    conflicts: matches,
  };
}

function unionFact(item: Union): FamilyFact {
  return {
    identity: `union:${item.id}`,
    category: item.type === "libre" ? "union libre" : item.type,
    owner: `union:${item.id}`,
    personIds: [...item.personIds].sort((left, right) => left - right),
    date: item.startDate,
    label: null,
    description: null,
    place: item.place,
    latitude: item.latitude,
    longitude: item.longitude,
    source: "union",
    sourceEventId: null,
    conflicts: [],
  };
}

function eventFact(item: Event): FamilyFact {
  const category = eventCategory(item);
  return {
    identity: `event:${item.id}`,
    category,
    owner: `person:${item.personId}`,
    personIds: [item.personId],
    date: item.eventDate,
    label: category === "résidence" ? null : item.label,
    description: item.description,
    place: item.place,
    latitude: item.latitude,
    longitude: item.longitude,
    source: "event",
    sourceEventId: item.id,
    conflicts: [],
  };
}

/** Construit la source de vérité de lecture sans réécrire les données historiques. */
export function projectFamilyFacts(persons: Person[], unions: Union[], events: Event[]): FamilyFact[] {
  const facts: FamilyFact[] = [];
  for (const person of persons) {
    const birth = singletonFact(person, "naissance", events);
    const death = singletonFact(person, "décès", events);
    if (birth) facts.push(birth);
    if (death) facts.push(death);
  }
  facts.push(...unions.map(unionFact));

  const candidates = events
    .filter((item) => item.type === "libre" || item.type === "résidence")
    .sort((left, right) => {
      const explicitOrder = Number(eventCategory(right) === right.type) - Number(eventCategory(left) === left.type);
      return explicitOrder || left.id - right.id;
    })
    .map(eventFact);
  const represented = new Set<string>();
  for (const candidate of candidates) {
    const key = logicalKey(candidate);
    if (represented.has(key)) continue;
    represented.add(key);
    facts.push(candidate);
  }
  return facts.sort(compareFacts);
}

export function countCanonicalFacts(facts: FamilyFact[]): number {
  return new Set(facts.map((fact) => fact.identity)).size;
}

export async function listCanonicalFamilyFacts(db: Database): Promise<FamilyFact[]> {
  const [persons, unions, events] = await Promise.all([
    listPersons(db),
    listUnions(db),
    listAllEvents(db),
  ]);
  return projectFamilyFacts(persons, unions, events);
}