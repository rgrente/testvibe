import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { adminVerifySession } = vi.hoisted(() => ({
  adminVerifySession: vi.fn(),
}));

vi.mock("@testvibe/core", async (importOriginal) => ({
  ...await importOriginal<typeof import("@testvibe/core")>(),
  adminVerifySession,
}));

import { proxy } from "./proxy";

function adminRequest(session?: string) {
  return new NextRequest("https://family.example/admin", {
    headers: session ? { cookie: `admin_session=${session}` } : undefined,
  });
}

describe("navigation vers /admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirige la navigation non connectée vers la connexion sans créer de session", async () => {
    adminVerifySession.mockResolvedValue(false);

    const response = await proxy(adminRequest());

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://family.example/admin/login");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(adminVerifySession).toHaveBeenCalledWith(undefined);
  });

  it("laisse passer la navigation connectée sans modifier la session", async () => {
    adminVerifySession.mockResolvedValue(true);

    const response = await proxy(adminRequest("opaque-session"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(adminVerifySession).toHaveBeenCalledWith("opaque-session");
  });
});
