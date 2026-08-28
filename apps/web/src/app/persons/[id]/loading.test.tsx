import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { expect, it } from "vitest";
import PersonLoading from "./loading";

it("annonce le chargement de la fiche", () => {
  render(<PersonLoading />);
  expect(screen.getByRole("status")).toHaveTextContent("Chargement de la fiche personne…");
});
