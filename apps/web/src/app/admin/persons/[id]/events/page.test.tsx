import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import PersonEventsPage from "./page";
import { createEventAction, updateEventAction } from "./actions";

const mocks = vi.hoisted(() => ({
  adminGetPerson: vi.fn(),
  adminListEventsByPerson: vi.fn(),
  adminCreateEvent: vi.fn(),
  adminUpdateEvent: vi.fn(),
  adminDeleteEvent: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@testvibe/core", () => mocks);
vi.mock("@/lib/session", () => ({ requireAdminMutation: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: vi.fn(),
}));

describe("PersonEventsPage", () => {
  it.each(["vers 2020-06", "entre 2019-06 et 2020-06"])("propose et soumet une résidence datée %s", async (eventDate) => {
    mocks.adminGetPerson.mockResolvedValue({
      id: 7,
      firstName: "Marie",
      lastName: "Martin",
    });
    mocks.adminListEventsByPerson.mockResolvedValue([]);

    render(
      await PersonEventsPage({
        params: Promise.resolve({ id: "7" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByRole("option", { name: "Résidence" })).toHaveValue("résidence");

    const formData = new FormData();
    formData.set("personId", "7");
    formData.set("type", "résidence");
    formData.set("eventDate", eventDate);
    formData.set("place", "Lyon");
    formData.set("visibility", "family");

    await expect(createEventAction(formData)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.adminCreateEvent).toHaveBeenCalledWith({
      personId: 7,
      type: "résidence",
      label: null,
      eventDate,
      description: null,
      place: "Lyon",
      latitude: null,
      longitude: null,
      visibility: "family",
    });
  });

  it.each(["1900", "1900-06", "vers 1900-06", "entre 1900 et 1902"])(
    "propose l’édition protégée sans perdre la date généalogique %s",
    async (eventDate) => {
    mocks.adminGetPerson.mockResolvedValue({
      id: 7,
      firstName: "Marie",
      lastName: "Martin",
    });
    mocks.adminListEventsByPerson.mockResolvedValue([
      {
        id: 12,
        personId: 7,
        unionId: null,
        type: "libre",
        label: "Voyage",
        eventDate,
        description: "Description",
        place: "Paris",
        latitude: 48.8566,
        longitude: 2.3522,
      },
    ]);

    render(
      await PersonEventsPage({
        params: Promise.resolve({ id: "7" }),
        searchParams: Promise.resolve({}),
      }),
    );

    const item = screen.getByRole("listitem");
    expect(within(item).getByDisplayValue(eventDate)).toHaveAttribute("name", "eventDate");
    expect(within(item).getByDisplayValue("Voyage")).toHaveAttribute("name", "label");
    expect(within(item).getByDisplayValue("Paris")).toHaveAttribute("name", "place");
    expect(within(item).getByDisplayValue("48.8566")).toHaveAttribute("name", "latitude");
    expect(within(item).getByDisplayValue("2.3522")).toHaveAttribute("name", "longitude");
    expect(within(item).getByRole("button", { name: "Modifier" })).toBeInTheDocument();
    },
  );

  it.each(["après 2020-06-15", "entre 2020-06-15 et 2020-06-20"])(
    "transmet la date modifiée %s à adminUpdateEvent",
    async (eventDate) => {
      const formData = new FormData();
      for (const [key, value] of Object.entries({
        id: "7",
        personId: "42",
        type: "mariage",
        label: "Noces d’or",
        eventDate,
        description: "Cérémonie familiale",
        place: "Lyon",
        latitude: "45.764",
        longitude: "4.8357",
        visibility: "private",
      })) {
        formData.set(key, value);
      }

      await expect(updateEventAction(formData)).rejects.toThrow("NEXT_REDIRECT");
      expect(mocks.adminUpdateEvent).toHaveBeenCalledWith(7, {
        personId: 42,
        type: "mariage",
        label: "Noces d’or",
        eventDate,
        description: "Cérémonie familiale",
        place: "Lyon",
        latitude: 45.764,
        longitude: 4.8357,
        visibility: "private",
      });
    },
  );
});
