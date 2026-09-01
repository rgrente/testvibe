/**
 * Fixture de test partagée : instancie une base SQLite en mémoire,
 * applique les migrations Drizzle du monorepo, et fournit un client
 * `Database` prêt à l'emploi pour les tests CRUD de packages/core.
 */
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  createDb,
  event,
  filiation,
  person,
  unionPartner,
  unions,
  type Database,
} from "@testvibe/db";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { afterAll } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Migrations définies une seule fois dans packages/db/drizzle.
const migrationsFolder = resolve(__dirname, "../../db/drizzle");
const temporaryDatabases: Array<{ path: string; close: () => void }> = [];

afterAll(async () => {
  await Promise.all(temporaryDatabases.splice(0).map(async ({ path, close }) => {
    close();
    await rm(path, { force: true });
  }));
});

export async function createTestDb(): Promise<Database> {
  // Les transactions libSQL peuvent ouvrir une connexion distincte : un fichier
  // temporaire garantit que toutes les connexions voient le même état.
  const path = resolve(tmpdir(), `testvibe-core-${randomUUID()}.db`);
  const { db, client } = createDb(`file:${path}`);
  temporaryDatabases.push({ path, close: () => client.close() });
  await migrate(db, { migrationsFolder });
  return db;
}

/** Stable, complete snapshot of every table touched by genealogy writes. */
export async function genealogyState(db: Database) {
  const [persons, events, unionRows, partners, filiations] = await Promise.all([
    db.select().from(person),
    db.select().from(event),
    db.select().from(unions),
    db.select().from(unionPartner),
    db.select().from(filiation),
  ]);
  return {
    persons: persons.sort((a, b) => a.id - b.id),
    events: events.sort((a, b) => a.id - b.id),
    unions: unionRows.sort((a, b) => a.id - b.id),
    partners: partners.sort((a, b) => a.unionId - b.unionId || a.personId - b.personId),
    filiations: filiations.sort((a, b) => a.id - b.id),
  };
}
