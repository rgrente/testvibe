import { beforeEach, describe, expect, it, vi } from "vitest";
import { File as NodeFile } from "node:buffer";

const create = vi.fn();
const restore = vi.fn();
vi.mock("@testvibe/core", () => ({ adminCreateBackup: create, adminRestoreBackup: restore }));
vi.mock("@/lib/session", () => ({ authorizeMutationRequest: vi.fn().mockResolvedValue(null) }));

function restoreRequest(fields: Map<string, FormDataEntryValue>) {
  const request = new Request("http://localhost/admin/backup/restore", { method: "POST" });
  Object.defineProperty(request, "formData", {
    value: async () => ({ get: (name: string) => fields.get(name) ?? null }) as FormData,
  });
  return request;
}

describe("admin backup routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("downloads the complete versioned archive", async () => {
    create.mockResolvedValue(Buffer.from("archive"));
    const { GET } = await import("./export/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("testvibe-backup");
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe("archive");
  });

  it("validates without restoring and requires explicit replacement confirmation", async () => {
    restore.mockResolvedValue({ valid: true, formatVersion: "1.0" });
    const { POST } = await import("./restore/route");
    const dryRun = new Map<string, FormDataEntryValue>([
      ["archive", new NodeFile(["archive"], "backup.json") as unknown as File],
      ["mode", "validate"],
    ]);
    const dryResponse = await POST(restoreRequest(dryRun) as never);
    expect(dryResponse.status).toBe(200);
    expect(restore).toHaveBeenCalledWith(expect.any(Buffer), { mode: "validate", confirm: undefined });

    const replace = new Map<string, FormDataEntryValue>([
      ["archive", new NodeFile(["archive"], "backup.json") as unknown as File],
      ["mode", "replace"],
    ]);
    const rejected = await POST(restoreRequest(replace) as never);
    expect(rejected.status).toBe(400);
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
