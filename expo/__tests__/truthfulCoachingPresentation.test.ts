import { expect, test } from "bun:test";

// Keep native/module mocks out of the shared Bun test process.
test("Home and Progress render only measured history while retaining lesson milestones", () => {
  const result = Bun.spawnSync([process.execPath, "__tests__/truthfulCoachingPresentation.fixture.ts"], {
    cwd: process.cwd(), stdout: "pipe", stderr: "pipe",
  });
  expect(new TextDecoder().decode(result.stderr)).toBe("");
  expect(new TextDecoder().decode(result.stdout)).toContain("truthful presentation verified");
  expect(result.exitCode).toBe(0);
});
