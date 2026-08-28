import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ComparativeTimelineRow, Event, Person } from "@testvibe/core";
import { describe, expect, it } from "vitest";
import { ComparativeTimeline, personColor } from "./ComparativeTimeline";

function hslToRgb(color: string): [number, number, number] {
  const match = color.match(/^hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)$/);
  if (!match) throw new Error(`Couleur HSL invalide : ${color}`);
  const hue = Number(match[1]) / 360;
  const saturation = Number(match[2]) / 100;
  const lightness = Number(match[3]) / 100;
  const channel = (offset: number) => {
    const position = (offset + hue) % 1;
    const factor = saturation * Math.min(lightness, 1 - lightness);
    return lightness - factor * Math.max(-1, Math.min(position * 12 - 3, 9 - position * 12, 1));
  };
  return [channel(0), channel(2 / 3), channel(1 / 3)];
}

function contrastAgainstWhite(color: string): number {
  const [red, green, blue] = hslToRgb(color).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return 1.05 / (luminance + 0.05);
}

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
    place: null,
    latitude: null,
    longitude: null,
    ...overrides,
  };
}

describe("ComparativeTimeline", () => {
  it("garantit un contraste graphique de 3:1 pour toute la palette de la fixture", () => {
    for (let personId = 1; personId <= 12; personId += 1) {
      expect(contrastAgainstWhite(personColor(personId + 1)), `personne ${personId}`).toBeGreaterThanOrEqual(3);
    }
  });

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

    render(<ComparativeTimeline rows={rows} generationByPersonId={new Map([[1, 1]])} nowYear={2026} />);

    expect(screen.getByText("1810")).toBeInTheDocument();
    expect(screen.getByText("1860")).toBeInTheDocument();
    const row = screen.getByRole("group", { name: "Timeline de Ada Lovelace" });
    expect(within(row).getByRole("link", { name: "Ada Lovelace" })).toHaveAttribute("href", "/persons/1");
    expect(within(row).getByLabelText("Vie de Ada Lovelace : 1815-12-10 – 1852-11-27")).toBeInTheDocument();
    expect(within(row).getByLabelText("Événement, Publication, 1843")).toBeInTheDocument();
    expect(within(row).getByText("G1 · 36 ans")).toBeInTheDocument();
    expect(within(row).getByTestId("timeline-person-1")).toHaveStyle({ height: "36px" });
    expect(screen.getByTestId("timeline-person-column")).toHaveStyle({ width: "158px" });
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

    render(<ComparativeTimeline rows={rows} nowYear={2020} />);

    expect(screen.getByTestId("timeline-scroll")).toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("timeline-canvas")).toHaveStyle({ minWidth: "2160px" });
  });

  it("affiche un état vide", () => {
    render(<ComparativeTimeline rows={[]} />);

    expect(screen.getByText("Aucune personne n’est encore disponible.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour à l’arbre" })).toHaveAttribute("href", "/");
  });

  it("rend les couches sans dépendre uniquement de la couleur et rend la barre navigable", () => {
    const rows: ComparativeTimelineRow[] = [{
      person: person({ id: 8, firstName: "Vie", lastName: "Test", birthDate: "2000" }),
      events: [event({ id: 9, personId: 8, type: "libre", label: "Repère", eventDate: "2020" })],
    }];
    render(<ComparativeTimeline rows={rows} layers={{ persons: true, events: true, generations: false }} nowYear={2026} />);

    expect(screen.getByRole("link", { name: /Vie de Vie Test/ })).toHaveAttribute("href", "/persons/8");
    expect(screen.getByLabelText("Naissance de Vie Test")).toBeInTheDocument();
    expect(screen.getByLabelText("Événement, Repère, 2020")).toBeInTheDocument();
    expect(screen.queryByText(/G\d/)).not.toBeInTheDocument();
  });

  it("préserve l'ordre d'ascendance, colore par branche et relie réellement les lignes", () => {
    const child = person({ id: 10, firstName: "Enfant", lastName: "Test", birthDate: "1980" });
    const parent = person({ id: 20, firstName: "Parent", lastName: "Test", birthDate: "1950" });
    render(
      <ComparativeTimeline
        rows={[{ person: child, events: [] }, { person: parent, events: [] }]}
        connections={[{ parentId: 20, childId: 10, age: 30 }]}
        branchByPersonId={new Map([[10, -1], [20, 2]])}
        preserveRowOrder
      />,
    );

    const groups = screen.getAllByRole("group");
    expect(groups[0]).toHaveAccessibleName("Timeline de Enfant Test");
    expect(groups[1]).toHaveAccessibleName("Timeline de Parent Test");
    expect(screen.getByText("Barre de vie (couleur par lignée)")).toBeInTheDocument();
    const connector = screen.getByTestId("timeline-connection-20-10");
    expect(connector).toHaveAccessibleName("Lien parent-enfant, parent âgé de 30 ans à la naissance");
    expect(screen.getByTestId("timeline-connection-lane-20-10")).toHaveStyle({ gridColumn: "2", gridRow: "1 / 3" });
    expect(screen.getByTestId("timeline-connection-parent-arm-20-10")).toHaveStyle({ gridRow: "2" });
    expect(screen.getByTestId("timeline-connection-child-arm-20-10")).toHaveStyle({ gridRow: "1" });
    expect(within(connector).getByText("30 ans")).toBeInTheDocument();
    const parentLife = screen.getByLabelText(/Vie de Parent Test/);
    expect(parentLife).toHaveStyle({ backgroundColor: "hsl(52.5, 65%, 35%)" });
  });

  it("route les liens de branches non adjacentes dans le couloir dédié", () => {
    const rows = [4, 5, 6, 7, 2, 3, 1].map((id) => ({
      person: person({ id, firstName: `Personne ${id}`, lastName: "Test", birthDate: `${1900 + id}` }),
      events: [],
    }));

    render(
      <ComparativeTimeline
        rows={rows}
        connections={[{ parentId: 4, childId: 2, age: 30 }]}
        preserveRowOrder
      />,
    );

    expect(screen.getByTestId("timeline-connection-lane-4-2")).toHaveStyle({ gridColumn: "2", gridRow: "1 / 6" });
    expect(screen.getByTestId("timeline-connection-parent-arm-4-2")).toHaveStyle({ gridRow: "1" });
    expect(screen.getByTestId("timeline-connection-child-arm-4-2")).toHaveStyle({ gridRow: "5" });
  });

  it("attribue des couloirs distincts aux liens dont les plages de lignes se chevauchent", () => {
    const rows = [4, 5, 6, 7, 2, 3, 1].map((id) => ({
      person: person({ id, firstName: `Personne ${id}`, lastName: "Test", birthDate: `${1900 + id}` }),
      events: [],
    }));

    render(
      <ComparativeTimeline
        rows={rows}
        connections={[
          { parentId: 4, childId: 2, age: 30 },
          { parentId: 7, childId: 5, age: 28 },
        ]}
        preserveRowOrder
      />,
    );

    expect(screen.getByTestId("timeline-connection-lane-4-2")).toHaveStyle({ marginLeft: "8px" });
    expect(screen.getByTestId("timeline-connection-lane-7-5")).toHaveStyle({ marginLeft: "16px" });
  });
});
