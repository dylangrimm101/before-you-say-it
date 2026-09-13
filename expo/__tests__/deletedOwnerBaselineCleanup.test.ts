import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

for (const scenario of [
  "malformed-global-preserves",
  "malformed-owner-key-durable",
  "foreign-pending-preserves",
  "foreign-reference-removed-retry-preserves",
  "malformed-own-reference-retry",
  "malformed-pending-prefix-blocks",
  "active-envelope-conflicting-ids",
  "corrupt-pending-not-overwritten",
  "concurrent-cleanup",
  "disk-failures",
] as const) {
  test(`deleted-owner baseline cleanup isolated native fixture: ${scenario}`, () => {
    const result = spawnSync(process.execPath, ["__tests__/deletedOwnerBaselineCleanup.fixture.ts", scenario], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      timeout: 30000,
      env: process.env,
    });
    expect(result.stdout + result.stderr).toContain(`PASS native-r2 ${scenario}`);
    expect(result.status).toBe(0);
  }, 35000);
}
