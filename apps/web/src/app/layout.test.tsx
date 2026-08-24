import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "./layout";

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
    expect(header?.classList.contains("px-4")).toBe(true);
    expect(header?.classList.contains("sm:px-6")).toBe(true);
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
    expect(navigation?.classList.contains("gap-y-2")).toBe(true);
  });
});
