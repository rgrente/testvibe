import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { FamilyAnniversaries } from "./FamilyAnniversaries";

describe("FamilyAnniversaries", () => {
  it("affiche un état vide soigné", () => {
    render(<FamilyAnniversaries anniversaries={[]} />);
    expect(screen.getByText("Aucun anniversaire familial à cette date.")).toBeInTheDocument();
  });

  it("relie la personne et l'événement et affiche le nombre d'années", () => {
    render(<FamilyAnniversaries anniversaries={[{
      key: "event:42",
      eventId: 42,
      yearsElapsed: 26,
      event: { type: "libre", label: "Installation à Lyon", eventDate: "2000-08-24", description: null },
      person: { id: 7, firstName: "Alice", lastName: "Martin", birthName: null, birthDate: null, deathDate: null, gender: null },
    }]} />);
    expect(screen.getByRole("link", { name: "Installation à Lyon" })).toHaveAttribute("href", "/persons/7#event-42");
    expect(screen.getByRole("link", { name: "Alice Martin" })).toHaveAttribute("href", "/persons/7");
    expect(screen.getByText("Il y a 26 ans")).toBeInTheDocument();
  });
});
