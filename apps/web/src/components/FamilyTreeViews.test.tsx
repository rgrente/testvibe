import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("./FamilyTreeCanvas", () => ({
  FamilyTreeCanvas: ({ profile, tree }: { profile: string; tree: { nodes: unknown[] } }) => <div data-testid={`canvas-${profile}`}>{tree.nodes.length}</div>,
}));
vi.mock("./FamilyTreeMobileList", () => ({
  FamilyTreeMobileList: () => <div data-testid="mobile-list" />,
}));
vi.mock("./FamilyTreeFanChart", () => ({
  FamilyTreeFanChart: () => <div data-testid="fan-chart" />,
}));

import { FamilyTreeViews } from "./FamilyTreeViews";

const tree = { rootId: 1, nodes: [], edges: [] } as never;

describe("FamilyTreeViews", () => {
  beforeEach(() => window.localStorage.clear());

  it("affiche la composition mobile 1b dans le mode Arbre par défaut", () => {
    render(<FamilyTreeViews tree={tree} />);
    expect(screen.getByTestId("mobile-list")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-mobile")).not.toBeInTheDocument();
    expect(screen.getByTestId("canvas-desktop")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arbre" })).toHaveAttribute("aria-pressed", "true");
  });

  it("bascule vers la liste et mémorise le choix localement", () => {
    render(<FamilyTreeViews tree={tree} />);
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    expect(screen.getByTestId("mobile-list")).toBeInTheDocument();
    expect(window.localStorage.getItem("family-tree-view")).toBe("list");
  });

  it("restaure le mode mémorisé pendant la navigation", () => {
    window.localStorage.setItem("family-tree-view", "list");
    render(<FamilyTreeViews tree={tree} />);
    expect(screen.getByTestId("mobile-list")).toBeInTheDocument();
  });

  it("bascule vers l’éventail et mémorise le choix", () => {
    render(<FamilyTreeViews tree={tree} />);
    fireEvent.click(screen.getByRole("button", { name: "Éventail" }));
    expect(screen.getByTestId("fan-chart")).toBeInTheDocument();
    expect(window.localStorage.getItem("family-tree-view")).toBe("fan");
  });

  it("migre le choix mémorisé sous l’ancienne clé", () => {
    window.localStorage.setItem("family-tree-mobile-view", "fan");
    render(<FamilyTreeViews tree={tree} />);
    expect(screen.getByTestId("fan-chart")).toBeInTheDocument();
    expect(window.localStorage.getItem("family-tree-view")).toBe("fan");
    expect(window.localStorage.getItem("family-tree-mobile-view")).toBeNull();
  });

  it("offre les profondeurs 2/3/4/Tout et l’ajout sans masquer les autres modes", () => {
    const deepTree = {
      rootId: 1,
      nodes: [-2, -1, 0, 1, 2].map((generation, index) => ({ person: { id: index + 1 }, generation })),
      edges: [],
    } as never;
    render(<FamilyTreeViews tree={deepTree} />);

    expect(screen.getByRole("button", { name: "Afficher 3 générations" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Afficher 2 générations" }));
    expect(screen.getByTestId("canvas-desktop")).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Afficher tout l’arbre" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("link", { name: "Ajouter une personne" })).toHaveAttribute("href", "/admin/persons");
  });
});
