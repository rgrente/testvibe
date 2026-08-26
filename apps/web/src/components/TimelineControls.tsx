"use client";

import type { Person } from "@testvibe/core";
import { useRouter } from "next/navigation";

export function TimelineControls({ persons, selectedId, generations }: { persons: Person[]; selectedId: number; generations: number }) {
  const router = useRouter();
  const navigate = (personId: number, generationCount: number) =>
    router.push(`/timeline?personId=${personId}&generations=${generationCount}`);

  return (
    <div className="mb-6 flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <label className="text-sm font-medium text-slate-700">
        Personne racine
        <select aria-label="Personne racine" value={selectedId} onChange={(event) => navigate(Number(event.target.value), generations)} className="mt-1 block rounded-sm border border-slate-300 bg-white px-3 py-2">
          {persons.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Générations d’ascendants
        <select aria-label="Générations d’ascendants" value={generations} onChange={(event) => navigate(selectedId, Number(event.target.value))} className="mt-1 block rounded-sm border border-slate-300 bg-white px-3 py-2">
          {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
      </label>
    </div>
  );
}
