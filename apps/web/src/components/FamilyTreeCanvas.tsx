"use client";

import { useMemo } from "react";
import ReactFlow, { Background, Controls, type NodeTypes } from "reactflow";
import "reactflow/dist/style.css";
import type { FamilyTree } from "@testvibe/core";
import { buildReactFlowGraph } from "../lib/family-tree-layout";
import { PersonNode } from "./PersonNode";
import { UnionJunctionNode } from "./UnionJunctionNode";

const nodeTypes: NodeTypes = { person: PersonNode, unionJunction: UnionJunctionNode };

export interface FamilyTreeCanvasProps {
  tree: FamilyTree;
}

/**
 * Vue desktop de l'arbre généalogique : canevas react-flow interactif
 * (pan/zoom) affichant une ligne par génération. Masquée sur petits
 * écrans au profit de FamilyTreeMobileList (cf. page.tsx).
 */
export function FamilyTreeCanvas({ tree }: FamilyTreeCanvasProps) {
  const graph = useMemo(() => buildReactFlowGraph(tree), [tree]);

  return (
    <div
      data-testid="family-tree-canvas"
      className="hidden h-[70vh] w-full rounded-lg border border-slate-200 md:block"
    >
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
