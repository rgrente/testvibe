import type { FamilyFact, Media, Person } from "@testvibe/core";
import { formatFamilyDate } from "@testvibe/core";
import Link from "next/link";
import type { PersonRelations } from "../lib/person-relations";
import { PersonPhoto } from "./PersonPhoto";

interface PersonProfileProps {
  person: Person;
  facts: FamilyFact[];
  medias: Media[];
  relations: PersonRelations;
}

const EVENT_LABELS: Record<string, string> = {
  naissance: "Naissance",
  décès: "Décès",
  mariage: "Mariage",
  pacs: "Pacs",
  "union libre": "Union libre",
  résidence: "Résidence",
  libre: "Événement",
};

function personName(person: Person) {
  return `${person.firstName} ${person.lastName}`;
}

function initials(person: Person) {
  return `${person.firstName.at(0) ?? ""}${person.lastName.at(0) ?? ""}`.toUpperCase();
}

function genderLabel(gender: string | null) {
  if (gender === "M") return "Masculin";
  if (gender === "F") return "Féminin";
  if (gender) return `Genre : ${gender}`;
  return "Genre non renseigné";
}

function dateAndPlace(date: string | null, place: string | null) {
  const values = [date ? formatFamilyDate(date) : null, place].filter(Boolean);
  return values.length > 0 ? values.join(" · ") : "Date et lieu non renseignés";
}

function RelationGroup({ title, items }: { title: string; items: PersonRelations[keyof PersonRelations] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 family-tree-mono text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">{title}</h3>
      <ul className="space-y-2">
        {items.map(({ person, role }) => (
          <li key={`${title}-${person.id}`}>
            <Link
              href={`/persons/${person.id}`}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-slate-950 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold">
                {person.gender === "F" ? "♀" : person.gender === "M" ? "♂" : "•"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{personName(person)}</span>
                <span className="block family-tree-mono text-[10px] uppercase text-slate-500">{role}</span>
              </span>
              <span aria-hidden="true" className="text-slate-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PersonProfile({ person, facts, medias, relations }: PersonProfileProps) {
  const birth = facts.find((fact) => fact.category === "naissance");
  const death = facts.find((fact) => fact.category === "décès");
  const photos = medias.filter((media) => media.mimeType.startsWith("image/"));
  const documents = medias.filter((media) => !media.mimeType.startsWith("image/"));
  const hasRelations = relations.parents.length + relations.partners.length + relations.children.length > 0;

  return (
    <article data-testid="person-profile" className="mx-auto w-full max-w-[420px] overflow-hidden bg-white text-slate-950 sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-sm">
      <header className="border-b border-slate-200 px-4 py-5 sm:px-5">
        <p className="mb-3 family-tree-mono text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">Fiche personne</p>
        <div className="flex items-start gap-3">
          <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-base font-semibold text-white">
            {initials(person)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-bold leading-tight">{personName(person)}</h1>
            <p className="mt-1 family-tree-mono text-xs text-slate-600">
              {genderLabel(person.gender)} · {person.birthDate ? `né·e le ${formatFamilyDate(person.birthDate)}` : "Date non renseignée"}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <Link href={`/?personId=${person.id}`} className="flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950">
            Voir dans l’arbre
          </Link>
          <Link href="/" className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950">
            Retour à l’arbre
          </Link>
        </div>
      </header>

      <section aria-labelledby="identity-title" className="border-b border-slate-200 px-4 py-5 sm:px-5">
        <h2 id="identity-title" className="mb-3 family-tree-mono text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">Identité</h2>
        <dl className="overflow-hidden rounded-xl border border-slate-200 text-sm">
          <div className="flex justify-between gap-4 border-b border-slate-100 px-3 py-3"><dt className="text-slate-600">Nom complet</dt><dd className="text-right font-medium">{personName(person)}</dd></div>
          <div className="flex justify-between gap-4 border-b border-slate-100 px-3 py-3"><dt className="text-slate-600">Nom de naissance</dt><dd className="text-right font-medium">{person.birthName ?? "Non renseigné"}</dd></div>
          <div className="flex justify-between gap-4 border-b border-slate-100 px-3 py-3"><dt className="text-slate-600">Naissance</dt><dd className="text-right family-tree-mono text-xs">{dateAndPlace(person.birthDate, birth?.place ?? null)}</dd></div>
          {person.deathDate && <div className="flex justify-between gap-4 border-b border-slate-100 px-3 py-3"><dt className="text-slate-600">Décès</dt><dd className="text-right family-tree-mono text-xs">{dateAndPlace(person.deathDate, death?.place ?? null)}</dd></div>}
          <div className="flex justify-between gap-4 px-3 py-3"><dt className="text-slate-600">Statut</dt><dd className="rounded-md bg-emerald-50 px-2 py-0.5 family-tree-mono text-[10px] font-semibold uppercase text-emerald-800">{person.deathDate ? "Décédé·e" : "Vivant"}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="relations-title" className="space-y-4 border-b border-slate-200 px-4 py-5 sm:px-5">
        <h2 id="relations-title" className="family-tree-mono text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">Relations</h2>
        {!hasRelations && <p className="text-sm text-slate-600">Aucune relation connue.</p>}
        <RelationGroup title="Parents" items={relations.parents} />
        <RelationGroup title="Partenaires" items={relations.partners} />
        <RelationGroup title="Enfants" items={relations.children} />
      </section>

      <section aria-labelledby="media-title" className="border-b border-slate-200 px-4 py-5 sm:px-5">
        <h2 id="media-title" className="mb-3 family-tree-mono text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">Médias</h2>
        {medias.length === 0 && <p className="text-sm text-slate-600">Aucun média associé.</p>}
        {photos.length > 0 && (
          <ul aria-label="Photos" className="grid grid-cols-2 gap-3">
            {photos.map((media) => (
              <li key={media.id}>
                <a href={`/api/media/${media.filename}`} target="_blank" rel="noopener noreferrer" className="relative block aspect-square overflow-hidden rounded-xl border border-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950">
                  <PersonPhoto src={`/api/media/${media.filename}`} alt={media.originalName} initials={initials(person)} />
                </a>
              </li>
            ))}
          </ul>
        )}
        {documents.length > 0 && (
          <ul aria-label="Documents" className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {documents.map((media) => (
              <li key={media.id} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{media.originalName}</span>
                <a href={`/api/media/${media.filename}`} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${media.originalName}`} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950">Ouvrir</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="events-title" className="px-4 py-5 sm:px-5">
        <h2 id="events-title" className="mb-4 family-tree-mono text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">Événements</h2>
        {facts.length === 0 ? (
          <p className="text-sm text-slate-600">Aucun événement enregistré pour cette personne.</p>
        ) : (
          <ol className="border-l border-slate-200 pl-5">
            {facts.map((fact) => (
              <li key={fact.identity} id={`event-${fact.id}`} className="relative scroll-mt-4 pb-5 last:pb-0">
                <span aria-hidden="true" className="absolute -left-[25px] top-1 h-2 w-2 rounded-full border border-blue-700 bg-white" />
                <h3 className="text-sm font-semibold">{fact.label ?? EVENT_LABELS[fact.category] ?? fact.category}</h3>
                <p className="mt-0.5 family-tree-mono text-[11px] text-slate-600">{dateAndPlace(fact.eventDate, fact.place)}</p>
                {fact.description && <p className="mt-1 text-sm text-slate-700">{fact.description}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
