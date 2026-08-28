import { notFound } from "next/navigation";
import { FamilyTreeViews } from "../../../components/FamilyTreeViews";
import { grenteRenaultTree } from "../../../test-fixtures/grente-renault-tree";

export const dynamic = "force-dynamic";

export default function TreeVisualFixturePage() {
  if (process.env.TREE_VISUAL_FIXTURE !== "1") notFound();

  return (
    <main className="contents">
      <h1 className="sr-only max-md:hidden">Arbre généalogique</h1>
      <FamilyTreeViews tree={grenteRenaultTree} />
    </main>
  );
}
