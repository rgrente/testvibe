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
    expect(header?.querySelector(":scope > div > div")?.textContent).toBe("Genealogie");
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
});
