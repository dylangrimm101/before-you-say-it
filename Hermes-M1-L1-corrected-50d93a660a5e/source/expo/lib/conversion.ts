import { CURRICULUM_MODULES, curriculumModule, type ModuleId } from "@/constants/modules";
import type { Debrief, Turn } from "@/types/convo";

export const CONVERSATION_PHASES = [
  { id: "block-1", days: "Modules 1–2", name: "Get clear before you speak" },
  { id: "block-2", days: "Modules 3–4", name: "Start and receive the conversation" },
  { id: "block-3", days: "Modules 5–6", name: "Stay clear when it gets difficult" },
  { id: "block-4", days: "Modules 7–8", name: "Repair and transfer" },
] as const;

export type FocusSkillId = ModuleId;

export interface FocusSkill {
  id: ModuleId;
  name: string;
  body: string;
  headline: string;
  beforeNote: string;
  afterNote: string;
}

const MODULE_COPY: Record<ModuleId, Omit<FocusSkill, "id" | "name">> = {
  get_to_the_point: {
    body: "Practice putting one point first and keeping extra detail from hiding it.",
    headline: "Your best starting point is getting to the point.",
    beforeNote: "This is the exact language we reviewed.",
    afterNote: "One point, stated clearly.",
  },
  make_a_clear_ask: {
    body: "Practice naming one next step the other person can answer.",
    headline: "Your best starting point is making a clear ask.",
    beforeNote: "This is the exact language we reviewed.",
    afterNote: "A request with a clear answer.",
  },
  start_the_conversation: {
    body: "Practice opening with the purpose of the conversation before adding context.",
    headline: "Your best starting point is starting the conversation.",
    beforeNote: "This is the exact language we reviewed.",
    afterNote: "A clean, usable opening.",
  },
  listen_and_respond: {
    body: "Practice answering what was said while keeping your own point in view.",
    headline: "Your best starting point is listening and responding.",
    beforeNote: "This is the exact language we reviewed.",
    afterNote: "A response to the moment in front of you.",
  },
  stay_clear_under_pushback: {
    body: "Practice acknowledging resistance without replacing the point you came to discuss.",
    headline: "Your best starting point is staying clear under pushback.",
    beforeNote: "This is the exact language we reviewed.",
    afterNote: "The original point stays in view.",
  },
  pause_say_no_boundary: {
    body: "Practice taking room before answering, then stating a limit in usable language.",
    headline: "Your best starting point is pausing or setting a boundary.",
    beforeNote: "This is the exact language we reviewed.",
    afterNote: "A pause, no, or boundary you can use.",
  },
  repair_what_went_wrong: {
    body: "Practice naming what happened and making one repair move without reopening every issue.",
    headline: "Your best starting point is repairing what went wrong.",
    beforeNote: "This is the exact language we reviewed.",
    afterNote: "One concrete repair move.",
  },
  use_it_in_real_life: {
    body: "Practice carrying a clear move from rehearsal into a real conversation.",
    headline: "Your best starting point is using the practice in real life.",
    beforeNote: "This is the exact language we reviewed.",
    afterNote: "One move to take with you.",
  },
};

function focusFor(moduleId: ModuleId): FocusSkill {
  const module = curriculumModule(moduleId) ?? CURRICULUM_MODULES[0];
  return { id: module.id, name: module.name, ...MODULE_COPY[module.id] };
}

/** Selects one authored module from observed debrief language, using the intake hypothesis only as a fallback. */
export function selectFocusSkill(debrief: Debrief, hypothesis?: ModuleId): FocusSkill {
  const flag = debrief.flags[0];
  const text = `${debrief.headline} ${flag?.issue ?? ""} ${flag?.reframe ?? ""} ${debrief.nextRep}`.toLowerCase();
  let moduleId: ModuleId | null = null;
  if (/boundar|say no|pause|limit|space|not available/.test(text)) moduleId = "pause_say_no_boundary";
  else if (/repair|apolog|went wrong|circle back|own what/.test(text)) moduleId = "repair_what_went_wrong";
  else if (/backed off|hold the ask|lost the ask|changed the ask|pushback|resistan/.test(text)) moduleId = "stay_clear_under_pushback";
  else if (/listen|respond|answer what|acknowledge|hear/.test(text)) moduleId = "listen_and_respond";
  else if (/\bstart\b|\bopening\b|\blead with\b|\bbegin\b/.test(text)) moduleId = "start_the_conversation";
  else if (/commitment|specific|request|ask|what.*when|who.*when/.test(text)) moduleId = "make_a_clear_ask";
  else if (/too (?:long|much)|one sentence|brief|rambl|many points|buried|main point|hedg|soften/.test(text)) moduleId = "get_to_the_point";
  return focusFor(moduleId ?? hypothesis ?? "get_to_the_point");
}

export interface ConversionEvidence {
  learnerQuote: string;
  counterpartQuote: string;
  targetQuote: string;
  focus: FocusSkill;
  supportedStrength: string | null;
  immediateAction: string;
  confidence: "confirmed_quote" | "uncertain";
}

/** Builds evidence from a single exact contiguous confirmed quote and authored module language. */
export function conversionEvidence(turns: Turn[], debrief: Debrief, hypothesis?: ModuleId): ConversionEvidence {
  const learnerLines = turns.filter((turn) => turn.role === "user").map((turn) => turn.text.trim()).filter(Boolean);
  const counterpartQuote = turns.find((turn) => turn.role === "them")?.text.trim() ?? "";
  const exactFlagQuote = debrief.flags[0]?.quote?.trim() ?? "";
  const exactMatch = exactFlagQuote.length >= 2 && learnerLines.some((line) => line.includes(exactFlagQuote));
  const learnerQuote = exactMatch ? exactFlagQuote : "";
  const focus = selectFocusSkill(debrief, hypothesis);
  return {
    learnerQuote,
    counterpartQuote,
    targetQuote: debrief.flags[0]?.reframe?.trim() ?? debrief.script[0]?.trim() ?? "",
    focus,
    supportedStrength: debrief.wins[0]?.trim() || null,
    immediateAction: focus.body,
    confidence: exactMatch ? "confirmed_quote" : "uncertain",
  };
}

export function nextRecommendedModules(moduleId: ModuleId, count: number = 3): readonly FocusSkill[] {
  const index = CURRICULUM_MODULES.findIndex((module) => module.id === moduleId);
  if (index < 0) return [];
  return CURRICULUM_MODULES.slice(index + 1, index + 1 + count).map((module) => focusFor(module.id));
}

/** Returns true when conversion copy contains prohibited quantified or diagnostic claims. */
export function hasConversionOverclaim(text: string): boolean {
  return /%|percent|score|personality|attachment|communication type|relationship health|diagnos|motive|emotional state|will respond|predicted/i.test(text);
}
