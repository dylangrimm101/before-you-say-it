import { expect, test } from "bun:test";
import fs from "node:fs";
import { approvedRehearsalConfig } from "@/lib/approvedRehearsals";
import { convertedHandoffDeckHtml } from "@/lib/approvedDeckLoader";

test("Ravi Thursday scene keeps yesterday's disputed cause distinct from Tuesday's established no-owner cause", () => {
  const config = approvedRehearsalConfig("m1-l2")!;
  expect(config.scenario.situation).toStartWith("Thursday, end of day.");
  expect(config.scenario.situation).toContain("Ravi says yesterday was the client’s fault");
  expect(config.scenario.situation).toContain("Tuesday’s file waited because nobody owned the sign-off");
  expect(config.scenario.situation).not.toContain("Tuesday’s file was also late");
  expect(config.namedMove).toBe("One anchor. The rest stays in the folder.");
  const raw = fs.readFileSync(new URL("../assets/approved-decks/M1-L2-Cut-the-Case.html", import.meta.url), "utf8");
  const transformed = convertedHandoffDeckHtml(raw, config.rehearsalHandoffCard);
  const template = JSON.parse(transformed.match(/<script type="__bundler\/template">\s*(.*?)\s*<\/script>/s)![1]);
  expect(template).toContain(config.scenario.situation);
  expect(template).not.toContain("Wednesday, end of day.");
  expect(template).toContain("Tuesday's file waited because nobody owned the sign-off.");
});
