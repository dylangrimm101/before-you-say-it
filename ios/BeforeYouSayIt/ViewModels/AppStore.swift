import Foundation
import Observation

/**
 Local-first app state persisted to UserDefaults with the same keys and
 shapes as the Expo app (cc.profile.v1, cc.sessions.v1, …).
 */
@Observable
final class AppStore {
    private enum Keys {
        static let profile = "cc.profile.v1"
        static let sessions = "cc.sessions.v1"
        static let custom = "cc.custom.v1"
        static let drills = "cc.drills.v1"
        static let reminder = "cc.reminder.v1"
        static let challenge = "cc.challenge.v1"
        static let freeze = "cc.freeze.v1"
    }

    private static let defaultFreeze = FreezeState(available: 1, usedDates: [], lastMilestone: 0)
    private static let maxFreezes = 2

    private(set) var profile: Profile?
    private(set) var sessions: [Session] = []
    private(set) var customScenarios: [Scenario] = []
    private(set) var drillLog: [DrillResult] = []
    private(set) var reminder: ReminderSetting?
    private(set) var challengeLog: [ChallengeLogEntry] = []
    private(set) var freeze: FreezeState = AppStore.defaultFreeze

    /** Set after onboarding so the paywall shows once on first arrival. */
    var pendingPaywall: Bool = false

    private let defaults = UserDefaults.standard
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init() {
        profile = load(Keys.profile)
        sessions = load(Keys.sessions) ?? []
        customScenarios = load(Keys.custom) ?? []
        drillLog = load(Keys.drills) ?? []
        reminder = load(Keys.reminder)
        challengeLog = load(Keys.challenge) ?? []
        freeze = load(Keys.freeze) ?? AppStore.defaultFreeze
        checkFreezeMilestone()
        if profile != nil {
            syncNudge()
        }
    }

    /** Recompute and (re)schedule the 6 PM challenge nudge from current state. */
    private func syncNudge() {
        let todayDone = challengeLog.contains { $0.date == Self.dayKey(Date()) }
        let nextDay = currentChallengeDay
        Task {
            await ReminderService.syncChallengeNudge(todayDone: todayDone, nextDay: nextDay)
        }
    }

    private func load<T: Decodable>(_ key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }

    private func save<T: Encodable>(_ value: T, key: String) {
        if let data = try? encoder.encode(value) {
            defaults.set(data, forKey: key)
        }
    }

    // MARK: - Mutations

    func saveProfile(_ next: Profile) {
        profile = next
        save(next, key: Keys.profile)
    }

    func upsertSession(_ session: Session) {
        if let idx = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[idx] = session
        } else {
            sessions.insert(session, at: 0)
        }
        sessions = Array(sessions.prefix(60))
        save(sessions, key: Keys.sessions)
        checkFreezeMilestone()
    }

    func addCustomScenario(_ scenario: Scenario) {
        customScenarios.insert(scenario, at: 0)
        customScenarios = Array(customScenarios.prefix(40))
        save(customScenarios, key: Keys.custom)
    }

    func logDrill(_ result: DrillResult) {
        drillLog.insert(result, at: 0)
        drillLog = Array(drillLog.prefix(90))
        save(drillLog, key: Keys.drills)
        checkFreezeMilestone()
    }

    /** Mark a challenge day complete (idempotent) and persist the log. */
    func markChallengeDayDone(_ day: Int) {
        guard (1 ... 28).contains(day), !challengeLog.contains(where: { $0.day == day }) else { return }
        challengeLog.append(
            ChallengeLogEntry(
                day: day,
                date: Self.dayKey(Date()),
                completedAt: Date().timeIntervalSince1970 * 1000
            )
        )
        save(challengeLog, key: Keys.challenge)
        checkFreezeMilestone()
        // They just finished a rep — the friendliest moment to ask for
        // permission so tomorrow's 6 PM nudge can be delivered.
        Task {
            _ = await ReminderService.requestPermission()
            let todayDone = challengeLog.contains { $0.date == Self.dayKey(Date()) }
            await ReminderService.syncChallengeNudge(todayDone: todayDone, nextDay: currentChallengeDay)
        }
    }

    /**
     Enable/update or disable the daily drill reminder.
     Returns false when notification permission was denied.
     */
    func setReminder(_ next: ReminderSetting) async -> Bool {
        if next.enabled {
            let granted = await ReminderService.requestPermission()
            guard granted else { return false }
            await ReminderService.scheduleDaily(hour: next.hour, minute: next.minute)
        } else {
            ReminderService.cancel()
        }
        reminder = next
        save(next, key: Keys.reminder)
        return true
    }

    func reset() {
        profile = nil
        sessions = []
        customScenarios = []
        drillLog = []
        reminder = nil
        challengeLog = []
        freeze = AppStore.defaultFreeze
        ReminderService.cancel()
        ReminderService.cancelChallengeNudge()
        [Keys.profile, Keys.sessions, Keys.custom, Keys.drills, Keys.reminder, Keys.challenge, Keys.freeze].forEach {
            defaults.removeObject(forKey: $0)
        }
    }

    // MARK: - Streak freezes

    /** Frozen days as a set for quick lookups. */
    var frozenDays: Set<String> {
        Set(freeze.usedDates)
    }

    /** Activity plus frozen days — the set the streak is computed over. */
    private var streakDays: Set<String> {
        activityDays.union(frozenDays)
    }

    /**
     A freeze can rescue the streak when exactly yesterday was missed and
     there was a live chain the day before.
     */
    var canFreeze: Bool {
        guard freeze.available > 0 else { return false }
        let days = streakDays
        let yesterday = Self.dayKey(Date().addingTimeInterval(-86400))
        let dayBefore = Self.dayKey(Date().addingTimeInterval(-2 * 86400))
        return !days.contains(yesterday) && days.contains(dayBefore)
    }

    /** Spend one freeze on yesterday, reconnecting the streak. Returns success. */
    @discardableResult
    func useStreakFreeze() -> Bool {
        let yesterday = Self.dayKey(Date().addingTimeInterval(-86400))
        guard freeze.available > 0, !freeze.usedDates.contains(yesterday) else { return false }
        freeze.available -= 1
        freeze.usedDates = Array((freeze.usedDates + [yesterday]).suffix(60))
        save(freeze, key: Keys.freeze)
        return true
    }

    /**
     Earn a new freeze (max 2 banked) each time the streak crosses a fresh
     multiple of 7 — consistency refills the safety net.
     */
    private func checkFreezeMilestone() {
        let milestone = (activityStreak / 7) * 7
        guard milestone > 0, milestone > freeze.lastMilestone else { return }
        freeze.available = min(Self.maxFreezes, freeze.available + 1)
        freeze.lastMilestone = milestone
        save(freeze, key: Keys.freeze)
    }

    // MARK: - Lookups & derived state

    func findScenario(_ id: String) -> Scenario? {
        ScenarioLibrary.scenarios.first { $0.id == id }
            ?? customScenarios.first { $0.id == id }
    }

    var completed: [Session] {
        sessions.filter { $0.debrief != nil }
    }

    var todayDrillDone: Bool {
        drillLog.contains { $0.date == Self.dayKey(Date()) }
    }

    var challengeDoneDays: Set<Int> {
        Set(challengeLog.map(\.day))
    }

    /** First incomplete challenge day (1-28); 29 when everything is done. */
    var currentChallengeDay: Int {
        let done = challengeDoneDays
        var day = 1
        while day <= 28 && done.contains(day) { day += 1 }
        return day
    }

    static func dayKey(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.string(from: date)
    }

    /** Consecutive-day streak across a set of YYYY-MM-DD days, ending today or yesterday. */
    private static func streak(from days: Set<String>) -> Int {
        guard !days.isEmpty else { return 0 }

        let oneDay: TimeInterval = 86400
        let now = Date()
        var cursor: Date
        if days.contains(dayKey(now)) {
            cursor = now
        } else if days.contains(dayKey(now.addingTimeInterval(-oneDay))) {
            cursor = now.addingTimeInterval(-oneDay)
        } else {
            return 0
        }

        var count = 0
        while days.contains(dayKey(cursor)) {
            count += 1
            cursor = cursor.addingTimeInterval(-oneDay)
        }
        return count
    }

    /** Consecutive-day streak of completed rehearsals, ending today or yesterday. */
    var streak: Int {
        Self.streak(
            from: Set(
                sessions.compactMap { s -> String? in
                    guard let ended = s.endedAt else { return nil }
                    return Self.dayKey(Date(timeIntervalSince1970: ended / 1000))
                }
            )
        )
    }

    /** Every YYYY-MM-DD with any training activity: drills, rehearsals or challenge days. */
    var activityDays: Set<String> {
        var days = Set<String>()
        for s in sessions {
            guard let ended = s.endedAt else { continue }
            days.insert(Self.dayKey(Date(timeIntervalSince1970: ended / 1000)))
        }
        for d in drillLog { days.insert(d.date) }
        for e in challengeLog { days.insert(e.date) }
        return days
    }

    /** Streak across ALL activity — a daily drill keeps it alive, not just rehearsals. */
    var activityStreak: Int {
        Self.streak(from: streakDays)
    }

    var averages: Scores? {
        let done = completed
        guard !done.isEmpty else { return nil }
        var sum = (clarity: 0, empathy: 0, assertiveness: 0, composure: 0)
        for s in done {
            guard let sc = s.debrief?.scores else { continue }
            sum.clarity += sc.clarity
            sum.empathy += sc.empathy
            sum.assertiveness += sc.assertiveness
            sum.composure += sc.composure
        }
        let n = done.count
        return Scores(
            clarity: Int((Double(sum.clarity) / Double(n)).rounded()),
            empathy: Int((Double(sum.empathy) / Double(n)).rounded()),
            assertiveness: Int((Double(sum.assertiveness) / Double(n)).rounded()),
            composure: Int((Double(sum.composure) / Double(n)).rounded())
        )
    }

    /**
     Trend of overall scores: recent reps (up to 3) vs the reps before them.
     Positive = improving. Nil until 2+ completed reps.
     */
    var trend: Int? {
        let overalls = completed.compactMap { $0.debrief?.scores.overall }
        guard overalls.count >= 2 else { return nil }
        let window = max(1, min(3, overalls.count / 2))
        let recent = overalls.prefix(window)
        let prior = overalls.dropFirst(window).prefix(window)
        guard !prior.isEmpty else { return nil }
        let avg: (ArraySlice<Int>) -> Double = { xs in Double(xs.reduce(0, +)) / Double(xs.count) }
        return Int((avg(ArraySlice(recent)) - avg(prior)).rounded())
    }
}
