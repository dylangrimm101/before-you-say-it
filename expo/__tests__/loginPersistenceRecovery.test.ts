import { expect, test } from "bun:test";

test("login keeps persistence failures visible rather than rejecting an unobserved submit promise", async () => {
  const source = await Bun.file(`${import.meta.dir}/../app/continue-from-web.tsx`).text();
  expect(source).toContain('catch {');
  expect(source).toContain('We couldn’t safely connect your local practice. Your saved practice has not been reassigned.');
});
