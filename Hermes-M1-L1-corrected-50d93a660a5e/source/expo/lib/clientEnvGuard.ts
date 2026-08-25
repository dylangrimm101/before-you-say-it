const PROHIBITED_CLIENT_NAMES = new Set([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ELEVENLABS_API_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY",
]);

export interface SanitizedEnv {
  content: string;
  removedNames: string[];
}

/** Removes server credentials and secret-like public variables without exposing values. */
export function sanitizeClientEnv(content: string): SanitizedEnv {
  const removedNames: string[] = [];
  const kept = content.split(/\r?\n/).filter((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
    if (!match?.[1] || !PROHIBITED_CLIENT_NAMES.has(match[1])) return true;
    removedNames.push(match[1]);
    return false;
  });
  return { content: kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + (kept.some((line) => line.length > 0) ? "\n" : ""), removedNames };
}

export function prohibitedClientEnvNames(content: string): string[] {
  return sanitizeClientEnv(content).removedNames;
}
