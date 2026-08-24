import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import UnionPersonSearch from "./UnionPersonSearch";

const persons = [{ id: 1, firstName: "Ada", lastName: "Lovelace" }, { id: 2, firstName: "Charles", lastName: "Babbage" }, { id: 3, firstName: "Grace", lastName: "Hopper" }] as never;

describe("UnionPersonSearch", () => {
  it("filtre et soumet les deux personnes sélectionnées", () => {
    const { container } = render(<UnionPersonSearch persons={persons} />);
    const first = screen.getByRole("combobox", { name: "Personne 1 *" });
    const second = screen.getByRole("combobox", { name: "Personne 2 *" });
    fireEvent.change(first, { target: { value: "love" } });
    fireEvent.click(screen.getByRole("option", { name: "Ada Lovelace" }));
    fireEvent.change(second, { target: { value: "char" } });
    fireEvent.click(screen.getByRole("option", { name: "Charles Babbage" }));
    expect(first).toHaveValue("Ada Lovelace");
    expect(second).toHaveValue("Charles Babbage");
    expect([...container.querySelectorAll<HTMLInputElement>('input[name="personIds"]')].map((input) => input.value)).toEqual(["1", "2"]);
  });

  it("permet de parcourir et sélectionner les résultats au clavier", () => {
    const { container } = render(<UnionPersonSearch persons={persons} />);
    const first = screen.getByRole("combobox", { name: "Personne 1 *" });

    fireEvent.focus(first);
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.keyDown(first, { key: "ArrowDown" });

    const activeOptionId = first.getAttribute("aria-activedescendant");
    expect(activeOptionId).toBeTruthy();
    expect(document.getElementById(activeOptionId!)).toHaveTextContent("Charles Babbage");

    fireEvent.keyDown(first, { key: "Enter" });
    expect(first).toHaveValue("Charles Babbage");
    expect(container.querySelector<HTMLInputElement>('input[name="personIds"]')).toHaveValue("2");
  });

  it("pré-remplit les partenaires et exclut la personne déjà choisie", () => {
    render(<UnionPersonSearch persons={persons} defaultPersonIds={[1, 2]} />);
    expect(screen.getByRole("combobox", { name: "Personne 1 *" })).toHaveValue("Ada Lovelace");
    fireEvent.change(screen.getByRole("combobox", { name: "Personne 2 *" }), { target: { value: "" } });
    expect(within(screen.getByRole("listbox")).queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("retire la valeur soumise lorsqu'une sélection est modifiée manuellement", () => {
    const { container } = render(<UnionPersonSearch persons={persons} defaultPersonIds={[1, 2]} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Personne 1 *" }), { target: { value: "inconnu" } });
    expect(container.querySelectorAll('input[name="personIds"]')).toHaveLength(1);
  });
});
