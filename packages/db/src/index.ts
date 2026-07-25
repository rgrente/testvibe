/**
 * Client Drizzle ORM connecté à une base SQLite locale (libSQL).
 *
 * L'URL de la base est lue depuis DATABASE_URL, avec un chemin de
 * fichier local par défaut adapté au développement.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL ?? "file:./local.db";

export const client = createClient({ url });

export const db = drizzle(client, { schema });

export * from "./schema.js";
