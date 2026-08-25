"use client";

/**
 * Champ d'autocomplétion géocodante de villes/lieux (administration).
 *
 * Le composant porte les trois champs soumis au formulaire serveur parent :
 *   - `place` (champ texte visible, sert aussi au géocodage) ;
 *   - `latitude` / `longitude` (champs numériques, modifiables à la main).
 *
 * Comportement :
 *   - la saisie dans le champ lieu déclenche (avec debounce) un appel à la
 *     route proxy `/admin/geocode?q=...` ;
 *   - les suggestions viennent du serveur (jamais de clé côté client) ;
 *   - la sélection remplit `place` + `latitude` + `longitude` et appelle
 *     `onPlaceSelected(place, lat, lng)` ;
 *   - la saisie manuelle des coordonnées reste possible (champs numériques).
 *
 * Composant réutilisable : conçu pour être câblé aussi bien dans l'édition
 * d'événement que, à terme, dans l'édition d'union (une fois que le schéma
 * union portera place/coordonnées). Les noms de champs sont configurables.
 */
import { useEffect, useRef, useState } from "react";

export interface PlaceAutocompleteSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

export interface PlaceAutocompleteProps {
  /** id du champ « lieu » (pour la liaison label htmlFor). */
  inputId?: string;
  /** nom du champ « lieu ». Défaut : place. */
  placeName?: string;
  /** nom du champ « latitude ». Défaut : latitude. */
  latitudeName?: string;
  /** nom du champ « longitude ». Défaut : longitude. */
  longitudeName?: string;
  /** valeur initiale du lieu (édition). */
  defaultPlace?: string;
  /** coordonnées initiales (édition), conservées si l'utilisateur ne tape pas. */
  defaultLatitude?: number | null;
  defaultLongitude?: number | null;
  placeholder?: string;
  className?: string;
  /** Appelé à la sélection d'une suggestion. */
  onPlaceSelected?: (place: string, latitude: number, longitude: number) => void;
  /** Nombre minimal de caractères avant une recherche. Défaut : 2. */
  minChars?: number;
  /** Debounce de la recherche en ms. Défaut : 300. */
  debounceMs?: number;
  /** Affiche ou masque les champs de coordonnées. Défaut : true. */
  showCoordinates?: boolean;
}

const DEFAULT_MIN_CHARS = 2;
const DEFAULT_DEBOUNCE_MS = 300;

function toInputValue(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "" : String(value);
}

export default function PlaceAutocomplete({
  inputId,
  placeName = "place",
  latitudeName = "latitude",
  longitudeName = "longitude",
  defaultPlace = "",
  defaultLatitude = null,
  defaultLongitude = null,
  placeholder,
  className,
  onPlaceSelected,
  minChars = DEFAULT_MIN_CHARS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  showCoordinates = true,
}: PlaceAutocompleteProps) {
  const [placeValue, setPlaceValue] = useState(defaultPlace ?? "");
  const [latitudeValue, setLatitudeValue] = useState(
    () => toInputValue(defaultLatitude),
  );
  const [longitudeValue, setLongitudeValue] = useState(
    () => toInputValue(defaultLongitude),
  );

  const [suggestions, setSuggestions] = useState<PlaceAutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

  const requestId = useRef(0);

  // Recherche avec debounce + garde anti-course (évite qu'une réponse lente
  // n'écrase une saisie plus récente).
  useEffect(() => {
    const text = placeValue.trim();
    if (!open || text.length < minChars) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setError(false);

    const handle = setTimeout(async () => {
      const currentId = id;
      try {
        const response = await fetch(
          `/admin/geocode?q=${encodeURIComponent(text)}`,
        );
        if (requestId.current !== currentId) return;
        if (!response.ok) {
          setError(true);
          setSuggestions([]);
          return;
        }
        const data = (await response.json()) as {
          suggestions?: PlaceAutocompleteSuggestion[];
        };
        if (requestId.current !== currentId) return;
        setSuggestions(data.suggestions ?? []);
      } catch {
        if (requestId.current !== currentId) return;
        setError(true);
        setSuggestions([]);
      } finally {
        if (requestId.current === currentId) setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(handle);
  }, [placeValue, open, minChars, debounceMs]);

  const selectSuggestion = (suggestion: PlaceAutocompleteSuggestion) => {
    setPlaceValue(suggestion.label);
    setLatitudeValue(toInputValue(suggestion.latitude));
    setLongitudeValue(toInputValue(suggestion.longitude));
    setSuggestions([]);
    setOpen(false);
    onPlaceSelected?.(suggestion.label, suggestion.latitude, suggestion.longitude);
  };

  const handlePlaceChange = (value: string) => {
    // Toute modification manuelle du lieu réinitialise les coordonnées :
    // l'utilisateur doit choisir une suggestion ou saisir les coordonnées
    // à la main pour éviter de conserver des coordonnées obsolètes.
    setPlaceValue(value);
    setLatitudeValue("");
    setLongitudeValue("");
    setOpen(true);
  };

  const inputClass =
    "w-full rounded-sm border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className={className}>
      <div>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? "place-suggestions" : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          name={placeName}
          value={placeValue}
          onChange={(e) => handlePlaceChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder={placeholder}
          className={inputClass}
        />

        {open && placeValue.trim().length >= minChars && (
          <div
            id="place-suggestions"
            role="listbox"
            className="mt-1 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm"
          >
            {loading && (
              <p className="px-3 py-2 text-sm text-slate-400">
                Recherche de lieux…
              </p>
            )}

            {!loading && error && !suggestions.length && (
              <p className="px-3 py-2 text-sm text-red-600">
                La recherche de lieux est momentanément indisponible.
              </p>
            )}

            {!loading && !error && suggestions.length === 0 && (
              <p className="px-3 py-2 text-sm text-slate-400">Aucun résultat.</p>
            )}

            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.label}-${index}`}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  // onMouseDown pour sélectionner avant le blur du champ.
                  e.preventDefault();
                  selectSuggestion(suggestion);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
              >
                <span>{suggestion.label}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {suggestion.latitude.toFixed(4)},{" "}
                  {suggestion.longitude.toFixed(4)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCoordinates && (
        <div className="mt-1 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-slate-700">
            Latitude
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              name={latitudeName}
              value={latitudeValue}
              onChange={(e) => setLatitudeValue(e.target.value)}
              placeholder="Ex: 48.8566"
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Longitude
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              name={longitudeName}
              value={longitudeValue}
              onChange={(e) => setLongitudeValue(e.target.value)}
              placeholder="Ex: 2.3522"
              className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}
    </div>
  );
}
