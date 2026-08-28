import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

vi.mock("@testvibe/core", () => ({
  adminImportGedcom: vi.fn(),
  adminExportGedcom: vi.fn(),
}));

import GedcomPage from "./page";

describe("GedcomPage", () => {
  it("préserve import/export 5.5.1 dans des panneaux accessibles", async () => {
    render(await GedcomPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("gedcom-page")).toHaveClass("max-w-5xl");
    expect(screen.getByRole("region", { name: "Importer un fichier GEDCOM" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Exporter en GEDCOM" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fichier GEDCOM 5.5.1")).toBeRequired();
    expect(screen.getByRole("button", { name: "Importer" })).toHaveClass("min-h-11");
    expect(screen.getByRole("link", { name: "Télécharger le fichier .ged" })).toHaveClass("min-h-11");
  });

  it("annonce les retours atomiques", async () => {
    render(await GedcomPage({ searchParams: Promise.resolve({ error: "import_echoue", detail: "Ligne invalide" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Aucune donnée n’a été modifiée");

    render(await GedcomPage({ searchParams: Promise.resolve({ success: "import" }) }));
    expect(screen.getByRole("status")).toHaveTextContent("Import GEDCOM réussi");
  });
});