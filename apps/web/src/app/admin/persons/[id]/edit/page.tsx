import { adminGetPerson, adminUpdatePerson } from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface EditPersonPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function EditPersonPage({ params, searchParams }: EditPersonPageProps) {
  const { id: idStr } = await params;
  const { error } = await searchParams;
  const id = Number(idStr);

  if (Number.isNaN(id)) notFound();

  let person;
  try {
    person = await adminGetPerson(id);
  } catch {
    notFound();
  }

  async function updatePersonAction(formData: FormData) {
    "use server";
    const firstName = formData.get("firstName")?.toString().trim();
    const lastName = formData.get("lastName")?.toString().trim();
    const birthName = formData.get("birthName")?.toString().trim() || null;
    const birthDate = formData.get("birthDate")?.toString().trim() || null;
    const deathDate = formData.get("deathDate")?.toString().trim() || null;
    const gender = formData.get("gender")?.toString().trim() || null;

    if (!firstName || !lastName) {
      redirect(`/admin/persons/${id}/edit?error=champs_requis`);
    }

    try {
      await adminUpdatePerson(id, { firstName, lastName, birthName, birthDate, deathDate, gender });
    } catch {
      redirect(`/admin/persons/${id}/edit?error=validation`);
    }
    revalidatePath("/admin/persons");
    redirect("/admin/persons");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">
        Modifier : {person.firstName} {person.lastName}
      </h1>

      {error && (
        <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error === "champs_requis" ? "Prénom et nom sont obligatoires." : "Données invalides."}
        </p>
      )}

      <form action={updatePersonAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-slate-700">
            Prénom *
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            defaultValue={person.firstName}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-slate-700">
            Nom *
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            defaultValue={person.lastName}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="birthName" className="mb-1 block text-sm font-medium text-slate-700">
            Nom de naissance
          </label>
          <input
            id="birthName"
            name="birthName"
            type="text"
            defaultValue={person.birthName ?? ""}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="birthDate" className="mb-1 block text-sm font-medium text-slate-700">
            Date de naissance
          </label>
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={person.birthDate ?? ""}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="deathDate" className="mb-1 block text-sm font-medium text-slate-700">
            Date de décès
          </label>
          <input
            id="deathDate"
            name="deathDate"
            type="date"
            defaultValue={person.deathDate ?? ""}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="gender" className="mb-1 block text-sm font-medium text-slate-700">
            Genre
          </label>
          <select
            id="gender"
            name="gender"
            defaultValue={person.gender ?? ""}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Enregistrer
          </button>
          <Link
            href="/admin/persons"
            className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            Annuler
          </Link>
        </div>
      </form>

      {/* Phase 5 (tâche #24) : raccourcis vers événements et médias */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/admin/persons/${id}/events`}
          className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          📅 Événements
        </Link>
        <Link
          href={`/admin/persons/${id}/media`}
          className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
        >
          🖼 Médias
        </Link>
        <Link
          href={`/persons/${id}`}
          className="rounded border border-blue-200 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50"
        >
          Voir la fiche publique →
        </Link>
      </div>
    </main>
  );
}
