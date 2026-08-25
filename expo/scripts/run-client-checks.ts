import { spawn } from "node:child_process";

async function run(command: string, args: string[]): Promise<void> {
  const child = spawn(command, args, { cwd: process.cwd(), env: process.env, stdio: "inherit" });
  const code = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (value) => resolve(value ?? 1));
  });
  if (code !== 0) process.exit(code);
}

await run("bunx", ["tsc", "--noEmit"]);
await run("bunx", ["expo", "lint"]);
