import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

test("actual Get started screen exposes setup checks only on configuration failure and copies safely", () => {
  const result = spawnSync(process.execPath, ["--no-env-file", "__tests__/setupDiagnosticDetails.fixture.ts"], {
    cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 30000,
  });
  expect(result.stdout + result.stderr).toContain("PASS actual entry diagnostics");
  expect(result.status).toBe(0);
});
