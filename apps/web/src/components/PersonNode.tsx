"use client";

import { memo } from "react";
import Link from "next/link";
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
      className={`family-tree-sans h-[72px] cursor-pointer overflow-hidden rounded-[10px] border font-sans shadow-xs ${data.layoutProfile === "mobile" ? "w-[150px] px-2.5 py-2" : "w-[180px] px-3 py-2.5"} ${
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
      <div className="flex items-start gap-2">
        {genderStyle && (
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] leading-none ${genderStyle.className}`}
            aria-label={`Genre : ${data.gender}`}
          >
            {genderStyle.symbol}
          </span>
        )}
        <span data-testid={`person-name-${data.personId}`} className="truncate text-[13px] font-semibold leading-[1.3]">{data.label}</span>
      </div>
      {data.birthName && (
        <>
          <span className="sr-only">Nom de naissance : {data.birthName}</span>
          <div className="ml-[26px] truncate text-[10.5px] font-normal leading-[1.35] text-slate-500">née {data.birthName}</div>
        </>
      )}
      {hasDates && (
        <div data-testid={`person-dates-${data.personId}`} className="family-tree-mono ml-[26px] truncate font-mono text-[10.5px] font-normal leading-[1.4] text-slate-500">
          {data.birthDate && <span>* {formatDate(data.birthDate)}</span>}
          {data.birthDate && data.deathDate && <span> · </span>}
          {data.deathDate && <span>† {formatDate(data.deathDate)}</span>}
        </div>
      )}
      <Link
        href={`/persons/${data.personId}`}
        className="nodrag nopan sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-1"
        onClick={(event) => event.stopPropagation()}
        aria-label={`Voir la fiche de ${data.label}`}
      >
        Voir la fiche
      </Link>
      <Handle id="bottom" type="source" position={Position.Bottom} />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
