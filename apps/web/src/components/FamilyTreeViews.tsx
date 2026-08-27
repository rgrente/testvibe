"use client";

import { useEffect, useState } from "react";
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
        <><FamilyTreeCanvas tree={tree} profile="desktop" className="hidden md:block" /><div className="md:hidden"><FamilyTreeMobileList tree={tree} /></div></>
      ) : view === "list" ? <FamilyTreeMobileList tree={tree} /> : <FamilyTreeFanChart tree={tree} />}
    </>
  );
}
