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
    expect(header?.querySelector(':scope > div > a[href="/"]')?.textContent).toBe("Genealogie");
    expect(header?.nextElementSibling).toBe(main);
    expect(header?.classList.contains("border-b")).toBe(true);
    expect(header?.querySelector(":scope > .page-container")).not.toBeNull();
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
    const headerContent = document.querySelector("header > div");
    const navigation = headerContent?.querySelector("nav");

    expect(headerContent?.classList.contains("flex-col")).toBe(true);
    expect(headerContent?.classList.contains("sm:flex-row")).toBe(true);
    expect(navigation?.classList.contains("flex-wrap")).toBe(true);
    expect(navigation?.classList.contains("gap-1")).toBe(true);
    expect(headerContent?.classList.contains("page-container")).toBe(true);
    for (const link of Array.from(navigation?.querySelectorAll("a") ?? [])) {
      expect(link.classList.contains("min-h-11")).toBe(true);
      expect(link.classList.contains("text-base")).toBe(true);
      expect(link.className).toContain("focus-visible:");
    }
  });

  it("borne le document et aligne le footer sur le conteneur de lecture", () => {
    const markup = renderToStaticMarkup(<RootLayout><main>Contenu</main></RootLayout>);
    const document = new DOMParser().parseFromString(markup, "text/html");

    expect(document.documentElement.classList.contains("overflow-x-clip")).toBe(true);
    expect(document.body.classList.contains("min-w-0")).toBe(true);
    expect(document.querySelector("footer > div")?.classList.contains("page-container")).toBe(true);
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
    expect(footer?.classList.contains("text-slate-400")).toBe(true);
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
    const adminLayout = bodyChildren[1];

    expect(bodyChildren.map((element) => element.tagName)).toEqual(["HEADER", "DIV", "FOOTER"]);
    expect(adminLayout?.querySelector(":scope > nav")).not.toBeNull();
    expect(adminLayout?.querySelector(":scope > main")?.textContent).toBe(
      "Contenu de la page d'administration",
    );
  });
});
