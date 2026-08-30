import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnThisDayPage, { OnThisDayView } from "./page";

const { getFamilyAnniversariesForWeb, getUpcomingFamilyAnniversariesForWeb } = vi.hoisted(() => ({
  getFamilyAnniversariesForWeb: vi.fn(),
  getUpcomingFamilyAnniversariesForWeb: vi.fn(),
}));

vi.mock("@testvibe/core", async (importOriginal) => ({
  ...await importOriginal<typeof import("@testvibe/core")>(),
  getFamilyAnniversariesForWeb,
  getUpcomingFamilyAnniversariesForWeb,
}));

describe("OnThisDayPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-31T23:30:00Z"));
    vi.stubEnv("FAMILY_TIME_ZONE", "Europe/Paris");
    getFamilyAnniversariesForWeb.mockResolvedValue([]);
    getUpcomingFamilyAnniversariesForWeb.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("utilise aujourd'hui dans le fuseau configuré avec une horloge figée", async () => {
    render(await OnThisDayPage({ searchParams: Promise.resolve({}) }));
    expect(getFamilyAnniversariesForWeb).toHaveBeenCalledWith("2026-01-01");
    expect(getUpcomingFamilyAnniversariesForWeb).toHaveBeenCalledWith("2026-01-01", 30);
    expect(screen.getByLabelText("Parcourir une autre date")).toHaveValue("2026-01-01");
    expect(screen.getByLabelText("Parcourir une autre date")).toHaveClass("min-h-11");
    expect(screen.getByTestId("on-this-day-page")).toHaveClass("page-container");
    expect(screen.getByRole("heading", { name: "Prochains anniversaires" })).toBeInTheDocument();
  });

  it("permet de consulter une date arbitraire sans modifier les données", async () => {
    render(await OnThisDayPage({ searchParams: Promise.resolve({ date: "1999-06-12" }) }));
    expect(getFamilyAnniversariesForWeb).toHaveBeenCalledWith("1999-06-12");
    expect(screen.getByRole("link", { name: "Revenir à aujourd’hui" })).toHaveAttribute("href", "/ce-jour-la");
  });

  it("expose la vraie surface avec formulaire, retour et données déterministes", () => {
    render(<OnThisDayView
      date="1999-06-12"
      today="2026-08-27"
      formattedDate="12 juin 1999"
      anniversaries={[]}
      upcomingAnniversaries={[]}
    />);

    expect(screen.getByLabelText("Parcourir une autre date")).toHaveValue("1999-06-12");
    expect(screen.getByRole("button", { name: "Afficher" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revenir à aujourd’hui" })).toBeInTheDocument();
  });
});
