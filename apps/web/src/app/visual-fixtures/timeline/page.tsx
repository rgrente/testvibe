import { notFound } from "next/navigation";
import { ComparativeTimeline } from "../../../components/ComparativeTimeline";
import { TimelineControls } from "../../../components/TimelineControls";
import { grenteRenaultTimeline, timelineGenerations } from "../../../test-fixtures/grente-renault-timeline";

export const dynamic = "force-dynamic";

export default function TimelineVisualFixturePage() {
  if (process.env.TREE_VISUAL_FIXTURE !== "1") notFound();

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-slate-950">Chronologie familiale</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">1960 → 2030 · 12 personnes · 27 événements</p>
      </header>
      <TimelineControls
        persons={grenteRenaultTimeline.map(({ person }) => person)}
        selectedId={7}
        generations={3}
        layers={{ persons: true, events: true, generations: true }}
      />
      <ComparativeTimeline
        rows={grenteRenaultTimeline}
        generationByPersonId={timelineGenerations}
        preserveRowOrder
        nowYear={2026}
      />
    </main>
  );
}
