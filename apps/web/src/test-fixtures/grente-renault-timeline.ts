import type { ComparativeTimelineRow, Person } from "@testvibe/core";

const people: Person[] = [
  [1, "Didier", "Renault", "1962", "2019"],
  [2, "Martine", "Renault", "1965-04", null],
  [3, "Pascal", "Grente", "1965", null],
  [4, "Laurence", "Grente", "1966-07-12", null],
  [5, "Mathilde", "Renault", "1992", null],
  [6, "Romain", "Grente", "1990-02-17", null],
  [7, "Léni", "Grente", "2016-09-14", null],
  [8, "Mahé", "Grente", "2018", null],
  [9, "Lou", "Grente", "2020-03", null],
  [10, "Eli", "Grente", "2023-01-08", null],
  [11, "Camille", "Renault", "1988", null],
  [12, "Date", "Inconnue", null, null],
].map(([id, firstName, lastName, birthDate, deathDate]) => ({
  id: id as number,
  firstName: firstName as string,
  lastName: lastName as string,
  birthName: null,
  birthDate: birthDate as string | null,
  deathDate: deathDate as string | null,
  gender: null,
}));

export const grenteRenaultTimeline: ComparativeTimelineRow[] = people.map((person, personIndex) => ({
  person,
  events: Array.from({ length: personIndex < 3 ? 3 : personIndex === 3 ? 1 : 2 }, (_, eventIndex) => {
    const id = personIndex * 3 + eventIndex + 1;
    return {
      id,
      identity: `event:${id}` as `event:${number}`,
      type: "libre" as const,
      label: `Repère ${id}`,
      eventDate: personIndex === 11 || (personIndex === 10 && eventIndex === 1) ? null : `${1970 + personIndex * 4 + eventIndex}`,
    };
  }),
}));

grenteRenaultTimeline[0].events.push({ id: 100, identity: "union:7", type: "mariage", label: "Union", eventDate: "1990" });
grenteRenaultTimeline[1].events.push({ id: 101, identity: "union:7", type: "mariage", label: "Union", eventDate: "1990" });

export const timelineGenerations = new Map(people.map((person, index) => [person.id, index < 4 ? 1 : index < 7 ? 2 : 3]));
