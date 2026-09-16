import { spawnSync } from "node:child_process";
import { test, expect } from "bun:test";

test("mounted cold onboarding resume continues through close and result on the actual local transport/server path", () => {
  const result = spawnSync(process.execPath, ["__tests__/normalFreeMountedColdResume.fixture.ts"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  expect(result.stdout + result.stderr).toContain("PASS mounted cold onboarding resume");
  expect(result.status).toBe(0);
});
