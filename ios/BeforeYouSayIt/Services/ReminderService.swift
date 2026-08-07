import Foundation
import UserNotifications

/** Single daily drill reminder + 6 PM challenge nudge, mirroring the Expo reminders.ts behaviour. */
enum ReminderService {
    private static let reminderId = "daily-drill-reminder"
    private static let challengeNudgeId = "challenge-6pm-nudge"
    private static let nudgeHour = 18

    /** Request notification permission. Returns whether it is granted. */
    static func requestPermission() async -> Bool {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return true
        case .denied:
            return false
        case .notDetermined:
            return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        @unknown default:
            return false
        }
    }

    /** Schedule (replacing any existing) the daily reminder at the given local time. */
    static func scheduleDaily(hour: Int, minute: Int) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [reminderId])

        let content = UNMutableNotificationContent()
        content.title = "Your 2-minute drill is ready"
        content.body = "One quick rep keeps the streak alive. Say it out loud before you need it."
        content.sound = .default

        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(identifier: reminderId, content: content, trigger: trigger)
        try? await center.add(request)
    }

    static func cancel() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [reminderId])
    }

    static func cancelChallengeNudge() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [challengeNudgeId])
    }

    private static let nudgeLines: [(title: String, body: String)] = [
        ("Day {day} is still open", "Two minutes before dinner. Say it here before you say it there."),
        ("Your streak is on the line", "Day {day} takes one rep. The conversation won't rehearse itself."),
        ("Still time for Day {day}", "One rep tonight and the flame stays lit."),
    ]

    /**
     Keep the 6 PM challenge nudge in sync with reality:
     - today's rep not done and it's before 6 PM → nudge today at 6 PM
     - otherwise → nudge tomorrow at 6 PM (for the next open day)
     - challenge finished → no nudge at all
     Never prompts for permission; only schedules when already granted.
     */
    static func syncChallengeNudge(todayDone: Bool, nextDay: Int) async {
        cancelChallengeNudge()
        guard nextDay <= 28 else { return }

        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized
            || settings.authorizationStatus == .provisional
            || settings.authorizationStatus == .ephemeral
        else { return }

        let calendar = Calendar.current
        let now = Date()
        var fireDate = calendar.date(
            bySettingHour: nudgeHour, minute: 0, second: 0, of: now
        ) ?? now
        if todayDone || now >= fireDate {
            fireDate = calendar.date(byAdding: .day, value: 1, to: fireDate) ?? fireDate
        }

        let line = nudgeLines[nextDay % nudgeLines.count]
        let content = UNMutableNotificationContent()
        content.title = line.title.replacingOccurrences(of: "{day}", with: "\(nextDay)")
        content.body = line.body.replacingOccurrences(of: "{day}", with: "\(nextDay)")
        content.sound = .default

        let components = calendar.dateComponents(
            [.year, .month, .day, .hour, .minute],
            from: fireDate
        )
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
        let request = UNNotificationRequest(identifier: challengeNudgeId, content: content, trigger: trigger)
        try? await center.add(request)
    }
}
