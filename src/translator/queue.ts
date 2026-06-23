export interface QueueOptions<T, R> {
  items: readonly T[];
  concurrency: number;
  signal: AbortSignal;
  worker: (item: T, index: number) => Promise<R>;
  onResult?: (result: R, item: T, index: number) => void;
  onProgress?: (completed: number, total: number) => void;
}

export async function runConcurrentQueue<T, R>({
  items,
  concurrency,
  signal,
  worker,
  onResult,
  onProgress,
}: QueueOptions<T, R>): Promise<void> {
  let cursor = 0;
  let completed = 0;

  async function consume(): Promise<void> {
    while (cursor < items.length) {
      if (signal.aborted) throw new DOMException('翻译已停止', 'AbortError');
      const index = cursor++;
      const item = items[index];
      if (item === undefined) return;
      const result = await worker(item, index);
      onResult?.(result, item, index);
      completed += 1;
      onProgress?.(completed, items.length);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => consume()));
}
