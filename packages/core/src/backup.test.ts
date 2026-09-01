import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { adminSession, event, filiation, genealogicalDate, loginRateLimit, media, person, unionPartner, unions } from "@testvibe/db";
import { createTestDb } from "./test-utils.js";
import { adminRestoreBackup, backupFileOps, createBackup, restoreBackup, validateBackup } from "./backup.js";
import { createOperationCoordinator } from "./operation-coordinator.js";

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

function rewriteTables(archive: Buffer, mutate: (tables: Record<string, Array<Record<string, unknown>>>) => void) {
  const envelope = JSON.parse(archive.toString("utf8"));
  const tables = JSON.parse(Buffer.from(envelope.files["data/tables.json"], "base64").toString("utf8"));
  mutate(tables);
  const content = Buffer.from(JSON.stringify(tables));
  envelope.files["data/tables.json"] = content.toString("base64");
  const entry = envelope.entries.find((candidate: { path: string }) => candidate.path === "data/tables.json");
  entry.size = content.length;
  entry.sha256 = createHash("sha256").update(content).digest("hex");
  for (const name of Object.keys(envelope.manifest.tableCounts)) envelope.manifest.tableCounts[name] = tables[name].length;
  envelope.manifest.totalBytes = envelope.entries.reduce((sum: number, candidate: { size: number }) => sum + candidate.size, 0);
  return Buffer.from(JSON.stringify(envelope));
}

describe("complete backup and restore", () => {
  it("waits for a coordinated genealogy mutation before reading database and media", async () => {
    const db = await createTestDb();
    const uploads = await tempDir();
    const coordinator = createOperationCoordinator();
    let mutationReady!: () => void;
    const mutationStarted = new Promise<void>((resolve) => { mutationReady = resolve; });
    let finishMutation!: () => void;
    const mayFinish = new Promise<void>((resolve) => { finishMutation = resolve; });

    const mutation = coordinator.runExclusive(async () => {
      await db.insert(person).values({ id: 1, firstName: "Coherent", lastName: "Snapshot" });
      await db.insert(media).values({
        id: 1,
        personId: 1,
        filename: "coherent.txt",
        originalName: "coherent.txt",
        mimeType: "text/plain",
        size: 8,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      mutationReady();
      await mayFinish;
      await writeFile(join(uploads, "coherent.txt"), "coherent");
    });
    await mutationStarted;

    let backupFinished = false;
    const backup = createBackup(db, uploads, new Date(), coordinator).then((archive) => {
      backupFinished = true;
      return archive;
    });
    await Promise.resolve();
    expect(backupFinished).toBe(false);
    finishMutation();
    await mutation;
    await expect(validateBackup(await backup)).resolves.toMatchObject({ mediaFiles: 1 });
  });

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
    expect(report).toMatchObject({ formatVersion: "1.1", mediaFiles: 1, valid: true });

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

  it("round-trips genealogical date metadata and replaces stale target metadata", async () => {
    const source = await createTestDb();
    const target = await createTestDb();
    const sourceUploads = await tempDir();
    const targetUploads = await tempDir();
    const safetyDir = await tempDir();
    await source.insert(person).values({ id: 1, firstName: "Source", lastName: "Date", birthDate: "vers 1815" });
    await source.insert(genealogicalDate).values({
      ownerKind: "person", ownerId: 1, field: "birth_date", original: "vers 1815",
      qualification: "about", precision: "year", lowerBound: "1814-01-01", upperBound: "1816-12-31",
    });
    await target.insert(person).values({ id: 1, firstName: "Target", lastName: "Date", birthDate: "après 1900" });
    await target.insert(genealogicalDate).values({
      ownerKind: "person", ownerId: 1, field: "birth_date", original: "après 1900",
      qualification: "after", precision: "year", lowerBound: "1901-01-01", upperBound: null,
    });

    const archive = await createBackup(source, sourceUploads);
    await restoreBackup(target, targetUploads, archive, { safetyDir, confirm: "REPLACE" });

    expect(await target.select().from(genealogicalDate)).toEqual(await source.select().from(genealogicalDate));
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

  it("rejects duplicate identifiers and dangling genealogy references with valid checksums", async () => {
    const db = await createTestDb();
    const uploads = await tempDir();
    await seedComplete(db, uploads);
    const archive = await createBackup(db, uploads);
    const duplicatePerson = rewriteTables(archive, (tables) => tables.person.push({ ...tables.person[0] }));
    const danglingEvent = rewriteTables(archive, (tables) => { tables.event[0].personId = 999; });

    await expect(validateBackup(duplicatePerson)).rejects.toThrow(/logical database/i);
    await expect(validateBackup(danglingEvent)).rejects.toThrow(/logical database/i);
  });

  it("restores the previous compatible minor version and rejects a future minor version", async () => {
    const source = await createTestDb();
    const target = await createTestDb();
    const sourceUploads = await tempDir();
    const targetUploads = await tempDir();
    const safetyDir = await tempDir();
    await seedComplete(source, sourceUploads);
    const current = JSON.parse((await createBackup(source, sourceUploads)).toString("utf8"));
    expect(current.manifest.version).toBe("1.1");

    const previous = Buffer.from(JSON.stringify({ ...current, manifest: { ...current.manifest, version: "1.0" } }));
    const future = Buffer.from(JSON.stringify({ ...current, manifest: { ...current.manifest, version: "1.2" } }));
    await restoreBackup(target, targetUploads, previous, { safetyDir, confirm: "REPLACE" });
    expect(await target.select().from(person)).toEqual(await source.select().from(person));
    await expect(validateBackup(future)).rejects.toThrow(/future/i);
  });

  it("checks available disk space during an admin dry run", async () => {
    const db = await createTestDb();
    const uploads = await tempDir();
    await seedComplete(db, uploads);
    const archive = await createBackup(db, uploads);
    const availableBytes = backupFileOps.availableBytes;
    backupFileOps.availableBytes = async () => 1;
    try {
      await expect(adminRestoreBackup(archive, { mode: "validate" })).rejects.toThrow(/space/i);
    } finally {
      backupFileOps.availableBytes = availableBytes;
    }
  });

  it.each(["after-staging", "after-current-media-moved", "after-media-switch"] as const)(
    "validation is write-free and failure at %s rolls database and media back while retaining safety backup",
    async (failpoint) => {
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
    const coordinator = createOperationCoordinator();
    await expect(restoreBackup(target, targetUploads, archive, {
      safetyDir,
      confirm: "REPLACE",
      failpoint,
      coordinator,
    })).rejects.toThrow(/failpoint/);
    expect((await target.select().from(person)).map((row) => row.id)).toEqual([99]);
    expect(await readFile(join(targetUploads, "old.txt"), "utf8")).toBe("old");
    expect((await readdir(safetyDir)).length).toBe(1);
    await expect(coordinator.runExclusive(async () => "released")).resolves.toBe("released");
  });

  it("restores the original media directory when installation fails after moving it aside", async () => {
    const source = await createTestDb();
    const target = await createTestDb();
    const sourceUploads = await tempDir();
    const targetUploads = await tempDir();
    const safetyDir = await tempDir();
    await seedComplete(source, sourceUploads);
    await target.insert(person).values({ id: 99, firstName: "Old", lastName: "State" });
    await writeFile(join(targetUploads, "old.txt"), "old");

    const archive = await createBackup(source, sourceUploads);
    await expect(restoreBackup(target, targetUploads, archive, {
      safetyDir,
      confirm: "REPLACE",
      failpoint: "after-current-media-moved",
    })).rejects.toThrow(/failpoint/);

    expect((await target.select().from(person)).map((row) => row.id)).toEqual([99]);
    expect(await readFile(join(targetUploads, "old.txt"), "utf8")).toBe("old");
    expect((await readdir(safetyDir)).length).toBe(1);
  });

  it("keeps committed database and media together when rollback cleanup fails", async () => {
    const source = await createTestDb();
    const target = await createTestDb();
    const sourceUploads = await tempDir();
    const targetUploads = await tempDir();
    const safetyDir = await tempDir();
    await seedComplete(source, sourceUploads);
    await target.insert(person).values({ id: 99, firstName: "Old", lastName: "State" });
    await writeFile(join(targetUploads, "old.txt"), "old");

    const archive = await createBackup(source, sourceUploads);
    const result = await restoreBackup(target, targetUploads, archive, {
      safetyDir,
      confirm: "REPLACE",
      failpoint: "rollback-cleanup-failure",
    });

    expect(result.cleanupPending).toBe(true);
    expect(result.rollbackPath).toContain(".restore-rollback-");
    expect((await target.select().from(person)).map((row) => row.id)).toEqual([7, 8]);
    expect(await readFile(join(targetUploads, "portrait.png"))).toEqual(Buffer.from([1, 2, 3, 4]));
    expect((await readdir(safetyDir)).length).toBe(1);
  });

  it("keeps mutations queued until restoration completes and releases the coordinator", async () => {
    const source = await createTestDb();
    const target = await createTestDb();
    const sourceUploads = await tempDir();
    const targetUploads = await tempDir();
    const safetyDir = await tempDir();
    const coordinator = createOperationCoordinator();
    await seedComplete(source, sourceUploads);
    await target.insert(person).values({ id: 99, firstName: "Old", lastName: "State" });
    const archive = await createBackup(source, sourceUploads);
    let staged!: () => void;
    const stagingReached = new Promise<void>((resolve) => { staged = resolve; });
    let continueRestore!: () => void;
    const mayContinue = new Promise<void>((resolve) => { continueRestore = resolve; });

    const restoration = restoreBackup(target, targetUploads, archive, {
      safetyDir,
      confirm: "REPLACE",
      coordinator,
      onPhase: async (phase) => {
        if (phase === "after-staging") {
          staged();
          await mayContinue;
        }
      },
    });
    await stagingReached;
    let mutationStarted = false;
    const mutation = coordinator.runExclusive(async () => {
      mutationStarted = true;
      await target.insert(person).values({ id: 100, firstName: "After", lastName: "Restore" });
    });
    await Promise.resolve();
    expect(mutationStarted).toBe(false);
    continueRestore();
    await restoration;
    await mutation;
    expect(mutationStarted).toBe(true);
    expect((await target.select().from(person)).map((row) => row.id)).toEqual([7, 8, 100]);
  });
});
