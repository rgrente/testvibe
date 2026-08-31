/**
 * Configuration de connexion SQLite (libSQL) pour Drizzle ORM.
 *
 * Phase 1 (tâche #20) ajoute le modèle de domaine généalogique pur :
 * `person`, `unions` (unions/couples) + `union_partner` (table de
 * jonction personnes <-> union), et `filiation` (lien parent/enfant
 * avec un rôle biologique/adopté/beau-parent).
 */
import { sqliteTable, integer, text, real, primaryKey } from "drizzle-orm/sqlite-core";

export const health = sqliteTable("_health", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull().default("ok"),
  checkedAt: text("checked_at").notNull(),
});

export const person = sqliteTable("person", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  birthName: text("birth_name"),
  birthDate: text("birth_date"),
  deathDate: text("death_date"),
  gender: text("gender"),
});

// Nommée "unions" (et non "union", mot réservé SQL) pour éviter toute
// ambiguïté de parsing selon les dialectes/outils.
export const unions = sqliteTable("unions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["mariage", "pacs", "libre"] }).notNull().default("libre"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  place: text("place"),
  latitude: real("latitude"),
  longitude: real("longitude"),
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

/**
 * Événements biographiques liés à une Person (optionnel : unionId si
 * l'événement est un mariage ou événement familial).
 * Types : "naissance" | "décès" | "mariage" | "résidence" | "libre"
 */
export const event = sqliteTable("event", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id")
    .notNull()
    .references(() => person.id, { onDelete: "cascade" }),
  unionId: integer("union_id").references(() => unions.id, { onDelete: "set null" }),
  type: text("type", { enum: ["naissance", "décès", "mariage", "résidence", "libre"] }).notNull(),
  label: text("label"),
  eventDate: text("event_date"),
  description: text("description"),
  place: text("place"),
  latitude: real("latitude"),
  longitude: real("longitude"),
});

/**
 * Médias (photos, documents) associés à une Person ou un Event.
 * Le fichier est stocké sur le système de fichiers local.
 */
export const media = sqliteTable("media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personId: integer("person_id").references(() => person.id, { onDelete: "cascade" }),
  eventId: integer("event_id").references(() => event.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
});

export const adminSession = sqliteTable("admin_session", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  revokedAt: text("revoked_at"),
});

export const loginRateLimit = sqliteTable("login_rate_limit", {
  fingerprint: text("fingerprint").primaryKey(),
  failures: integer("failures").notNull(),
  windowStartedAt: text("window_started_at").notNull(),
});
