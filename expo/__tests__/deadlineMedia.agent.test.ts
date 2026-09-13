import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Isolate native/React boundary doubles so they cannot pollute other suites.
for (const scenario of ["transcription-body", "voice-body", "voice-reset", "dictation-cancel", "voice-late-play", "voice-reader-reset"]) {
  test(`deadline/recovery: ${scenario}`, () => {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./deadlineMedia.agent.fixture.ts", import.meta.url)), scenario], {
      cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", timeout: 5000,
    });
    expect({ status: result.status, error: result.error?.message, stderr: result.stderr }).toEqual({ status: 0, error: undefined, stderr: "" });
  });
}
