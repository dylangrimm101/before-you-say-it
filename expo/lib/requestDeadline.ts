/** Bounds the whole operation, including body reads on transports that ignore abort. */
export async function withRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let rejectDeadline!: (error: Error) => void;
  const cancelled = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
  const cancel = (name: string, message: string): void => {
    const error = new Error(message);
    error.name = name;
    rejectDeadline(error);
    controller.abort();
  };
  const onAbort = (): void => cancel("AbortError", "Request aborted");
  const timeout = setTimeout(() => cancel("TimeoutError", "Request aborted: deadline exceeded"), timeoutMs);
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    if (signal?.aborted) onAbort();
    return await Promise.race([
      cancelled,
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error("Request aborted");
        return operation(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}
