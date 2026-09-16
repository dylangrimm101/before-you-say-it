import { describe, expect, test } from "bun:test";

import { visibleDictationFailure } from "@/lib/dictationFailure";

describe("visibleDictationFailure", () => {
  test("surfaces the thrown local talking error instead of Could not transcribe", () => {
    expect(visibleDictationFailure(new Error("Confirmed account required"))).toBe("Confirmed account required");
    expect(visibleDictationFailure(new Error("Recorded audio could not be read"))).toBe("Recorded audio could not be read");
    expect(visibleDictationFailure(new Error("Transcription failed (400)"))).toBe("Transcription failed (400)");
  });

  test("keeps service-unavailable and empty-capture copy", () => {
    expect(visibleDictationFailure({ name: "TranscriptionUnavailableError", status: 503 })).toBe(
      "Voice transcription is temporarily unavailable. Type this turn instead.",
    );
    expect(visibleDictationFailure(new Error("No recording was captured"))).toBe("No recording was captured.");
  });

  test("does not show URLs or tokens", () => {
    expect(visibleDictationFailure(new Error("fetch failed https://beforeyousayit.app/api/native/free/transcribe"))).toBe(
      "Could not transcribe that. Try again.",
    );
    expect(visibleDictationFailure(new Error("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa"))).toBe(
      "Could not transcribe that. Try again.",
    );
  });
});
