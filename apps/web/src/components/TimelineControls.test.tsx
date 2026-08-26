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
    render(<TimelineControls persons={persons} selectedId={1} generations={4} />);
    fireEvent.change(screen.getByLabelText("Personne racine"), { target: { value: "2" } });
    expect(push).toHaveBeenLastCalledWith("/timeline?personId=2&generations=4");
    fireEvent.change(screen.getByLabelText("Générations d’ascendants"), { target: { value: "6" } });
    expect(push).toHaveBeenLastCalledWith("/timeline?personId=1&generations=6");
  });
});
