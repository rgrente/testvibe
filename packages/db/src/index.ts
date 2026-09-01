/**
 * Client Drizzle ORM connecté à une base SQLite locale (libSQL).
 *
 * `createDb` est une factory réutilisable : elle permet de créer des
 * instances isolées (ex. base en mémoire `file::memory:` pour les
 * tests unitaires de `@testvibe/core`) sans dépendre du fichier
 * `local.db` partagé par l'application. Le client par défaut exporté
 * (`db`/`client`) reste basé sur `DATABASE_URL` (ou `file:./local.db`)
 * pour compatibilité avec les scripts existants (`pnpm db:migrate`).
 */
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

export type Database = LibSQLDatabase<typeof schema>;

export function createDb(url?: string): { db: Database; client: Client } {
  const resolvedUrl = url ?? process.env.DATABASE_URL ?? "file:./local.db";
  const client = createClient({ url: resolvedUrl });
  const db = drizzle(client, { schema });
  return { db, client };
}
const defaultInstance = createDb();

export const client = defaultInstance.client;
export const db = defaultInstance.db;

export * from "./schema.js";
export * from "./migration-backup.js";
export * from "./genealogy-audit.js";
