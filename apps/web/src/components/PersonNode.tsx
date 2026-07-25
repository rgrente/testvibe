"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";

export interface PersonNodeData {
  personId: number;
  label: string;
  isRoot: boolean;
  generation: number;
}

/**
 * Rendu d'une Person dans le canevas react-flow (vue desktop de
 * l'arbre généalogique). La racine est mise en évidence visuellement.
 */
function PersonNodeComponent({ data }: NodeProps<PersonNodeData>) {
  return (
    <div
      data-testid={`person-node-${data.personId}`}
      className={`rounded-lg border px-4 py-2 text-sm shadow-sm ${
        data.isRoot
          ? "border-blue-600 bg-blue-50 font-semibold text-blue-900"
          : "border-slate-300 bg-white text-slate-800"
      }`}
    >
      <Handle type="target" position={Position.Top} />
      {data.label}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
