import SwiftUI

struct ScenarioBriefView: View {
    let scenario: Scenario
    let challengeDay: Int?

    @Environment(\.dismiss) private var dismiss
    @State private var difficulty: Difficulty
    @State private var showRehearse: Bool = false

    init(scenario: Scenario, challengeDay: Int? = nil, initialLevel: Difficulty? = nil) {
        self.scenario = scenario
        self.challengeDay = challengeDay
        _difficulty = State(initialValue: initialLevel ?? .steady)
    }

    private var accent: Color {
        ScenarioLibrary.category(scenario.category).accent
    }

    var body: some View {
        ZStack {
            Backdrop(tint: accent)
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    EyebrowText(ScenarioLibrary.category(scenario.category).label, color: accent)
                    Text(scenario.title)
                        .font(Theme.display(30))
                        .foregroundStyle(Theme.text)
                        .lineSpacing(5)
                        .padding(.top, 8)
                    Text(scenario.counterpart)
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.textDim)
                        .padding(.top, 10)
                        .padding(.bottom, 26)

                    briefCard("The situation", scenario.situation)
                    briefCard("Who they are", scenario.persona)
                    briefCard("Your goal", scenario.goal, tone: Theme.mint)

                    EyebrowText("How hard should they make it?")
                        .padding(.top, 26)
                        .padding(.bottom, 10)

                    VStack(spacing: 10) {
                        ForEach(Difficulty.allCases) { d in
                            difficultyOption(d)
                        }
                    }

                    PrimaryButton(title: "Step into the room") {
                        showRehearse = true
                    }
                    .padding(.top, 28)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 40)
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.textSoft)
                }
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .fullScreenCover(isPresented: $showRehearse) {
            RehearseView(scenario: scenario, difficulty: difficulty, challengeDay: challengeDay)
        }
    }

    private func briefCard(_ label: String, _ text: String, tone: Color = Theme.dim) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            EyebrowText(label, color: tone)
            Text(text)
                .font(.system(size: 14.5))
                .foregroundStyle(Theme.textSoft)
                .lineSpacing(5)
        }
        .card(padding: 18)
        .padding(.bottom, 10)
    }

    private func difficultyOption(_ d: Difficulty) -> some View {
        let selected = difficulty == d
        return Button {
            Haptics.tap()
            difficulty = d
        } label: {
            HStack(spacing: 12) {
                Circle()
                    .strokeBorder(selected ? Theme.ember : Theme.lineStrong, lineWidth: selected ? 5 : 1.5)
                    .frame(width: 18, height: 18)
                VStack(alignment: .leading, spacing: 2) {
                    Text(ScenarioLibrary.difficultyLabel(d))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.text)
                    Text(ScenarioLibrary.difficultyNote(d))
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.dim)
                }
                Spacer()
            }
            .padding(14)
            .background(selected ? Theme.emberSoft.opacity(0.5) : Theme.elevated)
            .clipShape(.rect(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(selected ? Theme.ember.opacity(0.5) : Theme.line, lineWidth: 1)
            )
        }
        .buttonStyle(PressableStyle())
    }
}
