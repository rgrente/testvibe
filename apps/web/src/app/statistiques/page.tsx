import { getFamilyStatisticsForWeb, type RankedStatistic } from "@testvibe/core";

export const dynamic = "force-dynamic";

function Ranking({ title, items }: { title: string; items: RankedStatistic[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Aucune donnée disponible</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((item, index) => (
            <li key={item.label} className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-700"><span className="mr-2 text-slate-400">#{index + 1}</span>{item.label}</span>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">{item.count}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export default async function StatisticsPage() {
  const statistics = await getFamilyStatisticsForWeb();
  const { totals } = statistics;

  return (
    <main className="page-container py-8">
      <h1 className="text-3xl font-bold text-slate-900">Statistiques familiales</h1>
      <p className="mt-2 text-slate-600">Un coup d’œil ludique sur l’ensemble de votre arbre familial.</p>

      {totals.persons === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <h2 className="text-xl font-semibold text-slate-800">Aucune donnée familiale</h2>
          <p className="mt-2 text-slate-500">Ajoutez des personnes pour découvrir les statistiques de votre famille.</p>
        </section>
      ) : (
        <>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Personnes", totals.persons],
              ["Unions", totals.unions],
              ["Événements", totals.events],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-5 text-white shadow-sm">
                <dt className="text-sm text-violet-100">{label}</dt>
                <dd className="mt-1 text-3xl font-bold">{value}</dd>
              </div>
            ))}
            <div className="rounded-2xl bg-amber-100 p-5 text-amber-950">
              <dt className="text-sm text-amber-700">Profondeur</dt>
              <dd className="mt-2 font-bold">{plural(totals.generations, "génération", "générations")}</dd>
            </div>
            <div className="rounded-2xl bg-emerald-100 p-5 text-emerald-950">
              <dt className="text-sm text-emerald-700">Longévité moyenne</dt>
              <dd className="mt-2 font-bold">{statistics.averageLongevity === null ? "Non calculable" : `${statistics.averageLongevity.toLocaleString("fr-FR", { minimumFractionDigits: 1 })} ans`}</dd>
            </div>
          </dl>

          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Pyramide des âges</h2>
            {statistics.agePyramid.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Aucune donnée disponible</p>
            ) : (
              <ul className="mt-5 space-y-4">
                {statistics.agePyramid.map((bucket) => {
                  const count = bucket.women + bucket.men + bucket.other;
                  return (
                    <li key={bucket.decade}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <strong className="text-slate-800">{bucket.decade}–{bucket.decade + 9} ans</strong>
                        <span className="text-sm text-slate-500">
                          {plural(bucket.women, "femme", "femmes")} · {plural(bucket.men, "homme", "hommes")} · {bucket.other} autre
                        </span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100" aria-label={`${count} personnes`}>
                        <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500" style={{ width: `${Math.max(8, count * 12)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <Ranking title="Prénoms fréquents" items={statistics.topFirstNames} />
            <Ranking title="Lieux de naissance" items={statistics.topBirthPlaces} />
            <Ranking title="Lieux de résidence" items={statistics.topResidencePlaces} />
          </div>
        </>
      )}
    </main>
  );
}
