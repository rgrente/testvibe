import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TimelinePage from "./page";

const { getFamilyTimelineForWeb } = vi.hoisted(() => ({
  getFamilyTimelineForWeb: vi.fn(),
}));

vi.mock("@testvibe/core", () => ({
  getFamilyTimelineForWeb,
}));

describe("TimelinePage", () => {
  beforeEach(() => {
    getFamilyTimelineForWeb.mockResolvedValue([]);
  });

  it("charge la timeline familiale et affiche la page dédiée", async () => {
    render(await TimelinePage());

    expect(getFamilyTimelineForWeb).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1, name: "Timeline familiale" })).toBeInTheDocument();
    expect(screen.getByText("Aucun événement familial n’est encore disponible.")).toBeInTheDocument();
  });
});
