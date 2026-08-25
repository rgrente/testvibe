import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { UpcomingFamilyAnniversaries } from "./UpcomingFamilyAnniversaries";

describe("UpcomingFamilyAnniversaries", () => {
  it("affiche la date, l'échéance et les personnes concernées", () => {
    render(<UpcomingFamilyAnniversaries anniversaries={[{
      key: "union:1:mariage", type: "mariage", occurrenceDate: "2026-09-05",
      daysUntil: 4, yearsElapsed: 16,
      persons: [
        { id: 1, firstName: "Alice", lastName: "Alpha", birthName: null, birthDate: null, deathDate: null, gender: null },
        { id: 2, firstName: "Bob", lastName: "Beta", birthName: null, birthDate: null, deathDate: null, gender: null },
      ],
    }]} />);
    expect(screen.getByText("Anniversaire de mariage")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alice Alpha" })).toHaveAttribute("href", "/persons/1");
    expect(screen.getByText(/5 septembre · dans 4 jours · 16 ans/)).toBeInTheDocument();
  });
});
