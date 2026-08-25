import { describe, expect, test } from "bun:test";

import { prohibitedClientEnvNames, sanitizeClientEnv } from "@/lib/clientEnvGuard";

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

  test("Metro sanitizes before creating its Expo client configuration", async () => {
    const metro = await Bun.file(`${import.meta.dir}/../metro.config.js`).text();
    expect(metro.indexOf("fs.writeFileSync(envPath")).toBeLessThan(metro.indexOf("getDefaultConfig(__dirname)"));
    expect(metro).not.toContain("process.env.OPENAI_API_KEY");
    expect(metro).not.toContain("process.env.SUPABASE_ACCESS_TOKEN");
  });
});
