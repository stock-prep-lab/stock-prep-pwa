export async function mapWithConcurrency<T, R>({
  concurrency,
  items,
  mapper,
}: {
  concurrency: number;
  items: readonly T[];
  mapper: (item: T, index: number) => Promise<R>;
}): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("concurrency must be a positive integer");
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex]!, currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

export async function forEachWithConcurrency<T>({
  concurrency,
  items,
  worker,
}: {
  concurrency: number;
  items: readonly T[];
  worker: (item: T, index: number) => Promise<void>;
}): Promise<void> {
  await mapWithConcurrency({
    concurrency,
    items,
    mapper: async (item, index) => {
      await worker(item, index);
      return undefined;
    },
  });
}
