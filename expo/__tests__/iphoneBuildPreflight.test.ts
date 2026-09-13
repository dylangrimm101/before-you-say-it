import { expect, test } from "bun:test";
import { inspectLocalBuild } from "../scripts/iphone-build-preflight";
const valid = { EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture_only", EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT: "https://bysi-signup-staging.vercel.app/api/practice/generate" };

test("offline inspection never certifies account/build readiness or needs Xcode", () => {
  const report = inspectLocalBuild({});
  expect(report.ready).toBe(false);
  expect(report.blockers).toContain("REMOTE_ACCOUNT_SIGNING_DEVICE_UNVERIFIED");
  expect(report.blockers).toContain("STAGING_INPUTS_INVALID_OR_MISSING");
  expect(report.blockers.join(" ")).not.toContain("XCODE");
});
test("real launcher/config/auth contracts pass with synthetic public input, never proving key ownership", () => {
  const r = inspectLocalBuild(valid);
  expect(r.passed).toContain("NATIVE_ID_URL_AND_ISOLATION");
  expect(r.passed).toContain("RELEASE_AUTH_MARKER_ALLOWED");
  expect(r.blockers).toContain("PUBLISHABLE_KEY_PROJECT_OWNERSHIP_UNVERIFIED");
  expect(r.ready).toBe(false);
  expect(JSON.stringify(r)).not.toContain(valid.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY);
});
for (const extra of [
  { EXPO_PUBLIC_STAGING_SUPABASE_URL: "https://wrong.supabase.co" },
  { EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT: "https://production.invalid/api/practice/generate" },
  { EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY: "service_role_secret" },
]) test("wrong project, endpoint or privileged key blocks", () => {
  expect(inspectLocalBuild({ ...valid, ...extra }).blockers).toContain("STAGING_INPUTS_INVALID_OR_MISSING");
});
test("normal public settings block this build preflight even though launcher strips them", () => {
  const r = inspectLocalBuild({ ...valid, EXPO_PUBLIC_TTS_ENDPOINT: "https://private.invalid/secret" });
  expect(r.blockers).toContain("UNREVIEWED_PUBLIC_ENVIRONMENT");
  expect(JSON.stringify(r)).not.toContain("private.invalid");
});
test("approved free acquisition opt-in passes local isolation without granting release readiness", () => {
  const r = inspectLocalBuild({ ...valid, EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT: "https://bysi-signup-staging.vercel.app/api/web-signup/generate" });
  expect(r.blockers).not.toContain("UNREVIEWED_PUBLIC_ENVIRONMENT");
  expect(r.blockers).not.toContain("LOCAL_CONFIG_OR_AUTH_CONTRACT_FAILED");
  expect(r.passed).toContain("NATIVE_ID_URL_AND_ISOLATION");
  expect(r.passed).toContain("RELEASE_AUTH_MARKER_ALLOWED");
  expect(r.ready).toBe(false);
});
for (const endpoint of ["https://beforeyousayit.app/api/generate", "https://bysi-signup-staging.vercel.app/api/web-signup/generate?override=1"]) test("unauthorized free acquisition endpoint remains rejected", () => {
  const r = inspectLocalBuild({ ...valid, EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT: endpoint });
  expect(r.blockers).toContain("STAGING_INPUTS_INVALID_OR_MISSING");
  expect(r.ready).toBe(false);
});

test("CLI export verification forwards both reviewed endpoint opt-ins", async () => {
  const source = await Bun.file(new URL("../scripts/iphone-build-preflight.ts", import.meta.url)).text();
  expect(source).toContain('process.env.EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT, process.env.EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT, process.env.EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED)');
});

test("paid voice acceptance requires explicit existing paid generation opt-in", () => {
  expect(inspectLocalBuild({ EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY: valid.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY }).blockers).toContain("PAID_PRACTICE_OPT_IN_MISSING");
});
