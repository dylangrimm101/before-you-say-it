import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'bun:test';

const root = path.resolve(import.meta.dir, '..');
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('login opens branded forgot-password instead of a paste helper', () => {
  const login = source('app/continue-from-web.tsx');
  expect(login).toContain('Forgot password?');
  expect(login).toContain('/forgot-password');
  expect(login).not.toContain('AccountRecoveryControls');
  expect(login).not.toMatch(/localhost|Paste the original/i);
});

test('native recovery screens match the website brand and reject log-copying', () => {
  const forgot = source('app/forgot-password.tsx');
  const reset = source('app/reset-password.tsx');
  expect(forgot).not.toContain('Before You Say It');
  expect(forgot).toContain('Send reset link');
  expect(forgot).not.toMatch(/localhost|Paste the original|copy a reset/i);
  expect(reset).toContain('Choose a new password');
  expect(reset).toContain('tap Reset password');
  expect(reset).toContain('FORGOT_URL');
  expect(reset).toContain('Do not copy a link from logs');
  expect(reset).not.toMatch(/localhost/);
});

test('layout keeps recovery reachable before signup', () => {
  const layout = source('app/_layout.tsx');
  expect(layout).toContain('firstSegment === "forgot-password"');
  expect(layout).toContain('firstSegment === "reset-password"');
  expect(layout).toContain('name="forgot-password"');
  expect(layout).toContain('name="reset-password"');
});
