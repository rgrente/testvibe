import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("./FamilyTreeCanvas", () => ({
  FamilyTreeCanvas: ({ profile }: { profile: string }) => <div data-testid={`canvas-${profile}`} />,
}));
vi.mock("./FamilyTreeMobileList", () => ({
  FamilyTreeMobileList: () => <div data-testid="mobile-list" />,
}));

import { FamilyTreeViews } from "./FamilyTreeViews";

const tree = { rootId: 1, nodes: [], edges: [] } as never;

describe("FamilyTreeViews", () => {
  beforeEach(() => window.localStorage.clear());

  it("affiche l’arbre visuel mobile par défaut", () => {
    render(<FamilyTreeViews tree={tree} />);
    expect(screen.getByTestId("canvas-mobile")).toBeInTheDocument();
    expect(screen.queryByTestId("mobile-list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arbre" })).toHaveAttribute("aria-pressed", "true");
  });

  it("bascule vers la liste et mémorise le choix localement", () => {
    render(<FamilyTreeViews tree={tree} />);
    fireEvent.click(screen.getByRole("button", { name: "Liste" }));
    expect(screen.getByTestId("mobile-list")).toBeInTheDocument();
    expect(window.localStorage.getItem("family-tree-mobile-view")).toBe("list");
  });

  it("restaure le mode mémorisé pendant la navigation", () => {
    window.localStorage.setItem("family-tree-mobile-view", "list");
    render(<FamilyTreeViews tree={tree} />);
    expect(screen.getByTestId("mobile-list")).toBeInTheDocument();
  });
});
