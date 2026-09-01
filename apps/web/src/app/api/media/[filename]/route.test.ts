import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  exists: true,
  deleted: false,
  failDelete: false,
  failUnlink: false,
  restoreFailures: 0,
  restored: false,
  verifySession: true,
}));
const core = vi.hoisted(() => ({
  runExclusiveGenealogyOperation: vi.fn(async <T>(work: () => Promise<T>) => work()),
  adminDeleteMedia: vi.fn(async () => {
    if (state.failDelete) throw new Error("db failure");
    state.deleted = true;
  }),
  adminGetMedia: vi.fn(async () => ({ id: 7, filename: "known.png" })),
  adminGetMediaByFilename: vi.fn(async (): Promise<{ id: number; filename: string; mimeType: string; visibility?: string }> => {
    throw new Error("missing");
  }),
  getMediaForWebByFilename: vi.fn(async () => ({ id: 7, filename: "known.png", mimeType: "image/png" })),
  adminVerifySession: vi.fn(async (token?: string) => Boolean(token) && state.verifySession),
}));

vi.mock("@testvibe/core", () => core);

import { DELETE, GET, mediaFileOps } from "./route";

function deleteRequest(filename = "known.png", id = "7", origin = "https://family.example") {
  return [
    new Request(`https://family.example/api/media/${filename}?id=${id}`, {
      method: "DELETE",
      headers: {
        cookie: "admin_session=opaque",
        origin,
        host: origin === "https://evil.example" ? "evil.example" : "family.example",
        "x-forwarded-host": origin === "https://evil.example" ? "evil.example" : "family.example",
      },
    }),
    { params: Promise.resolve({ filename }) },
  ] as const;
}

async function remove(filename = "known.png", id = "7", origin = "https://family.example") {
  const [request, context] = deleteRequest(filename, id, origin);
  return DELETE(request as never, context);
}

describe("DELETE /api/media/[filename]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(state, {
      exists: true,
      deleted: false,
      failDelete: false,
      failUnlink: false,
      restoreFailures: 0,
      restored: false,
      verifySession: true,
    });
    vi.spyOn(mediaFileOps, "existsSync").mockImplementation(() => state.exists);
    vi.spyOn(mediaFileOps, "readdir").mockResolvedValue([]);
    vi.spyOn(mediaFileOps, "rename").mockImplementation(async (_from, to) => {
      const destination = String(to);
      if (state.failUnlink && destination.includes(".deleting-")) throw new Error("disk failure");
      if (!destination.includes(".deleting-") && destination.endsWith("known.png") && state.restoreFailures > 0) {
        state.restoreFailures -= 1;
        throw new Error("restore failure");
      }
      state.exists = !destination.includes(".deleting-") && destination.endsWith("known.png");
      state.restored = state.exists;
    });
    vi.spyOn(mediaFileOps, "unlink").mockImplementation(async () => {
      if (state.failUnlink) throw new Error("disk failure");
      state.exists = false;
    });

  });

  it("returns 401 without a session and 403 for spoofed Host/Origin", async () => {
    state.verifySession = false;
    expect((await remove()).status).toBe(401);
    state.verifySession = true;
    expect((await remove("known.png", "7", "https://evil.example")).status).toBe(403);
    expect(core.adminGetMedia).not.toHaveBeenCalled();
  });

  it("does not mutate for absent, unknown, or mismatched id/filename", async () => {
    expect((await remove("known.png", "")).status).toBe(400);
    core.adminGetMedia.mockRejectedValueOnce(new Error("unknown"));
    expect((await remove("known.png", "999")).status).toBe(500);
    expect((await remove("other.png")).status).toBe(400);
    expect(mediaFileOps.unlink).not.toHaveBeenCalled();
    expect(core.adminDeleteMedia).not.toHaveBeenCalled();
  });

  it("returns 409 without mutating an inconsistent database record", async () => {
    state.exists = false;
    expect((await remove()).status).toBe(409);
    expect(core.adminDeleteMedia).not.toHaveBeenCalled();
  });

  it("removes both file and database record on success", async () => {
    expect((await remove()).status).toBe(200);
    expect(core.runExclusiveGenealogyOperation).toHaveBeenCalledOnce();
    expect(state.exists).toBe(false);
    expect(state.deleted).toBe(true);
  });

  it("does not delete the database after a disk fault and restores the file after a database fault", async () => {
    state.failUnlink = true;
    expect((await remove()).status).toBe(500);
    expect(state.deleted).toBe(false);
    expect(state.exists).toBe(true);

    state.failUnlink = false;
    state.failDelete = true;
    state.restoreFailures = 1;
    expect((await remove()).status).toBe(500);
    expect(state.restored).toBe(true);
    expect(state.exists).toBe(true);
    expect(mediaFileOps.rename).toHaveBeenCalledTimes(4);
  });

  it("reports an unrecovered delete inconsistency instead of masking it", async () => {
    state.failDelete = true;
    state.restoreFailures = 3;
    expect((await remove()).status).toBe(503);
    expect(state.deleted).toBe(false);
    expect(state.exists).toBe(false);
  });
});

describe("GET /api/media/[filename]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.exists = true;
    state.verifySession = true;
    vi.spyOn(mediaFileOps, "existsSync").mockImplementation(() => state.exists);
  });

  it("returns the same 404 for hidden, unknown, orphaned, and absent files", async () => {
    for (const filename of ["hidden.png", "unknown.png", "orphan.png"]) {
      core.getMediaForWebByFilename.mockRejectedValueOnce(new Error("not visible"));
      const response = await GET(new Request(`https://family.example/api/media/${filename}`) as never, {
        params: Promise.resolve({ filename }),
      });
      expect(response.status).toBe(404);
    }
    state.exists = false;
    const absent = await GET(new Request("https://family.example/api/media/known.png") as never, {
      params: Promise.resolve({ filename: "known.png" }),
    });
    expect(absent.status).toBe(404);
  });

  it("serves an authorised file without shared caching", async () => {
    const response = await GET(new Request("https://family.example/api/media/known.png") as never, {
      params: Promise.resolve({ filename: "known.png" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("serves protected media to an authenticated admin", async () => {
    core.getMediaForWebByFilename.mockRejectedValueOnce(new Error("not public"));
    core.adminGetMediaByFilename.mockResolvedValueOnce({
      id: 7,
      filename: "known.png",
      mimeType: "image/png",
      visibility: "private",
    });
    const response = await GET(new Request("https://family.example/api/media/known.png", {
      headers: { cookie: "admin_session=opaque" },
    }) as never, { params: Promise.resolve({ filename: "known.png" }) });

    expect(response.status).toBe(200);
    expect(core.adminGetMediaByFilename).toHaveBeenCalledWith("known.png");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns a uniform non-cacheable 404 for protected media without an admin session", async () => {
    state.verifySession = false;
    core.getMediaForWebByFilename.mockRejectedValueOnce(new Error("not public"));
    const response = await GET(new Request("https://family.example/api/media/known.png") as never, {
      params: Promise.resolve({ filename: "known.png" }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(core.adminGetMediaByFilename).not.toHaveBeenCalled();
  });
});
