import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { RootPersonSelect } from "./RootPersonSelect";

const persons = [
  { id: 1, firstName: "Ada", lastName: "Lovelace" },
  { id: 2, firstName: "Charles", lastName: "Babbage" },
] as never;

describe("RootPersonSelect", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("reflète la nouvelle racine lorsque la navigation met à jour selectedId", () => {
    const { rerender } = render(<RootPersonSelect persons={persons} selectedId={1} />);
    expect(screen.getByRole("combobox", { name: "Personne racine" })).toHaveValue("1");

    rerender(<RootPersonSelect persons={persons} selectedId={2} />);

    expect(screen.getByRole("combobox", { name: "Personne racine" })).toHaveValue("2");
  });

  it("conserve la navigation existante lors d'un choix dans la liste", () => {
    render(<RootPersonSelect persons={persons} selectedId={1} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Personne racine" }), {
      target: { value: "2" },
    });

    expect(push).toHaveBeenCalledWith("/?personId=2");
  });
});
