import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-5xl text-lg font-semibold text-slate-900">Genealogie</div>
        </header>
        {children}
      </body>
    </html>
  );
}
