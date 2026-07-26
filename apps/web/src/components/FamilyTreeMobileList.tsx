import type { FamilyTree } from "@testvibe/core";
import { buildHierarchyRows } from "../lib/family-tree-layout";

export interface FamilyTreeMobileListProps {
  tree: FamilyTree;
}

/**
 * Vue mobile simplifiée de l'arbre généalogique : liste hiérarchique
 * indentée (sans pan/zoom), affichée uniquement sur petits écrans —
 * react-flow n'est pas adapté au tactile sur un écran étroit.
 */
export function FamilyTreeMobileList({ tree }: FamilyTreeMobileListProps) {
  const rows = buildHierarchyRows(tree);

  return (
    <ul data-testid="family-tree-mobile-list" className="block space-y-1 md:hidden">
      {rows.map((row) => (
        <li
          key={row.personId}
          data-testid={`mobile-row-${row.personId}`}
          style={{ paddingLeft: `${row.depth * 1.25}rem` }}
          className={`rounded border px-3 py-2 text-sm ${
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
  );
}
