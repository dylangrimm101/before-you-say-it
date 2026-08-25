import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { sanitizeClientEnv } from "../lib/clientEnvGuard";

const envPath = path.resolve(process.cwd(), ".env");

if (existsSync(envPath)) {
  const original = await readFile(envPath, "utf8");
  const sanitized = sanitizeClientEnv(original);
  if (sanitized.removedNames.length > 0) {
    await writeFile(envPath, sanitized.content, { mode: 0o600 });
    process.stderr.write(`[env-guard] removed prohibited client variables: ${sanitized.removedNames.sort().join(", ")}\n`);
  }
}
