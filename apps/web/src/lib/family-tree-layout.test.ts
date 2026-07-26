import { describe, it, expect } from "vitest";
import type { FamilyTree } from "@testvibe/core";
import { buildReactFlowGraph, buildHierarchyRows, type PersonNodeData } from "./family-tree-layout";

function makeTree(): FamilyTree {
  return {
    rootId: 2,
    nodes: [
      { person: { id: 1, firstName: "Ada", lastName: "Lovelace", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
      { person: { id: 2, firstName: "Byron", lastName: "King", birthDate: "1950-05-12", deathDate: null, gender: "M" } as any, generation: 0 },
      { person: { id: 3, firstName: "Anne", lastName: "Fontaine", birthDate: null, deathDate: null, gender: "F" } as any, generation: 0 },
      { person: { id: 4, firstName: "Ralph", lastName: "King", birthDate: null, deathDate: null, gender: null } as any, generation: 1 },
    ],
    edges: [
      { type: "filiation", filiationId: 10, parentId: 1, childId: 2, role: "biologique" },
      { type: "union", unionId: 20, personIds: [2, 3] },
      { type: "filiation", filiationId: 11, parentId: 2, childId: 4, role: "biologique" },
      { type: "filiation", filiationId: 12, parentId: 3, childId: 4, role: "biologique" },
    ],
  };
}

function personData(node: ReturnType<typeof buildReactFlowGraph>["nodes"][number]): PersonNodeData {
  return node.data as PersonNodeData;
}

describe("buildReactFlowGraph", () => {
  it("crée un noeud react-flow par Person avec sa génération et si c'est la racine", () => {
    const graph = buildReactFlowGraph(makeTree());
    const personNodes = graph.nodes.filter((n) => n.type === "person");
    expect(personNodes).toHaveLength(4);

    const root = graph.nodes.find((n) => n.id === "2")!;
    expect(personData(root).isRoot).toBe(true);
    expect(personData(root).generation).toBe(0);
    expect(personData(root).label).toBe("Byron King");

    const nonRoot = graph.nodes.find((n) => n.id === "1")!;
    expect(personData(nonRoot).isRoot).toBe(false);
  });

  it("propage le genre et les dates de naissance/décès dans les données du noeud", () => {
    const graph = buildReactFlowGraph(makeTree());
    const byron = personData(graph.nodes.find((n) => n.id === "2")!);
    expect(byron.gender).toBe("M");
    expect(byron.birthDate).toBe("1950-05-12");
    expect(byron.deathDate).toBeNull();

    const ada = personData(graph.nodes.find((n) => n.id === "1")!);
    expect(ada.gender).toBeNull();
  });

  it("place les générations sur des lignes y distinctes et croissantes", () => {
    const graph = buildReactFlowGraph(makeTree());
    const personNodes = graph.nodes.filter((n) => n.type === "person");
    const yByGeneration = new Map(personNodes.map((n) => [personData(n).generation, n.position.y]));
    expect(yByGeneration.get(-1)!).toBeLessThan(yByGeneration.get(0)!);
    expect(yByGeneration.get(0)!).toBeLessThan(yByGeneration.get(1)!);
  });

  it("répartit horizontalement les noeuds d'une même génération (positions x distinctes)", () => {
    const graph = buildReactFlowGraph(makeTree());
    const gen0 = graph.nodes.filter((n) => n.type === "person" && personData(n).generation === 0);
    expect(gen0).toHaveLength(2);
    expect(gen0[0].position.x).not.toBe(gen0[1].position.x);
  });

  it("place les deux partenaires d'une Union sur des colonnes adjacentes même si un tiers de la même génération les sépare par ordre d'id", () => {
    const tree: FamilyTree = {
      rootId: 2,
      nodes: [
        { person: { id: 2, firstName: "Byron", lastName: "King", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        // Id 5 s'intercale entre les deux partenaires (2 et 9) par tri naïf.
        { person: { id: 5, firstName: "Autre", lastName: "Personne", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        { person: { id: 9, firstName: "Anne", lastName: "Fontaine", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
      ],
      edges: [{ type: "union", unionId: 30, personIds: [2, 9] }],
    };
    const graph = buildReactFlowGraph(tree);
    const byron = graph.nodes.find((n) => n.id === "2")!;
    const anne = graph.nodes.find((n) => n.id === "9")!;
    expect(Math.abs(anne.position.x - byron.position.x)).toBe(300);
  });

  it("place l'homme à gauche et la femme à droite dans un couple, même si l'ordre de rencontre suggère l'inverse", () => {
    const tree: FamilyTree = {
      rootId: 9,
      nodes: [
        // Anne (F, id 2) rencontrée avant Byron (M, id 9) par tri id/date :
        // sans la règle de genre, Anne se retrouverait à gauche.
        { person: { id: 2, firstName: "Anne", lastName: "Fontaine", birthDate: null, deathDate: null, gender: "F" } as any, generation: 0 },
        { person: { id: 9, firstName: "Byron", lastName: "King", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
      ],
      edges: [{ type: "union", unionId: 30, personIds: [2, 9] }],
    };
    const graph = buildReactFlowGraph(tree);
    const byronX = graph.nodes.find((n) => n.id === "9")!.position.x;
    const anneX = graph.nodes.find((n) => n.id === "2")!.position.x;
    expect(byronX).toBeLessThan(anneX);
  });

  it("conserve l'ordre de rencontre pour départager un couple de même genre (ex. deux hommes)", () => {
    const tree: FamilyTree = {
      rootId: 9,
      nodes: [
        { person: { id: 2, firstName: "Marc", lastName: "Fontaine", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
        { person: { id: 9, firstName: "Byron", lastName: "King", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
      ],
      edges: [{ type: "union", unionId: 30, personIds: [2, 9] }],
    };
    const graph = buildReactFlowGraph(tree);
    const byronX = graph.nodes.find((n) => n.id === "9")!.position.x;
    const marcX = graph.nodes.find((n) => n.id === "2")!.position.x;
    // Aucun des deux n'est prioritaire par genre : Marc (id 2, rencontré en
    // premier par tri id) reste à gauche.
    expect(marcX).toBeLessThan(byronX);
  });

  it("ordonne les enfants par date de naissance plutôt que par id", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [
        { person: { id: 1, firstName: "Parent", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        // Ids volontairement en désordre par rapport aux dates de naissance.
        { person: { id: 20, firstName: "Cadet", lastName: "Grente", birthDate: "2018-01-01", deathDate: null, gender: null } as any, generation: 1 },
        { person: { id: 21, firstName: "Aine", lastName: "Grente", birthDate: "2016-01-01", deathDate: null, gender: null } as any, generation: 1 },
        { person: { id: 22, firstName: "Benjamin", lastName: "Grente", birthDate: "2020-01-01", deathDate: null, gender: null } as any, generation: 1 },
      ],
      edges: [
        { type: "filiation", filiationId: 1, parentId: 1, childId: 20, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 1, childId: 21, role: "biologique" },
        { type: "filiation", filiationId: 3, parentId: 1, childId: 22, role: "biologique" },
      ],
    };
    const graph = buildReactFlowGraph(tree);
    const xOf = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;
    // Aine (2016) < Cadet (2018) < Benjamin (2020), indépendamment de l'ordre des id (21, 20, 22).
    expect(xOf("21")).toBeLessThan(xOf("20"));
    expect(xOf("20")).toBeLessThan(xOf("22"));
  });

  it("crée un point de jonction pour une Union à deux partenaires, relié aux deux partenaires", () => {
    const graph = buildReactFlowGraph(makeTree());
    const junction = graph.nodes.find((n) => n.id === "union-20");
    expect(junction).toBeDefined();
    expect(junction!.type).toBe("unionJunction");

    expect(graph.edges.find((e) => e.id === "union-20-link-2")).toMatchObject({
      source: "2",
      target: "union-20",
    });
    expect(graph.edges.find((e) => e.id === "union-20-link-3")).toMatchObject({
      source: "3",
      target: "union-20",
    });
  });

  it("fusionne les Filiation d'un enfant commun aux deux partenaires en une seule arête depuis le point de jonction", () => {
    const graph = buildReactFlowGraph(makeTree());
    const merged = graph.edges.find((e) => e.id === "union-20-child-4");
    expect(merged).toMatchObject({ source: "union-20", target: "4", label: "biologique" });

    // Les arêtes de Filiation individuelles (11 et 12) ne doivent plus apparaître telles quelles.
    expect(graph.edges.find((e) => e.id === "filiation-11")).toBeUndefined();
    expect(graph.edges.find((e) => e.id === "filiation-12")).toBeUndefined();
  });

  it("ancre chaque couple d'ascendants sur la position de son propre enfant, plutôt que de trier par id", () => {
    // Reproduit le cas où deux couples d'une même génération d'ascendants
    // se rattachent chacun à un enfant différent de la génération 0 :
    // sans ancrage, l'ordre par id placerait Pascal+Laurence à gauche et
    // Didier+Martine à droite, alors que Mathilde (leur fille) est à
    // gauche et Romain (fils de Pascal+Laurence) à droite — provoquant
    // un croisement des liens de Filiation.
    const tree: FamilyTree = {
      rootId: 11,
      nodes: [
        // Genre neutre partout : ce test porte sur l'anti-croisement par
        // ancrage, indépendamment de la règle homme-à-gauche (cf. tests dédiés).
        { person: { id: 1, firstName: "Pascal", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
        { person: { id: 2, firstName: "Laurence", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
        { person: { id: 3, firstName: "Didier", lastName: "Renault", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
        { person: { id: 4, firstName: "Martine", lastName: "Renault", birthDate: null, deathDate: null, gender: null } as any, generation: -1 },
        { person: { id: 10, firstName: "Mathilde", lastName: "Renault", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        { person: { id: 11, firstName: "Romain", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
      ],
      edges: [
        { type: "union", unionId: 100, personIds: [10, 11] },
        { type: "union", unionId: 200, personIds: [1, 2] },
        { type: "union", unionId: 201, personIds: [3, 4] },
        { type: "filiation", filiationId: 1, parentId: 1, childId: 11, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 2, childId: 11, role: "biologique" },
        { type: "filiation", filiationId: 3, parentId: 3, childId: 10, role: "biologique" },
        { type: "filiation", filiationId: 4, parentId: 4, childId: 10, role: "biologique" },
      ],
    };

    const graph = buildReactFlowGraph(tree);
    const xOf = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;

    const mathildeX = xOf("10");
    const romainX = xOf("11");
    const didierMartineMaxX = Math.max(xOf("3"), xOf("4"));
    const pascalLaurenceMinX = Math.min(xOf("1"), xOf("2"));

    expect(mathildeX).toBeLessThan(romainX);
    // Didier+Martine (parents de Mathilde) entièrement à gauche de Pascal+Laurence (parents de Romain).
    expect(didierMartineMaxX).toBeLessThan(pascalLaurenceMinX);

    // Les deux couples d'ascendants ont la même largeur et sont tous deux
    // gênés par l'autre : l'écart nécessaire pour respecter l'espacement
    // minimal doit être réparti à parts égales (chacun s'éloigne autant de
    // son propre ancrage), plutôt que d'être entièrement absorbé par un
    // seul des deux couples.
    const didierMartineMidpoint = (xOf("3") + xOf("4")) / 2;
    const pascalLaurenceMidpoint = (xOf("1") + xOf("2")) / 2;
    const leftShift = mathildeX - didierMartineMidpoint;
    const rightShift = pascalLaurenceMidpoint - romainX;
    expect(leftShift).toBeGreaterThan(0);
    expect(leftShift).toBeCloseTo(rightShift, 5);
  });

  it("centre un couple d'ascendants exactement sur son enfant unique", () => {
    const tree: FamilyTree = {
      rootId: 11,
      nodes: [
        { person: { id: 1, firstName: "Pascal", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: -1 },
        { person: { id: 2, firstName: "Laurence", lastName: "Grente", birthDate: null, deathDate: null, gender: "F" } as any, generation: -1 },
        { person: { id: 11, firstName: "Romain", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
      ],
      edges: [
        { type: "union", unionId: 200, personIds: [1, 2] },
        { type: "filiation", filiationId: 1, parentId: 1, childId: 11, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 2, childId: 11, role: "biologique" },
      ],
    };

    const graph = buildReactFlowGraph(tree);
    const xOf = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;
    const coupleMidpoint = (xOf("1") + xOf("2")) / 2;

    expect(coupleMidpoint).toBe(xOf("11"));
  });

  it("centre un couple d'ascendants sur la largeur occupée par ses deux enfants (fratrie)", () => {
    const tree: FamilyTree = {
      rootId: 11,
      nodes: [
        { person: { id: 1, firstName: "Pascal", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: -1 },
        { person: { id: 2, firstName: "Laurence", lastName: "Grente", birthDate: null, deathDate: null, gender: "F" } as any, generation: -1 },
        { person: { id: 11, firstName: "Romain", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: 0 },
        { person: { id: 12, firstName: "Sophie", lastName: "Grente", birthDate: null, deathDate: null, gender: "F" } as any, generation: 0 },
      ],
      edges: [
        { type: "union", unionId: 200, personIds: [1, 2] },
        { type: "filiation", filiationId: 1, parentId: 1, childId: 11, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 2, childId: 11, role: "biologique" },
        { type: "filiation", filiationId: 3, parentId: 1, childId: 12, role: "biologique" },
        { type: "filiation", filiationId: 4, parentId: 2, childId: 12, role: "biologique" },
      ],
    };

    const graph = buildReactFlowGraph(tree);
    const xOf = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;
    const coupleMidpoint = (xOf("1") + xOf("2")) / 2;
    const childrenMidpoint = (xOf("11") + xOf("12")) / 2;

    expect(coupleMidpoint).toBe(childrenMidpoint);
  });

  it("n'utilise pas une unité sans ancrage pour contraindre la position d'un cluster ancré voisin", () => {
    // Maxime (frère de Mathilde) est dans la même génération que le couple
    // Romain+Mathilde, mais n'a aucun enfant connu dans cette vue : il ne
    // doit pas décentrer Romain+Mathilde de la fratrie Léni/Mahé.
    const tree: FamilyTree = {
      rootId: 30,
      nodes: [
        { person: { id: 1, firstName: "Romain", lastName: "Grente", birthDate: null, deathDate: null, gender: "M" } as any, generation: -1 },
        { person: { id: 2, firstName: "Mathilde", lastName: "Renault", birthDate: null, deathDate: null, gender: "F" } as any, generation: -1 },
        { person: { id: 3, firstName: "Maxime", lastName: "Renault", birthDate: null, deathDate: null, gender: "M" } as any, generation: -1 },
        { person: { id: 30, firstName: "Leni", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
        { person: { id: 31, firstName: "Mahe", lastName: "Grente", birthDate: null, deathDate: null, gender: null } as any, generation: 0 },
      ],
      edges: [
        { type: "union", unionId: 100, personIds: [1, 2] },
        { type: "filiation", filiationId: 1, parentId: 1, childId: 30, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 2, childId: 30, role: "biologique" },
        { type: "filiation", filiationId: 3, parentId: 1, childId: 31, role: "biologique" },
        { type: "filiation", filiationId: 4, parentId: 2, childId: 31, role: "biologique" },
      ],
    };

    const graph = buildReactFlowGraph(tree);
    const xOf = (id: string) => graph.nodes.find((n) => n.id === id)!.position.x;
    const coupleMidpoint = (xOf("1") + xOf("2")) / 2;
    const childrenMidpoint = (xOf("30") + xOf("31")) / 2;

    expect(coupleMidpoint).toBe(childrenMidpoint);
  });

  it("garde une arête de Filiation directe quand le parent n'a pas d'Union commune avec un autre parent", () => {
    const graph = buildReactFlowGraph(makeTree());
    expect(graph.edges.find((e) => e.id === "filiation-10")).toMatchObject({
      source: "1",
      target: "2",
      label: "biologique",
    });
  });
});

describe("buildHierarchyRows", () => {
  it("trie par génération croissante (ascendants avant la racine, descendants après)", () => {
    const rows = buildHierarchyRows(makeTree());
    expect(rows.map((r) => r.personId)).toEqual([1, 2, 3, 4]);
    expect(rows[0].generation).toBe(-1);
    expect(rows[3].generation).toBe(1);
  });

  it("marque isRoot uniquement sur la racine et calcule la profondeur d'indentation", () => {
    const rows = buildHierarchyRows(makeTree());
    const root = rows.find((r) => r.personId === 2)!;
    expect(root.isRoot).toBe(true);
    expect(root.depth).toBe(0);

    const grandParent = rows.find((r) => r.personId === 1)!;
    expect(grandParent.depth).toBe(1);
    expect(grandParent.isRoot).toBe(false);
  });

  it("inclut le label complet (prénom + nom)", () => {
    const rows = buildHierarchyRows(makeTree());
    expect(rows.find((r) => r.personId === 4)!.label).toBe("Ralph King");
  });
});
