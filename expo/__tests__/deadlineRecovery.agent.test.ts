import { afterEach, expect, test } from "bun:test";
import { requestBysiGeneration } from "@/lib/ai";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const bounded = <T>(promise: Promise<T>) => Promise.race([
  promise.then(() => "resolved", (error: Error) => error.name),
  new Promise<string>((resolve) => setTimeout(() => resolve("still pending"), 80)),
]);

test("generation deadline includes a stalled response body", async () => {
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_url, init) => {
    signal = init?.signal;
    return new Response(new ReadableStream({ start() {} }));
  }) as typeof fetch;
  expect(await bounded(requestBysiGeneration({ type: "rehearsal_turn" }, 5).then(r => r.json()))).toBe("TimeoutError");
  expect(signal?.aborted).toBe(true);
});

test("generation abort rejects promptly even when transport ignores cancellation", async () => {
  const controller = new AbortController();
  globalThis.fetch = (() => new Promise(() => {})) as typeof fetch;
  const pending = requestBysiGeneration({}, 1000, controller.signal);
  await Promise.resolve();
  controller.abort();
  expect(await bounded(pending)).toBe("AbortError");
});

test("generation keeps Response status, headers and readable JSON after bounded download", async () => {
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_url, init) => {
    signal = init?.signal;
    return new Response(JSON.stringify({ text: "Ready" }), { status: 201, headers: { "x-test": "kept" } });
  }) as typeof fetch;
  const response = await requestBysiGeneration({}, 5);
  expect(response.status).toBe(201);
  expect(response.headers.get("x-test")).toBe("kept");
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(signal?.aborted).toBe(false);
  expect(await response.json()).toEqual({ text: "Ready" });
});
