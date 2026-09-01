import {
  adminListUnions,
  adminCreateUnion,
  adminDeleteUnion,
  adminListPersons,
} from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import PlaceAutocomplete from "@/components/PlaceAutocomplete";
import type { UnionType } from "@testvibe/core";
import UnionPersonSearch from "@/components/UnionPersonSearch";
import { requireAdminMutation } from "@/lib/session";

export const dynamic = "force-dynamic";

// ─── Server Actions ──────────────────────────────────────────────────────────

export async function createUnionAction(formData: FormData) {
  "use server";
  await requireAdminMutation();
  const startDate = formData.get("startDate")?.toString().trim() || null;
  const endDate = formData.get("endDate")?.toString().trim() || null;
  const type = formData.get("type")?.toString() as UnionType;
  const place = formData.get("place")?.toString().trim() || null;
  const latitudeRaw = formData.get("latitude")?.toString().trim();
  const longitudeRaw = formData.get("longitude")?.toString().trim();
  const latitude = latitudeRaw ? Number(latitudeRaw) : null;
  const longitude = longitudeRaw ? Number(longitudeRaw) : null;
  const personIdsRaw = formData.getAll("personIds").map((v) => Number(v));
  const personIds = personIdsRaw.filter((id) => !Number.isNaN(id) && id > 0);

  if (personIds.length !== 2 || new Set(personIds).size !== 2) {
    redirect("/admin/unions?error=personnes_requises");
  }

  try {
    await adminCreateUnion({ type, startDate, endDate, place, latitude, longitude, personIds });
  } catch {
    redirect("/admin/unions?error=validation");
  }
  revalidatePath("/admin/unions");
  redirect("/admin/unions");
}

async function deleteUnionAction(formData: FormData) {
  "use server";
  await requireAdminMutation();
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
          <p className="mb-4 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === "personnes_requises"
              ? "Sélectionnez deux personnes différentes."
              : "Données invalides."}
          </p>
        )}
        <form action={createUnionAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="type" className="mb-1 block text-sm font-medium text-slate-700">Type d&apos;union</label>
            <select id="type" name="type" defaultValue="libre" className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm">
              <option value="mariage">Mariage</option>
              <option value="pacs">Pacs</option>
              <option value="libre">Union libre</option>
            </select>
          </div>
          <div>
            <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-slate-700">
              Date de début
            </label>
            <input
              id="startDate"
              name="startDate"
              type="text"
              placeholder="1950, 1950-03, vers/avant/après 1950, entre 1950 et 1952"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="union-place" className="mb-1 block text-sm font-medium text-slate-700">Ville ou lieu</label>
            <PlaceAutocomplete inputId="union-place" placeholder="Rechercher une ville…" />
          </div>
          <div>
            <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-slate-700">
              Date de fin
            </label>
            <input
              id="endDate"
              name="endDate"
              type="text"
              placeholder="1950, 1950-03, vers/avant/après 1950, entre 1950 et 1952"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <fieldset>
              <legend className="sr-only">Personnes liées</legend>
              <UnionPersonSearch persons={persons} />
            </fieldset>
          </div>
          <div>
            <button
              type="submit"
              className="rounded-sm bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
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
                    <span className="font-medium text-slate-900">{u.type === "mariage" ? "Mariage" : u.type === "pacs" ? "Pacs" : "Union libre"} #{u.id}</span>
                    <span className="ml-2 text-sm text-slate-500">
                      {partners}
                      {u.startDate ? ` (depuis ${u.startDate})` : ""}
                      {u.place ? ` — ${u.place}` : ""}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/unions/${u.id}/edit`}
                      className="rounded-sm border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                    >
                      Modifier
                    </Link>
                    <form action={deleteUnionAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        type="submit"
                        className="rounded-sm border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
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
