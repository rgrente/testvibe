import Link from "next/link";
import { computeKinshipForWeb, listAllPersonsForWeb } from "@testvibe/core";
import type { Person } from "@testvibe/core";
import { libelleRelation, libelleRole, phraseDeParente } from "@/lib/kinship-phrase";
import { sortPersonsChronologically } from "@/lib/sort-persons";

export const dynamic = "force-dynamic";

interface ParentePageProps {
  searchParams: Promise<{ de?: string; vers?: string }>;
}

const nomComplet = (person: Person): string => `${person.firstName} ${person.lastName}`;

/** Résout un paramètre d'URL en Person existante, ou null s'il est absent/inconnu. */
function personneChoisie(valeur: string | undefined, persons: Person[]): Person | null {
  if (!valeur) return null;
  const id = Number(valeur);
  if (!Number.isInteger(id)) return null;
  return persons.find((person) => person.id === id) ?? null;
}

/**
 * Route publique de calcul du lien de parenté entre deux personnes.
 * Server Component : les données passent exclusivement par @testvibe/core
 * (`computeKinshipForWeb`), jamais par @testvibe/db.
 *
 * Le sens est orienté : « de » est le sujet de la phrase (« X est la mère
 * de Y »), « vers » en est le complément.
 */
export default async function ParentePage({ searchParams }: ParentePageProps) {
  const { de, vers } = await searchParams;
  const persons = await listAllPersonsForWeb();

  if (persons.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Lien de parenté</h1>
        <p className="text-slate-600">
          Aucune personne n’est encore disponible pour calculer un lien de parenté.
        </p>
      </main>
    );
  }

  const options = sortPersonsChronologically(persons);
  const from = personneChoisie(de, persons);
  const to = personneChoisie(vers, persons);
  const result = from && to ? await computeKinshipForWeb(from.id, to.id) : null;
  // Le féminin des libellés suit le genre de la personne de départ, comme
  // dans packages/core : un genre inconnu retombe sur le masculin.
  const feminin = from?.gender === "F";
  const chemin = result?.paths[0] ?? null;
  // Sur une ligne directe, le pivot du chemin est l'une des deux personnes
  // elles-mêmes : ne signaler l'ancêtre commun que pour un lien collatéral.
  const relation = result?.link?.relation;
  const signalerAncetreCommun = relation === "collateral" || relation === "frere-soeur";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Lien de parenté</h1>
      <p className="mb-6 text-slate-600">
        Choisissez deux personnes pour connaître leur lien de parenté, le chemin qui les relie et
        leurs ancêtres communs.
      </p>

      <form method="GET" action="/parente" className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="parente-de" className="mb-1 block text-sm font-medium text-slate-700">
            Personne de départ
          </label>
          <select
            id="parente-de"
            name="de"
            defaultValue={from ? String(from.id) : ""}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {options.map((person) => (
              <option key={person.id} value={person.id}>
                {nomComplet(person)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="parente-vers" className="mb-1 block text-sm font-medium text-slate-700">
            Personne d’arrivée
          </label>
          <select
            id="parente-vers"
            name="vers"
            defaultValue={to ? String(to.id) : ""}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {options.map((person) => (
              <option key={person.id} value={person.id}>
                {nomComplet(person)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Calculer le lien
        </button>
      </form>

      {result === null ? (
        <p className="text-sm text-slate-500">
          Sélectionnez une personne de départ et une personne d’arrivée, puis lancez le calcul.
        </p>
      ) : (
        <section aria-labelledby="resultat-parente">
          <h2 id="resultat-parente" className="mb-3 text-lg font-semibold text-slate-800">
            Résultat
          </h2>
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900">
            {phraseDeParente(result, nomComplet(from!), nomComplet(to!), feminin)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1">{libelleRelation(result)}</span>
            {result.link && !result.samePerson && (
              <>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Degré : {result.link.degree}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1">
                  Écart de génération : {result.link.generationGap}
                </span>
              </>
            )}
            <Link
              href={`/parente?de=${to!.id}&vers=${from!.id}`}
              className="underline hover:text-slate-900"
            >
              Inverser le sens
            </Link>
          </div>

          {result.multipleRelationships && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Plusieurs chemins de parenté relient ces deux personnes (par exemple par chacun des
              deux parents d’une fratrie, ou par une double alliance). Le chemin ci-dessous est le
              plus court.
            </p>
          )}

          {chemin && (
            <section className="mt-8">
              <h3 className="mb-3 font-semibold text-slate-800">Chemin de parenté</h3>
              <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {chemin.steps.map((step, index) => {
                  const role = libelleRole(step.edgeRole);
                  return (
                    <li
                      key={`${step.personId}-${index}`}
                      className="flex flex-wrap items-center gap-2 px-4 py-3"
                    >
                      <span className="text-xs text-slate-400">{index + 1}.</span>
                      <Link
                        href={`/persons/${step.personId}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {step.name}
                      </Link>
                      {signalerAncetreCommun && step.personId === chemin.commonAncestorId && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          ancêtre commun
                        </span>
                      )}
                      {role && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {role}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section className="mt-8">
            <h3 className="mb-3 font-semibold text-slate-800">Ancêtres communs</h3>
            {result.commonAncestors.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun ancêtre commun connu.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {result.commonAncestors.map((ancestor) => (
                  <li key={ancestor.id}>
                    <Link
                      href={`/persons/${ancestor.id}`}
                      className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
                    >
                      {ancestor.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      )}
    </main>
  );
}
