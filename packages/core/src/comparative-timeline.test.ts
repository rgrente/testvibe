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
    expect(rows.find(({ person }) => person.id === ada.id)).toEqual({
      person: ada,
      events: [diploma],
    });
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
