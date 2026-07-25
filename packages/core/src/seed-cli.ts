/**
 * CLI de seed du jeu de données de démonstration (Phase 2, tâche #21).
 * Applique les migrations puis peuple la base locale (DATABASE_URL ou
 * file:./local.db par défaut) avec la famille de démonstration de
 * ./demo.js, pour permettre de valider manuellement la page /arbre.
 *
 * Usage : pnpm --filter @testvibe/core db:seed
 */
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "@testvibe/db";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { seedDemoFamily } from "./demo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(__dirname, "../../db/drizzle");

async function main() {
  const { db, client } = createDb();
  await migrate(db, { migrationsFolder });
  const { rootId } = await seedDemoFamily(db);
  console.log(`Jeu de données de démonstration créé. Person racine recommandée : id=${rootId}`);
  await client.close();
}

main().catch((err) => {
  console.error("Échec du seed de démonstration :", err);
  process.exit(1);
});
