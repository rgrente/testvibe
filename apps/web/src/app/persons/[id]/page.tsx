import {
  getFamilyTreeForWeb,
  getPersonForWeb,
  getPersonMediaForWeb,
  getPersonTimelineForWeb,
  NotFoundError,
} from "@testvibe/core";
import { notFound } from "next/navigation";
import { PersonProfile } from "../../../components/PersonProfile";
import { selectPersonRelations } from "../../../lib/person-relations";

interface PersonDetailPageProps {
  params: Promise<{ id: string }>;
}

/** Page publique de consultation d'une personne et de ses relations directes. */
export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
  const { id: idString } = await params;
  const id = Number(idString);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let person;
  try {
    person = await getPersonForWeb(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [facts, medias, tree] = await Promise.all([
    getPersonTimelineForWeb(id),
    getPersonMediaForWeb(id),
    getFamilyTreeForWeb(id),
  ]);

  return (
    <main className="min-h-full bg-[var(--color-canvas)] px-0 py-0 sm:px-6 sm:py-8">
      <PersonProfile
        person={person}
        facts={facts}
        medias={medias}
        relations={selectPersonRelations(tree, id)}
      />
    </main>
  );
}