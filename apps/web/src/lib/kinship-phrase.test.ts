import { describe, expect, it } from "vitest";
import type { KinshipResult } from "@testvibe/core";
import { articleDefini, libelleRelation, libelleRole, phraseDeParente } from "./kinship-phrase";

function resultat(partiel: Partial<KinshipResult>): KinshipResult {
  return {
    fromId: 1,
    toId: 2,
    samePerson: false,
    unrelated: false,
    link: { label: "mère", relation: "ascendant", degree: 1, generationGap: 0 },
    commonAncestors: [],
    paths: [],
    multipleRelationships: false,
    ...partiel,
  };
}

describe("articleDefini", () => {
  it("accorde l'article au genre de la personne de départ", () => {
    expect(articleDefini("père", false)).toBe("le ");
    expect(articleDefini("mère", true)).toBe("la ");
    expect(articleDefini("cousine germaine", true)).toBe("la ");
  });

  it("élide l'article devant une voyelle", () => {
    expect(articleDefini("oncle", false)).toBe("l’");
    expect(articleDefini("arrière-grand-mère", true)).toBe("l’");
    expect(articleDefini("arrière-petit-fils", false)).toBe("l’");
  });
});

describe("phraseDeParente", () => {
  it("oriente la phrase du sujet vers le complément", () => {
    const phrase = phraseDeParente(resultat({}), "Marie Curie", "Irène Curie", true);

    expect(phrase).toBe("Marie Curie est la mère de Irène Curie.");
  });

  it("élide l'article dans la phrase", () => {
    const link = { label: "oncle", relation: "collateral" as const, degree: 0, generationGap: 1 };

    expect(phraseDeParente(resultat({ link }), "Paul Dupont", "Léa Dupont", false)).toBe(
      "Paul Dupont est l’oncle de Léa Dupont.",
    );
  });

  it("formule le cas de la même personne", () => {
    const result = resultat({
      samePerson: true,
      link: { label: "elle-même", relation: "same", degree: 0, generationGap: 0 },
    });

    expect(phraseDeParente(result, "Ada Lovelace", "Ada Lovelace", true)).toBe(
      "Ada Lovelace est elle-même.",
    );
  });

  it("formule l'absence de lien", () => {
    const result = resultat({ unrelated: true, link: null });

    expect(phraseDeParente(result, "Paul Dupont", "Anne Martin", false)).toBe(
      "Aucun lien de parenté connu entre Paul Dupont et Anne Martin.",
    );
  });
});

describe("libelleRole", () => {
  it("ne signale que les filiations non biologiques", () => {
    expect(libelleRole(undefined)).toBeNull();
    expect(libelleRole("biologique")).toBeNull();
    expect(libelleRole("adopte")).toBe("adoption");
    expect(libelleRole("beau-parent")).toBe("beau-parent");
  });
});

describe("libelleRelation", () => {
  it("nomme chaque catégorie de lien", () => {
    const avec = (relation: NonNullable<KinshipResult["link"]>["relation"]) =>
      libelleRelation(resultat({ link: { label: "x", relation, degree: 0, generationGap: 0 } }));

    expect(avec("ascendant")).toBe("Ligne directe ascendante");
    expect(avec("descendant")).toBe("Ligne directe descendante");
    expect(avec("frere-soeur")).toBe("Fratrie");
    expect(avec("collateral")).toBe("Lien collatéral");
    expect(libelleRelation(resultat({ samePerson: true }))).toBe("Même personne");
    expect(libelleRelation(resultat({ unrelated: true, link: null }))).toBe("Aucun lien");
  });
});
