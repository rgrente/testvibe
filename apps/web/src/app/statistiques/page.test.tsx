import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StatisticsPage, { StatisticsView } from "./page";

const { getFamilyStatisticsForWeb } = vi.hoisted(() => ({
  getFamilyStatisticsForWeb: vi.fn(),
}));

vi.mock("@testvibe/core", () => ({ getFamilyStatisticsForWeb }));

describe("StatisticsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("affiche les cinq familles de statistiques issues de web-api", async () => {
    getFamilyStatisticsForWeb.mockResolvedValue({
      totals: { persons: 8, unions: 3, events: 12, generations: 4 },
      agePyramid: [{ decade: 30, women: 2, men: 1, other: 1 }],
      averageLongevity: 74.6,
      topFirstNames: [{ label: "Camille", count: 3 }],
      topBirthPlaces: [{ label: "Paris", count: 4 }],
      topResidencePlaces: [{ label: "Lyon", count: 2 }],
    });

    render(await StatisticsPage());

    expect(getFamilyStatisticsForWeb).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1, name: "Statistiques familiales" })).toBeInTheDocument();
    expect(screen.getByTestId("statistics-summary")).toHaveClass("sm:grid-cols-4");
    expect(screen.getByRole("region", { name: "Pyramide des âges" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Classements familiaux" })).toBeInTheDocument();
    expect(screen.getByText("8", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("4 générations")).toBeInTheDocument();
    expect(screen.getByText("74,6 ans")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pyramide des âges" })).toBeInTheDocument();
    expect(screen.getByText("30–39 ans")).toBeInTheDocument();
    expect(screen.getByText("2 femmes · 1 homme · 1 autre")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prénoms fréquents" })).toBeInTheDocument();
    expect(screen.getByText("Camille")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lieux de naissance" })).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lieux de résidence" })).toBeInTheDocument();
    expect(screen.getByText("Lyon")).toBeInTheDocument();
  });

  it("expose la vraie surface de présentation avec des données déterministes", () => {
    render(<StatisticsView statistics={{
      totals: { persons: 12, unions: 4, events: 27, generations: 3 },
      agePyramid: [{ decade: 60, women: 2, men: 1, other: 0 }],
      averageLongevity: 64,
      topFirstNames: [{ label: "Martine", count: 2 }],
      topBirthPlaces: [{ label: "Rennes", count: 5 }],
      topResidencePlaces: [{ label: "Vitré", count: 3 }],
    }} />);

    expect(getFamilyStatisticsForWeb).not.toHaveBeenCalled();
    expect(screen.getByTestId("statistics-summary")).toHaveTextContent("12");
    expect(screen.getByRole("heading", { name: "Pyramide des âges" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prénoms fréquents" })).toBeInTheDocument();
  });

  it("affiche l'état vide lorsque l'arbre ne contient aucune personne", async () => {
    getFamilyStatisticsForWeb.mockResolvedValue({
      totals: { persons: 0, unions: 0, events: 0, generations: 0 },
      agePyramid: [],
      averageLongevity: null,
      topFirstNames: [],
      topBirthPlaces: [],
      topResidencePlaces: [],
    });

    render(await StatisticsPage());
    expect(screen.getByText("Aucune donnée familiale")).toBeInTheDocument();
  });

  it("explicite l'absence de données pour chaque classement", async () => {
    getFamilyStatisticsForWeb.mockResolvedValue({
      totals: { persons: 1, unions: 0, events: 0, generations: 1 },
      agePyramid: [],
      averageLongevity: null,
      topFirstNames: [],
      topBirthPlaces: [],
      topResidencePlaces: [],
    });

    render(await StatisticsPage());
    expect(screen.getAllByText("Aucune donnée disponible")).toHaveLength(4);
  });
});
