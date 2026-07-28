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

  const generationOf = new Map<number, number>([[root.id, 0]]);

  // Les deux parcours restent strictement directionnels. Un ascendant ne
  // devient donc jamais le point de départ d'une descente vers une branche
  // collatérale, et réciproquement pour un descendant.
  const ancestorQueue: number[] = [root.id];
  for (let index = 0; index < ancestorQueue.length; index += 1) {
    const currentId = ancestorQueue[index]!;
    const currentGeneration = generationOf.get(currentId)!;
    for (const filiation of parentsOf.get(currentId) ?? []) {
      if (
        filiation.parentId !== root.id &&
        personById.has(filiation.parentId) &&
        !generationOf.has(filiation.parentId)
      ) {
        generationOf.set(filiation.parentId, currentGeneration - 1);
        ancestorQueue.push(filiation.parentId);
      }
    }
  }

  // Les frères et sœurs partagent au moins un parent avec la racine. Ils sont
  // ajoutés à la génération de la racine, sans être mis dans la file des
  // descendants : leur propre branche collatérale ne doit pas être parcourue.
  // Le Set `generationOf` déduplique naturellement un enfant qui partage les
  // deux parents et conserve la racine si une relation cyclique est présente.
  for (const parentFiliation of parentsOf.get(root.id) ?? []) {
    for (const siblingFiliation of childrenOf.get(parentFiliation.parentId) ?? []) {
      const siblingId = siblingFiliation.childId;
      if (siblingId !== root.id && personById.has(siblingId) && !generationOf.has(siblingId)) {
        generationOf.set(siblingId, 0);
      }
    }
  }

  const descendantQueue: number[] = [root.id];
  for (let index = 0; index < descendantQueue.length; index += 1) {
    const currentId = descendantQueue[index]!;
    const currentGeneration = generationOf.get(currentId)!;
    for (const filiation of childrenOf.get(currentId) ?? []) {
      if (
        filiation.childId !== root.id &&
        personById.has(filiation.childId) &&
        !generationOf.has(filiation.childId)
      ) {
        generationOf.set(filiation.childId, currentGeneration + 1);
        descendantQueue.push(filiation.childId);
      }
    }
  }

  // Les partenaires complètent les couples visibles mais ne sont jamais mis
  // dans les files ci-dessus : leurs propres ascendants et descendants ne
  // peuvent ainsi réintroduire une branche sans lien directionnel à la racine.
  const directionalIds = new Set(generationOf.keys());
  for (const personId of directionalIds) {
    const generation = generationOf.get(personId)!;
    for (const union of unionsOfPerson.get(personId) ?? []) {
      for (const partnerId of union.personIds) {
        if (personById.has(partnerId) && !generationOf.has(partnerId)) {
          generationOf.set(partnerId, generation);
        }
      }
    }
  }

  const includedPersonIds = new Set(generationOf.keys());
  const nodes: FamilyTreeNode[] = Array.from(generationOf.entries()).map(
    ([personId, generation]) => ({ person: personById.get(personId)!, generation }),
  );

  const edges: FamilyTreeEdge[] = [
    ...allFiliations
      .filter(
        (f) => includedPersonIds.has(f.parentId) && includedPersonIds.has(f.childId),
      )
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
      .filter(
        (u) =>
          u.personIds.length > 0 &&
          u.personIds.every((personId) => includedPersonIds.has(personId)),
      )
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
