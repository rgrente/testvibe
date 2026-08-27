"use client";

import { memo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from "@xyflow/react";
import type { RoutedFiliationEdgeData, RoutedFiliationTarget } from "../lib/family-tree-layout";

export type FiliationFlowEdge = Edge<RoutedFiliationEdgeData, "filiation">;

const ROLE_ORDER = ["biologique", "adopte", "beau-parent"] as const;
const ROLE_LABELS: Record<string, string> = {
  biologique: "Biologique",
  adopte: "Adopté·e",
  "beau-parent": "Beau-parent",
};

function formatRoles(roles: string[]): string {
  const uniqueRoles = new Set(roles);
  return ROLE_ORDER.filter((role) => uniqueRoles.has(role))
    .map((role) => ROLE_LABELS[role])
    .join(" · ");
}

function RoleTrigger({ target, busY }: { target: RoutedFiliationTarget; busY: number }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [toggled, setToggled] = useState(false);
  const visible = hovered || focused || toggled;
  const roles = formatRoles(target.roles);
  const labelY = (busY + target.y) / 2;

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setToggled((current) => !current);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    setHovered(false);
    setFocused(false);
    setToggled(false);
  };

  return (
    <div
      className="nodrag nopan absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
      style={{ transform: `translate(-50%, -50%) translate(${target.x}px, ${labelY}px)` }}
    >
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-600 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        aria-label={`Afficher les rôles de filiation vers la personne ${target.personId}`}
        aria-expanded={visible}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setToggled(false);
        }}
        onKeyDown={onKeyDown}
        onClick={toggle}
      >
        i
      </button>
      {visible && roles ? (
        <span role="status" className="whitespace-nowrap rounded-sm bg-white px-1.5 py-0.5 text-xs text-slate-700 shadow-sm">
          {roles}
        </span>
      ) : null}
    </div>
  );
}

function FiliationEdgeComponent({ data, style }: EdgeProps<FiliationFlowEdge>) {
  if (!data || data.segments.length === 0) return null;
  const path = data.segments
    .map((segment) => `M ${segment.x1} ${segment.y1} L ${segment.x2} ${segment.y2}`)
    .join(" ");

  return (
    <>
      <BaseEdge path={path} style={{ stroke: "#94a3b8", ...style }} />
      <EdgeLabelRenderer>
        {data.targets.map((target) => (
          <RoleTrigger key={target.personId} target={target} busY={data.bus.y1} />
        ))}
      </EdgeLabelRenderer>
    </>
  );
}

export const FiliationEdge = memo(FiliationEdgeComponent);
