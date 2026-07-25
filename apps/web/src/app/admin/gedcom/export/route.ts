/**
 * Route GET /admin/gedcom/export — téléchargement du fichier GEDCOM.
 *
 * Protégé par le middleware admin (Phase 3, tâche #22) : seuls les
 * utilisateurs avec un cookie de session valide peuvent accéder à
 * cette route.
 */
import { adminExportGedcom } from "@testvibe/core";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const gedcomText = await adminExportGedcom();

    return new Response(gedcomText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="arbre-genealogique.ged"`,
      },
    });
  } catch {
    return new Response("Erreur lors de la génération du fichier GEDCOM.", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
