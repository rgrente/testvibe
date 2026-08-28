import type { MapLocation } from "@testvibe/core";
import CarteClient from "../../carte/CarteClient";

const locations: MapLocation[] = [
  { eventId: 1, source: "event", personId: 1, personName: "Martine Renault", type: "naissance", label: null, eventDate: "1958-09-03", place: "Rennes (35)", latitude: 48.1173, longitude: -1.6778 },
  { eventId: 2, source: "event", personId: 2, personName: "Romain Grente", type: "résidence", label: null, eventDate: "2008-06", place: "Vitré (35)", latitude: 48.1242, longitude: -1.2128 },
  { eventId: 3, source: "event", personId: 3, personName: "Léni-Éléonore Grente de la Vallée", type: "naissance", label: null, eventDate: "2016-09-14", place: "Nantes (44)", latitude: 47.2184, longitude: -1.5536 },
];

export function SecondaryMapFixture() {
  return (
    <CarteClient
      locations={locations}
      allPersons={[
        { id: 1, name: "Martine Renault" },
        { id: 2, name: "Romain Grente" },
        { id: 3, name: "Léni-Éléonore Grente de la Vallée" },
      ]}
      initialPersonId={null}
      initialBranch="none"
      initialDateFrom=""
      initialDateTo=""
      branchPersonIds={[]}
    />
  );
}
