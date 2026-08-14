import { describe, expect, it } from "bun:test";

import { SCENARIOS } from "@/constants/scenarios";
import { counterpartLinePassesQuality } from "@/lib/ai";
import {
  containsRawArtifacts,
  counterpartInSentence,
  counterpartName,
  currentSpeaker,
  initialRehearsalState,
  looksTruncated,
  openingPrompt,
  opensWith,
  parseCounterpartPayload,
  renderCounterpartMessage,
  sanitizeReply,
  speechTextFor,
  turnFailureMessage,
} from "@/lib/rehearsal";
import type { Scenario, Turn } from "@/types/convo";

const JORDAN = "Jordan — your partner";

describe("acquisition counterpart quality gate", () => {
  it("rejects unsupported channel leakage", () => {
    expect(counterpartLinePassesQuality("Just text me about it later.", "pushback")).toBe(false);
    expect(counterpartLinePassesQuality("We can discuss that here, but I still disagree.", "pushback")).toBe(true);
  });

  it("rejects easy-agreement closes while allowing unresolved clarification", () => {
    expect(counterpartLinePassesQuality("You’re right. I’ll do that.", "close")).toBe(false);
    expect(counterpartLinePassesQuality("I’m not agreeing yet. What exactly are you asking me to change?", "close")).toBe(true);
  });
});

function scenario(patch: Partial<Scenario> = {}): Scenario {
  return {
    id: "test",
    category: "partner",
    title: "Talk about the money",
    counterpart: JORDAN,
    situation: "There is debt neither of them mentions.",
    persona: "Embarrassed, covers it with jokes.",
    goal: "Get the real numbers on the table.",
    openingLine: "(laughing) Okay, why do you look so serious?",
    minutes: 8,
    ...patch,
  };
}

function turn(role: Turn["role"], text: string): Turn {
  return { id: `${role}-${text.slice(0, 4)}`, role, text };
}

describe("turn order initialization", () => {
  it("a user-initiated rehearsal opens with no counterpart message", () => {
    const state = initialRehearsalState(scenario({ opensWith: "user" }));
    expect(state.opensWith).toBe("user");
    expect(state.initialCounterpartLine).toBeNull();
    expect(state.waitingForUserOpening).toBe(true);
    expect(state.currentSpeaker).toBe("user");
    expect(state.partnerGenerationStarted).toBe(false);
  });

  it("defaults to the user speaking first when opensWith is absent", () => {
    const state = initialRehearsalState(scenario({ opensWith: undefined }));
    expect(state.opensWith).toBe("user");
    expect(state.initialCounterpartLine).toBeNull();
    expect(state.waitingForUserOpening).toBe(true);
  });

  it("a scenario explicitly configured as counterpart-first still opens with the partner", () => {
    const state = initialRehearsalState(
      scenario({ opensWith: "counterpart", openingLine: "(cheerful) I brought you soup!" }),
    );
    expect(state.opensWith).toBe("counterpart");
    expect(state.initialCounterpartLine).toBe("(cheerful) I brought you soup!");
    expect(state.waitingForUserOpening).toBe(false);
    expect(state.currentSpeaker).toBe("counterpart");
  });

  it("prompts the user to start, naming the counterpart", () => {
    expect(openingPrompt(JORDAN)).toBe(
      "You're starting the conversation. What do you want to say to Jordan?",
    );
  });

  it("phrases descriptive counterparts naturally in the prompt", () => {
    expect(openingPrompt("Your mom")).toBe(
      "You're starting the conversation. What do you want to say to your mom?",
    );
  });

  it("alternates turns correctly from the transcript", () => {
    const s = scenario({ opensWith: "user" });
    expect(currentSpeaker([], s)).toBe("user");
    expect(currentSpeaker([turn("user", "Hey, can we talk?")], s)).toBe("counterpart");
    expect(
      currentSpeaker([turn("user", "Hey."), turn("them", "About what?")], s),
    ).toBe("user");
    expect(
      currentSpeaker(
        [turn("user", "Hey."), turn("them", "About what?"), turn("user", "The money.")],
        s,
      ),
    ).toBe("counterpart");
  });

  it("alternates correctly for a counterpart-first scenario too", () => {
    const s = scenario({ opensWith: "counterpart" });
    expect(currentSpeaker([], s)).toBe("counterpart");
    expect(currentSpeaker([turn("them", "I brought soup!")], s)).toBe("user");
  });
});

describe("every shipped scenario declares its turn order", () => {
  it("sets opensWith explicitly", () => {
    SCENARIOS.forEach((s) => {
      expect(s.opensWith === "user" || s.opensWith === "counterpart").toBe(true);
    });
  });

  it("keeps the conversations the user must initiate user-first", () => {
    const userFirst = SCENARIOS.filter((s) => opensWith(s) === "user");
    expect(userFirst.length).toBe(SCENARIOS.length - 1);
    expect(userFirst.some((s) => s.id === "chores")).toBe(true);
    expect(userFirst.some((s) => s.id === "wedding-money")).toBe(true);
  });

  it("keeps at least one genuine response scenario partner-first", () => {
    const partnerFirst = SCENARIOS.filter((s) => opensWith(s) === "counterpart");
    expect(partnerFirst.map((s) => s.id)).toEqual(["mother-boundary"]);
  });
});

describe("sanitizeReply strips every transport artifact", () => {
  it("pulls the reply out of a leaked JSON envelope", () => {
    const raw = '{"reply":"(sighs) I literally did all the dishes.","tension":62,"nudge":""}';
    expect(sanitizeReply(raw)).toBe("(sighs) I literally did all the dishes.");
  });

  it("handles the exact shape seen in the bug report", () => {
    const raw = '{"reply":"(sighs) \'More evenly?\' I literally did all the laundry."}';
    const out = sanitizeReply(raw);
    expect(out).toBe("(sighs) 'More evenly?' I literally did all the laundry.");
    expect(containsRawArtifacts(out)).toBe(false);
  });

  it("strips markdown code fences", () => {
    const raw = '```json\n{"reply":"Fine. Say it."}\n```';
    expect(sanitizeReply(raw)).toBe("Fine. Say it.");
  });

  it("strips a bare field name prefix", () => {
    expect(sanitizeReply('reply: "Okay, I hear you."')).toBe("Okay, I hear you.");
  });

  it("strips leaked role prefixes", () => {
    expect(sanitizeReply("assistant: I don't know what you want from me.")).toBe(
      "I don't know what you want from me.",
    );
  });

  it("removes stray braces and brackets", () => {
    expect(sanitizeReply("{ I said I would do it. }")).toBe("I said I would do it.");
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeReply(undefined)).toBe("");
    expect(sanitizeReply(null)).toBe("");
    expect(sanitizeReply(42)).toBe("");
    expect(sanitizeReply({ reply: "hi" })).toBe("");
  });

  it("never leaves an artifact behind for any malformed shape", () => {
    const nasty = [
      '{"reply":"One.","tension":10}',
      '```json{"reply":"Two."}```',
      '{"reply": "Three.", "nudge": "Be specific"}',
      'reply:"Four."',
      '{{"reply":"Five."}}',
      '"reply" : "Six."',
    ];
    nasty.forEach((raw) => {
      const out = sanitizeReply(raw);
      expect(containsRawArtifacts(out)).toBe(false);
      expect(out.length).toBeGreaterThan(0);
    });
  });
});

describe("truncation detection", () => {
  it("accepts complete sentences", () => {
    expect(looksTruncated("I did all the dishes yesterday.")).toBe(false);
    expect(looksTruncated("Are you serious right now?")).toBe(false);
    expect(looksTruncated("Wow!")).toBe(false);
  });

  it("accepts a deliberate trail-off", () => {
    expect(looksTruncated("I mean, I just—")).toBe(false);
    expect(looksTruncated("I guess…")).toBe(false);
    expect(looksTruncated("It's not that I don't...")).toBe(false);
  });

  it("rejects a reply cut off mid-sentence", () => {
    expect(looksTruncated("(sighs) 'More evenly?' I literally did all the")).toBe(true);
    expect(looksTruncated("I did the dishes,")).toBe(true);
    expect(looksTruncated("Here's the thing:")).toBe(true);
  });

  it("rejects unbalanced quotes", () => {
    expect(looksTruncated('You said "more evenly" and I heard "you never help.')).toBe(true);
    expect(looksTruncated("She said “what about me?")).toBe(true);
  });

  it("rejects empty or whitespace-only text", () => {
    expect(looksTruncated("")).toBe(true);
    expect(looksTruncated("   ")).toBe(true);
  });
});

describe("parseCounterpartPayload validates the schema", () => {
  it("accepts a well-formed payload and returns only the reply value", () => {
    const res = parseCounterpartPayload(
      '{"reply":"(sighs) Fine. What do you want me to say?","tension":58,"nudge":"Stay specific"}',
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.reply).toBe("(sighs) Fine. What do you want me to say?");
    expect(res.value.tension).toBe(58);
    expect(res.value.nudge).toBe("Stay specific");
    expect(containsRawArtifacts(res.value.reply)).toBe(false);
  });

  it("tolerates fences and prose around the JSON", () => {
    const res = parseCounterpartPayload(
      'Sure!\n```json\n{"reply":"I hear you.","tension":30}\n```',
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.reply).toBe("I hear you.");
  });

  it("clamps and defaults tension", () => {
    const high = parseCounterpartPayload('{"reply":"Stop.","tension":900}');
    const bad = parseCounterpartPayload('{"reply":"Stop.","tension":"very"}');
    const low = parseCounterpartPayload('{"reply":"Stop.","tension":-20}');
    expect(high.ok && high.value.tension).toBe(100);
    expect(bad.ok && bad.value.tension).toBe(50);
    expect(low.ok && low.value.tension).toBe(0);
  });

  it("rejects a response that is not JSON", () => {
    expect(parseCounterpartPayload("I'm not sure what to say.")).toEqual({
      ok: false,
      reason: "not-json",
    });
  });

  it("rejects malformed JSON", () => {
    expect(parseCounterpartPayload('{"reply":"unclosed')).toEqual({
      ok: false,
      reason: "not-json",
    });
  });

  it("rejects a missing or non-string reply field", () => {
    expect(parseCounterpartPayload('{"tension":40}')).toEqual({
      ok: false,
      reason: "missing-reply",
    });
    expect(parseCounterpartPayload('{"reply":42}')).toEqual({
      ok: false,
      reason: "missing-reply",
    });
    expect(parseCounterpartPayload('{"reply":null}')).toEqual({
      ok: false,
      reason: "missing-reply",
    });
  });

  it("rejects an empty reply", () => {
    expect(parseCounterpartPayload('{"reply":"   "}')).toEqual({
      ok: false,
      reason: "empty-reply",
    });
  });

  it("rejects a truncated reply", () => {
    const res = parseCounterpartPayload(
      '{"reply":"(sighs) \'More evenly?\' I literally did all the"}',
    );
    expect(res).toEqual({ ok: false, reason: "truncated" });
  });

  it("never returns a value carrying raw artifacts", () => {
    const cases = [
      '{"reply":"One sentence here."}',
      '```{"reply":"Two sentences here."}```',
      '{"reply":"Three here.","tension":20,"nudge":"tip"}',
    ];
    cases.forEach((raw) => {
      const res = parseCounterpartPayload(raw);
      expect(res.ok).toBe(true);
      if (res.ok) expect(containsRawArtifacts(res.value.reply)).toBe(false);
    });
  });
});

describe("beats and internal markers", () => {
  it("never renders a standalone beat marker", () => {
    const out = renderCounterpartMessage("(beat) I know the kitchen has been a mess.", JORDAN);
    expect(out.beatLine).toBeNull();
    expect(out.body).toBe("I know the kitchen has been a mess.");
  });

  it("drops every meta marker variant", () => {
    ["(beat)", "(a beat)", "(long beat)", "(internal)", "(system)"].forEach((marker) => {
      const out = renderCounterpartMessage(`${marker} Say what you mean.`, JORDAN);
      expect(out.beatLine).toBeNull();
      expect(out.body).toBe("Say what you mean.");
    });
  });

  it("renders a real beat as a natural sentence naming the partner", () => {
    expect(renderCounterpartMessage("(pause) I know.", JORDAN).beatLine).toBe("Jordan pauses.");
    expect(renderCounterpartMessage("(sighs) I know.", JORDAN).beatLine).toBe("Jordan sighs.");
    expect(renderCounterpartMessage("(laughing) Sure.", JORDAN).beatLine).toBe("Jordan laughs.");
  });

  it("renders an unmapped beat readably rather than as a bare label", () => {
    const out = renderCounterpartMessage(
      "(barely looking up from their phone) I'll do it tomorrow.",
      "Sam — your partner",
    );
    expect(out.beatLine).toBe("Sam — barely looking up from their phone.");
    expect(out.body).toBe("I'll do it tomorrow.");
  });

  it("strips meta markers appearing mid-reply", () => {
    const out = renderCounterpartMessage("I hear you. (beat) But I'm tired.", JORDAN);
    expect(out.body).toBe("I hear you. But I'm tired.");
    expect(out.body).not.toContain("beat");
  });

  it("removes JSON artifacts before rendering", () => {
    const out = renderCounterpartMessage('{"reply":"(sighs) Fine."}', JORDAN);
    expect(out.beatLine).toBe("Jordan sighs.");
    expect(out.body).toBe("Fine.");
    expect(containsRawArtifacts(out.body)).toBe(false);
  });
});

describe("text-to-speech receives exactly what is shown", () => {
  it("matches the rendered bubble body", () => {
    const replies = [
      "(sighs) I literally did all the dishes.",
      "(beat) You always do this.",
      '{"reply":"(pause) Okay. I hear you."}',
      "Fine. What do you want me to do?",
    ];
    replies.forEach((reply) => {
      const rendered = renderCounterpartMessage(reply, JORDAN);
      expect(speechTextFor(reply, JORDAN)).toBe(rendered.body);
      expect(containsRawArtifacts(speechTextFor(reply, JORDAN))).toBe(false);
    });
  });

  it("never sends a beat or marker to the voice", () => {
    expect(speechTextFor("(beat) I know.", JORDAN)).toBe("I know.");
    expect(speechTextFor("(sighs) I know.", JORDAN)).toBe("I know.");
  });
});

describe("speaker identity", () => {
  it("extracts a short name for labels", () => {
    expect(counterpartName("Jordan — your partner")).toBe("Jordan");
    expect(counterpartName("Sam — your partner of four years")).toBe("Sam");
    expect(counterpartName("Chris — your older brother")).toBe("Chris");
    expect(counterpartName("Tom — a close friend")).toBe("Tom");
    expect(counterpartName("Your mom")).toBe("Your mom");
    expect(counterpartName("Your dad")).toBe("Your dad");
  });

  it("produces a usable label for every shipped scenario", () => {
    SCENARIOS.forEach((s) => {
      const name = counterpartName(s.counterpart);
      expect(name.length).toBeGreaterThan(0);
      expect(name).not.toContain("—");
      expect(name.length).toBeLessThanOrEqual(s.counterpart.length);
    });
  });

  it("lowercases descriptive names inside a sentence only", () => {
    expect(counterpartInSentence("Your mom")).toBe("your mom");
    expect(counterpartInSentence("Jordan — your partner")).toBe("Jordan");
  });
});

describe("failure recovery copy", () => {
  it("is friendly, names the partner, and exposes nothing technical", () => {
    const msg = turnFailureMessage(JORDAN);
    expect(msg).toBe("Jordan's response didn't come through. Try that turn again.");
    expect(containsRawArtifacts(msg)).toBe(false);
    ["JSON", "parse", "undefined", "null", "token", "error"].forEach((word) => {
      expect(msg.toLowerCase()).not.toContain(word.toLowerCase());
    });
  });

  it("works for descriptive counterparts", () => {
    expect(turnFailureMessage("Your mom")).toBe(
      "Your mom's response didn't come through. Try that turn again.",
    );
  });
});

describe("containsRawArtifacts guard", () => {
  it("flags transport artifacts", () => {
    expect(containsRawArtifacts('{"reply":"hi"}')).toBe(true);
    expect(containsRawArtifacts("```json")).toBe(true);
    expect(containsRawArtifacts("reply: hi")).toBe(true);
    expect(containsRawArtifacts("tension: 40")).toBe(true);
  });

  it("passes clean conversational text", () => {
    expect(containsRawArtifacts("I did all the dishes. Twice.")).toBe(false);
    expect(containsRawArtifacts("Jordan sighs.")).toBe(false);
    expect(containsRawArtifacts("Wait — what do you mean by 'more evenly'?")).toBe(false);
  });
});
