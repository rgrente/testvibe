import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { SharedToolbar } from "./SharedToolbar";

describe("SharedToolbar", () => {
  it("fournit le contrat partagé de 44 px, de focus et d’activation native", () => {
    const onClick = vi.fn();
    render(
      <SharedToolbar label="Affichage de l’arbre">
        <button type="button" onClick={onClick}>
          Arbre
        </button>
      </SharedToolbar>,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Affichage de l’arbre" });
    const button = screen.getByRole("button", { name: "Arbre" });
    expect(toolbar).toHaveClass("h-11");
    expect(button).toHaveClass("min-h-11", "focus-visible:outline-2");

    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
