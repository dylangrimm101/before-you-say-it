import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { guardClientProcessEnv, sanitizeClientEnv } from "../lib/clientEnvGuard";

type LifecycleName = "start" | "start-web" | "start-web-dev" | "test" | "lint" | "check" | "export" | "probe";

const commands: Record<LifecycleName, readonly string[]> = {
  start: ["bunx", "rork", "start", "-p", "8fc4qwsqaurkxk0pimyvx"],
  "start-web": ["bunx", "rork", "start", "-p", "8fc4qwsqaurkxk0pimyvx", "--web"],
  "start-web-dev": ["bunx", "rork", "start", "-p", "8fc4qwsqaurkxk0pimyvx", "--web"],
  test: ["bun", "test"],
  lint: ["bunx", "expo", "lint"],
  check: ["bun", "scripts/run-client-checks.ts"],
  export: ["bunx", "expo", "export", "--platform", "all"],
  probe: ["bun", "-e", "if(process.env.OPENAI_API_KEY||process.env.SUPABASE_ACCESS_TOKEN||process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY)throw new Error('DOWNSTREAM_SECRET_PRESENT');console.log('DOWNSTREAM_SECRET_ABSENT')"],
};

async function sanitizeEnvironmentFile(root: string): Promise<void> {
  const envPath = path.join(root, ".env");
  if (!existsSync(envPath)) return;
  const original = await readFile(envPath, "utf8");
  const sanitized = sanitizeClientEnv(original);
  if (sanitized.rejectedNames.length > 0) throw new Error(`Unknown secret-like client variables: ${sanitized.rejectedNames.sort().join(", ")}`);
  await writeFile(envPath, sanitized.content, { mode: 0o600 });
}

/** Runs a canonical lifecycle with the sanitized environment inherited by the actual downstream process. */
export async function runSanitizedClientCommand(name: LifecycleName): Promise<number> {
  const command = commands[name];
  if (!command) throw new Error(`Unsupported client lifecycle: ${name}`);
  const root = process.cwd();
  await sanitizeEnvironmentFile(root);
  const downstreamEnv: Record<string, string | undefined> = { ...process.env };
  guardClientProcessEnv(downstreamEnv);
  if (name === "start-web-dev") downstreamEnv.DEBUG = "expo*";
  const child = spawn(command[0]!, [...command.slice(1)], { cwd: root, env: downstreamEnv as NodeJS.ProcessEnv, stdio: "inherit" });
  return await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}

const name = process.argv[2] as LifecycleName | undefined;
if (!name) throw new Error("A client lifecycle name is required");
process.exitCode = await runSanitizedClientCommand(name);
