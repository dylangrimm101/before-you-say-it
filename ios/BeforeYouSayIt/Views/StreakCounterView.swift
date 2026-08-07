import SwiftUI

/**
 Visual activity streak: animated flame, day count, and the last 7 days as
 check dots. Any rep — drill, rehearsal or challenge day — keeps it alive.
 Pulses when the streak grows (e.g. right after the daily drill).
 */
struct StreakCounterView: View {
    let doneCount: Int

    @Environment(AppStore.self) private var store
    @State private var flameScale: CGFloat = 1
    @State private var lastStreak: Int = 0

    private struct WeekDay: Identifiable {
        let key: String
        let label: String
        let isToday: Bool
        var id: String { key }
    }

    private var week: [WeekDay] {
        let labels = ["S", "M", "T", "W", "T", "F", "S"]
        let calendar = Calendar.current
        return (0 ..< 7).map { i in
            let date = Date().addingTimeInterval(TimeInterval(-(6 - i) * 86400))
            let weekday = calendar.component(.weekday, from: date) - 1
            return WeekDay(
                key: AppStore.dayKey(date),
                label: labels[weekday],
                isToday: i == 6
            )
        }
    }

    private var lit: Bool { store.activityStreak > 0 }

    private var footText: String {
        if store.activityDays.contains(AppStore.dayKey(Date())) {
            return "Today counts. \(doneCount) of 28 days banked."
        }
        if store.activityStreak > 0 {
            return "One rep today keeps it alive."
        }
        return "Do today's rep to light the flame."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: lit ? "flame.fill" : "flame")
                    .font(.system(size: 20))
                    .foregroundStyle(lit ? Theme.ember : Theme.dim)
                    .frame(width: 44, height: 44)
                    .background(lit ? Theme.emberSoft : .clear)
                    .clipShape(Circle())
                    .overlay(
                        Circle().strokeBorder(
                            lit ? Theme.ember.opacity(0.4) : Theme.lineStrong,
                            lineWidth: 1
                        )
                    )
                    .scaleEffect(flameScale)
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(store.activityStreak)")
                        .font(Theme.display(26))
                        .foregroundStyle(lit ? Theme.ember : Theme.dim)
                        .contentTransition(.numericText())
                    Text("DAY STREAK")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1.2)
                        .foregroundStyle(Theme.dim)
                }
                Spacer()
                HStack(spacing: 5) {
                    Image(systemName: "snowflake")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.blue)
                    Text("\(store.freeze.available)")
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(Theme.blue)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(Theme.blue.opacity(0.08))
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(Theme.blue.opacity(0.27), lineWidth: 1))
            }

            HStack {
                ForEach(week) { day in
                    let frozen = store.frozenDays.contains(day.key)
                    let active = !frozen && store.activityDays.contains(day.key)
                    VStack(spacing: 6) {
                        ZStack {
                            Circle()
                                .fill(active ? Theme.ember : frozen ? Theme.blue.opacity(0.12) : .clear)
                            Circle()
                                .strokeBorder(
                                    active ? Theme.ember : frozen ? Theme.blue.opacity(0.4) : day.isToday ? Theme.ember.opacity(0.55) : Theme.lineStrong,
                                    style: StrokeStyle(lineWidth: 1, dash: day.isToday && !active && !frozen ? [3, 3] : [])
                                )
                            if active {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 9, weight: .heavy))
                                    .foregroundStyle(Theme.onAccent)
                            } else if frozen {
                                Image(systemName: "snowflake")
                                    .font(.system(size: 10))
                                    .foregroundStyle(Theme.blue)
                            }
                        }
                        .frame(width: 26, height: 26)
                        Text(day.label)
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(day.isToday ? Theme.textSoft : Theme.dim)
                    }
                    if day.key != week.last?.key {
                        Spacer()
                    }
                }
            }
            .padding(.top, 16)

            if store.canFreeze {
                Button {
                    Haptics.tap()
                    if store.useStreakFreeze() {
                        Haptics.success()
                    }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "snowflake")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.blue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Freeze yesterday")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.blue)
                            Text("Missed a day — spend a freeze and keep your streak alive")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.dim)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer()
                    }
                    .padding(13)
                    .background(Theme.blue.opacity(0.07))
                    .clipShape(.rect(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .strokeBorder(Theme.blue.opacity(0.27), lineWidth: 1)
                    )
                }
                .buttonStyle(PressableStyle())
                .padding(.top, 14)
            }

            Text(footText)
                .font(.system(size: 12))
                .foregroundStyle(Theme.dim)
                .padding(.top, 14)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.ember.opacity(0.05))
        .clipShape(.rect(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Theme.ember.opacity(0.2), lineWidth: 1)
        )
        .onAppear {
            lastStreak = store.activityStreak
        }
        .onChange(of: store.activityStreak) { _, newValue in
            if newValue > lastStreak {
                withAnimation(.spring(response: 0.28, dampingFraction: 0.5)) {
                    flameScale = 1.25
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        flameScale = 1
                    }
                }
            }
            lastStreak = newValue
        }
    }
}
