import { getFamilyAnniversariesForWeb, listAllPersonsForWeb, localCalendarDate, searchPersonsForWeb } from "@testvibe/core";
import Link from "next/link";
import { FamilyTreeViews } from "../components/FamilyTreeViews";
import { RootPersonSelect } from "../components/RootPersonSelect";
import { getFamilyTreeForWeb } from "@testvibe/core";
import { FamilyAnniversaries } from "../components/FamilyAnniversaries";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ personId?: string; q?: string }>;
}

/**
 * Route publique de consultation en lecture seule de l'arbre
 * généalogique (Phase 2, tâche #21). Server Component : lit les
 * données exclusivement via @testvibe/core (packages/core), jamais
 * via @testvibe/db ni de requête SQL directe.
 * Phase 5 (tâche #24) : ajout d'une recherche par nom (?q=).
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const { personId, q } = await searchParams;
  const today = localCalendarDate(new Date(), process.env.FAMILY_TIME_ZONE ?? "Europe/Paris");
  const [persons, anniversaries] = await Promise.all([
    listAllPersonsForWeb(),
    getFamilyAnniversariesForWeb(today),
  ]);

  const anniversaryBlock = (
    <section className="mb-8 rounded-xl bg-amber-50 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-amber-950">Ce jour-là dans la famille</h2>
        <Link href="/ce-jour-la" className="text-sm font-medium text-amber-800 hover:underline">Parcourir une autre date</Link>
      </div>
      <FamilyAnniversaries anniversaries={anniversaries} compact />
      {anniversaries.length > 4 && <p className="mt-3 text-right text-sm"><Link href="/ce-jour-la" className="text-amber-800 hover:underline">Voir les {anniversaries.length} anniversaires</Link></p>}
    </section>
  );

  if (persons.length === 0) {
    return (
      <main className="page-container py-12">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Arbre généalogique</h1>
        {anniversaryBlock}
        <p className="text-slate-600">
          Aucune Person n&apos;a encore été créée. Lancez{" "}
          <code className="rounded-sm bg-slate-100 px-1.5 py-0.5">
            pnpm --filter @testvibe/core db:seed
          </code>{" "}
          pour charger un jeu de données de démonstration.
        </p>
      </main>
    );
  }

  // ── Recherche ──────────────────────────────────────────────────────────────
  const searchQuery = q?.trim() ?? "";
  const searchResults = searchQuery ? await searchPersonsForWeb(searchQuery) : null;

  // ── Arbre ─────────────────────────────────────────────────────────────────
  const requestedRootId = personId ? Number(personId) : NaN;
  const rootId = persons.some((p) => p.id === requestedRootId) ? requestedRootId : persons[0].id;
  const tree = await getFamilyTreeForWeb(rootId);
  const root = tree.nodes.find((n) => n.person.id === rootId)!.person;

  return (
    <main className="min-w-0 py-8">
      <div className="page-container">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Arbre généalogique</h1>
        {anniversaryBlock}

        {/* Barre de recherche */}
        <form method="GET" className="mb-6 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Rechercher une personne…"
            className="min-w-0 flex-1 rounded-sm border border-slate-300 px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-400"
            aria-label="Rechercher par nom"
          />
          <button
            type="submit"
            className="rounded-sm bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Rechercher
          </button>
          {searchQuery && (
            <Link
              href="/"
              className="rounded-sm border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
            >
              Effacer
            </Link>
          )}
        </form>

        {/* Résultats de recherche */}
        {searchResults !== null && (
          <section className="mb-8">
            <h2 className="mb-3 font-semibold text-slate-800">
              {searchResults.length === 0
                ? `Aucun résultat pour « ${searchQuery} »`
                : `${searchResults.length} résultat(s) pour « ${searchQuery} »`}
            </h2>
            {searchResults.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {searchResults.map((p) => (
                  <li key={p.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900">
                        {p.firstName} {p.lastName}
                      </span>
                      {p.birthDate && (
                        <span className="ml-2 text-sm text-slate-500">né·e {p.birthDate}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/?personId=${p.id}`}
                        className="rounded-sm border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                      >
                        Voir dans l&apos;arbre
                      </Link>
                      <Link
                        href={`/persons/${p.id}`}
                        className="rounded-sm border border-blue-200 px-3 py-1 text-xs text-blue-700 hover:bg-blue-50"
                      >
                        Détail
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!searchQuery && (
          <p className="mb-6 text-slate-600">
            Vue centrée sur{" "}
            <span className="font-medium text-slate-900">
              {root.firstName} {root.lastName}
            </span>{" "}
            — {tree.nodes.length} personne(s) affichée(s).
          </p>
        )}
      </div>

      {/* Arbre généalogique : pleine largeur pour exploiter tout l'écran sur desktop */}
      {!searchQuery && (
        <div className="page-container-wide">
          <FamilyTreeViews tree={tree} rootControl={<RootPersonSelect persons={persons} selectedId={rootId} />} />
        </div>
      )}

    </main>
  );
}
