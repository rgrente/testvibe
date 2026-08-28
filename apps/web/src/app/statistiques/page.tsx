import { getFamilyStatisticsForWeb, type FamilyStatistics, type RankedStatistic } from "@testvibe/core";

export const dynamic = "force-dynamic";

function Ranking({ title, items }: { title: string; items: RankedStatistic[] }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-subtle)]">
      <h2 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Aucune donnée disponible</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {items.map((item, index) => (
            <li key={item.label} className="flex items-center justify-between gap-4">
              <span className="font-medium text-slate-700"><span className="mr-2 text-slate-600">#{index + 1}</span>{item.label}</span>
              <span className="family-tree-mono rounded-[var(--radius-sm)] bg-[var(--color-canvas)] px-2 py-1 text-xs font-semibold text-[var(--color-ink)]">{item.count}</span>
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

export function StatisticsView({ statistics }: { statistics: FamilyStatistics }) {
  const { totals } = statistics;

  return (
    <main className="page-container py-6 sm:py-8">
      <h1 className="text-xl font-bold text-[var(--color-ink)] sm:text-2xl">Statistiques familiales</h1>
      <p className="family-tree-mono mt-1 text-[10.5px] text-[var(--color-muted)]">Vue d’ensemble de votre arbre familial.</p>

      {totals.persons === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <h2 className="text-xl font-semibold text-slate-800">Aucune donnée familiale</h2>
          <p className="mt-2 text-slate-500">Ajoutez des personnes pour découvrir les statistiques de votre famille.</p>
        </section>
      ) : (
        <>
          <dl data-testid="statistics-summary" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {[
              ["Personnes", totals.persons],
              ["Unions", totals.unions],
              ["Événements", totals.events],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-subtle)]">
                <dd className="text-2xl font-semibold text-[var(--color-ink)]">{value}</dd>
                <dt className="family-tree-mono mt-1 text-[9.5px] uppercase text-[var(--color-muted)]">{label}</dt>
              </div>
            ))}
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-subtle)]">
              <dd className="text-lg font-semibold text-[var(--color-ink)]">{plural(totals.generations, "génération", "générations")}</dd>
              <dt className="family-tree-mono mt-1 text-[9.5px] uppercase text-[var(--color-muted)]">Profondeur</dt>
            </div>
            <div className="col-span-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-subtle)] sm:col-span-1">
              <dd className="text-lg font-semibold text-[var(--color-ink)]">{statistics.averageLongevity === null ? "Non calculable" : `${statistics.averageLongevity.toLocaleString("fr-FR", { minimumFractionDigits: 1 })} ans`}</dd>
              <dt className="family-tree-mono mt-1 text-[9.5px] uppercase text-[var(--color-muted)]">Longévité moyenne</dt>
            </div>
          </dl>

          <section aria-labelledby="age-pyramid-heading" className="mt-6 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-5 shadow-[var(--shadow-subtle)]">
            <h2 id="age-pyramid-heading" className="text-sm font-semibold text-[var(--color-ink)]">Pyramide des âges</h2>
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
                        <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${Math.max(8, count * 12)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-label="Classements familiaux" className="mt-6 grid gap-4 lg:grid-cols-3">
            <Ranking title="Prénoms fréquents" items={statistics.topFirstNames} />
            <Ranking title="Lieux de naissance" items={statistics.topBirthPlaces} />
            <Ranking title="Lieux de résidence" items={statistics.topResidencePlaces} />
          </section>
        </>
      )}
    </main>
  );
}

export default async function StatisticsPage() {
  return <StatisticsView statistics={await getFamilyStatisticsForWeb()} />;
}
