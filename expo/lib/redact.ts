/**
 * Log redaction. Nothing a user said, wrote, recorded, or that a model
 * generated may reach a console or a log sink. Logging is allowlist-only:
 * an unknown key is dropped rather than trusted.
 */

/** Longest string value that may ever be logged. Anything longer is content. */
export const MAX_LOG_VALUE_LENGTH = 64;

/**
 * The only keys that may appear in a log line. Every entry here is a stable
 * identifier, counter, or status — never something a person said or wrote.
 */
const ALLOWED_KEYS: readonly string[] = [
  "status",
  "code",
  "count",
  "index",
  "length",
  "ms",
  "ok",
  "reason",
  "step",
  "screen",
  "route",
  "day",
  "scenarioId",
  "drillId",
  "sessionId",
  "category",
  "difficulty",
  "persona",
  "schemaVersion",
  "removed",
  "kept",
  "retries",
  "attempt",
  "endpoint",
  "entryRoute",
  "event",
  "platform",
  "provider",
  "turn",
  "type",
  "userTurnCount",
];

const ALLOWED = new Set<string>(ALLOWED_KEYS);

export type LogValue = string | number | boolean;

/**
 * Strip a log payload down to short, allowlisted scalars.
 * Unknown keys, nested structures, and long strings are dropped silently.
 */
export function sanitizeMeta(meta: Record<string, unknown>): Record<string, LogValue> {
  const out: Record<string, LogValue> = {};
  Object.entries(meta).forEach(([key, value]) => {
    if (!ALLOWED.has(key)) return;
    if (typeof value === "number") {
      if (Number.isFinite(value)) out[key] = value;
      return;
    }
    if (typeof value === "boolean") {
      out[key] = value;
      return;
    }
    if (typeof value === "string") {
      if (value.length > 0 && value.length <= MAX_LOG_VALUE_LENGTH) out[key] = value;
    }
  });
  return out;
}

/**
 * Log a short, redacted breadcrumb. Use instead of `console.log` anywhere
 * near audio, transcripts, prompts, free text, safety answers or AI output.
 */
export function safeLog(tag: string, meta?: Record<string, unknown>): void {
  const clean = meta ? sanitizeMeta(meta) : {};
  if (Object.keys(clean).length === 0) {
    console.log(tag);
    return;
  }
  console.log(tag, clean);
}

/**
 * Reduce an unknown thrown value to a loggable shape. Error messages from
 * third-party SDKs can echo request bodies, so only the name is kept.
 */
export function errorShape(e: unknown): Record<string, LogValue> {
  if (e instanceof Error) return { reason: e.name.slice(0, MAX_LOG_VALUE_LENGTH) };
  return { reason: typeof e };
}
