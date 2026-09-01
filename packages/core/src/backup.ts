import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  event,
  filiation,
  media,
  person,
  unionPartner,
  unions,
  type Database,
} from "@testvibe/db";

const FORMAT = "testvibe-backup";
const CURRENT_VERSION = "1.0";
const TABLE_NAMES = ["person", "unions", "union_partner", "filiation", "event", "media"] as const;
type TableName = (typeof TABLE_NAMES)[number];

type BackupTables = {
  person: Array<typeof person.$inferSelect>;
  unions: Array<typeof unions.$inferSelect>;
  union_partner: Array<typeof unionPartner.$inferSelect>;
  filiation: Array<typeof filiation.$inferSelect>;
  event: Array<typeof event.$inferSelect>;
  media: Array<typeof media.$inferSelect>;
};

type ArchiveEntry = { path: string; size: number; sha256: string };
type BackupEnvelope = {
  manifest: {
    format: typeof FORMAT;
    version: string;
    createdAt: string;
    tableCounts: Record<TableName, number>;
    mediaFiles: number;
    totalBytes: number;
  };
  entries: ArchiveEntry[];
  files: Record<string, string>;
};

export type BackupValidationReport = {
  valid: true;
  formatVersion: string;
  mediaFiles: number;
  totalBytes: number;
  tableCounts: Record<TableName, number>;
};

function checksum(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function safeArchivePath(path: string): boolean {
  return path === "data/tables.json" || (
    path.startsWith("media/")
    && basename(path) === path.slice("media/".length)
    && !path.includes("..")
    && path.length > "media/".length
  );
}

async function readTables(db: Database): Promise<BackupTables> {
  const [persons, unionRows, partners, filiations, events, mediaRows] = await Promise.all([
    db.select().from(person),
    db.select().from(unions),
    db.select().from(unionPartner),
    db.select().from(filiation),
    db.select().from(event),
    db.select().from(media),
  ]);
  return { person: persons, unions: unionRows, union_partner: partners, filiation: filiations, event: events, media: mediaRows };
}

export async function createBackup(db: Database, uploadDir: string, now = new Date()): Promise<Buffer> {
  const tables = await readTables(db);
  const files: Record<string, string> = {};
  const entries: ArchiveEntry[] = [];
  const tablesContent = Buffer.from(JSON.stringify(tables));
  files["data/tables.json"] = tablesContent.toString("base64");
  entries.push({ path: "data/tables.json", size: tablesContent.length, sha256: checksum(tablesContent) });

  const filenames = new Set<string>();
  for (const row of tables.media) {
    if (!safeArchivePath(`media/${row.filename}`) || filenames.has(row.filename)) {
      throw new Error(`Unsafe or duplicate media filename: ${row.filename}`);
    }
    filenames.add(row.filename);
    const content = await readFile(join(uploadDir, row.filename));
    if (content.length !== row.size) throw new Error(`Media size mismatch: ${row.filename}`);
    const path = `media/${row.filename}`;
    files[path] = content.toString("base64");
    entries.push({ path, size: content.length, sha256: checksum(content) });
  }

  const tableCounts = Object.fromEntries(TABLE_NAMES.map((name) => [name, tables[name].length])) as Record<TableName, number>;
  const totalBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
  const envelope: BackupEnvelope = {
    manifest: { format: FORMAT, version: CURRENT_VERSION, createdAt: now.toISOString(), tableCounts, mediaFiles: filenames.size, totalBytes },
    entries,
    files,
  };
  return Buffer.from(JSON.stringify(envelope));
}

function decodeArchive(archive: Buffer): { envelope: BackupEnvelope; tables: BackupTables } {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(archive.toString("utf8")) as BackupEnvelope;
  } catch {
    throw new Error("Backup archive is truncated or malformed.");
  }
  if (envelope.manifest?.format !== FORMAT) throw new Error("Incompatible backup format.");
  const [majorText, minorText] = envelope.manifest.version.split(".");
  const major = Number(majorText);
  const minor = Number(minorText);
  if (major !== 1 || !Number.isInteger(minor) || minor > 0 || minor < 0) throw new Error("Incompatible or future backup version.");
  if (!Array.isArray(envelope.entries) || !envelope.files || typeof envelope.files !== "object") throw new Error("Incomplete backup archive.");

  const paths = new Set<string>();
  let totalBytes = 0;
  for (const entry of envelope.entries) {
    if (!safeArchivePath(entry.path) || paths.has(entry.path)) throw new Error("Dangerous or duplicate archive path.");
    paths.add(entry.path);
    const encoded = envelope.files[entry.path];
    if (typeof encoded !== "string") throw new Error(`Missing archive entry: ${entry.path}`);
    const content = Buffer.from(encoded, "base64");
    if (content.length !== entry.size || checksum(content) !== entry.sha256) throw new Error(`Checksum or size mismatch: ${entry.path}`);
    totalBytes += content.length;
  }
  if (Object.keys(envelope.files).some((path) => !paths.has(path))) throw new Error("Unmanifested archive entry.");
  if (totalBytes !== envelope.manifest.totalBytes) throw new Error("Archive total size mismatch.");
  const tablesEntry = envelope.files["data/tables.json"];
  if (!tablesEntry) throw new Error("Missing logical database.");
  let tables: BackupTables;
  try {
    tables = JSON.parse(Buffer.from(tablesEntry, "base64").toString("utf8")) as BackupTables;
  } catch {
    throw new Error("Invalid logical database.");
  }
  for (const name of TABLE_NAMES) {
    if (!Array.isArray(tables[name]) || tables[name].length !== envelope.manifest.tableCounts[name]) throw new Error(`Invalid table count: ${name}`);
  }
  const mediaPaths = new Set(envelope.entries.filter((entry) => entry.path.startsWith("media/")).map((entry) => entry.path.slice(6)));
  if (mediaPaths.size !== envelope.manifest.mediaFiles || tables.media.some((row) => !mediaPaths.has(row.filename)) || mediaPaths.size !== tables.media.length) {
    throw new Error("Missing or unreferenced media file.");
  }
  return { envelope, tables };
}

export async function validateBackup(archive: Buffer, options: { availableBytes?: number } = {}): Promise<BackupValidationReport> {
  const { envelope } = decodeArchive(archive);
  if (options.availableBytes !== undefined && envelope.manifest.totalBytes * 2 > options.availableBytes) {
    throw new Error("Insufficient disk space for staging and safety backup.");
  }
  return {
    valid: true,
    formatVersion: envelope.manifest.version,
    mediaFiles: envelope.manifest.mediaFiles,
    totalBytes: envelope.manifest.totalBytes,
    tableCounts: envelope.manifest.tableCounts,
  };
}

type RestoreOptions = {
  safetyDir: string;
  confirm: string;
  availableBytes?: number;
  failpoint?: "after-staging" | "after-media-switch";
};

async function replaceTables(db: Database, tables: BackupTables): Promise<void> {
  await db.delete(media);
  await db.delete(event);
  await db.delete(filiation);
  await db.delete(unionPartner);
  await db.delete(unions);
  await db.delete(person);
  if (tables.person.length) await db.insert(person).values(tables.person);
  if (tables.unions.length) await db.insert(unions).values(tables.unions);
  if (tables.union_partner.length) await db.insert(unionPartner).values(tables.union_partner);
  if (tables.filiation.length) await db.insert(filiation).values(tables.filiation);
  if (tables.event.length) await db.insert(event).values(tables.event);
  if (tables.media.length) await db.insert(media).values(tables.media);
}

export async function restoreBackup(
  db: Database,
  uploadDir: string,
  archive: Buffer,
  options: RestoreOptions,
): Promise<{ safetyBackupPath: string; report: BackupValidationReport }> {
  if (options.confirm !== "REPLACE") throw new Error("Strong replacement confirmation is required.");
  const report = await validateBackup(archive, { availableBytes: options.availableBytes });
  const { envelope, tables } = decodeArchive(archive);
  await mkdir(uploadDir, { recursive: true });
  await mkdir(options.safetyDir, { recursive: true });
  const safety = await createBackup(db, uploadDir);
  const safetyBackupPath = join(options.safetyDir, `testvibe-safety-${Date.now()}-${randomUUID()}.json`);
  await writeFile(safetyBackupPath, safety, { flag: "wx" });

  const parent = dirname(uploadDir);
  const stagingDir = join(parent, `.restore-staging-${randomUUID()}`);
  const rollbackDir = join(parent, `.restore-rollback-${randomUUID()}`);
  await mkdir(stagingDir);
  let switched = false;
  try {
    for (const row of tables.media) {
      await writeFile(join(stagingDir, row.filename), Buffer.from(envelope.files[`media/${row.filename}`], "base64"), { flag: "wx" });
    }
    if (options.failpoint === "after-staging") throw new Error("Restore failpoint after-staging.");
    await db.transaction(async (tx) => {
      await replaceTables(tx as unknown as Database, tables);
      await rename(uploadDir, rollbackDir);
      await rename(stagingDir, uploadDir);
      switched = true;
      if (options.failpoint === "after-media-switch") throw new Error("Restore failpoint after-media-switch.");
    });
    await rm(rollbackDir, { recursive: true, force: true });
    return { safetyBackupPath, report };
  } catch (error) {
    if (switched) {
      await rm(uploadDir, { recursive: true, force: true });
      await rename(rollbackDir, uploadDir);
    }
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}
