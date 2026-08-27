import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
      "G2 · PARENTS2",
      "G3 · MOI & FRATRIE2",
      "G4 · ENFANTS1",
    ]);
    expect(screen.getByTestId("mobile-row-1")).toHaveStyle({ paddingLeft: "0px" });
    expect(screen.getByTestId("mobile-row-4")).toHaveStyle({ paddingLeft: "0px" });
  });

  it("affiche une ligne par Person avec son nom complet", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getAllByText("Byron King")).toHaveLength(2);
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
    expect(screen.getByTestId("mobile-siblings")).not.toHaveClass("overflow-x-auto");
    expect(screen.getByTestId("mobile-row-3")).toHaveClass("shrink-0");
  });

  it("rend l’en-tête focus et les filtres tactiles de la référence 1b", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Byron King" })).toBeInTheDocument();
    expect(screen.getByText((content, element) => element?.tagName === "P" && content.startsWith("G3"))).toHaveClass("font-mono");
    for (const name of ["Proches", "Ascendance", "Descendance"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("min-h-11");
    }
    expect(screen.getByRole("button", { name: "Proches" })).toHaveAttribute("aria-pressed", "true");
  });

  it("filtre les branches et permet de changer de racine au clavier ou au toucher", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);

    const ada = screen.getByRole("link", { name: "Centrer l’arbre sur Ada Lovelace" });
    expect(ada).toHaveAttribute("href", "/?personId=1");
    expect(ada).toHaveClass("min-h-11", "focus-visible:outline-2");

    fireEvent.click(screen.getByRole("button", { name: "Ascendance" }));
    expect(screen.getByTestId("mobile-generation--1")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-generation-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descendance" }));
    expect(screen.queryByTestId("mobile-generation--1")).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-generation-1")).toBeInTheDocument();
  });

  it.each([
    { count: 0, hidden: null },
    { count: 1, hidden: null },
    { count: 2, hidden: null },
    { count: 4, hidden: "+2" },
  ])("affiche au plus deux frères sur $count et compte exactement le reliquat", ({ count, hidden }) => {
    const tree = makeTree();
    tree.nodes = tree.nodes.filter((node) => node.generation !== 0 || node.person.id === tree.rootId);
    for (let index = 0; index < count; index += 1) {
      tree.nodes.push({
        person: { id: 20 + index, firstName: `Frère ${index}`, lastName: "King", birthDate: `195${index}-01-01`, deathDate: null, gender: null } as any,
        generation: 0,
      });
    }

    render(<FamilyTreeMobileList tree={tree} />);

    expect(screen.queryAllByTestId(/^mobile-row-2[0-9]$/)).toHaveLength(Math.min(count, 2));
    if (hidden) expect(screen.getByText(hidden)).toHaveAttribute("aria-label", `${count - 2} autres membres de la fratrie`);
    else expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("affiche dates et compteurs en JetBrains Mono sans perdre les données partielles", () => {
    render(<FamilyTreeMobileList tree={makeTree()} />);
    expect(screen.getByText("10/12/1815")).toHaveClass("font-mono");
    expect(screen.getByTestId("mobile-generation-1")).toHaveTextContent("1");
    expect(screen.getByTestId("mobile-row-4")).toBeInTheDocument();
  });
});
