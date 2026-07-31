import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TimelinePage from "./page";

const { getComparativeTimelineForWeb } = vi.hoisted(() => ({
  getComparativeTimelineForWeb: vi.fn(),
}));

vi.mock("@testvibe/core", () => ({
  getComparativeTimelineForWeb,
}));

describe("TimelinePage", () => {
  beforeEach(() => {
    getComparativeTimelineForWeb.mockResolvedValue([]);
  });

  it("charge la timeline comparative et affiche la page dédiée", async () => {
    render(await TimelinePage());

    expect(getComparativeTimelineForWeb).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1, name: "Timeline comparative" })).toBeInTheDocument();
    expect(screen.getByText("Aucune personne n’est encore disponible.")).toBeInTheDocument();
  });
});
