import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonDetailPage from "./page";

const { getPersonForWeb, getPersonTimelineForWeb, getPersonMediaForWeb, getFamilyTreeForWeb, notFound, NotFoundError } = vi.hoisted(() => {
  class TestNotFoundError extends Error {}
  return {
    getPersonForWeb: vi.fn(),
    getPersonTimelineForWeb: vi.fn(),
    getPersonMediaForWeb: vi.fn(),
    getFamilyTreeForWeb: vi.fn(),
    notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
    NotFoundError: TestNotFoundError,
  };
});

vi.mock("@testvibe/core", () => ({
  getPersonForWeb,
  getPersonTimelineForWeb,
  getPersonMediaForWeb,
  getFamilyTreeForWeb,
  formatFamilyDate: (value: string) => value,
  NotFoundError,
}));
vi.mock("next/navigation", () => ({ notFound }));

const person = { id: 7, firstName: "Léni", lastName: "Grente", birthName: null, birthDate: "2016-09-14", deathDate: null, gender: "M" };
const parent = { id: 2, firstName: "Mathilde", lastName: "Renault", birthName: null, birthDate: null, deathDate: null, gender: "F" };

describe("PersonDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPersonForWeb.mockResolvedValue(person);
    getPersonTimelineForWeb.mockResolvedValue([]);
    getPersonMediaForWeb.mockResolvedValue([]);
    getFamilyTreeForWeb.mockResolvedValue({
      rootId: 7,
      nodes: [{ person, generation: 0 }, { person: parent, generation: -1 }],
      edges: [{ type: "filiation", filiationId: 1, parentId: 2, childId: 7, role: "biologique" }],
    });
  });

  it("charge toutes les données de la fiche et affiche les relations dérivées", async () => {
    render(await PersonDetailPage({ params: Promise.resolve({ id: "7" }) }));

    expect(getPersonForWeb).toHaveBeenCalledWith(7);
    expect(getPersonTimelineForWeb).toHaveBeenCalledWith(7);
    expect(getPersonMediaForWeb).toHaveBeenCalledWith(7);
    expect(getFamilyTreeForWeb).toHaveBeenCalledWith(7);
    expect(screen.getByRole("heading", { level: 1, name: "Léni Grente" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mathilde Renault/ })).toHaveAttribute("href", "/persons/2");
  });

  it("répond notFound pour un identifiant invalide ou une personne absente", async () => {
    await expect(PersonDetailPage({ params: Promise.resolve({ id: "abc" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    getPersonForWeb.mockRejectedValueOnce(new NotFoundError("absente"));
    await expect(PersonDetailPage({ params: Promise.resolve({ id: "99" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(2);
  });

  it("laisse une erreur de lecture inattendue atteindre error.tsx", async () => {
    const failure = new Error("database unavailable");
    getPersonForWeb.mockRejectedValueOnce(failure);
    await expect(PersonDetailPage({ params: Promise.resolve({ id: "7" }) })).rejects.toBe(failure);
    expect(notFound).not.toHaveBeenCalled();
  });
});
