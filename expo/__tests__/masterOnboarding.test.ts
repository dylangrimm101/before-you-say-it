import { describe, expect, test } from "bun:test";

import { DESIRED_SHIFTS, DESIRED_SKILLS, PRESSURE_CONDITIONS, RECURRING_PROBLEMS } from "@/constants/modules";
import {
  APPROVED_ONBOARDING_SCENARIOS,
  approvedScenarioForContext,
  behavioralGoal,
  expectedReactionLabel,
  personaForContext,
  scenarioFromApproved,
} from "@/constants/onboardingScenarios";
import { createOnboardingPracticeSession, normalizePracticeSession, preserveFreeRehearsalArtifact } from "@/lib/practiceSession";
import type { ReactionPattern, Scenario, Turn } from "@/types/convo";

const expectedContexts = ["Work", "Partner or co-parent", "Family member", "Friend"];

function sessionFor(scenarioIndex = 0) {
  const approved = APPROVED_ONBOARDING_SCENARIOS[scenarioIndex]!;
  const persona = personaForContext(approved.category);
  const scenario = scenarioFromApproved(approved, persona);
  return {
    schemaVersion: 6 as const,
    id: "practice-master",
    anonymousUserId: "anon-master",
    scenarioId: scenario.id,
    category: scenario.category,
    counterpart: scenario.counterpart,
    topic: scenario.situation,
    usefulOutcome: scenario.goal,
    expectedReaction: "defensive" as const,
    safetyStatus: "cleared" as const,
    moduleVersion: "test",
    entryRoute: "desired_skill" as const,
    provisionalModuleId: "get_to_the_point" as const,
    selectionLabel: "Organize my thoughts and get to the point",
    scenarioSource: "approved_authored" as const,
    scenarioTitle: scenario.title,
    counterpartRelationship: approved.counterpartRelationship,
    counterpartDisplayLabel: scenario.counterpart,
    behavioralGoal: behavioralGoal("desired_skill", "get_to_the_point"),
    persona,
    pilotRuns: {},
    freeJourneyCheckpoint: "briefing" as const,
    nextState: "awaiting_onboarding_baseline" as const,
    createdAt: 100,
    updatedAt: 100,
  };
}

describe("web-parity onboarding scenario source", () => {
  test("contains all four authored contexts and the Family scenario", () => {
    expect(APPROVED_ONBOARDING_SCENARIOS).toHaveLength(4);
    expect(APPROVED_ONBOARDING_SCENARIOS.map((item) => item.contextLabel)).toEqual(expectedContexts);
    expect(APPROVED_ONBOARDING_SCENARIOS.find((item) => item.category === "family")?.situation).toContain("sister");
  });

  test("builds a user-first four-turn simulation with authored resistance fallbacks", () => {
    APPROVED_ONBOARDING_SCENARIOS.forEach((approved) => {
      const persona = personaForContext(approved.category);
      const scenario = scenarioFromApproved(approved, persona);
      expect(scenario.id).toBe(approved.id);
      expect(scenario.situation).toBe(approved.situation);
      expect(scenario.counterpart).toBe(approved.category === "work" ? "Adam" : "Hope");
      expect(scenario.opensWith).toBe("user");
      expect(approved.authoredPushback.length).toBeGreaterThan(20);
      expect(approved.authoredClose.length).toBeGreaterThan(20);
    });
  });
});

describe("bounded native onboarding deck", () => {
  test("keeps visited questions mounted in an internally scrollable pinned stack", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("Array.from({ length: step + 1 }");
    expect(onboarding).toContain("top: 6 + cardStep * 12");
    expect(onboarding).toContain("zIndex: (cardStep + 1) * 10");
    expect(onboarding).toContain('questionDeck: { flex: 1, position: "relative", marginHorizontal: 20 }');
    expect(onboarding).toContain("scrollEnabled={!disabled}");
    expect(onboarding).toContain('keyboardDismissMode="interactive"');
  });

  test("uses 140 ms selection confirmation before 430 ms motion", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("const DECK_DURATION = 430");
    expect(onboarding).toContain("const SELECTION_CONFIRMATION_MS = 140");
    expect(onboarding).toContain("isReduced ? 0 : SELECTION_CONFIRMATION_MS");
    expect(onboarding).toContain("screenHeight * 0.92");
    expect(onboarding).toContain("screenHeight * 0.96");
  });

  test("clears every downstream answer when an earlier route answer changes", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("const clearAfterEntry");
    for (const reset of ["setModuleId(null)", "setSelectionLabel(\"\")", "setFocus(null)", "setReaction(null)", "setSituation(\"\")", "setOutcome(\"\")"]) {
      expect(onboarding).toContain(reset);
    }
    expect(onboarding).toContain('setModuleId(nextModuleId); setSelectionLabel(label); setReaction(null); setFocus(null)');
    expect(onboarding).toContain('setSituation(\"\"); setOutcome(\"\"); setReaction(null)');
    expect(onboarding).toContain('setSituation(value); setOutcome(\"\"); setReaction(null)');
    expect(onboarding).toContain('setOutcome(value); setReaction(null)');
    expect(onboarding).toContain('animateTo(Math.max(0, step - 1), "back")');
  });
});

describe("the three entry routes use the web question graph", () => {
  test("Route A asks context, situation, success target, and expected reaction", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    for (const copy of ["Who is this with?", "What’s the conversation about?", "What would a useful outcome be?", "How do they usually respond?"]) {
      expect(onboarding).toContain(copy);
    }
    expect(onboarding).toContain("Agrees in the moment, but nothing changes");
    expect(onboarding).toContain("I’m not sure. Surprise me");
  });

  test("Routes B and C ask the required shift, pressure, and context questions", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("When this pattern starts, what would you most like to do differently?");
    expect(onboarding).toContain("What usually makes that hardest?");
    expect(onboarding).toContain("Where would this skill help most?");
    expect(onboarding).toContain("approvedScenarioForContext(selectedFocus)");
    expect(onboarding).not.toContain("Have something specific in mind? Use your own conversation");
  });

  test("assigns Adam to Work and Hope to every other acquisition context", () => {
    expect(personaForContext("work")).toBe("man-adam");
    expect(personaForContext("partner")).toBe("woman-hope");
    expect(personaForContext("family")).toBe("woman-hope");
    expect(personaForContext("friends")).toBe("woman-hope");
  });

  test("keeps route goals observable and behavioral", () => {
    expect(behavioralGoal("desired_skill", "get_to_the_point")).toBe("Organize your thoughts and get to the point.");
    expect(expectedReactionLabel("turns-back")).toContain("turn it back");
  });
});

describe("complete onboarding route walkthroughs", () => {
  test("Route A carries context, situation, outcome, reaction, and Hope into rehearsal", () => {
    const situation = "My friend keeps postponing repayment, and I need to ask for a firm date.";
    const outcome = "Say the request clearly";
    const persona = personaForContext("friends");
    const scenario: Scenario = {
      id: "onboarding-route-a",
      category: "friends",
      title: "Your conversation",
      counterpart: "Hope",
      situation,
      persona: "Play the learner’s friend in this exact in-person situation.",
      goal: outcome,
      opensWith: "user",
      openingLine: "",
      minutes: 5,
      isCustom: true,
      counterpartGender: "woman",
    };

    const session = createOnboardingPracticeSession("route-a-session", "anon-a", scenario, outcome, "turns-back", 100, {
      entryRoute: "real_conversation",
      scenarioSource: "user_supplied",
      scenarioTitle: scenario.title,
      counterpartRelationship: "Friend",
      counterpartDisplayLabel: scenario.counterpart,
      behavioralGoal: behavioralGoal("real_conversation", undefined, outcome),
      persona,
    });

    expect(session).toMatchObject({
      scenarioId: "onboarding-route-a",
      category: "friends",
      topic: situation,
      usefulOutcome: outcome,
      expectedReaction: "turns-back",
      entryRoute: "real_conversation",
      scenarioSource: "user_supplied",
      counterpartRelationship: "Friend",
      counterpartDisplayLabel: "Hope",
      behavioralGoal: outcome,
      persona: "woman-hope",
      freeJourneyCheckpoint: "briefing",
    });
  });

  test("Route B carries the revised shift and Family authored scenario into rehearsal", () => {
    const problem = RECURRING_PROBLEMS.find((item) => item.moduleId === "start_the_conversation")!;
    const shift = DESIRED_SHIFTS.find((item) => item.moduleId === "stay_clear_under_pushback")!;
    const approved = approvedScenarioForContext("family")!;
    const persona = personaForContext("family");
    const scenario = scenarioFromApproved(approved, persona);
    const session = createOnboardingPracticeSession("route-b-session", "anon-b", scenario, approved.desiredOutcome, "not-sure", 200, {
      entryRoute: "recurring_problem",
      provisionalModuleId: shift.moduleId,
      selectionLabel: shift.label,
      scenarioSource: "approved_authored",
      scenarioTitle: scenario.title,
      counterpartRelationship: approved.counterpartRelationship,
      counterpartDisplayLabel: scenario.counterpart,
      behavioralGoal: behavioralGoal("recurring_problem", shift.moduleId),
      persona,
    });

    expect(problem.label).toContain("starting hard conversations");
    expect(session).toMatchObject({
      scenarioId: "approved-family-comments",
      category: "family",
      expectedReaction: "not-sure",
      entryRoute: "recurring_problem",
      provisionalModuleId: "stay_clear_under_pushback",
      selectionLabel: "Stay with my point after pushback",
      scenarioSource: "approved_authored",
      counterpartRelationship: "Sister",
      counterpartDisplayLabel: "Hope",
      behavioralGoal: "Stay with the point after pushback.",
      persona: "woman-hope",
      freeJourneyCheckpoint: "briefing",
    });
  });

  test("Route C carries the chosen skill, pressure reaction, and Work authored scenario into rehearsal", () => {
    const skill = DESIRED_SKILLS.find((item) => item.moduleId === "get_to_the_point")!;
    const pressure = PRESSURE_CONDITIONS.find((item) => item.reaction === "turns-back")!;
    const approved = approvedScenarioForContext("work")!;
    const persona = personaForContext("work");
    const scenario = scenarioFromApproved(approved, persona);
    const reaction = pressure.reaction as ReactionPattern;
    const session = createOnboardingPracticeSession("route-c-session", "anon-c", scenario, approved.desiredOutcome, reaction, 300, {
      entryRoute: "desired_skill",
      provisionalModuleId: skill.moduleId,
      selectionLabel: pressure.label,
      scenarioSource: "approved_authored",
      scenarioTitle: scenario.title,
      counterpartRelationship: approved.counterpartRelationship,
      counterpartDisplayLabel: scenario.counterpart,
      behavioralGoal: behavioralGoal("desired_skill", skill.moduleId),
      persona,
    });

    expect(session).toMatchObject({
      scenarioId: "approved-work-combative",
      category: "work",
      expectedReaction: "turns-back",
      entryRoute: "desired_skill",
      provisionalModuleId: "get_to_the_point",
      selectionLabel: "They turn the issue back on me",
      scenarioSource: "approved_authored",
      counterpartRelationship: "Work colleague",
      counterpartDisplayLabel: "Adam",
      behavioralGoal: "Organize your thoughts and get to the point.",
      persona: "man-adam",
      freeJourneyCheckpoint: "briefing",
    });
  });
});

describe("briefing, consent, and four-turn rehearsal", () => {
  test("ends the concrete briefing at the before-you-answer guidance", async () => {
    const briefing = await Bun.file(`${import.meta.dir}/../components/RehearsalBriefing.tsx`).text();
    for (const copy of ["BEFORE WE START", "Context", "Situation", "Your goal", "Likely pressure", "BEFORE YOU ANSWER"]) {
      expect(briefing).toContain(copy);
    }
    for (const removedCopy of ["Microphone requested only after you start.", "Privacy &amp; details", "This doesn’t feel safe", "You › Them › You › Them"]) {
      expect(briefing).not.toContain(removedCopy);
    }
  });

  test("keeps briefing, permission, and practice as separate states", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(rehearsal).toContain('type RehearsalStage = "briefing" | "permission" | "practice"');
    expect(rehearsal).toContain('label="Start my rehearsal"');
    expect(rehearsal).toContain('setRehearsalStage("permission")');
    expect(rehearsal).toContain('label={permissionBusy ? "Checking microphone…" : "Allow microphone"}');
    expect(rehearsal).toContain('label="Type this turn instead"');
    expect(rehearsal).toContain('accessibilityLabel="Not now"');
  });

  test("waits for the counterpart close before transcript review", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(rehearsal).toContain('roles === "user,them,user,them"');
    expect(rehearsal).toContain('turns[turns.length - 1]?.role === "them"');
    expect(rehearsal).toContain("counterpartTurns[1]?.text");
    expect(rehearsal).toContain("shouldGeneratePushback(turns)");
  });

  test("persists and restores the complete four-turn exchange", () => {
    const turns: Turn[] = [
      { id: "u1", role: "user", text: "I need us to decide what changes." },
      { id: "t1", role: "them", text: "I don’t think this is a real problem." },
      { id: "u2", role: "user", text: "I am asking for one specific change." },
      { id: "t2", role: "them", text: "What exactly are you asking me to change?" },
    ];
    const completed = preserveFreeRehearsalArtifact(sessionFor(), turns, 200);
    const restored = normalizePracticeSession(JSON.parse(JSON.stringify(completed)));
    expect(restored?.freeRehearsalTurns).toEqual(turns);
    expect(restored?.freeRehearsalCompletedAt).toBe(200);
  });
});
