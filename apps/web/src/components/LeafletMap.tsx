"use client";

import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapLocation } from "@testvibe/core";

interface LeafletMapProps {
  locations: MapLocation[];
  onMarkerClick: (loc: MapLocation) => void;
}

const EVENT_EMOJIS: Record<string, string> = {
  naissance: "🟦",
  "décès": "🟥",
  mariage: "💚",
  libre: "🟡",
};

export function createMarkerTooltip(personName: string, place: string): HTMLElement {
  const tooltip = document.createElement("span");
  tooltip.textContent = `${personName} — ${place}`;
  return tooltip;
}

export default function LeafletMap({ locations, onMarkerClick }: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    // Grouper par coordonnée pour gérer les points superposés
    const map = new Map<string, MapLocation[]>();
    for (const loc of locations) {
      const key = `${loc.latitude.toFixed(5)},${loc.longitude.toFixed(5)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(loc);
    }
    return map;
  }, [locations]);

  const bounds = useMemo(
    () => locations.map((location) => [location.latitude, location.longitude] as [number, number]),
    [locations],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        attributionControl: false,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Nettoyer
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    const markers: L.Marker[] = [];
    const markerLookup = new Map<string, L.Marker>();

    for (const [key, group] of groups) {
      const [lat, lng] = key.split(",").map(Number);
      const isCluster = group.length > 1;
      const loc = group[0];

      let icon: L.DivIcon;
      const emoji = EVENT_EMOJIS[loc.type] || "📍";

      if (isCluster) {
        icon = L.divIcon({
          className: "",
          html: `<div style="background:#334155;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer" title="${group.length} événements">${group.length}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
      } else {
        icon = L.divIcon({
          className: "",
          html: `<div style="font-size:24px;cursor:pointer;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))" title="${emoji}">${emoji}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
      }

      const marker = L.marker([lat, lng], { icon }).addTo(map);
      marker.bindTooltip(
        isCluster
          ? `${group.length} événements`
          : createMarkerTooltip(loc.personName, loc.place),
        { direction: "top", offset: [0, -16] },
      );
      marker.on("click", () => {
        if (group.length === 1) {
          onMarkerClick(group[0]);
        } else {
          // Pour les clusters, ouvrir le premier
          onMarkerClick(group[0]);
        }
      });
      markers.push(marker);
      markerLookup.set(key, marker);
    }

    // Ajuster la vue
    if (bounds.length > 0) {
      const mapBounds = L.latLngBounds(bounds);
      if (mapBounds.isValid()) {
        map.fitBounds(mapBounds.pad(0.1));
      }
    } else {
      // Vue par défaut : Europe
      map.setView([48, 2], 4);
    }

    return () => {
      markers.forEach((m) => map.removeLayer(m));
    };
  }, [bounds, groups, onMarkerClick]);

  return <div ref={containerRef} className="h-full w-full" />;
}
