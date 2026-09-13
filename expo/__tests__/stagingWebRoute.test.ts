import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
test("actual staging route renders the auth-bound result and clears on account changes (synthetic hosts)", () => {
  const run = spawnSync(process.execPath, [`${import.meta.dir}/stagingWebRoute.fixture.ts`], { cwd: `${import.meta.dir}/..`, encoding: "utf8" });
  expect(run.status, run.stderr).toBe(0);
  expect(run.stdout).toContain("Synthetic route rendering and controller cleanup verified");
});
