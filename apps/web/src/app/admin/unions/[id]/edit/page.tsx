import { adminGetUnion, adminUpdateUnion, adminListPersons } from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";

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

  let union;
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
    const personIdsRaw = formData.getAll("personIds").map((v) => Number(v));
    const personIds = personIdsRaw.filter((pid) => !Number.isNaN(pid) && pid > 0);

    if (personIds.length === 0) {
      redirect(`/admin/unions/${id}/edit?error=personnes_requises`);
    }

    try {
      await adminUpdateUnion(id, { startDate, endDate, personIds });
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
            ? "Sélectionnez au moins une personne."
            : "Données invalides."}
        </p>
      )}

      <form action={updateUnionAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <legend className="mb-1 block text-sm font-medium text-slate-700">
              Personnes liées *
            </legend>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {persons.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="personIds"
                    value={p.id}
                    defaultChecked={union.personIds.includes(p.id)}
                  />
                  {p.firstName} {p.lastName}
                </label>
              ))}
            </div>
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
