import SwiftUI

struct OnboardingView: View {
    @Environment(AppStore.self) private var store

    @State private var step: Int = 0
    @State private var dread: String = ""
    @State private var focus: CategoryId?
    @State private var persona: PersonaVoice?
    @State private var reaction: ReactionPattern?
    @State private var outcome: String = ""
    @State private var dictation = DictationService()

    private let totalSteps = 5

    private var canAdvance: Bool {
        switch step {
        case 0: return dread.trimmingCharacters(in: .whitespacesAndNewlines).count >= 8
        case 1: return focus != nil
        case 2: return persona != nil
        case 3: return reaction != nil
        case 4: return outcome.trimmingCharacters(in: .whitespacesAndNewlines).count >= 3
        default: return true
        }
    }

    var body: some View {
        ZStack {
            Backdrop()
            VStack(alignment: .leading, spacing: 0) {
                progressHeader
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        stepContent
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 12)
                    .padding(.bottom, 30)
                }
                if step == 0 || step == 4 {
                    PrimaryButton(title: step == 4 ? "Build my training" : "Continue", disabled: !canAdvance) {
                        advance()
                    }
                    .padding(.horizontal, 24)
                    .padding(.bottom, 16)
                }
            }
        }
        .animation(.easeInOut(duration: 0.25), value: step)
    }

    private var progressHeader: some View {
        HStack(spacing: 12) {
            if step > 0 {
                Button {
                    Haptics.tap()
                    step -= 1
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.textSoft)
                        .frame(width: 34, height: 34)
                        .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
                }
            }
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.surfaceHigh)
                    Capsule()
                        .fill(Theme.ember)
                        .frame(width: geo.size.width * Double(step + 1) / Double(totalSteps))
                        .animation(.easeOut(duration: 0.35), value: step)
                }
            }
            .frame(height: 4)
        }
        .padding(.horizontal, 24)
        .padding(.top, 14)
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0: dreadStep
        case 1: focusStep
        case 2: personaStep
        case 3: reactionStep
        default: outcomeStep
        }
    }

    // MARK: Step 0 — the dread

    private var dreadStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            stepTitle(
                eyebrow: "Before you say it",
                title: "What's the conversation\nyou keep rehearsing\nin the shower?",
                sub: "Say it plainly. No one else will read this."
            )
            ZStack(alignment: .bottomTrailing) {
                TextField(
                    "e.g. Telling my mum I'm not coming home for the holidays…",
                    text: $dread,
                    axis: .vertical
                )
                .font(.system(size: 15.5))
                .foregroundStyle(Theme.text)
                .lineLimit(4 ... 8)
                .padding(16)
                .padding(.bottom, 36)
                .background(Theme.elevated)
                .clipShape(.rect(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.line, lineWidth: 1))

                dictationButton { spoken in
                    dread = dread.isEmpty ? spoken : "\(dread) \(spoken)"
                }
            }
            if dictation.status == .denied || dictation.status == .error {
                Text(dictation.errorMessage)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Theme.amber)
                    .padding(.top, 10)
            }
        }
    }

    // MARK: Step 1 — focus

    private var focusStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            stepTitle(
                eyebrow: "Step 2 of 5",
                title: "Where does it\nlive in your life?",
                sub: "We'll queue up scenarios that hit close to home."
            )
            VStack(spacing: 10) {
                ForEach(ScenarioLibrary.categories) { c in
                    choiceRow(
                        selected: focus == c.id,
                        accent: c.accent,
                        title: c.label,
                        sub: c.blurb
                    ) {
                        focus = c.id
                        autoAdvance()
                    }
                }
            }
        }
    }

    // MARK: Step 2 — persona voice

    private var personaStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            stepTitle(
                eyebrow: "Step 3 of 5",
                title: "Whose voice should\nthey speak with?",
                sub: "Your rehearsal partner talks out loud. Pick the voice that fits the person you're facing."
            )
            VStack(spacing: 10) {
                choiceRow(
                    selected: persona == .womanHope,
                    accent: Theme.ember,
                    title: "A woman's voice",
                    sub: "Warm, mature, holds her ground"
                ) {
                    persona = .womanHope
                    autoAdvance()
                }
                choiceRow(
                    selected: persona == .manAdam,
                    accent: Theme.ember,
                    title: "A man's voice",
                    sub: "Steady, low, hard to read"
                ) {
                    persona = .manAdam
                    autoAdvance()
                }
            }
        }
    }

    // MARK: Step 3 — reaction

    private var reactionStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            stepTitle(
                eyebrow: "Step 4 of 5",
                title: "When you bring things up,\nwhat do they usually do?",
                sub: "We'll train you against exactly that."
            )
            VStack(spacing: 8) {
                ForEach(ReactionPattern.allCases) { r in
                    choiceRow(
                        selected: reaction == r,
                        accent: Theme.amber,
                        title: ScenarioLibrary.reactionLabel(r),
                        sub: nil
                    ) {
                        reaction = r
                        autoAdvance()
                    }
                }
            }
        }
    }

    // MARK: Step 4 — outcome

    private var outcomeStep: some View {
        VStack(alignment: .leading, spacing: 0) {
            stepTitle(
                eyebrow: "Last step",
                title: "If it goes well,\nwhat changes?",
                sub: "Name the outcome you actually want."
            )
            ZStack(alignment: .bottomTrailing) {
                TextField(
                    "e.g. They call before coming over, and I stop dreading Sundays…",
                    text: $outcome,
                    axis: .vertical
                )
                .font(.system(size: 15.5))
                .foregroundStyle(Theme.text)
                .lineLimit(3 ... 6)
                .padding(16)
                .padding(.bottom, 36)
                .background(Theme.elevated)
                .clipShape(.rect(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.line, lineWidth: 1))

                dictationButton { spoken in
                    outcome = outcome.isEmpty ? spoken : "\(outcome) \(spoken)"
                }
            }
        }
    }

    // MARK: Shared pieces

    private func stepTitle(eyebrow: String, title: String, sub: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            EyebrowText(eyebrow, color: Theme.ember)
            Text(title)
                .font(Theme.display(28))
                .foregroundStyle(Theme.text)
                .lineSpacing(6)
            Text(sub)
                .font(.system(size: 14))
                .foregroundStyle(Theme.textDim)
                .lineSpacing(4)
                .padding(.bottom, 8)
        }
        .padding(.top, 18)
        .padding(.bottom, 18)
    }

    private func choiceRow(
        selected: Bool,
        accent: Color,
        title: String,
        sub: String?,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 12) {
                Circle()
                    .strokeBorder(selected ? accent : Theme.lineStrong, lineWidth: selected ? 5 : 1.5)
                    .frame(width: 18, height: 18)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.text)
                        .multilineTextAlignment(.leading)
                    if let sub {
                        Text(sub)
                            .font(.system(size: 12.5))
                            .foregroundStyle(Theme.dim)
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer()
            }
            .padding(14)
            .background(selected ? Theme.surfaceHigh : Theme.elevated)
            .clipShape(.rect(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(selected ? accent.opacity(0.5) : Theme.line, lineWidth: 1)
            )
        }
        .buttonStyle(PressableStyle())
    }

    private func dictationButton(onText: @escaping (String) -> Void) -> some View {
        Button {
            Haptics.tap()
            Task {
                if dictation.status == .recording {
                    if let text = await dictation.stop() {
                        onText(text)
                    }
                } else if dictation.status != .transcribing {
                    dictation.reset()
                    await dictation.start()
                }
            }
        } label: {
            Group {
                if dictation.status == .recording {
                    Image(systemName: "square.fill").font(.system(size: 12))
                } else if dictation.status == .transcribing {
                    ProgressView().tint(Theme.text).scaleEffect(0.7)
                } else {
                    Image(systemName: "mic.fill").font(.system(size: 13))
                }
            }
            .foregroundStyle(dictation.status == .recording ? Theme.text : Theme.dim)
            .frame(width: 34, height: 34)
            .background(dictation.status == .recording ? Theme.crimson : Theme.surfaceHigh)
            .clipShape(Circle())
        }
        .padding(10)
    }

    private func autoAdvance() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.26) {
            if step < totalSteps - 1 {
                step += 1
            }
        }
    }

    private func advance() {
        if step < totalSteps - 1 {
            step += 1
        } else {
            finish()
        }
    }

    private func finish() {
        guard let focus, let persona, let reaction else { return }
        Haptics.success()
        store.pendingPaywall = true
        store.saveProfile(
            Profile(
                focus: focus,
                pattern: "avoid",
                win: "heard",
                persona: persona,
                reaction: reaction,
                outcome: outcome.trimmingCharacters(in: .whitespacesAndNewlines),
                dread: dread.trimmingCharacters(in: .whitespacesAndNewlines),
                createdAt: Date().timeIntervalSince1970 * 1000
            )
        )
    }
}
