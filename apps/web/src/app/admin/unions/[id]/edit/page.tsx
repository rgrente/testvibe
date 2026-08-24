import { adminGetUnion, adminUpdateUnion, adminListPersons } from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlaceAutocomplete from "@/components/PlaceAutocomplete";
import type { Union, UnionType } from "@testvibe/core";
import UnionPersonSearch from "@/components/UnionPersonSearch";

export const dynamic = "force-dynamic";

interface EditUnionPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function EditUnionPage({ params, searchParams }: EditUnionPageProps) {
  const { id: idStr } = await params;
  const { error } = await searchParams;
  const id = Number(idStr);

  if (Number.isNaN(id)) notFound();

  let union: Union;
  try {
    union = await adminGetUnion(id);
  } catch {
    notFound();
  }

  const persons = await adminListPersons();

  async function updateUnionAction(formData: FormData) {
    "use server";
    const startDate = formData.get("startDate")?.toString().trim() || null;
    const endDate = formData.get("endDate")?.toString().trim() || null;
    const type = formData.get("type")?.toString() as UnionType;
    const place = formData.get("place")?.toString().trim() || null;
    const latitudeRaw = formData.get("latitude")?.toString().trim();
    const longitudeRaw = formData.get("longitude")?.toString().trim();
    const latitude = latitudeRaw ? Number(latitudeRaw) : null;
    const longitude = longitudeRaw ? Number(longitudeRaw) : null;
    const personIdsRaw = formData.getAll("personIds").map((v) => Number(v));
    const personIds = personIdsRaw.filter((pid) => !Number.isNaN(pid) && pid > 0);

    const distinctPersonCount = new Set(personIds).size;
    const hasValidPartners = union.personIds.length === 2
      ? personIds.length === 2 && distinctPersonCount === 2
      : personIds.length > 0 && distinctPersonCount === personIds.length;

    if (!hasValidPartners) {
      redirect(`/admin/unions/${id}/edit?error=personnes_requises`);
    }

    try {
      await adminUpdateUnion(id, { type, startDate, endDate, place, latitude, longitude, personIds });
    } catch {
      redirect(`/admin/unions/${id}/edit?error=validation`);
    }
    revalidatePath("/admin/unions");
    redirect("/admin/unions");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Modifier l&apos;union #{id}</h1>

      {error && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === "personnes_requises"
            ? union.personIds.length === 2
              ? "Sélectionnez deux personnes différentes."
              : "Sélectionnez au moins une personne, sans doublon."
            : "Données invalides."}
        </p>
      )}

      <form action={updateUnionAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="type" className="mb-1 block text-sm font-medium text-slate-700">Type d&apos;union</label>
          <select id="type" name="type" defaultValue={union.type} className="w-full rounded border border-slate-300 px-3 py-2 text-sm">
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
            type="date"
            defaultValue={union.startDate ?? ""}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="union-place" className="mb-1 block text-sm font-medium text-slate-700">Ville ou lieu</label>
          <PlaceAutocomplete inputId="union-place" defaultPlace={union.place ?? ""} defaultLatitude={union.latitude} defaultLongitude={union.longitude} placeholder="Rechercher une ville…" />
        </div>
        <div>
          <label htmlFor="endDate" className="mb-1 block text-sm font-medium text-slate-700">
            Date de fin
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={union.endDate ?? ""}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <fieldset>
            <legend className={union.personIds.length === 2 ? "sr-only" : "mb-1 block text-sm font-medium text-slate-700"}>
              Personnes liées
            </legend>
            {union.personIds.length === 2 ? (
              <UnionPersonSearch persons={persons} defaultPersonIds={union.personIds} />
            ) : (
              <>
                <p className="mb-2 text-sm text-slate-500">
                  Cette ancienne union comporte {union.personIds.length} personne(s). Vous pouvez conserver ou modifier cette liste.
                </p>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {persons.map((person) => (
                    <label key={person.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="personIds"
                        value={person.id}
                        defaultChecked={union.personIds.includes(person.id)}
                      />
                      {person.firstName} {person.lastName}
                    </label>
                  ))}
                </div>
              </>
            )}
          </fieldset>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Enregistrer
          </button>
          <Link
            href="/admin/unions"
            className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Annuler
          </Link>
        </div>
      </form>
    </main>
  );
}
