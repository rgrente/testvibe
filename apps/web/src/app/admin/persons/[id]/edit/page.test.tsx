import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminGetPerson: vi.fn(),
  adminUpdatePerson: vi.fn(),
}));
vi.mock("@testvibe/core", () => mocks);
vi.mock("@/lib/session", () => ({ requireAdminMutation: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));

import EditPersonPage, { submitPersonUpdate } from "./page";

describe("EditPersonPage", () => {
  it("relit et soumet les dates qualifiées", async () => {
    mocks.adminGetPerson.mockResolvedValue({
      id: 7, firstName: "Ada", lastName: "Lovelace", birthName: null,
      birthDate: "entre 1815 et 1816", deathDate: "après 1852", gender: null,
    });
    render(await EditPersonPage({ params: Promise.resolve({ id: "7" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByLabelText("Date de naissance")).toHaveValue("entre 1815 et 1816");

    const formData = new FormData();
    formData.set("firstName", "Ada"); formData.set("lastName", "Lovelace");
    formData.set("birthDate", "entre 1815 et 1816"); formData.set("deathDate", "après 1852");
    formData.set("livingStatus", "deceased"); formData.set("visibility", "private");
    await submitPersonUpdate(7, formData);
    expect(mocks.adminUpdatePerson).toHaveBeenCalledWith(7, expect.objectContaining({
      birthDate: "entre 1815 et 1816", deathDate: "après 1852",
    }));
  });
});