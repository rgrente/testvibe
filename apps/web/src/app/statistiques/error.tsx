"use client";

export default function StatisticsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-xl font-semibold">Impossible de charger les statistiques</h1>
        <p className="mt-2 text-sm text-red-700">Une erreur inattendue est survenue. Vous pouvez réessayer.</p>
        <button type="button" onClick={reset} className="mt-5 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
          Réessayer
        </button>
      </div>
    </main>
  );
}
