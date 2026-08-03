"use client";

import { useEffect, useMemo, useState } from "react";
import type { MapLocation } from "@testvibe/core";

interface MapClientProps {
  locations: MapLocation[];
  selectedPersonIds: number[];
  dateFrom: string;
  dateTo: string;
  branchMode: "none" | "ancestors" | "descendants";
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onBranchModeChange: (v: "none" | "ancestors" | "descendants") => void;
  allPersons: { id: number; name: string }[];
  selectedPersonId: number | null;
  onSelectPerson: (id: number | null) => void;
}

export interface EventDateRange {
  start: number;
  end: number;
}

/** Interprète les dates partielles du domaine comme un intervalle inclusif. */
export function getEventDateRange(date: string | null): EventDateRange | null {
  if (!date) return null;

  const yearMatch = /^(\d{4})$/.exec(date);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return {
      start: Date.UTC(year, 0, 1),
      end: Date.UTC(year, 11, 31, 23, 59, 59, 999),
    };
  }

  const monthMatch = /^(\d{4})-(\d{2})$/.exec(date);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month < 1 || month > 12) return null;
    return {
      start: Date.UTC(year, month - 1, 1),
      end: Date.UTC(year, month, 1) - 1,
    };
  }

  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) return null;
  return { start: timestamp, end: timestamp };
}

export function filterMapLocations(
  locations: MapLocation[],
  selectedPersonIds: number[],
  selectedPersonId: number | null,
  branchMode: "none" | "ancestors" | "descendants",
  dateFrom: string,
  dateTo: string,
): MapLocation[] {
  const fromTimestamp = dateFrom ? Date.parse(dateFrom) : null;
  const toTimestamp = dateTo ? Date.parse(dateTo) : null;

  return locations.filter((loc) => {
    if (branchMode !== "none") {
      const branchIds = new Set([
        ...selectedPersonIds,
        ...(selectedPersonId == null ? [] : [selectedPersonId]),
      ]);
      if (!branchIds.has(loc.personId)) return false;
    } else if (selectedPersonId != null && loc.personId !== selectedPersonId) {
      return false;
    }

    const range = getEventDateRange(loc.eventDate);
    if (fromTimestamp != null && !Number.isNaN(fromTimestamp)) {
      if (!range || range.end < fromTimestamp) return false;
    }
    if (toTimestamp != null && !Number.isNaN(toTimestamp)) {
      if (!range || range.start > toTimestamp) return false;
    }
    return true;
  });
}

export default function MapClient({
  locations,
  selectedPersonIds,
  dateFrom,
  dateTo,
  branchMode,
  onDateFromChange,
  onDateToChange,
  onBranchModeChange,
  allPersons,
  selectedPersonId,
  onSelectPerson,
}: MapClientProps) {
  const [selectedMarker, setSelectedMarker] = useState<MapLocation | null>(null);
  const [MapComp, setMapComp] = useState<React.ComponentType<{
    locations: MapLocation[];
    onMarkerClick: (loc: MapLocation) => void;
  }> | null>(null);

  useEffect(() => {
    import("./LeafletMap").then((mod) => setMapComp(() => mod.default));
  }, []);

  const filtered = useMemo(() => {
    return filterMapLocations(
      locations,
      selectedPersonIds,
      selectedPersonId,
      branchMode,
      dateFrom,
      dateTo,
    );
  }, [locations, branchMode, selectedPersonIds, selectedPersonId, dateFrom, dateTo]);

  return (
    <div>
      {/* Filtres */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-slate-600">De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">À</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Personne</label>
          <select
            value={selectedPersonId ?? ""}
            onChange={(e) =>
              onSelectPerson(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Toutes</option>
            {allPersons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">Branche</label>
          <select
            value={branchMode}
            onChange={(e) =>
              onBranchModeChange(
                e.target.value as "none" | "ancestors" | "descendants",
              )
            }
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            disabled={!selectedPersonId}
          >
            <option value="none">Aucune</option>
            <option value="ancestors">Ascendants</option>
            <option value="descendants">Descendants</option>
          </select>
        </div>
      </div>

      {/* Carte */}
      <div className="mb-4 h-[500px] w-full overflow-hidden rounded-lg border border-slate-200">
        {MapComp ? (
          <MapComp locations={filtered} onMarkerClick={setSelectedMarker} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Chargement de la carte…
          </div>
        )}
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Fond de carte ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          OpenStreetMap
        </a>{" "}
        contributeurs.
      </p>

      {/* Info confidentialité */}
      <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Pour protéger la vie privée, seules les personnes décédées sont
        affichées sur cette carte. Aucune localisation de personne vivante
        n&apos;est divulguée.
      </p>

      {/* Popup d'info */}
      {selectedMarker && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-slate-900">
                {selectedMarker.personName}
              </p>
              <p className="text-sm text-slate-600">
                {selectedMarker.type === "naissance"
                  ? "Naissance"
                  : selectedMarker.type === "décès"
                    ? "Décès"
                    : selectedMarker.type === "mariage"
                      ? "Mariage"
                      : selectedMarker.label || "Événement"}
                {selectedMarker.eventDate
                  ? ` — ${selectedMarker.eventDate}`
                  : ""}
              </p>
              <p className="text-sm text-slate-600">{selectedMarker.place}</p>
              <p className="text-xs text-slate-400">
                {selectedMarker.latitude.toFixed(4)},{" "}
                {selectedMarker.longitude.toFixed(4)}
              </p>
            </div>
            <button
              onClick={() => setSelectedMarker(null)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Liste textuelle accessible */}
      <section>
        <h2 className="mb-2 font-semibold text-slate-800">
          Liste des événements ({filtered.length})
        </h2>
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun événement à afficher avec les filtres actuels.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {filtered.map((loc) => (
              <li key={loc.eventId} className="px-4 py-2">
                <span className="font-medium text-slate-900">
                  {loc.personName}
                </span>
                <span className="ml-2 text-sm text-slate-600">
                  {loc.type === "naissance"
                    ? "Naissance"
                    : loc.type === "décès"
                      ? "Décès"
                      : loc.type === "mariage"
                        ? "Mariage"
                        : loc.label || "Événement"}
                </span>
                {loc.eventDate && (
                  <span className="ml-1 text-sm text-slate-500">
                    ({loc.eventDate})
                  </span>
                )}
                <span className="ml-1 text-sm text-slate-500">
                  — {loc.place}
                </span>
                <button
                  onClick={() => setSelectedMarker(loc)}
                  className="ml-2 text-xs text-blue-600 underline hover:text-blue-800"
                >
                  Voir sur la carte
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
