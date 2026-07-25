/**
 * Fixture de test partagée : instancie une base SQLite en mémoire,
 * applique les migrations Drizzle du monorepo, et fournit un client
 * `Database` prêt à l'emploi pour les tests CRUD de packages/core.
 */
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb, type Database } from "@testvibe/db";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Migrations définies une seule fois dans packages/db/drizzle.
const migrationsFolder = resolve(__dirname, "../../db/drizzle");

export async function createTestDb(): Promise<Database> {
  // Chaque appel instancie une base SQLite en mémoire indépendante
  // (aucun paramètre de partage/cache requis : un process Node par
  // test suffit à garantir l'isolation).
  const { db } = createDb(":memory:");
  await migrate(db, { migrationsFolder });
  return db;
}
