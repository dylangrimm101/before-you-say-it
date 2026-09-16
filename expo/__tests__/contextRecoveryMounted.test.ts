import { spawnSync } from "node:child_process";

for (const [contextCase, mode] of [
  ["cold-off", "continuation-opener"],
  ["cold-on", "continuation-opener"],
  ["screen", "continuation-opener"],
  ["postcheckpoint", "continuation-reply"],
] as const) {
  test(`context recovery: ${contextCase}, exact outgoing and committed contract`, () => {
    const result = spawnSync("bun", ["__tests__/context-recovery.fixture.ts", mode], {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 90_000,
      env: { ...process.env, EXPO_NO_DOTENV: "1", BYSI_TEST_LEGACY_UPGRADE: "1",
        BYSI_TEST_DEPS: new URL("../../test-deps", import.meta.url).pathname,
        BYSI_COMPONENT_TEST_DEPS: new URL("../../component-deps", import.meta.url).pathname,
        BYSI_CONTEXT_CASE: contextCase },
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain(`PASS FRONT DOOR ${mode}`);
  }, 100_000);
}
