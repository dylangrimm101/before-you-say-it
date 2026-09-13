import { expect, test } from "bun:test";

test("entry does not advertise unavailable web access restoration", async () => {
  const source = await Bun.file(`${import.meta.dir}/../app/entry.tsx`).text();
  expect(source).not.toContain("Log in to connect your access");
  expect(source).toContain("Web purchases can’t be activated in this build. Don’t purchase again if you already paid on the web.");
});

// Copy contract only: this does not prove deployed activation or entitlement behavior.
test("web account login does not promise the unavailable Stripe bridge", async () => {
  const source = await Bun.file(`${import.meta.dir}/../app/continue-from-web.tsx`).text();
  expect(source).not.toContain("the app will connect it automatically");
  expect(source).toContain("Web subscription activation and web result restore aren’t available in this build. If you paid on the web, don’t purchase again in the app.");
});
