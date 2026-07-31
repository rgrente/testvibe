import type { Database } from "@testvibe/db";
import type { ComparativeTimelineRow } from "./types.js";
import { listAllEvents } from "./event.js";
import { listPersons } from "./person.js";

/** Charge chaque personne, y compris sans date, avec ses événements. */
export async function listComparativeTimeline(db: Database): Promise<ComparativeTimelineRow[]> {
  const [persons, events] = await Promise.all([listPersons(db), listAllEvents(db)]);
  const eventsByPerson = new Map<number, typeof events>();

  for (const event of events) {
    const personEvents = eventsByPerson.get(event.personId) ?? [];
    personEvents.push(event);
    eventsByPerson.set(event.personId, personEvents);
  }

  return persons.map((person) => ({
    person,
    events: eventsByPerson.get(person.id) ?? [],
  }));
}
