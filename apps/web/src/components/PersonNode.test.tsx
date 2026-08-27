import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Left: "left", Right: "right", Bottom: "bottom" },
}));

import { PersonNode } from "./PersonNode";
import type { PersonNodeData } from "../lib/family-tree-layout";

function renderNode(overrides: Partial<PersonNodeData> = {}) {
  const data: PersonNodeData = {
    personId: 1,
    label: "Simone Signoret",
    birthName: null,
    isRoot: false,
    generation: 0,
    gender: null,
    birthDate: null,
    deathDate: null,
    ...overrides,
  };
  render(
    <PersonNode
      data={data}
      id="1"
      type="person"
      selected={false}
      zIndex={0}
      isConnectable={false}
      positionAbsoluteX={0}
      positionAbsoluteY={0}
      dragging={false}
      selectable
      deletable
      draggable
    />,
  );
}

describe("PersonNode", () => {
  it("utilise une largeur desktop homogène de 180 px", () => {
    renderNode();
    expect(screen.getByTestId("person-node-1")).toHaveClass("w-[180px]");
  });

  it("affiche distinctement le nom de naissance lorsqu'il existe", () => {
    renderNode({ birthName: "Kaminker" });
    expect(screen.getByTestId("person-node-1")).toHaveTextContent("Nom de naissance : Kaminker");
  });

  it("n'affiche aucun libellé de nom de naissance lorsqu'il est absent", () => {
    renderNode();
    expect(screen.getByTestId("person-node-1")).not.toHaveTextContent("Nom de naissance");
  });

  it("reprend les proportions et la hiérarchie typographique de la référence 1a", () => {
    renderNode({ birthName: "Kaminker", birthDate: "1921-03-25", deathDate: "1985-09-30", isRoot: true });
    const card = screen.getByTestId("person-node-1");
    expect(card).toHaveClass("h-[72px]", "font-sans");
    expect(screen.getByTestId("person-name-1")).toHaveClass("text-[13px]", "font-semibold");
    expect(screen.getByText("née Kaminker")).toBeInTheDocument();
    expect(screen.getByTestId("person-dates-1")).toHaveClass("font-mono", "text-[10.5px]");
  });
});
