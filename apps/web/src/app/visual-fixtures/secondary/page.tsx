import type { FamilyAnniversary, Person, UpcomingFamilyAnniversary } from "@testvibe/core";
import { notFound } from "next/navigation";
import GedcomPage from "../../admin/gedcom/page";
import { FamilyAnniversaries } from "../../../components/FamilyAnniversaries";
import { FamilyTreeFanChart } from "../../../components/FamilyTreeFanChart";
import { UpcomingFamilyAnniversaries } from "../../../components/UpcomingFamilyAnniversaries";
import { grenteRenaultTree } from "../../../test-fixtures/grente-renault-tree";
import { SecondaryMapFixture } from "./SecondaryMapFixture";

export const dynamic = "force-dynamic";

type View = "fan" | "statistics" | "map" | "gedcom" | "on-this-day";

const person = (id: number, firstName: string, lastName: string, gender: string): Person => ({
  id, firstName, lastName, gender, birthName: null, birthDate: null, deathDate: null,
});

const martine = person(1, "Martine", "Renault", "F");
const pascal = person(2, "Pascal", "Grente", "M");
const laurence = person(3, "Laurence", "Durand-Moreau", "F");

const anniversaries: FamilyAnniversary[] = [
  { key: "birth-1", eventId: 1, event: { type: "naissance", label: null, eventDate: "1958-08-27", description: null }, person: martine, yearsElapsed: 68 },
  { key: "union-2", eventId: 2, event: { type: "mariage", label: "Union", eventDate: "1988-08-27", description: null }, person: pascal, yearsElapsed: 38 },
];

const upcoming: UpcomingFamilyAnniversary[] = [
  { key: "upcoming-1", type: "naissance", occurrenceDate: "2026-09-12", daysUntil: 16, yearsElapsed: 7, persons: [martine] },
  { key: "upcoming-2", type: "mariage", occurrenceDate: "2026-09-14", daysUntil: 18, yearsElapsed: 38, persons: [pascal, laurence] },
];

function StatisticsFixture() {
  const summaries = [["Personnes", "12"], ["Générations", "3"], ["Événements", "27"], ["Longévité moyenne", "64 ans"]];
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-xl font-bold sm:text-2xl">Statistiques familiales</h1>
      <p className="family-tree-mono mt-1 text-[10.5px] text-[var(--color-muted)]">Famille Grente–Renault</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaries.map(([label, value]) => <div key={label} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-subtle)]"><dd className="text-2xl font-semibold">{value}</dd><dt className="family-tree-mono mt-1 text-[9.5px] uppercase text-[var(--color-muted)]">{label}</dt></div>)}
      </dl>
      <section aria-label="Naissances par décennie" className="mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-subtle)]">
        <h2 className="family-tree-mono text-[9.5px] uppercase tracking-[.1em] text-[var(--color-muted)]">Naissances par décennie</h2>
        <div className="mt-4 flex h-32 items-end gap-3" aria-label="Graphique : 12 naissances réparties sur sept décennies">{[36, 12, 12, 36, 20, 60, 100].map((height, index) => <div key={index} className="flex-1 rounded-t bg-[var(--color-accent)]" style={{ height: `${height}%` }} />)}</div>
        <div className="family-tree-mono mt-2 flex justify-between text-[9px] text-[var(--color-muted)]"><span>1960</span><span>1970</span><span>1980</span><span>1990</span><span>2000</span><span>2010</span><span>2020</span></div>
      </section>
    </main>
  );
}

function OnThisDayFixture() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-xl font-bold sm:text-2xl">Ce jour-là</h1>
      <p className="family-tree-mono mb-5 mt-1 text-[10.5px] text-[var(--color-muted)]">27 août · 2 événements · 2 à venir</p>
      <FamilyAnniversaries anniversaries={anniversaries} />
      <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">À venir · 30 jours</h2><UpcomingFamilyAnniversaries anniversaries={upcoming} /></section>
    </main>
  );
}

export default async function SecondaryVisualFixturePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.TREE_VISUAL_FIXTURE !== "1") notFound();
  const requested = (await searchParams).view;
  const view: View = requested === "statistics" || requested === "map" || requested === "gedcom" || requested === "on-this-day" ? requested : "fan";

  if (view === "fan") return <main data-testid="secondary-fan" className="mx-auto w-full min-w-0 max-w-full overflow-hidden p-4 sm:max-w-5xl sm:p-6"><FamilyTreeFanChart tree={grenteRenaultTree} /></main>;
  if (view === "statistics") return <div data-testid="secondary-statistics"><StatisticsFixture /></div>;
  if (view === "map") return <main data-testid="secondary-map" className="mx-auto max-w-5xl px-4 py-6 sm:px-6"><h1 className="mb-5 text-xl font-bold sm:text-2xl">Carte familiale</h1><SecondaryMapFixture /></main>;
  if (view === "gedcom") return <div data-testid="secondary-gedcom">{await GedcomPage({ searchParams: Promise.resolve({}) })}</div>;
  return <div data-testid="secondary-on-this-day"><OnThisDayFixture /></div>;
}
