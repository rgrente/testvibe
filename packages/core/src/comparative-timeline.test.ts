import type { Database } from "@testvibe/db";
import { beforeEach, describe, expect, it } from "vitest";
import { createEvent } from "./event.js";
import { createPerson } from "./person.js";
import { listComparativeTimeline } from "./comparative-timeline.js";
import { createTestDb } from "./test-utils.js";

describe("listComparativeTimeline", () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("retourne une ligne par personne avec ses événements datés et non datés", async () => {
    const ada = await createPerson(db, {
      firstName: "Ada",
      lastName: "Lovelace",
      birthDate: "1815-12-10",
      deathDate: "1852-11-27",
    });
    const charles = await createPerson(db, {
      firstName: "Charles",
      lastName: "Babbage",
    });
    const diploma = await createEvent(db, {
      personId: ada.id,
      type: "libre",
      label: "Publication",
      eventDate: "1843",
    });
    const undated = await createEvent(db, {
      personId: charles.id,
      type: "libre",
      label: "Projet de machine",
    });

    const rows = await listComparativeTimeline(db);

    expect(rows).toHaveLength(2);
    const adaRow = rows.find(({ person }) => person.id === ada.id)!;
    // Les événements naissance/décès sont auto-générés à partir des dates de la
    // Person (auto-sync), avant l'événement libre saisi manuellement.
    expect(adaRow.events).toHaveLength(3);
    expect(adaRow.events.map((e) => e.type)).toEqual(["naissance", "décès", "libre"]);
    expect(adaRow.events.map((e) => e.eventDate)).toEqual(["1815-12-10", "1852-11-27", "1843"]);
    expect(adaRow.events[2]).toEqual(diploma);
    expect(rows.find(({ person }) => person.id === charles.id)).toEqual({
      person: charles,
      events: [undated],
    });
  });

  it("conserve une personne sans aucune date ni aucun événement", async () => {
    const person = await createPerson(db, {
      firstName: "Mystère",
      lastName: "Inconnu",
    });

    await expect(listComparativeTimeline(db)).resolves.toEqual([
      { person, events: [] },
    ]);
  });
});
