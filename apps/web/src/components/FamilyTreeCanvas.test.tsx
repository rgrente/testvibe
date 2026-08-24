import type { MouseEvent, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { FamilyTree } from "@testvibe/core";

const { push, setCenter, zoomIn, zoomOut } = vi.hoisted(() => ({
  push: vi.fn(),
  setCenter: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

interface MockNode {
  id: string;
  type?: string;
}

interface MockReactFlowProps {
  nodes: MockNode[];
  edges: Array<{ id: string }>;
  onNodeClick?: (event: MouseEvent<HTMLButtonElement>, node: MockNode) => void;
  onInit?: (instance: unknown) => void;
  children?: ReactNode;
}

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes, edges, onNodeClick, onInit, children }: MockReactFlowProps) => {
    onInit?.({ setCenter, zoomIn, zoomOut });
    return (
    <div>
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          data-testid={`flow-node-${node.id}`}
          onClick={(event) => onNodeClick?.(event, node)}
        >
          {node.id}
        </button>
      ))}
      {edges.map((edge) => (
        <button key={edge.id} type="button" data-testid={`flow-edge-${edge.id}`}>
          {edge.id}
        </button>
      ))}
      {children}
    </div>
    );
  },
  Background: () => <button type="button" data-testid="flow-background">Fond</button>,
  Controls: () => <button type="button" data-testid="flow-controls">Contrôles</button>,
}));

import { FamilyTreeCanvas } from "./FamilyTreeCanvas";

function makeTree(): FamilyTree {
  return {
    rootId: 1,
    nodes: [
      {
        person: {
          id: 1,
          firstName: "Ada",
          lastName: "Lovelace",
          birthName: null,
          birthDate: null,
          deathDate: null,
          gender: null,
        } as never,
        generation: 0,
      },
      {
        person: {
          id: 2,
          firstName: "Charles",
          lastName: "Babbage",
          birthName: null,
          birthDate: null,
          deathDate: null,
          gender: null,
        } as never,
        generation: 0,
      },
    ],
    edges: [{ type: "union", unionId: 10, personIds: [1, 2] }],
  };
}

describe("FamilyTreeCanvas", () => {
  beforeEach(() => {
    push.mockReset();
    setCenter.mockReset();
    zoomIn.mockReset();
    zoomOut.mockReset();
  });

  it("navigue vers la personne cliquée pour la choisir comme racine", () => {
    render(<FamilyTreeCanvas tree={makeTree()} />);

    fireEvent.click(screen.getByTestId("flow-node-2"));

    expect(push).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/?personId=2");
  });

  it("ne navigue pas depuis une jonction, une arête, le fond ou les contrôles", () => {
    render(<FamilyTreeCanvas tree={makeTree()} />);

    fireEvent.click(screen.getByTestId("flow-node-union-10"));
    fireEvent.click(screen.getAllByTestId(/^flow-edge-/)[0]);
    fireEvent.click(screen.getByTestId("flow-background"));
    fireEvent.click(screen.getByRole("button", { name: "Zoom avant" }));

    expect(push).not.toHaveBeenCalled();
  });

  it("recentre la racine et expose des contrôles de zoom tactiles", () => {
    render(<FamilyTreeCanvas tree={makeTree()} profile="mobile" />);

    fireEvent.click(screen.getByRole("button", { name: "Zoom avant" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom arrière" }));
    fireEvent.click(screen.getByRole("button", { name: "Recentrer" }));

    expect(zoomIn).toHaveBeenCalledOnce();
    expect(zoomOut).toHaveBeenCalledOnce();
    expect(setCenter).toHaveBeenCalledWith(75, 32, expect.objectContaining({ zoom: 1 }));
  });
});
