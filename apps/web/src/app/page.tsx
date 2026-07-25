import { getFamilyTreeForWeb, listAllPersonsForWeb } from "@testvibe/core";
import { FamilyTreeCanvas } from "../components/FamilyTreeCanvas";
import { FamilyTreeMobileList } from "../components/FamilyTreeMobileList";
import { RootPersonSelect } from "../components/RootPersonSelect";

export const dynamic = "force-dynamic";

interface HomePageProps {
  searchParams: Promise<{ personId?: string }>;
}

/**
 * Route publique de consultation en lecture seule de l'arbre
 * généalogique (Phase 2, tâche #21). Server Component : lit les
 * données exclusivement via @testvibe/core (packages/core), jamais
 * via @testvibe/db ni de requête SQL directe.
 */
export default async function HomePage({ searchParams }: HomePageProps) {
  const { personId } = await searchParams;
  const persons = await listAllPersonsForWeb();

  if (persons.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Arbre généalogique</h1>
        <p className="text-slate-600">
          Aucune Person n&apos;a encore été créée. Lancez{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">
            pnpm --filter @testvibe/core db:seed
          </code>{" "}
          pour charger un jeu de données de démonstration.
        </p>
      </main>
    );
  }

  const requestedRootId = personId ? Number(personId) : NaN;
  const rootId = persons.some((p) => p.id === requestedRootId) ? requestedRootId : persons[0].id;

  const tree = await getFamilyTreeForWeb(rootId);
  const root = tree.nodes.find((n) => n.person.id === rootId)!.person;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Arbre généalogique</h1>
      <p className="mb-6 text-slate-600">
        Vue centrée sur{" "}
        <span className="font-medium text-slate-900">
          {root.firstName} {root.lastName}
        </span>{" "}
        — {tree.nodes.length} personne(s) affichée(s).
      </p>

      <RootPersonSelect persons={persons} selectedId={rootId} />

      <FamilyTreeCanvas tree={tree} />
      <FamilyTreeMobileList tree={tree} />
    </main>
  );
}
