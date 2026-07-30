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
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link href="/" className="text-lg font-semibold text-slate-900">
              Genealogie
            </Link>
            <nav aria-label="Navigation principale" className="flex items-center gap-4">
              <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Arbre
              </Link>
              <Link href="/timeline" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Timeline
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
