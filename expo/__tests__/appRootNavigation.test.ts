import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

test("actual root navigation keeps account deletion status route mounted", () => {
  const result = spawnSync(process.execPath, ["__tests__/appRootNavigation.fixture.ts"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
    timeout: 30000,
  });
  expect(result.stdout + result.stderr).toContain("PASS actual root navigation");
  expect(result.status).toBe(0);
});
