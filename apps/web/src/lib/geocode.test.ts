import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildGeocodeUrl,
  getGeocodeProvider,
  getUserAgent,
  parseNominatimResponse,
  parsePhotonResponse,
  geocodeSuggestions,
  DEFAULT_GEOCODE_PROVIDER,
  DEFAULT_GEOCODE_USER_AGENT,
} from "./geocode";

describe("getGeocodeProvider", () => {
  it("retourne nominatim par défaut", () => {
    expect(getGeocodeProvider({})).toBe("nominatim");
    expect(getGeocodeProvider({ GEOCODE_PROVIDER: "inconnu" })).toBe(
      DEFAULT_GEOCODE_PROVIDER,
    );
  });

  it("retourne photon quand configuré", () => {
    expect(getGeocodeProvider({ GEOCODE_PROVIDER: "photon" })).toBe("photon");
  });
});

describe("getUserAgent", () => {
  it("utilise le user-agent par défaut si absent", () => {
    expect(getUserAgent({})).toBe(DEFAULT_GEOCODE_USER_AGENT);
  });

  it("utilise la valeur configurée", () => {
    expect(getUserAgent({ GEOCODE_USER_AGENT: "mon-ua" })).toBe("mon-ua");
  });
});

describe("buildGeocodeUrl", () => {
  it("construit l'URL Nominatim avec la requête encodée", () => {
    const url = buildGeocodeUrl("nominatim", "Paris, Île-de-France");
    expect(url.origin + url.pathname).toBe(
      "https://nominatim.openstreetmap.org/search",
    );
    expect(url.searchParams.get("q")).toBe("Paris, Île-de-France");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("limit")).toBe("5");
  });

  it("construit l'URL Photon avec la requête encodée", () => {
    const url = buildGeocodeUrl("photon", "Lyon");
    expect(url.origin + url.pathname).toBe("https://photon.komoot.io/api/");
    expect(url.searchParams.get("q")).toBe("Lyon");
    expect(url.searchParams.get("limit")).toBe("5");
  });
});

describe("parseNominatimResponse", () => {
  it("parse les entrées valides en suggestions", () => {
    const suggestions = parseNominatimResponse([
      { display_name: "Paris, Île-de-France, France", lat: "48.8566", lon: "2.3522" },
      { display_name: "Paris, Texas, États-Unis", lat: "33.6609", lon: "-95.5555" },
    ]);
    expect(suggestions).toEqual([
      { label: "Paris, Île-de-France, France", latitude: 48.8566, longitude: 2.3522 },
      { label: "Paris, Texas, États-Unis", latitude: 33.6609, longitude: -95.5555 },
    ]);
  });

  it("ignore les entrées invalides (coordonnées ou label manquants)", () => {
    expect(
      parseNominatimResponse([
        { display_name: "Sans coords" },
        { display_name: "Coordonnées invalides", lat: "abc", lon: "2.35" },
        "pas un objet",
        { display_name: "Valide", lat: "45", lon: "5" },
      ]),
    ).toEqual([{ label: "Valide", latitude: 45, longitude: 5 }]);
  });
});

describe("parsePhotonResponse", () => {
  it("parse les features en suggestions (coordonnées [lon, lat])", () => {
    const suggestions = parsePhotonResponse({
      features: [
        {
          properties: { name: "Paris", city: "Paris", country: "France" },
          geometry: { type: "Point", coordinates: [2.3522, 48.8566] },
        },
        {
          properties: { name: "Lyon", state: "Auvergne-Rhône-Alpes" },
          geometry: { type: "Point", coordinates: [4.8357, 45.764] },
        },
      ],
    });
    expect(suggestions).toEqual([
      { label: "Paris, France", latitude: 48.8566, longitude: 2.3522 },
      { label: "Lyon, Auvergne-Rhône-Alpes", latitude: 45.764, longitude: 4.8357 },
    ]);
  });

  it("ignore les features sans geometry ou sans label", () => {
    expect(
      parsePhotonResponse({
        features: [
          { properties: { name: "X" } },
          {
            properties: {},
            geometry: { type: "Point", coordinates: [2, 48] },
          },
          { properties: { name: "Ok" }, geometry: { coordinates: [3, 47] } },
        ],
      }),
    ).toEqual([{ label: "Ok", latitude: 47, longitude: 3 }]);
  });
});

describe("geocodeSuggestions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("interroge le fournisseur avec un User-Agent conforme et renvoie les suggestions", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          display_name: "Paris, Île-de-France, France",
          lat: "48.8566",
          lon: "2.3522",
        },
      ],
    });
    const now = vi.fn().mockReturnValue(1_000_000);

    const suggestions = await geocodeSuggestions("Paris", {
      env: { GEOCODE_PROVIDER: "nominatim", GEOCODE_USER_AGENT: "ua-test" },
      fetchFn,
      now,
    });

    expect(suggestions).toEqual([
      { label: "Paris, Île-de-France, France", latitude: 48.8566, longitude: 2.3522 },
    ]);
    const [url, init] = fetchFn.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toContain("nominatim.openstreetmap.org/search");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("ua-test");
  });

  it("met en cache et n'effectue pas de seconde requête réseau", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { display_name: "Lyon", lat: "45.764", lon: "4.8357" },
      ],
    });
    const now = vi.fn().mockReturnValue(1_000_000);

    const first = await geocodeSuggestions("Lyon", {
      env: { GEOCODE_PROVIDER: "nominatim" },
      fetchFn,
      now,
    });
    const second = await geocodeSuggestions("lyon ", {
      env: { GEOCODE_PROVIDER: "nominatim" },
      fetchFn,
      now,
    });

    expect(first).toEqual(second);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("gère le fournisseur photon", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: { name: "Lyon", country: "France" },
            geometry: { type: "Point", coordinates: [4.8357, 45.764] },
          },
        ],
      }),
    });
    const suggestions = await geocodeSuggestions("Lyon", {
      env: { GEOCODE_PROVIDER: "photon" },
      fetchFn,
      now: () => 1_000_000,
    });
    expect(suggestions).toEqual([
      { label: "Lyon, France", latitude: 45.764, longitude: 4.8357 },
    ]);
  });

  it("retourne une liste vide pour une requête vide", async () => {
    const fetchFn = vi.fn();
    const suggestions = await geocodeSuggestions("   ", {
      env: { GEOCODE_PROVIDER: "nominatim" },
      fetchFn,
      now: () => 1_000_000,
    });
    expect(suggestions).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("retourne une liste vide en cas d'erreur réseau (sans lever)", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValue(new Error("network down"));
    const suggestions = await geocodeSuggestions("Nantes", {
      env: { GEOCODE_PROVIDER: "photon" },
      fetchFn,
      now: () => 1_000_000,
    });
    expect(suggestions).toEqual([]);
  });
});
