import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { guardClientProcessEnv, sanitizeClientEnv } from "../lib/clientEnvGuard";

const envPath = path.resolve(process.cwd(), ".env");

guardClientProcessEnv(process.env);

if (existsSync(envPath)) {
  const original = await readFile(envPath, "utf8");
  const sanitized = sanitizeClientEnv(original);
  await writeFile(envPath, sanitized.content, { mode: 0o600 });
  if (sanitized.rejectedNames.length > 0) {
    throw new Error(`Unknown secret-like client variables: ${sanitized.rejectedNames.sort().join(", ")}`);
  }
  if (sanitized.removedNames.length > 0) {
    process.stderr.write(`[env-guard] removed prohibited client variables: ${sanitized.removedNames.sort().join(", ")}\n`);
  }
}
