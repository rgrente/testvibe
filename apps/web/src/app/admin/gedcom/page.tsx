import { adminImportGedcom, adminExportGedcom } from "@testvibe/core";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ─── Server Actions ──────────────────────────────────────────────────────────

async function importGedcomAction(formData: FormData) {
  "use server";

  const file = formData.get("gedcom") as File | null;
  if (!file || file.size === 0) {
    redirect("/admin/gedcom?error=fichier_manquant");
  }

  try {
    const text = await file!.text();
    await adminImportGedcom(text);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    // Encode le message d'erreur dans la query string (tronqué pour sécurité)
    const encoded = encodeURIComponent(message.slice(0, 200));
    redirect(`/admin/gedcom?error=import_echoue&detail=${encoded}`);
  }

  redirect("/admin/gedcom?success=import");
}

// ─── Page ──────────────────────────────────────────────────────────────────────

interface SearchParamsType {
  error?: string;
  detail?: string;
  success?: string;
}

export default async function GedcomPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsType>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Import / Export GEDCOM</h1>
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-800 underline">
          ← Mode édition
        </Link>
      </div>

      {params.error === "fichier_manquant" && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Veuillez sélectionner un fichier .ged avant de soumettre.
        </div>
      )}

      {params.error === "import_echoue" && (
        <div className="mb-4 rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Échec de l&apos;import GEDCOM</p>
          {params.detail && (
            <p className="mt-1 font-mono text-xs">{decodeURIComponent(params.detail)}</p>
          )}
          <p className="mt-1 text-xs">Aucune donnée n&apos;a été modifiée (opération atomique).</p>
        </div>
      )}

      {params.success === "import" && (
        <div className="mb-4 rounded-sm border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Import GEDCOM réussi. Les données ont été ajoutées à la base.
        </div>
      )}

      {/* Import */}
      <section className="mb-8 rounded-lg border border-slate-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Importer un fichier GEDCOM</h2>
        <p className="mb-4 text-sm text-slate-600">
          Sélectionnez un fichier <code className="rounded-sm bg-slate-100 px-1 py-0.5 text-xs">.ged</code>{" "}
          au format GEDCOM 5.5.1. L&apos;import est atomique : en cas d&apos;erreur, aucune donnée
          existante ne sera modifiée.
        </p>
        <form action={importGedcomAction} className="flex flex-col gap-4">
          <input
            type="file"
            name="gedcom"
            accept=".ged,.gedcom"
            required
            className="block w-full text-sm text-slate-600 file:mr-4 file:cursor-pointer file:rounded-sm file:border file:border-slate-200 file:bg-white file:px-4 file:py-2 file:text-sm file:text-slate-700 hover:file:bg-slate-50"
          />
          <div>
            <button
              type="submit"
              className="rounded-sm bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
            >
              Importer
            </button>
          </div>
        </form>
      </section>

      {/* Export */}
      <section className="rounded-lg border border-slate-200 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Exporter en GEDCOM</h2>
        <p className="mb-4 text-sm text-slate-600">
          Téléchargez l&apos;intégralité des données (personnes, unions, filiations) au format GEDCOM
          5.5.1.
        </p>
        <Link
          href="/admin/gedcom/export"
          className="inline-block rounded-sm bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
        >
          Télécharger le fichier .ged
        </Link>
      </section>
    </main>
  );
}
