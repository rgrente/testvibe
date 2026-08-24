"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Background, Controls, ReactFlow, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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
  const router = useRouter();
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
        onNodeClick={(_event, node) => {
          if (node.type === "person") router.push(`/?personId=${node.id}`);
        }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
