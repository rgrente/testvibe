import { describe, expect, it } from "vitest";
import { computeKinship } from "./kinship.js";
import type { Filiation, FiliationRole, Person } from "./types.js";

/**
 * `computeKinship` est une fonction pure : les jeux de données sont
 * construits en mémoire avec des identifiants explicites, sans base de test.
 * Chaque describe isole une relation pour éviter tout bruit dans les
 * ancêtres communs et les chemins.
 */
function personne(id: number, firstName: string, gender: string | null = null): Person {
  return {
    id,
    firstName,
    lastName: "Dupont",
    birthName: null,
    birthDate: null,
    deathDate: null,
    gender,
  };
}

function filiation(
  id: number,
  parentId: number,
  childId: number,
  role: FiliationRole = "biologique",
): Filiation {
  return { id, parentId, childId, role };
}

/** Noms des étapes du chemin canonique, dans l'ordre from → to. */
function nomsDuChemin(steps: { name: string }[]): string[] {
  return steps.map((step) => step.name);
}

describe("computeKinship — même personne", () => {
  const persons = [personne(1, "Ada", "F"), personne(2, "Alan", "M"), personne(3, "Camille")];

  it("retourne « elle-même » pour une personne de genre féminin", () => {
    const result = computeKinship(persons, [], 1, 1);

    expect(result.samePerson).toBe(true);
    expect(result.unrelated).toBe(false);
    expect(result.link).toEqual({
      label: "elle-même",
      relation: "same",
      degree: 0,
      generationGap: 0,
    });
    expect(result.commonAncestors).toEqual([]);
    expect(result.paths).toEqual([]);
    expect(result.multipleRelationships).toBe(false);
  });

  it("retourne « lui-même » pour un genre masculin ou inconnu", () => {
    expect(computeKinship(persons, [], 2, 2).link?.label).toBe("lui-même");
    expect(computeKinship(persons, [], 3, 3).link?.label).toBe("lui-même");
  });
});

describe("computeKinship — ascendants et descendants directs", () => {
  // Jean → Marie → Luc → Zoé → Emma (cinq générations en ligne directe).
  const persons = [
    personne(1, "Jean", "M"),
    personne(2, "Marie", "F"),
    personne(3, "Luc", "M"),
    personne(4, "Zoé", "F"),
    personne(5, "Emma", "F"),
  ];
  const filiations = [
    filiation(1, 1, 2),
    filiation(2, 2, 3),
    filiation(3, 3, 4),
    filiation(4, 4, 5),
  ];

  it("qualifie le parent direct", () => {
    const result = computeKinship(persons, filiations, 1, 2);

    expect(result.link).toEqual({
      label: "père",
      relation: "ascendant",
      degree: 1,
      generationGap: 0,
    });
    expect(result.paths).toEqual([
      {
        commonAncestorId: 1,
        steps: [
          { personId: 1, name: "Jean Dupont" },
          { personId: 2, name: "Marie Dupont", edgeRole: "biologique" },
        ],
      },
    ]);
    expect(result.commonAncestors).toEqual([]);
    expect(result.multipleRelationships).toBe(false);
  });

  it("qualifie les grands-parents et arrière-grands-parents", () => {
    expect(computeKinship(persons, filiations, 1, 3).link?.label).toBe("grand-père");
    expect(computeKinship(persons, filiations, 2, 4).link?.label).toBe("grand-mère");
    expect(computeKinship(persons, filiations, 1, 4).link?.label).toBe("arrière-grand-père");
    expect(computeKinship(persons, filiations, 2, 5).link?.label).toBe("arrière-grand-mère");
    expect(computeKinship(persons, filiations, 1, 5).link?.label).toBe(
      "arrière-arrière-grand-père",
    );

    const grandPere = computeKinship(persons, filiations, 1, 3);
    expect(grandPere.link?.degree).toBe(2);
    expect(nomsDuChemin(grandPere.paths[0]!.steps)).toEqual([
      "Jean Dupont",
      "Marie Dupont",
      "Luc Dupont",
    ]);
  });

  it("qualifie l'enfant direct", () => {
    const result = computeKinship(persons, filiations, 2, 1);

    expect(result.link).toEqual({
      label: "fille",
      relation: "descendant",
      degree: 1,
      generationGap: 0,
    });
    expect(result.paths[0]).toEqual({
      commonAncestorId: 1,
      steps: [
        { personId: 2, name: "Marie Dupont" },
        { personId: 1, name: "Jean Dupont", edgeRole: "biologique" },
      ],
    });
  });

  it("qualifie les petits-enfants et arrière-petits-enfants", () => {
    expect(computeKinship(persons, filiations, 3, 1).link?.label).toBe("petit-fils");
    expect(computeKinship(persons, filiations, 4, 1).link?.label).toBe("arrière-petite-fille");
    expect(computeKinship(persons, filiations, 5, 1).link?.label).toBe(
      "arrière-arrière-petite-fille",
    );

    const petitFils = computeKinship(persons, filiations, 3, 1);
    expect(petitFils.link?.relation).toBe("descendant");
    expect(petitFils.link?.degree).toBe(2);
  });
});

describe("computeKinship — fratrie", () => {
  it("qualifie un frère et une sœur partageant deux parents", () => {
    const persons = [
      personne(1, "Pierre", "M"),
      personne(2, "Anne", "F"),
      personne(3, "Paul", "M"),
      personne(4, "Julie", "F"),
    ];
    const filiations = [
      filiation(1, 1, 3),
      filiation(2, 2, 3),
      filiation(3, 1, 4),
      filiation(4, 2, 4),
    ];

    const frere = computeKinship(persons, filiations, 3, 4);
    expect(frere.link).toEqual({
      label: "frère",
      relation: "frere-soeur",
      degree: 0,
      generationGap: 0,
    });
    expect(frere.commonAncestors).toEqual([
      { id: 1, name: "Pierre Dupont" },
      { id: 2, name: "Anne Dupont" },
    ]);
    // Une fratrie complète est reliée par DEUX ancêtres communs à la somme de
    // distances minimale (le père et la mère), donc par deux chemins simples
    // distincts : le drapeau signale bien « plusieurs chemins de parenté ».
    expect(frere.multipleRelationships).toBe(true);
    expect(frere.paths[0]).toEqual({
      commonAncestorId: 1,
      steps: [
        { personId: 3, name: "Paul Dupont" },
        { personId: 1, name: "Pierre Dupont", edgeRole: "biologique" },
        { personId: 4, name: "Julie Dupont", edgeRole: "biologique" },
      ],
    });

    expect(computeKinship(persons, filiations, 4, 3).link?.label).toBe("sœur");
  });

  it("qualifie un demi-frère et une demi-sœur ne partageant qu'un parent", () => {
    const persons = [
      personne(1, "Pierre", "M"),
      personne(2, "Anne", "F"),
      personne(3, "Paul", "M"),
      personne(4, "Julie", "F"),
      personne(5, "Sophie", "F"),
    ];
    const filiations = [
      filiation(1, 1, 3),
      filiation(2, 2, 3),
      filiation(3, 1, 4),
      filiation(4, 5, 4),
    ];

    const demiFrere = computeKinship(persons, filiations, 3, 4);
    expect(demiFrere.link).toEqual({
      label: "demi-frère",
      relation: "frere-soeur",
      degree: 0,
      generationGap: 0,
    });
    expect(demiFrere.commonAncestors).toEqual([{ id: 1, name: "Pierre Dupont" }]);
    expect(demiFrere.multipleRelationships).toBe(false);
    expect(nomsDuChemin(demiFrere.paths[0]!.steps)).toEqual([
      "Paul Dupont",
      "Pierre Dupont",
      "Julie Dupont",
    ]);

    expect(computeKinship(persons, filiations, 4, 3).link?.label).toBe("demi-sœur");
  });
});

describe("computeKinship — oncles, tantes, neveux et nièces", () => {
  // Pierre × Anne → Marc, Julie et Hugo ; Marc → Léa et Tom.
  const persons = [
    personne(1, "Pierre", "M"),
    personne(2, "Anne", "F"),
    personne(3, "Marc", "M"),
    personne(4, "Julie", "F"),
    personne(5, "Léa", "F"),
    personne(6, "Tom", "M"),
    personne(7, "Hugo", "M"),
  ];
  const filiations = [
    filiation(1, 1, 3),
    filiation(2, 2, 3),
    filiation(3, 1, 4),
    filiation(4, 2, 4),
    filiation(5, 1, 7),
    filiation(6, 2, 7),
    filiation(7, 3, 5),
    filiation(8, 3, 6),
  ];

  it("qualifie l'oncle et la tante", () => {
    const tante = computeKinship(persons, filiations, 4, 5);
    expect(tante.link).toEqual({
      label: "tante",
      relation: "collateral",
      degree: 0,
      generationGap: 1,
    });
    expect(nomsDuChemin(tante.paths[0]!.steps)).toEqual([
      "Julie Dupont",
      "Pierre Dupont",
      "Marc Dupont",
      "Léa Dupont",
    ]);

    expect(computeKinship(persons, filiations, 7, 5).link?.label).toBe("oncle");
    // Julie rejoint Léa aussi bien par Pierre que par Anne : deux ancêtres
    // communs à la distance minimale.
    expect(tante.multipleRelationships).toBe(true);
  });

  it("qualifie le neveu et la nièce", () => {
    const niece = computeKinship(persons, filiations, 5, 4);
    expect(niece.link).toEqual({
      label: "nièce",
      relation: "collateral",
      degree: 0,
      generationGap: 1,
    });

    expect(computeKinship(persons, filiations, 6, 4).link?.label).toBe("neveu");
  });
});

describe("computeKinship — cousins", () => {
  it("qualifie des cousins germains partageant deux grands-parents", () => {
    const persons = [
      personne(1, "Pierre", "M"),
      personne(2, "Anne", "F"),
      personne(3, "Marc", "M"),
      personne(4, "Julie", "F"),
      personne(5, "Léa", "F"),
      personne(6, "Tom", "M"),
    ];
    const filiations = [
      filiation(1, 1, 3),
      filiation(2, 2, 3),
      filiation(3, 1, 4),
      filiation(4, 2, 4),
      filiation(5, 3, 5),
      filiation(6, 4, 6),
    ];

    const cousine = computeKinship(persons, filiations, 5, 6);
    expect(cousine.link).toEqual({
      label: "cousine germaine",
      relation: "collateral",
      degree: 1,
      generationGap: 0,
    });
    expect(cousine.commonAncestors).toEqual([
      { id: 1, name: "Pierre Dupont" },
      { id: 2, name: "Anne Dupont" },
    ]);
    // Le grand-père et la grand-mère sont tous deux des ancêtres communs à la
    // distance minimale : deux chemins relient Léa et Tom.
    expect(cousine.multipleRelationships).toBe(true);
    expect(cousine.paths[0]).toEqual({
      commonAncestorId: 1,
      steps: [
        { personId: 5, name: "Léa Dupont" },
        { personId: 3, name: "Marc Dupont", edgeRole: "biologique" },
        { personId: 1, name: "Pierre Dupont", edgeRole: "biologique" },
        { personId: 4, name: "Julie Dupont", edgeRole: "biologique" },
        { personId: 6, name: "Tom Dupont", edgeRole: "biologique" },
      ],
    });

    expect(computeKinship(persons, filiations, 6, 5).link?.label).toBe("cousin germain");
  });

  it("qualifie des cousins issus de germains", () => {
    // Aïeul unique → Alain et Berthe → Claude et Denise → Louis et Emma.
    const persons = [
      personne(1, "Aïeul", "M"),
      personne(2, "Alain", "M"),
      personne(3, "Berthe", "F"),
      personne(4, "Claude", "M"),
      personne(5, "Denise", "F"),
      personne(6, "Louis", "M"),
      personne(7, "Emma", "F"),
    ];
    const filiations = [
      filiation(1, 1, 2),
      filiation(2, 1, 3),
      filiation(3, 2, 4),
      filiation(4, 3, 5),
      filiation(5, 4, 6),
      filiation(6, 5, 7),
    ];

    const cousin = computeKinship(persons, filiations, 6, 7);
    expect(cousin.link).toEqual({
      label: "cousin issu de germain",
      relation: "collateral",
      degree: 2,
      generationGap: 0,
    });
    expect(cousin.commonAncestors).toEqual([{ id: 1, name: "Aïeul Dupont" }]);
    expect(cousin.multipleRelationships).toBe(false);
    expect(nomsDuChemin(cousin.paths[0]!.steps)).toEqual([
      "Louis Dupont",
      "Claude Dupont",
      "Alain Dupont",
      "Aïeul Dupont",
      "Berthe Dupont",
      "Denise Dupont",
      "Emma Dupont",
    ]);

    expect(computeKinship(persons, filiations, 7, 6).link?.label).toBe("cousine issue de germaine");
  });

  it("ajoute l'écart de génération pour un cousin « à un degré de différence »", () => {
    // Aïeul → Alain et Berthe ; Alain → Marie ; Berthe → Denise → Hugo.
    const persons = [
      personne(1, "Aïeul", "M"),
      personne(2, "Alain", "M"),
      personne(3, "Berthe", "F"),
      personne(4, "Marie", "F"),
      personne(5, "Denise", "F"),
      personne(6, "Hugo", "M"),
    ];
    const filiations = [
      filiation(1, 1, 2),
      filiation(2, 1, 3),
      filiation(3, 2, 4),
      filiation(4, 3, 5),
      filiation(5, 5, 6),
    ];

    const cousine = computeKinship(persons, filiations, 4, 6);
    expect(cousine.link).toEqual({
      label: "cousine germaine à 1 degré de différence",
      relation: "collateral",
      degree: 1,
      generationGap: 1,
    });
    expect(cousine.multipleRelationships).toBe(false);

    expect(computeKinship(persons, filiations, 6, 4).link?.label).toBe(
      "cousin germain à 1 degré de différence",
    );
  });
});

describe("computeKinship — absence de lien", () => {
  it("retourne unrelated sur un graphe disjoint", () => {
    const persons = [
      personne(1, "Pierre", "M"),
      personne(2, "Paul", "M"),
      personne(3, "Anne", "F"),
      personne(4, "Julie", "F"),
    ];
    const filiations = [filiation(1, 1, 2), filiation(2, 3, 4)];

    const result = computeKinship(persons, filiations, 2, 4);

    expect(result.unrelated).toBe(true);
    expect(result.samePerson).toBe(false);
    expect(result.link).toBeNull();
    expect(result.commonAncestors).toEqual([]);
    expect(result.paths).toEqual([]);
    expect(result.multipleRelationships).toBe(false);
  });
});

describe("computeKinship — filiations adoptives et beaux-parents", () => {
  // Pierre adopte Louis, Claire est la belle-mère de Louis, Louis a Emma.
  const persons = [
    personne(1, "Pierre", "M"),
    personne(2, "Louis", "M"),
    personne(3, "Emma", "F"),
    personne(4, "Claire", "F"),
  ];
  const filiations = [
    filiation(1, 1, 2, "adopte"),
    filiation(2, 2, 3),
    filiation(3, 4, 2, "beau-parent"),
  ];

  it("garde le libellé structurel et annote le rôle des arêtes du chemin", () => {
    const grandPere = computeKinship(persons, filiations, 1, 3);

    expect(grandPere.link).toEqual({
      label: "grand-père",
      relation: "ascendant",
      degree: 2,
      generationGap: 0,
    });
    expect(grandPere.paths[0]!.steps).toEqual([
      { personId: 1, name: "Pierre Dupont" },
      { personId: 2, name: "Louis Dupont", edgeRole: "adopte" },
      { personId: 3, name: "Emma Dupont", edgeRole: "biologique" },
    ]);
  });

  it("traite un beau-parent comme un parent", () => {
    const belleMere = computeKinship(persons, filiations, 4, 2);

    expect(belleMere.link?.label).toBe("mère");
    expect(belleMere.paths[0]!.steps).toEqual([
      { personId: 4, name: "Claire Dupont" },
      { personId: 2, name: "Louis Dupont", edgeRole: "beau-parent" },
    ]);

    expect(computeKinship(persons, filiations, 3, 4).link?.label).toBe("petite-fille");
  });
});

describe("computeKinship — relations multiples", () => {
  it("signale un double cousinage (deux ancêtres communs minimaux)", () => {
    // Marcel a deux fils (Paul, Pierre) qui ont chacun un enfant avec l'une
    // des deux filles d'Odette (Anne, Sophie) : Léa et Tom sont cousins des
    // deux côtés.
    const persons = [
      personne(1, "Marcel", "M"),
      personne(2, "Odette", "F"),
      personne(3, "Paul", "M"),
      personne(4, "Pierre", "M"),
      personne(5, "Anne", "F"),
      personne(6, "Sophie", "F"),
      personne(7, "Léa", "F"),
      personne(8, "Tom", "M"),
    ];
    const filiations = [
      filiation(1, 1, 3),
      filiation(2, 1, 4),
      filiation(3, 2, 5),
      filiation(4, 2, 6),
      filiation(5, 3, 7),
      filiation(6, 5, 7),
      filiation(7, 4, 8),
      filiation(8, 6, 8),
    ];

    const result = computeKinship(persons, filiations, 7, 8);

    expect(result.link?.label).toBe("cousine germaine");
    expect(result.commonAncestors).toEqual([
      { id: 1, name: "Marcel Dupont" },
      { id: 2, name: "Odette Dupont" },
    ]);
    expect(result.multipleRelationships).toBe(true);
  });

  it("signale une consanguinité menant à plusieurs chemins vers un ancêtre unique", () => {
    // Les parents de Zoé, Alain et Berthe, sont frère et sœur : Zoé rejoint
    // Aïeul par deux chemins simples distincts.
    const persons = [
      personne(1, "Aïeul", "M"),
      personne(2, "Alain", "M"),
      personne(3, "Berthe", "F"),
      personne(4, "Zoé", "F"),
    ];
    const filiations = [
      filiation(1, 1, 2),
      filiation(2, 1, 3),
      filiation(3, 2, 4),
      filiation(4, 3, 4),
    ];

    const result = computeKinship(persons, filiations, 4, 1);

    expect(result.link?.label).toBe("petite-fille");
    expect(result.commonAncestors).toEqual([]);
    expect(result.multipleRelationships).toBe(true);
  });

  it("ne signale rien quand un seul chemin relie les deux personnes", () => {
    // Chaîne unique Aïeul → Alain → Zoé : un seul ancêtre, un seul chemin.
    const persons = [personne(1, "Aïeul", "M"), personne(2, "Alain", "M"), personne(3, "Zoé", "F")];
    const filiations = [filiation(1, 1, 2), filiation(2, 2, 3)];

    expect(computeKinship(persons, filiations, 3, 1).multipleRelationships).toBe(false);
  });
});

describe("computeKinship — priorité de la ligne directe", () => {
  // Graphe consanguin : Aïeul a deux enfants, Pierre et Zoé ; Zoé est aussi
  // l'arrière-petite-fille de Pierre via Paul et Luc. Pierre est donc à la
  // fois le demi-frère et l'arrière-grand-père de Zoé.
  const persons = [
    personne(1, "Aïeul", "M"),
    personne(2, "Pierre", "M"),
    personne(3, "Paul", "M"),
    personne(4, "Luc", "M"),
    personne(5, "Zoé", "F"),
  ];
  const filiations = [
    filiation(1, 1, 2),
    filiation(2, 1, 5),
    filiation(3, 2, 3),
    filiation(4, 3, 4),
    filiation(5, 4, 5),
  ];

  it("retient le lien direct même si un ancêtre commun est plus proche", () => {
    // La somme des distances à Aïeul (1 + 1 = 2) est plus courte que la ligne
    // directe (3 générations) : la spec impose malgré tout le lien direct.
    const result = computeKinship(persons, filiations, 2, 5);

    expect(result.link).toEqual({
      label: "arrière-grand-père",
      relation: "ascendant",
      degree: 3,
      generationGap: 0,
    });
    expect(result.paths[0]!.commonAncestorId).toBe(2);
    expect(nomsDuChemin(result.paths[0]!.steps)).toEqual([
      "Pierre Dupont",
      "Paul Dupont",
      "Luc Dupont",
      "Zoé Dupont",
    ]);
    // Aïeul reste listé comme ancêtre commun strict des deux personnes.
    expect(result.commonAncestors).toEqual([{ id: 1, name: "Aïeul Dupont" }]);
    expect(result.multipleRelationships).toBe(true);
  });

  it("reste symétrique dans le sens descendant", () => {
    expect(computeKinship(persons, filiations, 5, 2).link).toEqual({
      label: "arrière-petite-fille",
      relation: "descendant",
      degree: 3,
      generationGap: 0,
    });
  });
});

describe("computeKinship — écart de génération au-delà de l'oncle", () => {
  it("suffixe le libellé collatéral d'un grand-oncle", () => {
    // Aïeul → Pierre et Anne ; Anne → Marc → Léa : Pierre est le grand-oncle
    // de Léa (m = 1, n = 2), cas laissé ouvert par la spec.
    const persons = [
      personne(1, "Aïeul", "M"),
      personne(2, "Pierre", "M"),
      personne(3, "Anne", "F"),
      personne(4, "Marc", "M"),
      personne(5, "Léa", "F"),
    ];
    const filiations = [
      filiation(1, 1, 2),
      filiation(2, 1, 3),
      filiation(3, 3, 4),
      filiation(4, 4, 5),
    ];

    expect(computeKinship(persons, filiations, 2, 5).link).toEqual({
      label: "oncle à 2 degrés de différence",
      relation: "collateral",
      degree: 0,
      generationGap: 2,
    });
    expect(computeKinship(persons, filiations, 5, 2).link?.label).toBe(
      "nièce à 2 degrés de différence",
    );
  });
});

describe("computeKinship — déterminisme", () => {
  it("produit le même résultat quel que soit l'ordre des filiations reçues", () => {
    // Deux grands-parents de chaque côté : plusieurs chemins de même longueur
    // sont possibles, seul un tri stable garantit un chemin canonique.
    const persons = [
      personne(1, "Pierre", "M"),
      personne(2, "Anne", "F"),
      personne(3, "Marc", "M"),
      personne(4, "Julie", "F"),
      personne(5, "Léa", "F"),
      personne(6, "Tom", "M"),
    ];
    const filiations = [
      filiation(1, 1, 3),
      filiation(2, 2, 3),
      filiation(3, 1, 4),
      filiation(4, 2, 4),
      filiation(5, 3, 5),
      filiation(6, 4, 6),
    ];

    const attendu = computeKinship(persons, filiations, 5, 6);

    expect(computeKinship(persons, [...filiations].reverse(), 5, 6)).toEqual(attendu);
    expect(computeKinship([...persons].reverse(), filiations, 5, 6)).toEqual(attendu);
    // Le chemin canonique passe par l'ancêtre commun de plus petit id.
    expect(attendu.paths[0]!.commonAncestorId).toBe(1);
  });
});
