"use client";

import { useId, useMemo, useState } from "react";
import type { Person } from "@testvibe/core";

interface PersonFieldProps {
  index: 1 | 2;
  persons: Person[];
  selectedId: number | null;
  excludedId: number | null;
  onSelect: (id: number | null) => void;
}

function personName(person: Person): string {
  return `${person.firstName} ${person.lastName}`;
}

function PersonField({
  index,
  persons,
  selectedId,
  excludedId,
  onSelect,
}: PersonFieldProps) {
  const inputId = useId();
  const listboxId = useId();
  const selectedPerson = persons.find((person) => person.id === selectedId);
  const [query, setQuery] = useState(selectedPerson ? personName(selectedPerson) : "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");
    return persons.filter(
      (person) =>
        person.id !== excludedId &&
        (!normalizedQuery ||
          personName(person).toLocaleLowerCase("fr").includes(normalizedQuery)),
    );
  }, [excludedId, persons, query]);
  const activePerson = open && activeIndex >= 0 ? suggestions[activeIndex] : undefined;

  function selectPerson(person: Person) {
    setQuery(personName(person));
    onSelect(person.id);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">
        Personne {index} *
      </label>
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open && suggestions.length > 0}
        aria-activedescendant={activePerson ? `${listboxId}-option-${activePerson.id}` : undefined}
        aria-required="true"
        autoComplete="off"
        placeholder="Rechercher une personne…"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActiveIndex(-1);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          onSelect(null);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && suggestions.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => (current + 1) % suggestions.length);
          } else if (event.key === "ArrowUp" && suggestions.length > 0) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) =>
              current <= 0 ? suggestions.length - 1 : current - 1,
            );
          } else if (event.key === "Enter" && open && suggestions.length > 0) {
            event.preventDefault();
            selectPerson(activePerson ?? suggestions[0]);
          } else if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
      {selectedId !== null && <input type="hidden" name="personIds" value={selectedId} />}
      <noscript>
        <select
          name="personIds"
          defaultValue={selectedId ?? ""}
          aria-label={`Personne ${index}`}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Choisir…
          </option>
          {persons
            .filter((person) => person.id !== excludedId)
            .map((person) => (
              <option key={person.id} value={person.id}>
                {personName(person)}
              </option>
            ))}
        </select>
      </noscript>
      {open && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded border border-slate-200 bg-white py-1 shadow-lg"
        >
          {suggestions.map((person, suggestionIndex) => (
            <li
              id={`${listboxId}-option-${person.id}`}
              key={person.id}
              role="option"
              aria-selected={suggestionIndex === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectPerson(person)}
              className={`cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                suggestionIndex === activeIndex ? "bg-slate-100" : ""
              }`}
            >
              {personName(person)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface UnionPersonSearchProps {
  persons: Person[];
  defaultPersonIds?: number[];
}

export default function UnionPersonSearch({
  persons,
  defaultPersonIds = [],
}: UnionPersonSearchProps) {
  const [firstId, setFirstId] = useState<number | null>(defaultPersonIds[0] ?? null);
  const [secondId, setSecondId] = useState<number | null>(defaultPersonIds[1] ?? null);
  if (persons.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucune personne disponible — créez d&apos;abord des personnes.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <PersonField index={1} persons={persons} selectedId={firstId} excludedId={secondId} onSelect={setFirstId} />
      <PersonField index={2} persons={persons} selectedId={secondId} excludedId={firstId} onSelect={setSecondId} />
    </div>
  );
}
