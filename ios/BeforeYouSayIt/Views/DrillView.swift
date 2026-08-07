import SwiftUI

struct DrillView: View {
    let drill: Drill
    var challengeDay: Int? = nil

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var roundIndex: Int = 0
    @State private var reply: String = ""
    @State private var feedback: DrillRoundFeedback?
    @State private var scores: [Int] = []
    @State private var isScoring: Bool = false
    @State private var finished: Bool = false
    @State private var errorMessage: String = ""
    @State private var dictation = DictationService()

    private var round: DrillRound { drill.rounds[roundIndex] }
    private var averageScore: Int {
        guard !scores.isEmpty else { return 0 }
        return Int((Double(scores.reduce(0, +)) / Double(scores.count)).rounded())
    }

    var body: some View {
        ZStack {
            Backdrop(tint: Theme.amber)
            VStack(alignment: .leading, spacing: 0) {
                header
                if finished {
                    summary
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 0) {
                            roundContent
                        }
                        .padding(.horizontal, 22)
                        .padding(.bottom, 30)
                    }
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Button {
                Haptics.tap()
                VoiceService.shared.stop()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.dim)
                    .frame(width: 36, height: 36)
                    .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
            }
            VStack(alignment: .leading, spacing: 2) {
                EyebrowText("Daily drill · \(drill.skill)", color: Theme.amber)
                Text(drill.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
            }
            Spacer()
            if !finished {
                Text("\(roundIndex + 1)/\(drill.rounds.count)")
                    .font(Theme.display(15))
                    .foregroundStyle(Theme.dim)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .padding(.bottom, 14)
    }

    @ViewBuilder
    private var roundContent: some View {
        if roundIndex == 0 && feedback == nil && scores.isEmpty {
            Text(drill.setup)
                .font(.system(size: 14))
                .foregroundStyle(Theme.textDim)
                .lineSpacing(5)
                .padding(.bottom, 18)
        }

        VStack(alignment: .leading, spacing: 8) {
            EyebrowText("They say")
            Text(round.line)
                .font(Theme.display(19))
                .foregroundStyle(Theme.text)
                .lineSpacing(5)
        }
        .card(padding: 18)

        HStack(spacing: 8) {
            Image(systemName: "scope")
                .font(.system(size: 12))
                .foregroundStyle(Theme.amber)
            Text(round.focus)
                .font(.system(size: 13))
                .foregroundStyle(Theme.amber)
                .lineSpacing(3)
        }
        .padding(.top, 12)
        .padding(.bottom, 18)

        if let feedback {
            feedbackCard(feedback)
        } else {
            replyInput
        }

        if !errorMessage.isEmpty {
            Text(errorMessage)
                .font(.system(size: 13))
                .foregroundStyle(Theme.amber)
                .padding(.top, 10)
        }
    }

    private var replyInput: some View {
        VStack(alignment: .leading, spacing: 12) {
            TextField("Your reply…", text: $reply, axis: .vertical)
                .font(.system(size: 15))
                .foregroundStyle(Theme.text)
                .lineLimit(3 ... 6)
                .padding(14)
                .background(Theme.elevated)
                .clipShape(.rect(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.line, lineWidth: 1))

            HStack(spacing: 10) {
                Button {
                    Haptics.tap()
                    Task {
                        if dictation.status == .recording {
                            if let text = await dictation.stop() {
                                reply = text
                            }
                        } else {
                            dictation.reset()
                            await dictation.start()
                        }
                    }
                } label: {
                    Group {
                        if dictation.status == .recording {
                            Image(systemName: "square.fill").font(.system(size: 15))
                        } else if dictation.status == .transcribing {
                            ProgressView().tint(Theme.text)
                        } else {
                            Image(systemName: "mic.fill").font(.system(size: 15))
                        }
                    }
                    .foregroundStyle(dictation.status == .recording ? Theme.text : Theme.dim)
                    .frame(width: 46, height: 46)
                    .background(dictation.status == .recording ? Theme.crimson : Theme.elevated)
                    .clipShape(Circle())
                    .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
                }

                Button {
                    Haptics.tap()
                    submit()
                } label: {
                    Group {
                        if isScoring {
                            ProgressView().tint(Theme.onAccent)
                        } else {
                            Text("Send it")
                                .font(.system(size: 15, weight: .semibold))
                        }
                    }
                    .foregroundStyle(Theme.onAccent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(reply.trimmingCharacters(in: .whitespaces).isEmpty ? Theme.amber.opacity(0.4) : Theme.amber)
                    .clipShape(.rect(cornerRadius: 14))
                }
                .disabled(reply.trimmingCharacters(in: .whitespaces).isEmpty || isScoring)
            }
        }
    }

    private func submit() {
        guard !isScoring else { return }
        isScoring = true
        errorMessage = ""
        let text = reply
        Task {
            do {
                let result = try await AIService.drillRoundFeedback(
                    skill: drill.skill,
                    focus: round.focus,
                    theirLine: round.line,
                    reply: text
                )
                feedback = result
                scores.append(result.score)
                Haptics.success()
            } catch {
                errorMessage = "Couldn't score that one. Try again."
            }
            isScoring = false
        }
    }

    private func feedbackCard(_ feedback: DrillRoundFeedback) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("\(feedback.score)")
                    .font(Theme.display(34))
                    .foregroundStyle(scoreTone(feedback.score))
                Spacer()
                EyebrowText("Round \(roundIndex + 1)")
            }
            Text(feedback.feedback)
                .font(.system(size: 14.5))
                .foregroundStyle(Theme.textSoft)
                .lineSpacing(5)
            if !feedback.better.isEmpty {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "arrow.turn.down.right")
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.mint)
                        .padding(.top, 3)
                    Text(feedback.better)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.mint)
                        .lineSpacing(4)
                }
            }
            PrimaryButton(title: roundIndex + 1 < drill.rounds.count ? "Next round" : "Finish drill") {
                advance()
            }
        }
        .card(padding: 18)
    }

    private func advance() {
        if roundIndex + 1 < drill.rounds.count {
            roundIndex += 1
            reply = ""
            feedback = nil
        } else {
            store.logDrill(
                DrillResult(
                    drillId: drill.id,
                    date: AppStore.dayKey(Date()),
                    score: averageScore,
                    completedAt: Date().timeIntervalSince1970 * 1000
                )
            )
            if let challengeDay {
                store.markChallengeDayDone(challengeDay)
            }
            Haptics.success()
            withAnimation(.easeOut(duration: 0.3)) {
                finished = true
            }
        }
    }

    private var summary: some View {
        VStack(spacing: 20) {
            Spacer()
            ScoreRingView(score: averageScore, tone: scoreTone(averageScore))
            Text("Drill complete")
                .font(Theme.display(26))
                .foregroundStyle(Theme.text)
            Text("That's your rep for today. Come back tomorrow — the streak is watching.")
                .font(.system(size: 14))
                .foregroundStyle(Theme.textDim)
                .multilineTextAlignment(.center)
                .lineSpacing(5)
                .padding(.horizontal, 40)
            Spacer()
            PrimaryButton(title: "Done") {
                dismiss()
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 20)
        }
    }
}
