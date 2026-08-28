import type { FamilyTree } from "@testvibe/core";

const person = (
  id: number,
  firstName: string,
  lastName: string,
  gender: "M" | "F" | "autre",
  birthDate: string | null,
  deathDate: string | null = null,
  birthName: string | null = null,
) => ({ id, firstName, lastName, gender, birthDate, deathDate, birthName }) as FamilyTree["nodes"][number]["person"];

/** Fixture stable issue #85 : données volontairement partielles et nom long. */
export const grenteRenaultTree: FamilyTree = {
  rootId: 5,
  nodes: [
    { person: person(1, "Pascal", "Grente", "M", "1954"), generation: -1 },
    { person: person(2, "Laurence", "Durand", "F", "1956-04-12", null, "Moreau"), generation: -1 },
    { person: person(3, "Didier", "Renault", "M", null, "2020"), generation: -1 },
    { person: person(4, "Martine", "Leclerc", "F", "1958-09-03"), generation: -1 },
    { person: person(5, "Romain", "Grente", "M", "1984-02-17"), generation: 0 },
    { person: person(6, "Mathilde", "Renault", "F", "1986-07-29"), generation: 0 },
    { person: person(7, "Maxime", "Grente", "M", "1981"), generation: 0 },
    { person: person(8, "Camille", "Grente", "autre", null), generation: 0 },
    { person: person(9, "Anne-Sophie-Alexandrine", "Grente de la Vallière", "F", "1991-11-08"), generation: 0 },
    { person: person(10, "Léni", "Grente", "M", "2018-05-20"), generation: 1 },
  ],
  edges: [
    { type: "union", unionId: 100, personIds: [1, 2] },
    { type: "union", unionId: 101, personIds: [5, 6] },
    ...[5, 7, 8, 9].flatMap((childId, index) => [
      { type: "filiation" as const, filiationId: 200 + index * 2, parentId: 1, childId, role: "biologique" as const },
      { type: "filiation" as const, filiationId: 201 + index * 2, parentId: 2, childId, role: "biologique" as const },
    ]),
    { type: "filiation", filiationId: 210, parentId: 3, childId: 6, role: "biologique" },
    { type: "filiation", filiationId: 211, parentId: 4, childId: 6, role: "biologique" },
    { type: "filiation", filiationId: 212, parentId: 5, childId: 10, role: "biologique" },
    { type: "filiation", filiationId: 213, parentId: 6, childId: 10, role: "biologique" },
  ],
};
