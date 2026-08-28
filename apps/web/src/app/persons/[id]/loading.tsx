export default function PersonLoading() {
  return (
    <main className="mx-auto w-full max-w-[420px] px-4 py-8 sm:px-6">
      <div role="status" className="animate-pulse overflow-hidden rounded-xl border border-slate-200 bg-white p-5 text-slate-600">
        <span className="sr-only">Chargement de la fiche personne…</span>
        <div className="h-12 w-12 rounded-xl bg-slate-200" aria-hidden="true" />
        <div className="mt-5 h-10 rounded-lg bg-slate-100" aria-hidden="true" />
        <div className="mt-6 space-y-2" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-10 rounded-lg bg-slate-100" />)}
        </div>
      </div>
    </main>
  );
}
