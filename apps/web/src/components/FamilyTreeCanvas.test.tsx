import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { FamilyTree } from "@testvibe/core";

const { push, setCenter, zoomIn, zoomOut, fitView, viewport } = vi.hoisted(() => ({
  push: vi.fn(),
  setCenter: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  fitView: vi.fn(),
  viewport: { x: 0, y: 0, zoom: 1 },
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
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onInit?: (instance: unknown) => void;
  panOnDrag?: boolean;
  zoomOnPinch?: boolean;
  children?: ReactNode;
}

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ nodes, edges, onNodeClick, onKeyDown, onInit, panOnDrag, zoomOnPinch, children }: MockReactFlowProps) => {
    onInit?.({ setCenter, zoomIn, zoomOut, fitView });
    return (
    <div onKeyDown={onKeyDown} data-pan-on-drag={panOnDrag} data-zoom-on-pinch={zoomOnPinch} data-testid="react-flow">
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          data-id={node.id}
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
  MiniMap: () => <div data-testid="flow-minimap" />,
  Controls: () => <button type="button" data-testid="flow-controls">Contrôles</button>,
  useViewport: () => viewport,
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
    fitView.mockReset();
    Object.assign(viewport, { x: 0, y: 0, zoom: 1 });
  });

  it("navigue vers la personne cliquée pour la choisir comme racine", () => {
    render(<FamilyTreeCanvas tree={makeTree()} />);

    fireEvent.click(screen.getByTestId("flow-node-2"));

    expect(push).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/?personId=2");
  });

  it.each(["Enter", " "])("choisit une carte focalisée comme racine avec la touche %s", (key) => {
    render(<FamilyTreeCanvas tree={makeTree()} />);

    fireEvent.keyDown(screen.getByTestId("flow-node-2"), { key });

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
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-pan-on-drag", "true");
    expect(screen.getByTestId("react-flow")).toHaveAttribute("data-zoom-on-pinch", "true");
  });

  it("reprend le canevas, la minimap, les contrôles et le statut de la référence 1a", () => {
    render(<FamilyTreeCanvas tree={makeTree()} />);

    expect(screen.getByTestId("family-tree-canvas-desktop")).toHaveClass("h-[600px]");
    expect(screen.getByTestId("flow-minimap")).toBeInTheDocument();
    expect(screen.getByText("100 %")).toHaveClass("font-mono");
    expect(screen.getByText("2 personnes")).toBeInTheDocument();
    expect(screen.getByText("1 génération")).toBeInTheDocument();
    expect(screen.getByText("1 union")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ajuster l’arbre" }));
    expect(fitView).toHaveBeenCalledWith(expect.objectContaining({ padding: 0.12 }));
  });

  it("rend des bandes desktop sémantiques stables et synchronisées au viewport", () => {
    const tree = makeTree();
    tree.nodes = [
      { person: { id: 3, firstName: "Grace", lastName: "Hopper", birthName: null, birthDate: null, deathDate: null, gender: null } as never, generation: -1 },
      ...tree.nodes,
      { person: { id: 4, firstName: "Alan", lastName: "Turing", birthName: null, birthDate: null, deathDate: null, gender: null } as never, generation: 1 },
    ];

    const { rerender } = render(<FamilyTreeCanvas tree={tree} />);

    expect(screen.getByRole("list", { name: "Bandes de génération" })).toHaveClass("font-mono");
    expect(screen.getAllByTestId(/^desktop-generation-band-/).map((band) => band.textContent)).toEqual([
      "G2 · PARENTS",
      "G3 · MOI & FRATRIE",
      "G4 · ENFANTS",
    ]);
    expect(screen.getByTestId("desktop-generation-band--1")).toHaveStyle({ top: "-140px" });
    expect(screen.getByTestId("desktop-generation-band-1")).toHaveStyle({ top: "140px" });

    Object.assign(viewport, { x: 20, y: 35, zoom: 1.5 });
    rerender(<FamilyTreeCanvas tree={tree} />);
    expect(screen.getByTestId("desktop-generation-band--1")).toHaveStyle({ top: "-175px" });
    expect(screen.getByTestId("desktop-generation-band-1")).toHaveStyle({ top: "245px" });
  });
});
