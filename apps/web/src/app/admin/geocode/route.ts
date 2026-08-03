/**
 * Route GET /admin/geocode — proxy de géocodage.
 *
 * Protégé par le middleware admin (tâche géocodage) : toute requête ici est
 * soumise à la vérification du cookie de session. Le client n'envoie donc
 * jamais de clé ni de secret : seul le serveur interroge le fournisseur
 * externe configuré (Nominatim ou Photon).
 *
 * Réponse : `{ suggestions: [{ label, latitude, longitude }] }`.
 */
import { geocodeSuggestions } from "@/lib/geocode";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (!query) {
    return Response.json(
      { error: "Paramètre 'q' manquant ou vide." },
      { status: 400 },
    );
  }

  try {
    const suggestions = await geocodeSuggestions(query);
    return Response.json({ suggestions });
  } catch {
    return Response.json(
      { error: "Échec du géocodage." },
      { status: 500 },
    );
  }
}
