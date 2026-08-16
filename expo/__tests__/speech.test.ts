import { describe, expect, it } from "bun:test";

import {
  audioExtensionFor,
  audioFailureMessage,
  cleanOutcomeTranscript,
  isAutoplayBlocked,
  micDisabledHint,
  micLocked,
  mutedHint,
  parseDataUri,
  possessive,
  speakerControl,
  speakerLabel,
  speechCacheFileName,
  tapToHearLabel,
  type SpeechPhase,
} from "@/lib/speech";

const JORDAN = "Jordan — your partner";
const DANA = "Dana — your manager";

describe("outcome dictation cleanup", () => {
  it("corrects the contextual homophones shown in the objective", () => {
    expect(cleanOutcomeTranscript("I went to Moore evenly split the chores.")).toBe(
      "I want to more evenly split the chores.",
    );
  });

  it("does not rewrite a legitimate person or place named Moore", () => {
    expect(cleanOutcomeTranscript("I went to Moore College yesterday.")).toBe(
      "I went to Moore College yesterday.",
    );
  });
});

describe("customer-facing audio copy", () => {
  it("forms possessives correctly", () => {
    expect(possessive("Jordan")).toBe("Jordan's");
    expect(possessive("Dana")).toBe("Dana's");
    expect(possessive("Chris")).toBe("Chris'");
    expect(possessive("Your mom")).toBe("Your mom's");
    expect(possessive("")).toBe("");
  });

  it("labels the tap-to-play control with the partner's name", () => {
    expect(tapToHearLabel(DANA)).toBe("Tap to hear Dana");
    expect(tapToHearLabel(JORDAN)).toBe("Tap to hear Jordan");
    expect(tapToHearLabel("Your mom")).toBe("Tap to hear Your mom");
  });

  it("uses friendly retry copy that refers only to the voice", () => {
    expect(audioFailureMessage(DANA)).toBe("Dana's voice didn't play. Tap to try again.");
    expect(audioFailureMessage(JORDAN)).toBe("Jordan's voice didn't play. Tap to try again.");
  });

  it("never exposes anything technical in audio copy", () => {
    const strings = [
      tapToHearLabel(DANA),
      audioFailureMessage(DANA),
      mutedHint(DANA),
      micDisabledHint("speaking", DANA) ?? "",
      micDisabledHint("generating", DANA) ?? "",
      speakerLabel("muted", DANA),
      speakerLabel("playing", DANA),
      speakerLabel("replay", DANA),
      speakerLabel("on", DANA),
    ];
    const banned = [
      "error",
      "undefined",
      "null",
      "promise",
      "native",
      "module",
      "expo",
      "http",
      "json",
      "autoplay",
      "NotAllowed",
      "{",
      "}",
    ];
    strings.forEach((s) => {
      banned.forEach((word) => {
        expect(s.toLowerCase()).not.toContain(word.toLowerCase());
      });
    });
  });

  it("distinguishes muted from broken", () => {
    expect(mutedHint(DANA)).toBe("Muted — tap the speaker to hear Dana");
    expect(mutedHint(DANA)).not.toContain("didn't");
    expect(mutedHint(DANA)).not.toContain("fail");
  });
});

describe("autoplay block detection", () => {
  it("recognizes the Safari autoplay rejection", () => {
    const err = new Error("play() failed because the user didn't interact with the document first");
    expect(isAutoplayBlocked(err)).toBe(true);
  });

  it("recognizes a NotAllowedError by name", () => {
    const err = new Error("The request is not allowed by the user agent");
    err.name = "NotAllowedError";
    expect(isAutoplayBlocked(err)).toBe(true);
  });

  it("recognizes the WebKit gesture wording", () => {
    expect(
      isAutoplayBlocked(new Error("The request is not allowed by the user agent")),
    ).toBe(true);
    expect(isAutoplayBlocked(new Error("A user gesture is required"))).toBe(true);
  });

  it("does not mistake a real failure for an autoplay block", () => {
    expect(isAutoplayBlocked(new Error("Voice request failed (500)"))).toBe(false);
    expect(isAutoplayBlocked(new Error("Unreadable voice audio"))).toBe(false);
    expect(isAutoplayBlocked(new Error("Network request failed"))).toBe(false);
  });

  it("handles non-error values safely", () => {
    expect(isAutoplayBlocked(null)).toBe(false);
    expect(isAutoplayBlocked(undefined)).toBe(false);
    expect(isAutoplayBlocked("not allowed")).toBe(false);
    expect(isAutoplayBlocked(42)).toBe(false);
  });
});

describe("microphone is locked while the partner speaks", () => {
  it("locks during generation and playback", () => {
    expect(micLocked("generating")).toBe(true);
    expect(micLocked("speaking")).toBe(true);
  });

  it("releases once playback is over or has failed", () => {
    expect(micLocked("idle")).toBe(false);
    expect(micLocked("blocked")).toBe(false);
    expect(micLocked("failed")).toBe(false);
  });

  it("covers every phase", () => {
    const phases: SpeechPhase[] = ["idle", "generating", "speaking", "blocked", "failed"];
    phases.forEach((p) => {
      expect(typeof micLocked(p)).toBe("boolean");
    });
  });

  it("explains the disabled mic and points at the control that stops playback", () => {
    expect(micDisabledHint("speaking", DANA)).toBe(
      "Dana is speaking — tap the speaker to stop",
    );
    expect(micDisabledHint("generating", DANA)).toBe("Finding Dana's voice — one moment");
  });

  it("never tells the user to tap the mic to stop playback", () => {
    const hints = [micDisabledHint("speaking", DANA), micDisabledHint("generating", DANA)];
    hints.forEach((h) => {
      expect(h).not.toBeNull();
      expect(h?.toLowerCase()).not.toContain("tap to stop");
      expect(h?.toLowerCase()).not.toContain("interrupt");
      expect(h?.toLowerCase()).not.toContain("tap the mic");
    });
  });

  it("has no hint whenever the mic is usable", () => {
    expect(micDisabledHint("idle", DANA)).toBeNull();
    expect(micDisabledHint("blocked", DANA)).toBeNull();
    expect(micDisabledHint("failed", DANA)).toBeNull();
  });

  it("shows a hint exactly when the mic is locked", () => {
    const phases: SpeechPhase[] = ["idle", "generating", "speaking", "blocked", "failed"];
    phases.forEach((p) => {
      expect(micDisabledHint(p, JORDAN) !== null).toBe(micLocked(p));
    });
  });
});

describe("the mic tap never doubles as a stop control", () => {
  it("returns early on a locked mic without touching playback", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    const handler = source.slice(
      source.indexOf("const onMicTap"),
      source.indexOf("const toggleSpeaker"),
    );
    expect(handler).toContain("if (micLocked(speech.phase)) return;");
    expect(handler).not.toContain("stopSpeech");
  });

  it("disables the mic control while audio is generating or playing", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain("const micDisabled = micLocked(speech.phase)");
    expect(source).toContain("disabled={closing || micDisabled}");
    expect(source).toContain("accessibilityState={{ disabled: micDisabled }}");
  });

  it("keeps stopping playback on the speaker control", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    const toggle = source.slice(
      source.indexOf("const toggleSpeaker"),
      source.indexOf("const onReplay"),
    );
    expect(toggle).toContain("stopSpeech");
  });
});

describe("the rehearsal reads as a spoken conversation thread", () => {
  it("stacks confirmed user turns on the right and counterpart turns on the left", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain('mineWrap: { alignSelf: "flex-end"');
    expect(source).toContain('themWrap: { alignSelf: "flex-start"');
    expect(source).toContain("mine ? styles.mineBubble : styles.themBubble");
    expect(source).toContain("onContentSizeChange={() =>");
    expect(source).toContain("scrollRef.current?.scrollToEnd");
  });

  it("keeps the active spoken task visible through both onboarding turns", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    for (const copy of [
      "SITUATION YOU’RE OPENING FOR",
      "In person with",
      "TURN 1 OF 2",
      "You start. What do you say?",
      "TURN 2 OF 2",
      "They’ve pushed back. What do you say now?",
      "REHEARSAL COMPLETE",
    ]) {
      expect(source).toContain(copy);
    }
  });

  it("matches the reference hierarchy with a centered turn header and pinned voice area", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain("<Text style={styles.headerTurn}>{turnTask.step}</Text>");
    expect(source).toContain('accessibilityLabel="Close rehearsal"');
    expect(source).toContain("Goal: {outcome}");
    expect(source).toContain("LISTENING NOW — TAP TO STOP");
    expect(source).toContain("Type this turn instead");
    expect(source.indexOf("styles.taskIntro")).toBeLessThan(source.indexOf("styles.threadContext"));
  });

  it("confirms each recorded transcript before adding it to the thread", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain("EDIT TRANSCRIPT");
    expect(source).toContain('myTurnCount === 0 ? "Use opener" : "Use reply"');
    expect(source).toContain(">Re-record</Text>");
    expect(source.indexOf("setPending(recognizerEndState(text).pendingText)")).toBeLessThan(source.indexOf("submitText(pending)"));
  });

  it("shows counterpart thinking and speaking inside the left-side thread", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain('speech.phase === "speaking"');
    expect(source).toContain("is speaking…");
    expect(source).toContain("is thinking…");
    expect(source).toContain("styles.themBubble");
  });
});

describe("a free rehearsal waits for the user after its fixed exchange", () => {
  it("recognizes completion only after the counterpart close", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain('const turnCap = params.entry === "onboarding"');
    expect(source).toContain("? FREE_REHEARSAL_USER_TURNS");
    expect(source).toContain(": rehearsalTurnCap(access.entitlement);");
    expect(source).toContain("const hasReachedTurnCap = turnCap !== null && myTurnCount >= turnCap;");
    expect(source).toContain("const isRepReadyForAnalysis =");
    expect(source).toContain('turns[turns.length - 1]?.role === "them"');
    expect(source).toContain("shouldGeneratePushback(turns)");
  });

  it("never automatically calls finish when the cap is reached", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    const finishEnd = source.indexOf("const leave = useCallback");
    const afterFinishDefinition = source.slice(source.indexOf("const finish = useCallback"), finishEnd);
    expect(afterFinishDefinition).not.toContain("useEffect(() =>");
  });

  it("keeps the approved exchange available until transcript review is chosen", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain('>Review transcript</Text>');
    expect(source).toContain('label="Approve transcript"');
    expect(source).toContain("Replay response");
    expect(source).toContain("disabled={audioBusy || closing}");
    expect(source).toContain("Nothing moves on until you choose.");
  });

  it("keeps onboarding fixed at two turns even when preview Pro access is enabled", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(onboarding).toContain('entry: "onboarding"');
    expect(rehearsal).toContain('params.entry === "onboarding"');
    expect(rehearsal).toContain("? FREE_REHEARSAL_USER_TURNS");
  });

  it("does not cap paid rehearsals outside onboarding", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain(": rehearsalTurnCap(access.entitlement);");
    expect(source).toContain("turnCap !== null && myTurnCount >= turnCap");
  });
});

describe("speaker control state is unambiguous", () => {
  it("shows playing whenever audio is active, even if a replay exists", () => {
    expect(speakerControl(false, "speaking", true)).toBe("playing");
    expect(speakerControl(false, "generating", false)).toBe("playing");
    expect(speakerControl(true, "speaking", true)).toBe("playing");
  });

  it("shows muted when the user turned the voice off", () => {
    expect(speakerControl(true, "idle", false)).toBe("muted");
    expect(speakerControl(true, "idle", true)).toBe("muted");
    expect(speakerControl(true, "failed", true)).toBe("muted");
  });

  it("offers replay once a line has been staged", () => {
    expect(speakerControl(false, "idle", true)).toBe("replay");
    expect(speakerControl(false, "blocked", true)).toBe("replay");
  });

  it("shows plain sound-on before any partner line exists", () => {
    expect(speakerControl(false, "idle", false)).toBe("on");
  });

  it("gives every state a distinct label", () => {
    const labels = (["muted", "playing", "replay", "on"] as const).map((c) =>
      speakerLabel(c, DANA),
    );
    expect(new Set(labels).size).toBe(4);
    expect(labels[0]).toBe("Voice off. Tap to hear Dana.");
    expect(labels[1]).toBe("Dana is speaking. Tap to stop.");
    expect(labels[2]).toBe("Replay Dana's last response.");
    expect(labels[3]).toBe("Voice on. Tap to mute.");
  });
});

describe("native playback source preparation", () => {
  it("parses a base64 audio data URI", () => {
    expect(parseDataUri("data:audio/mpeg;base64,AAAB")).toEqual({
      mime: "audio/mpeg",
      base64: "AAAB",
    });
  });

  it("tolerates extra parameters before the base64 marker", () => {
    expect(parseDataUri("data:audio/mp4;charset=utf-8;base64,QUJD")).toEqual({
      mime: "audio/mp4",
      base64: "QUJD",
    });
  });

  it("rejects anything that is not a base64 data URI", () => {
    expect(parseDataUri("https://example.com/a.mp3")).toBeNull();
    expect(parseDataUri("file:///tmp/a.mp3")).toBeNull();
    expect(parseDataUri("data:audio/mpeg,AAAB")).toBeNull();
    expect(parseDataUri("data:audio/mpeg;base64,")).toBeNull();
    expect(parseDataUri("")).toBeNull();
  });

  it("maps media types to playable extensions", () => {
    expect(audioExtensionFor("audio/mpeg")).toBe("mp3");
    expect(audioExtensionFor("audio/mp3")).toBe("mp3");
    expect(audioExtensionFor("audio/wav")).toBe("wav");
    expect(audioExtensionFor("audio/mp4")).toBe("m4a");
    expect(audioExtensionFor("audio/aac")).toBe("m4a");
    expect(audioExtensionFor("audio/ogg")).toBe("ogg");
    expect(audioExtensionFor("application/octet-stream")).toBe("mp3");
  });

  it("builds cache filenames that nothing user-supplied can shape", () => {
    expect(speechCacheFileName(3, "mp3")).toBe("line-3.mp3");
    expect(speechCacheFileName(0, "m4a")).toBe("line-0.m4a");
    expect(speechCacheFileName(-5, "mp3")).toBe("line-0.mp3");
    expect(speechCacheFileName(2.7, "mp3")).toBe("line-2.mp3");
    expect(speechCacheFileName(1, "../../etc")).toBe("line-1.mp3");
    expect(speechCacheFileName(1, "")).toBe("line-1.mp3");
  });

  it("never produces a filename containing a path separator", () => {
    [0, 1, 99, -2, 3.9].forEach((t) => {
      ["mp3", "wav", "..", "a/b", ""].forEach((ext) => {
        const name = speechCacheFileName(t, ext);
        expect(name).not.toContain("/");
        expect(name).not.toContain("..");
      });
    });
  });
});

describe("data URIs are never handed to native playback", () => {
  it("a prepared native source is always a file path, never a data URI", async () => {
    // Guard the actual defect: iOS AVPlayer cannot open a data: URI, so the
    // native branch must write bytes to disk and play from a file.
    const source = await Bun.file(`${import.meta.dir}/../lib/voice.ts`).text();
    expect(source).toContain("Platform.OS === \"web\"");
    expect(source).toContain("writeAsStringAsync");
    // The web branch is the only one allowed to return the data URI directly.
    const nativeBranch = source.slice(source.indexOf("async function prepareSource"));
    expect(nativeBranch).toContain("parseDataUri");
  });

  it("playback is invalidated by a token so stale audio cannot be heard", async () => {
    const source = await Bun.file(`${import.meta.dir}/../lib/voice.ts`).text();
    expect(source).toContain("if (id !== token)");
    expect(source).toContain("export async function resetSpeech");
  });
});
