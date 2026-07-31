import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ComparativeTimelineRow, Event, Person } from "@testvibe/core";
import { describe, expect, it } from "vitest";
import { ComparativeTimeline } from "./ComparativeTimeline";

function person(overrides: Partial<Person> & Pick<Person, "id" | "firstName" | "lastName">): Person {
  return {
    birthName: null,
    birthDate: null,
    deathDate: null,
    gender: null,
    ...overrides,
  };
}

function event(overrides: Partial<Event> & Pick<Event, "id" | "personId" | "type">): Event {
  return {
    unionId: null,
    label: null,
    eventDate: null,
    description: null,
    ...overrides,
  };
}

describe("ComparativeTimeline", () => {
  it("affiche une ligne de vie et les événements identifiables sur l'échelle commune", () => {
    const ada = person({
      id: 1,
      firstName: "Ada",
      lastName: "Lovelace",
      birthDate: "1815-12-10",
      deathDate: "1852-11-27",
    });
    const rows: ComparativeTimelineRow[] = [
      {
        person: ada,
        events: [event({ id: 2, personId: ada.id, type: "libre", label: "Publication", eventDate: "1843" })],
      },
    ];

    render(<ComparativeTimeline rows={rows} />);

    expect(screen.getByText("1810")).toBeInTheDocument();
    expect(screen.getByText("1860")).toBeInTheDocument();
    const row = screen.getByRole("group", { name: "Timeline de Ada Lovelace" });
    expect(within(row).getByRole("link", { name: "Ada Lovelace" })).toHaveAttribute("href", "/persons/1");
    expect(within(row).getByLabelText("Vie de Ada Lovelace : 1815-12-10 – 1852-11-27")).toBeInTheDocument();
    expect(within(row).getByLabelText("Événement, Publication, 1843")).toBeInTheDocument();
    expect(within(row).getByText("Publication · Événement · 1843")).toBeInTheDocument();
  });

  it("explique les dates manquantes et garde les événements non positionnables", () => {
    const unknown = person({ id: 3, firstName: "Date", lastName: "Inconnue" });
    const rows: ComparativeTimelineRow[] = [
      {
        person: unknown,
        events: [event({ id: 4, personId: unknown.id, type: "libre", label: "Souvenir" })],
      },
    ];

    render(<ComparativeTimeline rows={rows} />);

    const row = screen.getByRole("group", { name: "Timeline de Date Inconnue" });
    expect(within(row).getByText("Naissance inconnue : durée de vie non positionnée.")).toBeInTheDocument();
    expect(within(row).getByText("Souvenir · Événement · date inconnue")).toBeInTheDocument();
  });

  it("préserve une largeur commune défilable sur petit écran", () => {
    const rows: ComparativeTimelineRow[] = [
      { person: person({ id: 5, firstName: "Longue", lastName: "Histoire", birthDate: "1750" }), events: [] },
      { person: person({ id: 6, firstName: "Récente", lastName: "Histoire", birthDate: "2020" }), events: [] },
    ];

    render(<ComparativeTimeline rows={rows} />);

    expect(screen.getByTestId("timeline-scroll")).toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("timeline-canvas")).toHaveStyle({ minWidth: "2160px" });
  });

  it("affiche un état vide", () => {
    render(<ComparativeTimeline rows={[]} />);

    expect(screen.getByText("Aucune personne n’est encore disponible.")).toBeInTheDocument();
  });
});
