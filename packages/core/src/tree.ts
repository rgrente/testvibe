/**
 * Agrégation en lecture seule de l'arbre généalogique (ascendants et
 * descendants) d'une Person racine, à partir des opérations CRUD
 * existantes de packages/core (Person/Union/Filiation). Ne dépend
 * jamais directement de packages/db : consomme uniquement les
 * fonctions déjà exposées par ./person.js, ./union.js, ./filiation.js.
 */
import type { Database } from "@testvibe/db";
import type { Person, Union, Filiation } from "./types.js";
import { getPersonById, listPersons } from "./person.js";
import { listUnions } from "./union.js";
import { listFiliations } from "./filiation.js";

export interface FamilyTreeNode {
  person: Person;
  /** 0 = racine ; négatif = ascendants ; positif = descendants. */
  generation: number;
}

export interface FamilyTreeFiliationEdge {
  type: "filiation";
  filiationId: number;
  parentId: number;
  childId: number;
  role: Filiation["role"];
}

export interface FamilyTreeUnionEdge {
  type: "union";
  unionId: number;
  personIds: number[];
}

export type FamilyTreeEdge = FamilyTreeFiliationEdge | FamilyTreeUnionEdge;

export interface FamilyTree {
  rootId: number;
  nodes: FamilyTreeNode[];
  edges: FamilyTreeEdge[];
}

/**
 * Construit l'arbre généalogique complet (ascendants + descendants,
 * sans limite de profondeur) visible depuis une Person racine :
 * - Ascendants : tous les parents (via Filiation) remontés récursivement.
 * - Descendants : tous les enfants (via Filiation) descendus récursivement.
 * - Partenaires d'union : inclus à la même génération que la personne
 *   avec laquelle ils partagent une Union (ex. conjoint d'un ascendant
 *   ou descendant), afin que la vue affiche les couples complets.
 *
 * Lit l'intégralité des Person/Union/Filiation en une seule fois puis
 * traverse en mémoire : suffisant pour un jeu de données de démonstration
 * et évite le n+1 sur de multiples aller-retours DB par relation.
 */
export async function getFamilyTree(db: Database, rootId: number): Promise<FamilyTree> {
  const root = await getPersonById(db, rootId); // lève NotFoundError si absent

  const [allPersons, allUnions, allFiliations] = await Promise.all([
    listPersons(db),
    listUnions(db),
    listFiliations(db),
  ]);

  const personById = new Map(allPersons.map((p) => [p.id, p]));

  const parentsOf = new Map<number, Filiation[]>();
  const childrenOf = new Map<number, Filiation[]>();
  for (const f of allFiliations) {
    if (!childrenOf.has(f.parentId)) childrenOf.set(f.parentId, []);
    childrenOf.get(f.parentId)!.push(f);
    if (!parentsOf.has(f.childId)) parentsOf.set(f.childId, []);
    parentsOf.get(f.childId)!.push(f);
  }

  const unionsOfPerson = new Map<number, Union[]>();
  for (const u of allUnions) {
    for (const personId of u.personIds) {
      if (!unionsOfPerson.has(personId)) unionsOfPerson.set(personId, []);
      unionsOfPerson.get(personId)!.push(u);
    }
  }

  const generationOf = new Map<number, number>();
  const includedFiliationIds = new Set<number>();
  const includedUnionIds = new Set<number>();

  generationOf.set(root.id, 0);

  // BFS ascendants (générations négatives) et descendants (générations
  // positives) en partant de la racine ; les partenaires d'union sont
  // ajoutés à la même génération que la personne visitée.
  const queue: number[] = [root.id];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentGeneration = generationOf.get(currentId)!;
    if (!personById.has(currentId)) continue; // référence orpheline défensive

    // Partenaires d'union : même génération.
    for (const union of unionsOfPerson.get(currentId) ?? []) {
      includedUnionIds.add(union.id);
      for (const partnerId of union.personIds) {
        if (!generationOf.has(partnerId) && personById.has(partnerId)) {
          generationOf.set(partnerId, currentGeneration);
          queue.push(partnerId);
        }
      }
    }

    // Ascendants (parents) : génération - 1.
    for (const f of parentsOf.get(currentId) ?? []) {
      includedFiliationIds.add(f.id);
      if (!generationOf.has(f.parentId) && personById.has(f.parentId)) {
        generationOf.set(f.parentId, currentGeneration - 1);
        queue.push(f.parentId);
      }
    }

    // Descendants (enfants) : génération + 1.
    for (const f of childrenOf.get(currentId) ?? []) {
      includedFiliationIds.add(f.id);
      if (!generationOf.has(f.childId) && personById.has(f.childId)) {
        generationOf.set(f.childId, currentGeneration + 1);
        queue.push(f.childId);
      }
    }
  }

  const nodes: FamilyTreeNode[] = Array.from(generationOf.entries()).map(
    ([personId, generation]) => ({
      person: personById.get(personId)!,
      generation,
    }),
  );

  const edges: FamilyTreeEdge[] = [
    ...allFiliations
      .filter((f) => includedFiliationIds.has(f.id))
      .map(
        (f): FamilyTreeFiliationEdge => ({
          type: "filiation",
          filiationId: f.id,
          parentId: f.parentId,
          childId: f.childId,
          role: f.role,
        }),
      ),
    ...allUnions
      .filter((u) => includedUnionIds.has(u.id))
      .map(
        (u): FamilyTreeUnionEdge => ({
          type: "union",
          unionId: u.id,
          personIds: u.personIds,
        }),
      ),
  ];

  return { rootId: root.id, nodes, edges };
}
