import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TimelinePage from "./page";

const people = [
  { id: 1, firstName: "Root", lastName: "One", birthName: null, birthDate: "1980", deathDate: null, gender: null },
  { id: 2, firstName: "Root", lastName: "Two", birthName: null, birthDate: "1970", deathDate: null, gender: null },
  { id: 3, firstName: "Parent", lastName: "Three", birthName: null, birthDate: "1940", deathDate: null, gender: null },
];

const { getComparativeTimelineForWeb, listAllPersonsForWeb, getFamilyTreeForWeb } = vi.hoisted(() => ({
  getComparativeTimelineForWeb: vi.fn(),
  listAllPersonsForWeb: vi.fn(),
  getFamilyTreeForWeb: vi.fn(),
}));

vi.mock("@testvibe/core", () => ({
  getComparativeTimelineForWeb,
  listAllPersonsForWeb,
  getFamilyTreeForWeb,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("TimelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getComparativeTimelineForWeb.mockResolvedValue([]);
    listAllPersonsForWeb.mockResolvedValue([]);
  });

  it("charge la timeline comparative et affiche la page dédiée", async () => {
    render(await TimelinePage());

    expect(getComparativeTimelineForWeb).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1, name: "Timeline comparative" })).toBeInTheDocument();
    expect(screen.getByText("Aucune personne n’est encore disponible.")).toBeInTheDocument();
  });

  it("sélectionne la racine demandée et limite la vue à ses ascendants", async () => {
    getComparativeTimelineForWeb.mockResolvedValue(people.map((person) => ({ person, events: [] })));
    listAllPersonsForWeb.mockResolvedValue(people);
    getFamilyTreeForWeb.mockResolvedValue({
      rootId: 2,
      nodes: [{ person: people[1], generation: 0 }, { person: people[2], generation: -1 }],
      edges: [{ type: "filiation", parentId: 3, childId: 2, unionId: null }],
    });

    render(await TimelinePage({ searchParams: Promise.resolve({ personId: "2", generations: "2" }) }));
    expect(getFamilyTreeForWeb).toHaveBeenCalledWith(2);
    expect(screen.getByLabelText("Personne racine")).toHaveValue("2");
    expect(screen.getByLabelText("Générations d’ascendants")).toHaveValue("2");
    expect(screen.getByRole("group", { name: "Timeline de Parent Three" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Timeline de Root Two" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Timeline de Root One" })).not.toBeInTheDocument();
  });

  it.each([
    [{ personId: "999", generations: "99" }, "6"],
    [{ personId: "invalid", generations: "0" }, "1"],
    [{ personId: "1", generations: "invalid" }, "4"],
  ])("retombe sur une racine valide et normalise les générations (%o)", async (params, expectedGenerations) => {
    getComparativeTimelineForWeb.mockResolvedValue(people.map((person) => ({ person, events: [] })));
    listAllPersonsForWeb.mockResolvedValue(people);
    getFamilyTreeForWeb.mockResolvedValue({ rootId: 1, nodes: [{ person: people[0], generation: 0 }], edges: [] });
    render(await TimelinePage({ searchParams: Promise.resolve(params) }));
    expect(getFamilyTreeForWeb).toHaveBeenCalledWith(1);
    expect(screen.getByLabelText("Personne racine")).toHaveValue("1");
    expect(screen.getByLabelText("Générations d’ascendants")).toHaveValue(expectedGenerations);
  });
});
