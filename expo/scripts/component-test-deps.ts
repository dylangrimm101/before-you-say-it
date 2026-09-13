import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const scriptDir = new URL('.', import.meta.url).pathname;
const root = resolve(scriptDir, '..');
const spec = join(scriptDir, 'component-test-deps');
const hint = 'Run bun run setup:buyer-tests (or set BYSI_COMPONENT_TEST_DEPS to an explicitly prepared external prefix)';
const digest = () => createHash('sha256').update(readFileSync(join(spec, 'package.json'))).update(readFileSync(join(spec, 'package-lock.json'))).digest('hex');
export function componentTestPrefix() { return process.env.BYSI_COMPONENT_TEST_DEPS ?? '/tmp/bysi-buyer-component-deps'; }
function externalPrefix(prefix: string) {
  if (!isAbsolute(prefix) || !relative(root, resolve(prefix)).startsWith('..') || resolve(prefix) === '/') throw new Error(hint);
}
export function verifyComponentTestDeps(prefix = componentTestPrefix()) {
  try {
    externalPrefix(prefix);
    const expectedReact = realpathSync(join(root, 'node_modules/react'));
    const renderer = join(prefix, 'node_modules/react-test-renderer');
    const requireRenderer = createRequire(join(renderer, 'index.js'));
    if (JSON.parse(readFileSync(join(renderer, 'package.json'), 'utf8')).version !== '19.1.0'
      || JSON.parse(readFileSync(join(expectedReact, 'package.json'), 'utf8')).version !== '19.1.0'
      || realpathSync(join(prefix, 'node_modules/react')) !== expectedReact
      || realpathSync(requireRenderer.resolve('react')) !== realpathSync(join(expectedReact, 'index.js'))
      || readFileSync(join(prefix, '.bysi-component-lock'), 'utf8') !== digest()) throw new Error();
    return requireRenderer.resolve(join(renderer, 'index.js'));
  } catch { throw new Error(hint); }
}
export function setupComponentTestDeps(prefix = componentTestPrefix()) {
  externalPrefix(prefix);
  mkdirSync(prefix, {recursive:true});
  // Refuse symlinked parents that point inside the application tree.
  externalPrefix(realpathSync(prefix));
  for (const file of ['package.json', 'package-lock.json']) copyFileSync(join(spec, file), join(prefix, file));
  const result = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd:prefix, stdio:'inherit'});
  if (result.status !== 0) throw new Error('Locked component test dependency installation failed');
  rmSync(join(prefix, 'node_modules/react'), {recursive:true, force:true});
  symlinkSync(realpathSync(join(root, 'node_modules/react')), join(prefix, 'node_modules/react'), 'dir');
  writeFileSync(join(prefix, '.bysi-component-lock'), digest());
  verifyComponentTestDeps(prefix);
}
if ((import.meta as ImportMeta & {main?: boolean}).main) {
  if (process.argv[2] === '--install') setupComponentTestDeps();
  else if (process.argv.length !== 2) throw new Error('Use --install or no arguments for verification');
  verifyComponentTestDeps();
  console.log('Verified locked test-only React 19.1.0 renderer and shared application React instance.');
}
