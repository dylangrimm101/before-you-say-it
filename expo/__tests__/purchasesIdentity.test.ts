import { expect, test } from "bun:test";
import * as boundary from "../lib/purchasesIdentity";

test("late A cannot overwrite B, SDK identity transitions are serialized", async () => {
  let finishA!: (value: { owner: string }) => void;
  const calls: (string | null)[] = [];
  const identity = boundary.createPurchasesIdentityBoundary(async (id: string | null) => {
    calls.push(id);
    return id === "a" ? new Promise<{ owner: string }>((resolve) => { finishA = resolve; }) : { owner: "b" };
  });
  const a = identity.sync("a");
  await Promise.resolve();
  const b = identity.sync("b");
  await Promise.resolve();
  expect(calls).toEqual(["a"]);
  finishA({ owner: "a" });
  expect(await a).toBeNull();
  expect(await b).toEqual({ owner: "b" });
});

test("an old customer-info read cannot publish after an identity transition", async () => {
  const identity = boundary.createPurchasesIdentityBoundary(async () => ({ pro: true }));
  await identity.sync("a");
  let finish!: (value: string) => void;
  const oldRead = identity.runVerified(() => new Promise<string>((resolve) => { finish = resolve; }));
  await Promise.resolve();
  const changing = identity.sync("b");
  finish("old-a-pro");
  await expect(oldRead).rejects.toThrow("identity");
  await changing;
});

for (const mutation of ["purchase", "restore"]) {
  test(`${mutation} side effects finish under the verified owner before identity changes`, async () => {
    let sdkOwner: string | null = null;
    const events: string[] = [];
    const identity = boundary.createPurchasesIdentityBoundary(async (id) => {
      sdkOwner = id;
      events.push(`identity:${id}`);
      return { owner: id };
    });
    await identity.sync("a");
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const began = new Promise<void>((resolve) => { started = resolve; });
    const pending = identity.runVerified(async () => {
      started();
      await gate;
      events.push(`${mutation}:${sdkOwner}`);
    });
    const settled = pending.then(() => null, (error: Error) => error);
    await began;
    const changing = identity.sync("b");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const whilePending = [...events];
    release();
    const result = await settled;
    await changing;
    expect(whilePending).toEqual(["identity:a"]);
    expect(events).toEqual(["identity:a", `${mutation}:a`, "identity:b"]);
    expect(result?.message).toContain("identity changed");
  });
}

test("queued mutations invalidated by a transition never start and cannot poison identity sync", async () => {
  const identity = boundary.createPurchasesIdentityBoundary(async (id) => ({ owner: id }));
  await identity.sync("a");
  let release!: () => void;
  const first = identity.runVerified(() => new Promise<void>((resolve) => { release = resolve; }));
  const firstSettled = first.catch((error: Error) => error);
  await Promise.resolve();
  let called = false;
  const queued = identity.runVerified(async () => { called = true; });
  const queuedSettled = queued.catch((error: Error) => error);
  const changing = identity.sync("b");
  release();
  expect(await firstSettled).toBeInstanceOf(Error);
  expect(await queuedSettled).toBeInstanceOf(Error);
  expect(called).toBe(false);
  expect(await changing).toEqual({ owner: "b" });
  await expect(identity.runVerified(async () => { throw new Error("SDK failed"); })).rejects.toThrow("SDK failed");
  expect(await identity.sync("c")).toEqual({ owner: "c" });
  expect(await identity.runVerified(async () => "usable")).toBe("usable");
});

test("all customer-info sources pass through the identity boundary", async () => {
  const source = await Bun.file(`${import.meta.dir}/../lib/purchases.ts`).text();
  expect(source).toContain("createPurchasesIdentityBoundary<CustomerInfo>");
  expect(source).toContain("purchasesIdentity.runVerified(() => requireSdk().getCustomerInfo())");
  expect(source).toContain("purchasesIdentity.runVerified(async () => {");
  expect(source).toContain("return requireSdk().purchasePackage(pkg);");
  expect(source).toContain("purchasesIdentity.runVerified(() => requireSdk().restorePurchases())");
});

test("failed identity sync invalidates old Pro and blocks SDK reads", async () => {
  expect(typeof boundary.createPurchasesIdentityBoundary).toBe("function");
  const identity = boundary.createPurchasesIdentityBoundary(async (id: string | null) => id === "a" ? { pro: true } : null);
  expect(await identity.sync("a")).toEqual({ pro: true });
  expect(await identity.sync("b")).toBeNull();
  await expect(identity.runVerified(async () => ({ pro: true }))).rejects.toThrow("identity");
});
