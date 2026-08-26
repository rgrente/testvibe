import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import StatisticsLoading from "./loading";

describe("StatisticsLoading", () => {
  it("annonce le chargement de la page", () => {
    render(<StatisticsLoading />);
    expect(screen.getByText("Chargement des statistiques…")).toBeInTheDocument();
  });
});
