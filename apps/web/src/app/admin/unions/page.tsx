import {
  adminListUnions,
  adminCreateUnion,
  adminDeleteUnion,
  adminListPersons,
} from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ─── Server Actions ──────────────────────────────────────────────────────────

async function createUnionAction(formData: FormData) {
  "use server";
  const startDate = formData.get("startDate")?.toString().trim() || null;
  const endDate = formData.get("endDate")?.toString().trim() || null;
  const personIdsRaw = formData.getAll("personIds").map((v) => Number(v));
  const personIds = personIdsRaw.filter((id) => !Number.isNaN(id) && id > 0);

  if (personIds.length === 0) {
    redirect("/admin/unions?error=personnes_requises");
  }

  try {
    await adminCreateUnion({ startDate, endDate, personIds });
  } catch {
    redirect("/admin/unions?error=validation");
  }
  revalidatePath("/admin/unions");
  redirect("/admin/unions");
}

async function deleteUnionAction(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (!id || Number.isNaN(id)) return;
  try {
    await adminDeleteUnion(id);
  } catch {
    // Ignoré
  }
  revalidatePath("/admin/unions");
  redirect("/admin/unions");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface UnionsPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function UnionsPage({ searchParams }: UnionsPageProps) {
  const { error } = await searchParams;
  const [unions, persons] = await Promise.all([adminListUnions(), adminListPersons()]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Unions</h1>

      {/* Formulaire de création */}
      <section className="mb-8 rounded-lg border border-slate-200 p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Créer une union</h2>
        {error && (
          <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === "personnes_requises"
              ? "Sélectionnez au moins une personne."
              : "Données invalides."}
          </p>
        )}
        <form action={createUnionAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-slate-700">
              Date de début
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-slate-700">
              Date de fin
            </label>
            <input
              id="endDate"
              name="endDate"
              type="date"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <fieldset>
              <legend className="mb-1 block text-sm font-medium text-slate-700">
                Personnes liées *
              </legend>
              {persons.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aucune personne disponible — créez d&apos;abord des personnes.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {persons.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="personIds" value={p.id} />
                      {p.firstName} {p.lastName}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          </div>
          <div>
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Créer
            </button>
          </div>
        </form>
      </section>

      {/* Liste */}
      <section>
        <h2 className="mb-4 font-semibold text-slate-800">Unions existantes ({unions.length})</h2>
        {unions.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune union enregistrée.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {unions.map((u) => {
              const partners = u.personIds
                .map((pid) => {
                  const p = persons.find((x) => x.id === pid);
                  return p ? `${p.firstName} ${p.lastName}` : `#${pid}`;
                })
                .join(", ");
              return (
                <li key={u.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="font-medium text-slate-900">Union #{u.id}</span>
                    <span className="ml-2 text-sm text-slate-500">
                      {partners}
                      {u.startDate ? ` (depuis ${u.startDate})` : ""}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/unions/${u.id}/edit`}
                      className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                    >
                      Modifier
                    </Link>
                    <form action={deleteUnionAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        type="submit"
                        className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm text-slate-500">
        <Link href="/admin" className="underline hover:text-slate-800">
          ← Retour au mode édition
        </Link>
      </p>
    </main>
  );
}
