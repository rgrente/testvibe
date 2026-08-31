import {
  adminListFiliations,
  adminCreateFiliations,
  adminDeleteFiliation,
  adminListPersons,
} from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { FiliationRole } from "@testvibe/core";
import { sortPersonsChronologically } from "@/lib/sort-persons";
import { requireAdminMutation } from "@/lib/session";

export const dynamic = "force-dynamic";

// ─── Server Actions ──────────────────────────────────────────────────────────

async function createFiliationAction(formData: FormData) {
  "use server";
  await requireAdminMutation();
  const parentIds = formData.getAll("parentIds").map(Number).filter(Boolean);
  const childIds = formData.getAll("childIds").map(Number).filter(Boolean);
  const role = formData.get("role")?.toString() as FiliationRole;

  if (parentIds.length === 0 || childIds.length === 0 || !role) {
    redirect("/admin/filiations?error=champs_requis");
  }
  try {
    await adminCreateFiliations({ parentIds, childIds, role });
  } catch {
    redirect("/admin/filiations?error=validation");
  }
  revalidatePath("/admin/filiations");
  redirect("/admin/filiations?success=creation");
}

async function deleteFiliationAction(formData: FormData) {
  "use server";
  await requireAdminMutation();
  const id = Number(formData.get("id"));
  if (!id || Number.isNaN(id)) return;
  try {
    await adminDeleteFiliation(id);
  } catch {
    // Ignoré
  }
  revalidatePath("/admin/filiations");
  redirect("/admin/filiations");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface FiliationsPageProps {
  searchParams: Promise<{ error?: string; success?: string }>;
}

const ROLE_LABELS: Record<FiliationRole, string> = {
  biologique: "Biologique",
  adopte: "Adopté·e",
  "beau-parent": "Beau-parent",
};

export default async function FiliationsPage({ searchParams }: FiliationsPageProps) {
  const { error, success } = await searchParams;
  const [filiations, persons] = await Promise.all([
    adminListFiliations(),
    adminListPersons(),
  ]);
  const sortedPersons = sortPersonsChronologically(persons);

  const personLabel = (id: number) => {
    const p = persons.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : `#${id}`;
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Filiations</h1>
      {success === "creation" && (
        <p className="mb-4 rounded-sm bg-green-50 px-4 py-3 text-sm text-green-800">
          Filiations créées avec succès.
        </p>
      )}

      {/* Formulaire de création */}
      <section className="mb-8 rounded-lg border border-slate-200 p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Créer une filiation</h2>
        {error && (
          <p className="mb-4 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === "champs_requis"
              ? "Parent, enfant et rôle sont obligatoires."
              : "Données invalides (ex. : parentId = childId ?)."}
          </p>
        )}
        <form action={createFiliationAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="parentIds" className="mb-1 block text-sm font-medium text-slate-700">
              Parents * (1 ou 2)
            </label>
            <select
              id="parentIds"
              name="parentIds"
              required
              multiple
              size={Math.min(6, Math.max(2, persons.length))}
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            >
              {sortedPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Ctrl/Cmd + clic pour choisir deux parents.</p>
          </div>
          <div>
            <label htmlFor="childIds" className="mb-1 block text-sm font-medium text-slate-700">
              Enfants * (un ou plusieurs)
            </label>
            <select
              id="childIds"
              name="childIds"
              required
              multiple
              size={Math.min(6, Math.max(2, persons.length))}
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            >
              {sortedPersons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Ctrl/Cmd + clic pour choisir plusieurs enfants.</p>
          </div>
          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-medium text-slate-700">
              Rôle *
            </label>
            <select
              id="role"
              name="role"
              required
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {(Object.entries(ROLE_LABELS) as [FiliationRole, string][]).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
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

      {/* Liste */}
      <section>
        <h2 className="mb-4 font-semibold text-slate-800">
          Filiations existantes ({filiations.length})
        </h2>
        {filiations.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune filiation enregistrée.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {filiations.map((f) => (
              <li key={f.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <span className="font-medium text-slate-900">{personLabel(f.parentId)}</span>
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="font-medium text-slate-900">{personLabel(f.childId)}</span>
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {ROLE_LABELS[f.role] ?? f.role}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/filiations/${f.id}/edit`}
                    className="rounded-sm border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                  >
                    Modifier
                  </Link>
                  <form action={deleteFiliationAction}>
                    <input type="hidden" name="id" value={f.id} />
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
