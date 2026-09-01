import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { adminSession, event, filiation, loginRateLimit, media, person, unionPartner, unions } from "@testvibe/db";
import { createTestDb } from "./test-utils.js";
import { createBackup, restoreBackup, validateBackup } from "./backup.js";

const dirs: string[] = [];
async function tempDir() {
  const directory = await mkdtemp(join(tmpdir(), "testvibe-backup-"));
  dirs.push(directory);
  return directory;
}
afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(dirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function seedComplete(db: Awaited<ReturnType<typeof createTestDb>>, uploads: string) {
  await db.insert(person).values({ id: 7, firstName: "Ada", lastName: "Lovelace", livingStatus: "deceased", visibility: "family" });
  await db.insert(person).values({ id: 8, firstName: "Charles", lastName: "Babbage" });
  await db.insert(unions).values({ id: 4, type: "libre", place: "London", latitude: 51.5, longitude: -0.1 });
  await db.insert(unionPartner).values([{ unionId: 4, personId: 7 }, { unionId: 4, personId: 8 }]);
  await db.insert(filiation).values({ id: 3, parentId: 7, childId: 8, role: "biologique" });
  await db.insert(event).values({ id: 5, personId: 7, type: "résidence", place: "London", latitude: 51.5, longitude: -0.1, visibility: "private" });
  await db.insert(media).values({ id: 2, personId: 7, filename: "portrait.png", originalName: "portrait.png", mimeType: "image/png", size: 4, createdAt: "2026-01-01T00:00:00.000Z", visibility: "family" });
  await db.insert(adminSession).values({ tokenHash: "secret-session", expiresAt: "2099-01-01", createdAt: "2026-01-01" });
  await db.insert(loginRateLimit).values({ fingerprint: "secret-rate", failures: 2, windowStartedAt: "2026-01-01" });
  await writeFile(join(uploads, "portrait.png"), Buffer.from([1, 2, 3, 4]));
}

describe("complete backup and restore", () => {
  it("round-trips every genealogy table and media byte while excluding operational secrets", async () => {
    const source = await createTestDb();
    const target = await createTestDb();
    const sourceUploads = await tempDir();
    const targetUploads = await tempDir();
    const safetyDir = await tempDir();
    await seedComplete(source, sourceUploads);
    await target.insert(person).values({ id: 99, firstName: "Old", lastName: "State" });

    const archive = await createBackup(source, sourceUploads, new Date("2026-08-31T12:00:00.000Z"));
    const text = archive.toString("utf8");
    expect(text).not.toContain("secret-session");
    expect(text).not.toContain("secret-rate");
    const report = await validateBackup(archive);
    expect(report).toMatchObject({ formatVersion: "1.0", mediaFiles: 1, valid: true });

    const result = await restoreBackup(target, targetUploads, archive, { safetyDir, confirm: "REPLACE" });
    expect(result.safetyBackupPath).toContain(safetyDir);
    expect(await target.select().from(person)).toEqual(await source.select().from(person));
    expect(await target.select().from(unions)).toEqual(await source.select().from(unions));
    expect(await target.select().from(unionPartner)).toEqual(await source.select().from(unionPartner));
    expect(await target.select().from(filiation)).toEqual(await source.select().from(filiation));
    expect(await target.select().from(event)).toEqual(await source.select().from(event));
    expect(await target.select().from(media)).toEqual(await source.select().from(media));
    expect(await readFile(join(targetUploads, "portrait.png"))).toEqual(Buffer.from([1, 2, 3, 4]));
    expect((await readdir(safetyDir)).length).toBe(1);
  });

  it("rejects corruption, dangerous paths, missing media, insufficient space, and future versions before mutation", async () => {
    const db = await createTestDb();
    const uploads = await tempDir();
    await seedComplete(db, uploads);
    const archive = await createBackup(db, uploads);
    const original = await db.select().from(person);
    const parsed = JSON.parse(archive.toString("utf8"));

    const invalidArchives = [
      Buffer.from(archive.subarray(0, archive.length - 3)),
      Buffer.from(JSON.stringify({ ...parsed, manifest: { ...parsed.manifest, version: "2.0" } })),
      Buffer.from(JSON.stringify({ ...parsed, entries: [...parsed.entries, { ...parsed.entries[0], path: "../escape" }] })),
      Buffer.from(JSON.stringify({ ...parsed, files: {} })),
    ];
    for (const invalid of invalidArchives) await expect(validateBackup(invalid)).rejects.toThrow();
    await expect(validateBackup(archive, { availableBytes: 1 })).rejects.toThrow(/space/i);
    expect(await db.select().from(person)).toEqual(original);
  });

  it("validation is write-free and a failed media switch rolls database and media back while retaining safety backup", async () => {
    const source = await createTestDb();
    const target = await createTestDb();
    const sourceUploads = await tempDir();
    const targetUploads = await tempDir();
    const safetyDir = await tempDir();
    await seedComplete(source, sourceUploads);
    await target.insert(person).values({ id: 99, firstName: "Old", lastName: "State" });
    await writeFile(join(targetUploads, "old.txt"), "old");
    const archive = await createBackup(source, sourceUploads);

    await validateBackup(archive);
    await expect(restoreBackup(target, targetUploads, archive, { safetyDir, confirm: "REPLACE", failpoint: "after-media-switch" })).rejects.toThrow(/failpoint/);
    expect((await target.select().from(person)).map((row) => row.id)).toEqual([99]);
    expect(await readFile(join(targetUploads, "old.txt"), "utf8")).toBe("old");
    expect((await readdir(safetyDir)).length).toBe(1);
  });
});
