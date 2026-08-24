"use client";

import { useEffect, useState } from "react";
import type { FamilyTree } from "@testvibe/core";
import { FamilyTreeCanvas } from "./FamilyTreeCanvas";
import { FamilyTreeMobileList } from "./FamilyTreeMobileList";

type MobileView = "tree" | "list";
const STORAGE_KEY = "family-tree-mobile-view";

export function FamilyTreeViews({ tree }: { tree: FamilyTree }) {
  const [mobileView, setMobileView] = useState<MobileView>("tree");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "tree" || saved === "list") setMobileView(saved);
  }, []);

  const chooseView = (view: MobileView) => {
    setMobileView(view);
    window.localStorage.setItem(STORAGE_KEY, view);
  };

  return (
    <>
      <div className="mb-3 md:hidden">
        <div className="inline-flex rounded-lg border border-slate-300 p-1" role="group" aria-label="Mode d’affichage">
          {(["tree", "list"] as const).map((view) => (
            <button key={view} type="button" className={`min-h-11 rounded-md px-4 text-sm font-medium ${mobileView === view ? "bg-slate-800 text-white" : "text-slate-700 hover:bg-slate-50"}`} aria-pressed={mobileView === view} onClick={() => chooseView(view)}>
              {view === "tree" ? "Arbre" : "Liste"}
            </button>
          ))}
        </div>
      </div>
      <FamilyTreeCanvas tree={tree} profile="desktop" className="hidden md:block" />
      <div className="md:hidden">
        {mobileView === "tree" ? <FamilyTreeCanvas tree={tree} profile="mobile" /> : <FamilyTreeMobileList tree={tree} />}
      </div>
    </>
  );
}
