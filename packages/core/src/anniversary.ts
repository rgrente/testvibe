import type { FamilyAnniversary, FamilyFact, FamilyTimelineItem, Person, UpcomingFamilyAnniversary } from "./types.js";
import type { Database } from "@testvibe/db";
import { listFamilyTimeline } from "./event.js";
import { listPersons } from "./person.js";
import { listCanonicalFamilyFacts } from "./projection.js";

const COMPLETE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseCompleteDate(value: string): { year: number; month: number; day: number } | null {
  const match = COMPLETE_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;
  return { year, month, day };
}

export function isCompleteCalendarDate(value: string): boolean {
  return parseCompleteDate(value) !== null;
}

export function localCalendarDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Le 29 février est célébré le 28 février lors des années non bissextiles.
 * Les dates partielles (AAAA ou AAAA-MM) et non ISO sont volontairement exclues.
 */
export function anniversariesForDate(
  entries: FamilyTimelineItem[],
  targetDate: string,
): FamilyAnniversary[] {
  const target = parseCompleteDate(targetDate);
  if (!target) return [];
  const targetIsLeapYear = new Date(Date.UTC(target.year, 1, 29)).getUTCDate() === 29;

  const represented = new Set<string>();
  return entries
    .flatMap((entry): FamilyAnniversary[] => {
      if (entry.event.type !== "naissance" && entry.event.type !== "mariage") return [];
      if (represented.has(entry.key)) return [];
      const source = entry.event.eventDate ? parseCompleteDate(entry.event.eventDate) : null;
      if (!source || source.year > target.year) return [];
      const regularMatch = source.month === target.month && source.day === target.day;
      const leapDayMatch =
        !targetIsLeapYear && source.month === 2 && source.day === 29 && target.month === 2 && target.day === 28;
      if (!regularMatch && !leapDayMatch) return [];
      represented.add(entry.key);
      const eventId = entry.key.startsWith("event:") ? Number(entry.key.slice(6)) : null;
      return [{
        key: entry.key,
        eventId: Number.isSafeInteger(eventId) ? eventId : null,
        event: entry.event,
        person: entry.person,
        yearsElapsed: target.year - source.year,
      }];
    })
    .sort((left, right) => {
      const yearOrder = left.event.eventDate!.slice(0, 4).localeCompare(right.event.eventDate!.slice(0, 4));
      if (yearOrder !== 0) return yearOrder;
      const leftName = `${left.person.lastName} ${left.person.firstName}`;
      const rightName = `${right.person.lastName} ${right.person.firstName}`;
      return leftName.localeCompare(rightName, "fr");
    });
}

export async function listFamilyAnniversaries(
  db: Database,
  targetDate: string,
): Promise<FamilyAnniversary[]> {
  return anniversariesForDate(await listFamilyTimeline(db), targetDate);
}

/** Retourne les anniversaires de naissance et de mariage des prochains jours, hors aujourd'hui. */
export function upcomingFamilyAnniversaries(
  facts: FamilyFact[],
  persons: Person[],
  fromDate: string,
  days: number,
): UpcomingFamilyAnniversary[] {
  const from = parseCompleteDate(fromDate);
  if (!from || !Number.isInteger(days) || days < 1) return [];
  const peopleById = new Map(persons.map((person) => [person.id, person]));
  const sources = facts
    .filter((fact): fact is FamilyFact & { category: "naissance" | "mariage" } =>
      fact.category === "naissance" || fact.category === "mariage")
    .map((fact) => ({
      key: fact.identity,
      type: fact.category,
      date: fact.date,
      persons: fact.personIds.flatMap((id) => peopleById.get(id) ?? []),
    }));
  const start = new Date(Date.UTC(from.year, from.month - 1, from.day));
  const results: UpcomingFamilyAnniversary[] = [];

  for (let daysUntil = 1; daysUntil <= days; daysUntil += 1) {
    const occurrence = new Date(start);
    occurrence.setUTCDate(occurrence.getUTCDate() + daysUntil);
    const occurrenceDate = occurrence.toISOString().slice(0, 10);
    const matchingKeys = new Set(anniversariesForDate(
      sources.map((source) => ({
        key: source.key,
        person: source.persons[0] ?? { id: 0, firstName: "", lastName: "", birthName: null, birthDate: null, deathDate: null, gender: null },
        event: { type: source.type, eventDate: source.date, label: null, description: null },
      })),
      occurrenceDate,
    ).map((item) => item.key));

    for (const source of sources) {
      const parsed = source.date ? parseCompleteDate(source.date) : null;
      if (!parsed || !matchingKeys.has(source.key)) continue;
      results.push({
        key: source.key,
        type: source.type,
        occurrenceDate,
        daysUntil,
        yearsElapsed: occurrence.getUTCFullYear() - parsed.year,
        persons: source.persons,
      });
    }
  }

  return results.sort((left, right) => left.daysUntil - right.daysUntil || left.key.localeCompare(right.key));
}

export async function listUpcomingFamilyAnniversaries(
  db: Database,
  fromDate: string,
  days: number,
): Promise<UpcomingFamilyAnniversary[]> {
  const [facts, persons] = await Promise.all([listCanonicalFamilyFacts(db), listPersons(db)]);
  return upcomingFamilyAnniversaries(facts, persons, fromDate, days);
}
