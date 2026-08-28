"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { FamilyTree } from "@testvibe/core";
import { FamilyTreeCanvas } from "./FamilyTreeCanvas";
import { FamilyTreeMobileList } from "./FamilyTreeMobileList";
import { FamilyTreeFanChart } from "./FamilyTreeFanChart";
import { SharedToolbar } from "./SharedToolbar";

type FamilyTreeView = "tree" | "list" | "fan";
const STORAGE_KEY = "family-tree-view";
const LEGACY_STORAGE_KEY = "family-tree-mobile-view";

export function FamilyTreeViews({ tree }: { tree: FamilyTree }) {
  const [view, setView] = useState<FamilyTreeView>("tree");
  const [generationDepth, setGenerationDepth] = useState<number | null>(3);
  const [mobileCanvasOpen, setMobileCanvasOpen] = useState(false);

  const visibleTree = useMemo((): FamilyTree => {
    if (generationDepth === null) return tree;
    const visibleGenerations = new Set(
      [...new Set(tree.nodes.map((node) => node.generation))]
        .sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)
        .slice(0, generationDepth),
    );
    const nodes = tree.nodes.filter((node) => visibleGenerations.has(node.generation));
    const personIds = new Set(nodes.map((node) => node.person.id));
    const edges = tree.edges.filter((edge) => edge.type === "filiation"
      ? personIds.has(edge.parentId) && personIds.has(edge.childId)
      : edge.personIds.every((personId) => personIds.has(personId)));
    return { ...tree, nodes, edges };
  }, [generationDepth, tree]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved === "tree" || saved === "list" || saved === "fan") {
      setView(saved);
      window.localStorage.setItem(STORAGE_KEY, saved);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }, []);

  const chooseView = (nextView: FamilyTreeView) => {
    setView(nextView);
    setMobileCanvasOpen(false);
    window.localStorage.setItem(STORAGE_KEY, nextView);
  };

  return (
    <>
      <SharedToolbar label="Mode d’affichage" className="mb-3 rounded-[var(--radius-md)]">
        {(["tree", "list", "fan"] as const).map((option) => (
          <button key={option} type="button" className={`rounded-md px-4 text-sm font-medium ${view === option ? "bg-slate-800 text-white" : "text-slate-700 hover:bg-slate-50"}`} aria-pressed={view === option} onClick={() => chooseView(option)}>
            {option === "tree" ? "Arbre" : option === "list" ? "Liste" : "Éventail"}
          </button>
        ))}
      </SharedToolbar>
      {view === "tree" ? (
        <SharedToolbar label="Profondeur de l’arbre" className="mb-3 hidden md:flex">
          <span key="depth-label" className="family-tree-mono mr-1 font-mono text-[9.5px] tracking-[0.09em] text-slate-500">GÉNÉRATIONS</span>
          {([2, 3, 4] as const).map((depth) => (
            <button key={depth} type="button" aria-label={`Afficher ${depth} générations`} aria-pressed={generationDepth === depth} onClick={() => setGenerationDepth(depth)} className={`min-h-11 min-w-11 rounded-md font-mono text-xs focus-visible:outline-2 focus-visible:outline-blue-600 ${generationDepth === depth ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{depth}</button>
          ))}
          <button key="depth-all" type="button" aria-label="Afficher tout l’arbre" aria-pressed={generationDepth === null} onClick={() => setGenerationDepth(null)} className={`min-h-11 rounded-md px-3 font-mono text-xs focus-visible:outline-2 focus-visible:outline-blue-600 ${generationDepth === null ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Tout</button>
          <Link key="add-person" href="/admin/persons" aria-label="Ajouter une personne" className="ml-auto flex min-h-11 items-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">+ Personne</Link>
        </SharedToolbar>
      ) : null}
      {view === "tree" ? (
        <>
          <FamilyTreeCanvas tree={visibleTree} profile="desktop" className="hidden md:block" />
          <div className="md:hidden">
            <button
              type="button"
              className="mb-3 min-h-11 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              onClick={() => setMobileCanvasOpen((open) => !open)}
            >
              {mobileCanvasOpen ? "Revenir à la vue mobile" : "Ouvrir le canevas interactif"}
            </button>
            {mobileCanvasOpen
              ? <FamilyTreeCanvas tree={visibleTree} profile="mobile" />
              : <FamilyTreeMobileList tree={tree} />}
          </div>
        </>
      ) : view === "list" ? <FamilyTreeMobileList tree={tree} /> : <FamilyTreeFanChart tree={tree} />}
    </>
  );
}
