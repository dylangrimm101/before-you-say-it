import type { ImageSourcePropType } from "react-native";

export type ApprovedLessonId =
  | "m1-l1"
  | "m1-l2"
  | "m1-l3"
  | "m1-l4"
  | "m1-l5"
  | "m1-close"
  | "m2-l1"
  | "m2-l2"
  | "m2-l3"
  | "m2-l4"
  | "m2-l5"
  | "m2-close";

export interface ApprovedLessonDeck {
  id: ApprovedLessonId;
  module: 1 | 2;
  lesson: number | "close";
  title: string;
  shortName: string;
  namedMove: string | null;
  cardCount: number;
  contentAnchorPx: number | null;
  reviewThroughCard: number;
  rehearsalReturnCard: number | null;
  isCloseDeck: boolean;
  archivePath: string;
  thumbnail: ImageSourcePropType | null;
}

/**
 * Internal-review catalog transcribed from the approved 2026-08-24 handoff.
 * Deck HTML remains authoritative. M1 L4 intentionally follows its approved
 * 19-card HTML rather than the conflicting metadata count.
 */
export const APPROVED_LESSON_DECKS: readonly ApprovedLessonDeck[] = [
  {
    id: "m1-l1",
    module: 1,
    lesson: 1,
    title: "When the Point Gets Buried",
    shortName: "The Buried Point",
    namedMove: "One point. One proof. One move.",
    cardCount: 22,
    contentAnchorPx: 78,
    reviewThroughCard: 20,
    rehearsalReturnCard: 21,
    isCloseDeck: false,
    archivePath: "BYSI-Rork-Handoff/decks/M1-L1-Buried-Point.html",
    thumbnail: require("../assets/lesson-thumbnails/m1-l1-buried-point.png"),
  },
  {
    id: "m1-l2",
    module: 1,
    lesson: 2,
    title: "When You Start Building the Whole Case",
    shortName: "Cut the Case",
    namedMove: "One anchor. The rest stays in the folder.",
    cardCount: 22,
    contentAnchorPx: 68,
    reviewThroughCard: 20,
    rehearsalReturnCard: 21,
    isCloseDeck: false,
    archivePath: "BYSI-Rork-Handoff/decks/M1-L2-Cut-the-Case.html",
    thumbnail: require("../assets/lesson-thumbnails/m1-l2-cut-the-case.png"),
  },
  {
    id: "m1-l3",
    module: 1,
    lesson: 3,
    title: "Park and Return",
    shortName: "Park and Return",
    namedMove: "Both on the table. One at a time.",
    cardCount: 22,
    contentAnchorPx: 99,
    reviewThroughCard: 20,
    rehearsalReturnCard: 21,
    isCloseDeck: false,
    archivePath: "BYSI-Rork-Handoff/decks/M1-L3-Park-and-Return.html",
    thumbnail: require("../assets/lesson-thumbnails/m1-l3-park-and-return.png"),
  },
  {
    id: "m1-l4",
    module: 1,
    lesson: 4,
    title: "Make It Repeatable",
    shortName: "Make It Repeatable",
    namedMove: "Catch it. Say it back.",
    cardCount: 19,
    contentAnchorPx: 116,
    reviewThroughCard: 17,
    rehearsalReturnCard: 18,
    isCloseDeck: false,
    archivePath: "BYSI-Rork-Handoff/decks/M1-L4-Make-It-Repeatable.html",
    thumbnail: require("../assets/lesson-thumbnails/m1-l4-make-it-repeatable.png"),
  },
  {
    id: "m1-l5",
    module: 1,
    lesson: 5,
    title: "When It All Has to Fit in One Conversation",
    shortName: "Fit in One",
    namedMove: "Pick one. Keep the rest.",
    cardCount: 20,
    contentAnchorPx: 83,
    reviewThroughCard: 18,
    rehearsalReturnCard: 19,
    isCloseDeck: false,
    archivePath: "BYSI-Rork-Handoff/decks/M1-L5-Fit-in-One.html",
    thumbnail: require("../assets/lesson-thumbnails/m1-l5-fit-in-one.png"),
  },
  {
    id: "m1-close",
    module: 1,
    lesson: "close",
    title: "Five moves, one conversation",
    shortName: "Module 1 Close",
    namedMove: null,
    cardCount: 9,
    contentAnchorPx: null,
    reviewThroughCard: 9,
    rehearsalReturnCard: null,
    isCloseDeck: true,
    archivePath: "BYSI-Rork-Handoff/decks/M1-Close.html",
    thumbnail: null,
  },
  {
    id: "m2-l1",
    module: 2,
    lesson: 1,
    title: "When You've Said It Three Times and Nothing Changed",
    shortName: "Clear Ask",
    namedMove: "One action. One owner. Room to answer.",
    cardCount: 22,
    contentAnchorPx: 103,
    reviewThroughCard: 20,
    rehearsalReturnCard: 21,
    isCloseDeck: false,
    archivePath: "BYSI-Rork-Handoff/decks/M2-L1-Clear-Ask.html",
    thumbnail: require("../assets/lesson-thumbnails/m2-l1-clear-ask.png"),
  },
  {
    id: "m2-l2",
    module: 2,
    lesson: 2,
    title: "When You Don't Want to Put Anyone on the Spot",
    shortName: "Say Who",
    namedMove: "Say who you're asking.",
    cardCount: 22,
    contentAnchorPx: 73,
    reviewThroughCard: 20,
    rehearsalReturnCard: 21,
    isCloseDeck: false,
    archivePath: "BYSI-Rork-Handoff/decks/M2-L2-Say-Who.html",
    thumbnail: require("../assets/lesson-thumbnails/m2-l2-say-who.png"),
  },
  {
    id: "m2-l3",
    module: 2,
    lesson: 3,
    title: "When They Say They Can't",
    shortName: "When They Say They Can't",
    namedMove: "Hear it. Trade one thing. Say where it stands.",
    cardCount: 22,
    contentAnchorPx: 46,
    reviewThroughCard: 20,
    rehearsalReturnCard: 21,
    isCloseDeck: false,
    archivePath: "BYSI-Rork-Handoff/decks/M2-L3-When-They-Say-They-Cant.html",
    thumbnail: require("../assets/lesson-thumbnails/m2-l3-when-they-say-they-cant.png"),
  },
  {
    id: "m2-l4",
    module: 2,
    lesson: 4,
    title: "When They Can't Actually Say No",
    shortName: "Say Whether No",
    namedMove: "Say whether no is available.",
    cardCount: 22,
    contentAnchorPx: 166,
    reviewThroughCard: 20,
    rehearsalReturnCard: 21,
    isCloseDeck: false,
    archivePath: "BYSI-Rork-Handoff/decks/M2-L4-Say-Whether-No.html",
    thumbnail: require("../assets/lesson-thumbnails/m2-l4-say-whether-no.png"),
  },
  {
    id: "m2-l5",
    module: 2,
    lesson: 5,
    title: "When You Hand Over the Task and Keep the Job",
    shortName: "Ask for the Loop",
    namedMove: "Ask for the loop, not the last step.",
    cardCount: 22,
    contentAnchorPx: 146,
    reviewThroughCard: 20,
    rehearsalReturnCard: 21,
    isCloseDeck: false,
    archivePath: "BYSI-Rork-Handoff/decks/M2-L5-Ask-for-the-Loop.html",
    thumbnail: require("../assets/lesson-thumbnails/m2-l5-ask-for-the-loop.png"),
  },
  {
    id: "m2-close",
    module: 2,
    lesson: "close",
    title: "Five moves, one week",
    shortName: "Module 2 Close",
    namedMove: null,
    cardCount: 9,
    contentAnchorPx: null,
    reviewThroughCard: 9,
    rehearsalReturnCard: null,
    isCloseDeck: true,
    archivePath: "BYSI-Rork-Handoff/decks/M2-Close.html",
    thumbnail: null,
  },
] as const;

const LESSON_BY_ID = new Map<ApprovedLessonId, ApprovedLessonDeck>(
  APPROVED_LESSON_DECKS.map((lesson) => [lesson.id, lesson]),
);

export function isApprovedLessonId(value: unknown): value is ApprovedLessonId {
  return typeof value === "string" && LESSON_BY_ID.has(value as ApprovedLessonId);
}

export function approvedLessonDeck(id: ApprovedLessonId | string | null | undefined): ApprovedLessonDeck | undefined {
  return id && isApprovedLessonId(id) ? LESSON_BY_ID.get(id) : undefined;
}
