import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SharedToolbar } from "./SharedToolbar";

describe("SharedToolbar", () => {
  it("fournit le contrat partagé de 44 px, de focus et d’activation native", async () => {
    const user = userEvent.setup();
    const onTreeClick = vi.fn();
    const onListClick = vi.fn();
    render(
      <SharedToolbar label="Affichage de l’arbre">
        <button key="tree" type="button" onClick={onTreeClick}>
          Arbre
        </button>
        <button key="list" type="button" onClick={onListClick}>
          Liste
        </button>
      </SharedToolbar>,
    );

    const toolbar = screen.getByRole("toolbar", { name: "Affichage de l’arbre" });
    const treeButton = screen.getByRole("button", { name: "Arbre" });
    const listButton = screen.getByRole("button", { name: "Liste" });
    expect(toolbar).toHaveClass("h-11");
    expect(treeButton).toHaveClass("min-h-11", "focus-visible:outline-2");
    expect(listButton).toHaveClass("min-h-11", "focus-visible:outline-2");

    await user.tab();
    expect(treeButton).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onTreeClick).toHaveBeenCalledOnce();

    await user.tab();
    expect(listButton).toHaveFocus();
    await user.keyboard(" ");
    expect(onListClick).toHaveBeenCalledOnce();

    await user.tab({ shift: true });
    expect(treeButton).toHaveFocus();
  });
});
