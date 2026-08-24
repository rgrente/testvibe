import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { PersonPairSelector } from "./PersonPairSelector";

const persons = [
  { id: 1, firstName: "Ada", lastName: "Lovelace", birthName: null },
  { id: 2, firstName: "Grace", lastName: "Hopper", birthName: "Murray" },
  { id: 3, firstName: "Alan", lastName: "Turing", birthName: null },
] as never;

describe("PersonPairSelector", () => {
  it.each(["ada", "HOP", "murray"])("filtre les personnes avec la recherche %s", (query) => {
    render(<PersonPairSelector persons={persons} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher la personne 1" }), {
      target: { value: query },
    });

    const select = screen.getByRole("combobox", { name: "Personne 1" });
    expect(select).toHaveTextContent(query === "ada" ? "Ada Lovelace" : "Grace Hopper");
    expect(select).not.toHaveTextContent("Alan Turing");
  });

  it("gère deux recherches indépendantes et interdit un partenaire en double", () => {
    render(<PersonPairSelector persons={persons} />);
    const first = screen.getByRole("combobox", { name: "Personne 1" });
    const second = screen.getByRole("combobox", { name: "Personne 2" });

    fireEvent.change(first, { target: { value: "1" } });

    expect(within(second).getByRole("option", { name: "Ada Lovelace" })).toBeDisabled();
    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher la personne 2" }), {
      target: { value: "Alan" },
    });
    expect(second).toHaveTextContent("Alan Turing");
    expect(first).toHaveTextContent("Grace Hopper");
  });

  it("soumet exactement les deux personIds sélectionnés", () => {
    const { container } = render(
      <form data-testid="form">
        <PersonPairSelector persons={persons} />
      </form>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Personne 1" }), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Personne 2" }), {
      target: { value: "3" },
    });

    expect(new FormData(container.querySelector("form")!).getAll("personIds")).toEqual(["1", "3"]);
  });

  it("préremplit les deux partenaires en édition", () => {
    render(<PersonPairSelector persons={persons} defaultPersonIds={[2, 3]} />);

    expect(screen.getByRole("combobox", { name: "Personne 1" })).toHaveValue("2");
    expect(screen.getByRole("combobox", { name: "Personne 2" })).toHaveValue("3");
  });

  it("conserve une personne sélectionnée lorsque la recherche change", () => {
    render(<PersonPairSelector persons={persons} defaultPersonIds={[1, 3]} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher la personne 1" }), {
      target: { value: "Grace" },
    });

    expect(screen.getByRole("combobox", { name: "Personne 1" })).toHaveValue("1");
    expect(screen.getByRole("combobox", { name: "Personne 1" })).toHaveTextContent("Ada Lovelace");
  });

  it("affiche un état clair lorsqu'une recherche ne trouve personne", () => {
    render(<PersonPairSelector persons={persons} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher la personne 1" }), {
      target: { value: "introuvable" },
    });

    expect(screen.getByRole("status")).toHaveTextContent("Aucune personne trouvée.");
  });
});
