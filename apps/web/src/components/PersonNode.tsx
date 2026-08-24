"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PersonFlowNode } from "../lib/family-tree-layout";

const GENDER_STYLES: Record<string, { symbol: string; className: string }> = {
  M: { symbol: "♂", className: "border-sky-300 bg-sky-50 text-sky-700" },
  F: { symbol: "♀", className: "border-rose-300 bg-rose-50 text-rose-700" },
  autre: { symbol: "⚧", className: "border-violet-300 bg-violet-50 text-violet-700" },
};

/** Convertit une date ISO (YYYY-MM-DD) en format français ; laisse les autres formats tels quels. */
function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/**
 * Rendu d'une Person dans le canevas react-flow (vue desktop de
 * l'arbre généalogique). La racine est mise en évidence visuellement,
 * le genre par un badge coloré, et les dates de naissance/décès
 * apparaissent en sous-titre lorsqu'elles sont renseignées.
 */
function PersonNodeComponent({ data }: NodeProps<PersonFlowNode>) {
  const genderStyle = data.gender ? GENDER_STYLES[data.gender] : undefined;
  const hasDates = Boolean(data.birthDate || data.deathDate);

  return (
    <div
      data-testid={`person-node-${data.personId}`}
      className={`cursor-pointer rounded-lg border px-4 py-2 text-sm shadow-sm ${
        data.isRoot
          ? "border-blue-600 bg-blue-50 font-semibold text-blue-900"
          : "border-slate-300 bg-white text-slate-800"
      }`}
    >
      <Handle id="top" type="target" position={Position.Top} />
      {/* Offset fixe (plutôt que le centrage vertical par défaut, qui varie
          selon la présence de la ligne de dates) pour aligner horizontalement
          le lien d'union avec le point de jonction, quel que soit le contenu. */}
      <Handle id="left" type="source" position={Position.Left} style={{ top: 20 }} />
      <Handle id="right" type="source" position={Position.Right} style={{ top: 20 }} />
      <div className="flex items-center gap-1.5">
        {genderStyle && (
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] leading-none ${genderStyle.className}`}
            aria-label={`Genre : ${data.gender}`}
          >
            {genderStyle.symbol}
          </span>
        )}
        <span>{data.label}</span>
      </div>
      {data.birthName && (
        <div className="mt-0.5 text-xs font-normal text-slate-500">
          Nom de naissance : {data.birthName}
        </div>
      )}
      {hasDates && (
        <div className="mt-0.5 text-xs font-normal text-slate-500">
          {data.birthDate && <span>* {formatDate(data.birthDate)}</span>}
          {data.birthDate && data.deathDate && <span> · </span>}
          {data.deathDate && <span>† {formatDate(data.deathDate)}</span>}
        </div>
      )}
      <Handle id="bottom" type="source" position={Position.Bottom} />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
