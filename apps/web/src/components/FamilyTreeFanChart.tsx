"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { FamilyTree } from "@testvibe/core";
import { buildRadialLayout } from "../lib/family-tree-radial-layout";

export function FamilyTreeFanChart({ tree }: { tree: FamilyTree }) {
  const router = useRouter();
  const layout = useMemo(() => buildRadialLayout(tree), [tree]);
  const positions = new Map(layout.nodes.map((node) => [node.personId, node]));

  return (
    <div
      className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
      data-testid="family-tree-fan-chart"
      tabIndex={0}
      aria-label="Éventail des ancêtres défilable horizontalement"
    >
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="min-h-[440px] min-w-[720px] w-full" role="img" aria-labelledby="fan-chart-title fan-chart-description">
        <title id="fan-chart-title">Éventail des ancêtres</title>
        <desc id="fan-chart-description">La personne racine est au centre, ses ancêtres sont répartis par génération.</desc>
        <g stroke="#cbd5e1" strokeWidth="2" fill="none">
          {layout.links.map((link) => {
            const parent = positions.get(link.parentId)!;
            const child = positions.get(link.childId)!;
            return <line key={`${link.parentId}-${link.childId}`} x1={child.x} y1={child.y} x2={parent.x} y2={parent.y} />;
          })}
        </g>
        {layout.nodes.map((node) => {
          const dates = [node.birthDate?.slice(0, 4), node.deathDate?.slice(0, 4)].filter(Boolean).join(" – ");
          return (
            <g key={node.personId} transform={`translate(${node.x}, ${node.y})`} role="link" tabIndex={0} aria-label={`${node.label}${node.isRoot ? ", personne racine" : `, génération ${node.generation}`}`} className="cursor-pointer focus:outline-hidden focus-visible:outline-2 focus-visible:outline-blue-500" onClick={() => router.push(`/?personId=${node.personId}`)} onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                router.push(`/?personId=${node.personId}`);
              }
            }}>
              <rect x="-62" y="-25" width="124" height="50" rx="8" fill={node.isRoot ? "#eff6ff" : "white"} stroke={node.isRoot ? "#2563eb" : "#94a3b8"} strokeWidth={node.isRoot ? 3 : 1.5} />
              <text textAnchor="middle" y={dates ? -3 : 5} className="fill-slate-900 text-[13px] font-semibold">{node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}</text>
              {dates ? <text textAnchor="middle" y="15" className="fill-slate-500 text-[11px]">{dates}</text> : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
