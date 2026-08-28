import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { TimelineControls } from "./TimelineControls";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const persons = [
  { id: 1, firstName: "Ada", lastName: "Lovelace", birthName: null, birthDate: null, deathDate: null, gender: null },
  { id: 2, firstName: "Alan", lastName: "Turing", birthName: null, birthDate: null, deathDate: null, gender: null },
];

describe("TimelineControls", () => {
  it("navigue quand la racine ou le nombre de générations change", () => {
    render(<TimelineControls persons={persons} selectedId={1} generations={4} layers={{ persons: true, events: true, generations: true }} />);
    fireEvent.change(screen.getByLabelText("Personne racine"), { target: { value: "2" } });
    expect(push).toHaveBeenLastCalledWith("/timeline?personId=2&generations=4");
    fireEvent.change(screen.getByLabelText("Générations d’ascendants"), { target: { value: "6" } });
    expect(push).toHaveBeenLastCalledWith("/timeline?personId=1&generations=6");
  });

  it("expose trois filtres cumulatifs et conserve tous les paramètres dans l’URL", () => {
    render(<TimelineControls persons={persons} selectedId={1} generations={4} layers={{ persons: true, events: false, generations: true }} />);

    expect(screen.getByRole("button", { name: "Personnes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Événements" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Générations" }));
    expect(push).toHaveBeenLastCalledWith("/timeline?personId=1&generations=4&persons=1&events=0&generationLayer=0");
  });
});
