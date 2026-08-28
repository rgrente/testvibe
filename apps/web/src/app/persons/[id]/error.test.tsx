import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import PersonError from "./error";

it("annonce l’erreur de fiche et permet de réessayer au clavier", async () => {
  const reset = vi.fn();
  render(<PersonError error={new Error("lecture") } reset={reset} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger la fiche personne");
  const button = screen.getByRole("button", { name: "Réessayer" });
  button.focus();
  await userEvent.keyboard("{Enter}");
  expect(reset).toHaveBeenCalledOnce();
});
