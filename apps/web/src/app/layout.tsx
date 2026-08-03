import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-lg font-semibold text-slate-900">
              Genealogie
            </Link>
            <nav
              aria-label="Navigation principale"
              className="flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Arbre
              </Link>
              <Link href="/timeline" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Timeline
              </Link>
              <Link href="/carte" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Carte
              </Link>
              <Link
                href="/admin"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
              >
                Mode édition
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
