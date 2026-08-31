/**
 * Exécute les migrations Drizzle sur la base SQLite locale.
 * Valide le pipeline de migration même en l'absence de schéma métier.
 */
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, client } from "./index.js";
import { assertGenealogyIntegrity } from "./genealogy-audit.js";

async function main() {
  const tables = await client.execute("select name from sqlite_master where type = 'table' and name = 'filiation'");
  if (tables.rows.length > 0) await assertGenealogyIntegrity(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations appliquées avec succès.");
  await client.close();
}

main().catch((err) => {
  console.error("Échec de la migration :", err);
  process.exit(1);
});
