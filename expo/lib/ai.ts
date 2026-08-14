import { DIFFICULTY } from "@/constants/scenarios";
import { genderFor, genderPromptLine, personaFor } from "@/constants/personas";
import {
  parseCounterpartPayload,
  renderCounterpartMessage,
  type ParseFailure,
} from "@/lib/rehearsal";
import { errorShape, safeLog } from "@/lib/redact";
import type { Debrief, Difficulty, OnboardingForm, PersonaVoice, ReactionPattern, Scenario, Turn } from "@/types/convo";
import { neutralPilotCoachResponse, selectDay8Pushback, validatePilotCoachResponse } from "@/lib/pilotCurriculum";
import type {
  PilotCoachResponse,
  PilotCounterpartResponse,
  PilotModule,
} from "@/types/pilotCurriculum";

const BASE = process.env.EXPO_PUBLIC_TOOLKIT_URL ?? "";
const KEY = process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY ?? "";

/** Fast, expressive model for live in-character replies. */
const ROLEPLAY_MODEL = "google/gemini-3.6-flash";
/** Careful reasoner for the structured post-session debrief. */
const DEBRIEF_MODEL = "anthropic/claude-sonnet-5";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// The counterpart's gender now reaches the model through `genderPromptLine`,
// derived from the same persona record that picks the spoken voice.

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

interface ChatResult {
  content: string;
  /** "length" means the model hit the token ceiling and the text is cut off. */
  finishReason: string;
}

async function chatRaw(
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<ChatResult> {
  const res = await fetch(`${BASE}/v2/vercel/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.9,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI request failed (${res.status})`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = json.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new Error("Empty AI response");
  return { content, finishReason: choice?.finish_reason ?? "stop" };
}

async function chat(
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<string> {
  const { content } = await chatRaw(model, messages, maxTokens);
  return content;
}

function extractJson<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

type AcquisitionCounterpartTurn = "pushback" | "close";

function rolePrompt(
  scenario: Scenario,
  difficulty: Difficulty,
  turn: AcquisitionCounterpartTurn,
  avoidRepeating: string[],
  reaction?: ReactionPattern,
  outcome?: string,
  persona?: PersonaVoice,
): string {
  const d = DIFFICULTY[difficulty];
  const reactionLine = reaction
    ? `HOW YOU TEND TO REACT: ${REACTION_BEHAVIOUR[reaction]}`
    : "";
  const outcomeLine = outcome
    ? `WHAT THE OTHER PERSON WANTS FROM YOU (and what you want to practice): ${outcome}`
    : `WHAT THE OTHER PERSON WANTS FROM YOU: ${scenario.goal}`;

  return [
    `You are playing a single character in a private rehearsal so a person can practice a difficult real-life conversation. This is a safe simulation, not real life.`,
    ``,
    `YOUR CHARACTER: ${scenario.counterpart}`,
    `THE SITUATION: ${scenario.situation}`,
    `WHO YOU ARE: ${scenario.persona}`,
    // Without this the model picks a gender at random and can contradict the
    // voice the user is actually hearing.
    persona ? genderPromptLine(genderFor(persona)) : "",
    `YOUR CURRENT STANCE (${d.label}): ${d.behaviour}`,
    `TURN TO GENERATE: ${turn}`,
    `OUTPUT VERSION: bysi-rehearsal-turn-v1-2026-08-12`,
    `VARIATION SEED: ${scenario.id}-${turn}-${avoidRepeating.length}`,
    avoidRepeating.length > 0 ? `AVOID REPEATING: ${avoidRepeating.join(" | ")}` : "",
    reactionLine,
    outcomeLine,
    ``,
    `RULES`,
    `- You are American. Speak natural, contemporary American English (US spelling and idiom) at all times.`,
    `- NEVER use British, Irish, or Australian words or idioms. Banned examples: mate, bloke, cheers, reckon, brilliant, lovely, proper, whilst, keen on, fancy, sod, bugger, chuffed, gutted, take the mick, have a go, sorted, dodgy, bloody, innit, mum, flat, holiday (meaning vacation), queue, rubbish, uni, telly, bin, quid, fortnight, straight away.`,
    `- Use American equivalents instead: buddy/man/dude, awesome, really, while, into, mom, apartment, vacation, line, trash, college, TV, right away.`,
    `- Speak only as your character. Never coach, never narrate, never mention AI or practice.`,
    `- Keep every reply to 1-2 short spoken sentences and approximately 38 words maximum.`,
    `- This rehearsal is in person unless the situation explicitly says it is remote. Never introduce texting, messages, DMs, chat, a phone call, FaceTime, Zoom, email, or another channel.`,
    `- On the pushback turn, do not begin with “I hear you,” “You’re right,” “That’s fair,” “Okay,” or “I get that.” Start with credible resistance specific to this situation.`,
    `- On the close turn, remain unresolved. Do not apologize, agree, commit, solve the issue, own the solution, or give the learner a clean win. You may ask for one specific clarification while keeping resistance.`,
    `- You may open a reply with one short physical beat in parentheses, e.g. "(sighs)". At most one.`,
    `- React to what was actually just said. Reward specificity, calm and ownership by softening a little. Punish vagueness, blame and over-apologizing by staying stuck.`,
    `- Never resolve everything at once. Real change is incremental.`,
    `- Never become abusive, sexual, or use slurs. No self-harm content. If the user raises a genuine crisis or danger, drop the roleplay and gently tell them to reach real-world support.`,
    ``,
    `Reply ONLY with minified JSON in exactly this shape:`,
    `{"mode":"rehearsal","outputVersion":"bysi-rehearsal-turn-v1-2026-08-12","turn":"${turn}","role":"${persona === "man-adam" ? "adam" : "hope"}","reply":"counterpart speech only","tension":0-100,"nudge":"","safety":"ok"}`,
    `Return counterpart speech only. Never expose coaching in the nudge field.`,
  ]
    .filter(Boolean)
    .join("\n");
}

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
  readonly reason: ParseFailure | "request-failed";

  constructor(reason: ParseFailure | "request-failed") {
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
export async function nextCounterpartTurn(
  scenario: Scenario,
  difficulty: Difficulty,
  turns: Turn[],
  reaction?: ReactionPattern,
  outcome?: string,
  persona?: PersonaVoice,
): Promise<CounterpartTurn> {
  const turn: AcquisitionCounterpartTurn = turns.filter((item) => item.role === "user").length >= 2 ? "close" : "pushback";
  const avoidRepeating = turns.filter((item) => item.role === "them").map((item) => renderCounterpartMessage(item.text, scenario.counterpart).body);
  const history: ChatMessage[] = turns.map((t) => ({
    role: t.role === "user" ? "user" : "assistant",
    content:
      t.role === "user"
        ? t.text
        : JSON.stringify({ reply: renderCounterpartMessage(t.text, scenario.counterpart).body }),
  }));

  const messages: ChatMessage[] = [
    { role: "system", content: rolePrompt(scenario, difficulty, turn, avoidRepeating, reaction, outcome, persona) },
    ...history,
  ];

  let lastReason: ParseFailure | "request-failed" = "request-failed";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let result: ChatResult;
    try {
      result = await chatRaw(ROLEPLAY_MODEL, messages, ROLEPLAY_MAX_TOKENS);
    } catch (e) {
      lastReason = "request-failed";
      safeLog("[ai] counterpart request failed", { attempt, ...errorShape(e) });
      continue;
    }

    // The model ran out of room mid-sentence; never render this.
    if (result.finishReason === "length") {
      lastReason = "truncated";
      safeLog("[ai] counterpart reply hit the token ceiling", { attempt });
      continue;
    }

    const parsed = parseCounterpartPayload(result.content);
    if (parsed.ok && counterpartLinePassesQuality(parsed.value.reply, turn)) return { ...parsed.value, nudge: "" };
    if (parsed.ok) {
      lastReason = "request-failed";
      safeLog("[ai] counterpart quality gate rejected line", { attempt, turn });
      messages.push({ role: "user", content: `That ${turn} failed the channel/resistance quality gate. Return a different in-person line that stays unresolved.` });
      continue;
    }

    lastReason = parsed.reason;
    safeLog("[ai] counterpart reply rejected", { attempt, reason: parsed.reason });
  }

  throw new CounterpartTurnError(lastReason);
}

/** Produce one evidence-linked, non-diagnostic starting point from confirmed transcript text. */
export async function generateDebrief(
  scenario: Scenario,
  difficulty: Difficulty,
  turns: Turn[],
  reaction?: ReactionPattern,
  outcome?: string,
): Promise<Debrief> {
  const transcript = turns
    .map((t) => `${t.role === "user" ? "USER" : "THEM"}: ${t.text}`)
    .join("\n");

  const system = [
    `You are an exacting but warm American communication coach reviewing a rehearsal transcript. You coach like a great therapist crossed with a negotiation trainer: specific, kind, never generic.`,
    `Write in natural American English (US spelling and idiom). Never use British or Australian words like mate, whilst, reckon, brilliant, keen, proper or sorted.`,
    `Use only wording and conversational choices in the confirmed transcript. You cannot hear the recording. Never comment on tone, volume, pace, pitch, delivery, emotion, or confidence.`,
    `Use at most one exact contiguous quote from a USER line. Copy it character-for-character. If no reliable quote supports a finding, return an empty quote and ask for another confirmed attempt.`,
    `Return at most one supported strength, one highest-leverage observable adjustment, and one immediate action.`,
    `Address them directly as "you". Never write "the user" or "the user's".`,
    `Describe the other person's behavior as an observable pattern in this conversation. Do not diagnose, label or armchair-analyze them.`,
    `Keep the adjustment observable and wording-specific. Do not infer personality, attachment, motive, emotional state, diagnosis, relationship quality, or a predicted real-person response. Do not output scores, percentages, labels, or improvement claims.`,
    `Reply ONLY with minified JSON:`,
    `{"headline":"one observable starting point, <=90 chars","wins":["zero or one supported strength"],"flags":[{"quote":"one exact contiguous USER quote or empty string","issue":"one observable adjustment, <=90 chars","reframe":"one immediate line or action"}],"script":["one optional usable line"],"nextRep":"one immediate action"}`,
    `Include exactly one flag. If evidence is unreliable, leave quote empty and use the headline to ask for another confirmed attempt.`,
  ].join("\n");

  const user = [
    `SCENARIO: ${scenario.title}`,
    `THEY WERE TALKING TO: ${scenario.counterpart}`,
    `GOAL: ${scenario.goal}`,
    `DIFFICULTY: ${DIFFICULTY[difficulty].label}`,
    reaction ? `PRACTICED REACTION: ${REACTION_BEHAVIOUR[reaction]}` : "",
    outcome ? `DESIRED OUTCOME: ${outcome}` : "",
    ``,
    `TRANSCRIPT:`,
    transcript,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await chat(
    DEBRIEF_MODEL,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    1600,
  );

  const parsed = extractJson<Debrief>(raw);
  if (!parsed?.headline || !Array.isArray(parsed.flags)) throw new Error("Could not read the debrief");
  const learnerLines = turns.filter((turn) => turn.role === "user").map((turn) => turn.text);
  const flag = parsed.flags[0];
  const quote = flag?.quote?.trim() ?? "";
  const isExactQuote = quote.length > 0 && learnerLines.some((line) => line.includes(quote));
  return {
    headline: parsed.headline,
    // Retained only for compatibility with minimized legacy session records. No score is generated or shown.
    scores: { clarity: 0, empathy: 0, assertiveness: 0, composure: 0 },
    wins: parsed.wins?.slice(0, 1) ?? [],
    flags: flag ? [{ ...flag, quote: isExactQuote ? quote : "" }] : [],
    script: parsed.script?.slice(0, 1) ?? [],
    nextRep: parsed.nextRep ?? "",
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
  const system = [
    `You turn a person's description of a difficult conversation they need to have into a playable rehearsal scenario.`,
    `Write everything in natural American English (US spelling and idiom) with American names. The opening line must sound like a real American speaking — never use British or Australian idiom such as mate, whilst, reckon, brilliant, keen, proper, sorted or cheers.`,
    `Reply ONLY with minified JSON:`,
    `{"title":"short imperative title <=48 chars","counterpart":"first name, optionally followed by ' — your ' and the relationship, <=48 chars","situation":"2-3 sentences of context addressed directly to the person rehearsing as 'you'","persona":"2-3 sentences describing how past attempts at this conversation have gone as an observable loop","goal":"one concrete outcome you want","openingLine":"the first thing the other person says, may start with one short (beat), <=140 chars"}`,
    `Address the person rehearsing directly as "you". Never write "the user", "the user's" or third-person phrasing about them. Write "your wife", never "the user's wife".`,
    `For "persona", describe the observable loop, not a diagnosis. Write "Past attempts to discuss chores have turned defensive before the two of you could agree on a plan", never "Dana tends to hear mild comments as personal attacks". Do not label, diagnose or pathologize them.`,
    form.persona
      ? `The rehearsal voice is ${personaFor(form.persona).name}. Set "counterpart" to exactly "${personaFor(form.persona).name}". Do not invent or substitute another first name. ${personaFor(form.persona).name} is playing the ${genderFor(form.persona)} version of the person in this scenario. Keep every pronoun consistent with this.`
      : `Use a relationship label such as "your coworker" for "counterpart" rather than inventing a first name.`,
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await chat(
    DEBRIEF_MODEL,
    [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          `Relationship area: ${category}`,
          form.reaction ? `How they tend to react: ${REACTION_BEHAVIOUR[form.reaction]}` : "",
          form.outcome ? `Desired outcome: ${form.outcome}` : "",
          `What they wrote:\n${description}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    700,
  );

  const parsed = extractJson<Record<string, string>>(raw);
  if (!parsed?.title) throw new Error("Could not build that scenario");

  return {
    category: category as Scenario["category"],
    title: parsed.title,
    // The selected AI identity stays stable across every scenario. Hope or Adam
    // plays the role; a generated character name must never replace that choice.
    counterpart: form.persona
      ? personaFor(form.persona).name
      : (parsed.counterpart ?? "The other person"),
    ...(form.persona ? { counterpartGender: personaFor(form.persona).gender } : {}),
    situation: parsed.situation ?? description,
    persona:
      parsed.persona ??
      "Past attempts at this conversation have turned defensive before anything got settled.",
    goal: parsed.goal ?? (form.outcome ? form.outcome : "Say the thing clearly and hold it."),
    // A custom scenario is always a conversation the user came here to start,
    // so they deliver the opening line.
    opensWith: "user",
    openingLine: parsed.openingLine ?? "So… what did you want to talk about?",
    minutes: 7,
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
  const system = [
    `You are a fast, encouraging American communication drill coach. The user is doing a 2-minute rep on one skill: ${skill}.`,
    `Write in natural American English (US spelling and idiom). Never use British or Australian words like mate, whilst, reckon, brilliant, keen, proper or sorted.`,
    `They were told to practice: ${focus}`,
    `Score their single reply 0-100 for how well it hits that focus. Be honest — typical replies land 40-75.`,
    `Reply ONLY with minified JSON: {"score":n,"feedback":"one specific sentence, <=110 chars","better":"a sharper line they could say instead, <=140 chars"}`,
  ].join("\n");

  const raw = await chat(
    ROLEPLAY_MODEL,
    [
      { role: "system", content: system },
      {
        role: "user",
        content: `THEY SAID: ${theirLine}\nUSER REPLIED: ${reply}`,
      },
    ],
    300,
  );

  const parsed = extractJson<Partial<DrillRoundFeedback>>(raw);
  return {
    score: clamp(Number(parsed?.score ?? 50)),
    feedback: parsed?.feedback?.trim() ?? "Solid rep — keep it specific and calm.",
    better: parsed?.better?.trim() ?? "",
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

interface RawPilotCoach {
  route?: PilotCoachResponse["route"];
  day?: number;
  evidence_quote?: string | null;
  behavior_id?: PilotCoachResponse["behaviorId"];
  note?: string;
  retry_instruction?: string | null;
  retry_prompt?: string | null;
}

/** One evidence-linked note from Hope, validated against the confirmed words. */
export async function evaluatePilotAttempt(
  module: PilotModule,
  confirmedTranscript: string,
  counterpartResponse: string,
): Promise<PilotCoachResponse> {
  const system = [
    `You are Hope, the AI coach for Day ${module.day}: ${module.title}.`,
    `Select exactly one behavior from: ${module.evaluation.priority_order.join(", ")}.`,
    `Quote an exact contiguous substring of the confirmed transcript. Never clean or paraphrase the quote.`,
    `Describe only observable words or turn structure. Give one concrete action for the same-moment retry.`,
    `End with the exact retry prompt: Try that same moment again.`,
    `Do not score, diagnose, infer motives or delivery, praise generally, provide a replacement speech, or treat agreement as success.`,
    `Prohibited inferences: ${module.evaluation.prohibited_inferences.join("; ")}.`,
    `Success criteria: ${module.evaluation.success_criteria.join("; ")}.`,
    `Keep the note to 32 words maximum, the retry instruction to 20 words maximum, and both together to 48 words maximum.`,
    `Use one coaching priority only. Do not use generic praise, scores, percentages, motive, diagnosis, personality, emotion, relationship, future-outcome, or counterpart-agreement claims.`,
    `Do not use em dashes, exclamation marks, inflated transitions, chatbot residue, or silently repair the learner's words.`,
    `Return only minified JSON: {"route":"coach","day":${module.day},"evidence_quote":"exact quote","behavior_id":"allowed behavior","note":"one observable note","retry_instruction":"one action","retry_prompt":"Try that same moment again."}`,
  ].join("\n");
  const user = `CONFIRMED TRANSCRIPT:\n${confirmedTranscript}\n\nPRACTICE PARTNER RESPONSE:\n${counterpartResponse}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await chat(DEBRIEF_MODEL, [
      { role: "system", content: system },
      { role: "user", content: user },
    ], 700);
    const parsed = extractJson<RawPilotCoach>(raw);
    const value: PilotCoachResponse = {
      route: parsed?.route ?? "clarify",
      day: Number(parsed?.day ?? module.day),
      evidenceQuote: typeof parsed?.evidence_quote === "string" ? parsed.evidence_quote : null,
      behaviorId: parsed?.behavior_id ?? null,
      note: sanitizePilotText(parsed?.note) || "I couldn't verify that feedback against your words. Please try once more.",
      retryInstruction: typeof parsed?.retry_instruction === "string" ? sanitizePilotText(parsed.retry_instruction) : null,
      retryPrompt: parsed?.retry_prompt === "Try that same moment again." ? parsed.retry_prompt : null,
    };
    if (validatePilotCoachResponse(value, module, confirmedTranscript).length === 0) return value;
  }
  safeLog("[pilot] coach validation failed closed", { code: "pilot_coach_invalid", day: module.day });
  return neutralPilotCoachResponse(module);
}

function sanitizePilotText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/```/g, "").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function sanitizePilotLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 48);
}

export class TranscriptionUnavailableError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Transcription service unavailable");
    this.name = "TranscriptionUnavailableError";
    this.status = status;
  }
}

/** Transcribe a recorded audio clip using the Rork AI Gateway. */
export async function transcribeAudio(base64Audio: string, mediaType = "audio/mp4"): Promise<string> {
  const res = await fetch(`${BASE}/v2/vercel/v4/ai/transcription-model`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
      "ai-model-id": "openai/gpt-4o-mini-transcribe",
      "ai-transcription-model-specification-version": "4",
    },
    body: JSON.stringify({ audio: base64Audio, mediaType }),
  });

  if (!res.ok) {
    if (res.status === 402 || res.status === 429 || res.status >= 500) {
      throw new TranscriptionUnavailableError(res.status);
    }
    throw new Error(`Transcription failed (${res.status})`);
  }

  const json = (await res.json()) as { text?: string; transcript?: string; content?: string };
  const text = json.text ?? json.transcript ?? json.content ?? "";
  if (!text) throw new Error("Empty transcription");
  return text.trim();
}

export { REACTION_BEHAVIOUR };
