import { beforeEach, describe, expect, it, vi } from "vitest";

const { adminExportGedcom } = vi.hoisted(() => ({ adminExportGedcom: vi.fn() }));

vi.mock("@testvibe/core", () => ({ adminExportGedcom }));

import { GET } from "./route";

describe("GET /admin/gedcom/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("déclenche l’export 5.5.1 et renvoie un fichier GEDCOM téléchargeable", async () => {
    adminExportGedcom.mockResolvedValue("0 HEAD\n0 TRLR");

    const response = await GET();

    expect(adminExportGedcom).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="arbre-genealogique.ged"');
    expect(await response.text()).toBe("0 HEAD\n0 TRLR");
  });

  it("signale une erreur contrôlée sans produire de téléchargement", async () => {
    adminExportGedcom.mockRejectedValue(new Error("export indisponible"));

    const response = await GET();

    expect(response.status).toBe(500);
    expect(response.headers.get("content-disposition")).toBeNull();
  });
});
