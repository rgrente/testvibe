import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, statfs, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  db as defaultDb,
  event,
  filiation,
  media,
  person,
  unionPartner,
  unions,
  type Database,
} from "@testvibe/db";

const FORMAT = "testvibe-backup";
const CURRENT_MAJOR = 1;
const CURRENT_MINOR = 1;
const CURRENT_VERSION = `${CURRENT_MAJOR}.${CURRENT_MINOR}`;
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

function validateLogicalDatabase(tables: BackupTables): void {
  const raw = tables as unknown as Record<TableName, Array<Record<string, unknown>>>;
  const validId = (value: unknown) => Number.isInteger(value) && Number(value) > 0;
  const unique = (values: unknown[]) => new Set(values).size === values.length;
  const visibility = (value: unknown) => value == null || ["public", "family", "private"].includes(String(value));
  const idTables = ["person", "unions", "filiation", "event", "media"] as const;
  if (idTables.some((name) => raw[name].some((row) => !row || !validId(row.id)) || !unique(raw[name].map((row) => row.id)))) {
    throw new Error("Invalid logical database: duplicate or invalid identifier.");
  }

  const personIds = new Set(raw.person.map((row) => row.id));
  const unionIds = new Set(raw.unions.map((row) => row.id));
  const eventIds = new Set(raw.event.map((row) => row.id));
  if (raw.person.some((row) => typeof row.firstName !== "string" || typeof row.lastName !== "string" || !visibility(row.visibility))) {
    throw new Error("Invalid logical database: invalid person.");
  }
  if (raw.unions.some((row) => !["mariage", "pacs", "libre"].includes(String(row.type)))) {
    throw new Error("Invalid logical database: invalid union.");
  }

  const partnerKeys = raw.union_partner.map((row) => `${String(row.unionId)}:${String(row.personId)}`);
  if (
    !unique(partnerKeys)
    || raw.union_partner.some((row) => !unionIds.has(row.unionId) || !personIds.has(row.personId))
  ) throw new Error("Invalid logical database: invalid union partner.");

  const filiationKeys = raw.filiation.map((row) => `${String(row.parentId)}:${String(row.childId)}`);
  if (
    !unique(filiationKeys)
    || raw.filiation.some((row) => (
      !personIds.has(row.parentId)
      || !personIds.has(row.childId)
      || row.parentId === row.childId
      || !["biologique", "adopte", "beau-parent"].includes(String(row.role))
    ))
  ) throw new Error("Invalid logical database: invalid filiation.");

  if (raw.event.some((row) => (
    !personIds.has(row.personId)
    || (row.unionId != null && !unionIds.has(row.unionId))
    || !["naissance", "décès", "mariage", "résidence", "libre"].includes(String(row.type))
    || !visibility(row.visibility)
  ))) throw new Error("Invalid logical database: invalid event.");

  if (raw.media.some((row) => {
    const attachedToPerson = row.personId != null;
    const attachedToEvent = row.eventId != null;
    return (
      attachedToPerson === attachedToEvent
      || (attachedToPerson && !personIds.has(row.personId))
      || (attachedToEvent && !eventIds.has(row.eventId))
      || typeof row.filename !== "string"
      || typeof row.originalName !== "string"
      || typeof row.mimeType !== "string"
      || !Number.isInteger(row.size)
      || Number(row.size) < 0
      || typeof row.createdAt !== "string"
      || !visibility(row.visibility)
    );
  })) throw new Error("Invalid logical database: invalid media.");
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
  if (!/^\d+\.\d+$/.test(envelope.manifest.version)) throw new Error("Incompatible backup version.");
  const [majorText, minorText] = envelope.manifest.version.split(".");
  const major = Number(majorText);
  const minor = Number(minorText);
  if (major !== CURRENT_MAJOR || !Number.isInteger(minor) || minor > CURRENT_MINOR || minor < 0) throw new Error("Incompatible or future backup version.");
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
  validateLogicalDatabase(tables);
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
  failpoint?: "after-staging" | "after-current-media-moved" | "after-media-switch";
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
  let currentMediaMoved = false;
  let newMediaInstalled = false;
  try {
    for (const row of tables.media) {
      await writeFile(join(stagingDir, row.filename), Buffer.from(envelope.files[`media/${row.filename}`], "base64"), { flag: "wx" });
    }
    if (options.failpoint === "after-staging") throw new Error("Restore failpoint after-staging.");
    await db.transaction(async (tx) => {
      await replaceTables(tx as unknown as Database, tables);
      await rename(uploadDir, rollbackDir);
      currentMediaMoved = true;
      if (options.failpoint === "after-current-media-moved") throw new Error("Restore failpoint after-current-media-moved.");
      await rename(stagingDir, uploadDir);
      newMediaInstalled = true;
      if (options.failpoint === "after-media-switch") throw new Error("Restore failpoint after-media-switch.");
    });
    await rm(rollbackDir, { recursive: true, force: true });
    return { safetyBackupPath, report };
  } catch (error) {
    if (currentMediaMoved) {
      if (newMediaInstalled) await rm(uploadDir, { recursive: true, force: true });
      await rename(rollbackDir, uploadDir);
    }
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

type AdminRestoreOptions = {
  mode: "validate" | "replace";
  confirm?: string;
};

function configuredBackupPaths() {
  const uploadDir = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");
  const safetyDir = process.env.BACKUP_DIR ?? join(process.cwd(), "backups");
  return { uploadDir, safetyDir };
}

export const backupFileOps = {
  async availableBytes(path: string): Promise<number> {
    const stats = await statfs(path);
    return Number(stats.bavail) * Number(stats.bsize);
  },
};

export async function adminCreateBackup(): Promise<Buffer> {
  const { uploadDir } = configuredBackupPaths();
  return createBackup(defaultDb, uploadDir);
}

export async function adminRestoreBackup(
  archive: Buffer,
  options: AdminRestoreOptions,
): Promise<BackupValidationReport | Awaited<ReturnType<typeof restoreBackup>>> {
  const { uploadDir, safetyDir } = configuredBackupPaths();
  const availableBytes = await backupFileOps.availableBytes(dirname(uploadDir));
  if (options.mode === "validate") return validateBackup(archive, { availableBytes });
  return restoreBackup(defaultDb, uploadDir, archive, {
    safetyDir,
    confirm: options.confirm ?? "",
    availableBytes,
  });
}
