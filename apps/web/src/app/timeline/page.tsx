import { getComparativeTimelineForWeb, getFamilyTreeForWeb, listAllPersonsForWeb } from "@testvibe/core";
import { ComparativeTimeline } from "../../components/ComparativeTimeline";
import { TimelineControls } from "../../components/TimelineControls";
import { selectAncestorTimeline } from "../../lib/ancestor-timeline";

export const dynamic = "force-dynamic";

export default async function TimelinePage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ personId?: string; generations?: string }> } = {}) {
  const params = await searchParams;
  const [allRows, persons] = await Promise.all([getComparativeTimelineForWeb(), listAllPersonsForWeb()]);
  const requestedId = Number(params.personId);
  const rootId = persons.some((person) => person.id === requestedId) ? requestedId : persons[0]?.id;
  const requestedGenerations = Number(params.generations);
  const generations = Number.isInteger(requestedGenerations) && params.generations !== undefined
    ? Math.min(6, Math.max(1, requestedGenerations))
    : 4;
  const tree = rootId === undefined ? null : await getFamilyTreeForWeb(rootId);
  const selection = tree ? selectAncestorTimeline(tree, generations) : null;
  const rowsById = new Map(allRows.map((row) => [row.person.id, row]));
  const rows = selection ? selection.personIds.map((id) => rowsById.get(id)).filter((row): row is NonNullable<typeof row> => row !== undefined) : [];

  return (
    <main className="page-container-wide page-container-timeline min-w-0 py-8">
      <h1 className="text-3xl font-bold text-slate-900">Timeline comparative</h1>
      <p className="mb-8 mt-2 text-slate-600">
        Comparez les durées de vie de la personne choisie et de ses ascendants sur une même échelle chronologique.
      </p>
      {rootId !== undefined && <TimelineControls persons={persons} selectedId={rootId} generations={generations} />}
      <ComparativeTimeline rows={rows} connections={selection?.connections} branchByPersonId={selection?.branchByPersonId} preserveRowOrder />
    </main>
  );
}
