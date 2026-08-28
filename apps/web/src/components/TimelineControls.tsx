"use client";

import type { Person } from "@testvibe/core";
import { useRouter } from "next/navigation";
import type { TimelineLayers } from "../lib/comparative-timeline";

export function TimelineControls({ persons, selectedId, generations, layers }: { persons: Person[]; selectedId: number; generations: number; layers: TimelineLayers }) {
  const router = useRouter();
  const navigate = (personId: number, generationCount: number) =>
    router.push(`/timeline?personId=${personId}&generations=${generationCount}`);
  const navigateLayers = (nextLayers: TimelineLayers) => router.push(
    `/timeline?personId=${selectedId}&generations=${generations}&persons=${nextLayers.persons ? 1 : 0}&events=${nextLayers.events ? 1 : 0}&generationLayer=${nextLayers.generations ? 1 : 0}`,
  );

  return (
    <div className="mb-5 flex flex-wrap items-end gap-3" aria-label="Contrôles de la chronologie">
      <label className="text-sm font-medium text-slate-700">
        Personne racine
        <select aria-label="Personne racine" value={selectedId} onChange={(event) => navigate(Number(event.target.value), generations)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-blue-600">
          {persons.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Générations d’ascendants
        <select aria-label="Générations d’ascendants" value={generations} onChange={(event) => navigate(selectedId, Number(event.target.value))} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-blue-600">
          {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
      </label>
      <div className="ml-auto flex flex-wrap gap-1.5" aria-label="Couches affichées">
        {([
          ["persons", "Personnes"],
          ["events", "Événements"],
          ["generations", "Générations"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={layers[key]}
            onClick={() => navigateLayers({ ...layers, [key]: !layers[key] })}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 ${layers[key] ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-600"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
