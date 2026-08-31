import {
  adminGetPerson,
  adminListEventsByPerson,
  adminDeleteEvent,
} from "@testvibe/core";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import { createEventAction, updateEventAction } from "./actions";
import Link from "next/link";
import PlaceAutocomplete from "@/components/PlaceAutocomplete";
import { requireAdminMutation } from "@/lib/session";

export const dynamic = "force-dynamic";

interface PersonEventsPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

async function deleteEventAction(formData: FormData) {
  "use server";
  await requireAdminMutation();
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
    "résidence": "Résidence",
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
          <p className="mb-4 rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
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
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="naissance">Naissance</option>
              <option value="décès">Décès</option>
              <option value="mariage">Mariage</option>
              <option value="résidence">Résidence</option>
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
              type="text"
              placeholder="AAAA, AAAA-MM ou AAAA-MM-JJ"
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
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
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
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
              className="w-full rounded-sm border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="place" className="mb-1 block text-sm font-medium text-slate-700">
              Lieu
            </label>
            <PlaceAutocomplete inputId="place" placeholder="Ex: Paris, France" />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-sm bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
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
              <li key={ev.id} className="px-4 py-4">
                <form action={updateEventAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={ev.id} />
                  <input type="hidden" name="personId" value={id} />
                  <label className="text-xs font-medium text-slate-700">
                    Type *
                    <select name="type" defaultValue={ev.type} required className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm">
                      {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Date
                    <input name="eventDate" type="text" placeholder="AAAA, AAAA-MM ou AAAA-MM-JJ" defaultValue={ev.eventDate ?? ""} className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="text-xs font-medium text-slate-700 sm:col-span-2">
                    Libellé
                    <input name="label" type="text" defaultValue={ev.label ?? ""} className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <label className="text-xs font-medium text-slate-700 sm:col-span-2">
                    Description
                    <textarea name="description" rows={2} defaultValue={ev.description ?? ""} className="mt-1 block w-full rounded-sm border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <div className="sm:col-span-2">
                    <label htmlFor={`place-${ev.id}`} className="text-xs font-medium text-slate-700">
                      Lieu
                    </label>
                    <PlaceAutocomplete
                      inputId={`place-${ev.id}`}
                      defaultPlace={ev.place ?? ""}
                      defaultLatitude={ev.latitude}
                      defaultLongitude={ev.longitude}
                    />
                  </div>
                  <button type="submit" className="w-fit rounded-sm bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                    Modifier
                  </button>
                </form>
                <form action={deleteEventAction} className="mt-2">
                  <input type="hidden" name="id" value={ev.id} />
                  <input type="hidden" name="personId" value={id} />
                  <button
                    type="submit"
                    className="rounded-sm border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
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
