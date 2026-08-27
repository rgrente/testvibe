"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Background, ReactFlow, useViewport, type EdgeTypes, type NodeTypes, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { FamilyTree } from "@testvibe/core";
import { buildReactFlowGraph, GENERATION_ROW_HEIGHT, generationDisplayNumber, generationSemanticLabel, type FamilyTreeLayoutProfile, type ReactFlowGraphNode } from "../lib/family-tree-layout";
import { PersonNode } from "./PersonNode";
import { UnionJunctionNode } from "./UnionJunctionNode";
import { FiliationEdge } from "./FiliationEdge";

const nodeTypes: NodeTypes = { person: PersonNode, unionJunction: UnionJunctionNode };
const edgeTypes: EdgeTypes = { filiation: FiliationEdge };

export interface FamilyTreeCanvasProps {
  tree: FamilyTree;
  profile?: FamilyTreeLayoutProfile;
  className?: string;
}

function GenerationBands({ generations }: { generations: number[] }) {
  const viewport = useViewport();
  return (
    <ol aria-label="Bandes de génération" className="family-tree-mono pointer-events-none absolute inset-0 z-10 font-mono text-[9.5px] tracking-[0.1em] text-slate-400">
      {generations.map((generation) => (
        <li
          key={generation}
          data-testid={`desktop-generation-band-${generation}`}
          className="absolute left-3 right-3 border-t border-slate-200 pt-1"
          style={{ top: viewport.y + generation * GENERATION_ROW_HEIGHT * viewport.zoom }}
        >
          G{generationDisplayNumber(generation)} · {generationSemanticLabel(generation)}
        </li>
      ))}
    </ol>
  );
}

export function FamilyTreeCanvas({ tree, profile = "desktop", className = "" }: FamilyTreeCanvasProps) {
  const router = useRouter();
  const instanceRef = useRef<ReactFlowInstance<ReactFlowGraphNode> | null>(null);
  const graph = useMemo(() => buildReactFlowGraph(tree, profile), [tree, profile]);
  const generations = useMemo(
    () => [...new Set(tree.nodes.map((node) => node.generation))].sort((a, b) => a - b),
    [tree.nodes],
  );

  const centerRoot = useCallback(() => {
    const root = graph.nodes.find((node) => node.id === String(tree.rootId));
    if (!root || !instanceRef.current) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const width = profile === "mobile" ? 150 : (root.measured?.width ?? 180);
    const height = root.measured?.height ?? 64;
    void instanceRef.current.setCenter(root.position.x + width / 2, root.position.y + height / 2, {
      zoom: profile === "mobile" ? 1 : 0.9,
      duration: reducedMotion ? 0 : 250,
    });
  }, [graph.nodes, profile, tree.rootId]);

  useEffect(() => {
    if (!instanceRef.current) return;
    const frame = window.requestAnimationFrame(centerRoot);
    window.addEventListener("resize", centerRoot);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", centerRoot);
    };
  }, [centerRoot]);

  return (
    <div data-testid={`family-tree-canvas-${profile}`} className={`relative h-[65vh] min-h-[440px] w-full rounded-lg border border-slate-200 ${className}`}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          instanceRef.current = instance;
          window.requestAnimationFrame(centerRoot);
        }}
        onNodeClick={(_event, node) => {
          if (node.type === "person") router.push(`/?personId=${node.id}`);
        }}
        panOnDrag
        zoomOnPinch
        zoomOnDoubleClick={false}
        zoomOnScroll={profile === "desktop"}
        preventScrolling={profile === "desktop"}
        minZoom={0.45}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        {profile === "desktop" ? <GenerationBands generations={generations} /> : null}
        <Background />
      </ReactFlow>
      <div className="absolute bottom-3 right-3 z-10 flex gap-2" aria-label="Contrôles de l’arbre">
        <button type="button" className="flex h-11 min-w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-xl shadow-xs hover:bg-slate-50" onClick={() => instanceRef.current?.zoomIn({ duration: 150 })} aria-label="Zoom avant">+</button>
        <button type="button" className="flex h-11 min-w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-xl shadow-xs hover:bg-slate-50" onClick={() => instanceRef.current?.zoomOut({ duration: 150 })} aria-label="Zoom arrière">−</button>
        <button type="button" className="flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium shadow-xs hover:bg-slate-50" onClick={centerRoot}>Recentrer</button>
      </div>
    </div>
  );
}
