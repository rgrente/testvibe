import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

vi.mock("@testvibe/core", () => ({
  adminListPersons: vi.fn(async () => []),
  adminCreatePerson: vi.fn(),
  adminDeletePerson: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireAdminMutation: vi.fn() }));

import PersonsPage, { createPersonAction } from "./page";

describe("PersonsPage", () => {
  it("propose public par défaut tout en conservant les choix family et private", async () => {
    render(await PersonsPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("combobox", { name: "Visibilité" })).toHaveValue("public");
    expect(screen.getByRole("option", { name: "Famille" })).toHaveValue("family");
    expect(screen.getByRole("option", { name: "Privé" })).toHaveValue("private");
  });

  it("permet les dates exactes, partielles, qualifiées et les intervalles", async () => {
    render(await PersonsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByLabelText("Date de naissance")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Date de naissance")).toHaveAttribute(
      "placeholder",
      expect.stringContaining("vers/avant/après"),
    );
    expect(screen.getByLabelText("Date de décès")).toHaveAttribute(
      "placeholder",
      expect.stringContaining("entre 1950 et 1952"),
    );
  });

  it("soumet et relit une personne avec des dates qualifiées", async () => {
    const core = await import("@testvibe/core");
    vi.mocked(core.adminListPersons).mockResolvedValueOnce([{
      id: 1,
      firstName: "Ada",
      lastName: "Lovelace",
      birthName: null,
      birthDate: "vers 1815",
      deathDate: "avant 1853",
      gender: null,
    }]);
    render(await PersonsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/né·e vers 1815/)).toBeInTheDocument();

    const formData = new FormData();
    formData.set("firstName", "Ada");
    formData.set("lastName", "Lovelace");
    formData.set("birthDate", "vers 1815");
    formData.set("deathDate", "avant 1853");
    formData.set("livingStatus", "deceased");
    formData.set("visibility", "private");
    await createPersonAction(formData);
    expect(core.adminCreatePerson).toHaveBeenCalledWith(expect.objectContaining({
      birthDate: "vers 1815",
      deathDate: "avant 1853",
    }));
  });
});
