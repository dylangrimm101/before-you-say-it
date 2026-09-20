import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, lstatSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const releaseStages = [
  'verify:buyer-tests', 'test:release-policy', 'test:spoken', 'test:spoken-joined', 'check',
] as const;

/** Stop at the first failure; missing infrastructure is not a skipped pass. */
export function runStages(run: (name: string) => number): { completed: string[]; failed: string | null } {
  const completed: string[] = [];
  for (const name of releaseStages) {
    if (run(name) !== 0) return { completed, failed: name };
    completed.push(name);
  }
  return { completed, failed: null };
}

function sourcePin(root: string) {
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const files = [...new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'expo').split('\0').filter(Boolean))].sort();
  const hash = createHash('sha256');
  for (const file of files) {
    const full = path.join(root, file);
    const content = !existsSync(full) ? Buffer.from('deleted')
      : lstatSync(full).isSymbolicLink() ? Buffer.from(readlinkSync(full)) : readFileSync(full);
    hash.update(JSON.stringify([file, content.length])); hash.update(content);
  }
  return {
    commit: git('rev-parse', 'HEAD'),
    expoSourceSha256: hash.digest('hex'),
    dirty: git('status', '--porcelain', '--', 'expo').length > 0,
    build: String(JSON.parse(readFileSync(path.join(root, 'expo/app.json'), 'utf8')).expo.ios.buildNumber),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  try {
    for (const key of ['BYSI_COMPONENT_TEST_DEPS', 'BYSI_GUEST_BACKEND']) {
      const value = process.env[key];
      if (!value || !path.isAbsolute(value) || !existsSync(value)) throw new Error(`${key} must name an existing absolute directory`);
    }
    const before = sourcePin(root);
    const started = new Date().toISOString();
    const result = runStages(name => {
      console.log(`\nRelease check: ${name}`);
      const child = spawnSync(process.execPath, ['run', name], {
        cwd: path.join(root, 'expo'), env: { ...process.env, EXPO_NO_DOTENV: '1' }, stdio: 'inherit',
      });
      return child.status ?? 1;
    });
    const unchanged = JSON.stringify(before) === JSON.stringify(sourcePin(root));
    const passed = result.failed === null && unchanged;
    console.log(JSON.stringify({
      started, finished: new Date().toISOString(), source: before, ...result, unchanged,
      automated: passed ? 'passed' : 'failed', realProviders: 'not assessed', physicalDevice: 'not assessed',
      releaseAccepted: false,
    }, null, 2));
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Release checks could not start');
    process.exitCode = 1;
  }
}
