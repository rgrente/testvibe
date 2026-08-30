import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import TimelineLoading from "./loading";

describe("TimelineLoading", () => {
  it("annonce le chargement avec un squelette", () => {
    render(<TimelineLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Chargement de la chronologie…");
  });
});