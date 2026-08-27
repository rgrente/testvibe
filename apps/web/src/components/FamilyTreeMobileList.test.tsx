import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { FamilyTree } from "@testvibe/core";
import { FamilyTreeMobileList } from "./FamilyTreeMobileList";

function makeTree(): FamilyTree {
  return {
    rootId: 2,
    nodes: [
      { person: { id: 1, firstName: "Ada", lastName: "Lovelace", birthName: "Byron", birthDate: "1815-12-10", deathDate: null, gender: null } as any, generation: -1 },
      { person: { id: 5, firstName: "Charles", lastName: "Babbage", birthName: null, birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
      { person: { id: 2, firstName: "Byron", lastName: "King", birthDate: "1950-05-12", deathDate: null, gender: null } as any, generation: 0 },
      { person: { id: 3, firstName: "Anne", lastName: "King", birthDate: "1952-01-01", deathDate: null, gender: null } as any, generation: 0 },
      { person: { id: 4, firstName: "Ralph", lastName: "King", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
    ],
    edges: [],
  };
}

describe("FamilyTreeMobileList", () => {
  it("regroupe les personnes sans indentation dans des sections de génération croissantes", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "G1 · PARENTS2",
      "G2 · MOI & FRATRIE2",
      "G3 · ENFANTS1",
    ]);
    expect(screen.getByTestId("mobile-row-1")).toHaveStyle({ paddingLeft: "0px" });
    expect(screen.getByTestId("mobile-row-4")).toHaveStyle({ paddingLeft: "0px" });
  });

  it("affiche une ligne par Person avec son nom complet", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Byron King")).toBeInTheDocument();
    expect(screen.getByText("Ralph King")).toBeInTheDocument();
  });

  it("marque la racine avec le suffixe (racine)", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);
    const rootRow = screen.getByTestId("mobile-row-2");
    expect(rootRow).toHaveTextContent("FOCUS");
    expect(screen.getByTestId("mobile-row-1")).not.toHaveTextContent("(racine)");
  });

  it("affiche distinctement le nom de naissance seulement lorsqu'il existe", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);
    expect(screen.getByTestId("mobile-row-1")).toHaveTextContent("Nom de naissance : Byron");
    expect(screen.getByTestId("mobile-row-2")).not.toHaveTextContent("Nom de naissance");
  });

  it("compose les ascendants en grille, distingue le focus et condense la fratrie", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);
    expect(screen.getByTestId("mobile-generation--1").querySelector("ul")).toHaveClass("grid-cols-2");
    expect(screen.getByTestId("mobile-row-2")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("mobile-siblings")).toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("mobile-row-3")).toHaveClass("shrink-0");
  });

  it("affiche dates et compteurs en JetBrains Mono sans perdre les données partielles", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);
    expect(screen.getByText("10/12/1815")).toHaveClass("font-mono");
    expect(screen.getByTestId("mobile-generation-1")).toHaveTextContent("1");
    expect(screen.getByTestId("mobile-row-4")).toBeInTheDocument();
  });
});
