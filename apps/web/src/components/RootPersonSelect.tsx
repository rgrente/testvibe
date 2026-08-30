"use client";

import { useRouter } from "next/navigation";
import type { Person } from "@testvibe/core";

export interface RootPersonSelectProps {
  persons: Person[];
  selectedId: number;
}

/**
 * Sélecteur de personne racine (navigation en lecture seule uniquement
 * — aucune mutation). Change l'URL (`?personId=`) au choix, ce qui
 * déclenche un nouveau rendu serveur de la page avec le nouvel arbre.
 */
export function RootPersonSelect({ persons, selectedId }: RootPersonSelectProps) {
  const router = useRouter();

  return (
    <form className="min-w-0 flex-1">
      <label htmlFor="root-select" className="mb-1 block text-sm font-medium text-slate-700">
        Personne racine
      </label>
      <select
        id="root-select"
        name="personId"
        value={String(selectedId)}
        onChange={(event) => router.push(`/?personId=${event.target.value}`)}
        className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {persons.map((p) => (
          <option key={p.id} value={p.id}>
            {p.firstName} {p.lastName}
          </option>
        ))}
      </select>
    </form>
  );
}
