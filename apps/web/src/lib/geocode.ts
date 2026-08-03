/**
 * Client fournisseur de géocodage (côté serveur uniquement).
 *
 * Sert de proxy vers un fournisseur de géocodage public configurable :
 *   - `GEOCODE_PROVIDER=nominatim` (défaut) → OpenStreetMap Nominatim
 *   - `GEOCODE_PROVIDER=photon`    → Photon / Komoot
 *
 * ⚠️ Confidentialité : l'utilisation de ce module envoie la chaîne de ville
 * saisie à un tiers public (l'éditeur du fournisseur). Cette divulgation est
 * documentée dans `.env.example`. Le choix définitif du fournisseur pour la
 * PRODUCTION fait l'objet d'un gate humain distinct (hors implémentation).
 *
 * Politique de bon usage (Nominatim) :
 *   - User-Agent explicite et conforme (identification de l'application).
 *   - Rate-limit : au maximum 1 requête/seconde vers Nominatim.
 *   - Cache en mémoire des réponses pour éviter les appels redondants.
 *
 * Ce module s'exécute dans le runtime Node (jamais importé par le middleware
 * Edge — `middleware.ts` reste exempt de toute dépendance Node-only).
 */
export type GeocodeProvider = "nominatim" | "photon";

export interface GeocodeSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

export interface GeocodeOptions {
  /** Variables d'environnement (injectables pour les tests). */
  env?: Record<string, string | undefined>;
  /** Fonction fetch (injectable pour les tests). */
  fetchFn?: typeof fetch;
  /** Horloge (injectable pour tester le rate-limit). */
  now?: () => number;
}

export const DEFAULT_GEOCODE_PROVIDER: GeocodeProvider = "nominatim";

export const DEFAULT_GEOCODE_USER_AGENT =
  "testvibe-web/0.1 (admin geocoding; contact: https://github.com/rgrente/testvibe)";

/** Intervalle minimum entre deux requêtes Nominatim (~1 req/s). */
const NOMINATIM_MIN_INTERVAL_MS = 1000;

/** Nombre de résultats demandé au fournisseur. */
const LIMIT = 5;

const PROVIDER_URLS: Record<GeocodeProvider, (q: string) => URL> = {
  nominatim: (q) => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(LIMIT));
    url.searchParams.set("q", q);
    return url;
  },
  photon: (q) => {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("limit", String(LIMIT));
    url.searchParams.set("q", q);
    return url;
  },
};

/** Cache en mémoire : clé = `${provider}:${query normalisée}`. */
const cache = new Map<string, GeocodeSuggestion[]>();

/** Horodatage de la dernière requête réelle envoyée (throttling Nominatim). */
let lastProviderRequestAt = 0;

/**
 * Résout le fournisseur configuré par l'environnement.
 * Toute valeur inconnue retombe sur `nominatim` (défaut).
 */
export function getGeocodeProvider(
  env: Record<string, string | undefined> = process.env,
): GeocodeProvider {
  return env.GEOCODE_PROVIDER === "photon" ? "photon" : DEFAULT_GEOCODE_PROVIDER;
}

/** Résout le User-Agent envoyé au fournisseur. */
export function getUserAgent(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.GEOCODE_USER_AGENT?.trim() || DEFAULT_GEOCODE_USER_AGENT;
}

/** Construit l'URL d'interrogation du fournisseur (exposé pour les tests). */
export function buildGeocodeUrl(provider: GeocodeProvider, query: string): URL {
  return PROVIDER_URLS[provider](query);
}

/** Normalise une chaîne de recherche pour la clé de cache. */
function cacheKey(provider: GeocodeProvider, query: string): string {
  return `${provider}:${query.trim().toLowerCase()}`;
}

/** Attend l'intervalle minimum entre deux requêtes Nominatim. */
async function enforceRateLimit(
  provider: GeocodeProvider,
  now: () => number,
): Promise<void> {
  if (provider !== "nominatim") return;
  const elapsed = now() - lastProviderRequestAt;
  if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - elapsed),
    );
  }
  lastProviderRequestAt = now();
}

interface NominatimResult {
  display_name?: string;
  lat?: string;
  lon?: string;
}

/** Parse la réponse JSON de Nominatim en suggestions valides. */
export function parseNominatimResponse(data: unknown): GeocodeSuggestion[] {
  if (!Array.isArray(data)) return [];
  const suggestions: GeocodeSuggestion[] = [];
  for (const item of data as NominatimResult[]) {
    if (!item || typeof item !== "object") continue;
    const label = item.display_name?.trim();
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    suggestions.push({ label, latitude, longitude });
  }
  return suggestions;
}

interface PhotonFeature {
  properties?: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    osm_value?: string;
  };
  geometry?: { type?: string; coordinates?: number[] };
}

/** Construit un libellé lisible à partir des propriétés Photon. */
function photonLabel(properties: PhotonFeature["properties"]): string {
  const parts: string[] = [];
  for (const key of ["name", "city", "state", "country"] as const) {
    const value = properties?.[key]?.trim();
    if (value && !parts.includes(value)) parts.push(value);
  }
  return parts.join(", ");
}

/** Parse la réponse JSON de Photon en suggestions valides. */
export function parsePhotonResponse(data: unknown): GeocodeSuggestion[] {
  if (!data || typeof data !== "object" || !("features" in data)) return [];
  const features = (data as { features?: unknown[] }).features;
  if (!Array.isArray(features)) return [];

  const suggestions: GeocodeSuggestion[] = [];
  for (const feature of features as PhotonFeature[]) {
    if (!feature || typeof feature !== "object") continue;
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    // Photon renvoie [lon, lat].
    const longitude = Number(coords[0]);
    const latitude = Number(coords[1]);
    const label = photonLabel(feature.properties);
    if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }
    suggestions.push({ label, latitude, longitude });
  }
  return suggestions;
}

async function fetchSuggestions(
  provider: GeocodeProvider,
  query: string,
  options: Required<Pick<GeocodeOptions, "env" | "fetchFn">> & { now: () => number },
): Promise<GeocodeSuggestion[]> {
  const url = buildGeocodeUrl(provider, query);
  let response: Response;
  try {
    response = await options.fetchFn(url, {
      headers: { "User-Agent": getUserAgent(options.env) },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Erreur réseau/abandon : on retombe sur la saisie manuelle.
    return [];
  }
  if (!response.ok) {
    return [];
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return [];
  }
  if (provider === "photon") {
    return parsePhotonResponse(data);
  }
  return parseNominatimResponse(data);
}

/**
 * Interroge le fournisseur configuré et renvoie des suggestions normalisées
 * `{ label, latitude, longitude }`. Respecte le rate-limit et stocke les
 * réponses en cache en mémoire. Les erreurs réseau/parse ne sont jamais
 * propagées : elles renvoient une liste vide (l'UI retombe alors sur la
 * saisie manuelle).
 */
export async function geocodeSuggestions(
  query: string,
  options: GeocodeOptions = {},
): Promise<GeocodeSuggestion[]> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? Date.now;

  const trimmed = query.trim();
  if (!trimmed) return [];

  const provider = getGeocodeProvider(env);
  const key = cacheKey(provider, trimmed);

  const cached = cache.get(key);
  if (cached) return cached;

  await enforceRateLimit(provider, now);
  const suggestions = await fetchSuggestions(provider, trimmed, {
    env,
    fetchFn,
    now,
  });

  cache.set(key, suggestions);
  return suggestions;
}
