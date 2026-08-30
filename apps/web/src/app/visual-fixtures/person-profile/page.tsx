import type { FamilyFact, Media, Person } from "@testvibe/core";
import { notFound } from "next/navigation";
import { PersonProfile } from "../../../components/PersonProfile";
import type { PersonRelations } from "../../../lib/person-relations";

export const dynamic = "force-dynamic";

const person: Person = {
  id: 7,
  firstName: "Léni-Éléonore",
  lastName: "Grente de la Vallée",
  birthName: "Grente",
  birthDate: "2016-09-14",
  deathDate: null,
  gender: "X",
};

const relative = (id: number, firstName: string, lastName: string, gender: string): Person => ({
  id, firstName, lastName, gender, birthName: null, birthDate: null, deathDate: null,
});

const facts: FamilyFact[] = [
  {
    id: 1,
    identity: "person:7:naissance",
    category: "naissance",
    type: "naissance",
    owner: "person:7",
    personIds: [7],
    date: "2016-09-14",
    eventDate: "2016-09-14",
    label: null,
    description: null,
    place: "Rennes (35)",
    latitude: null,
    longitude: null,
    source: "person",
    sourceEventId: null,
    conflicts: [],
  },
  {
    id: 2,
    identity: "event:2",
    category: "libre",
    type: "libre",
    owner: "person:7",
    personIds: [7],
    date: "2017-06",
    eventDate: "2017-06",
    label: "Baptême civil",
    description: "Cérémonie familiale à la mairie.",
    place: "Vitré",
    latitude: null,
    longitude: null,
    source: "event",
    sourceEventId: 2,
    conflicts: [],
  },
];

const medias: Media[] = [
  { id: 1, personId: 7, eventId: null, filename: "fixture-portrait.jpg", originalName: "Portrait de Léni.jpg", mimeType: "image/jpeg", size: 1024, createdAt: "2026-08-28" },
  { id: 2, personId: 7, eventId: null, filename: "fixture-acte.pdf", originalName: "Acte de naissance.pdf", mimeType: "application/pdf", size: 2048, createdAt: "2026-08-28" },
];

const relations: PersonRelations = {
  parents: [
    { person: relative(2, "Mathilde", "Renault", "F"), role: "Mère · biologique" },
    { person: relative(3, "Romain", "Grente", "M"), role: "Père · biologique" },
  ],
  partners: [{ person: relative(4, "Camille", "Martin", "X"), role: "Partenaire" }],
  children: [{ person: relative(5, "Lou", "Grente", "F"), role: "Fille · biologique" }],
};

export default function PersonProfileVisualFixturePage() {
  if (process.env.TREE_VISUAL_FIXTURE !== "1") notFound();

  return (
    <main className="min-h-full bg-[var(--color-canvas)] px-0 py-0 sm:px-6 sm:py-8">
      <PersonProfile person={person} facts={facts} medias={medias} relations={relations} />
    </main>
  );
}
