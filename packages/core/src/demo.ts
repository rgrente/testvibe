/**
 * Jeu de données de démonstration pour la visualisation de l'arbre
 * généalogique (Phase 2, tâche #21). Sert uniquement à peupler une
 * base (mémoire ou fichier local) pour valider l'affichage — aucune
 * donnée réelle. Trois générations, une union avec plusieurs enfants.
 */
import type { Database } from "@testvibe/db";
import { createPerson } from "./person.js";
import { createUnion } from "./union.js";
import { createFiliation } from "./filiation.js";

export interface SeedDemoFamilyResult {
  /** Id de la Person recommandée comme racine par défaut pour la vue arbre. */
  rootId: number;
}

/**
 * Peuple la base fournie avec une famille de démonstration sur 3
 * générations :
 *
 *   Grands-parents (génération -1) : Ada Lovelace & William King (union)
 *     └─ Parents (génération 0, racine) : Byron King & Anne Fontaine (union)
 *          ├─ Enfant 1 (génération 1) : Ralph King
 *          ├─ Enfant 2 (génération 1) : Grace King
 *          └─ Enfant 3 (génération 1) : Charles King
 *
 * La racine recommandée (rootId) est Byron King : il a des ascendants
 * ET des descendants, ce qui exerce à la fois la navigation vers le
 * haut et vers le bas de l'arbre.
 */
export async function seedDemoFamily(db: Database): Promise<SeedDemoFamilyResult> {
  const grandParentA = await createPerson(db, {
    firstName: "Ada",
    lastName: "Lovelace",
    birthDate: "1815-12-10",
    gender: "F",
  });
  const grandParentB = await createPerson(db, {
    firstName: "William",
    lastName: "King",
    birthDate: "1805-03-16",
    gender: "M",
  });
  await createUnion(db, {
    startDate: "1835-07-08",
    personIds: [grandParentA.id, grandParentB.id],
  });

  const parentA = await createPerson(db, {
    firstName: "Byron",
    lastName: "King",
    birthDate: "1836-05-12",
    gender: "M",
  });
  await createFiliation(db, {
    parentId: grandParentA.id,
    childId: parentA.id,
    role: "biologique",
  });
  await createFiliation(db, {
    parentId: grandParentB.id,
    childId: parentA.id,
    role: "biologique",
  });

  const parentB = await createPerson(db, {
    firstName: "Anne",
    lastName: "Fontaine",
    birthDate: "1838-02-20",
    gender: "F",
  });
  await createUnion(db, {
    startDate: "1858-09-01",
    personIds: [parentA.id, parentB.id],
  });

  const child1 = await createPerson(db, {
    firstName: "Ralph",
    lastName: "King",
    birthDate: "1860-01-01",
    gender: "M",
  });
  const child2 = await createPerson(db, {
    firstName: "Grace",
    lastName: "King",
    birthDate: "1862-06-15",
    gender: "F",
  });
  const child3 = await createPerson(db, {
    firstName: "Charles",
    lastName: "King",
    birthDate: "1865-11-30",
    gender: "M",
  });

  for (const child of [child1, child2, child3]) {
    await createFiliation(db, { parentId: parentA.id, childId: child.id, role: "biologique" });
    await createFiliation(db, { parentId: parentB.id, childId: child.id, role: "biologique" });
  }

  return { rootId: parentA.id };
}
