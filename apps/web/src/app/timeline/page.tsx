import { getFamilyTimelineForWeb } from "@testvibe/core";
import { FamilyTimeline } from "../../components/FamilyTimeline";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const entries = await getFamilyTimelineForWeb();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900">Timeline familiale</h1>
      <p className="mb-8 mt-2 text-slate-600">
        Les événements de toutes les personnes, classés chronologiquement.
      </p>
      <FamilyTimeline entries={entries} />
    </main>
  );
}
