import { adminGetFiliation, adminUpdateFiliation, adminListPersons } from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { FiliationRole } from "@testvibe/core";
import { sortPersonsChronologically } from "@/lib/sort-persons";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<FiliationRole, string> = {
  biologique: "Biologique",
  adopte: "Adopté·e",
  "beau-parent": "Beau-parent",
};

interface EditFiliationPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function EditFiliationPage({ params, searchParams }: EditFiliationPageProps) {
  const { id: idStr } = await params;
  const { error } = await searchParams;
  const id = Number(idStr);

  if (Number.isNaN(id)) notFound();

  let filiation;
  try {
    filiation = await adminGetFiliation(id);
  } catch {
    notFound();
  }

  const persons = await adminListPersons();
  const sortedPersons = sortPersonsChronologically(persons);

  async function updateFiliationAction(formData: FormData) {
    "use server";
    const parentId = Number(formData.get("parentId"));
    const childId = Number(formData.get("childId"));
    const role = formData.get("role")?.toString() as FiliationRole;

    if (!parentId || !childId || !role) {
      redirect(`/admin/filiations/${id}/edit?error=champs_requis`);
    }

    try {
      await adminUpdateFiliation(id, { parentId, childId, role });
    } catch {
      redirect(`/admin/filiations/${id}/edit?error=validation`);
    }
    revalidatePath("/admin/filiations");
    redirect("/admin/filiations");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Modifier la filiation #{id}</h1>

      {error && (
        <p className="mb-4 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === "champs_requis"
            ? "Parent, enfant et rôle sont obligatoires."
            : "Données invalides."}
        </p>
      )}

      <form action={updateFiliationAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="parentId" className="mb-1 block text-sm font-medium text-slate-700">
            Parent *
          </label>
          <select
            id="parentId"
            name="parentId"
            required
            defaultValue={filiation.parentId}
            className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
          >
            {sortedPersons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="childId" className="mb-1 block text-sm font-medium text-slate-700">
            Enfant *
          </label>
          <select
            id="childId"
            name="childId"
            required
            defaultValue={filiation.childId}
            className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
          >
            {sortedPersons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.firstName} {p.lastName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">
            Rôle *
          </label>
          <select
            id="role"
            name="role"
            required
            defaultValue={filiation.role}
            className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
          >
            {(Object.entries(ROLE_LABELS) as [FiliationRole, string][]).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-sm bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Enregistrer
          </button>
          <Link
            href="/admin/filiations"
            className="rounded-sm border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Annuler
          </Link>
        </div>
      </form>
    </main>
  );
}
