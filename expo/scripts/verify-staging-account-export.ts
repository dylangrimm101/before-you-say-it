import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { STAGING_AUTH_URL } from "../lib/authEnvironment";
import { FREE_STAGING_ENDPOINT } from "../lib/freeAcquisition";
import { PAID_STAGING_ENDPOINT } from "../lib/paidGeneration";
import { STAGING_ACCOUNT_DELETION_ENDPOINT, STAGING_ACCOUNT_DELETION_REVIEW_FLAG } from "../lib/accountDeletion";

export function verifyStagingBundleEnvironment(source: string, key: string, paid?: string, free?: string, deletion?: string) {
  assert.ok(free === undefined || free === FREE_STAGING_ENDPOINT);
  assert.ok(paid === undefined || paid === PAID_STAGING_ENDPOINT);
  assert.ok(deletion === undefined || deletion === STAGING_ACCOUNT_DELETION_REVIEW_FLAG);
  const prelude = source.match(/process\.env=Object\.defineProperties\(process\.env, \{([^\n]*?)\}\);/)?.[1];
  assert.ok(prelude, "Missing Expo development environment prelude");
  const env: Record<string, string> = {};
  for (const match of prelude.matchAll(/("EXPO_PUBLIC_[A-Z0-9_]+"):\s*\{\s*enumerable: true, value: ("(?:[^"\\]|\\.)*")\s*\}/g)) env[JSON.parse(match[1]!)] = JSON.parse(match[2]!);
  // Expo adds this non-service development metadata after the launch preflight.
  if (env.EXPO_PUBLIC_PROJECT_ROOT === process.cwd()) delete env.EXPO_PUBLIC_PROJECT_ROOT;
  assert.ok(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key), "Missing staging publishable key");
  // Do not print either object on failure (public keys still need not enter tool logs).
  const expected = { ...(free ? {EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT:free}:{}), ...(paid ? {EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT:paid}:{}), ...(deletion ? {EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED:deletion}:{}), EXPO_PUBLIC_BYSI_BUILD_MODE: "staging-account", EXPO_PUBLIC_STAGING_SUPABASE_URL: STAGING_AUTH_URL, EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY: key };
  assert.ok(JSON.stringify(Object.keys(env).sort()) === JSON.stringify(Object.keys(expected).sort())
    && Object.entries(expected).every(([name, value]) => env[name] === value), "Staging bundle environment is missing, wrong or contains normal service configuration");
}

export async function verifyStagingAccountExport(key: string, paid?: string, free?: string, deletion?: string) {
  const directory = "dist-staging-account/_expo/static/js/ios";
  const files = (await readdir(directory)).filter(name => name.endsWith(".js"));
  assert.equal(files.length, 1);
  const bundle = `${directory}/${files[0]}`;
  const bytes = await readFile(bundle);
  const source = bytes.toString();
  verifyStagingBundleEnvironment(source, key, paid, free, deletion);
  assert.ok(source.includes("__DEV__=true"));
  assert.ok(source.includes("app.bysi.staging.account"));
  for (const operation of ["activate", "restore", "discover"]) assert.ok(source.includes(`${STAGING_AUTH_URL}/functions/v1/bysi-staging-account/${operation}`));
  if(deletion)assert.ok(source.includes(STAGING_ACCOUNT_DELETION_ENDPOINT));
  const proof = { freeEndpointConfigured: !!free, paidEndpointConfigured: !!paid, accountDeletionConfigured: !!deletion, bundle, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), stagingEnvironmentVerified: true, exactAccountEndpointsPresent: true, exactDeletionEndpointPresent: !!deletion, normalServiceEnvironmentAbsentFromPrelude: true, scope: "iOS development JS export; not a compiled/installed native binary" };
  await writeFile(free ? "../docs/NATIVE-STAGING-FREE-EXPORT-PROOF.json" : "../docs/NATIVE-STAGING-ACCOUNT-EXPORT-PROOF.json", JSON.stringify(proof, null, 2) + "\n");
  console.log(JSON.stringify(proof, null, 2));
}
