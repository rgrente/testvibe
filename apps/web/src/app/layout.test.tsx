import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { version } from "../../../../package.json";
import AdminLayout from "./admin/layout";
import RootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Instrument_Sans: () => ({ variable: "instrument-sans-variable" }),
  JetBrains_Mono: () => ({ variable: "jetbrains-mono-variable" }),
}));

describe("RootLayout", () => {
  it("affiche le nom du site dans un header global avant le contenu", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Contenu de la page</main>
      </RootLayout>,
    );
    const document = new DOMParser().parseFromString(markup, "text/html");
    const header = document.querySelector("body > header");
    const main = document.querySelector("body > main");

    expect(header).not.toBeNull();
    expect(header?.querySelector(':scope > a[href="/"]')?.textContent).toContain("Genealogie");
    expect(document.querySelector('nav[aria-label="Navigation mobile"]')?.nextElementSibling).toBe(main);
    expect(header?.classList.contains("border-b")).toBe(true);
    expect(header?.classList.contains("h-[52px]")).toBe(true);
    expect(header?.classList.contains("md:flex")).toBe(true);
  });

  it("propose la Timeline dans la navigation principale", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Contenu de la page</main>
      </RootLayout>,
    );
    const document = new DOMParser().parseFromString(markup, "text/html");
    const timelineLink = document.querySelector('header nav a[href="/timeline"]');

    expect(timelineLink?.textContent).toBe("Timeline");
  });

  it("rend l'arbre accessible depuis le nom du site et à côté de la Timeline", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Contenu de la page</main>
      </RootLayout>,
    );
    const document = new DOMParser().parseFromString(markup, "text/html");
    const siteLink = document.querySelector('header a[href="/"]');
    const navigationLinks = Array.from(document.querySelectorAll("header nav a"));

    expect(siteLink?.textContent).toBe("Genealogie");
    expect(navigationLinks.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Arbre", "/"],
      ["Timeline", "/timeline"],
      ["Ce jour-là", "/ce-jour-la"],
      ["Carte", "/carte"],
      ["Statistiques", "/statistiques"],
      ["Mode édition", "/admin"],
    ]);
  });

  it("adapte la navigation aux petits écrans sans débordement horizontal", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Contenu de la page</main>
      </RootLayout>,
    );
    const document = new DOMParser().parseFromString(markup, "text/html");
    const header = document.querySelector("header");
    const navigation = document.querySelector('nav[aria-label="Navigation mobile"]');
    const body = document.querySelector("body");

    expect(header?.classList.contains("hidden")).toBe(true);
    expect(header?.classList.contains("md:flex")).toBe(true);
    expect(navigation?.classList.contains("md:hidden")).toBe(true);
    expect(navigation?.classList.contains("h-[60px]")).toBe(true);
    expect(body?.classList.contains("overflow-x-hidden")).toBe(true);
  });

  it("affiche un footer global discret avec la version de l'application", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <main>Contenu de la page</main>
      </RootLayout>,
    );
    const document = new DOMParser().parseFromString(markup, "text/html");
    const body = document.querySelector("body");
    const footer = document.querySelector("body > footer");

    expect(footer?.textContent).toContain(`Version ${version}`);
    expect(footer?.textContent).toContain("Fait avec ❤️");
    expect(footer?.classList.contains("text-xs")).toBe(true);
    expect(footer?.classList.contains("text-[var(--color-muted)]")).toBe(true);
    expect(body?.classList.contains("min-h-screen")).toBe(true);
    expect(body?.classList.contains("grid-rows-[auto_1fr_auto]")).toBe(true);
  });

  it("conserve trois lignes de grille avec le layout imbriqué de l'administration", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <AdminLayout>
          <main>{"Contenu de la page d'administration"}</main>
        </AdminLayout>
      </RootLayout>,
    );
    const document = new DOMParser().parseFromString(markup, "text/html");
    const bodyChildren = Array.from(document.body.children).filter(
      (element) => element.tagName !== "SCRIPT",
    );
    const adminLayout = bodyChildren[2];

    expect(bodyChildren.map((element) => element.tagName)).toEqual(["HEADER", "NAV", "DIV", "FOOTER"]);
    expect(adminLayout?.querySelector(":scope > nav")).not.toBeNull();
    expect(adminLayout?.querySelector(":scope > main")?.textContent).toBe(
      "Contenu de la page d'administration",
    );
  });
});
