import { NotFoundError } from "@testvibe/core";
import { describe, expect, it, vi } from "vitest";
import { recoverMediaArtifacts, type MediaRecoveryOps } from "./media-recovery.js";

function harness(records: Set<number>, entries: string[]) {
  const files = new Set(entries);
  const ops: MediaRecoveryOps = {
    readdir: vi.fn(async () => [...files]),
    rename: vi.fn(async (from: string, to: string) => {
      files.delete(from.split("/").pop()!);
      files.add(to.split("/").pop()!);
    }),
    unlink: vi.fn(async (path: string) => { files.delete(path.split("/").pop()!); }),
    getMedia: vi.fn(async (id: number) => {
      if (!records.has(id)) throw new NotFoundError("Media", id);
      return { id, filename: "known.png" };
    }),
    getMediaByFilename: vi.fn(async (filename: string) => {
      if (!records.has(7)) throw new NotFoundError("Media", filename);
      return { id: 7, filename };
    }),
  };
  return { files, ops };
}

describe("durable media recovery", () => {
  it("promotes a staged upload when its database record exists", async () => {
    const { files, ops } = harness(new Set([7]), [".uploading-pending-known.png"]);
    await recoverMediaArtifacts("/uploads", ops);
    expect([...files]).toEqual(["known.png"]);
  });

  it("retains staged data when promotion has a persistent disk fault", async () => {
    const { files, ops } = harness(new Set([7]), [".uploading-pending-known.png"]);
    ops.rename = vi.fn(async () => { throw new Error("disk unavailable"); });
    await expect(recoverMediaArtifacts("/uploads", ops)).rejects.toThrow("disk unavailable");
    expect([...files]).toEqual([".uploading-pending-known.png"]);
  });

  it("removes an uncommitted staged upload", async () => {
    const { files, ops } = harness(new Set(), [".uploading-pending-known.png"]);
    await recoverMediaArtifacts("/uploads", ops);
    expect(files.size).toBe(0);
  });

  it("retains a staged upload while the database is unavailable, then promotes it on retry", async () => {
    const { files, ops } = harness(new Set([7]), [".uploading-pending-known.png"]);
    ops.getMediaByFilename = vi
      .fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce({ id: 7, filename: "known.png" });

    await expect(recoverMediaArtifacts("/uploads", ops)).rejects.toThrow("database unavailable");
    expect([...files]).toEqual([".uploading-pending-known.png"]);

    await recoverMediaArtifacts("/uploads", ops);
    expect([...files]).toEqual(["known.png"]);
  });

  it("restores quarantined deletion data when the database record remains", async () => {
    const { files, ops } = harness(new Set([7]), [".deleting-7-known.png"]);
    await recoverMediaArtifacts("/uploads", ops);
    expect([...files]).toEqual(["known.png"]);
  });

  it("removes quarantined data only after its database record is gone", async () => {
    const { files, ops } = harness(new Set(), [".deleting-7-known.png"]);
    await recoverMediaArtifacts("/uploads", ops);
    expect(files.size).toBe(0);
  });

  it("retains quarantined data while the database is unavailable, then restores it on retry", async () => {
    const { files, ops } = harness(new Set([7]), [".deleting-7-known.png"]);
    ops.getMedia = vi
      .fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce({ id: 7, filename: "known.png" });

    await expect(recoverMediaArtifacts("/uploads", ops)).rejects.toThrow("database unavailable");
    expect([...files]).toEqual([".deleting-7-known.png"]);

    await recoverMediaArtifacts("/uploads", ops);
    expect([...files]).toEqual(["known.png"]);
  });
});
