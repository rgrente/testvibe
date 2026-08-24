/**
 * Utilitaires géographiques partagés par les entités portant un lieu
 * (Event, Union) : normalisation du texte et validation des coordonnées WGS84.
 */
import { ValidationError } from "./errors.js";

const WGS84_LAT_MIN = -90;
const WGS84_LAT_MAX = 90;
const WGS84_LNG_MIN = -180;
const WGS84_LNG_MAX = 180;

export function normalizePlace(place: string | null | undefined): string | null {
  const normalized = place?.trim();
  return normalized ? normalized : null;
}

export function assertValidCoordinates(
  lat: number | undefined | null,
  lng: number | undefined | null,
): void {
  if ((lat == null) !== (lng == null)) {
    throw new ValidationError("latitude et longitude doivent être renseignées ensemble.");
  }
  if (lat != null) {
    if (typeof lat !== "number" || !Number.isFinite(lat)) {
      throw new ValidationError("latitude doit être un nombre fini.");
    }
    if (lat < WGS84_LAT_MIN || lat > WGS84_LAT_MAX) {
      throw new ValidationError(
        `latitude hors bornes WGS84 : ${lat} (attendu entre ${WGS84_LAT_MIN} et ${WGS84_LAT_MAX}).`,
      );
    }
  }
  if (lng != null) {
    if (typeof lng !== "number" || !Number.isFinite(lng)) {
      throw new ValidationError("longitude doit être un nombre fini.");
    }
    if (lng < WGS84_LNG_MIN || lng > WGS84_LNG_MAX) {
      throw new ValidationError(
        `longitude hors bornes WGS84 : ${lng} (attendu entre ${WGS84_LNG_MIN} et ${WGS84_LNG_MAX}).`,
      );
    }
  }
}
