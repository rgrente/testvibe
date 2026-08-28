import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { FamilyTree } from "@testvibe/core";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { FamilyTreeFanChart } from "./FamilyTreeFanChart";

const person = (id: number, firstName: string, birthDate: string | null = null, deathDate: string | null = null) => ({
  person: { id, firstName, lastName: "Test", birthName: null, birthDate, deathDate, gender: null },
  generation: id === 1 ? 0 : -1,
});

function makeTree(): FamilyTree {
  return {
    rootId: 1,
    nodes: [person(1, "Racine"), person(2, "Parent", "1950-01-01", "2020-02-02"), person(3, "Deuxième parent au prénom long")],
    edges: [
      { type: "filiation", filiationId: 1, parentId: 2, childId: 1, role: "biologique" },
      { type: "filiation", filiationId: 2, parentId: 3, childId: 1, role: "biologique" },
    ],
  } as FamilyTree;
}

describe("FamilyTreeFanChart", () => {
  beforeEach(() => push.mockReset());

  it("rend le viewport défilable accessible au clavier", () => {
    render(<FamilyTreeFanChart tree={makeTree()} />);

    const viewport = screen.getByTestId("family-tree-fan-chart");
    viewport.focus();

    expect(viewport).toHaveFocus();
    expect(viewport).toHaveAccessibleName("Éventail des ancêtres défilable horizontalement");
  });

  it("affiche chaque ascendant et distingue la personne racine", () => {
    render(<FamilyTreeFanChart tree={makeTree()} />);

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Racine Test, personne racine" })).toHaveClass("focus-visible:outline-2");
    expect(screen.getByText("1950 – 2020")).toBeInTheDocument();
    expect(screen.getByText("Deuxième parent a…")).toBeInTheDocument();
  });

  it("navigue vers la personne cliquée", () => {
    render(<FamilyTreeFanChart tree={makeTree()} />);
    fireEvent.click(screen.getByRole("link", { name: "Parent Test, génération 1" }));
    expect(push).toHaveBeenCalledWith("/?personId=2");
  });

  it.each(["Enter", " "])("navigue au clavier avec %p", (key) => {
    render(<FamilyTreeFanChart tree={makeTree()} />);
    fireEvent.keyDown(screen.getByRole("link", { name: "Parent Test, génération 1" }), { key });
    expect(push).toHaveBeenCalledWith("/?personId=2");
  });
});
