/**
 * Configuration de connexion SQLite (libSQL) pour Drizzle ORM.
 *
 * Phase 1 (tâche #20) ajoute le modèle de domaine généalogique pur :
 * `person`, `unions` (unions/couples) + `union_partner` (table de
 * jonction personnes <-> union), et `filiation` (lien parent/enfant
 * avec un rôle biologique/adopté/beau-parent).
 */
import { sqliteTable, integer, text, primaryKey } from "drizzle-orm/sqlite-core";

export const health = sqliteTable("_health", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull().default("ok"),
  checkedAt: text("checked_at").notNull(),
});

export const person = sqliteTable("person", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  birthDate: text("birth_date"),
  deathDate: text("death_date"),
  gender: text("gender"),
});

// Nommée "unions" (et non "union", mot réservé SQL) pour éviter toute
// ambiguïté de parsing selon les dialectes/outils.
export const unions = sqliteTable("unions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startDate: text("start_date"),
  endDate: text("end_date"),
});

// Table de jonction : personnes appartenant à une union (typiquement 2,
// mais le modèle reste ouvert à N personnes liées).
export const unionPartner = sqliteTable(
  "union_partner",
  {
    unionId: integer("union_id")
      .notNull()
      .references(() => unions.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.unionId, table.personId] }),
  }),
);

export const filiation = sqliteTable("filiation", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parentId: integer("parent_id")
    .notNull()
    .references(() => person.id, { onDelete: "cascade" }),
  childId: integer("child_id")
    .notNull()
    .references(() => person.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["biologique", "adopte", "beau-parent"] }).notNull(),
});
