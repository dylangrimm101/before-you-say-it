import Foundation

nonisolated enum CategoryId: String, Codable, CaseIterable, Identifiable, Sendable {
    case partner, family, work, friends
    var id: String { rawValue }
}

nonisolated enum Difficulty: String, Codable, CaseIterable, Identifiable, Sendable {
    case gentle, steady, challenging
    var id: String { rawValue }
}

nonisolated enum PersonaVoice: String, Codable, CaseIterable, Identifiable, Sendable {
    case womanHope = "woman-hope"
    case manAdam = "man-adam"
    var id: String { rawValue }
}

nonisolated enum ReactionPattern: String, Codable, CaseIterable, Identifiable, Sendable {
    case defensive
    case hearsCriticism = "hears-criticism"
    case minimizes
    case quiet
    case louder
    case turnsBack = "turns-back"
    case agreesWithoutChanging = "agrees-without-changing"
    case notSure = "not-sure"
    var id: String { rawValue }
}

nonisolated struct Scenario: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var category: CategoryId
    var title: String
    var counterpart: String
    var situation: String
    var persona: String
    var goal: String
    var openingLine: String
    var minutes: Int
    var isCustom: Bool?
}

nonisolated enum TurnRole: String, Codable, Sendable {
    case user
    case them
}

nonisolated struct Turn: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var role: TurnRole
    var text: String
    var nudge: String?
}

nonisolated struct Flag: Codable, Hashable, Sendable {
    var quote: String
    var issue: String
    var reframe: String
}

nonisolated struct Scores: Codable, Hashable, Sendable {
    var clarity: Int
    var empathy: Int
    var assertiveness: Int
    var composure: Int

    var overall: Int {
        Int((Double(clarity + empathy + assertiveness + composure) / 4).rounded())
    }
}

nonisolated struct Debrief: Codable, Hashable, Sendable {
    var headline: String
    var scores: Scores
    var wins: [String]
    var flags: [Flag]
    var script: [String]
    var nextRep: String
}

nonisolated struct Session: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var scenarioId: String
    var title: String
    var counterpart: String
    var category: CategoryId
    var difficulty: Difficulty
    var persona: PersonaVoice?
    var reaction: ReactionPattern?
    var outcome: String?
    var turns: [Turn]
    var debrief: Debrief?
    var startedAt: Double
    var endedAt: Double?
}

nonisolated struct Profile: Codable, Hashable, Sendable {
    var focus: CategoryId
    var pattern: String
    var win: String
    var persona: PersonaVoice
    var reaction: ReactionPattern
    var outcome: String
    var dread: String
    var createdAt: Double
}

nonisolated struct DrillRound: Codable, Hashable, Sendable {
    var line: String
    var focus: String
}

nonisolated struct Drill: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var title: String
    var skill: String
    var setup: String
    var rounds: [DrillRound]
}

nonisolated struct DrillResult: Codable, Hashable, Sendable {
    var drillId: String
    var date: String
    var score: Int
    var completedAt: Double
}

nonisolated struct ReminderSetting: Codable, Hashable, Sendable {
    var enabled: Bool
    var hour: Int
    var minute: Int
}

nonisolated struct ChallengeLogEntry: Codable, Hashable, Sendable {
    /** 1-28 challenge day number. */
    var day: Int
    /** YYYY-MM-DD completion day. */
    var date: String
    var completedAt: Double
}

nonisolated struct FreezeState: Codable, Hashable, Sendable {
    /** Streak freezes in the bank (max 2). */
    var available: Int
    /** YYYY-MM-DD days that were frozen (count towards the streak). */
    var usedDates: [String]
    /** Highest streak multiple of 7 already rewarded with a freeze. */
    var lastMilestone: Int
}
