import SwiftUI

enum ChallengeTaskKind {
    case drill
    case rehearsal
    case custom
}

struct ChallengePlanDay: Identifiable, Hashable {
    /** 1-28. */
    let day: Int
    let kind: ChallengeTaskKind
    /** Drill id or scenario id. Empty for the custom finale. */
    let refId: String
    let title: String
    /** Short skill/context line under the title. */
    let meta: String
    let minutes: Int
    let difficulty: Difficulty?

    var id: Int { day }
}

struct ChallengePlanBlock: Identifiable {
    let title: String
    let blurb: String
    /** Fill/stroke tone for dots, icons and the Start button. */
    let accent: Color
    /** Darker sibling of `accent` used for type so it stays legible on paper. */
    let accentInk: Color
    let days: [ChallengePlanDay]

    var id: String { title }
}

/**
 The 28-day communication challenge: four weekly blocks that ramp from
 gentle first sentences to the hardest conversation the user came here for.
 Mirrors the Expo app's constants/challenge.ts.
 */
enum ChallengeLibrary {
    static let totalDays = 28

    static let blocks: [ChallengePlanBlock] = [
        ChallengePlanBlock(
            title: "Block 1: Find your voice",
            blurb: "Short reps. Low stakes. Say the thing out loud.",
            accent: Theme.mint,
            accentInk: Color(hex: 0x3D4C36),
            days: [
                ChallengePlanDay(day: 1, kind: .drill, refId: "open-hard", title: "Open the hard conversation", meta: "Clarity drill", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 2, kind: .drill, refId: "name-feeling", title: "Name the feeling, not the blame", meta: "Empathy drill", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 3, kind: .rehearsal, refId: "feedback", title: "Give hard feedback to someone you like", meta: "Rehearsal · gentle", minutes: 6, difficulty: .gentle),
                ChallengePlanDay(day: 4, kind: .drill, refId: "no-apology", title: "Say no without apologizing", meta: "Boundaries drill", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 5, kind: .rehearsal, refId: "friend-money", title: "Ask a friend for the money back", meta: "Rehearsal · gentle", minutes: 6, difficulty: .gentle),
                ChallengePlanDay(day: 6, kind: .drill, refId: "ask-for-help", title: "Ask for help before you drown", meta: "Clarity drill", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 7, kind: .rehearsal, refId: "friend-drift", title: "Name the distance between you", meta: "Rehearsal · gentle", minutes: 7, difficulty: .gentle),
            ]
        ),
        ChallengePlanBlock(
            title: "Block 2: Hold your ground",
            blurb: "They push back now. Repeat the ask without shrinking.",
            accent: Theme.blue,
            accentInk: Color(hex: 0x33475F),
            days: [
                ChallengePlanDay(day: 8, kind: .drill, refId: "broken-record", title: "The broken record", meta: "Assertiveness drill", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 9, kind: .rehearsal, refId: "chores", title: "Ask for a fair split of the housework", meta: "Rehearsal · steady", minutes: 7, difficulty: .steady),
                ChallengePlanDay(day: 10, kind: .drill, refId: "ask-number", title: "Say the number first", meta: "Negotiation drill", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 11, kind: .rehearsal, refId: "raise", title: "Ask for the raise you've earned", meta: "Rehearsal · steady", minutes: 8, difficulty: .steady),
                ChallengePlanDay(day: 12, kind: .drill, refId: "receive-criticism", title: "Take the hit without folding", meta: "Composure drill", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 13, kind: .rehearsal, refId: "sibling-caregiving", title: "Ask your brother to share the caregiving", meta: "Rehearsal · steady", minutes: 7, difficulty: .steady),
                ChallengePlanDay(day: 14, kind: .rehearsal, refId: "mother-boundary", title: "Set a boundary with your mother", meta: "Rehearsal · steady", minutes: 8, difficulty: .steady),
            ]
        ),
        ChallengePlanBlock(
            title: "Block 3: Stay steady under fire",
            blurb: "Higher heat. Keep your composure when they don't.",
            accent: Theme.amber,
            accentInk: Color(hex: 0x7A5716),
            days: [
                ChallengePlanDay(day: 15, kind: .drill, refId: "de-escalate", title: "Lower the temperature", meta: "Composure drill", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 16, kind: .rehearsal, refId: "burnout", title: "Tell your boss you're burned out", meta: "Rehearsal · steady", minutes: 8, difficulty: .steady),
                ChallengePlanDay(day: 17, kind: .drill, refId: "no-apology", title: "Say no without apologizing", meta: "Boundaries drill · again, harder", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 18, kind: .rehearsal, refId: "parent-comingclean", title: "Tell your parents a truth they won't like", meta: "Rehearsal · challenging", minutes: 7, difficulty: .challenging),
                ChallengePlanDay(day: 19, kind: .drill, refId: "name-feeling", title: "Name the feeling, not the blame", meta: "Empathy drill · under pressure", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 20, kind: .rehearsal, refId: "wedding-money", title: "Talk about the money you've been avoiding", meta: "Rehearsal · challenging", minutes: 8, difficulty: .challenging),
                ChallengePlanDay(day: 21, kind: .rehearsal, refId: "quit", title: "Resign without burning the bridge", meta: "Rehearsal · steady", minutes: 6, difficulty: .steady),
            ]
        ),
        ChallengePlanBlock(
            title: "Block 4: The real conversations",
            blurb: "Full difficulty. This is what you trained for.",
            accent: Theme.ember,
            accentInk: Theme.crimson,
            days: [
                ChallengePlanDay(day: 22, kind: .drill, refId: "open-hard", title: "Open the hard conversation", meta: "Clarity drill · no warm-up", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 23, kind: .rehearsal, refId: "intimacy", title: "Say you feel lonely in the relationship", meta: "Rehearsal · challenging", minutes: 8, difficulty: .challenging),
                ChallengePlanDay(day: 24, kind: .drill, refId: "broken-record", title: "The broken record", meta: "Assertiveness drill · they escalate", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 25, kind: .rehearsal, refId: "mother-boundary", title: "Set a boundary with your mother", meta: "Rehearsal · challenging", minutes: 8, difficulty: .challenging),
                ChallengePlanDay(day: 26, kind: .drill, refId: "de-escalate", title: "Lower the temperature", meta: "Composure drill · full heat", minutes: 2, difficulty: nil),
                ChallengePlanDay(day: 27, kind: .rehearsal, refId: "chores", title: "Ask for a fair split of the housework", meta: "Rehearsal · challenging", minutes: 7, difficulty: .challenging),
                ChallengePlanDay(day: 28, kind: .custom, refId: "", title: "The one you came here for", meta: "Your real conversation · full rehearsal", minutes: 8, difficulty: .challenging),
            ]
        ),
    ]
}
