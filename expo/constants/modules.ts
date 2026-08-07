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
  practiceDay: number;
}

const BLOCKS = {
  1: "Get clear before you speak",
  2: "Start and receive the conversation",
  3: "Stay clear when it gets difficult",
  4: "Repair and transfer",
} as const;

export const CURRICULUM_MODULES: readonly CurriculumModule[] = [
  { id: "get_to_the_point", number: 1, block: 1, blockName: BLOCKS[1], name: "Get to the Point", practiceDay: 6 },
  { id: "make_a_clear_ask", number: 2, block: 1, blockName: BLOCKS[1], name: "Make a Clear Ask", practiceDay: 7 },
  { id: "start_the_conversation", number: 3, block: 2, blockName: BLOCKS[2], name: "Start the Conversation", practiceDay: 2 },
  { id: "listen_and_respond", number: 4, block: 2, blockName: BLOCKS[2], name: "Listen and Respond", practiceDay: 4 },
  { id: "stay_clear_under_pushback", number: 5, block: 3, blockName: BLOCKS[3], name: "Stay Clear Under Pushback", practiceDay: 3 },
  { id: "pause_say_no_boundary", number: 6, block: 3, blockName: BLOCKS[3], name: "Pause, Say No, or Set a Boundary", practiceDay: 5 },
  { id: "repair_what_went_wrong", number: 7, block: 4, blockName: BLOCKS[4], name: "Repair What Went Wrong", practiceDay: 8 },
  { id: "use_it_in_real_life", number: 8, block: 4, blockName: BLOCKS[4], name: "Use It in Real Life", practiceDay: 8 },
] as const;

export const RECURRING_PROBLEMS: readonly { label: string; moduleId: ModuleId }[] = [
  { label: "I say too much and lose the point", moduleId: "get_to_the_point" },
  { label: "My requests come out vague or indirect", moduleId: "make_a_clear_ask" },
  { label: "I put off starting hard conversations", moduleId: "start_the_conversation" },
  { label: "I struggle to listen and answer what was said", moduleId: "listen_and_respond" },
  { label: "Pushback makes me lose what I meant to say", moduleId: "stay_clear_under_pushback" },
  { label: "I say yes when I need a pause, no, or boundary", moduleId: "pause_say_no_boundary" },
  { label: "I need to repair conversations that went wrong", moduleId: "repair_what_went_wrong" },
] as const;

export const DESIRED_SKILLS: readonly { label: string; moduleId: ModuleId }[] = [
  { label: "Say the main point clearly", moduleId: "get_to_the_point" },
  { label: "Make a request someone can answer", moduleId: "make_a_clear_ask" },
  { label: "Open a difficult conversation", moduleId: "start_the_conversation" },
  { label: "Listen and respond without losing myself", moduleId: "listen_and_respond" },
  { label: "Stay clear when someone pushes back", moduleId: "stay_clear_under_pushback" },
  { label: "Pause, say no, or set a boundary", moduleId: "pause_say_no_boundary" },
  { label: "Repair what happened and try again", moduleId: "repair_what_went_wrong" },
] as const;

const BY_ID = new Map<ModuleId, CurriculumModule>(CURRICULUM_MODULES.map((module) => [module.id, module]));
const BY_DAY = new Map<number, CurriculumModule>(CURRICULUM_MODULES.map((module) => [module.practiceDay, module]));

export function curriculumModule(id: ModuleId | string | null | undefined): CurriculumModule | undefined {
  return id ? BY_ID.get(id as ModuleId) : undefined;
}

export function curriculumModuleForDay(day: number): CurriculumModule | undefined {
  return BY_DAY.get(day);
}

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" && BY_ID.has(value as ModuleId);
}

export function moduleRouteValue(moduleId: ModuleId): string {
  return moduleId;
}

export function practiceDayForRoute(value: string): number | null {
  if (isModuleId(value)) return curriculumModule(value)?.practiceDay ?? null;
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 8 ? day : null;
}
