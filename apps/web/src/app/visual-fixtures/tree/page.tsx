import { notFound } from "next/navigation";
import { FamilyTreeViews } from "../../../components/FamilyTreeViews";
import { grenteRenaultTree } from "../../../test-fixtures/grente-renault-tree";

export const dynamic = "force-dynamic";

export default function TreeVisualFixturePage() {
  if (process.env.TREE_VISUAL_FIXTURE !== "1") notFound();

  return <FamilyTreeViews tree={grenteRenaultTree} />;
}
