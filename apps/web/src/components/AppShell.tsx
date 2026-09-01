"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const publicRoutes = [
  { href: "/", label: "Arbre", mobileLabel: "Arbre" },
  { href: "/timeline", label: "Timeline", mobileLabel: "Timeline" },
  { href: "/ce-jour-la", label: "Ce jour-là", mobileLabel: "Ce jour-là" },
  { href: "/carte", label: "Carte", mobileLabel: "Carte" },
  { href: "/statistiques", label: "Statistiques", mobileLabel: "Stats" },
] as const;

function isCurrentRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/persons/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navigationLinkClass(active: boolean, mobile = false) {
  const common =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]";
  if (mobile) {
    return `${common} flex min-h-11 min-w-0 items-center justify-center border-t-2 px-0.5 text-center text-[11px] sm:text-xs ${
      active
        ? "border-[var(--color-ink)] font-semibold text-[var(--color-ink)]"
        : "border-transparent font-medium text-[var(--color-muted)]"
    }`;
  }
  return `${common} rounded-md px-3 py-1.5 text-xs ${
    active
      ? "bg-[var(--color-surface)] font-semibold text-[var(--color-ink)] shadow-xs"
      : "font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
  }`;
}

export function AppShell() {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const editLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    editLinkRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMoreOpen(false);
      moreButtonRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [moreOpen]);

  return (
    <>
      <header
        data-testid="desktop-header"
        className="hidden h-[52px] items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 md:flex"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          <span aria-hidden="true" className="size-5 rounded-[var(--radius-sm)] bg-[var(--color-ink)]" />
          Genealogie
        </Link>
        <nav
          aria-label="Navigation principale"
          className="ml-auto flex items-center gap-0.5 rounded-[var(--radius-md)] bg-[var(--color-canvas)] p-0.5"
        >
          {publicRoutes.map(({ href, label }) => {
            const active = isCurrentRoute(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={navigationLinkClass(active)}
              >
                {label}
              </Link>
            );
          })}
          <Link
            href="/admin"
            aria-current={pathname.startsWith("/admin") ? "page" : undefined}
            className={`${navigationLinkClass(pathname.startsWith("/admin"))} ml-2 border border-[var(--color-border-strong)]`}
          >
            Mode édition
          </Link>
        </nav>
      </header>

      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-50 grid h-[60px] grid-cols-6 overflow-x-hidden border-t border-[var(--color-border)] bg-[var(--color-surface)] px-1 md:hidden"
      >
        {publicRoutes.map(({ href, label, mobileLabel }) => {
          const active = isCurrentRoute(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={navigationLinkClass(active, true)}
            >
              {mobileLabel}
            </Link>
          );
        })}
        <div className="relative min-w-0">
          <button
            ref={moreButtonRef}
            type="button"
            aria-expanded={moreOpen}
            aria-controls="mobile-more-menu"
            className={`${navigationLinkClass(pathname.startsWith("/admin"), true)} w-full`}
            onClick={() => setMoreOpen((open) => !open)}
          >
            Plus
          </button>
          {moreOpen ? (
            <div
              id="mobile-more-menu"
              className="absolute bottom-[calc(100%+0.5rem)] right-0 w-max rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg"
            >
              <Link
                ref={editLinkRef}
                href="/admin"
                className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                onClick={() => setMoreOpen(false)}
              >
                Mode édition
              </Link>
            </div>
          ) : null}
        </div>
      </nav>
    </>
  );
}
