import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { adminImportGedcom, redirect } = vi.hoisted(() => ({
  adminImportGedcom: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("@testvibe/core", () => ({ adminImportGedcom }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/session", () => ({ requireAdminMutation: vi.fn() }));

import GedcomPage, { importGedcomAction } from "./page";

describe("GedcomPage", () => {
  beforeEach(() => vi.clearAllMocks());

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

  it("câble un import valide et permet de réessayer après une erreur sans mutation intermédiaire", async () => {
    const formData = (text: string) => ({
      get: () => ({ size: text.length, text: async () => text }),
    }) as unknown as FormData;
    adminImportGedcom.mockRejectedValueOnce(new Error("Ligne invalide")).mockResolvedValueOnce(undefined);

    await expect(importGedcomAction(formData("0 HEAD"))).rejects.toThrow(
      "NEXT_REDIRECT:/admin/gedcom?error=import_echoue&detail=Ligne%20invalide",
    );
    await expect(importGedcomAction(formData("0 HEAD\n0 TRLR"))).rejects.toThrow(
      "NEXT_REDIRECT:/admin/gedcom?success=import",
    );

    expect(adminImportGedcom).toHaveBeenNthCalledWith(1, "0 HEAD");
    expect(adminImportGedcom).toHaveBeenNthCalledWith(2, "0 HEAD\n0 TRLR");
  });
});