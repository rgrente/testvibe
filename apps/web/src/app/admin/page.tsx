import { adminListPersons, adminListUnions, adminListFiliations } from "@testvibe/core";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Page d'accueil du mode édition protégé (Phase 3, tâche #22).
 * Accessible uniquement après authentification via /admin/login.
 */
export default async function AdminPage() {
  const [persons, unions, filiations] = await Promise.all([
    adminListPersons(),
    adminListUnions(),
    adminListFiliations(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Mode édition</h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {/* Personnes */}
        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-2 font-semibold text-slate-800">Personnes</h2>
          <p className="mb-4 text-2xl font-bold text-slate-900">{persons.length}</p>
          <Link
            href="/admin/persons"
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            Gérer →
          </Link>
        </section>

        {/* Unions */}
        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-2 font-semibold text-slate-800">Unions</h2>
          <p className="mb-4 text-2xl font-bold text-slate-900">{unions.length}</p>
          <Link
            href="/admin/unions"
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            Gérer →
          </Link>
        </section>

        {/* Filiations */}
        <section className="rounded-lg border border-slate-200 p-4">
          <h2 className="mb-2 font-semibold text-slate-800">Filiations</h2>
          <p className="mb-4 text-2xl font-bold text-slate-900">{filiations.length}</p>
          <Link
            href="/admin/filiations"
            className="text-sm text-slate-600 underline hover:text-slate-900"
          >
            Gérer →
          </Link>
        </section>
      </div>

      <p className="mt-8 text-sm text-slate-500">
        <Link href="/" className="underline hover:text-slate-800">
          ← Retour à la consultation
        </Link>
      </p>
    </main>
  );
}
