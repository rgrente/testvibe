import type { Database } from "@testvibe/db";
import type { ComparativeTimelineRow, FamilyFact, Person } from "./types.js";
import { listCanonicalFamilyFacts } from "./projection.js";
import { listPersons } from "./person.js";

/** Charge chaque personne, y compris sans date, avec ses événements. */
export async function listComparativeTimeline(db: Database): Promise<ComparativeTimelineRow[]> {
  const [persons, events] = await Promise.all([listPersons(db), listCanonicalFamilyFacts(db)]);
  return projectComparativeTimeline(persons, events);
}

/** Construit les lignes depuis des personnes et faits déjà autorisés. */
export function projectComparativeTimeline(persons: Person[], events: FamilyFact[]): ComparativeTimelineRow[] {
  const eventsByPerson = new Map<number, typeof events>();

  for (const event of events) {
    for (const personId of event.personIds) {
      const personEvents = eventsByPerson.get(personId) ?? [];
      personEvents.push(event);
      eventsByPerson.set(personId, personEvents);
    }
  }

  return persons.map((person) => ({
    person,
    events: eventsByPerson.get(person.id) ?? [],
  }));
}
