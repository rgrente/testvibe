import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    pathname = "/";
  });

  it("conserve toutes les routes et expose la route active autrement que par la couleur", () => {
    pathname = "/timeline";
    render(<AppShell />);

    const desktopNavigation = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(
      Array.from(desktopNavigation.querySelectorAll("a")).map((link) => link.getAttribute("href")),
    ).toEqual(["/", "/timeline", "/ce-jour-la", "/carte", "/statistiques", "/admin"]);

    const activeLinks = screen.getAllByRole("link", { name: "Timeline" });
    expect(activeLinks).toHaveLength(2);
    for (const link of activeLinks) {
      expect(link).toHaveAttribute("aria-current", "page");
      expect(link).toHaveClass("font-semibold");
    }
  });

  it("rend un header de 52 px à partir de 768 px et une barre basse de 60 px en dessous", () => {
    render(<AppShell />);

    expect(screen.getByTestId("desktop-header")).toHaveClass("hidden", "h-[52px]", "md:flex");
    expect(screen.getByRole("navigation", { name: "Navigation mobile" })).toHaveClass(
      "h-[60px]",
      "md:hidden",
    );
  });

  it("offre des cibles mobiles de 44 px et un focus clavier visible", () => {
    render(<AppShell />);

    const mobileNavigation = screen.getByRole("navigation", { name: "Navigation mobile" });
    for (const link of Array.from(mobileNavigation.querySelectorAll("a"))) {
      expect(link).toHaveClass("min-h-11", "focus-visible:outline-2");
    }
  });

  it("suit l’ordre visuel au clavier et active les liens avec Entrée", async () => {
    const user = userEvent.setup();
    render(<AppShell />);

    const brand = screen.getByRole("link", { name: "Genealogie" });
    const desktopNavigation = screen.getByRole("navigation", { name: "Navigation principale" });
    const desktopTree = desktopNavigation.querySelector<HTMLAnchorElement>('a[href="/"]');
    expect(desktopTree).not.toBeNull();

    await user.tab();
    expect(brand).toHaveFocus();
    await user.tab();
    expect(desktopTree).toHaveFocus();
    await user.tab({ shift: true });
    expect(brand).toHaveFocus();

    const onActivate = vi.fn((event: Event) => event.preventDefault());
    desktopTree?.addEventListener("click", onActivate);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onActivate).toHaveBeenCalledOnce();
  });
});
