import { spawn } from "node:child_process";
import { guardClientProcessEnv } from "../lib/clientEnvGuard";
import { STAGING_AUTH_URL } from "../lib/authEnvironment";
import { FREE_STAGING_ENDPOINT } from "../lib/freeAcquisition";
import { PAID_STAGING_ENDPOINT } from "../lib/paidGeneration";
import { verifyStagingAccountExport } from "./verify-staging-account-export";
import { STAGING_ACCOUNT_DELETION_REVIEW_FLAG } from "../lib/accountDeletion";

/** Explicit launch only; never reads/writes .env or inherits normal public services. */
export function stagingAccountEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const key = source.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY;
  const paid = source.EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT;
  const free = source.EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT;
  const deletion = source.EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED;
  if (free !== undefined && free !== FREE_STAGING_ENDPOINT) throw new Error("Wrong staging free acquisition endpoint");
  if (paid !== undefined && paid !== PAID_STAGING_ENDPOINT) throw new Error("Wrong staging paid endpoint");
  if (deletion !== undefined && deletion !== STAGING_ACCOUNT_DELETION_REVIEW_FLAG) throw new Error("Wrong staging account deletion flag");
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? "")) throw new Error("Supply the staging project's publishable key (never an admin key)");
  if (source.EXPO_PUBLIC_STAGING_SUPABASE_URL && source.EXPO_PUBLIC_STAGING_SUPABASE_URL !== STAGING_AUTH_URL) throw new Error("Wrong staging project");
  const env = { ...source };
  guardClientProcessEnv(env);
  for (const name of Object.keys(env)) if (name.startsWith("EXPO_PUBLIC_")) delete env[name];
  delete env.EAS_BUILD_PROFILE;
  return { ...env, ...(free ? {EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT: free} : {}), ...(paid ? {EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT: paid} : {}), ...(deletion ? {EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED: deletion} : {}), EXPO_NO_DOTENV: "1", EXPO_PUBLIC_BYSI_BUILD_MODE: "staging-account", EXPO_PUBLIC_STAGING_SUPABASE_URL: STAGING_AUTH_URL, EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY: key };
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  const commands: Record<string, string[]> = {
    start: ["start", "--dev-client", "--clear", "--scheme", "beforeyousayit-staging"],
    ios: ["run:ios", "--device", "--configuration", "Debug"],
    config: ["config", "--type", "public", "--json"],
    export: ["export", "--platform", "ios", "--dev", "--output-dir", "dist-staging-account"],
  };
  const args = commands[process.argv[2] ?? ""];
  if (!args) throw new Error("Choose start, ios, config or export; no release/deploy commands are supported");
  const env = stagingAccountEnvironment(process.env);
  const child = spawn("bunx", ["expo", ...args], { cwd: process.cwd(), env, stdio: "inherit" });
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", code => resolve(code ?? 1));
  });
  if (process.exitCode === 0 && process.argv[2] === "export") await verifyStagingAccountExport(env.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY!, env.EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT, env.EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT, env.EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED);
}
