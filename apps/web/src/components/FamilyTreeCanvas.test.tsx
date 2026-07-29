import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { FamilyTree } from "@testvibe/core";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("reactflow", () => ({
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: { Top: "top", Left: "left", Right: "right", Bottom: "bottom" },
  default: ({ nodes, onNodeClick }: { nodes: Array<{ id: string; type?: string; data: unknown }>; onNodeClick?: (event: unknown, node: unknown) => void }) => (
    <div data-testid="react-flow">
      {nodes.map((node) => (
        <button key={node.id} onClick={(event) => onNodeClick?.(event, node)}>
          {node.type}:{node.id}
        </button>
      ))}
    </div>
  ),
}));

import { FamilyTreeCanvas } from "./FamilyTreeCanvas";
import { RootPersonSelect } from "./RootPersonSelect";

function person(id: number, firstName: string) {
  return { id, firstName, lastName: "Test", birthName: null, birthDate: null, deathDate: null, gender: null };
}

const tree: FamilyTree = {
  rootId: 7,
  nodes: [
    { person: person(7, "Root"), generation: 0 },
    { person: person(8, "Other"), generation: 1 },
  ],
  edges: [],
};

describe("FamilyTreeCanvas", () => {
  it("navigue vers la personne cliquée sur toute sa carte", () => {
    render(<FamilyTreeCanvas tree={tree} />);

    fireEvent.click(screen.getByRole("button", { name: "person:8" }));

    expect(push).toHaveBeenCalledWith("/?personId=8");
  });
});

describe("RootPersonSelect", () => {
  it("affiche la personne correspondant à la racine courante", () => {
    render(<RootPersonSelect persons={[person(7, "Root"), person(8, "Other")]} selectedId={8} />);

    expect(screen.getByRole("combobox")).toHaveValue("8");
  });
});
