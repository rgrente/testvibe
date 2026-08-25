import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createDb } from "./index.js";
import { filiation, person, unionPartner, unions } from "./schema.js";

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
