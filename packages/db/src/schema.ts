/**
 * Configuration de connexion SQLite (libSQL) pour Drizzle ORM.
 *
 * Aucun schéma métier n'est défini à ce stade (Phase 0). La table
 * `_health` sert uniquement à valider que le pipeline de migration
 * fonctionne de bout en bout.
 */
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const health = sqliteTable("_health", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull().default("ok"),
  checkedAt: text("checked_at").notNull(),
});
