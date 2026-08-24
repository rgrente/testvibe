import {
  getPersonForWeb,
  getPersonTimelineForWeb,
  getPersonMediaForWeb,
} from "@testvibe/core";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface PersonDetailPageProps {
  params: Promise<{ id: string }>;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  "naissance": "Naissance",
  "décès": "Décès",
  "mariage": "Mariage",
  "libre": "Événement",
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  "naissance": "🌱",
  "décès": "✝",
  "mariage": "💍",
  "libre": "📌",
};

/**
 * Page de consultation publique d'une Person.
 * Phase 5 (tâche #24) : timeline chronologique + médias associés.
 */
export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (Number.isNaN(id)) notFound();

  let person;
  try {
    person = await getPersonForWeb(id);
  } catch {
    notFound();
  }

  const [timeline, medias] = await Promise.all([
    getPersonTimelineForWeb(id),
    getPersonMediaForWeb(id),
  ]);

  const photoMedias = medias.filter((m) => m.mimeType.startsWith("image/"));
  const docMedias = medias.filter((m) => !m.mimeType.startsWith("image/"));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Entête */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {person.firstName} {person.lastName}
          </h1>
          {person.birthName && (
            <p className="mt-1 text-sm text-slate-600">Nom de naissance : {person.birthName}</p>
          )}
          <p className="mt-1 text-sm text-slate-500">
            {person.gender === "M" ? "Masculin" : person.gender === "F" ? "Féminin" : person.gender ?? ""}
            {person.birthDate && ` · né·e le ${person.birthDate}`}
            {person.deathDate && ` · décédé·e le ${person.deathDate}`}
          </p>
        </div>
        <Link
          href={`/?personId=${person.id}`}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Voir dans l&apos;arbre
        </Link>
      </div>

      {/* Photos */}
      {photoMedias.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Photos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photoMedias.map((m) => (
              <a
                key={m.id}
                href={`/api/media/${m.filename}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
              >
                <Image
                  src={`/api/media/${m.filename}`}
                  alt={m.originalName}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Documents */}
      {docMedias.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Documents</h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {docMedias.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-700">📄 {m.originalName}</span>
                <a
                  href={`/api/media/${m.filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                >
                  Ouvrir
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Timeline */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Timeline</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun événement enregistré pour cette personne.</p>
        ) : (
          <ol className="relative border-l border-slate-200">
            {timeline.map((ev) => (
              <li key={ev.id} id={`event-${ev.id}`} className="mb-6 ml-6 scroll-mt-4">
                <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-base ring-2 ring-slate-200">
                  {EVENT_TYPE_ICONS[ev.type] ?? "📌"}
                </span>
                <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                    </span>
                    {ev.label && (
                      <span className="text-sm font-medium text-slate-800">— {ev.label}</span>
                    )}
                  </div>
                  {ev.eventDate && (
                    <time className="block text-sm text-slate-600">{ev.eventDate}</time>
                  )}
                  {ev.description && (
                    <p className="mt-1 text-sm text-slate-700">{ev.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Navigation */}
      <p className="text-sm text-slate-500">
        <Link href="/" className="underline hover:text-slate-800">
          ← Retour à l&apos;arbre
        </Link>
      </p>
    </main>
  );
}
