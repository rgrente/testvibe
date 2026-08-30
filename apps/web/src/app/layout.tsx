import "./globals.css";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { version } from "../../../../package.json";
import { AppShell } from "../components/AppShell";

const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans" });
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${instrumentSans.variable} ${jetBrainsMono.variable} overflow-x-clip`}>
      <body className="family-tree-sans grid min-h-screen min-w-0 grid-rows-[auto_1fr_auto] overflow-x-hidden bg-[var(--color-surface)] pb-[60px] text-[var(--color-ink)] md:pb-0">
        <AppShell />
        <div data-mobile-grid-slot aria-hidden="true" className="h-0 md:hidden" />
        {children}
        <footer className="border-t border-[var(--color-border)] bg-[var(--color-canvas)] py-3 text-center text-xs text-[var(--color-muted)]">
          <div className="page-container">Version {version} · Fait avec ❤️</div>
        </footer>
      </body>
    </html>
  );
}
