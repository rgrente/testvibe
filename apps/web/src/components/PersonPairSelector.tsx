"use client";

import { useState } from "react";
import type { Person } from "@testvibe/core";

export interface PersonPairSelectorProps {
  persons: Person[];
  defaultPersonIds?: number[];
}

function displayName(person: Person): string {
  return `${person.firstName} ${person.lastName}`;
}

function matchesQuery(person: Person, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;

  return [person.firstName, person.lastName, person.birthName, displayName(person)]
    .filter(Boolean)
    .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery));
}

interface PersonSelectorProps {
  index: 1 | 2;
  persons: Person[];
  selectedId: number | null;
  otherSelectedId: number | null;
  onChange: (id: number | null) => void;
}

function PersonSelector({
  index,
  persons,
  selectedId,
  otherSelectedId,
  onChange,
}: PersonSelectorProps) {
  const [query, setQuery] = useState("");
  const filteredPersons = persons.filter(
    (person) => person.id === selectedId || matchesQuery(person, query),
  );

  return (
    <fieldset className="rounded-md border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-800">Personne {index}</legend>
      <label htmlFor={`person-${index}-search`} className="mb-1 block text-sm text-slate-700">
        Rechercher la personne {index}
      </label>
      <input
        id={`person-${index}-search`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Prénom, nom ou nom de naissance"
        className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <label htmlFor={`person-${index}-select`} className="mb-1 block text-sm text-slate-700">
        Personne {index}
      </label>
      <select
        id={`person-${index}-select`}
        value={selectedId ?? ""}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        required
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">Sélectionner une personne</option>
        {filteredPersons.map((person) => (
          <option
            key={person.id}
            value={person.id}
            disabled={person.id === otherSelectedId}
          >
            {displayName(person)}
          </option>
        ))}
      </select>
      {filteredPersons.length === 0 ? (
        <p role="status" className="mt-2 text-sm text-slate-600">
          Aucune personne trouvée.
        </p>
      ) : null}
    </fieldset>
  );
}

export function PersonPairSelector({ persons, defaultPersonIds = [] }: PersonPairSelectorProps) {
  const [firstPersonId, setFirstPersonId] = useState<number | null>(
    defaultPersonIds[0] ?? null,
  );
  const [secondPersonId, setSecondPersonId] = useState<number | null>(
    defaultPersonIds[1] ?? null,
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PersonSelector
        index={1}
        persons={persons}
        selectedId={firstPersonId}
        otherSelectedId={secondPersonId}
        onChange={setFirstPersonId}
      />
      <PersonSelector
        index={2}
        persons={persons}
        selectedId={secondPersonId}
        otherSelectedId={firstPersonId}
        onChange={setSecondPersonId}
      />
      {firstPersonId !== null ? (
        <input type="hidden" name="personIds" value={firstPersonId} />
      ) : null}
      {secondPersonId !== null ? (
        <input type="hidden" name="personIds" value={secondPersonId} />
      ) : null}
    </div>
  );
}
