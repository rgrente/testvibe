import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import StatisticsError from "./error";

vi.mock("next/navigation", () => ({}));

describe("StatisticsError", () => {
  it("affiche une alerte et permet de réessayer", () => {
    const reset = vi.fn();
    render(<StatisticsError error={new Error("indisponible")} reset={reset} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger les statistiques");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
