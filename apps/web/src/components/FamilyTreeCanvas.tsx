"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Background, MiniMap, ReactFlow, useViewport, type EdgeTypes, type NodeTypes, type ReactFlowInstance } from "@xyflow/react";
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

function ZoomPercent() {
  const { zoom } = useViewport();
  return <output aria-label="Niveau de zoom" className="family-tree-mono min-w-14 px-2 text-center font-mono text-[11px] text-slate-600">{Math.round(zoom * 100)} %</output>;
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
    const width = profile === "mobile" ? 150 : (root.measured?.width ?? 184);
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
    <div data-testid={`family-tree-canvas-${profile}`} className={`relative w-full overflow-hidden rounded-[10px] border border-slate-200 bg-slate-50 ${profile === "desktop" ? "h-[600px]" : "h-[466px]"} ${className}`}>
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
        <Background gap={22} size={1} color="#d9dde3" />
        {profile === "desktop" ? <MiniMap pannable zoomable /> : null}
        <div className="absolute bottom-12 left-3 z-10 flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs" aria-label="Contrôles de l’arbre">
          <button type="button" className="flex h-11 min-w-11 items-center justify-center border-r border-slate-200 text-xl hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => instanceRef.current?.zoomOut({ duration: 150 })} aria-label="Zoom arrière">−</button>
          <ZoomPercent />
          <button type="button" className="flex h-11 min-w-11 items-center justify-center border-l border-slate-200 text-xl hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => instanceRef.current?.zoomIn({ duration: 150 })} aria-label="Zoom avant">+</button>
        </div>
      </ReactFlow>
      <div className="absolute bottom-12 left-40 z-10 flex gap-2">
        <button type="button" className="flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium shadow-xs hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={() => instanceRef.current?.fitView({ padding: 0.12, duration: 200 })} aria-label="Ajuster l’arbre">Ajuster</button>
        <button type="button" className="flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium shadow-xs hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600" onClick={centerRoot}>Recentrer</button>
      </div>
      <footer className="family-tree-mono absolute inset-x-0 bottom-0 z-10 flex h-9 items-center gap-3 border-t border-slate-200 bg-white px-4 font-mono text-[10.5px] text-slate-500">
        <span>{tree.nodes.length} personnes</span><span aria-hidden="true">·</span>
        <span>{generations.length} {generations.length === 1 ? "génération" : "générations"}</span><span aria-hidden="true">·</span>
        <span>{tree.edges.filter((edge) => edge.type === "union").length} {tree.edges.filter((edge) => edge.type === "union").length === 1 ? "union" : "unions"}</span>
        <span className="ml-auto hidden lg:inline">Espace + glisser pour déplacer · molette pour zoomer</span>
      </footer>
    </div>
  );
}
