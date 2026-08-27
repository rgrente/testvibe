import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({ path }: { path: string }) => <div data-testid="edge-path">{path}</div>,
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { FiliationEdge } from "./FiliationEdge";
import type { RoutedFiliationEdgeData } from "../lib/family-tree-layout";

const data: RoutedFiliationEdgeData = {
  bus: { x1: 10, y1: 50, x2: 90, y2: 50, kind: "bus" },
  segments: [
    { x1: 50, y1: 10, x2: 50, y2: 50, kind: "stem" },
    { x1: 10, y1: 50, x2: 90, y2: 50, kind: "bus" },
    { x1: 90, y1: 50, x2: 90, y2: 100, kind: "branch" },
  ],
  targets: [{ personId: 7, x: 90, y: 100, roles: ["beau-parent", "biologique", "adopte", "biologique"] }],
};

function renderEdge() {
  render(
    <FiliationEdge
      id="filiation-test"
      source="1"
      target="7"
      sourceX={50}
      sourceY={10}
      targetX={90}
      targetY={100}
      sourcePosition={"bottom" as never}
      targetPosition={"top" as never}
      data={data}
    />,
  );
}

describe("FiliationEdge", () => {
  it("rend tous les segments orthogonaux et masque les rôles par défaut", () => {
    renderEdge();

    expect(screen.getByTestId("edge-path")).toHaveTextContent("M 50 10 L 50 50 M 10 50 L 90 50 M 90 50 L 90 100");
    expect(screen.queryByText("Biologique · Adopté·e · Beau-parent")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Afficher les rôles de filiation vers la personne 7" })).toBeInTheDocument();
  });

  it("affiche les rôles uniques dans l'ordre contractuel au survol puis les masque à la sortie", () => {
    renderEdge();
    const trigger = screen.getByRole("button", { name: "Afficher les rôles de filiation vers la personne 7" });

    fireEvent.mouseEnter(trigger);
    expect(screen.getByText("Biologique · Adopté·e · Beau-parent")).toBeVisible();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText("Biologique · Adopté·e · Beau-parent")).not.toBeInTheDocument();
  });

  it("gère focus, Échap, blur et le basculement clic/toucher sans navigation", () => {
    renderEdge();
    const trigger = screen.getByRole("button", { name: "Afficher les rôles de filiation vers la personne 7" });

    fireEvent.focus(trigger);
    expect(screen.getByText("Biologique · Adopté·e · Beau-parent")).toBeVisible();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByText("Biologique · Adopté·e · Beau-parent")).not.toBeInTheDocument();
    fireEvent.blur(trigger);
    fireEvent.click(trigger);
    expect(screen.getByText("Biologique · Adopté·e · Beau-parent")).toBeVisible();
    fireEvent.click(trigger);
    expect(screen.queryByText("Biologique · Adopté·e · Beau-parent")).not.toBeInTheDocument();
  });
});
