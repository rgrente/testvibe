import type { FiliationRole, KinshipResult } from "@testvibe/core";

/**
 * Mise en français du résultat de `computeKinship`. Fonctions pures, sans
 * dépendance React : la page /parente se contente de les afficher.
 */

const COMMENCE_PAR_UNE_VOYELLE = /^[aeiouyàâäéèêëîïôöùûü]/i;

/**
 * Article défini accordé au libellé, élidé devant une voyelle :
 * « le neveu », « la tante », « l’oncle », « l’arrière-grand-mère ».
 *
 * Le genre est celui de la personne de départ, comme le libellé lui-même :
 * un genre inconnu retombe sur le masculin (forme neutre par défaut).
 */
export function articleDefini(label: string, feminin: boolean): string {
  if (COMMENCE_PAR_UNE_VOYELLE.test(label)) return "l’";
  return feminin ? "la " : "le ";
}

/**
 * Phrase principale décrivant le lien orienté « de » → « vers ».
 * Exemples : « Ada est la mère de Léa. », « Ada est l’arrière-grand-mère de Léa. »
 */
export function phraseDeParente(
  result: KinshipResult,
  fromName: string,
  toName: string,
  feminin: boolean,
): string {
  if (result.samePerson) {
    return `${fromName} est ${result.link?.label ?? "elle-même"}.`;
  }
  if (result.unrelated || result.link === null) {
    return `Aucun lien de parenté connu entre ${fromName} et ${toName}.`;
  }
  return `${fromName} est ${articleDefini(result.link.label, feminin)}${result.link.label} de ${toName}.`;
}

/**
 * Annotation d'une arête du chemin. Une filiation biologique est le cas par
 * défaut et n'est pas signalée : seuls l'adoption et le beau-parent le sont,
 * car ils expliquent un lien que la généalogie du sang ne porte pas.
 */
export function libelleRole(role: FiliationRole | undefined): string | null {
  if (role === "adopte") return "adoption";
  if (role === "beau-parent") return "beau-parent";
  return null;
}

/** Intitulé lisible de la catégorie de lien, pour l'encart de détail. */
export function libelleRelation(result: KinshipResult): string {
  if (result.samePerson) return "Même personne";
  switch (result.link?.relation) {
    case "ascendant":
      return "Ligne directe ascendante";
    case "descendant":
      return "Ligne directe descendante";
    case "frere-soeur":
      return "Fratrie";
    case "collateral":
      return "Lien collatéral";
    default:
      return "Aucun lien";
  }
}
