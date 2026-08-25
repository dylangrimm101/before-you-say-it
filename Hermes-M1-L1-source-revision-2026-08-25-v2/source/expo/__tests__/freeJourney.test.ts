import { APPROVED_ONBOARDING_SCENARIOS, scenarioFromApproved } from "@/constants/onboardingScenarios";
import type { BysiResultResponse } from "@/lib/ai";
import { createOnboardingPracticeSession, normalizePracticeSession, preserveFreeRehearsalArtifact, type ActivePracticeSession } from "@/lib/practiceSession";
import { activePracticeSessionToSharedRoute, completedPracticeSessionToSharedTranscript, sharedProductAnalyticsMeta, sharedProductRouteParams } from "@/lib/sharedProductAdapters";
import { approvedUserTurn, buildFreeJourneyResult, cancelPendingResult, clearerSpokenRequest, invalidateFreeJourney, isDirectSpokenRequest, recognizerEndState, shouldGeneratePushback, validFreeJourneyCheckpoint } from "@/lib/freeJourney";
import type { Debrief, Scenario, Turn } from "@/types/convo";
import {
  SUCCESSFUL_VISUAL_APPROVED_TURNS,
  createSuccessfulVisualResult,
  createSuccessfulVisualTranscript,
} from "./fixtures/freeJourneyVisual";

const turns: Turn[] = [
  { id: "opening", role: "user", text: "Can we decide who owns Tuesday pickup?" },
  { id: "pushback", role: "them", text: "Why are you making this a big deal?" },
  { id: "response", role: "user", text: "I hear that. Can you take Tuesday pickup?" },
  { id: "close", role: "them", text: "I’m not agreeing yet. What would taking Tuesday actually involve?" },
];

const analysis: BysiResultResponse = {
  mode: "result",
  starting_index: {
    overall: 64,
    observed_dimensions: [
      { name: "Clarity", score: 72, evidence: "The opening made the topic visible." },
      { name: "Specificity", score: 66, evidence: "The response returned to one answerable request." },
      { name: "Steadiness", score: 54, evidence: "The request remained available after pushback." },
    ],
    unobserved_dimensions: ["Listening", "Boundaries", "Repair"],
  },
};

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
    const complete = { ...session(), recommendation: { moduleId: "make_a_clear_ask" as const, evidenceQuote: "quote", evidenceTurnId: "response", confidence: "confirmed_quote" as const, status: "suggested" as const, supportedStrength: null, immediateAction: "ask", createdAt: 300 }, sharedResult: buildFreeJourneyResult(session(), debrief, analysis) };
    const invalidated = invalidateFreeJourney(complete, 400);
    expect(invalidated.freeRehearsalTurns).toBeUndefined();
    expect(invalidated.freeRehearsalCompletedAt).toBeUndefined();
    expect(invalidated.recommendation).toBeUndefined();
    expect(invalidated.sharedResult).toBeUndefined();
    expect(invalidated.freeJourneyCheckpoint).toBe("briefing");
  });

  test("user-first flow gives both approved learner turns a counterpart response", () => {
    expect(shouldGeneratePushback([])).toBe(true);
    expect(shouldGeneratePushback([turns[0]!, turns[1]!])).toBe(true);
    expect(shouldGeneratePushback(turns)).toBe(false);
  });

  test("recognizer onend never submits", () => {
    expect(recognizerEndState("  Draft words  ")).toEqual({ pendingText: "Draft words", shouldSubmit: false });
  });

  test("typed and spoken paths create equivalent approved user turns", () => {
    expect(approvedUserTurn("spoken", "  Same line ")).toEqual({ id: "spoken", role: "user", text: "Same line" });
    expect({ ...approvedUserTurn("typed", "Same line"), id: "spoken" }).toEqual(approvedUserTurn("spoken", "Same line"));
  });

  test("clearer version rejects coaching advice and returns dialogue grounded in the issue", () => {
    const context = { category: "partner" as const, topic: "Help more with chores around the house", usefulOutcome: "Agree on specific household responsibilities." };
    const clearer = clearerSpokenRequest(
      "I need your help more with chores around the house.",
      "Pick one concrete task to raise first.",
      context,
    );
    expect(clearer).toBe("Can you take one recurring chore this week without me having to remind or track it?");
    expect(isDirectSpokenRequest(clearer)).toBe(true);
    expect(isDirectSpokenRequest("Try asking for one concrete task.")).toBe(false);
  });

  test("clearer version preserves a usable provider-written spoken request", () => {
    const spoken = "Can you fully own the dishes on weeknights this week without me reminding you?";
    expect(clearerSpokenRequest("I need more help.", spoken, {
      category: "partner",
      topic: "Dishes on weeknights",
      usefulOutcome: "Share the chores",
    })).toBe(spoken);
  });

  test("clearer version covers the approved work, repayment, and family behaviors", () => {
    expect(clearerSpokenRequest("My manager keeps adding work after we agree on scope.", "Focus on priorities.", {
      category: "work", topic: "Changing scope", usefulOutcome: "Protect the agreed scope",
    })).toBe("Can we decide what priority moves before I take on the new work?");
    expect(clearerSpokenRequest("You still haven’t paid me back.", undefined, {
      category: "friends", topic: "Late repayment", usefulOutcome: "Agree on a payment plan",
    })).toBe("Can you send the first payment by Friday and tell me when the rest is coming?");
    expect(clearerSpokenRequest("My sister keeps making jokes about me in front of everyone.", undefined, {
      category: "family", topic: "Public comments", usefulOutcome: "Stop the comments",
    })).toBe("Can you talk to me privately instead of making comments about my choices in front of other people?");
  });

  test("analysis result uses one approved rehearsal and keeps Practice Shift structured", () => {
    const result = buildFreeJourneyResult(session(), debrief, analysis);
    const transcript = completedPracticeSessionToSharedTranscript(session());
    expect(result.pressure_moment?.opening_turn_id).toBe(transcript.turns[0]?.id);
    expect(result.pressure_moment?.pushback_turn_id).toBe(transcript.turns[1]?.id);
    expect(result.pressure_moment?.pressure_response_turn_id).toBe(transcript.turns[2]?.id);
    expect(result.rewrite?.original_ask).toBe(transcript.turns[0]?.approved_text);
    expect(result.rewrite?.clearer_version).toBe("Can you take Tuesday pickup?");
    expect(isDirectSpokenRequest(result.rewrite?.clearer_version)).toBe(true);
    expect(result.practice_shift?.current_pattern_steps).toHaveLength(3);
    expect(result.practice_shift?.practice_target_steps.length).toBeGreaterThan(1);
    expect(result.practice_shift?.caveat).toBe("A practice target, not a result you’ve already achieved.");
  });

  test("maps provider Starting Index dimensions instead of creating a placeholder empty index", () => {
    const result = buildFreeJourneyResult(session(), debrief, analysis);
    expect(result.signals.map((signal) => signal.score)).toEqual([72, 66, 54, null, null, null]);
    expect(result.signals.slice(0, 3).every((signal) => signal.observation_status === "observed")).toBe(true);
    expect(result.starting_index).toMatchObject({ index_value: 64, observed_count: 3, total_signal_count: 6 });
    expect(result.signals[0]?.evidence_summary).toBe("The opening made the topic visible.");
  });

  test("test-only successful visual result averages only its three evidence-linked signals", () => {
    const fixture = createSuccessfulVisualResult(createSuccessfulVisualTranscript());
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

  test("successful visual fixture ties its approved response and all coaching evidence to one rehearsal", () => {
    const transcript = createSuccessfulVisualTranscript();
    const fixture = createSuccessfulVisualResult(transcript);
    const response = transcript.turns.find((turn) => turn.turn_kind === "pressure_response");
    expect(response).toMatchObject(SUCCESSFUL_VISUAL_APPROVED_TURNS.response);
    expect(fixture.rehearsal_id).toBe(transcript.rehearsal_id);
    expect(fixture.pressure_moment).toMatchObject({
      headline: "You were clear until the pushback.",
      opening_turn_id: SUCCESSFUL_VISUAL_APPROVED_TURNS.opening.id,
      pushback_turn_id: SUCCESSFUL_VISUAL_APPROVED_TURNS.pushback.id,
      pressure_response_turn_id: SUCCESSFUL_VISUAL_APPROVED_TURNS.response.id,
    });
    expect(fixture.pressure_moment?.observation).toContain("answerable decision disappeared");
    expect(fixture.practice_shift?.current_pattern_steps.at(-1)).toBe("The decision disappears");
    expect(fixture.practice_shift?.practice_target_steps.at(-1)).toBe("Return to one answerable decision");
    expect(fixture.practice_shift?.first_focus_key).toBe(fixture.first_focus?.first_focus_key);
    expect(fixture.practice_shift?.first_focus_label).toBe("Stay specific after pushback.");
    expect(fixture.practice_shift?.recommended_module_id).toBe(fixture.first_focus?.recommended_module_id);
    for (const signal of fixture.signals.filter((item) => item.observation_status === "observed")) {
      signal.evidence_turn_ids.forEach((id) => expect(transcript.turns.some((turn) => turn.id === id)).toBe(true));
    }
  });

  test("successful visual fixture rejects a different approved exchange", () => {
    const transcript = createSuccessfulVisualTranscript();
    transcript.turns[2] = { ...transcript.turns[2]!, approved_text: "Which priority should move?" };
    expect(() => createSuccessfulVisualResult(transcript)).toThrow("one approved transcript fixture");
  });

  test("visual fixture preserves the approved narrow two-column Practice Shift wording", () => {
    const fixture = createSuccessfulVisualResult(createSuccessfulVisualTranscript());
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
    const result = buildFreeJourneyResult(session(), debrief, analysis);
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

  test("the local privacy route keeps truthful current-build claims", async () => {
    const layout = await Bun.file(`${import.meta.dir}/../app/_layout.tsx`).text();
    const privacy = await Bun.file(`${import.meta.dir}/../app/privacy.tsx`).text();
    expect(layout).toContain('firstSegment === "privacy"');
    expect(layout).toContain("canInterruptFreeJourney");
    expect(privacy).toContain("Privacy &amp; details");
    expect(privacy).toContain("This build does not provide an account or cross-device recovery.");
    expect(privacy).toContain("Each saved session keeps a minimized record of the scenario, date, completion details, and result summary when one is available. It does not keep the rehearsal transcript.");
    expect(privacy).toContain("Raw audio is not stored by this app.");
    expect(privacy).toContain("A recording is sent once for transcription");
    expect(privacy).not.toContain("your four scores");
    expect(privacy).not.toContain("Keep baseline recordings on this device");
    expect(privacy).not.toContain("unless you opt in to keep baseline audio below");
    expect(privacy).not.toContain("if you later sign in");
    expect(privacy).not.toContain("It is never uploaded");
    expect(privacy).not.toContain("privacy policy URL");
  });

  test("current dictation callers cannot retain or play baseline audio", async () => {
    const dictation = await Bun.file(`${import.meta.dir}/../lib/useDictation.ts`).text();
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    const productionCallers = [
      rehearsal,
      await Bun.file(`${import.meta.dir}/../app/custom.tsx`).text(),
      await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text(),
    ].join("\n");
    expect(dictation).toContain("keepAudioAs?: string");
    expect(productionCallers).not.toContain("keepAudioAs:");
    expect(productionCallers).not.toContain("baselineAudioUri");
    expect(productionCallers).not.toContain("keepBaselineAudio");
  });

  test("privacy deletion promises match saved-record, script, ephemeral-content, audio, and active-handoff behavior", async () => {
    const store = await Bun.file(`${import.meta.dir}/../providers/store.tsx`).text();
    const privacy = await Bun.file(`${import.meta.dir}/../app/privacy.tsx`).text();
    const deleteOne = store.slice(store.indexOf("const deleteSession"), store.indexOf("const deleteAllSessions"));
    const deleteAll = store.slice(store.indexOf("const deleteAllSessions"), store.indexOf("const addCustomScenario"));
    const reset = store.slice(store.indexOf("const reset"), store.indexOf("const findScenario"));

    expect(deleteOne).toContain("prev.filter((s) => s.id !== id)");
    expect(deleteOne).toContain("clearLiveSessionContent(id)");
    expect(deleteOne).toContain("deleteBaselineAudioStrict(id)");
    expect(deleteOne).toContain("AsyncStorage.setItem(KEYS.sessions");
    expect(deleteOne).not.toContain("saveActivePracticeSession(null)");
    expect(deleteAll).toContain("setSessions([])");
    expect(deleteAll).toContain("clearLiveSessionContent()");
    expect(deleteAll).toContain("deleteAllBaselineAudioStrict()");
    expect(deleteAll).toContain("AsyncStorage.removeItem(KEYS.sessions)");
    expect(reset).toContain("setActivePracticeSession(null)");
    expect(reset).toContain("KEYS.activePracticeSession");
    expect(privacy).toContain("Deleting the saved session record deletes those lines.");
    expect(privacy).toContain("The separate active Day 1 handoff stays available for restart or resume.");
    expect(privacy).toContain("Reset all app data to remove the separate active Day 1 handoff too.");
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
    expect(source).toContain("skillBubbleProgress.forEach((progress) => progress.setValue(1))");
    expect(source).toContain("const entrance = Animated.stagger(");
    expect(source).toContain("outputRange: [10, 0]");
    expect(source).not.toContain("How BYSI read this");
    expect(source).toContain("styles.signalChips");
    expect(source).toContain("styles.startingIndexBadge");
  });

  test("the approved opening framing is the first account gateway", async () => {
    const entry = await Bun.file(`${import.meta.dir}/../app/entry.tsx`).text();
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(entry).toContain("Build the qualities of world-class communicators.");
    expect(entry).toContain("Obama’s clarity, Oprah’s connection, Jobs’ storytelling, and Voss’s calm under pressure.");
    expect(entry).toContain('label="Sign up now"');
    expect(entry).toContain('label="Log in"');
    expect(entry).toContain("<ConversationMark />");
    expect(entry).toContain('accessibilityLabel="Two people having a conversation"');
    expect(onboarding).toContain("useState<number>(0)");
    expect(entry).not.toContain("<Text style={styles.markText}>BYSI</Text>");
  });
});
