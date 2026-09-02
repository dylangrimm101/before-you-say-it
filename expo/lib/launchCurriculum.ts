export type LaunchModuleNumber = 1 | 2;
export type ModuleCloseLessonId = "m1-close" | "m2-close";
export type LaunchLessonId =
  | "m1-l1" | "m1-l2" | "m1-l3" | "m1-l4" | "m1-l5" | "m1-close"
  | "m2-l1" | "m2-l2" | "m2-l3" | "m2-l4" | "m2-l5" | "m2-close";

export interface LaunchCurriculumModule {
  module: LaunchModuleNumber;
  title: string;
  deckIds: readonly LaunchLessonId[];
}

export interface LessonCompletionLike {
  lessonId: string;
  completedAt?: number;
}

export interface ModuleCloseProgress {
  lessonId: ModuleCloseLessonId;
  module: LaunchModuleNumber;
  completedAt: number;
  sourceLineage: "approved-r2-close-deck";
}

const M1_DECK_IDS = ["m1-l1", "m1-l2", "m1-l3", "m1-l4", "m1-l5", "m1-close"] as const;
const M2_DECK_IDS = ["m2-l1", "m2-l2", "m2-l3", "m2-l4", "m2-l5", "m2-close"] as const;

/** The complete customer launch curriculum. The 8-module framework remains internal-only. */
export const LAUNCH_CURRICULUM_MODULES: readonly LaunchCurriculumModule[] = [
  { module: 1, title: "Get to the Point", deckIds: M1_DECK_IDS },
  { module: 2, title: "Make a Clear Ask", deckIds: M2_DECK_IDS },
];

export const LAUNCH_DECK_IDS: readonly LaunchLessonId[] = LAUNCH_CURRICULUM_MODULES.flatMap((module) => module.deckIds);

function expectedCloseId(module: LaunchModuleNumber): ModuleCloseLessonId {
  return `m${module}-close` as ModuleCloseLessonId;
}

export function isLaunchLessonId(value: unknown): value is LaunchLessonId {
  return typeof value === "string" && (LAUNCH_DECK_IDS as readonly string[]).includes(value);
}

export function normalizeModuleCloseProgress(value: unknown): ModuleCloseProgress[] {
  if (!Array.isArray(value)) return [];
  const byLesson = new Map<ModuleCloseLessonId, ModuleCloseProgress>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Partial<ModuleCloseProgress>;
    if ((item.module !== 1 && item.module !== 2)
      || item.lessonId !== expectedCloseId(item.module)
      || typeof item.completedAt !== "number"
      || !Number.isFinite(item.completedAt)
      || item.completedAt <= 0
      || item.sourceLineage !== "approved-r2-close-deck") continue;
    const current = byLesson.get(item.lessonId);
    if (!current || current.completedAt < item.completedAt) byLesson.set(item.lessonId, item as ModuleCloseProgress);
  }
  return [...byLesson.values()].sort((left, right) => left.completedAt - right.completedAt);
}

export function mergeModuleCloseProgress(existing: unknown, incoming: ModuleCloseProgress): ModuleCloseProgress[] {
  const normalizedIncoming = normalizeModuleCloseProgress([incoming])[0];
  if (!normalizedIncoming) throw new Error("Invalid module close completion");
  return normalizeModuleCloseProgress([...normalizeModuleCloseProgress(existing), normalizedIncoming]);
}

export function launchModuleCompletion(
  module: LaunchModuleNumber,
  _lessonProgress: readonly LessonCompletionLike[],
  closeProgress: readonly ModuleCloseProgress[],
): boolean {
  return normalizeModuleCloseProgress(closeProgress).some((entry) => entry.module === module);
}

export function nextLaunchDeck(
  lessonProgress: readonly LessonCompletionLike[],
  closeProgress: readonly ModuleCloseProgress[],
): LaunchLessonId | undefined {
  const completedLessons = new Set<LaunchLessonId>(lessonProgress.map((entry) => entry.lessonId).filter(isLaunchLessonId));
  const completedCloses = new Set(normalizeModuleCloseProgress(closeProgress).map((entry) => entry.lessonId));
  return LAUNCH_DECK_IDS.find((id) => id.endsWith("-close") ? !completedCloses.has(id as ModuleCloseLessonId) : !completedLessons.has(id));
}

export function nextLaunchDeckForModule(
  module: LaunchModuleNumber,
  lessonProgress: readonly LessonCompletionLike[],
  closeProgress: readonly ModuleCloseProgress[],
): LaunchLessonId | undefined {
  const next = nextLaunchDeck(lessonProgress, closeProgress);
  if (next?.startsWith(`m${module}-`)) return next;
  if (launchModuleCompletion(module, lessonProgress, closeProgress)) return LAUNCH_CURRICULUM_MODULES[module - 1]?.deckIds[0];
  return undefined;
}

export function isLaunchDeckCompleted(
  lessonId: LaunchLessonId,
  lessonProgress: readonly LessonCompletionLike[],
  closeProgress: readonly ModuleCloseProgress[],
): boolean {
  return lessonId.endsWith("-close")
    ? normalizeModuleCloseProgress(closeProgress).some((entry) => entry.lessonId === lessonId)
    : lessonProgress.some((entry) => entry.lessonId === lessonId);
}

/** Route-level access boundary shared by deep links, decks, and rehearsals. */
export function canAccessLaunchDeck(
  lessonId: LaunchLessonId,
  isEntitled: boolean,
  lessonProgress: readonly LessonCompletionLike[],
  closeProgress: readonly ModuleCloseProgress[],
): boolean {
  if (!isEntitled) return false;
  return isLaunchDeckCompleted(lessonId, lessonProgress, closeProgress)
    || nextLaunchDeck(lessonProgress, closeProgress) === lessonId;
}
