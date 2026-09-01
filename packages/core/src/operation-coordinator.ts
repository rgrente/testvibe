import { AsyncLocalStorage } from "node:async_hooks";

export type OperationCoordinator = {
  runExclusive<T>(work: () => Promise<T>): Promise<T>;
};

export function createOperationCoordinator(): OperationCoordinator {
  const activeOperation = new AsyncLocalStorage<boolean>();
  let tail = Promise.resolve();

  return {
    async runExclusive<T>(work: () => Promise<T>): Promise<T> {
      if (activeOperation.getStore()) return work();

      const previous = tail;
      let release!: () => void;
      const current = new Promise<void>((resolve) => { release = resolve; });
      tail = previous.then(() => current);
      await previous;
      try {
        return await activeOperation.run(true, work);
      } finally {
        release();
      }
    },
  };
}

export const genealogyOperationCoordinator = createOperationCoordinator();

export function runExclusiveGenealogyOperation<T>(work: () => Promise<T>): Promise<T> {
  return genealogyOperationCoordinator.runExclusive(work);
}
