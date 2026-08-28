import type { FamilyAnniversary, Person, UpcomingFamilyAnniversary } from "@testvibe/core";
import { notFound } from "next/navigation";
import GedcomPage from "../../admin/gedcom/page";
import { OnThisDayView } from "../../ce-jour-la/page";
import { StatisticsView } from "../../statistiques/page";
import { FamilyTreeViews } from "../../../components/FamilyTreeViews";
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

const statistics = {
  totals: { persons: 12, unions: 4, events: 27, generations: 3 },
  agePyramid: [{ decade: 60, women: 2, men: 1, other: 0 }, { decade: 30, women: 2, men: 2, other: 0 }],
  averageLongevity: 64,
  topFirstNames: [{ label: "Martine", count: 2 }],
  topBirthPlaces: [{ label: "Rennes", count: 5 }],
  topResidencePlaces: [{ label: "Vitré", count: 3 }],
};

export default async function SecondaryVisualFixturePage({ searchParams }: { searchParams: Promise<{ view?: string; state?: string }> }) {
  if (process.env.TREE_VISUAL_FIXTURE !== "1") notFound();
  const params = await searchParams;
  const requested = params.view;
  const empty = params.state === "empty";
  const view: View = requested === "statistics" || requested === "map" || requested === "gedcom" || requested === "on-this-day" ? requested : "fan";

  if (view === "fan") return <main data-testid="secondary-fan" className="mx-auto w-full min-w-0 max-w-full overflow-hidden p-4 sm:max-w-5xl sm:p-6"><FamilyTreeViews tree={grenteRenaultTree} initialView="fan" fanPersonRoute="/visual-fixtures/secondary" /></main>;
  if (view === "statistics") return <div data-testid="secondary-statistics"><StatisticsView statistics={empty ? { ...statistics, totals: { persons: 0, unions: 0, events: 0, generations: 0 } } : statistics} /></div>;
  if (view === "map") return <main data-testid="secondary-map" className="mx-auto max-w-5xl px-4 py-6 sm:px-6"><h1 className="mb-5 text-xl font-bold sm:text-2xl">Carte familiale</h1><SecondaryMapFixture empty={empty} /></main>;
  if (view === "gedcom") return <div data-testid="secondary-gedcom">{await GedcomPage({ searchParams: Promise.resolve(params.state === "error" ? { error: "import_echoue", detail: "Ligne invalide" } : {}) })}</div>;
  return <div data-testid="secondary-on-this-day"><OnThisDayView date="2026-08-27" today="2026-08-28" formattedDate="27 août 2026" anniversaries={empty ? [] : anniversaries} upcomingAnniversaries={empty ? [] : upcoming} /></div>;
}
