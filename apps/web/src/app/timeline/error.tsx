"use client";

export default function TimelineError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-950">
        <h1 className="text-xl font-semibold">Impossible de charger la chronologie</h1>
        <p className="mt-2 text-sm text-red-800">Une erreur inattendue est survenue.</p>
        <button type="button" onClick={reset} className="mt-5 rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-red-900">
          Réessayer
        </button>
      </div>
    </main>
  );
}