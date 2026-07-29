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
    <form className="mb-6">
      <label htmlFor="root-select" className="mb-2 block text-sm font-medium text-slate-700">
        Personne racine
      </label>
      <select
        id="root-select"
        name="personId"
        value={String(selectedId)}
        onChange={(event) => router.push(`/?personId=${event.target.value}`)}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm"
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
