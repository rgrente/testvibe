export default function TimelineLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div role="status" className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
        <span className="sr-only">Chargement de la chronologie…</span>
        <div className="h-5 w-48 rounded-sm bg-slate-200" aria-hidden="true" />
        <div className="mt-6 space-y-2" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-9 rounded-sm bg-slate-100" />)}
        </div>
      </div>
    </main>
  );
}