import { APPROVED_ONBOARDING_SCENARIOS, scenarioFromApproved } from "@/constants/onboardingScenarios";
import { createOnboardingPracticeSession, normalizePracticeSession, preserveFreeRehearsalArtifact, type ActivePracticeSession } from "@/lib/practiceSession";
import { activePracticeSessionToSharedRoute, completedPracticeSessionToSharedTranscript, sharedProductAnalyticsMeta, sharedProductRouteParams } from "@/lib/sharedProductAdapters";
import { approvedUserTurn, buildFreeJourneyResult, cancelPendingResult, invalidateFreeJourney, recognizerEndState, shouldGeneratePushback, validFreeJourneyCheckpoint } from "@/lib/freeJourney";
import type { Debrief, Scenario, Turn } from "@/types/convo";
import { createSuccessfulVisualResult } from "./fixtures/freeJourneyVisual";

const turns: Turn[] = [
  { id: "opening", role: "user", text: "Can we decide who owns Tuesday pickup?" },
  { id: "pushback", role: "them", text: "Why are you making this a big deal?" },
  { id: "response", role: "user", text: "I hear that. Can you take Tuesday pickup?" },
];

const debrief: Debrief = {
  headline: "Your request stayed visible after the pushback.",
  scores: { clarity: 72, empathy: 66, assertiveness: 54, composure: 64 },
  wins: ["You returned to one answerable request."],
  flags: [{ quote: "Can you take Tuesday pickup?", issue: "You acknowledged the pushback and returned to the request.", reframe: "Keep one answerable request visible." }],
  script: ["Can you take Tuesday pickup?"],
  nextRep: "Return to one answerable request.",
};

function scenario(routeIndex = 0): Scenario {
  return scenarioFromApproved(APPROVED_ONBOARDING_SCENARIOS[routeIndex]!, "woman-hope");
}

function session(entryRoute: "real_conversation" | "recurring_problem" | "desired_skill" = "real_conversation"): ActivePracticeSession {
  const source = scenario(entryRoute === "real_conversation" ? 0 : entryRoute === "recurring_problem" ? 1 : 2);
  const created = createOnboardingPracticeSession("practice-free", "anon", source, source.goal, "defensive", 100, {
    entryRoute, provisionalModuleId: "make_a_clear_ask", selectionLabel: entryRoute,
    scenarioSource: entryRoute === "real_conversation" ? "user_supplied" : "approved_authored",
    scenarioTitle: source.title, counterpartRelationship: source.counterpart,
    counterpartDisplayLabel: source.counterpart, behavioralGoal: source.goal, persona: "woman-hope",
  });
  return preserveFreeRehearsalArtifact({ ...created, freeRehearsalTurns: turns }, turns, 200);
}

describe("Claude Design free journey contract", () => {
  test("every route reaches a personalized contract briefing without a manager fixture default", () => {
    const routes = ["real_conversation", "recurring_problem", "desired_skill"] as const;
    const briefings = routes.map((route) => activePracticeSessionToSharedRoute(session(route)));
    expect(briefings.map((briefing) => briefing.entry_route)).toEqual(routes);
    expect(new Set(briefings.map((briefing) => briefing.scenario_id)).size).toBe(3);
    briefings.forEach((briefing) => expect(`${briefing.context} ${briefing.success_target}`).not.toContain("three deliverables"));
  });

  test("changing an upstream answer invalidates every downstream acquisition value", () => {
    const complete = { ...session(), recommendation: { moduleId: "make_a_clear_ask" as const, evidenceQuote: "quote", evidenceTurnId: "response", confidence: "confirmed_quote" as const, status: "suggested" as const, supportedStrength: null, immediateAction: "ask", createdAt: 300 }, sharedResult: buildFreeJourneyResult(session(), debrief) };
    const invalidated = invalidateFreeJourney(complete, 400);
    expect(invalidated.freeRehearsalTurns).toBeUndefined();
    expect(invalidated.freeRehearsalCompletedAt).toBeUndefined();
    expect(invalidated.recommendation).toBeUndefined();
    expect(invalidated.sharedResult).toBeUndefined();
    expect(invalidated.freeJourneyCheckpoint).toBe("briefing");
  });

  test("user-first flow creates pushback only after the opening approval", () => {
    expect(shouldGeneratePushback([])).toBe(true);
    expect(shouldGeneratePushback([turns[0]!, turns[1]!])).toBe(false);
  });

  test("recognizer onend never submits", () => {
    expect(recognizerEndState("  Draft words  ")).toEqual({ pendingText: "Draft words", shouldSubmit: false });
  });

  test("typed and spoken paths create equivalent approved user turns", () => {
    expect(approvedUserTurn("spoken", "  Same line ")).toEqual({ id: "spoken", role: "user", text: "Same line" });
    expect({ ...approvedUserTurn("typed", "Same line"), id: "spoken" }).toEqual(approvedUserTurn("spoken", "Same line"));
  });

  test("analysis result uses one approved rehearsal and keeps Practice Shift structured", () => {
    const result = buildFreeJourneyResult(session(), debrief);
    const transcript = completedPracticeSessionToSharedTranscript(session());
    expect(result.pressure_moment?.opening_turn_id).toBe(transcript.turns[0]?.id);
    expect(result.pressure_moment?.pushback_turn_id).toBe(transcript.turns[1]?.id);
    expect(result.pressure_moment?.pressure_response_turn_id).toBe(transcript.turns[2]?.id);
    expect(result.practice_shift?.current_pattern_steps).toHaveLength(3);
    expect(result.practice_shift?.practice_target_steps.length).toBeGreaterThan(1);
    expect(result.practice_shift?.caveat).toBe("A practice target, not a result you’ve already achieved.");
  });

  test("legacy fixture scores never become production signal defaults", () => {
    const result = buildFreeJourneyResult(session(), debrief);
    expect(result.signals.map((signal) => signal.score)).toEqual([null, null, null, null, null, null]);
    expect(result.signals.every((signal) => signal.observation_status === "insufficient_evidence")).toBe(true);
    expect(result.starting_index).toMatchObject({ index_value: null, observed_count: 0, total_signal_count: 6 });
    expect(JSON.stringify(result)).not.toContain('"score":72');
  });

  test("test-only successful visual result averages only its three evidence-linked signals", () => {
    const current = session();
    const fixture = createSuccessfulVisualResult(completedPracticeSessionToSharedTranscript(current));
    expect(fixture.starting_index).toMatchObject({ index_value: 64, observed_count: 3, total_signal_count: 6 });
    expect(fixture.signals.map((signal) => signal.score)).toEqual([72, 66, 54, null, null, null]);
    expect(fixture.signals.slice(0, 3).every((signal) => signal.evidence_turn_ids.length > 0)).toBe(true);
    expect(fixture.signals.slice(3).every((signal) => signal.observation_status === "unobserved" && signal.evidence_turn_ids.length === 0)).toBe(true);
    expect(fixture.first_focus).toMatchObject({
      first_focus_key: "visual-fixture-specific-after-pushback",
      first_focus_label: "Stay specific after pushback.",
      recommended_module_id: "stay_clear_under_pushback",
    });
    expect(new Set([
      fixture.first_focus?.first_focus_key,
      fixture.first_focus?.first_focus_label,
      fixture.first_focus?.recommended_module_id,
    ]).size).toBe(3);
  });

  test("successful visual fixture remains outside every production source root", async () => {
    const productionSources = [
      "../app/_layout.tsx",
      "../app/debrief/[id].tsx",
      "../app/rehearse/[id].tsx",
      "../components/FreeJourneyResults.tsx",
      "../lib/freeJourney.ts",
      "../lib/practiceSession.ts",
      "../providers/store.tsx",
    ];
    for (const relativePath of productionSources) {
      const source = await Bun.file(`${import.meta.dir}/${relativePath}`).text();
      expect(source).not.toContain("freeJourneyVisual");
      expect(source).not.toContain("visual-fixture-specific-after-pushback");
    }
    const runtime = await Bun.file(`${import.meta.dir}/../lib/freeJourney.ts`).text();
    expect(runtime).not.toContain("score: 72");
    expect(runtime).not.toContain("score: 66");
    expect(runtime).not.toContain("score: 54");
  });

  test("visual fixture preserves the approved narrow two-column Practice Shift wording", () => {
    const fixture = createSuccessfulVisualResult(completedPracticeSessionToSharedTranscript(session()));
    expect(fixture.practice_shift?.current_pattern_steps).toEqual([
      "Clear request",
      "They push back",
      "You acknowledge, then add history",
      "The decision disappears",
    ]);
    expect(fixture.practice_shift?.practice_target_steps).toEqual([
      "Clear request",
      "They push back",
      "Acknowledge the concern",
      "Return to one answerable decision",
    ]);
    expect(fixture.practice_shift?.caveat).toBe("A practice target, not a result you’ve already achieved.");
  });

  test("first-focus label stays separate from the module ID and evidence", () => {
    const result = buildFreeJourneyResult(session(), debrief);
    expect(result.first_focus?.first_focus_label).toBe("Stay Clear Under Pushback");
    expect(result.first_focus?.recommended_module_id).toBe("stay_clear_under_pushback");
    expect(result.first_focus?.first_focus_label).not.toBe(result.first_focus?.recommended_module_id);
  });

  test("safety cancellation rolls generation back and prevents stale result recovery", () => {
    const generating = { ...session(), freeJourneyCheckpoint: "generating" as const };
    const cancelled = cancelPendingResult(generating, 500);
    expect(cancelled.freeJourneyCheckpoint).toBe("transcript_review");
    expect(cancelled.sharedResult).toBeUndefined();
    expect(cancelled.recommendation).toBeUndefined();
  });

  test("restart resumes the furthest valid local checkpoint", () => {
    const reviewed = { ...session(), freeRehearsalCompletedAt: undefined, freeJourneyCheckpoint: "transcript_review" as const };
    expect(validFreeJourneyCheckpoint(reviewed)).toBe("transcript_review");
    const generating = session();
    expect(validFreeJourneyCheckpoint(generating)).toBe("generating");
    const restored = normalizePracticeSession(JSON.parse(JSON.stringify(generating)) as unknown);
    expect(restored && validFreeJourneyCheckpoint(restored)).toBe("generating");
  });

  test("analytics and route params exclude all sensitive content", () => {
    const current = session();
    const route = activePracticeSessionToSharedRoute(current);
    const transcript = completedPracticeSessionToSharedTranscript(current);
    const exposed = JSON.stringify({ analytics: sharedProductAnalyticsMeta(route, transcript), params: sharedProductRouteParams(route, current.id) });
    turns.forEach((turn) => expect(exposed).not.toContain(turn.text));
    expect(exposed).not.toContain(route.context);
    expect(exposed).not.toContain(route.success_target);
  });

  test("both approved user turns remain editable before complete transcript approval", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain('accessibilityLabel="Edit your opening"');
    expect(source).toContain('accessibilityLabel="Edit your response under pressure"');
    expect(source).toContain('label="Approve transcript"');
    expect(source.indexOf("approveTranscript")).toBeLessThan(source.indexOf("analyzeApprovedTranscript(approvedTurns)"));
  });

  test("audio failure keeps counterpart response text visible", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain('help: audioFailureMessage(counterpart)');
    expect(source).toContain('text={t.text}');
    expect(source).toContain('Keep reading');
  });

  test("result interactions are explicit, reversible, and reduce-motion safe", async () => {
    const source = await Bun.file(`${import.meta.dir}/../components/FreeJourneyResults.tsx`).text();
    expect(source).toContain('label="See my practice path"');
    expect(source).toContain('accessibilityLabel="Back to Starting Index"');
    expect(source).toContain('showResultCard("path")');
    expect(source).toContain('showResultCard("index")');
    expect(source).toContain("if (isReduced)");
    expect(source).toContain("cardProgress.setValue(1)");
    expect(source).toContain('accessibilityLabel="How BYSI read this"');
  });

  test("the approved opening framing and CTA remain byte-for-byte present", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(source).toContain("Build the qualities of world-class communicators.");
    expect(source).toContain("Obama’s clarity, Oprah’s connection, Jobs’ storytelling, and Voss’s calm under pressure.");
    expect(source).toContain('label="Build my communication skills"');
  });
});
