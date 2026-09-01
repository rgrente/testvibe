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

import PersonsPage from "./page";

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
});
