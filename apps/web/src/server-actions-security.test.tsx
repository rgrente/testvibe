import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorization = vi.hoisted(() => ({ error: null as Error | null }));
const core = vi.hoisted(() => {
  const person = {
    id: 1, firstName: "Ada", lastName: "Lovelace", birthName: null,
    birthDate: null, deathDate: null, gender: null,
  };
  return {
    adminCreateEvent: vi.fn(), adminCreateFiliation: vi.fn(), adminCreateFiliations: vi.fn(),
    adminCreatePerson: vi.fn(), adminCreateUnion: vi.fn(), adminDeleteEvent: vi.fn(),
    adminDeleteFiliation: vi.fn(), adminDeletePerson: vi.fn(), adminDeleteUnion: vi.fn(),
    adminImportGedcom: vi.fn(), adminRevokeSession: vi.fn(), adminUpdateEvent: vi.fn(),
    adminUpdateFiliation: vi.fn(), adminUpdatePerson: vi.fn(), adminUpdateUnion: vi.fn(),
    adminGetPerson: vi.fn(async () => person),
    adminGetUnion: vi.fn(async () => ({
      id: 7, type: "mariage", startDate: null, endDate: null, place: null,
      latitude: null, longitude: null, personIds: [1, 2],
    })),
    adminGetFiliation: vi.fn(async () => ({ id: 7, parentId: 1, childId: 2, role: "biologique" })),
    adminListPersons: vi.fn(async () => [person, { ...person, id: 2, firstName: "Grace", lastName: "Hopper" }]),
    adminListUnions: vi.fn(async () => [{
      id: 7, type: "mariage", startDate: null, endDate: null, place: null,
      latitude: null, longitude: null, personIds: [1, 2],
    }]),
    adminListFiliations: vi.fn(async () => [{ id: 7, parentId: 1, childId: 2, role: "biologique" }]),
    adminListEventsByPerson: vi.fn(async () => [{
      id: 7, personId: 1, type: "naissance", label: null, eventDate: null,
      description: null, place: null, latitude: null, longitude: null,
    }]),
  };
});

vi.mock("@testvibe/core", () => core);
vi.mock("@/lib/session", () => ({
  SESSION_COOKIE_NAME: "admin_session",
  requireAdminMutation: vi.fn(async () => {
    if (authorization.error) throw authorization.error;
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  redirect: vi.fn((destination: string) => { throw new Error(`NEXT_REDIRECT:${destination}`); }),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    delete: vi.fn(),
    get: vi.fn(() => ({ value: "opaque-session" })),
  })),
}));

import AdminLayout from "./app/admin/layout";
import PersonsPage from "./app/admin/persons/page";
import EditPersonPage from "./app/admin/persons/[id]/edit/page";
import PersonEventsPage from "./app/admin/persons/[id]/events/page";
import UnionsPage from "./app/admin/unions/page";
import EditUnionPage from "./app/admin/unions/[id]/edit/page";
import FiliationsPage from "./app/admin/filiations/page";
import EditFiliationPage from "./app/admin/filiations/[id]/edit/page";
import { importGedcomAction } from "./app/admin/gedcom/page";

type ServerAction = (formData: FormData) => Promise<unknown>;

function collectActions(node: ReactNode, actions = new Map<string, ServerAction>()): Map<string, ServerAction> {
  if (Array.isArray(node)) {
    for (const child of node) collectActions(child, actions);
    return actions;
  }
  if (!isValidElement(node)) return actions;
  const props = (node as ReactElement<Record<string, unknown>>).props;
  if (typeof props.action === "function") {
    const action = props.action as ServerAction;
    actions.set(action.name, action);
  }
  collectActions(props.children as ReactNode, actions);
  return actions;
}

function form(values: Record<string, string | object | Array<string | object>>): FormData {
  return {
    get: (name: string) => {
      const value = values[name];
      return Array.isArray(value) ? value[0] ?? null : value ?? null;
    },
    getAll: (name: string) => {
      const value = values[name];
      if (value === undefined) return [];
      return Array.isArray(value) ? value : [value];
    },
  } as unknown as FormData;
}

function inputFor(actionName: string): FormData {
  const common: Record<string, string | object | Array<string | object>> = {
    id: "7", personId: "1", firstName: "Ada", lastName: "Lovelace",
    parentId: "1", childId: "2", parentIds: ["1"], childIds: ["2"],
    personIds: ["1", "2"], role: "biologique", type: "mariage",
  };
  if (actionName === "createEventAction" || actionName === "updateEventAction") common.type = "naissance";
  if (actionName === "importGedcomAction") {
    common.gedcom = { size: 12, text: async () => "0 HEAD\n0 TRLR" };
  }
  return form(common);
}

async function allActions(): Promise<Map<string, ServerAction>> {
  const actions = new Map<string, ServerAction>();
  const pages: ReactNode[] = [
    AdminLayout({ children: null }),
    await PersonsPage({ searchParams: Promise.resolve({}) }),
    await EditPersonPage({ params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve({}) }),
    await PersonEventsPage({ params: Promise.resolve({ id: "1" }), searchParams: Promise.resolve({}) }),
    await UnionsPage({ searchParams: Promise.resolve({}) }),
    await EditUnionPage({ params: Promise.resolve({ id: "7" }), searchParams: Promise.resolve({}) }),
    await FiliationsPage({ searchParams: Promise.resolve({}) }),
    await EditFiliationPage({ params: Promise.resolve({ id: "7" }), searchParams: Promise.resolve({}) }),
  ];
  for (const page of pages) collectActions(page, actions);
  actions.set(importGedcomAction.name, importGedcomAction);
  return actions;
}

const expectedMutations: Record<string, keyof typeof core> = {
  logoutAction: "adminRevokeSession",
  importGedcomAction: "adminImportGedcom",
  createPersonAction: "adminCreatePerson",
  deletePersonAction: "adminDeletePerson",
  updatePersonAction: "adminUpdatePerson",
  createUnionAction: "adminCreateUnion",
  deleteUnionAction: "adminDeleteUnion",
  updateUnionAction: "adminUpdateUnion",
  createFiliationAction: "adminCreateFiliations",
  deleteFiliationAction: "adminDeleteFiliation",
  updateFiliationAction: "adminUpdateFiliation",
  createEventAction: "adminCreateEvent",
  updateEventAction: "adminUpdateEvent",
  deleteEventAction: "adminDeleteEvent",
};

const mutationMocks = Object.values(expectedMutations).map((name) => core[name] as ReturnType<typeof vi.fn>);

describe("all admin Server Actions", () => {
  beforeEach(() => {
    authorization.error = null;
    vi.clearAllMocks();
  });

  it("has an exhaustive behavioral harness for every mutating action", async () => {
    expect([...(await allActions()).keys()].sort()).toEqual(Object.keys(expectedMutations).sort());
  });

  it.each(["Unauthorized", "Forbidden"])("rejects %s before any core mutation", async (reason) => {
    authorization.error = new Error(reason);
    for (const action of (await allActions()).values()) {
      await expect(action(form({}))).rejects.toThrow(reason);
    }
    for (const mutation of mutationMocks) expect(mutation).not.toHaveBeenCalled();
  });

  it("allows each authorized action to reach exactly its intended core mutation", async () => {
    for (const [name, action] of await allActions()) {
      vi.clearAllMocks();
      await action(inputFor(name)).catch(() => undefined);
      expect(core[expectedMutations[name]]).toHaveBeenCalledOnce();
    }
  });
});
