import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ adminGetUnion: vi.fn(), adminUpdateUnion: vi.fn(), adminListPersons: vi.fn() }));
vi.mock("@testvibe/core", () => mocks);
vi.mock("@/lib/session", () => ({ requireAdminMutation: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/components/PlaceAutocomplete", () => ({ default: () => null }));
vi.mock("@/components/UnionPersonSearch", () => ({ default: () => null }));

import EditUnionPage, { submitUnionUpdate } from "./page";

describe("EditUnionPage", () => {
  it("relit et soumet des bornes qualifiées", async () => {
    mocks.adminGetUnion.mockResolvedValue({ id: 3, type: "mariage", startDate: "vers 1950", endDate: "avant 1960", place: null, latitude: null, longitude: null, personIds: [1, 2] });
    mocks.adminListPersons.mockResolvedValue([{ id: 1, firstName: "A", lastName: "A" }, { id: 2, firstName: "B", lastName: "B" }]);
    render(await EditUnionPage({ params: Promise.resolve({ id: "3" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByLabelText("Date de début")).toHaveValue("vers 1950");

    const formData = new FormData();
    formData.set("type", "mariage"); formData.set("startDate", "vers 1950"); formData.set("endDate", "avant 1960");
    formData.append("personIds", "1"); formData.append("personIds", "2");
    await submitUnionUpdate(3, [1, 2], formData);
    expect(mocks.adminUpdateUnion).toHaveBeenCalledWith(3, expect.objectContaining({ startDate: "vers 1950", endDate: "avant 1960" }));
  });
});