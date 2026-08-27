"use client";

import { useState } from "react";
import type { FamilyTree } from "@testvibe/core";
import { buildHierarchyRows, generationDisplayNumber, generationSemanticLabel, type HierarchyRow } from "../lib/family-tree-layout";

export interface FamilyTreeMobileListProps {
  tree: FamilyTree;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function MobilePersonCard({ row, compact = false }: { row: HierarchyRow; compact?: boolean }) {
  return (
    <li
      data-testid={`mobile-row-${row.personId}`}
      aria-current={row.isRoot ? "true" : undefined}
      style={{ paddingLeft: 0 }}
      className={`${compact ? "min-w-[143px] shrink-0" : "w-full"} family-tree-sans rounded-[10px] border bg-white px-2.5 py-2 font-sans ${
        row.isRoot ? "border-blue-600 font-semibold text-blue-900 ring-3 ring-blue-100" : "border-slate-200 text-slate-800"
      }`}
    >
      <div className="truncate text-[12px] font-semibold">{row.label}</div>
      {row.birthName ? <div className="truncate text-[10.5px] text-slate-500">Nom de naissance : {row.birthName}</div> : null}
      {row.birthDate ? <div className="family-tree-mono font-mono text-[9.5px] text-slate-500">{formatDate(row.birthDate)}</div> : null}
      {row.isRoot ? <span className="mt-1 inline-block rounded-sm bg-blue-50 px-1.5 font-mono text-[9px] tracking-wider text-blue-700">FOCUS</span> : null}
    </li>
  );
}

export function FamilyTreeMobileList({ tree }: FamilyTreeMobileListProps) {
  const [filter, setFilter] = useState<"nearby" | "ancestors" | "descendants">("nearby");
  const allRows = buildHierarchyRows(tree);
  const rootRow = allRows.find((row) => row.isRoot);
  const rows = allRows.filter((row) => filter === "nearby" || row.isRoot || (filter === "ancestors" ? row.generation < 0 : row.generation > 0));
  const generations = [...new Set(rows.map((row) => row.generation))];

  return (
    <div data-testid="family-tree-mobile-list" className="family-tree-sans overflow-x-hidden bg-white font-sans">
      {rootRow ? (
        <header className="px-4 pb-3 pt-2">
          <h1 className="text-[17px] font-bold leading-tight text-slate-900">{rootRow.label}</h1>
          <p className="family-tree-mono mt-1 font-mono text-[11px] text-slate-500">G{generationDisplayNumber(rootRow.generation)}{rootRow.birthDate ? ` · n. ${formatDate(rootRow.birthDate)}` : ""}</p>
          <div className="mt-3 flex gap-2 overflow-x-auto" role="group" aria-label="Filtrer les relations">
            {([
              ["nearby", "Proches"],
              ["ancestors", "Ascendance"],
              ["descendants", "Descendance"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 rounded-full px-4 text-[11.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${filter === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{label}</button>
            ))}
          </div>
        </header>
      ) : null}
      <div className="space-y-4 border-t border-slate-200 bg-slate-50 p-4">
      {generations.map((generation) => {
        const generationRows = rows.filter((row) => row.generation === generation);
        const root = generationRows.find((row) => row.isRoot);
        const siblings = generationRows.filter((row) => !row.isRoot);
        return (
        <section key={generation} data-testid={`mobile-generation-${generation}`} aria-labelledby={`generation-${generation}`}>
          <h2 id={`generation-${generation}`} className="family-tree-mono mb-2 flex items-baseline gap-2 border-b border-slate-200 pb-1 font-mono text-[9.5px] font-medium tracking-[0.1em] text-slate-500">
            <span>G{generationDisplayNumber(generation)} · {generationSemanticLabel(generation)}</span><span className="ml-auto tracking-normal text-slate-400">{generationRows.length}</span>
          </h2>
          {root ? (
            <div className="space-y-2">
              <ul><MobilePersonCard row={root} /></ul>
              {siblings.length > 0 ? (
                <ul data-testid="mobile-siblings" aria-label="Fratrie" className="flex gap-2 pb-1">
                  {siblings.slice(0, 2).map((row) => <MobilePersonCard key={row.personId} row={row} compact />)}
                  {siblings.length > 2 ? (
                    <li className="family-tree-mono flex min-w-11 items-center justify-center rounded-[10px] border border-dashed border-slate-300 font-mono text-xs text-slate-500" aria-label={`${siblings.length - 2} autres membres de la fratrie`}>
                      +{siblings.length - 2}
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          ) : (
            <ul className={generation < 0 ? "grid grid-cols-2 gap-2" : "flex gap-2 overflow-x-auto"}>
              {generationRows.map((row) => <MobilePersonCard key={row.personId} row={row} compact={generation >= 0} />)}
            </ul>
          )}
        </section>
        );
      })}
      </div>
    </div>
  );
}
