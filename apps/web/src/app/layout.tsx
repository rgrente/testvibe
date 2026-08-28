import "./globals.css";
import Link from "next/link";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { version } from "../../../../package.json";

const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${instrumentSans.variable} ${jetBrainsMono.variable} overflow-x-clip`}>
      <body className="grid min-h-screen min-w-0 grid-rows-[auto_1fr_auto]">
        <header className="border-b border-slate-200 bg-white py-3">
          <div className="page-container flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-lg font-semibold text-slate-900">
              Genealogie
            </Link>
            <nav
              aria-label="Navigation principale"
              className="flex w-full flex-wrap items-center gap-1 sm:w-auto"
            >
              <Link href="/" className="inline-flex min-h-11 min-w-11 items-center rounded-md px-3 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                Arbre
              </Link>
              <Link href="/timeline" className="inline-flex min-h-11 min-w-11 items-center rounded-md px-3 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                Timeline
              </Link>
              <Link href="/ce-jour-la" className="inline-flex min-h-11 min-w-11 items-center rounded-md px-3 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                Ce jour-là
              </Link>
              <Link href="/carte" className="inline-flex min-h-11 min-w-11 items-center rounded-md px-3 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                Carte
              </Link>
              <Link href="/statistiques" className="inline-flex min-h-11 min-w-11 items-center rounded-md px-3 text-base font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                Statistiques
              </Link>
              <Link
                href="/admin"
                className="inline-flex min-h-11 min-w-11 items-center rounded-md border border-slate-300 px-3 text-base font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Mode édition
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t border-slate-200 bg-slate-50 py-3 text-center text-xs text-slate-400">
          <div className="page-container">Version {version} · Fait avec ❤️</div>
        </footer>
      </body>
    </html>
  );
}
