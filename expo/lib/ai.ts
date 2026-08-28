import { personaFor } from "@/constants/personas";
import { renderCounterpartMessage } from "@/lib/rehearsal";
import { errorShape, safeLog } from "@/lib/redact";
import type { Debrief, Difficulty, OnboardingForm, PersonaVoice, ReactionPattern, Scenario, Turn } from "@/types/convo";
import { neutralPilotCoachResponse, selectDay8Pushback, validatePilotCoachResponse } from "@/lib/pilotCurriculum";
import { m1L1DynamicReplyPassesQuality, type M1L1PressureKind } from "@/lib/m1L1DynamicResponse";
import type {
  PilotCoachResponse,
  PilotCounterpartResponse,
  PilotModule,
} from "@/types/pilotCurriculum";

const GENERATE_ENDPOINT = process.env.EXPO_PUBLIC_GENERATE_ENDPOINT?.trim() || "https://beforeyousayit.app/api/generate";
const BYSI_GENERATION_TIMEOUT_MS = 15_000;

type BysiEntryRoute = "real_conversation" | "recurring_problem" | "desired_skill";

interface BysiContract {
  entry_route: BysiEntryRoute;
  context: string;
  scenario: string;
  success_target: string;
  pressure_condition: string;
}

interface BysiTranscript {
  user_turn_1: string;
  counterpart_pushback: string;
  user_turn_2: string;
  counterpart_close: string;
}

interface BysiTurnResponse {
  mode?: string;
  text?: string;
  safety?: unknown;
}

export interface BysiObservedDimension {
  name: string;
  score: number;
  evidence: string;
}

export interface BysiInsufficientEvidence {
  headline: string;
  note: string;
  next_step: string;
}

export interface BysiResultResponse {
  mode?: "result" | "insufficient_evidence" | "safety";
  outputVersion?: string;
  pressure_moment?: {
    headline?: string;
    ask_quote?: string;
    response_quote?: string;
    conclusion?: string;
    how_bysi_read_this?: { observed?: string; why_it_matters?: string };
  };
  rewrite?: {
    clearer_version?: string;
  };
  practice_shift?: {
    headline?: string;
    practice_target?: string[];
    goal_line?: string;
  };
  starting_index?: {
    overall?: number;
    label?: string;
    coverage_note?: string;
    focus_dimension?: string;
    observed_dimensions?: BysiObservedDimension[];
    unobserved_dimensions?: string[];
    score_note?: string;
  };
  recommended_path?: { first_module?: string; reason?: string; next_modules?: string[] };
  insufficient_evidence?: BysiInsufficientEvidence | null;
}

export interface GeneratedDebrief {
  debrief: Debrief;
  analysis: BysiResultResponse;
}

function evidenceEndpoint(url: string): string {
  return url.replace(/^https?:\/\//, "").slice(0, 64);
}

/** Performs one bounded BYSI request so a provider stall cannot trap the rehearsal UI. */
export async function requestBysiGeneration(payload: Record<string, unknown>, timeoutMs: number = BYSI_GENERATION_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(GENERATE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function postBysi<T>(payload: Record<string, unknown>): Promise<T> {
  const type = typeof payload.type === "string" ? payload.type : "unknown";
  const contract = payload.contract as { entry_route?: unknown } | undefined;
  const entryRoute = typeof contract?.entry_route === "string" ? contract.entry_route : "unknown";
  safeLog("[evidence] BYSI generation request", {
    endpoint: evidenceEndpoint(GENERATE_ENDPOINT),
    entryRoute,
    provider: "user-owned-claude-backend",
    type,
  });
  const response = await requestBysiGeneration(payload);
  safeLog("[evidence] BYSI generation response", {
    endpoint: evidenceEndpoint(GENERATE_ENDPOINT),
    entryRoute,
    ok: response.ok,
    status: response.status,
    type,
  });
  const result = await response.json().catch((): Record<string, never> => ({})) as T & { error?: unknown };
  if (!response.ok) throw new Error(`BYSI generation failed (${response.status})`);
  return result;
}

function bysiContract(
  scenario: Scenario,
  reaction?: ReactionPattern,
  outcome?: string,
  entryRoute: BysiEntryRoute = "real_conversation",
): BysiContract {
  return {
    entry_route: entryRoute,
    context: scenario.category,
    scenario: `${scenario.title}. ${scenario.situation}`.trim(),
    success_target: outcome?.trim() || scenario.goal,
    pressure_condition: reaction ? REACTION_BEHAVIOUR[reaction] : scenario.persona,
  };
}

function bysiTranscript(turns: Turn[], scenario: Scenario): BysiTranscript {
  const userTurns = turns.filter((turn) => turn.role === "user").map((turn) => turn.text);
  const counterpartTurns = turns
    .filter((turn) => turn.role === "them")
    .map((turn) => renderCounterpartMessage(turn.text, scenario.counterpart).body);
  return {
    user_turn_1: userTurns[0] ?? "",
    counterpart_pushback: counterpartTurns[0] ?? scenario.openingLine,
    user_turn_2: userTurns[1] ?? "",
    counterpart_close: counterpartTurns[1] ?? scenario.openingLine,
  };
}

const REACTION_BEHAVIOUR: Record<ReactionPattern, string> = {
  defensive:
    "You get defensive quickly. You protect your intentions, justify yourself, and turn responsibility back unless the other person stays specific and non-accusing.",
  "hears-criticism":
    "You hear even neutral statements as criticism. You look for what's wrong with what the other person said, but you're not loud — just wounded and correcting.",
  minimizes:
    "You minimize the issue. You say it's not that bad, it happens to everyone, or make it smaller than it is. You only stop minimizing if the other person stays calm and specific.",
  quiet:
    "You go quiet and withdrawn under pressure. You answer in short sentences, look away, and only open up when the other person slows down and invites you in.",
  louder:
    "You get louder when pushed. You interrupt, escalate, and use absolutes. You calm only when the other person matches your energy with steadiness.",
  "turns-back":
    "You turn the conversation back on the other person. You bring up their flaws, change the subject to their behavior, and only drop it when they refuse to take the bait.",
  "agrees-without-changing":
    "You agree quickly to end the conversation, then change nothing. You nod, apologize, and deflect follow-up. The other person has to pin down a concrete next step.",
  "not-sure":
    "You react the way a real ambivalent person would: a mix of defensive, quiet, and minimizing. You are uncertain and need the other person to be clearer than you are.",
};

type AcquisitionCounterpartTurn = "pushback" | "close";

export interface CounterpartTurn {
  reply: string;
  tension: number;
  nudge: string;
}

const CHANNEL_LEAKAGE = /\b(?:text(?:ed|ing)?|message(?:d|s|ing)?|dm(?:s|ed|ing)?|chat(?:ted|ting)?|phone call|call(?:ed|ing)?|facetime|zoom|email(?:ed|ing)?|video call)\b/i;
const EASY_CLOSE = /\b(?:you(?:'|’)re right|i agree|i(?:'|’)m sorry|i apologize|i(?:'|’)ll do that|i will do that|consider it done|we have a deal|that sounds fair)\b/i;

/** Rejects unsupported channel changes and unrealistically easy final agreement. */
export function counterpartLinePassesQuality(line: string, turn: AcquisitionCounterpartTurn): boolean {
  if (CHANNEL_LEAKAGE.test(line)) return false;
  if (turn === "pushback" && /^(?:i hear you|you(?:'|’)re right|that(?:'|’)s fair|okay|i get that)\b/i.test(line.trim())) return false;
  return turn !== "close" || !EASY_CLOSE.test(line);
}

/** Raised when the counterpart's line could not be produced cleanly. */
export class CounterpartTurnError extends Error {
  readonly reason: "empty" | "request-failed";

  constructor(reason: "empty" | "request-failed") {
    super(`Counterpart turn unusable (${reason})`);
    this.name = "CounterpartTurnError";
    this.reason = reason;
  }
}

/**
 * Token ceiling for a live reply. The prompt asks for 1-3 short sentences;
 * this leaves ample headroom so a well-formed reply is never cut off.
 */
const ROLEPLAY_MAX_TOKENS = 900;

/**
 * Generate the counterpart's next line, the room's tension and an optional
 * coach nudge.
 *
 * The response is validated against the counterpart-turn schema. A malformed,
 * empty or truncated response is retried once; if that also fails the caller
 * gets a `CounterpartTurnError` so it can show a retry state. Nothing partial
 * or unparsed is ever returned.
 */
export interface M1L1DynamicReplyInput {
  scenario: Scenario;
  kind: M1L1PressureKind;
  approvedTranscript: string;
  openingTranscript: string;
  firstPushback?: string;
  firstResponse?: string;
  authoredFallback: string;
  runId: string;
}

export interface M1L1DynamicReplyResult {
  reply: string;
  source: "provider" | "authored";
}

function m1L1ConversationContext(input: M1L1DynamicReplyInput): string {
  return [
    input.scenario.title,
    input.scenario.situation,
    input.scenario.persona,
    input.openingTranscript,
    input.firstPushback ?? "",
    input.firstResponse ?? "",
  ].filter((value) => value.trim().length > 0).join(" ");
}

/** Generates one constrained M1 L1 pressure turn, retries one rejected result, then returns the authored fallback. */
export async function generateM1L1DynamicReply(input: M1L1DynamicReplyInput): Promise<M1L1DynamicReplyResult> {
  const context = m1L1ConversationContext(input);
  const turn = input.kind === "pushback_one" ? "pushback" : "close";
  const transcript: BysiTranscript = {
    user_turn_1: input.openingTranscript,
    counterpart_pushback: input.firstPushback ?? "",
    user_turn_2: input.firstResponse ?? "",
    counterpart_close: "",
  };
  const pressureObjective = input.kind === "pushback_one"
    ? "Respond directly to the learner's actual point while defending Adam's quarter-close constraints and keeping the requested handoff change unresolved."
    : "Respond to the full exchange by challenging the learner's evidence or scope without changing topic or resolving the requested handoff change.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await postBysi<BysiTurnResponse>({
        type: "rehearsal_turn",
        turn,
        contract: {
          ...bysiContract(input.scenario, "defensive", input.scenario.goal),
          pressure_condition: `${input.scenario.persona} ${pressureObjective}`,
        },
        transcript,
        avoid_repeating: [input.firstPushback ?? "", input.authoredFallback].filter(Boolean),
        lesson_constraints: {
          lesson_id: "m1-l1",
          counterpart: "Adam, the learner's colleague",
          approved_transcript: input.approvedTranscript,
          conversation_context: context,
          pressure_objective: pressureObjective,
          output: "One short, natural in-character reply of no more than three sentences.",
          reject: ["invented facts", "instant agreement", "coaching language", "topic changes"],
        },
        variation_seed: `${input.runId}-${input.kind}-${attempt}`,
      });
      const reply = result.mode === "safety" ? "" : result.text?.trim() ?? "";
      if (reply && m1L1DynamicReplyPassesQuality(reply, input.kind, input.approvedTranscript, context)) {
        return { reply, source: "provider" };
      }
      safeLog("[ai] M1 L1 semantic quality gate rejected line", { attempt, kind: input.kind });
    } catch (error) {
      safeLog("[ai] M1 L1 counterpart request failed", { attempt, kind: input.kind, ...errorShape(error) });
    }
  }

  return { reply: input.authoredFallback, source: "authored" };
}

export async function nextCounterpartTurn(
  scenario: Scenario,
  difficulty: Difficulty,
  turns: Turn[],
  reaction?: ReactionPattern,
  outcome?: string,
  persona?: PersonaVoice,
  entryRoute: BysiEntryRoute = "real_conversation",
): Promise<CounterpartTurn> {
  const turn: AcquisitionCounterpartTurn = turns.filter((item) => item.role === "user").length >= 2 ? "close" : "pushback";
  const avoidRepeating = turns
    .filter((item) => item.role === "them")
    .map((item) => renderCounterpartMessage(item.text, scenario.counterpart).body);
  void difficulty;
  void persona;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await postBysi<BysiTurnResponse>({
        type: "rehearsal_turn",
        turn,
        contract: bysiContract(scenario, reaction, outcome, entryRoute),
        transcript: bysiTranscript(turns, scenario),
        avoid_repeating: avoidRepeating,
        variation_seed: `${scenario.id}-${turn}-${Date.now().toString(36)}-${attempt}`,
      });
      const reply = result.mode === "safety" ? "" : result.text?.trim() ?? "";
      if (reply && counterpartLinePassesQuality(reply, turn)) return { reply, tension: 50, nudge: "" };
      safeLog("[ai] BYSI counterpart quality gate rejected line", { attempt, turn });
    } catch (error) {
      safeLog("[ai] BYSI counterpart request failed", { attempt, ...errorShape(error) });
    }
  }

  throw new CounterpartTurnError("request-failed");
}

/** Produce one evidence-linked, non-diagnostic starting point from confirmed transcript text. */
export async function generateDebrief(
  scenario: Scenario,
  difficulty: Difficulty,
  turns: Turn[],
  reaction?: ReactionPattern,
  outcome?: string,
  entryRoute: BysiEntryRoute = "real_conversation",
): Promise<GeneratedDebrief> {
  void difficulty;
  const transcript = bysiTranscript(turns, scenario);
  safeLog("[evidence] BYSI complete transcript payload", {
    count: Object.values(transcript).filter((value) => value.trim().length > 0).length,
    step: "four-fields-present",
    type: "free_rehearsal_result",
    userTurnCount: turns.filter((turn) => turn.role === "user").length,
  });
  safeLog("[evidence] BYSI counterpart fields present", {
    count: [transcript.counterpart_pushback, transcript.counterpart_close].filter((value) => value.trim().length > 0).length,
    step: "pushback-and-close",
    type: "free_rehearsal_result",
  });
  const result = await postBysi<BysiResultResponse>({
    type: "free_rehearsal_result",
    contract: bysiContract(scenario, reaction, outcome, entryRoute),
    transcript,
    rewrite_requirement: {
      original_ask: transcript.user_turn_1,
      output: "One direct line the learner could say to the counterpart",
      rules: [
        "Rewrite the original issue as one specific, answerable request",
        "Use a natural spoken ask such as Can you or Can we",
        "Name one concrete action and include a timeframe when relevant",
        "Do not return coaching advice, instructions, skill labels, or prefatory text",
      ],
    },
  });
  safeLog("[evidence] BYSI result shape", {
    count: result.starting_index?.observed_dimensions?.length ?? 0,
    status: result.mode ?? "unknown",
    step: "pressure-index-shift-path",
    type: "free_rehearsal_result",
  });
  (["pressure_moment", "rewrite", "starting_index", "practice_shift", "recommended_path"] as const).forEach((key) => {
    safeLog("[evidence] BYSI result key", {
      status: result[key] ? "present" : "missing",
      step: key,
      type: "free_rehearsal_result",
    });
  });
  if (result.mode === "insufficient_evidence") {
    const insufficient = result.insufficient_evidence;
    if (!insufficient?.headline?.trim() || !insufficient.note?.trim() || !insufficient.next_step?.trim()) {
      throw new Error("Could not read the BYSI insufficient-evidence result");
    }
    return {
      analysis: result,
      debrief: {
        headline: insufficient.headline.trim(),
        scores: { clarity: 0, empathy: 0, assertiveness: 0, composure: 0 },
        wins: [],
        flags: [],
        script: [],
        nextRep: insufficient.next_step.trim(),
      },
    };
  }
  const moment = result.pressure_moment;
  const shift = result.practice_shift;
  if (result.mode !== "result" || !moment?.headline || !shift?.headline) {
    throw new Error("Could not read the BYSI debrief");
  }
  const learnerLines = turns.filter((turn) => turn.role === "user").map((turn) => turn.text);
  const candidateQuote = moment.response_quote?.trim() || moment.ask_quote?.trim() || "";
  const quote = learnerLines.some((line) => line.includes(candidateQuote)) ? candidateQuote : "";
  const reframe = shift.practice_target?.[0]?.trim() || shift.goal_line?.trim() || "Try the same moment with one concrete request.";
  return {
    analysis: result,
    debrief: {
      headline: moment.headline,
      scores: { clarity: 0, empathy: 0, assertiveness: 0, composure: 0 },
      wins: moment.conclusion ? [moment.conclusion] : [],
      flags: [{
        quote,
        issue: moment.how_bysi_read_this?.observed?.trim() || shift.headline,
        reframe,
      }],
      script: shift.practice_target?.slice(0, 1) ?? [],
      nextRep: shift.goal_line?.trim() || reframe,
    },
  };
}

const FALLBACK_RELATIONSHIP: Record<string, string> = {
  partner: "your partner",
  family: "your family member",
  work: "your coworker",
  friends: "your friend",
};

const FALLBACK_TITLE: Record<string, string> = {
  partner: "Have the conversation at home",
  family: "Set a clear family boundary",
  work: "Address the issue at work",
  friends: "Say what needs to be said",
};

/**
 * Build a playable first scenario without a network response.
 *
 * Onboarding must never become a dead end just because scenario generation is
 * temporarily unavailable. This keeps the user's own context and chosen voice,
 * while later live turns still get the full AI role-play behavior.
 */
export function fallbackCustomScenario(
  description: string,
  category: string,
  form: Partial<OnboardingForm>,
): Omit<Scenario, "id" | "isCustom"> {
  const voice = personaFor(form.persona ?? "woman-hope");
  const relationship = FALLBACK_RELATIONSHIP[category] ?? "the other person";
  const goal = form.outcome?.trim() || "Say what you need clearly and agree on a next step.";

  return {
    category: category as Scenario["category"],
    title: FALLBACK_TITLE[category] ?? "Practice the conversation",
    counterpart: `${voice.name} — ${relationship}`,
    counterpartGender: voice.gender,
    situation: description.trim(),
    persona:
      "Past attempts have stalled before anything was settled. They begin guarded and need you to stay specific about what you want.",
    goal,
    opensWith: "user",
    openingLine: "Okay. What did you want to talk about?",
    minutes: 7,
  };
}

/** Turn a messy plain-text description into a structured, playable scenario. */
export async function buildCustomScenario(
  description: string,
  category: string,
  form: Partial<OnboardingForm>,
): Promise<Omit<Scenario, "id" | "isCustom">> {
  const fallback = fallbackCustomScenario(description, category, form);
  const result = await postBysi<BysiResultResponse>({
    type: "free_rehearsal_result",
    contract: {
      entry_route: "real_conversation",
      context: category,
      scenario: description,
      success_target: form.outcome?.trim() || fallback.goal,
      pressure_condition: form.reaction ? REACTION_BEHAVIOUR[form.reaction] : fallback.persona,
    } satisfies BysiContract,
    transcript: {
      user_turn_1: description,
      counterpart_pushback: fallback.openingLine,
      user_turn_2: form.outcome?.trim() || fallback.goal,
      counterpart_close: fallback.openingLine,
    } satisfies BysiTranscript,
  });
  return {
    ...fallback,
    title: result.recommended_path?.first_module?.trim() || fallback.title,
    goal: result.practice_shift?.goal_line?.trim() || fallback.goal,
  };
}

export interface DrillRoundFeedback {
  score: number;
  feedback: string;
  better: string;
}

/** Score a single drill round reply and offer a sharper alternative line. */
export async function drillRoundFeedback(
  skill: string,
  focus: string,
  theirLine: string,
  reply: string,
): Promise<DrillRoundFeedback> {
  const result = await postBysi<BysiResultResponse>({
    type: "free_rehearsal_result",
    contract: {
      entry_route: "desired_skill",
      context: "practice drill",
      scenario: skill,
      success_target: focus,
      pressure_condition: theirLine,
    } satisfies BysiContract,
    transcript: {
      user_turn_1: reply,
      counterpart_pushback: theirLine,
      user_turn_2: reply,
      counterpart_close: theirLine,
    } satisfies BysiTranscript,
  });
  const observed = result.starting_index?.observed_dimensions?.[0];
  return {
    score: clamp(Number(observed?.score ?? result.starting_index?.overall ?? 50)),
    feedback: observed?.evidence?.trim() || result.pressure_moment?.how_bysi_read_this?.observed?.trim() || "Keep the reply specific and answerable.",
    better: result.practice_shift?.practice_target?.[0]?.trim() || "",
  };
}

function clamp(n: number): number {
  const value = Number(n);
  if (!Number.isFinite(value)) return 50;
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** Return an approved, static Adam line. No model call is made. */
export async function nextPilotCounterpart(
  module: PilotModule,
  _confirmedTranscript: string,
  runId: string,
): Promise<PilotCounterpartResponse> {
  const line = module.day === 8 ? selectDay8Pushback(runId, module) : module.practice.adam_line ?? null;
  if (!line) throw new Error("Approved Adam line is unavailable");
  const bank = module.practice.approved_pushback_bank ?? [];
  const bankIndex = bank.findIndex((candidate) => candidate.audio_id === line.audio_id);
  return {
    route: "roleplay",
    spokenText: line.text,
    reactionLevel: module.practice.reaction_level,
    reactionId: module.day === 8 ? `day8_pushback_${bankIndex + 1}` : `day${module.day}_fixed_adam`,
    audioId: line.audio_id,
    shouldEnd: false,
  };
}

/** One evidence-linked note from Hope, validated against the confirmed words. */
export async function evaluatePilotAttempt(
  module: PilotModule,
  confirmedTranscript: string,
  counterpartResponse: string,
): Promise<PilotCoachResponse> {
  try {
    const result = await postBysi<BysiResultResponse>({
      type: "free_rehearsal_result",
      contract: {
        entry_route: "desired_skill",
        context: `Day ${module.day}`,
        scenario: module.title,
        success_target: module.evaluation.success_criteria[0] ?? module.title,
        pressure_condition: counterpartResponse,
      } satisfies BysiContract,
      transcript: {
        user_turn_1: confirmedTranscript,
        counterpart_pushback: counterpartResponse,
        user_turn_2: confirmedTranscript,
        counterpart_close: counterpartResponse,
      } satisfies BysiTranscript,
    });
    const note = limitWords(
      result.pressure_moment?.how_bysi_read_this?.observed || result.pressure_moment?.conclusion || "Use one observable, answerable request.",
      32,
    );
    const retryInstruction = limitWords(
      result.practice_shift?.practice_target?.[0] || module.retry.direction,
      16,
    );
    const value: PilotCoachResponse = {
      route: "coach",
      day: module.day,
      evidenceQuote: confirmedTranscript,
      behaviorId: module.evaluation.priority_order[0] ?? null,
      note,
      retryInstruction,
      retryPrompt: "Try that same moment again.",
    };
    if (validatePilotCoachResponse(value, module, confirmedTranscript).length === 0) return value;
  } catch (error) {
    safeLog("[pilot] BYSI coach request failed", { code: "pilot_coach_failed", day: module.day, ...errorShape(error) });
  }
  safeLog("[pilot] coach validation failed closed", { code: "pilot_coach_invalid", day: module.day });
  return neutralPilotCoachResponse(module);
}

function limitWords(value: string, limit: number): string {
  return value.replace(/```/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim().split(" ").slice(0, limit).join(" ");
}

export { REACTION_BEHAVIOUR };
