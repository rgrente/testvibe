import type { Database } from "@testvibe/db";

const queues = new WeakMap<Database, Promise<void>>();
const activeTransactions = new WeakSet<Database>();

/** Serializes local SQLite writers and executes the work in one libSQL transaction. */
export async function runTransaction<T>(
  db: Database,
  work: (tx: Database) => Promise<T>,
): Promise<T> {
  if (activeTransactions.has(db)) return work(db);
  const previous = queues.get(db) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  queues.set(db, previous.then(() => current));
  await previous;
  try {
    return await db.transaction(async (tx) => {
      const transactionalDb = tx as unknown as Database;
      activeTransactions.add(transactionalDb);
      try {
        return await work(transactionalDb);
      } finally {
        activeTransactions.delete(transactionalDb);
      }
    });
  } finally {
    release();
    if (queues.get(db) === current) queues.delete(db);
  }
}
