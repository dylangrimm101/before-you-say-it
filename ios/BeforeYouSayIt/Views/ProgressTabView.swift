import SwiftUI

struct ProgressTabView: View {
    @Environment(AppStore.self) private var store

    @State private var confirmReset: Bool = false
    @State private var selectedSession: Session?

    var body: some View {
        NavigationStack {
            ZStack {
                Backdrop(tint: Theme.blue)
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        EyebrowText("Your training")
                        Text(titleText)
                            .font(Theme.display(28))
                            .foregroundStyle(Theme.text)
                            .lineSpacing(5)
                            .padding(.top, 8)
                            .padding(.bottom, 24)

                        if let averages = store.averages {
                            averagesCard(averages)
                        } else {
                            emptyCard
                        }

                        ReminderCard()
                            .padding(.top, 12)

                        streakRow
                            .padding(.top, 12)

                        if !store.completed.isEmpty {
                            EyebrowText("History")
                                .padding(.top, 30)
                                .padding(.bottom, 8)
                            ForEach(store.completed) { session in
                                historyRow(session)
                            }
                        }

                        Button {
                            Haptics.tap()
                            confirmReset = true
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "arrow.counterclockwise")
                                    .font(.system(size: 13))
                                Text("Clear training data")
                                    .font(.system(size: 13.5))
                            }
                            .foregroundStyle(Theme.dim)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                        }
                        .padding(.top, 34)
                    }
                    .padding(.horizontal, 22)
                    .padding(.bottom, 40)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(item: $selectedSession) { session in
                DebriefView(session: session)
            }
        }
        .alert("Clear all training data?", isPresented: $confirmReset) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) { store.reset() }
        } message: {
            Text("Your reps, debriefs and custom scenarios will be deleted.")
        }
    }

    private var titleText: String {
        let n = store.completed.count
        if n == 0 { return "No reps logged yet." }
        return "\(n) rehearsal\(n == 1 ? "" : "s") in the bank."
    }

    private func averagesCard(_ averages: Scores) -> some View {
        let axes: [(String, Int, Color)] = [
            ("Clarity", averages.clarity, Theme.mint),
            ("Empathy", averages.empathy, Theme.blue),
            ("Assertiveness", averages.assertiveness, Theme.ember),
            ("Composure", averages.composure, Theme.amber),
        ]
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                EyebrowText("Average across all reps")
                Spacer()
                if let trend = store.trend {
                    trendPill(trend)
                }
            }
            if let trend = store.trend {
                Text(trendNote(trend))
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.dim)
                    .lineSpacing(3)
                    .padding(.top, 10)
            }
            VStack(spacing: 16) {
                ForEach(axes, id: \.0) { axis in
                    VStack(spacing: 8) {
                        HStack {
                            Text(axis.0)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.textSoft)
                            Spacer()
                            Text("\(axis.1)")
                                .font(Theme.display(16))
                                .foregroundStyle(axis.2)
                        }
                        MeterView(value: axis.1, tone: axis.2)
                    }
                }
            }
            .padding(.top, 18)
        }
        .card()
    }

    private func trendPill(_ trend: Int) -> some View {
        let tone: Color = trend > 0 ? Theme.mint : trend < 0 ? Theme.crimson : Theme.dim
        let icon = trend > 0 ? "arrow.up.right" : trend < 0 ? "arrow.down.right" : "minus"
        let label = trend > 0 ? "+\(trend)" : trend < 0 ? "\(trend)" : "even"
        return HStack(spacing: 5) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
            Text(label)
                .font(.system(size: 12, weight: .semibold))
        }
        .foregroundStyle(tone)
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(tone.opacity(trend == 0 ? 0 : 0.1))
        .clipShape(Capsule())
        .overlay(Capsule().strokeBorder(tone.opacity(0.35), lineWidth: 1))
    }

    private func trendNote(_ trend: Int) -> String {
        if trend > 0 { return "Your recent reps score higher than the ones before." }
        if trend < 0 { return "Recent reps dipped a little — one focused rep turns it around." }
        return "Holding steady across your recent reps."
    }

    private var emptyCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your scores appear here")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.text)
            Text("Finish a rehearsal and you'll get scored on clarity, empathy, assertiveness and composure — then watch them climb.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.dim)
                .lineSpacing(5)
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(
            RoundedRectangle(cornerRadius: 22)
                .strokeBorder(Theme.lineStrong, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
        )
    }

    private var streakRow: some View {
        let linesSpoken = store.completed.reduce(0) { total, s in
            total + s.turns.filter { $0.role == .user }.count
        }
        return HStack(spacing: 10) {
            streakBox(value: "\(store.streak)", label: "Day streak")
            streakBox(value: "\(linesSpoken)", label: "Lines spoken")
        }
    }

    private func streakBox(value: String, label: String) -> some View {
        VStack(spacing: 6) {
            Text(value)
                .font(Theme.display(26))
                .foregroundStyle(Theme.text)
            EyebrowText(label)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .background(Theme.elevated)
        .clipShape(.rect(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.line, lineWidth: 1))
    }

    private func historyRow(_ session: Session) -> some View {
        let overall = session.debrief?.scores.overall ?? 0
        let tone = scoreTone(overall)
        return Button {
            Haptics.tap()
            selectedSession = session
        } label: {
            HStack(spacing: 14) {
                Text("\(overall)")
                    .font(Theme.display(15))
                    .foregroundStyle(tone)
                    .frame(width: 42, height: 42)
                    .overlay(Circle().strokeBorder(tone, lineWidth: 1.5))
                VStack(alignment: .leading, spacing: 3) {
                    Text(session.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.text)
                        .lineLimit(1)
                    Text("\(ScenarioLibrary.difficultyLabel(session.difficulty)) · \(dateString(session))")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.dim)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.dim)
            }
            .padding(.vertical, 14)
            .overlay(alignment: .bottom) {
                Rectangle().fill(Theme.line).frame(height: 0.5)
            }
        }
        .buttonStyle(PressableStyle())
    }

    private func dateString(_ session: Session) -> String {
        let ts = (session.endedAt ?? session.startedAt) / 1000
        return Date(timeIntervalSince1970: ts).formatted(date: .numeric, time: .omitted)
    }
}

/** Daily drill reminder card with time picker. */
struct ReminderCard: View {
    @Environment(AppStore.self) private var store

    @State private var showDeniedAlert: Bool = false

    private var enabled: Bool { store.reminder?.enabled ?? false }

    private var pickerDate: Binding<Date> {
        Binding(
            get: {
                var components = DateComponents()
                components.hour = store.reminder?.hour ?? 18
                components.minute = store.reminder?.minute ?? 30
                return Calendar.current.date(from: components) ?? Date()
            },
            set: { newDate in
                let hour = Calendar.current.component(.hour, from: newDate)
                let minute = Calendar.current.component(.minute, from: newDate)
                Task {
                    let ok = await store.setReminder(ReminderSetting(enabled: true, hour: hour, minute: minute))
                    if !ok { showDeniedAlert = true }
                }
            }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "bell.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.amber)
                Text("Daily reminder")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.text)
                Spacer()
                Toggle("", isOn: Binding(
                    get: { enabled },
                    set: { next in
                        Haptics.tap()
                        Task {
                            let ok = await store.setReminder(
                                ReminderSetting(
                                    enabled: next,
                                    hour: store.reminder?.hour ?? 18,
                                    minute: store.reminder?.minute ?? 30
                                )
                            )
                            if !ok { showDeniedAlert = true }
                        }
                    }
                ))
                .labelsHidden()
                .tint(Theme.amber)
            }
            Text(enabled
                ? "A nudge to knock out your two-minute drill."
                : "Get a nudge at your time of choice so the streak never slips.")
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.dim)
                .lineSpacing(4)

            if enabled {
                HStack {
                    EyebrowText("Remind me at")
                    Spacer()
                    DatePicker("", selection: pickerDate, displayedComponents: .hourAndMinute)
                        .labelsHidden()
                        .colorScheme(.dark)
                }
                .padding(.top, 10)
                .overlay(alignment: .top) {
                    Rectangle().fill(Theme.amber.opacity(0.2)).frame(height: 0.5)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.amber.opacity(0.06))
        .clipShape(.rect(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.amber.opacity(0.2), lineWidth: 1))
        .alert("Notifications are off", isPresented: $showDeniedAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Turn on notifications for Before You Say It in Settings to get your daily nudge.")
        }
    }
}
