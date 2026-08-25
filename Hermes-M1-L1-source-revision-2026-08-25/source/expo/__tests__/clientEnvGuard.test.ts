import { describe, expect, test } from "bun:test";

import { guardClientProcessEnv, prohibitedClientEnvNames, sanitizeClientEnv } from "@/lib/clientEnvGuard";

describe("client environment repopulation guard", () => {
  test("removes private and secret-like public variables while preserving allowed public config", () => {
    const fixture = [
      "EXPO_PUBLIC_SUPABASE_URL=https://example.invalid",
      "OPENAI_API_KEY=fixture-not-a-secret",
      "SUPABASE_ACCESS_TOKEN=fixture-not-a-secret",
      "EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY=fixture-not-a-secret",
      "EXPO_PUBLIC_PROJECT_ID=project-fixture",
    ].join("\n");
    const sanitized = sanitizeClientEnv(fixture);
    expect(sanitized.removedNames.sort()).toEqual(["EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY", "OPENAI_API_KEY", "SUPABASE_ACCESS_TOKEN"]);
    expect(sanitized.content).toContain("EXPO_PUBLIC_SUPABASE_URL");
    expect(sanitized.content).toContain("EXPO_PUBLIC_PROJECT_ID");
    expect(prohibitedClientEnvNames(sanitized.content)).toEqual([]);
    expect(sanitized.content).not.toContain("fixture-not-a-secret");
  });

  test("clears already-loaded prohibited process variables and rejects unknown secret-like public names", () => {
    const inherited: Record<string, string | undefined> = {
      EXPO_PUBLIC_PROJECT_ID: "project",
      EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY: "secret",
      OPENAI_API_KEY: "private",
      EXPO_PUBLIC_UNREVIEWED_LABEL: "remove-me",
    };
    expect(guardClientProcessEnv(inherited).removedNames.sort()).toEqual([
      "EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY", "EXPO_PUBLIC_UNREVIEWED_LABEL", "OPENAI_API_KEY",
    ]);
    expect(inherited).toEqual({ EXPO_PUBLIC_PROJECT_ID: "project" });
    expect(() => guardClientProcessEnv({ EXPO_PUBLIC_NEW_SECRET_TOKEN: "secret" })).toThrow("Unknown secret-like client variables");
  });

  test("Metro sanitizes process and file values before creating its Expo client configuration", async () => {
    const metro = await Bun.file(`${import.meta.dir}/../metro.config.js`).text();
    const preflight = await Bun.file(`${import.meta.dir}/../scripts/client-env-preflight.cjs`).text();
    const babel = await Bun.file(`${import.meta.dir}/../babel.config.js`).text();
    const eslint = await Bun.file(`${import.meta.dir}/../eslint.config.js`).text();
    expect(metro.indexOf("runClientEnvPreflight(__dirname)")).toBeLessThan(metro.indexOf("getDefaultConfig(__dirname)"));
    expect(preflight).toContain("delete process.env[name]");
    expect(preflight).toContain("fs.writeFileSync(envPath");
    expect(babel).toContain("runClientEnvPreflight(__dirname)");
    expect(eslint).toContain("runClientEnvPreflight(__dirname)");
    expect(metro).not.toContain("process.env.OPENAI_API_KEY");
    expect(metro).not.toContain("process.env.SUPABASE_ACCESS_TOKEN");
  });
});
