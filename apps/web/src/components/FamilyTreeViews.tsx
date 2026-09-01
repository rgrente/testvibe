"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { FamilyTree } from "@testvibe/core";
import { FamilyTreeCanvas } from "./FamilyTreeCanvas";
import { FamilyTreeMobileList } from "./FamilyTreeMobileList";
import { FamilyTreeFanChart } from "./FamilyTreeFanChart";
import { SharedToolbar } from "./SharedToolbar";

type FamilyTreeView = "tree" | "list" | "fan";
const STORAGE_KEY = "family-tree-view";
const LEGACY_STORAGE_KEY = "family-tree-mobile-view";

export function FamilyTreeViews({ tree, initialView = "tree", fanPersonRoute, rootControl }: { tree: FamilyTree; initialView?: FamilyTreeView; fanPersonRoute?: string; rootControl?: ReactNode }) {
  const [view, setView] = useState<FamilyTreeView>(initialView);
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
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-canvas)] p-3 md:flex-nowrap" role="group" aria-label="Contrôles de l’arbre">
        {rootControl}
        <SharedToolbar label="Mode d’affichage" className="min-w-0 flex-wrap rounded-[var(--radius-md)] sm:flex-nowrap">
          {(["tree", "list", "fan"] as const).map((option) => (
            <button key={option} type="button" className={`rounded-md px-4 text-sm font-medium ${view === option ? "bg-slate-800 text-white" : "text-slate-700 hover:bg-slate-50"}`} aria-pressed={view === option} onClick={() => chooseView(option)}>
              {option === "tree" ? "Arbre" : option === "list" ? "Liste" : "Éventail"}
            </button>
          ))}
        </SharedToolbar>
      </div>
      {view === "tree" ? (
        <SharedToolbar label="Profondeur de l’arbre" compact className="mb-3 hidden w-full min-w-0 flex-nowrap md:flex">
          <span key="depth-label" className="family-tree-mono flex shrink-0 items-center font-mono text-[9.5px] tracking-[0.09em] text-slate-500">GÉNÉRATIONS</span>
          {([2, 3, 4] as const).map((depth) => (
            <button key={depth} type="button" aria-label={`Afficher ${depth} générations`} aria-pressed={generationDepth === depth} onClick={() => setGenerationDepth(depth)} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md font-mono text-xs focus-visible:outline-2 focus-visible:outline-blue-600">
              <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded ${generationDepth === depth ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{depth}</span>
            </button>
          ))}
          <button key="depth-all" type="button" aria-label="Afficher tout l’arbre" aria-pressed={generationDepth === null} onClick={() => setGenerationDepth(null)} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md font-mono text-xs focus-visible:outline-2 focus-visible:outline-blue-600">
            <span className={`inline-flex h-7 items-center rounded px-2 ${generationDepth === null ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>Tout</span>
          </button>
          <Link key="add-person" href="/admin/persons" aria-label="Ajouter une personne" className="ml-auto flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            <span className="inline-flex h-7 items-center rounded bg-blue-600 px-2 text-white">+ Personne</span>
          </Link>
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
      ) : view === "list" ? <FamilyTreeMobileList tree={tree} /> : <FamilyTreeFanChart tree={tree} personRoute={fanPersonRoute} />}
    </>
  );
}
