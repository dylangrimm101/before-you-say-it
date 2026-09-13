import { expect, test } from "bun:test";
import { approvedRehearsalConfig } from "@/lib/approvedRehearsals";
import { approvedRehearsalPressurePassesQuality as passes } from "@/lib/approvedRehearsalPressure";

const context = approvedRehearsalConfig("m1-l2")!.scenario.situation;
const draft = "The client didn't send its revisions until 3.";

test("numeric keys do not manufacture a second grounding anchor", () => {
  expect(passes("Client 3", context)).toBe(false);
});

test("numeric spelling equivalence does not license changed facts or numeric constructions", () => {
  for (const replacement of ["four", "4", "30", "03", "3:30", "3.5", "third", "3rd", "tree", "free", "three afternoon", "three Morgan", "three hundred", "three thirty", "three pm", "3:\u200b3", "three p.m.", "3 p.m."]) {
    expect(passes(draft.replace("3", replacement), context), replacement).toBe(false);
  }
  expect(passes("Three files prove the client revisions issue.", context)).toBe(false);
  expect(passes(draft.replace("3", "three"), context.replace("until 3", "until 4"))).toBe(false);
  expect(passes(draft.replace("3", "three"), context.replace("until 3", "until 3:30"))).toBe(false);
  expect(passes("The client revisions need one owner.", "The client revisions need an owner.")).toBe(false);
});
test("Ravi's authored until 3 admits the same spoken until three without changing the reply", () => {
  expect(context).toContain("revisions until 3");
  expect(passes(draft, context)).toBe(true);
  const spoken = draft.replace("3", "three");
  expect(passes(spoken, context)).toBe(true);
  expect(spoken).toBe("The client didn't send its revisions until three.");
});
