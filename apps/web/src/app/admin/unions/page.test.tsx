import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adminListUnions: vi.fn(), adminCreateUnion: vi.fn(), adminDeleteUnion: vi.fn(), adminListPersons: vi.fn(),
}));
vi.mock("@testvibe/core", () => mocks);
vi.mock("@/lib/session", () => ({ requireAdminMutation: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/PlaceAutocomplete", () => ({ default: () => null }));
vi.mock("@/components/UnionPersonSearch", () => ({ default: () => null }));

import UnionsPage, { createUnionAction } from "./page";

describe("UnionsPage", () => {
  it("relit et soumet un intervalle qualifié", async () => {
    mocks.adminListPersons.mockResolvedValue([{ id: 1, firstName: "A", lastName: "A" }, { id: 2, firstName: "B", lastName: "B" }]);
    mocks.adminListUnions.mockResolvedValue([{ id: 3, type: "mariage", startDate: "entre 1950 et 1952", endDate: null, place: null, latitude: null, longitude: null, personIds: [1, 2] }]);
    render(await UnionsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/depuis entre 1950 et 1952/)).toBeInTheDocument();

    const formData = new FormData();
    formData.set("type", "mariage"); formData.set("startDate", "entre 1950 et 1952");
    formData.append("personIds", "1"); formData.append("personIds", "2");
    await createUnionAction(formData);
    expect(mocks.adminCreateUnion).toHaveBeenCalledWith(expect.objectContaining({ startDate: "entre 1950 et 1952" }));
  });
});