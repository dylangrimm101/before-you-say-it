/** Serialize SDK identity writes; reject stale reads/mutations and never fabricate entitlements. */
export function createPurchasesIdentityBoundary<T>(identify: (id: string | null) => Promise<T | null>) {
  let ready = false;
  let generation = 0;
  let queue: Promise<unknown> = Promise.resolve();
  return {
    sync(id: string | null): Promise<T | null> {
      const mine = ++generation;
      ready = false;
      const pending = queue.then(async () => {
        if (mine !== generation) return null;
        const info = await identify(id).catch(() => null);
        if (mine !== generation) return null;
        ready = info !== null;
        return info;
      });
      queue = pending;
      return pending;
    },
    async runVerified<R>(operation: () => Promise<R>): Promise<R> {
      const mine = generation;
      if (!ready) throw new Error("Purchases identity is not verified. Please try again.");
      const pending = queue.then(async () => {
        // A transition requested while waiting invalidates this operation before
        // it can mutate the SDK. Once started, identity writes wait for settlement.
        if (!ready || mine !== generation) throw new Error("Purchases identity changed. Please try again.");
        const result = await operation();
        if (!ready || mine !== generation) throw new Error("Purchases identity changed. Please try again.");
        return result;
      });
      // Rejections belong to the caller, not to the next identity transition.
      queue = pending.catch(() => undefined);
      return pending;
    },
  };
}
