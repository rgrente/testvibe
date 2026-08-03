import { getMapLocationsForWeb, listAllPersonsForWeb, getAncestorIdsForWeb, getDescendantIdsForWeb } from "@testvibe/core";
import CarteClient from "./CarteClient";

export const dynamic = "force-dynamic";

interface CartePageProps {
  searchParams: Promise<{
    person?: string;
    branche?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function CartePage({ searchParams }: CartePageProps) {
  const params = await searchParams;
  const personId = params.person ? Number(params.person) : null;
  const branche = params.branche || "none";

  const [locations, allPersons] = await Promise.all([
    getMapLocationsForWeb(),
    listAllPersonsForWeb(),
  ]);

  const allPersonOptions = allPersons.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
  }));

  let branchPersonIds: number[] = [];
  if (personId && branche === "ancestors") {
    branchPersonIds = await getAncestorIdsForWeb(personId);
  } else if (personId && branche === "descendants") {
    branchPersonIds = await getDescendantIdsForWeb(personId);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">
        Carte familiale
      </h1>
      <CarteClient
        locations={locations}
        allPersons={allPersonOptions}
        initialPersonId={personId}
        initialBranch={branche as "none" | "ancestors" | "descendants"}
        initialDateFrom={params.from || ""}
        initialDateTo={params.to || ""}
        branchPersonIds={branchPersonIds}
      />
    </main>
  );
}
