/**
 * Exécute les migrations Drizzle sur la base SQLite locale.
 * Valide le pipeline de migration même en l'absence de schéma métier.
 */
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, client } from "./index.js";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations appliquées avec succès.");
  await client.close();
}

main().catch((err) => {
  console.error("Échec de la migration :", err);
  process.exit(1);
});
