import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createDb } from "./index.js";
import { backupMigrationState, restoreMigrationState } from "./migration-backup.js";
import { adminSession, filiation, loginRateLimit, person, unionPartner, unions } from "./schema.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsFolder = resolve(packageRoot, "drizzle");
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), "testvibe-db-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true,
  })));
});

describe("SQLite/libSQL integration", () => {
  it("supports file access, CRUD, batches, transactions, rollbacks and cascades", async () => {
    const directory = await temporaryDirectory();
    const { db, client } = createDb(`file:${resolve(directory, "integration.db")}`);

    try {
      await migrate(db, { migrationsFolder });
      await db.run(sql`pragma foreign_keys = on`);

      const [parent, child] = await db.batch([
        db.insert(person).values({ firstName: "Ada", lastName: "Lovelace" }).returning(),
        db.insert(person).values({ firstName: "Byron", lastName: "King" }).returning(),
      ]);
      expect(parent[0]?.id).toBeTypeOf("number");
      expect(child[0]?.id).toBeTypeOf("number");

      await db.transaction(async (tx) => {
        const [family] = await tx.insert(unions).values({ type: "mariage" }).returning();
        await tx.insert(unionPartner).values([
          { unionId: family.id, personId: parent[0]!.id },
          { unionId: family.id, personId: child[0]!.id },
        ]);
        await tx.insert(filiation).values({
          parentId: parent[0]!.id,
          childId: child[0]!.id,
          role: "biologique",
        });
      });

      await expect(db.transaction(async (tx) => {
        await tx.insert(person).values({ firstName: "Should", lastName: "Rollback" });
        throw new Error("rollback requested");
      })).rejects.toThrow("rollback requested");
      expect(await db.select().from(person).where(eq(person.firstName, "Should"))).toHaveLength(0);

      await db.update(person).set({ birthName: "Byron" }).where(eq(person.id, child[0]!.id));
      expect((await db.select().from(person).where(eq(person.id, child[0]!.id)))[0]?.birthName)
        .toBe("Byron");

      await db.delete(person).where(eq(person.id, parent[0]!.id));
      expect(await db.select().from(filiation)).toHaveLength(0);
      expect(await db.select().from(unionPartner).where(eq(unionPartner.personId, parent[0]!.id)))
        .toHaveLength(0);
    } finally {
      client.close();
    }
  });

  it("opens and re-migrates a copied existing database without losing data", async () => {
    const directory = await temporaryDirectory();
    const originalPath = resolve(directory, "original.db");
    const copiedPath = resolve(directory, "copied.db");
    const original = createDb(`file:${originalPath}`);

    await migrate(original.db, { migrationsFolder });
    await original.db.insert(person).values({ firstName: "Existing", lastName: "Record" });
    original.client.close();
    await cp(originalPath, copiedPath);

    const copied = createDb(`file:${copiedPath}`);
    try {
      await migrate(copied.db, { migrationsFolder });
      expect(await copied.db.select().from(person)).toMatchObject([
        { firstName: "Existing", lastName: "Record" },
      ]);
    } finally {
      copied.client.close();
    }
  });

  it("migrates and rolls back admin security tables without changing genealogy data", async () => {
    const directory = await temporaryDirectory();
    const preSecurityMigrations = resolve(directory, "migrations-0005");
    await cp(migrationsFolder, preSecurityMigrations, { recursive: true });
    await rm(resolve(preSecurityMigrations, "0006_violet_mikhail_rasputin.sql"));
    await rm(resolve(preSecurityMigrations, "meta/0006_snapshot.json"));
    const journalPath = resolve(preSecurityMigrations, "meta/_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
      entries: Array<{ idx: number }>;
    };
    journal.entries = journal.entries.filter(({ idx }) => idx <= 5);
    await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    const instance = createDb(`file:${resolve(directory, "security.db")}`);

    try {
      await migrate(instance.db, { migrationsFolder: preSecurityMigrations });
      await instance.client.execute("insert into person (first_name, last_name) values ('Existing', 'Record')");
      const before = await instance.client.execute(
        "select name from sqlite_master where type = 'table' and name in ('admin_session', 'login_rate_limit')",
      );
      expect(before.rows).toHaveLength(0);

      await migrate(instance.db, { migrationsFolder });
      await instance.db.insert(adminSession).values({
        tokenHash: "opaque-token-hash",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        createdAt: new Date().toISOString(),
      });
      await instance.db.insert(loginRateLimit).values({
        fingerprint: "client-hmac",
        failures: 1,
        windowStartedAt: new Date().toISOString(),
      });
      const upgraded = await instance.client.execute(
        "select name from sqlite_master where type = 'table' and name in ('admin_session', 'login_rate_limit')",
      );
      expect(upgraded.rows).toHaveLength(2);

      const rollback = await readFile(resolve(packageRoot, "drizzle/rollback/0006_admin_security.sql"), "utf8");
      for (const statement of rollback.split(";")) {
        if (statement.trim()) await instance.db.run(sql.raw(statement));
      }

      expect((await instance.client.execute("select first_name, last_name from person")).rows).toMatchObject([
        { first_name: "Existing", last_name: "Record" },
      ]);
      const tables = await instance.client.execute(
        "select name from sqlite_master where type = 'table' and name in ('admin_session', 'login_rate_limit')",
      );
      expect(tables.rows).toHaveLength(0);
    } finally {
      instance.client.close();
    }
  });

  it("migrates and rolls back privacy columns without losing existing records", async () => {
    const directory = await temporaryDirectory();
    const prePrivacyMigrations = resolve(directory, "migrations-0006");
    await cp(migrationsFolder, prePrivacyMigrations, { recursive: true });
    await rm(resolve(prePrivacyMigrations, "0007_nostalgic_pride.sql"));
    await rm(resolve(prePrivacyMigrations, "meta/0007_snapshot.json"));
    const journalPath = resolve(prePrivacyMigrations, "meta/_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as { entries: Array<{ idx: number }> };
    journal.entries = journal.entries.filter(({ idx }) => idx <= 6);
    await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    const instance = createDb(`file:${resolve(directory, "privacy.db")}`);

    try {
      await migrate(instance.db, { migrationsFolder: prePrivacyMigrations });
      await instance.client.execute("insert into person (first_name, last_name) values ('Existing', 'Record')");
      await instance.client.execute("insert into event (person_id, type) values (1, 'libre')");
      await instance.client.execute("insert into media (person_id, filename, original_name, mime_type, size, created_at) values (1, 'fixture.pdf', 'fixture.pdf', 'application/pdf', 10, '2026-08-31')");
      await migrate(instance.db, { migrationsFolder });
      const upgraded = await instance.client.execute("select first_name, living_status, visibility from person");
      expect(upgraded.rows).toMatchObject([{ first_name: "Existing", living_status: null, visibility: "public" }]);
      expect((await instance.client.execute("select count(*) as count from event")).rows[0]?.count).toBe(1);
      expect((await instance.client.execute("select count(*) as count from media")).rows[0]?.count).toBe(1);

      const rollback = await readFile(resolve(packageRoot, "drizzle/rollback/0007_living_privacy.sql"), "utf8");
      for (const statement of rollback.split(";")) {
        if (statement.trim()) await instance.db.run(sql.raw(statement));
      }
      const restored = await instance.client.execute("select first_name, last_name from person");
      expect(restored.rows).toMatchObject([{ first_name: "Existing", last_name: "Record" }]);
      const columns = await instance.client.execute("pragma table_info(person)");
      expect(columns.rows.map((row) => row.name)).not.toContain("visibility");
    } finally {
      instance.client.close();
    }
  });

  it("backfills person visibility idempotently, defaults future rows to public, and rolls back the default", async () => {
    const directory = await temporaryDirectory();
    const preDefaultMigrations = resolve(directory, "migrations-0007");
    await cp(migrationsFolder, preDefaultMigrations, { recursive: true });
    await rm(resolve(preDefaultMigrations, "0008_clever_swordsman.sql"));
    await rm(resolve(preDefaultMigrations, "meta/0008_snapshot.json"));
    const journalPath = resolve(preDefaultMigrations, "meta/_journal.json");
    const journal = JSON.parse(await readFile(journalPath, "utf8")) as { entries: Array<{ idx: number }> };
    journal.entries = journal.entries.filter(({ idx }) => idx <= 7);
    await writeFile(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    const instance = createDb(`file:${resolve(directory, "person-default.db")}`);
    try {
      await migrate(instance.db, { migrationsFolder: preDefaultMigrations });
      await instance.client.execute("insert into person (first_name, last_name, visibility) values ('Existing', 'Null', NULL), ('Explicit', 'Family', 'family'), ('Explicit', 'Private', 'private')");
      await migrate(instance.db, { migrationsFolder });
      await migrate(instance.db, { migrationsFolder });
      await instance.client.execute("insert into person (first_name, last_name) values ('Future', 'Record')");
      const upgraded = await instance.client.execute("select first_name, last_name, visibility from person order by id");
      expect(upgraded.rows).toMatchObject([
        { first_name: "Existing", last_name: "Null", visibility: "public" },
        { first_name: "Explicit", last_name: "Family", visibility: "family" },
        { first_name: "Explicit", last_name: "Private", visibility: "private" },
        { first_name: "Future", last_name: "Record", visibility: "public" },
      ]);

      const rollback = await readFile(resolve(packageRoot, "drizzle/rollback/0008_public_person_visibility.sql"), "utf8");
      for (const statement of rollback.split(";")) {
        if (statement.trim()) await instance.db.run(sql.raw(statement));
      }
      const columns = await instance.client.execute("pragma table_info(person)");
      expect(columns.rows.find((row) => row.name === "visibility")?.dflt_value).toBeNull();
      expect((await instance.client.execute("select visibility from person order by id")).rows)
        .toMatchObject([{ visibility: "public" }, { visibility: "family" }, { visibility: "private" }, { visibility: "public" }]);
    } finally {
      instance.client.close();
    }
  });

  it("restores database records and upload bytes from a migration backup", async () => {
    const directory = await temporaryDirectory();
    const databasePath = resolve(directory, "privacy.db");
    const uploadsPath = resolve(directory, "uploads");
    const backupPath = resolve(directory, "backup");
    const fixtureBytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
    await mkdir(uploadsPath);
    await writeFile(resolve(uploadsPath, "fixture.bin"), fixtureBytes);

    const before = createDb(`file:${databasePath}`);
    await migrate(before.db, { migrationsFolder });
    await before.db.insert(person).values({ firstName: "Backup", lastName: "Fixture" });
    before.client.close();

    await backupMigrationState({ databasePath, uploadsPath, backupPath });

    const changed = createDb(`file:${databasePath}`);
    await changed.db.delete(person);
    changed.client.close();
    await writeFile(resolve(uploadsPath, "fixture.bin"), new Uint8Array([9, 9, 9]));
    await writeFile(resolve(uploadsPath, "unexpected.bin"), new Uint8Array([8]));

    await restoreMigrationState({ databasePath, uploadsPath, backupPath });

    const restored = createDb(`file:${databasePath}`);
    try {
      expect(await restored.db.select().from(person)).toMatchObject([
        { firstName: "Backup", lastName: "Fixture" },
      ]);
      expect(await readFile(resolve(uploadsPath, "fixture.bin"))).toEqual(Buffer.from(fixtureBytes));
      await expect(readFile(resolve(uploadsPath, "unexpected.bin"))).rejects.toThrow();
    } finally {
      restored.client.close();
    }
  });

  it("generates no migration for the unchanged schema", async () => {
    const before = await migrationContents();
    const executable = resolve(packageRoot, "node_modules/.bin/drizzle-kit");
    const output = execFileSync(executable, ["generate"], {
      cwd: packageRoot,
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: ":memory:" },
    });

    expect(output).toContain("No schema changes, nothing to migrate");
    expect(await migrationContents()).toEqual(before);
  });
});

async function migrationContents(): Promise<Record<string, string>> {
  const files = (await readdir(migrationsFolder, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name))
    .sort();
  return Object.fromEntries(await Promise.all(files.map(async (file) => [
    file.slice(migrationsFolder.length + 1),
    await readFile(file, "utf8"),
  ])));
}
