import { describe, expect, test } from "bun:test";

import {
  APPROVED_ONBOARDING_SCENARIOS,
  behavioralGoal,
  expectedReactionLabel,
  scenarioFromApproved,
} from "@/constants/onboardingScenarios";
import { createOnboardingPracticeSession, normalizePracticeSession, preserveFreeRehearsalArtifact } from "@/lib/practiceSession";
import type { OnboardingEntryRoute } from "@/constants/modules";
import type { Turn } from "@/types/convo";

const expectedScenarios = [
  {
    id: "approved-work-capacity",
    contextLabel: "Work",
    title: "Too much on your plate",
    preview: "Your manager adds another task when you are already at capacity.",
    situation: "Your manager has added another task, but you are already at capacity. You need to ask what should be deprioritized instead of silently absorbing more work.",
    counterpartRelationship: "Manager",
    counterpartDisplayLabel: "Your manager",
    desiredOutcome: "Agree on what should move or be deprioritized.",
  },
  {
    id: "approved-partner-chores",
    contextLabel: "Partner",
    title: "Chores keep falling back to you",
    preview: "You are still noticing and finishing chores that were supposed to be shared.",
    situation: "You and your partner agreed to split the household chores, but you are still noticing what needs doing and finishing most of it. You want clearer ownership.",
    counterpartRelationship: "Partner",
    counterpartDisplayLabel: "Your partner",
    desiredOutcome: "Agree on specific household responsibilities your partner will fully own.",
  },
  {
    id: "approved-friend-rent",
    contextLabel: "Friend",
    title: "They still owe you money",
    preview: "You covered their share of the rent, but they still have not paid you back.",
    situation: "You covered your friend’s share of the rent, but they still have not paid you back. You need them to commit to a specific repayment date.",
    counterpartRelationship: "Friend",
    counterpartDisplayLabel: "Your friend",
    desiredOutcome: "Receive a clear repayment date and plan.",
  },
] as const;

function sessionFor(entryRoute: OnboardingEntryRoute, scenarioIndex = 0) {
  const approved = APPROVED_ONBOARDING_SCENARIOS[scenarioIndex]!;
  const scenario = scenarioFromApproved(approved, "woman-hope");
  return createOnboardingPracticeSession("practice-master", "anon-master", scenario, approved.desiredOutcome, "defensive", 100, {
    entryRoute,
    provisionalModuleId: "get_to_the_point",
    selectionLabel: entryRoute === "desired_skill" ? "Say the main point clearly" : "I say too much and lose the point",
    scenarioSource: "approved_authored",
    scenarioTitle: scenario.title,
    counterpartRelationship: approved.counterpartRelationship,
    counterpartDisplayLabel: approved.counterpartDisplayLabel,
    behavioralGoal: behavioralGoal(entryRoute, "get_to_the_point", approved.desiredOutcome),
    persona: "woman-hope",
  });
}

describe("approved onboarding scenario source", () => {
  test("contains exactly the three locked scenarios with stable IDs and exact copy", () => {
    expect(APPROVED_ONBOARDING_SCENARIOS).toHaveLength(3);
    expectedScenarios.forEach((expected, index) => {
      expect(APPROVED_ONBOARDING_SCENARIOS[index]).toMatchObject(expected);
    });
  });

  test("builds user-first simulation scenarios with correct relationship labels", () => {
    APPROVED_ONBOARDING_SCENARIOS.forEach((approved) => {
      const scenario = scenarioFromApproved(approved, "man-adam");
      expect(scenario.id).toBe(approved.id);
      expect(scenario.situation).toBe(approved.situation);
      expect(scenario.counterpart).toBe(approved.counterpartDisplayLabel);
      expect(scenario.goal).toBe(approved.desiredOutcome);
      expect(scenario.opensWith).toBe("user");
    });
  });
});

describe("onboarding question deck", () => {
  test("keeps every visited question mounted as a contained 12 px pinned stack", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("<Backdrop />");
    expect(onboarding).not.toContain("<LinearGradient");
    expect(onboarding).toContain("Array.from({ length: step + 1 }");
    expect(onboarding).toContain("top: 6 + cardStep * 12");
    expect(onboarding).toContain("zIndex: (cardStep + 1) * 10");
    expect(onboarding).toContain('questionDeck: { flex: 1, position: "relative", marginHorizontal: 20 }');
    expect(onboarding).toContain('questionCard: { position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: 28');
    expect(onboarding).toContain('borderColor: "rgba(81,40,136,0.16)"');
    expect(onboarding).toContain('boxShadow: "0 1px 2px rgba(40,26,66,0.05), 0 10px 26px rgba(40,26,66,0.10), 0 30px 60px rgba(40,26,66,0.10)"');
    expect(onboarding).toContain('aria-hidden={disabled}');
    expect(onboarding).toContain('importantForAccessibility={disabled ? "no-hide-descendants" : "auto"}');
    expect(onboarding).toContain("scrollEnabled={!disabled}");
  });

  test("uses compact card type and explicit circular selection markers", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain('cardEyebrow: { ...eyebrow, color: C.dim');
    expect(onboarding).toContain('fontSize: 25, lineHeight: 30, letterSpacing: -0.45');
    expect(onboarding).toContain('fontSize: 14, lineHeight: 21, color: C.textSoft');
    expect(onboarding).toContain('fontSize: 15, lineHeight: 20.25, color: C.text');
    expect(onboarding).toContain('borderRadius: 16');
    expect(onboarding).toContain('width: 19, height: 19, borderRadius: 10, borderWidth: 1.5');
    expect(onboarding).toContain('<Text style={styles.markerCheck}>✓</Text>');
    expect(onboarding).not.toContain("<SelectionWipe");
  });

  test("confirms selections before reversible deck motion and honors reduced motion", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("const DECK_DURATION = 430");
    expect(onboarding).toContain("const SELECTION_CONFIRMATION_MS = 140");
    expect(onboarding).toContain("Easing.bezier(0.22, 0.9, 0.28, 1)");
    expect(onboarding).toContain('direction: "forward"');
    expect(onboarding).toContain('direction: "back"');
    expect(onboarding).toContain("screenHeight * 0.92");
    expect(onboarding).toContain("screenHeight * 0.96");
    expect(onboarding).toContain("outputRange: [1, 0.988]");
    expect(onboarding).toContain("isReduced ? 0 : SELECTION_CONFIRMATION_MS");
  });
});

describe("three entrances converge into the shared context and engine", () => {
  test("real conversation bypasses the picker and preserves supplied context", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("!isReal && cardStep === 2");
    expect(onboarding).toContain("scenarioSource: approved ? \"approved_authored\" : \"user_supplied\"");
    expect(onboarding).toContain("counterpart: selectedCounterpart");
    expect(onboarding).toContain("situation: description");
    expect(onboarding).toContain("goal: selectedOutcome");
  });

  test("pattern and skill use the same picker and preserve their hypothesis", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding.match(/APPROVED_ONBOARDING_SCENARIOS\.map/g)?.length).toBe(1);
    expect(onboarding).toContain("setProvisionalModuleId(moduleId)");
    expect(onboarding).toContain("setSelectionLabel(label)");
    expect(onboarding).toContain("entryRoute === \"desired_skill\"");
    expect(onboarding).toContain('id: "recurring_problem"');
  });

  test("the optional own-conversation link is secondary and preserves the selected hypothesis", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("Have something specific in mind? Use your own conversation");
    expect(onboarding).toContain('accessibilityRole="link"');
    const handoff = onboarding.slice(onboarding.indexOf("const useOwnConversation"), onboarding.indexOf("const finish"));
    expect(handoff).toContain('setEntryRoute("real_conversation")');
    expect(handoff).not.toContain("setProvisionalModuleId(null)");
    expect(handoff).not.toContain("setSelectionLabel(\"\")");
  });

  test("reuses one expected-reaction state and feeds it to both counterpart turns and debrief", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    const ai = await Bun.file(`${import.meta.dir}/../lib/ai.ts`).text();
    expect(onboarding.match(/useState<ReactionPattern \| null>/g)?.length).toBe(1);
    expect(rehearsal).toContain("nextCounterpartTurn(");
    expect(rehearsal).toContain("generateDebrief(scenario, difficulty, turns, reaction, outcome)");
    expect(ai).toContain("REACTION_BEHAVIOUR[reaction]");
    expect(expectedReactionLabel("turns-back")).toContain("turn it back");
  });

  test("keeps the pattern goal neutral and makes known-skill goals behavioral", () => {
    expect(behavioralGoal("recurring_problem", "get_to_the_point")).toBe("Say what you need as naturally and clearly as you can.");
    expect(behavioralGoal("recurring_problem", "get_to_the_point")).not.toContain("which skill");
    expect(behavioralGoal("desired_skill", "get_to_the_point")).toBe("Open clearly in one or two sentences without listing every previous incident.");
  });
});

describe("shared mobile rehearsal briefing and controls", () => {
  test("uses one concrete briefing for every onboarding path", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    const briefing = await Bun.file(`${import.meta.dir}/../components/RehearsalBriefing.tsx`).text();
    expect(rehearsal.match(/<RehearsalBriefing/g)?.length).toBe(1);
    for (const copy of ["Your real conversation", "Practice scenario", "Start it the way you naturally would.", "Your first instinct", "Your goal"]) {
      expect(briefing).toContain(copy);
    }
    expect(briefing).not.toContain("See which skill should come first");
  });

  test("has a concise untruncated header and one explicit exit", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(rehearsal).toContain('"FREE REHEARSAL"');
    expect(rehearsal).not.toContain("free rehearsal ·");
    expect(rehearsal.match(/accessibilityLabel="End rehearsal"/g)?.length).toBe(1);
    expect(rehearsal).not.toContain('accessibilityLabel="Exit rehearsal"');
    expect(rehearsal).not.toContain("<X ");
  });

  test("shows one microphone instruction beside the shared dock and keeps typed fallback", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(rehearsal.match(/Tap the mic and say your line out loud\./g)?.length).toBe(1);
    expect(rehearsal).toContain("Type instead");
    expect(rehearsal).toContain('accessibilityLabel="Type your line"');
    expect(rehearsal).toContain('"Record your line"');
  });

  test("keeps briefing, permission, and ready capture as separate states", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(rehearsal).toContain('type RehearsalStage = "briefing" | "permission" | "practice"');
    expect(rehearsal).toContain('label="Start my rehearsal"');
    expect(rehearsal).toContain('setRehearsalStage("permission")');
    expect(rehearsal).toContain('label={permissionBusy ? "Checking microphone…" : "Allow microphone"}');
    expect(rehearsal).toContain('activatePractice("voice")');
    expect(rehearsal).toContain('activatePractice("text")');
    expect(rehearsal).toContain('freeJourneyCheckpoint: "rehearsal"');
    expect(rehearsal.indexOf('rehearsalStage === "briefing"')).toBeLessThan(rehearsal.indexOf('rehearsalStage === "permission"'));
  });

  test("announces recording state and labels playback, fallback, and exit controls", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(rehearsal).toContain('accessibilityLiveRegion="polite"');
    expect(rehearsal).toContain("Stop and review your line");
    expect(rehearsal).toContain('accessibilityLabel="Type instead"');
    expect(rehearsal).toContain("Replay ${themName}'s response");
    expect(rehearsal).toContain('accessibilityLabel="End rehearsal"');
  });
});

describe("context persistence, recovery, and free boundary", () => {
  test("persists all route and briefing context and safely resumes before recording", () => {
    const session = sessionFor("recurring_problem", 0);
    expect(session.safetyStatus).toBe("cleared");
    expect(session.entryRoute).toBe("recurring_problem");
    expect(session.selectionLabel).toBe("I say too much and lose the point");
    expect(session.scenarioSource).toBe("approved_authored");
    expect(session.scenarioTitle).toBe("Too much on your plate");
    expect(session.counterpartDisplayLabel).toBe("Your manager");
    expect(session.behavioralGoal).not.toContain("which skill");
    expect(normalizePracticeSession(JSON.parse(JSON.stringify(session)))?.scenarioId).toBe("approved-work-capacity");
  });

  test("resumes after each confirmed exchange stage without changing context", () => {
    const turns: Turn[] = [
      { id: "u1", role: "user", text: "I need us to decide what moves." },
      { id: "t1", role: "them", text: "Why can't you just fit it in?" },
      { id: "u2", role: "user", text: "Please choose which current task should move." },
      { id: "t2", role: "them", text: "Fine, let's review the deadlines." },
    ];
    for (let count = 1; count <= turns.length; count += 1) {
      const staged = { ...sessionFor("desired_skill", 0), freeRehearsalTurns: turns.slice(0, count) };
      const restored = normalizePracticeSession(JSON.parse(JSON.stringify(staged)));
      expect(restored?.freeRehearsalTurns).toEqual(turns.slice(0, count));
      expect(restored?.counterpartDisplayLabel).toBe("Your manager");
    }
    const completed = preserveFreeRehearsalArtifact(sessionFor("desired_skill"), turns, 200);
    expect(completed.freeRehearsalCompletedAt).toBe(200);
    expect(completed.freeRehearsalTurns).toEqual(turns);
  });

  test("routes resume, failures, debrief, recommendation, and paywall through existing shared surfaces", async () => {
    const layout = await Bun.file(`${import.meta.dir}/../app/_layout.tsx`).text();
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    const debrief = await Bun.file(`${import.meta.dir}/../app/debrief/[id].tsx`).text();
    expect(layout).toContain('pathname: "/rehearse/[id]"');
    expect(layout).not.toContain("safety-check");
    expect(rehearsal).toContain('dockState === "mic-blocked"');
    expect(rehearsal).toContain('dockState === "mic-error"');
    expect(rehearsal).toContain('dockState === "autoplay-blocked" || dockState === "playback-failed"');
    expect(rehearsal).toContain("preserveFreeRehearsalArtifact");
    expect(rehearsal).toContain("recommendation:");
    expect(debrief).toContain('pathname: "/paywall"');
  });

  test("recovers missing scenario context without inventing a replacement", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(rehearsal).toContain("This rehearsal needs fresh context.");
    expect(rehearsal).toContain("Choose another conversation");
    expect(rehearsal).not.toContain("sample conversation");
  });
});
