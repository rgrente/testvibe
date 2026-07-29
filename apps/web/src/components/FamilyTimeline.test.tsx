import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { FamilyTimelineItem } from "@testvibe/core";
import { describe, expect, it } from "vitest";
import { FamilyTimeline } from "./FamilyTimeline";

function makeEntry({
  eventId,
  personId,
  firstName,
  lastName,
  type,
  eventDate,
  label = null,
}: {
  eventId: number;
  personId: number;
  firstName: string;
  lastName: string;
  type: FamilyTimelineItem["event"]["type"];
  eventDate: string | null;
  label?: string | null;
}): FamilyTimelineItem {
  return {
    key: `event:${eventId}`,
    event: {
      type,
      label,
      eventDate,
      description: null,
    },
    person: {
      id: personId,
      firstName,
      lastName,
      birthName: null,
      birthDate: null,
      deathDate: null,
      gender: null,
    },
  };
}

describe("FamilyTimeline", () => {
  it("affiche les événements datés avec leur date, leur type et un lien vers la personne", () => {
    render(
      <FamilyTimeline
        entries={[
          makeEntry({
            eventId: 1,
            personId: 10,
            firstName: "Alice",
            lastName: "Martin",
            type: "naissance",
            eventDate: "1985-03-10",
          }),
          makeEntry({
            eventId: 2,
            personId: 11,
            firstName: "Bob",
            lastName: "Dupont",
            type: "décès",
            eventDate: "2020",
          }),
        ]}
      />,
    );

    const datedSection = screen.getByRole("region", { name: "Événements datés" });
    expect(within(datedSection).getByText("10/03/1985")).toBeInTheDocument();
    expect(within(datedSection).getByText("2020")).toBeInTheDocument();
    expect(within(datedSection).getByText("Naissance")).toBeInTheDocument();
    expect(within(datedSection).getByText("Décès")).toBeInTheDocument();
    expect(within(datedSection).getByRole("link", { name: "Alice Martin" })).toHaveAttribute(
      "href",
      "/persons/10",
    );
    expect(within(datedSection).getByRole("link", { name: "Bob Dupont" })).toHaveAttribute(
      "href",
      "/persons/11",
    );
  });

  it("conserve les événements sans date dans une zone Non datés", () => {
    render(
      <FamilyTimeline
        entries={[
          makeEntry({
            eventId: 3,
            personId: 12,
            firstName: "Claire",
            lastName: "Bernard",
            type: "libre",
            label: "Déménagement",
            eventDate: null,
          }),
        ]}
      />,
    );

    const undatedSection = screen.getByRole("region", { name: "Événements non datés" });
    expect(within(undatedSection).getByRole("heading", { name: "Non datés" })).toBeInTheDocument();
    expect(within(undatedSection).getByText("Déménagement")).toBeInTheDocument();
    expect(within(undatedSection).getByRole("link", { name: "Claire Bernard" })).toHaveAttribute(
      "href",
      "/persons/12",
    );
  });

  it("affiche un état vide avec un retour vers l'arbre", () => {
    render(<FamilyTimeline entries={[]} />);

    expect(screen.getByText("Aucun événement familial n’est encore disponible.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour à l’arbre" })).toHaveAttribute("href", "/");
  });
});
