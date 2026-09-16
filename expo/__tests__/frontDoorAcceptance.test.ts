import { spawnSync } from "node:child_process";

const modes = [
  "journey",
  "signup-result",
  "lost-result",
  "mic-retry",
  "transcribe-retry",
  "tts-failure",
  "fd2-initial-signout",
  "fd2-user-owner-switch",
  "fd2-same-owner-transcribe",
  "cold-server-claim",
  "claim-retry-503",
  "claim-retry-lost",
  "paywall-purchase",
  "paywall-cancel",
  "paywall-unavailable",
  "paywall-restore",
  "paywall-already",
  "paywall-web-buyer",
] as const;

for (const mode of modes) {
  test(`front-door acceptance ${mode}`, () => {
    const result = spawnSync("bun", ["__tests__/frontDoorAcceptance.fixture.ts", mode], {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 90_000,
      env: {
        ...process.env,
        BYSI_COMPONENT_TEST_DEPS: new URL("../../component-deps", import.meta.url).pathname,
        BYSI_FRONT_DOOR_MODE: mode,
      },
    });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain(`PASS FRONT DOOR ${mode}`);
  }, 100_000);
}
