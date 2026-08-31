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
  adminDeleteMedia: vi.fn(async () => {
    if (state.failDelete) throw new Error("db failure");
    state.deleted = true;
  }),
  adminGetMedia: vi.fn(async () => ({ id: 7, filename: "known.png" })),
  adminVerifySession: vi.fn(async () => state.verifySession),
}));

vi.mock("@testvibe/core", () => core);

import { DELETE, mediaFileOps } from "./route";

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
    vi.spyOn(mediaFileOps, "readFile").mockResolvedValue(Buffer.from("contents"));
    vi.spyOn(mediaFileOps, "unlink").mockImplementation(async () => {
      if (state.failUnlink) throw new Error("disk failure");
      state.exists = false;
    });
    vi.spyOn(mediaFileOps, "writeFile").mockImplementation(async () => {
      if (state.restoreFailures > 0) {
        state.restoreFailures -= 1;
        throw new Error("restore failure");
      }
      state.exists = true;
      state.restored = true;
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
    expect(mediaFileOps.writeFile).toHaveBeenCalledTimes(2);
  });

  it("reports an unrecovered delete inconsistency instead of masking it", async () => {
    state.failDelete = true;
    state.restoreFailures = 3;
    expect((await remove()).status).toBe(503);
    expect(state.deleted).toBe(false);
    expect(state.exists).toBe(false);
  });
});
