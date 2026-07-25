"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { UnionJunctionNodeData } from "../lib/family-tree-layout";

/**
 * Point de jonction discret représentant une Union dans le canevas
 * react-flow : les deux partenaires s'y relient, et les Filiation vers
 * leurs enfants communs en repartent, pour éviter un trait dupliqué
 * par parent vers chaque enfant.
 */
function UnionJunctionNodeComponent({ data }: NodeProps<UnionJunctionNodeData>) {
  return (
    <div
      data-testid={`union-junction-${data.unionId}`}
      className="h-2 w-2 rounded-full bg-slate-300"
    >
      <Handle
        id="target-left"
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-none !bg-transparent"
      />
      <Handle
        id="target-right"
        type="target"
        position={Position.Right}
        className="!h-2 !w-2 !border-none !bg-transparent"
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-none !bg-transparent"
      />
    </div>
  );
}

export const UnionJunctionNode = memo(UnionJunctionNodeComponent);
