import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  geocodeSuggestions: vi.fn(),
}));

vi.mock("@/lib/geocode", () => mocks);

describe("GET /admin/geocode", () => {
  beforeEach(() => {
    mocks.geocodeSuggestions.mockReset();
  });

  it("retourne les suggestions pour une requête valide", async () => {
    mocks.geocodeSuggestions.mockResolvedValue([
      { label: "Paris, Île-de-France, France", latitude: 48.8566, longitude: 2.3522 },
    ]);

    const response = await GET(
      new Request("http://localhost/admin/geocode?q=Paris"),
    );

    expect(response.status).toBe(200);
    expect(mocks.geocodeSuggestions).toHaveBeenCalledWith("Paris");
    const body = await response.json();
    expect(body).toEqual({
      suggestions: [
        { label: "Paris, Île-de-France, France", latitude: 48.8566, longitude: 2.3522 },
      ],
    });
  });

  it("répond 400 si le paramètre q est absent ou vide", async () => {
    const noQuery = await GET(new Request("http://localhost/admin/geocode"));
    expect(noQuery.status).toBe(400);

    const emptyQuery = await GET(
      new Request("http://localhost/admin/geocode?q=%20%20"),
    );
    expect(emptyQuery.status).toBe(400);

    expect(mocks.geocodeSuggestions).not.toHaveBeenCalled();
  });

  it("répond 500 en cas d'erreur du fournisseur", async () => {
    mocks.geocodeSuggestions.mockRejectedValue(new Error("boom"));

    const response = await GET(
      new Request("http://localhost/admin/geocode?q=Paris"),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Échec du géocodage.");
  });
});
