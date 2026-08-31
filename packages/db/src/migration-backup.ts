import { cp, mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";

export interface MigrationStatePaths {
  /** Path to a closed SQLite database file. */
  databasePath: string;
  /** Path to the uploads directory while no media writes are running. */
  uploadsPath: string;
  /** New directory that will contain the immutable restoration copies. */
  backupPath: string;
}

const DATABASE_COPY = "database.sqlite";
const UPLOADS_COPY = "uploads";

/**
 * Copies the closed SQLite database and uploads into a new backup directory.
 * Existing backup directories are never overwritten.
 */
export async function backupMigrationState(paths: MigrationStatePaths): Promise<void> {
  let created = false;
  try {
    await mkdir(paths.backupPath);
    created = true;
    await cp(paths.databasePath, resolve(paths.backupPath, DATABASE_COPY), {
      errorOnExist: true,
      force: false,
    });
    await cp(paths.uploadsPath, resolve(paths.backupPath, UPLOADS_COPY), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  } catch (error) {
    if (created) await rm(paths.backupPath, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Replaces the database and uploads with their backup copies. Database clients
 * and media writers must be stopped before restoration.
 */
export async function restoreMigrationState(paths: MigrationStatePaths): Promise<void> {
  const stagedDatabase = `${paths.databasePath}.restoring`;
  const stagedUploads = `${paths.uploadsPath}.restoring`;
  await rm(stagedDatabase, { force: true });
  await rm(stagedUploads, { recursive: true, force: true });

  try {
    await cp(resolve(paths.backupPath, DATABASE_COPY), stagedDatabase, {
      errorOnExist: true,
      force: false,
    });
    await cp(resolve(paths.backupPath, UPLOADS_COPY), stagedUploads, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    await rm(paths.databasePath, { force: true });
    await rm(paths.uploadsPath, { recursive: true, force: true });
    await rename(stagedDatabase, paths.databasePath);
    await rename(stagedUploads, paths.uploadsPath);
  } finally {
    await rm(stagedDatabase, { force: true });
    await rm(stagedUploads, { recursive: true, force: true });
  }
}
