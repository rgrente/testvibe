import { beforeEach, describe, expect, it, vi } from "vitest";
import { File as NodeFile } from "node:buffer";

const state = vi.hoisted(() => ({
  files: new Set<string>(),
  failWrite: false,
  partialWrite: false,
  unlinkFailures: 0,
  failCreate: false,
  verifySession: true,
}));
const core = vi.hoisted(() => ({
  adminCreateMedia: vi.fn(async (input: { filename: string }) => {
    if (state.failCreate) throw new Error("db failure");
    return { id: 1, ...input };
  }),
  adminGetEvent: vi.fn(async () => ({ id: 1 })),
  adminGetPerson: vi.fn(async () => ({ id: 1 })),
  adminVerifySession: vi.fn(async () => state.verifySession),
}));
const disk = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  mkdir: vi.fn(),
  writeFile: vi.fn(async (path: string) => {
    if (state.partialWrite) state.files.add(path);
    if (state.failWrite) throw new Error("disk failure");
    state.files.add(path);
  }),
  unlink: vi.fn(async (path: string) => {
    if (state.unlinkFailures > 0) {
      state.unlinkFailures -= 1;
      throw new Error("cleanup failure");
    }
    state.files.delete(path);
  }),
}));

vi.mock("@testvibe/core", () => core);

vi.mock("node:crypto", async (importOriginal) => ({
  ...await importOriginal<typeof import("node:crypto")>(),
  randomUUID: () => "00000000-0000-4000-8000-000000000000",
}));

import { POST, uploadFileOps } from "./route";

const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

function uploadRequest(options: {
  origin?: string;
  personId?: string;
  eventId?: string;
  contents?: Buffer;
  size?: number;
} = {}) {
  const contents = options.size ? Buffer.alloc(options.size) : options.contents ?? validPng;
  const fields = new Map<string, FormDataEntryValue>([
    ["file", new NodeFile([Uint8Array.from(contents)], "upload.bin") as unknown as File],
  ]);
  if (options.personId !== undefined) fields.set("personId", options.personId);
  else if (options.eventId === undefined) fields.set("personId", "1");
  if (options.eventId !== undefined) fields.set("eventId", options.eventId);
  const request = new Request("https://family.example/api/media/upload", {
    method: "POST",
    headers: {
      cookie: "admin_session=opaque",
      origin: options.origin ?? "https://family.example",
      host: options.origin === "https://evil.example" ? "evil.example" : "family.example",
      "x-forwarded-host": options.origin === "https://evil.example" ? "evil.example" : "family.example",
    },
  });
  Object.defineProperty(request, "formData", {
    value: async () => ({ get: (name: string) => fields.get(name) ?? null }) as FormData,
  });
  return request;
}

describe("POST /api/media/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.files.clear();
    state.failWrite = false;
    state.partialWrite = false;
    state.unlinkFailures = 0;
    state.failCreate = false;
    state.verifySession = true;
    vi.spyOn(uploadFileOps, "existsSync").mockImplementation(disk.existsSync);
    vi.spyOn(uploadFileOps, "mkdir").mockImplementation(disk.mkdir);
    vi.spyOn(uploadFileOps, "writeFile").mockImplementation(disk.writeFile as never);
    vi.spyOn(uploadFileOps, "unlink").mockImplementation(disk.unlink as never);
  });

  it("returns 401 without a valid session and 403 for a spoofed origin", async () => {
    state.verifySession = false;
    expect((await POST(uploadRequest() as never)).status).toBe(401);
    state.verifySession = true;
    expect((await POST(uploadRequest({ origin: "https://evil.example" }) as never)).status).toBe(403);
    expect(core.adminCreateMedia).not.toHaveBeenCalled();
  });

  it("persists one valid, singly attached, decodable upload", async () => {
    const response = await POST(uploadRequest() as never);
    expect(response.status).toBe(201);
    expect(core.adminCreateMedia).toHaveBeenCalledOnce();
    expect(state.files.size).toBe(1);
  });

  it("rejects invalid attachments, truncation, and oversize content without an orphan", async () => {
    const invalid: Parameters<typeof uploadRequest>[0][] = [
      { personId: "1", eventId: "2" },
      { personId: "", eventId: "" },
      { contents: Buffer.from("GIF89a") },
      { size: 20 * 1024 * 1024 + 1 },
    ];
    for (const options of invalid) {
      const response = await POST(uploadRequest(options) as never);
      expect(response.status).toBe(400);
      expect(state.files.size).toBe(0);
    }
    expect(core.adminCreateMedia).not.toHaveBeenCalled();
  });

  it("rejects an unknown attachment without writing", async () => {
    core.adminGetPerson.mockRejectedValueOnce(new Error("missing"));
    expect((await POST(uploadRequest() as never)).status).toBe(400);
    expect(disk.writeFile).not.toHaveBeenCalled();
  });

  it("leaves no file or database orphan after disk or database faults", async () => {
    state.failWrite = true;
    state.partialWrite = true;
    state.unlinkFailures = 1;
    expect((await POST(uploadRequest() as never)).status).toBe(500);
    expect(core.adminCreateMedia).not.toHaveBeenCalled();
    expect(state.files.size).toBe(0);
    expect(disk.unlink).toHaveBeenCalledTimes(2);

    state.failWrite = false;
    state.failCreate = true;
    expect((await POST(uploadRequest() as never)).status).toBe(500);
    expect(state.files.size).toBe(0);
  });
});
