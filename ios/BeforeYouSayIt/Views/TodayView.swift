import SwiftUI

/** Navigation payload for a challenge rehearsal: scenario + day + preset level. */
struct ChallengeScenarioRoute: Hashable {
    let scenario: Scenario
    let challengeDay: Int?
    let level: Difficulty?
}

/** fullScreenCover payload for a challenge drill. */
struct DrillRoute: Identifiable {
    let drill: Drill
    let challengeDay: Int?
    var id: String { drill.id }
}

struct TodayView: View {
    @Environment(AppStore.self) private var store
    @Environment(PurchasesStore.self) private var purchases

    @State private var path: [ChallengeScenarioRoute] = []
    @State private var drillRoute: DrillRoute?
    @State private var showCustom: Bool = false
    @State private var customChallengeDay: Int?
    @State private var showPaywall: Bool = false

    private var doneDays: Set<Int> { store.challengeDoneDays }
    private var currentDay: Int { store.currentChallengeDay }
    private var allDone: Bool { doneDays.count >= ChallengeLibrary.totalDays }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                Backdrop(tint: Theme.ember)
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        header

                        ForEach(ChallengeLibrary.blocks) { block in
                            blockSection(block)
                        }

                        if allDone {
                            doneCard
                        }

                        if !purchases.isPro {
                            proCard
                        }

                        offPlanCard
                    }
                    .padding(.horizontal, 22)
                    .padding(.bottom, 40)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: ChallengeScenarioRoute.self) { route in
                ScenarioBriefView(
                    scenario: route.scenario,
                    challengeDay: route.challengeDay,
                    initialLevel: route.level
                )
            }
        }
        .fullScreenCover(item: $drillRoute) { route in
            DrillView(drill: route.drill, challengeDay: route.challengeDay)
        }
        .sheet(isPresented: $showCustom) {
            CustomScenarioView { built in
                showCustom = false
                path.append(
                    ChallengeScenarioRoute(
                        scenario: built,
                        challengeDay: customChallengeDay,
                        level: customChallengeDay != nil ? .challenging : nil
                    )
                )
                customChallengeDay = nil
            }
        }
        .sheet(isPresented: $showPaywall) {
            PaywallView()
        }
        .onAppear {
            if store.pendingPaywall {
                store.pendingPaywall = false
                if !purchases.isPro { showPaywall = true }
            }
        }
    }

    private func openDay(_ day: ChallengePlanDay) {
        Haptics.tap()
        switch day.kind {
        case .drill:
            let drill = DrillLibrary.drill(day.refId) ?? DrillLibrary.drillOfTheDay()
            drillRoute = DrillRoute(drill: drill, challengeDay: day.day)
        case .rehearsal:
            guard let scenario = store.findScenario(day.refId) else { return }
            path.append(
                ChallengeScenarioRoute(
                    scenario: scenario,
                    challengeDay: day.day,
                    level: day.difficulty
                )
            )
        case .custom:
            customChallengeDay = day.day
            showCustom = true
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    EyebrowText("Your program")
                    Text("28-Day Communication Challenge")
                        .font(Theme.display(26))
                        .foregroundStyle(Theme.text)
                        .lineSpacing(4)
                }
                Spacer()
                VStack(spacing: 2) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 13))
                        .foregroundStyle(doneDays.isEmpty ? Theme.dim : Theme.ember)
                    Text("\(allDone ? 28 : currentDay)")
                        .font(Theme.display(20))
                        .foregroundStyle(doneDays.isEmpty ? Theme.dim : Theme.ember)
                    Text("DAY")
                        .font(.system(size: 9, weight: .semibold))
                        .tracking(1.2)
                        .foregroundStyle(Theme.dim)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(Theme.lineStrong, lineWidth: 1)
                )
            }
            Text("One rep a day. Four weeks from \u{201C}I'll bring it up eventually\u{201D} to saying it like you mean it.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.textDim)
                .lineSpacing(4)
                .padding(.top, 12)

            StreakCounterView(doneCount: doneDays.count)
                .padding(.top, 14)
        }
    }

    // MARK: - Blocks

    private func blockSection(_ block: ChallengePlanBlock) -> some View {
        let blockDone = block.days.filter { doneDays.contains($0.day) }.count
        let pct = Int((Double(blockDone) / Double(block.days.count) * 100).rounded())
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 9) {
                Circle().fill(block.accentInk).frame(width: 7, height: 7)
                Text(block.title.uppercased())
                    .font(.system(size: 12.5, weight: .bold))
                    .tracking(1.1)
                    .foregroundStyle(block.accentInk)
                Spacer()
                Text("\(pct)%")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(pct > 0 ? block.accentInk : Theme.textDim)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 3)
                    .background(pct > 0 ? block.accentInk.opacity(0.08) : .clear)
                    .clipShape(Capsule())
                    .overlay(Capsule().strokeBorder(block.accentInk.opacity(0.2), lineWidth: 1))
            }
            .padding(.top, 30)
            Text(block.blurb)
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.textDim)
                .padding(.top, 5)
                .padding(.bottom, 14)
                .padding(.leading, 16)

            ForEach(block.days) { day in
                dayRow(day, accent: block.accent, accentInk: block.accentInk)
            }
        }
    }

    private func dayRow(_ day: ChallengePlanDay, accent: Color, accentInk: Color) -> some View {
        let done = doneDays.contains(day.day)
        let active = day.day == currentDay
        let locked = !done && !active
        return HStack(alignment: .top, spacing: 12) {
            ZStack {
                Rectangle()
                    .fill(Theme.line)
                    .frame(width: 1)
                Circle()
                    .strokeBorder(done ? Theme.mint : active ? accent : Theme.lineStrong, lineWidth: active ? 2.5 : 1.5)
                    .background(Circle().fill(done ? Theme.mintSoft : Theme.bg))
                    .frame(width: 20, height: 20)
                    .overlay {
                        if done {
                            Image(systemName: "checkmark")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(Theme.mint)
                        }
                    }
                    .offset(y: 0)
            }
            .frame(width: 20)

            Button {
                openDay(day)
            } label: {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 12) {
                        Image(systemName: done ? "checkmark" : locked ? "lock.fill" : day.kind == .drill ? "bolt.fill" : "mic.fill")
                            .font(.system(size: 14, weight: done ? .bold : .regular))
                            .foregroundStyle(done ? Theme.mint : locked ? Theme.textDim : accentInk)
                            .frame(width: 38, height: 38)
                            .background(done ? Theme.mintSoft : active ? accent.opacity(0.12) : locked ? Theme.text.opacity(0.05) : Theme.surfaceHigh)
                            .clipShape(Circle())
                        VStack(alignment: .leading, spacing: 3) {
                            Text("DAY \(day.day)")
                                .font(.system(size: 10, weight: .semibold))
                                .tracking(1.2)
                                .foregroundStyle(active ? accentInk : Theme.textSoft)
                            Text(day.title)
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Theme.text)
                                .multilineTextAlignment(.leading)
                                .lineLimit(2)
                            Text("\(day.minutes) min · \(day.meta)")
                                .font(.system(size: 12))
                                .foregroundStyle(Theme.textDim)
                        }
                        Spacer()
                        if !locked && !active {
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.textDim)
                        }
                    }

                    if active {
                        Text("Start Day \(day.day)")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.onAccent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(accent)
                            .clipShape(.rect(cornerRadius: 14))
                            .padding(.top, 14)
                    }
                }
                .padding(14)
                .background(active ? Theme.surface : locked ? Theme.surface.opacity(0.5) : Theme.elevated)
                .clipShape(.rect(cornerRadius: 16))
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(active ? accent.opacity(0.55) : Theme.line, lineWidth: 1)
                )
            }
            .buttonStyle(PressableStyle())
            .disabled(locked)
            .padding(.bottom, 10)
        }
    }

    // MARK: - Footer cards

    private var doneCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Challenge complete.")
                .font(Theme.display(22))
                .foregroundStyle(Theme.mint)
            Text("28 days of saying the hard thing out loud. Keep the edge — rehearse anything from the Scenarios tab, or build your own.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.textSoft)
                .lineSpacing(5)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.mint.opacity(0.07))
        .clipShape(.rect(cornerRadius: 22))
        .overlay(RoundedRectangle(cornerRadius: 22).strokeBorder(Theme.mint.opacity(0.27), lineWidth: 1))
        .padding(.top, 24)
    }

    private var proCard: some View {
        Button {
            Haptics.tap()
            showPaywall = true
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "crown.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.ember)
                    .frame(width: 40, height: 40)
                    .background(Theme.emberSoft)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 3) {
                    EyebrowText("Go Pro", color: Theme.ember)
                    Text("Unlimited rehearsals — \(purchases.priceString)/mo")
                        .font(.system(size: 15.5, weight: .semibold))
                        .foregroundStyle(Theme.text)
                    Text("Voice roleplay, debriefs & drills, no limits")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.dim)
                }
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.dim)
            }
            .padding(16)
            .background(Theme.ember.opacity(0.07))
            .clipShape(.rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.ember.opacity(0.27), lineWidth: 1))
        }
        .buttonStyle(PressableStyle())
        .padding(.top, 22)
    }

    private var offPlanCard: some View {
        Button {
            Haptics.tap()
            customChallengeDay = nil
            showCustom = true
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "square.and.pencil")
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.text)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Off-plan rehearsal")
                        .font(.system(size: 15.5, weight: .semibold))
                        .foregroundStyle(Theme.text)
                    Text("Something urgent? Describe it and rehearse it right now")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.dim)
                        .multilineTextAlignment(.leading)
                }
                Spacer()
            }
            .padding(18)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(Theme.lineStrong, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
            )
        }
        .buttonStyle(PressableStyle())
        .padding(.top, 14)
    }
}
