import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { FamilyTree } from "@testvibe/core";
import { FamilyTreeMobileList } from "./FamilyTreeMobileList";

function makeTree(): FamilyTree {
  return {
    rootId: 2,
    nodes: [
      { person: { id: 1, firstName: "Ada", lastName: "Lovelace", birthName: "Byron", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
      { person: { id: 2, firstName: "Byron", lastName: "King", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
      { person: { id: 4, firstName: "Ralph", lastName: "King", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
    ],
    edges: [],
  };
}

describe("FamilyTreeMobileList", () => {
  it("affiche une ligne par Person avec son nom complet", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Byron King")).toBeInTheDocument();
    expect(screen.getByText("Ralph King")).toBeInTheDocument();
  });

  it("marque la racine avec le suffixe (racine)", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);
    const rootRow = screen.getByTestId("mobile-row-2");
    expect(rootRow).toHaveTextContent("(racine)");
    expect(screen.getByTestId("mobile-row-1")).not.toHaveTextContent("(racine)");
  });

  it("affiche distinctement le nom de naissance seulement lorsqu'il existe", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);
    expect(screen.getByTestId("mobile-row-1")).toHaveTextContent("Nom de naissance : Byron");
    expect(screen.getByTestId("mobile-row-2")).not.toHaveTextContent("Nom de naissance");
  });
});
