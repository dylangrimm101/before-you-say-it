import { describe, expect, test } from "bun:test";

import { scenarioFromApproved, APPROVED_ONBOARDING_SCENARIOS } from "@/constants/onboardingScenarios";
import {
  activePracticeSessionToSharedProduct,
  activePracticeSessionToSharedResult,
  activePracticeSessionToSharedRoute,
  approvedNativeTurnsToSharedTranscript,
  completedPracticeSessionToSharedTranscript,
  createFirstFocus,
  hydrateSharedStateToPracticeSession,
  sharedProductAnalyticsMeta,
  sharedProductRouteParams,
  type NativeApprovedTurnCandidate,
} from "@/lib/sharedProductAdapters";
import {
  createOnboardingPracticeSession,
  normalizePracticeSession,
  preserveFreeRehearsalArtifact,
  preserveOnboardingBaseline,
  type ActivePracticeSession,
} from "@/lib/practiceSession";
import type { Scenario } from "@/types/convo";
import {
  PRACTICE_SHIFT_CAVEAT,
  PRACTICE_SHIFT_VERSION,
  PRESSURE_MOMENT_VERSION,
  SHARED_ENTRY_ROUTES,
  SHARED_FOCUS_STATUSES,
  SHARED_OBSERVATION_STATUSES,
  SHARED_ORIGINS,
  SHARED_PRODUCT_CONTRACT_VERSION,
  SHARED_SCENARIO_SOURCES,
  SHARED_SIGNAL_KEYS,
  SHARED_SPEAKERS,
  SHARED_TURN_KINDS,
  SIGNAL_VERSION,
  SharedContractError,
  calculatePartialStartingIndex,
  parseSharedRouteContract,
  validatePracticeShift,
  validatePressureMoment,
  validateSignals,
  type ActivationMilestonesV1,
  type PracticeShiftV1,
  type PressureMomentV1,
  type SharedSignalV1,
} from "@/types/sharedProduct";

const customScenario: Scenario = {
  id: "custom-rehearsal",
  category: "work",
  title: "Your conversation",
  counterpart: "Jordan, my manager",
  situation: "A deadline was added.\nWhat you want to communicate: We need to decide what moves.",
  persona: "PRIVATE GENERATED ROLEPLAY INSTRUCTION",
  goal: "Agree on one priority decision.",
  opensWith: "user",
  openingLine: "",
  minutes: 5,
  isCustom: true,
};

function sessionForRoute(entryRoute: "real_conversation" | "recurring_problem" | "desired_skill", scenario: Scenario = customScenario): ActivePracticeSession {
  return createOnboardingPracticeSession(
    "practice-shared-1",
    "anon-local",
    scenario,
    scenario.goal,
    "defensive",
    100,
    {
      entryRoute,
      scenarioSource: scenario.id.startsWith("approved-") ? "approved_authored" : "user_supplied",
      scenarioTitle: scenario.title,
      counterpartRelationship: "Manager",
      counterpartDisplayLabel: scenario.counterpart,
      behavioralGoal: "Keep the main point in view.",
      persona: "woman-hope",
    },
  );
}

const approvedCandidates: NativeApprovedTurnCandidate[] = [
  { id: "opening", sequence: 0, speaker: "user", turnKind: "opening", text: "I need us to choose what moves.", approvedAt: 1_000, approvalStatus: "approved" },
  { id: "pushback", sequence: 1, speaker: "counterpart", turnKind: "pushback", text: "Everything is a priority.", approvedAt: 1_100, approvalStatus: "approved" },
  { id: "response", sequence: 2, speaker: "user", turnKind: "pressure_response", text: "Which deadline should I move?", approvedAt: 1_200, approvalStatus: "approved" },
];

const approvedTranscript = approvedNativeTurnsToSharedTranscript("practice-shared-1", approvedCandidates);

function observedSignal(signal_key: SharedSignalV1["signal_key"], score: number, evidenceTurnId = "response"): SharedSignalV1 {
  return { signal_key, observation_status: "observed", score, evidence_turn_ids: [evidenceTurnId], signal_version: SIGNAL_VERSION };
}

function unobservedSignal(signal_key: SharedSignalV1["signal_key"]): SharedSignalV1 {
  return { signal_key, observation_status: "unobserved", score: null, evidence_turn_ids: [], signal_version: SIGNAL_VERSION };
}

describe("canonical schema parity", () => {
  test("the Metro-safe TypeScript mirror matches the repository-level canonical JSON Schema", async () => {
    const schema = await Bun.file(`${import.meta.dir}/../../shared/bysi-product-contract-v1.schema.json`).json() as {
      properties: { contract_version: { const: number } };
      $defs: Record<string, { enum?: string[] }>;
    };
    expect(schema.properties.contract_version.const).toBe(SHARED_PRODUCT_CONTRACT_VERSION);
    expect(schema.$defs.entryRoute.enum).toEqual([...SHARED_ENTRY_ROUTES]);
    expect(schema.$defs.origin.enum).toEqual([...SHARED_ORIGINS]);
    expect(schema.$defs.scenarioSource.enum).toEqual([...SHARED_SCENARIO_SOURCES]);
    expect(schema.$defs.speaker.enum).toEqual([...SHARED_SPEAKERS]);
    expect(schema.$defs.turnKind.enum).toEqual([...SHARED_TURN_KINDS]);
    expect(schema.$defs.signalKey.enum).toEqual([...SHARED_SIGNAL_KEYS]);
    expect(schema.$defs.observationStatus.enum).toEqual([...SHARED_OBSERVATION_STATUSES]);
    expect(schema.$defs.focusStatus.enum).toEqual([...SHARED_FOCUS_STATUSES]);
  });
});

describe("core route adapter", () => {
  test("maps all three approved onboarding routes", () => {
    SHARED_ENTRY_ROUTES.forEach((entryRoute) => {
      const route = activePracticeSessionToSharedRoute(sessionForRoute(entryRoute));
      expect(route.entry_route).toBe(entryRoute);
      expect(route.origin).toBe("native");
      expect(route.contract_version).toBe(1);
    });
  });

  test("maps authored and custom scenarios without leaking generated roleplay instructions", () => {
    const authoredScenario = scenarioFromApproved(APPROVED_ONBOARDING_SCENARIOS[0]!, "woman-hope");
    const authored = activePracticeSessionToSharedRoute(sessionForRoute("desired_skill", authoredScenario));
    const custom = activePracticeSessionToSharedRoute(sessionForRoute("real_conversation"));
    expect(authored.scenario_source).toBe("approved_authored");
    expect(custom.scenario_source).toBe("user_supplied");
    expect(authored.scenario_id).toBe(authoredScenario.id);
    expect(custom.context).toBe(customScenario.situation);
    expect(JSON.stringify([authored, custom])).not.toContain("Play your manager");
    expect(JSON.stringify([authored, custom])).not.toContain(customScenario.persona);
    expect(Object.keys(custom)).not.toContain("persona");
  });

  test("tolerates additive optional fields but fails closed on unknown contract versions", () => {
    const route = activePracticeSessionToSharedRoute(sessionForRoute("real_conversation"));
    expect(parseSharedRouteContract({ ...route, future_optional_field: "safe" })).toEqual(route);
    try {
      parseSharedRouteContract({ ...route, contract_version: 2 });
      throw new Error("Expected unsupported version failure");
    } catch (error) {
      expect(error).toBeInstanceOf(SharedContractError);
      expect((error as SharedContractError).code).toBe("unsupported_contract_version");
      expect((error as SharedContractError).recoverable).toBe(true);
    }
  });
});

describe("approved transcript adapter", () => {
  test("preserves approved sequence and speaker", () => {
    expect(approvedTranscript.turns.map((turn) => [turn.sequence, turn.speaker, turn.turn_kind])).toEqual([
      [0, "user", "opening"],
      [1, "counterpart", "pushback"],
      [2, "user", "pressure_response"],
    ]);
  });

  test("cannot include pending or unapproved text", () => {
    const transcript = approvedNativeTurnsToSharedTranscript("practice-shared-1", [
      ...approvedCandidates,
      { id: "pending", sequence: 3, speaker: "user", turnKind: "retry", text: "UNAPPROVED SECRET", approvedAt: null, approvalStatus: "pending" },
    ]);
    expect(transcript.turns).toHaveLength(3);
    expect(JSON.stringify(transcript)).not.toContain("UNAPPROVED SECRET");
    expect(Object.keys(transcript.turns[0]!)).not.toContain("raw_transcript");
  });

  test("only exports completed native artifacts", () => {
    const session = sessionForRoute("real_conversation");
    const inProgress = { ...session, freeRehearsalTurns: [{ id: "draft", role: "user" as const, text: "submitted but unfinished" }] };
    expect(completedPracticeSessionToSharedTranscript(inProgress).turns).toEqual([]);
    const completed = preserveFreeRehearsalArtifact(inProgress, inProgress.freeRehearsalTurns, 200);
    expect(completedPracticeSessionToSharedTranscript(completed).turns[0]?.approved_text).toBe("submitted but unfinished");
  });
});

describe("Pressure Moment", () => {
  const pressureMoment: PressureMomentV1 = {
    pressure_moment_version: PRESSURE_MOMENT_VERSION,
    headline: "The ask narrowed after pushback",
    opening_turn_id: "opening",
    pushback_turn_id: "pushback",
    pressure_response_turn_id: "response",
    observation: "The response returned to one answerable decision.",
    why_it_matters: "A narrow question gives the conversation somewhere to go.",
    confidence_statement: "This read is based only on the approved three-turn exchange.",
  };

  test("references exactly one opening, pushback, and pressure response in one rehearsal", () => {
    expect(validatePressureMoment(pressureMoment, approvedTranscript)).toBe(pressureMoment);
    expect(() => validatePressureMoment({ ...pressureMoment, pushback_turn_id: "opening" }, approvedTranscript)).toThrow();
    expect(() => validatePressureMoment({ ...pressureMoment, pressure_response_turn_id: "another-rehearsal-turn" }, approvedTranscript)).toThrow();
  });
});

describe("Practice Shift and first focus", () => {
  test("preserves ordered current-pattern and practice-target sequences", () => {
    const shift: PracticeShiftV1 = {
      practice_shift_version: PRACTICE_SHIFT_VERSION,
      headline: "Move from absorbing work to negotiating priority",
      current_pattern_steps: ["Receive another task", "Try to absorb it", "Lose the priority decision"],
      practice_target_steps: ["Name current capacity", "Ask what moves", "Confirm the decision"],
      success_target: "Agree on one priority decision.",
      first_focus_key: "answerable_priority_ask",
      first_focus_label: "Make the tradeoff answerable",
      recommended_module_id: "make_a_clear_ask",
      caveat: PRACTICE_SHIFT_CAVEAT,
    };
    const validated = validatePracticeShift(shift);
    expect(validated.current_pattern_steps).toEqual(shift.current_pattern_steps);
    expect(validated.practice_target_steps).toEqual(shift.practice_target_steps);
  });

  test("keeps the customer-facing label separate from the module ID", () => {
    const focus = createFirstFocus("answerable_priority_ask", "Make the tradeoff answerable", "make_a_clear_ask", "suggested");
    expect(focus.first_focus_label).not.toBe(focus.recommended_module_id);
    expect(focus.first_focus_key).not.toBe(focus.recommended_module_id);
  });
});

describe("Partial Starting Index", () => {
  test("validates every approved signal key", () => {
    const signals = SHARED_SIGNAL_KEYS.map((key) => observedSignal(key, 50));
    expect(validateSignals(signals, approvedTranscript).map((signal) => signal.signal_key)).toEqual([...SHARED_SIGNAL_KEYS]);
  });

  test("allows observed scores at both 0 and 100", () => {
    expect(validateSignals([observedSignal("clarity", 0), observedSignal("specificity", 100)], approvedTranscript).map((signal) => signal.score)).toEqual([0, 100]);
  });

  test("requires null scores and no evidence for unobserved signals", () => {
    expect(validateSignals([unobservedSignal("listening")], approvedTranscript)[0]).toEqual(unobservedSignal("listening"));
    expect(() => validateSignals([{ ...unobservedSignal("listening"), score: 0 }], approvedTranscript)).toThrow();
    expect(() => validateSignals([{ ...unobservedSignal("listening"), evidence_turn_ids: ["response"] }], approvedTranscript)).toThrow();
  });

  test("calculates the redesign fixture as 64 from observed signals only", () => {
    const signals: SharedSignalV1[] = [
      observedSignal("clarity", 72),
      observedSignal("specificity", 66),
      observedSignal("steadiness", 54),
      unobservedSignal("listening"),
      unobservedSignal("boundaries"),
      unobservedSignal("repair"),
    ];
    const validated = validateSignals(signals, approvedTranscript);
    expect(calculatePartialStartingIndex(validated)).toEqual({
      index_kind: "partial",
      index_value: 64,
      observed_count: 3,
      total_signal_count: 6,
      index_version: "starting-index-v1",
    });
  });

  test("legacy signal names cannot silently populate the new index", () => {
    const legacy = { signal_key: "empathy", observation_status: "observed", score: 80, evidence_turn_ids: ["response"], signal_version: SIGNAL_VERSION };
    expect(() => validateSignals([legacy as unknown as SharedSignalV1], approvedTranscript)).toThrow();
  });
});

describe("activation and privacy boundaries", () => {
  test("keeps every activation milestone distinct", () => {
    const milestones: ActivationMilestonesV1 = {
      identity_verified_at: "2026-08-10T10:00:00.000Z",
      entitlement_confirmed_at: "2026-08-10T10:01:00.000Z",
      app_opened_at: "2026-08-10T10:02:00.000Z",
      state_hydrated_at: "2026-08-10T10:03:00.000Z",
      first_paid_practice_started_at: "2026-08-10T10:04:00.000Z",
      first_paid_practice_completed_at: "2026-08-10T10:05:00.000Z",
    };
    expect(new Set(Object.values(milestones)).size).toBe(6);
    expect(Object.keys(milestones)).not.toContain("activated");
  });

  test("keeps sensitive content out of route params and analytics adapters", () => {
    const route = activePracticeSessionToSharedRoute(sessionForRoute("real_conversation"));
    const params = sharedProductRouteParams(route, "practice-shared-1");
    const analytics = sharedProductAnalyticsMeta(route, approvedTranscript);
    const exposed = JSON.stringify({ params, analytics });
    expect(exposed).not.toContain(route.context);
    expect(exposed).not.toContain(route.success_target);
    expect(exposed).not.toContain(route.counterpart_label);
    expect(exposed).not.toContain(approvedTranscript.turns[0]!.approved_text);
    expect(Object.keys(params).sort()).toEqual(["contractVersion", "entryRoute", "origin", "practiceSessionId", "scenarioId"]);
    expect(Object.keys(analytics).sort()).toEqual(["count", "route", "scenarioId", "schemaVersion"]);
  });
});

describe("native compatibility and hydration", () => {
  test("round trips route and approved rehearsal behavior through native factories", () => {
    const originalBase = sessionForRoute("real_conversation");
    const nativeTurns = [
      { id: "opening", role: "user" as const, text: "I need us to choose what moves." },
      { id: "pushback", role: "them" as const, text: "Everything is a priority." },
      { id: "response", role: "user" as const, text: "Which deadline should I move?" },
    ];
    const original = preserveFreeRehearsalArtifact(
      preserveOnboardingBaseline(originalBase, nativeTurns[0]!.text, nativeTurns[1]!.text, 1_000),
      nativeTurns,
      1_200,
    );
    const shared = activePracticeSessionToSharedProduct(original);
    const hydrated = hydrateSharedStateToPracticeSession(shared.route, {
      practiceSessionId: original.id,
      anonymousUserId: original.anonymousUserId,
      scenario: customScenario,
      persona: "woman-hope",
      now: 1_500,
      transcript: shared.transcript,
    });
    expect(hydrated.schemaVersion).toBe(6);
    expect(hydrated.entryRoute).toBe(original.entryRoute);
    expect(hydrated.topic).toBe(original.topic);
    expect(hydrated.usefulOutcome).toBe(original.usefulOutcome);
    expect(hydrated.freeRehearsalTurns).toEqual(nativeTurns);
    expect(hydrated.nextState).toBe("awaiting_onboarding_baseline");
  });

  test("preserves a newer immutable local attempt over older compatible remote state", () => {
    const local = preserveOnboardingBaseline(sessionForRoute("real_conversation"), "Newer local opener", "Local pushback", 5_000);
    const hydrated = hydrateSharedStateToPracticeSession(activePracticeSessionToSharedRoute(local), {
      practiceSessionId: local.id,
      anonymousUserId: local.anonymousUserId,
      scenario: customScenario,
      persona: "woman-hope",
      now: 2_000,
      existingSession: local,
      transcript: approvedTranscript,
    });
    expect(hydrated.attemptOne).toEqual(local.attemptOne);
    expect(hydrated.originalAdamResponse).toEqual(local.originalAdamResponse);
    expect(hydrated.dayThirtyBaseline).toEqual(local.dayThirtyBaseline);
  });

  test("version-6 local sessions remain valid and missing v1 result fields stay explicit", () => {
    const session = sessionForRoute("real_conversation");
    expect(normalizePracticeSession(JSON.parse(JSON.stringify(session)))?.schemaVersion).toBe(6);
    expect(activePracticeSessionToSharedResult(session)).toEqual({
      contract_version: 1,
      rehearsal_id: session.id,
      pressure_moment: null,
      rewrite: null,
      practice_shift: null,
      signals: [],
      starting_index: null,
      first_focus: null,
    });
  });
});
