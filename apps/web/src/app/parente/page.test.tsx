import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KinshipResult, Person } from "@testvibe/core";
import ParentePage from "./page";

const { listAllPersonsForWeb, computeKinshipForWeb } = vi.hoisted(() => ({
  listAllPersonsForWeb: vi.fn(),
  computeKinshipForWeb: vi.fn(),
}));

vi.mock("@testvibe/core", () => ({
  listAllPersonsForWeb,
  computeKinshipForWeb,
}));

function personne(id: number, firstName: string, lastName: string, gender: string | null): Person {
  return { id, firstName, lastName, birthName: null, birthDate: null, deathDate: null, gender };
}

const PERSONS = [
  personne(1, "Marie", "Curie", "F"),
  personne(2, "Irène", "Curie", "F"),
  personne(3, "Pierre", "Curie", "M"),
];

function resultat(partiel: Partial<KinshipResult> = {}): KinshipResult {
  return {
    fromId: 1,
    toId: 2,
    samePerson: false,
    unrelated: false,
    link: { label: "mère", relation: "ascendant", degree: 1, generationGap: 0 },
    commonAncestors: [{ id: 3, name: "Pierre Curie" }],
    paths: [
      {
        commonAncestorId: 1,
        steps: [
          { personId: 1, name: "Marie Curie" },
          { personId: 2, name: "Irène Curie", edgeRole: "adopte" },
        ],
      },
    ],
    multipleRelationships: false,
    ...partiel,
  };
}

/** Next 15 : `searchParams` est une Promise résolue par le Server Component. */
const rendre = async (params: { de?: string; vers?: string }) =>
  render(await ParentePage({ searchParams: Promise.resolve(params) }));

describe("ParentePage", () => {
  beforeEach(() => {
    listAllPersonsForWeb.mockReset();
    computeKinshipForWeb.mockReset();
    listAllPersonsForWeb.mockResolvedValue(PERSONS);
    computeKinshipForWeb.mockResolvedValue(resultat());
  });

  it("affiche les deux sélecteurs sans calculer tant que le choix est incomplet", async () => {
    await rendre({ de: "1" });

    expect(screen.getByRole("combobox", { name: "Personne de départ" })).toHaveValue("1");
    expect(screen.getByRole("combobox", { name: "Personne d’arrivée" })).toHaveValue("");
    expect(computeKinshipForWeb).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Sélectionnez une personne de départ et une personne d’arrivée, puis lancez le calcul.",
      ),
    ).toBeInTheDocument();
  });

  it("ignore un identifiant inconnu", async () => {
    await rendre({ de: "1", vers: "999" });

    expect(computeKinshipForWeb).not.toHaveBeenCalled();
  });

  it("calcule le lien orienté et affiche la phrase, le chemin et les ancêtres communs", async () => {
    await rendre({ de: "1", vers: "2" });

    expect(computeKinshipForWeb).toHaveBeenCalledWith(1, 2);
    expect(screen.getByText("Marie Curie est la mère de Irène Curie.")).toBeInTheDocument();
    expect(screen.getByText("Ligne directe ascendante")).toBeInTheDocument();
    expect(screen.getByText("Degré : 1")).toBeInTheDocument();
    expect(screen.getByText("Écart de génération : 0")).toBeInTheDocument();

    // Chemin : chaque étape renvoie vers la fiche, le rôle non biologique est annoté.
    const chemin = screen.getByRole("heading", { name: "Chemin de parenté" }).parentElement!;
    const etapes = chemin.querySelectorAll("li");
    expect(etapes).toHaveLength(2);
    expect(etapes[0]!.querySelector("a")).toHaveAttribute("href", "/persons/1");
    expect(etapes[0]!.textContent).toContain("Marie Curie");
    expect(etapes[1]!.textContent).toContain("Irène Curie");
    expect(etapes[1]!.textContent).toContain("adoption");
    // Sur une ligne directe, le pivot est la personne de départ : pas d'encart.
    expect(chemin.textContent).not.toContain("ancêtre commun");

    expect(screen.getByRole("link", { name: "Pierre Curie" })).toHaveAttribute("href", "/persons/3");
    expect(screen.getByRole("link", { name: "Inverser le sens" })).toHaveAttribute(
      "href",
      "/parente?de=2&vers=1",
    );
  });

  it("signale plusieurs chemins de parenté et l'ancêtre commun d'un lien collatéral", async () => {
    computeKinshipForWeb.mockResolvedValue(
      resultat({
        link: { label: "sœur", relation: "frere-soeur", degree: 0, generationGap: 0 },
        paths: [
          {
            commonAncestorId: 3,
            steps: [
              { personId: 1, name: "Marie Curie" },
              { personId: 3, name: "Pierre Curie", edgeRole: "biologique" },
              { personId: 2, name: "Irène Curie", edgeRole: "biologique" },
            ],
          },
        ],
        multipleRelationships: true,
      }),
    );

    await rendre({ de: "1", vers: "2" });

    expect(screen.getByText(/Plusieurs chemins de parenté relient ces deux personnes/)).toBeInTheDocument();
    expect(screen.getByText("Marie Curie est la sœur de Irène Curie.")).toBeInTheDocument();
    expect(screen.getByText("Fratrie")).toBeInTheDocument();

    const etapes = screen
      .getByRole("heading", { name: "Chemin de parenté" })
      .parentElement!.querySelectorAll("li");
    expect(etapes[1]!.textContent).toContain("ancêtre commun");
    // Une filiation biologique n'est pas annotée : elle est le cas par défaut.
    expect(etapes[1]!.textContent).not.toContain("adoption");
  });

  it("annonce l'absence de lien sans afficher de chemin", async () => {
    computeKinshipForWeb.mockResolvedValue(
      resultat({ unrelated: true, link: null, commonAncestors: [], paths: [] }),
    );

    await rendre({ de: "1", vers: "2" });

    expect(
      screen.getByText("Aucun lien de parenté connu entre Marie Curie et Irène Curie."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Chemin de parenté" })).not.toBeInTheDocument();
    expect(screen.getByText("Aucun ancêtre commun connu.")).toBeInTheDocument();
  });

  it("gère le cas de la même personne", async () => {
    computeKinshipForWeb.mockResolvedValue(
      resultat({
        toId: 1,
        samePerson: true,
        link: { label: "elle-même", relation: "same", degree: 0, generationGap: 0 },
        commonAncestors: [],
        paths: [],
      }),
    );

    await rendre({ de: "1", vers: "1" });

    expect(computeKinshipForWeb).toHaveBeenCalledWith(1, 1);
    expect(screen.getByText("Marie Curie est elle-même.")).toBeInTheDocument();
    expect(screen.getByText("Même personne")).toBeInTheDocument();
    // Ni degré ni écart de génération n'ont de sens pour une même personne.
    expect(screen.queryByText(/^Degré :/)).not.toBeInTheDocument();
  });

  it("invite à créer des personnes quand la base est vide", async () => {
    listAllPersonsForWeb.mockResolvedValue([]);

    await rendre({});

    expect(
      screen.getByText("Aucune personne n’est encore disponible pour calculer un lien de parenté."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
