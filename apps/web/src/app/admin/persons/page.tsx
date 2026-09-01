import { adminListPersons, adminCreatePerson, adminDeletePerson } from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdminMutation } from "@/lib/session";

export const dynamic = "force-dynamic";

// ─── Server Actions ──────────────────────────────────────────────────────────

async function createPersonAction(formData: FormData) {
  "use server";
  await requireAdminMutation();
  const firstName = formData.get("firstName")?.toString().trim() ?? "";
  const lastName = formData.get("lastName")?.toString().trim() ?? "";
  const birthName = formData.get("birthName")?.toString().trim() || null;
  const birthDate = formData.get("birthDate")?.toString().trim() || null;
  const deathDate = formData.get("deathDate")?.toString().trim() || null;
  const gender = formData.get("gender")?.toString().trim() || null;
  const livingStatus = formData.get("livingStatus")?.toString() as "living" | "deceased" | undefined;
  const visibility = formData.get("visibility")?.toString() as "public" | "family" | "private" | undefined;

  if (!firstName || !lastName) {
    redirect("/admin/persons?error=champs_requis");
  }

  try {
    await adminCreatePerson({ firstName, lastName, birthName, birthDate, deathDate, gender, livingStatus, visibility });
  } catch {
    redirect("/admin/persons?error=validation");
  }
  revalidatePath("/admin/persons");
  redirect("/admin/persons");
}

async function deletePersonAction(formData: FormData) {
  "use server";
  await requireAdminMutation();
  const id = Number(formData.get("id"));
  if (!id || Number.isNaN(id)) return;
  try {
    await adminDeletePerson(id);
  } catch {
    // Ignoré : la personne peut ne pas exister (déjà supprimée)
  }
  revalidatePath("/admin/persons");
  redirect("/admin/persons");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PersonsPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function PersonsPage({ searchParams }: PersonsPageProps) {
  const { error } = await searchParams;
  const persons = await adminListPersons();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Personnes</h1>

      {/* Formulaire de création */}
      <section className="mb-8 rounded-lg border border-slate-200 p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Créer une personne</h2>
        {error && (
          <p className="mb-4 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === "champs_requis" ? "Prénom et nom sont obligatoires." : "Données invalides."}
          </p>
        )}
        <form action={createPersonAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-slate-700">
              Prénom *
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
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
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
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
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="birthDate" className="mb-1 block text-sm font-medium text-slate-700">
              Date de naissance
            </label>
            <input
              id="birthDate"
              name="birthDate"
              type="text"
              placeholder="1950, 1950-03, vers/avant/après 1950, entre 1950 et 1952"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="deathDate" className="mb-1 block text-sm font-medium text-slate-700">
              Date de décès
            </label>
            <input
              id="deathDate"
              name="deathDate"
              type="text"
              placeholder="1950, 1950-03, vers/avant/après 1950, entre 1950 et 1952"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="gender" className="mb-1 block text-sm font-medium text-slate-700">
              Genre
            </label>
            <select
              id="gender"
              name="gender"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <label className="text-sm font-medium text-slate-700">
            Statut de vie
            <select name="livingStatus" defaultValue="living" className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm">
              <option value="living">Vivant</option><option value="deceased">Décédé</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Visibilité
            <select name="visibility" defaultValue="public" className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm">
              <option value="public">Public</option><option value="family">Famille</option><option value="private">Privé</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-sm bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Créer
            </button>
          </div>
        </form>
      </section>

      {/* Liste des personnes existantes */}
      <section>
        <h2 className="mb-4 font-semibold text-slate-800">
          Personnes existantes ({persons.length})
        </h2>
        {persons.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune personne enregistrée.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {persons.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium text-slate-900">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="ml-2 text-sm text-slate-500">
                    {p.birthDate ? `né·e ${p.birthDate}` : ""}
                    {p.deathDate ? ` — décédé·e ${p.deathDate}` : ""}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/persons/${p.id}/edit`}
                    className="rounded-sm border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                  >
                    Modifier
                  </Link>
                  <form action={deletePersonAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-sm border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </form>
                </div>
              </li>
            ))}
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
