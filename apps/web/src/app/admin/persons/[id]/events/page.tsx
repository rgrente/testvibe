import {
  adminGetPerson,
  adminListEventsByPerson,
  adminCreateEvent,
  adminDeleteEvent,
} from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PersonEventsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

async function createEventAction(formData: FormData) {
  "use server";
  const personId = Number(formData.get("personId"));
  const type = formData.get("type")?.toString() as
    | "naissance"
    | "décès"
    | "mariage"
    | "libre"
    | undefined;
  const label = formData.get("label")?.toString().trim() || null;
  const eventDate = formData.get("eventDate")?.toString().trim() || null;
  const description = formData.get("description")?.toString().trim() || null;
  const place = formData.get("place")?.toString().trim() || null;
  const latStr = formData.get("latitude")?.toString().trim();
  const lngStr = formData.get("longitude")?.toString().trim();
  const latitude = latStr ? Number(latStr) : null;
  const longitude = lngStr ? Number(lngStr) : null;

  if (!personId || !type) {
    redirect(`/admin/persons/${personId}/events?error=champs_requis`);
  }
  try {
    await adminCreateEvent({ personId, type, label, eventDate, description, place, latitude, longitude });
  } catch {
    redirect(`/admin/persons/${personId}/events?error=validation`);
  }
  revalidatePath(`/admin/persons/${personId}/events`);
  redirect(`/admin/persons/${personId}/events`);
}

async function deleteEventAction(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const personId = Number(formData.get("personId"));
  if (!id) return;
  try {
    await adminDeleteEvent(id);
  } catch {
    // Ignore si déjà supprimé
  }
  revalidatePath(`/admin/persons/${personId}/events`);
  redirect(`/admin/persons/${personId}/events`);
}

export default async function PersonEventsPage({ params, searchParams }: PersonEventsPageProps) {
  const { id: idStr } = await params;
  const { error } = await searchParams;
  const id = Number(idStr);
  if (Number.isNaN(id)) notFound();

  let person;
  try {
    person = await adminGetPerson(id);
  } catch {
    notFound();
  }

  const events = await adminListEventsByPerson(id);

  const EVENT_TYPE_LABELS: Record<string, string> = {
    "naissance": "Naissance",
    "décès": "Décès",
    "mariage": "Mariage",
    "libre": "Événement libre",
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          Événements — {person.firstName} {person.lastName}
        </h1>
        <Link
          href={`/admin/persons/${id}/edit`}
          className="text-sm text-slate-500 hover:text-slate-800 underline"
        >
          ← Retour à la fiche
        </Link>
      </div>

      {/* Formulaire d'ajout */}
      <section className="mb-8 rounded-lg border border-slate-200 p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Ajouter un événement</h2>
        {error && (
          <p className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error === "champs_requis" ? "Type obligatoire." : "Données invalides."}
          </p>
        )}
        <form action={createEventAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="personId" value={id} />
          <div>
            <label htmlFor="type" className="mb-1 block text-sm font-medium text-slate-700">
              Type *
            </label>
            <select
              id="type"
              name="type"
              required
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="naissance">Naissance</option>
              <option value="décès">Décès</option>
              <option value="mariage">Mariage</option>
              <option value="libre">Événement libre</option>
            </select>
          </div>
          <div>
            <label htmlFor="eventDate" className="mb-1 block text-sm font-medium text-slate-700">
              Date
            </label>
            <input
              id="eventDate"
              name="eventDate"
              type="date"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="label" className="mb-1 block text-sm font-medium text-slate-700">
              Libellé
            </label>
            <input
              id="label"
              name="label"
              type="text"
              placeholder="Ex: Voyage en Asie, Diplôme…"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="place" className="mb-1 block text-sm font-medium text-slate-700">
              Lieu
            </label>
            <input
              id="place"
              name="place"
              type="text"
              placeholder="Ex: Paris, France"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="latitude" className="mb-1 block text-sm font-medium text-slate-700">
              Latitude
            </label>
            <input
              id="latitude"
              name="latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              placeholder="Ex: 48.8566"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="longitude" className="mb-1 block text-sm font-medium text-slate-700">
              Longitude
            </label>
            <input
              id="longitude"
              name="longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              placeholder="Ex: 2.3522"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Ajouter
            </button>
          </div>
        </form>
      </section>

      {/* Liste des événements */}
      <section>
        <h2 className="mb-4 font-semibold text-slate-800">
          Événements ({events.length})
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun événement enregistré.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start justify-between px-4 py-3">
                <div>
                  <span className="font-medium text-slate-900">
                    {EVENT_TYPE_LABELS[ev.type] ?? ev.type}
                    {ev.label ? ` — ${ev.label}` : ""}
                  </span>
                  {ev.eventDate && (
                    <span className="ml-2 text-sm text-slate-500">{ev.eventDate}</span>
                  )}
                  {ev.place && (
                    <span className="ml-2 text-sm text-slate-500">
                      📍 {ev.place}
                      {ev.latitude != null && ev.longitude != null
                        ? ` (${ev.latitude.toFixed(4)}, ${ev.longitude.toFixed(4)})`
                        : ""}
                    </span>
                  )}
                  {ev.description && (
                    <p className="mt-0.5 text-sm text-slate-600">{ev.description}</p>
                  )}
                </div>
                <form action={deleteEventAction}>
                  <input type="hidden" name="id" value={ev.id} />
                  <input type="hidden" name="personId" value={id} />
                  <button
                    type="submit"
                    className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
