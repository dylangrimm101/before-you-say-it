export type ModuleId =
  | "get_to_the_point"
  | "make_a_clear_ask"
  | "start_the_conversation"
  | "listen_and_respond"
  | "stay_clear_under_pushback"
  | "pause_say_no_boundary"
  | "repair_what_went_wrong"
  | "use_it_in_real_life";

export type OnboardingEntryRoute = "real_conversation" | "recurring_problem" | "desired_skill";

export interface CurriculumModule {
  id: ModuleId;
  number: number;
  block: 1 | 2 | 3 | 4;
  blockName: string;
  name: string;
  promise: string;
}

const BLOCKS = {
  1: "Get clear before you speak",
  2: "Start and receive the conversation",
  3: "Stay clear when it gets difficult",
  4: "Repair and transfer",
} as const;

export const CURRICULUM_MODULES: readonly CurriculumModule[] = [
  { id: "get_to_the_point", number: 1, block: 1, blockName: BLOCKS[1], name: "Get to the Point", promise: "Organize what you mean, identify the point that matters, and say it without burying it under explanations." },
  { id: "make_a_clear_ask", number: 2, block: 1, blockName: BLOCKS[1], name: "Make a Clear Ask", promise: "Turn a vague need, frustration, or desired quality into something another person can actually answer." },
  { id: "start_the_conversation", number: 3, block: 2, blockName: BLOCKS[2], name: "Start the Conversation", promise: "Bring something up clearly without ambushing, accusing, or delivering the entire case in the opening." },
  { id: "listen_and_respond", number: 4, block: 2, blockName: BLOCKS[2], name: "Listen and Respond", promise: "Understand what was said without immediately fixing, defending, correcting, or abandoning your own point." },
  { id: "stay_clear_under_pushback", number: 5, block: 3, blockName: BLOCKS[3], name: "Stay Clear Under Pushback", promise: "Keep the point when someone becomes defensive, minimizes, changes the subject, or pushes back." },
  { id: "pause_say_no_boundary", number: 6, block: 3, blockName: BLOCKS[3], name: "Pause, Say No, or Set a Boundary", promise: "Slow or end a conversation cleanly, make a real boundary, and stop forcing immediate resolution." },
  { id: "repair_what_went_wrong", number: 7, block: 4, blockName: BLOCKS[4], name: "Repair What Went Wrong", promise: "Own what was said or done badly without erasing the issue that still needs attention." },
  { id: "use_it_in_real_life", number: 8, block: 4, blockName: BLOCKS[4], name: "Use It in Real Life", promise: "Combine the skills, prepare for a real conversation, review what happened, and build a personal playbook." },
] as const;

export const RECURRING_PROBLEMS: readonly { label: string; moduleId: ModuleId }[] = [
  { label: "I struggle to organize my thoughts or get to the point", moduleId: "get_to_the_point" },
  { label: "I know what I mean, but my requests come out vague", moduleId: "make_a_clear_ask" },
  { label: "I put off starting hard conversations", moduleId: "start_the_conversation" },
  { label: "I react before I have really heard the other person", moduleId: "listen_and_respond" },
  { label: "I lose my point when someone pushes back", moduleId: "stay_clear_under_pushback" },
  { label: "I agree when I need to pause, say no, or set a limit", moduleId: "pause_say_no_boundary" },
  { label: "I need to repair conversations that went wrong", moduleId: "repair_what_went_wrong" },
  { label: "I’m not sure. Help me work it out", moduleId: "use_it_in_real_life" },
] as const;

export const DESIRED_SKILLS: readonly { label: string; moduleId: ModuleId }[] = [
  { label: "Organize my thoughts and get to the point", moduleId: "get_to_the_point" },
  { label: "Say what I need or make a clear request", moduleId: "make_a_clear_ask" },
  { label: "Start a difficult conversation", moduleId: "start_the_conversation" },
  { label: "Listen and respond without losing my own point", moduleId: "listen_and_respond" },
  { label: "Stay clear when someone pushes back", moduleId: "stay_clear_under_pushback" },
  { label: "Pause, say no, or set a boundary", moduleId: "pause_say_no_boundary" },
  { label: "Repair what happened and try again", moduleId: "repair_what_went_wrong" },
] as const;

export const DESIRED_SHIFTS: readonly { label: string; moduleId: ModuleId }[] = [
  { label: "Get to the point sooner", moduleId: "get_to_the_point" },
  { label: "Say what I need more clearly", moduleId: "make_a_clear_ask" },
  { label: "Bring it up instead of avoiding it", moduleId: "start_the_conversation" },
  { label: "Hear their concern before responding", moduleId: "listen_and_respond" },
  { label: "Stay with my point after pushback", moduleId: "stay_clear_under_pushback" },
  { label: "Set a limit without escalating", moduleId: "pause_say_no_boundary" },
  { label: "Repair the conversation and try again", moduleId: "repair_what_went_wrong" },
] as const;

export const PRESSURE_CONDITIONS: readonly { label: string; reaction: string }[] = [
  { label: "They push back or challenge me", reaction: "defensive" },
  { label: "They minimize what I’m saying", reaction: "minimizes" },
  { label: "They shut down or avoid the issue", reaction: "quiet" },
  { label: "They turn the issue back on me", reaction: "turns-back" },
  { label: "They agree in the moment, but nothing changes", reaction: "agrees-without-changing" },
  { label: "I get flustered and lose my point", reaction: "defensive" },
  { label: "I’m not sure. Surprise me", reaction: "not-sure" },
] as const;

const BY_ID = new Map<ModuleId, CurriculumModule>(CURRICULUM_MODULES.map((module) => [module.id, module]));
const LEGACY_MODULE_BY_DAY: Readonly<Record<number, ModuleId>> = {
  2: "get_to_the_point",
  3: "stay_clear_under_pushback",
  4: "pause_say_no_boundary",
  5: "get_to_the_point",
  6: "get_to_the_point",
  7: "make_a_clear_ask",
  8: "start_the_conversation",
};

export function curriculumModule(id: ModuleId | string | null | undefined): CurriculumModule | undefined {
  return id ? BY_ID.get(id as ModuleId) : undefined;
}

export function curriculumModuleForDay(day: number): CurriculumModule | undefined {
  return curriculumModule(LEGACY_MODULE_BY_DAY[day]);
}

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" && BY_ID.has(value as ModuleId);
}

export function moduleRouteValue(moduleId: ModuleId): string {
  return moduleId;
}

export function practiceDayForRoute(value: string): number | null {
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 8 ? day : null;
}
