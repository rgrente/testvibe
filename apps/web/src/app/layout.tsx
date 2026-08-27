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
    <html lang="fr" className={`${instrumentSans.variable} ${jetBrainsMono.variable}`}>
      <body className="family-tree-sans grid min-h-screen grid-rows-[auto_1fr_auto] overflow-x-hidden bg-[var(--color-surface)] pb-[60px] text-[var(--color-ink)] md:pb-0">
        <AppShell />
        <div data-mobile-grid-slot aria-hidden="true" className="h-0 md:hidden" />
        {children}
        <footer className="border-t border-[var(--color-border)] bg-[var(--color-canvas)] px-4 py-3 text-center text-xs text-[var(--color-muted)] sm:px-6">
          Version {version} · Fait avec ❤️
        </footer>
      </body>
    </html>
  );
}
