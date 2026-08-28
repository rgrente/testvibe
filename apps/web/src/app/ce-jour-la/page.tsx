import { getFamilyAnniversariesForWeb, getUpcomingFamilyAnniversariesForWeb, isCompleteCalendarDate, localCalendarDate, type FamilyAnniversary, type UpcomingFamilyAnniversary } from "@testvibe/core";
import Link from "next/link";
import { FamilyAnniversaries } from "../../components/FamilyAnniversaries";
import { UpcomingFamilyAnniversaries } from "../../components/UpcomingFamilyAnniversaries";

export const dynamic = "force-dynamic";
const UPCOMING_DAYS = 30;

interface OnThisDayViewProps {
  date: string;
  today: string;
  formattedDate: string;
  anniversaries: FamilyAnniversary[];
  upcomingAnniversaries: UpcomingFamilyAnniversary[];
}

export function OnThisDayView({ date, today, formattedDate, anniversaries, upcomingAnniversaries }: OnThisDayViewProps) {
  return (
    <main data-testid="on-this-day-page" className="page-container py-6 sm:py-8">
      <h1 className="text-xl font-bold text-[var(--color-ink)] sm:text-2xl">Ce jour-là dans la famille</h1>
      <p className="family-tree-mono mb-6 mt-1 text-[10.5px] text-[var(--color-muted)]">Anniversaires du {formattedDate}.</p>
      <form method="GET" className="mb-6 flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
        <label className="text-sm font-medium text-slate-700">Parcourir une autre date
          <input name="date" type="date" defaultValue={date} className="mt-1 block min-h-11 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]" />
        </label>
        <button type="submit" className="min-h-11 rounded-[var(--radius-md)] bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">Afficher</button>
        {date !== today && <Link href="/ce-jour-la" className="inline-flex min-h-11 items-center py-2 text-sm text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">Revenir à aujourd’hui</Link>}
      </form>
      <FamilyAnniversaries anniversaries={anniversaries} />
      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-slate-900">Prochains anniversaires</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">Naissances et mariages dans les {UPCOMING_DAYS} prochains jours.</p>
        <UpcomingFamilyAnniversaries anniversaries={upcomingAnniversaries} />
      </section>
      <p className="mt-6 text-xs text-slate-500">Les dates incomplètes ou approximatives sont exclues. Les anniversaires du 29 février sont affichés le 28 février les années non bissextiles.</p>
    </main>
  );
}

export default async function OnThisDayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const timeZone = process.env.FAMILY_TIME_ZONE ?? "Europe/Paris";
  const today = localCalendarDate(new Date(), timeZone);
  const requestedDate = (await searchParams).date;
  const date = requestedDate && isCompleteCalendarDate(requestedDate) ? requestedDate : today;
  const [anniversaries, upcomingAnniversaries] = await Promise.all([
    getFamilyAnniversariesForWeb(date),
    getUpcomingFamilyAnniversariesForWeb(date, UPCOMING_DAYS),
  ]);
  const formattedDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

  return <OnThisDayView date={date} today={today} formattedDate={formattedDate} anniversaries={anniversaries} upcomingAnniversaries={upcomingAnniversaries} />;
}
