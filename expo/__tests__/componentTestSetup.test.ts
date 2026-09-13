import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('component prerequisite rejects absent, unpinned and duplicate React instead of ambient fallback', async () => {
  const setup = await import('../scripts/component-test-deps');
  const dir = mkdtempSync(join(tmpdir(), 'bysi-renderer-contract-'));
  const renderer = join(dir, 'node_modules/react-test-renderer');
  const react = join(dir, 'node_modules/react');
  const spec = resolve(import.meta.dir, '../scripts/component-test-deps');
  const digest = createHash('sha256').update(readFileSync(join(spec, 'package.json'))).update(readFileSync(join(spec, 'package-lock.json'))).digest('hex');
  try {
    expect(() => setup.verifyComponentTestDeps(dir)).toThrow('setup:buyer-tests');
    // Construct the verifier's filesystem contract, not a fake passing renderer.
    mkdirSync(renderer, {recursive:true});
    writeFileSync(join(renderer, 'package.json'), JSON.stringify({version:'19.1.0'}));
    symlinkSync(resolve(import.meta.dir, '../node_modules/react'), react, 'dir');
    expect(() => setup.verifyComponentTestDeps(dir)).toThrow('setup:buyer-tests');
    writeFileSync(join(dir, '.bysi-component-lock'), digest);
    expect(() => setup.verifyComponentTestDeps(dir)).toThrow('setup:buyer-tests');
    writeFileSync(join(renderer, 'index.js'), 'module.exports = {};');
    expect(setup.verifyComponentTestDeps(dir)).toBe(realpathSync(join(renderer, 'index.js')));
    writeFileSync(join(renderer, 'package.json'), JSON.stringify({version:'19.2.0'}));
    expect(() => setup.verifyComponentTestDeps(dir)).toThrow('setup:buyer-tests');
    writeFileSync(join(renderer, 'package.json'), JSON.stringify({version:'19.1.0'}));
    rmSync(react);
    mkdirSync(react);
    writeFileSync(join(react, 'package.json'), JSON.stringify({version:'19.1.0'}));
    writeFileSync(join(react, 'index.js'), 'module.exports = {};');
    expect(() => setup.verifyComponentTestDeps(dir)).toThrow('setup:buyer-tests');
    rmSync(react, {recursive:true});
    symlinkSync(resolve(import.meta.dir, '../node_modules/react'), react, 'dir');
    expect(setup.verifyComponentTestDeps(dir)).toBe(realpathSync(join(renderer, 'index.js')));
    writeFileSync(join(dir, '.bysi-component-lock'), 'stale-lock');
    expect(() => setup.verifyComponentTestDeps(dir)).toThrow('setup:buyer-tests');
    expect(() => setup.verifyComponentTestDeps(resolve(import.meta.dir, '..'))).toThrow('setup:buyer-tests');
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
