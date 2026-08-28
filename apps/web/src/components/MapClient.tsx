"use client";

import { useEffect, useMemo, useState } from "react";
import type { MapLocation } from "@testvibe/core";
import { formatFamilyDate } from "../lib/family-date";

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

export function getMapLocationTypeLabel(location: MapLocation): string {
  if (location.type === "naissance") return "Naissance";
  if (location.type === "décès") return "Décès";
  if (location.type === "mariage") return "Mariage";
  if (location.type === "pacs") return "Pacs";
  if (location.type === "union libre" || (location.source === "union" && location.type === "libre")) return "Union libre";
  if (location.type === "résidence") return "Résidence";
  return location.label || "Événement";
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
      if (!(loc.personIds ?? [loc.personId]).some((id) => branchIds.has(id))) return false;
    } else if (selectedPersonId != null && !(loc.personIds ?? [loc.personId]).includes(selectedPersonId)) {
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
      <section aria-label="Filtres de la carte" className="mb-4 grid grid-cols-1 gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-subtle)] sm:grid-cols-4">
        <div>
          <label htmlFor="map-date-from" className="block text-xs font-medium text-slate-600">De</label>
          <input
            id="map-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="min-h-11 w-full rounded-[var(--radius-md)] border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
        </div>
        <div>
          <label htmlFor="map-date-to" className="block text-xs font-medium text-slate-600">À</label>
          <input
            id="map-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="min-h-11 w-full rounded-[var(--radius-md)] border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
          />
        </div>
        <div>
          <label htmlFor="map-person" className="block text-xs font-medium text-slate-600">Personne</label>
          <select
            id="map-person"
            value={selectedPersonId ?? ""}
            onChange={(e) =>
              onSelectPerson(e.target.value ? Number(e.target.value) : null)
            }
            className="min-h-11 w-full rounded-[var(--radius-md)] border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
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
          <label htmlFor="map-branch" className="block text-xs font-medium text-slate-600">Branche</label>
          <select
            id="map-branch"
            value={branchMode}
            onChange={(e) =>
              onBranchModeChange(
                e.target.value as "none" | "ancestors" | "descendants",
              )
            }
            className="min-h-11 w-full rounded-[var(--radius-md)] border border-slate-300 px-2 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            disabled={!selectedPersonId}
          >
            <option value="none">Aucune</option>
            <option value="ancestors">Ascendants</option>
            <option value="descendants">Descendants</option>
          </select>
        </div>
      </section>

      {/* Carte */}
      <section aria-label="Carte des origines" className="mb-4 h-[360px] w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] sm:h-[500px]">
        {MapComp ? (
          <MapComp locations={filtered} onMarkerClick={setSelectedMarker} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Chargement de la carte…
          </div>
        )}
      </section>
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

      {/* Popup d'info */}
      {selectedMarker && (
        <div role="dialog" aria-label={`Détail du lieu ${selectedMarker.place}`} className="mb-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-subtle)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-slate-900">
                {selectedMarker.personName}
              </p>
              <p className="text-sm text-slate-600">
                {getMapLocationTypeLabel(selectedMarker)}
                {selectedMarker.eventDate
                  ? ` — ${formatFamilyDate(selectedMarker.eventDate)}`
                  : " — Date inconnue"}
              </p>
              <p className="text-sm text-slate-600">{selectedMarker.place}</p>
              <p className="text-xs text-slate-400">
                {selectedMarker.latitude.toFixed(4)},{" "}
                {selectedMarker.longitude.toFixed(4)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMarker(null)}
              className="min-h-11 min-w-11 rounded-[var(--radius-md)] text-slate-500 hover:bg-[var(--color-canvas)] hover:text-slate-700"
              aria-label="Fermer le détail"
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
                  {getMapLocationTypeLabel(loc)}
                </span>
                <span className="ml-1 text-sm text-slate-500">
                  ({formatFamilyDate(loc.eventDate)})
                </span>
                <span className="ml-1 text-sm text-slate-500">
                  — {loc.place}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMarker(loc)}
                  className="ml-2 min-h-11 rounded-[var(--radius-sm)] px-2 text-xs text-blue-700 underline hover:bg-[var(--color-canvas)] focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
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
