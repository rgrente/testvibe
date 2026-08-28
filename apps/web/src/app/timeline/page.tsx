import { getComparativeTimelineForWeb, getFamilyTreeForWeb, listAllPersonsForWeb } from "@testvibe/core";
import { ComparativeTimeline } from "../../components/ComparativeTimeline";
import { TimelineControls } from "../../components/TimelineControls";
import { selectAncestorTimeline } from "../../lib/ancestor-timeline";
import { summarizeComparativeTimeline, type TimelineLayers } from "../../lib/comparative-timeline";

export const dynamic = "force-dynamic";

export default async function TimelinePage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ personId?: string; generations?: string; persons?: string; events?: string; generationLayer?: string }> } = {}) {
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
  const layers: TimelineLayers = {
    persons: params.persons !== "0",
    events: params.events !== "0",
    generations: params.generationLayer !== "0",
  };
  const nowYear = new Date().getUTCFullYear();
  const summary = summarizeComparativeTimeline(rows, nowYear);
  const personLabel = `personne${summary.personCount > 1 ? "s" : ""}`;
  const eventLabel = `événement${summary.eventCount === 1 ? "" : "s"}`;
  const summaryText = summary.startYear === null || summary.endYear === null
    ? `${summary.personCount} ${personLabel} · ${summary.eventCount} ${eventLabel}`
    : `${summary.startYear} → ${summary.endYear} · ${summary.personCount} ${personLabel} · ${summary.eventCount} ${eventLabel}`;

  return (
    <main className="page-container-wide page-container-timeline min-w-0 py-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-slate-950">Chronologie familiale</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">{summaryText}</p>
      </header>
      {rootId !== undefined && <TimelineControls persons={persons} selectedId={rootId} generations={generations} layers={layers} />}
      <ComparativeTimeline rows={rows} connections={selection?.connections} branchByPersonId={selection?.branchByPersonId} generationByPersonId={selection?.generationByPersonId} layers={layers} preserveRowOrder nowYear={nowYear} />
    </main>
  );
}
