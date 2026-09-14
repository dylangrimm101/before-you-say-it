import { describe, expect, test } from "bun:test";

describe("dictation transcribe abort", () => {
  test("does not abort in-flight transcribe when cancel identity changes", async () => {
    const dictation = await Bun.file(`${import.meta.dir}/../lib/useDictation.ts`).text();
    expect(dictation).toContain("cancelRef.current = cancel");
    expect(dictation).toContain("void cancelRef.current()");
    expect(dictation).not.toContain("}, [cancel]);");
  });

  test("rehearsal does not cancel dictation when cancelDictation identity changes", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(rehearsal).toContain("cancelDictationRef.current = cancelDictation");
    expect(rehearsal).toContain("cancelDictationRef.current()");
    expect(rehearsal).not.toContain("}, [cancelDictation]);");
  });
});
