import { getComparativeTimelineForWeb } from "@testvibe/core";
import { ComparativeTimeline } from "../../components/ComparativeTimeline";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const rows = await getComparativeTimelineForWeb();

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Timeline comparative</h1>
      <p className="mb-8 mt-2 text-slate-600">
        Comparez les durées de vie et les événements de chaque personne sur une même échelle chronologique.
      </p>
      <ComparativeTimeline rows={rows} />
    </main>
  );
}
