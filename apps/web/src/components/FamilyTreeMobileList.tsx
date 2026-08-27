import type { FamilyTree } from "@testvibe/core";
import { buildHierarchyRows } from "../lib/family-tree-layout";

export interface FamilyTreeMobileListProps {
  tree: FamilyTree;
}

/**
 * Alternative linéaire et accessible à la vue graphique mobile.
 */
export function FamilyTreeMobileList({ tree }: FamilyTreeMobileListProps) {
  const rows = buildHierarchyRows(tree);
  const generations = [...new Set(rows.map((row) => row.generation))];

  return (
    <div data-testid="family-tree-mobile-list" className="space-y-4">
      {generations.map((generation) => (
        <section key={generation} aria-labelledby={`generation-${generation}`}>
          <h2 id={`generation-${generation}`} className="mb-2 text-sm font-semibold text-slate-700">
            Génération {generation}
          </h2>
          <ul className="space-y-1">
            {rows.filter((row) => row.generation === generation).map((row) => (
              <li
                key={row.personId}
                data-testid={`mobile-row-${row.personId}`}
                style={{ paddingLeft: 0 }}
                className={`rounded-sm border px-3 py-2 text-sm ${
                  row.isRoot
                    ? "border-blue-600 bg-blue-50 font-semibold text-blue-900"
                    : "border-slate-200 bg-white text-slate-800"
                }`}
              >
                <div>{row.label}</div>
                {row.birthName ? (
                  <div className="text-xs font-normal text-slate-500">Nom de naissance : {row.birthName}</div>
                ) : null}
                {row.isRoot ? <span className="ml-2 text-xs text-blue-600">(racine)</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
