import type { Client } from "@libsql/client";

export interface GenealogyAuditIssue {
  kind: "missing-parent" | "missing-child" | "self-link" | "duplicate-pair" | "cycle";
  ids: number[];
}

/** Audits legacy genealogy rows without mutating the database. */
export async function auditGenealogyIntegrity(client: Client): Promise<GenealogyAuditIssue[]> {
  const people = await client.execute("select id from person");
  const links = await client.execute("select id, parent_id, child_id from filiation order by id");
  const personIds = new Set(people.rows.map((row) => Number(row.id)));
  const rows = links.rows.map((row) => ({
    id: Number(row.id),
    parentId: Number(row.parent_id),
    childId: Number(row.child_id),
  }));
  const issues: GenealogyAuditIssue[] = [];
  const add = (kind: GenealogyAuditIssue["kind"], ids: number[]) => {
    if (ids.length > 0) issues.push({ kind, ids: [...new Set(ids)].sort((a, b) => a - b) });
  };
  add("missing-parent", rows.filter((row) => !personIds.has(row.parentId)).map((row) => row.id));
  add("missing-child", rows.filter((row) => !personIds.has(row.childId)).map((row) => row.id));
  add("self-link", rows.filter((row) => row.parentId === row.childId).map((row) => row.id));
  const byPair = new Map<string, number[]>();
  for (const row of rows) {
    const key = `${row.parentId}:${row.childId}`;
    byPair.set(key, [...(byPair.get(key) ?? []), row.id]);
  }
  add("duplicate-pair", [...byPair.values()].filter((ids) => ids.length > 1).flat());

  const adjacency = new Map<number, Array<{ id: number; childId: number }>>();
  for (const row of rows) adjacency.set(row.parentId, [...(adjacency.get(row.parentId) ?? []), row]);
  const cycleIds = new Set<number>();
  const walk = (origin: number, node: number, path: number[], seen: Set<number>) => {
    for (const edge of adjacency.get(node) ?? []) {
      if (edge.childId === origin) path.concat(edge.id).forEach((id) => cycleIds.add(id));
      if (!seen.has(edge.childId)) walk(origin, edge.childId, path.concat(edge.id), new Set(seen).add(edge.childId));
    }
  };
  for (const row of rows) walk(row.parentId, row.childId, [row.id], new Set([row.parentId, row.childId]));
  add("cycle", [...cycleIds]);
  return issues;
}

export async function assertGenealogyIntegrity(client: Client): Promise<void> {
  const issues = await auditGenealogyIntegrity(client);
  if (issues.length > 0) {
    throw new Error(`Audit généalogique refusé: ${issues.map(({ kind, ids }) => `${kind}=[${ids.join(",")}]`).join("; ")}`);
  }
}
