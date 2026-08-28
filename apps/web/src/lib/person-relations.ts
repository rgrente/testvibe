import type { FamilyTree, FiliationRole, Person } from "@testvibe/core";

export interface PersonRelation {
  person: Person;
  role: string;
}

export interface PersonRelations {
  parents: PersonRelation[];
  partners: PersonRelation[];
  children: PersonRelation[];
}

const filiationLabel: Record<FiliationRole, string> = {
  biologique: "biologique",
  adopte: "adopté",
  "beau-parent": "beau-parent",
};

function parentLabel(person: Person, role: FiliationRole) {
  const kinship = person.gender === "F" ? "Mère" : person.gender === "M" ? "Père" : "Parent";
  return `${kinship} · ${filiationLabel[role]}`;
}

function childLabel(person: Person, role: FiliationRole) {
  const kinship = person.gender === "F" ? "Fille" : person.gender === "M" ? "Fils" : "Enfant";
  return `${kinship} · ${filiationLabel[role]}`;
}

export function selectPersonRelations(tree: FamilyTree, personId: number): PersonRelations {
  const personById = new Map(tree.nodes.map(({ person }) => [person.id, person]));
  const parents: PersonRelation[] = [];
  const children: PersonRelation[] = [];
  const partners = new Map<number, PersonRelation>();

  for (const edge of tree.edges) {
    if (edge.type === "filiation") {
      if (edge.childId === personId) {
        const person = personById.get(edge.parentId);
        if (person) parents.push({ person, role: parentLabel(person, edge.role) });
      }
      if (edge.parentId === personId) {
        const person = personById.get(edge.childId);
        if (person) children.push({ person, role: childLabel(person, edge.role) });
      }
      continue;
    }

    if (!edge.personIds.includes(personId)) continue;
    for (const partnerId of edge.personIds) {
      const person = personById.get(partnerId);
      if (partnerId !== personId && person) partners.set(partnerId, { person, role: "Partenaire" });
    }
  }

  return { parents, partners: [...partners.values()], children };
}
