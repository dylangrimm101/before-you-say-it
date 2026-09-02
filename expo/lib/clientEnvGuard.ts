export const APPROVED_CLIENT_PUBLIC_NAMES: ReadonlySet<string> = new Set([
  "EXPO_PUBLIC_PROJECT_ID",
  "EXPO_PUBLIC_GENERATE_ENDPOINT",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY",
  "EXPO_PUBLIC_RORK_API_BASE_URL",
  "EXPO_PUBLIC_RORK_APP_KEY",
  "EXPO_PUBLIC_RORK_AUTH_URL",
  "EXPO_PUBLIC_RORK_FUNCTIONS_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_TEAM_ID",
  "EXPO_PUBLIC_TOOLKIT_URL",
  "EXPO_PUBLIC_TRANSCRIBE_ENDPOINT",
  "EXPO_PUBLIC_TTS_ENDPOINT",
]);

export const PROHIBITED_CLIENT_NAMES: ReadonlySet<string> = new Set([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ELEVENLABS_API_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY",
]);

const SECRET_LIKE_PUBLIC_NAME = /^EXPO_PUBLIC_.*(?:SECRET|TOKEN|PRIVATE|PASSWORD|SERVICE_ROLE|ACCESS_KEY)/;

export interface SanitizedEnv {
  content: string;
  removedNames: string[];
  rejectedNames: string[];
}

function classifyName(name: string): "keep" | "remove" | "reject" {
  if (PROHIBITED_CLIENT_NAMES.has(name)) return "remove";
  if (!name.startsWith("EXPO_PUBLIC_")) return "keep";
  if (APPROVED_CLIENT_PUBLIC_NAMES.has(name)) return "keep";
  return SECRET_LIKE_PUBLIC_NAME.test(name) ? "reject" : "remove";
}

/** Enforces an explicit public allowlist without exposing values. */
export function sanitizeClientEnv(content: string): SanitizedEnv {
  const removedNames: string[] = [];
  const rejectedNames: string[] = [];
  const kept = content.split(/\r?\n/).filter((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
    const name = match?.[1];
    if (!name) return true;
    const classification = classifyName(name);
    if (classification === "keep") return true;
    if (classification === "reject") rejectedNames.push(name);
    else removedNames.push(name);
    return false;
  });
  return {
    content: kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + (kept.some((line) => line.length > 0) ? "\n" : ""),
    removedNames,
    rejectedNames,
  };
}

/** Clears inherited prohibited/unapproved values before Expo can inline them. */
export function guardClientProcessEnv(env: Record<string, string | undefined>): { removedNames: string[] } {
  const removedNames: string[] = [];
  const rejectedNames: string[] = [];
  Object.keys(env).forEach((name) => {
    const classification = classifyName(name);
    if (classification === "keep") return;
    if (classification === "reject") rejectedNames.push(name);
    else if (PROHIBITED_CLIENT_NAMES.has(name) || name.startsWith("EXPO_PUBLIC_")) removedNames.push(name);
    delete env[name];
  });
  if (rejectedNames.length > 0) throw new Error(`Unknown secret-like client variables: ${rejectedNames.sort().join(", ")}`);
  return { removedNames };
}

export function prohibitedClientEnvNames(content: string): string[] {
  const result = sanitizeClientEnv(content);
  return [...result.removedNames, ...result.rejectedNames];
}
