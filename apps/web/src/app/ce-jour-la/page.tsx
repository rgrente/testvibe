import { getFamilyAnniversariesForWeb, isCompleteCalendarDate, localCalendarDate } from "@testvibe/core";
import Link from "next/link";
import { FamilyAnniversaries } from "../../components/FamilyAnniversaries";

export const dynamic = "force-dynamic";
export default async function OnThisDayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const timeZone = process.env.FAMILY_TIME_ZONE ?? "Europe/Paris";
  const today = localCalendarDate(new Date(), timeZone);
  const requestedDate = (await searchParams).date;
  const date = requestedDate && isCompleteCalendarDate(requestedDate) ? requestedDate : today;
  const anniversaries = await getFamilyAnniversariesForWeb(date);
  const formattedDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900">Ce jour-là dans la famille</h1>
      <p className="mb-6 mt-2 text-slate-600">Anniversaires du {formattedDate}.</p>
      <form method="GET" className="mb-8 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-slate-700">Parcourir une autre date
          <input name="date" type="date" defaultValue={date} className="mt-1 block rounded-sm border border-slate-300 px-3 py-2" />
        </label>
        <button type="submit" className="rounded-sm bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Afficher</button>
        {date !== today && <Link href="/ce-jour-la" className="py-2 text-sm text-blue-700 hover:underline">Revenir à aujourd’hui</Link>}
      </form>
      <FamilyAnniversaries anniversaries={anniversaries} />
      <p className="mt-6 text-xs text-slate-500">Les dates incomplètes ou approximatives sont exclues. Les anniversaires du 29 février sont affichés le 28 février les années non bissextiles.</p>
    </main>
  );
}
