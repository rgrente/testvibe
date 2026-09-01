import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFamilyAnniversariesForWeb, getFamilyTreeForWeb, listAllPersonsForWeb } = vi.hoisted(() => ({
  getFamilyAnniversariesForWeb: vi.fn(),
  getFamilyTreeForWeb: vi.fn(),
  listAllPersonsForWeb: vi.fn(),
}));

vi.mock("@testvibe/core", async (importOriginal) => ({
  ...await importOriginal<typeof import("@testvibe/core")>(),
  getFamilyAnniversariesForWeb,
  getFamilyTreeForWeb,
  listAllPersonsForWeb,
}));
vi.mock("../components/FamilyTreeViews", () => ({
  FamilyTreeViews: () => <div data-testid="family-tree" />,
}));
vi.mock("../components/RootPersonSelect", () => ({
  RootPersonSelect: () => <label>Personne racine<select /></label>,
}));

import HomePage from "./page";

const person = {
  id: 1,
  firstName: "Ada",
  lastName: "Lovelace",
  birthDate: "1815-12-10",
  deathDate: "1852-11-27",
  gender: "F",
};

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAllPersonsForWeb.mockResolvedValue([person]);
    getFamilyAnniversariesForWeb.mockResolvedValue([]);
    getFamilyTreeForWeb.mockResolvedValue({
      rootId: person.id,
      nodes: [{ person, generation: 0 }],
      edges: [],
    });
  });

  it("ne répète plus le lien Mode édition en pied de l’arbre", async () => {
    render(await HomePage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByTestId("family-tree")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mode édition" })).not.toBeInTheDocument();
  });
});
