import {
  adminGetPerson,
  adminListMediaByPerson,
} from "@testvibe/core";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MediaUploadForm } from "../../../../../components/MediaUploadForm";
import { MediaDeleteButton } from "../../../../../components/MediaDeleteButton";

export const dynamic = "force-dynamic";

interface PersonMediaPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Page d'administration des médias d'une personne.
 * Phase 5 (tâche #24) : upload de photos/documents + liste + suppression.
 */
export default async function PersonMediaPage({ params }: PersonMediaPageProps) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (Number.isNaN(id)) notFound();

  let person;
  try {
    person = await adminGetPerson(id);
  } catch {
    notFound();
  }

  const medias = await adminListMediaByPerson(id);

  const photos = medias.filter((m) => m.mimeType.startsWith("image/"));
  const docs = medias.filter((m) => !m.mimeType.startsWith("image/"));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          Médias — {person.firstName} {person.lastName}
        </h1>
        <Link
          href={`/admin/persons/${id}/edit`}
          className="text-sm text-slate-500 hover:text-slate-800 underline"
        >
          ← Retour à la fiche
        </Link>
      </div>

      {/* Formulaire d'upload */}
      <section className="mb-8 rounded-lg border border-slate-200 p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Ajouter un média</h2>
        <MediaUploadForm personId={id} onUploadSuccess={() => {}} />
      </section>

      {/* Photos */}
      {photos.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold text-slate-800">Photos ({photos.length})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((m) => (
              <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <Image
                  src={`/api/media/${m.filename}`}
                  alt={m.originalName}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />
                <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100 pb-2">
                  <MediaDeleteButton mediaId={m.id} filename={m.filename} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Documents */}
      {docs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-semibold text-slate-800">Documents ({docs.length})</h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {docs.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📄</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{m.originalName}</p>
                    <p className="text-xs text-slate-500">{(m.size / 1024).toFixed(0)} Ko</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/api/media/${m.filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
                  >
                    Ouvrir
                  </a>
                  <MediaDeleteButton mediaId={m.id} filename={m.filename} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {medias.length === 0 && (
        <p className="text-sm text-slate-500">Aucun média associé à cette personne.</p>
      )}
    </main>
  );
}
