import SwiftUI

struct DebriefView: View {
    let session: Session
    var onDone: (() -> Void)?

    @Environment(\.dismiss) private var dismiss

    private var debrief: Debrief? { session.debrief }

    var body: some View {
        ZStack {
            Backdrop(tint: Theme.mint)
            ScrollView {
                if let debrief {
                    VStack(alignment: .leading, spacing: 0) {
                        EyebrowText("The debrief")
                        Text(debrief.headline)
                            .font(Theme.display(26))
                            .foregroundStyle(Theme.text)
                            .lineSpacing(5)
                            .padding(.top, 8)
                            .padding(.bottom, 26)

                        overallSection(debrief)
                        scoresCard(debrief)

                        if !debrief.wins.isEmpty {
                            sectionLabel("What worked", tone: Theme.mint)
                            ForEach(debrief.wins, id: \.self) { win in
                                winRow(win)
                            }
                        }

                        if !debrief.flags.isEmpty {
                            sectionLabel("Worth another look", tone: Theme.amber)
                            ForEach(debrief.flags, id: \.self) { flag in
                                flagCard(flag)
                            }
                        }

                        if !debrief.script.isEmpty {
                            sectionLabel("Your script for the real thing", tone: Theme.ember)
                            scriptCard(debrief.script)
                        }

                        if !debrief.nextRep.isEmpty {
                            HStack(spacing: 10) {
                                Image(systemName: "arrow.uturn.forward")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Theme.dim)
                                Text(debrief.nextRep)
                                    .font(.system(size: 13.5))
                                    .foregroundStyle(Theme.textDim)
                                    .lineSpacing(4)
                            }
                            .padding(.top, 22)
                        }

                        PrimaryButton(title: "Done") {
                            finish()
                        }
                        .padding(.top, 28)
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 20)
                    .padding(.bottom, 40)
                }
            }
        }
        .navigationBarBackButtonHidden(true)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button {
                    finish()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.textSoft)
                }
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
    }

    private func finish() {
        if let onDone {
            onDone()
        } else {
            dismiss()
        }
    }

    private func overallSection(_ debrief: Debrief) -> some View {
        let overall = debrief.scores.overall
        let verdict = verdictLabel(overall)
        return HStack {
            Spacer()
            VStack(spacing: 14) {
                ScoreRingView(score: overall, tone: verdict.tone)
                Text(verdict.text.uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(verdict.tone)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(verdict.tone.opacity(0.1))
                    .clipShape(Capsule())
                    .overlay(Capsule().strokeBorder(verdict.tone.opacity(0.35), lineWidth: 1))
            }
            Spacer()
        }
        .padding(.bottom, 24)
    }

    private func scoresCard(_ debrief: Debrief) -> some View {
        let axes: [(String, Int, Color)] = [
            ("Clarity", debrief.scores.clarity, Theme.mint),
            ("Empathy", debrief.scores.empathy, Theme.blue),
            ("Assertiveness", debrief.scores.assertiveness, Theme.ember),
            ("Composure", debrief.scores.composure, Theme.amber),
        ]
        return VStack(spacing: 16) {
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
        .card()
        .padding(.bottom, 6)
    }

    private func sectionLabel(_ text: String, tone: Color) -> some View {
        EyebrowText(text, color: tone)
            .padding(.top, 26)
            .padding(.bottom, 10)
    }

    private func winRow(_ win: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "checkmark")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.mint)
                .padding(.top, 3)
            Text(win)
                .font(.system(size: 14.5))
                .foregroundStyle(Theme.textSoft)
                .lineSpacing(5)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 10)
    }

    private func flagCard(_ flag: Flag) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("\u{201C}\(flag.quote)\u{201D}")
                .font(Theme.display(15))
                .italic()
                .foregroundStyle(Theme.text)
                .lineSpacing(4)
            Text(flag.issue)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.textDim)
                .lineSpacing(4)
            HStack(alignment: .top, spacing: 8) {
                Image(systemName: "arrow.turn.down.right")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.mint)
                    .padding(.top, 3)
                Text(flag.reframe)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.mint)
                    .lineSpacing(4)
            }
        }
        .card(padding: 16)
        .padding(.bottom, 10)
    }

    private func scriptCard(_ script: [String]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array(script.enumerated()), id: \.offset) { index, line in
                HStack(alignment: .top, spacing: 12) {
                    Text("\(index + 1)")
                        .font(Theme.display(14))
                        .foregroundStyle(Theme.ember)
                        .frame(width: 22, height: 22)
                        .background(Theme.emberSoft)
                        .clipShape(Circle())
                    Text(line)
                        .font(.system(size: 14.5))
                        .foregroundStyle(Theme.textSoft)
                        .lineSpacing(5)
                }
            }
        }
        .card(padding: 18)
    }
}
