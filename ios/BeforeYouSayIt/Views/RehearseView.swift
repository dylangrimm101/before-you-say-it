import SwiftUI

struct RehearseView: View {
    let scenario: Scenario
    let difficulty: Difficulty
    var challengeDay: Int? = nil

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var model: RehearseViewModel?
    @State private var showDebrief: Bool = false
    @State private var confirmLeave: Bool = false

    private var voice: VoiceService { VoiceService.shared }

    var body: some View {
        ZStack {
            Theme.bgDeep.ignoresSafeArea()
            if let model {
                content(model)
            }
        }
        .onAppear {
            if model == nil {
                let m = RehearseViewModel(scenario: scenario, difficulty: difficulty, profile: store.profile)
                model = m
                Task { await m.begin() }
            }
        }
        .onDisappear {
            model?.leave()
        }
        .fullScreenCover(isPresented: $showDebrief) {
            if let session = model?.debriefedSession {
                DebriefView(session: session) {
                    showDebrief = false
                    dismiss()
                }
            }
        }
        .alert("Leave the rehearsal?", isPresented: $confirmLeave) {
            Button("Keep going", role: .cancel) {}
            Button("Leave", role: .destructive) {
                model?.leave()
                dismiss()
            }
        } message: {
            Text("This rep won't be saved.")
        }
    }

    @ViewBuilder
    private func content(_ model: RehearseViewModel) -> some View {
        @Bindable var model = model
        VStack(spacing: 0) {
            header(model)
            tensionBar(model)
            transcript(model)
            if !model.errorMessage.isEmpty {
                Text(model.errorMessage)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.amber)
                    .padding(.horizontal, 22)
                    .padding(.bottom, 6)
            }
            inputArea(model)
        }
    }

    private func header(_ model: RehearseViewModel) -> some View {
        HStack(spacing: 12) {
            Button {
                Haptics.tap()
                confirmLeave = true
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.dim)
                    .frame(width: 36, height: 36)
                    .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(scenario.counterpart)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.text)
                    .lineLimit(1)
                if voice.state != .idle {
                    WaveformView(bars: 7, tone: Theme.ember, subtle: voice.state == .generating)
                        .frame(height: 14)
                } else {
                    EyebrowText(ScenarioLibrary.difficultyLabel(difficulty), color: Theme.dim)
                }
            }
            Spacer()
            Button {
                Haptics.tap()
                model.voiceOn.toggle()
                if !model.voiceOn { VoiceService.shared.stop() }
            } label: {
                Image(systemName: model.voiceOn ? "speaker.wave.2.fill" : "speaker.slash.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(model.voiceOn ? Theme.ember : Theme.dim)
                    .frame(width: 36, height: 36)
                    .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
            }
            Button {
                Haptics.tap()
                Task {
                    if await model.endRehearsal() != nil {
                        if let session = model.debriefedSession {
                            store.upsertSession(session)
                            if let challengeDay {
                                store.markChallengeDayDone(challengeDay)
                            }
                        }
                        showDebrief = true
                    }
                }
            } label: {
                Group {
                    if model.isDebriefing {
                        ProgressView().tint(Theme.onAccent)
                    } else {
                        Text("End")
                            .font(.system(size: 13, weight: .semibold))
                    }
                }
                .foregroundStyle(model.canDebrief ? Theme.onAccent : Theme.dim)
                .padding(.horizontal, 16)
                .padding(.vertical, 9)
                .background(model.canDebrief ? Theme.mint : Theme.surfaceHigh)
                .clipShape(Capsule())
            }
            .disabled(!model.canDebrief || model.isDebriefing)
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .padding(.bottom, 10)
    }

    private func tensionBar(_ model: RehearseViewModel) -> some View {
        let tone: Color = model.tension < 33 ? Theme.mint : model.tension <= 66 ? Theme.amber : Theme.crimson
        return HStack(spacing: 10) {
            EyebrowText("Tension", color: Theme.dim)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.surfaceHigh)
                    Capsule()
                        .fill(tone)
                        .frame(width: geo.size.width * Double(model.tension) / 100)
                        .animation(.easeOut(duration: 0.5), value: model.tension)
                }
            }
            .frame(height: 4)
        }
        .padding(.horizontal, 22)
        .padding(.bottom, 8)
    }

    private func transcript(_ model: RehearseViewModel) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(model.turns) { turn in
                        turnBubble(turn)
                    }
                    if model.isThinking {
                        HStack {
                            ThinkingDots()
                            Spacer()
                        }
                        .padding(.horizontal, 4)
                    }
                    Color.clear.frame(height: 8).id("bottom")
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
            }
            .onChange(of: model.turns.count) { _, _ in
                withAnimation(.easeOut(duration: 0.3)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
        }
    }

    @ViewBuilder
    private func turnBubble(_ turn: Turn) -> some View {
        let isUser = turn.role == .user
        VStack(alignment: isUser ? .trailing : .leading, spacing: 6) {
            Text(styledLine(turn.text))
                .font(.system(size: isUser ? 15.5 : 17.5))
                .foregroundStyle(isUser ? Theme.text : Theme.textSoft)
                .lineSpacing(6)
                .padding(.horizontal, 17)
                .padding(.vertical, 14)
                .background(isUser ? Theme.surfaceHigh : Theme.elevated)
                .clipShape(.rect(cornerRadius: 18))
                .overlay(
                    RoundedRectangle(cornerRadius: 18)
                        .strokeBorder(isUser ? Theme.lineStrong : Theme.line, lineWidth: 1)
                )
                .frame(maxWidth: 320, alignment: isUser ? .trailing : .leading)

            if let nudge = turn.nudge, !nudge.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "lightbulb.fill")
                        .font(.system(size: 10))
                    Text(nudge)
                        .font(.system(size: 12.5))
                        .lineSpacing(3)
                }
                .foregroundStyle(Theme.amber)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Theme.amber.opacity(0.08))
                .clipShape(.rect(cornerRadius: 10))
            }
        }
        .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
    }

    /** Renders "(beats)" in italic dim styling inline. */
    private func styledLine(_ text: String) -> AttributedString {
        var result = AttributedString(text)
        if let range = text.range(of: #"^\([^)]{1,60}\)"#, options: .regularExpression) {
            let beat = String(text[range])
            if let attrRange = result.range(of: beat) {
                result[attrRange].font = .system(size: 13.5).italic()
                result[attrRange].foregroundColor = Theme.dim
            }
        }
        return result
    }

    @ViewBuilder
    private func inputArea(_ model: RehearseViewModel) -> some View {
        @Bindable var model = model
        VStack(spacing: 10) {
            if model.mode == .voice {
                voiceInput(model)
            } else {
                keyboardInput(model)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .padding(.bottom, 12)
        .background(Theme.bgDeep)
    }

    private func voiceInput(_ model: RehearseViewModel) -> some View {
        let status = model.dictation.status
        let speechActive = voice.state != .idle

        return VStack(spacing: 10) {
            Button {
                Haptics.tap(.medium)
                Task { await model.micTap() }
            } label: {
                Group {
                    if status == .recording {
                        Image(systemName: "square.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Theme.text)
                    } else if status == .transcribing {
                        ProgressView().tint(Theme.text)
                    } else if speechActive {
                        WaveformView(bars: 5, tone: Theme.text, subtle: voice.state == .generating)
                    } else {
                        Image(systemName: "mic.fill")
                            .font(.system(size: 24))
                            .foregroundStyle(Theme.text)
                    }
                }
                .frame(width: 76, height: 76)
                .background(status == .recording ? Theme.crimson : Theme.surfaceHigh)
                .clipShape(Circle())
                .overlay(Circle().strokeBorder(status == .recording ? Theme.crimson : Theme.lineStrong, lineWidth: 1.5))
            }
            .buttonStyle(PressableStyle())
            .disabled(model.isThinking || status == .transcribing)

            Text(hintText(model))
                .font(.system(size: 12.5))
                .foregroundStyle(Theme.dim)

            HStack {
                Button {
                    Haptics.tap()
                    model.mode = .keyboard
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "keyboard")
                            .font(.system(size: 13))
                        Text("Type instead")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .foregroundStyle(Theme.dim)
                }
                Spacer()
            }
        }
    }

    private func hintText(_ model: RehearseViewModel) -> String {
        if model.dictation.status == .recording { return "Listening — tap to send" }
        if model.dictation.status == .transcribing { return "Catching your words…" }
        if model.dictation.status == .denied { return model.dictation.errorMessage }
        if voice.state == .generating { return "Finding their voice…" }
        if voice.state == .speaking { return "They're speaking — tap to interrupt" }
        if model.isThinking { return "They're thinking…" }
        return "Tap and say your line out loud"
    }

    @ViewBuilder
    private func keyboardInput(_ model: RehearseViewModel) -> some View {
        @Bindable var model = model
        HStack(spacing: 10) {
            Button {
                Haptics.tap()
                model.mode = .voice
            } label: {
                Image(systemName: "mic.fill")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.dim)
                    .frame(width: 42, height: 42)
                    .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
            }
            TextField("Say your line…", text: $model.draft, axis: .vertical)
                .font(.system(size: 15))
                .foregroundStyle(Theme.text)
                .lineLimit(1 ... 4)
                .padding(.horizontal, 14)
                .padding(.vertical, 11)
                .background(Theme.elevated)
                .clipShape(.rect(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Theme.line, lineWidth: 1))
            Button {
                Haptics.tap()
                let text = model.draft
                Task { await model.send(text) }
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.onAccent)
                    .frame(width: 42, height: 42)
                    .background(model.draft.trimmingCharacters(in: .whitespaces).isEmpty ? Theme.surfaceHigh : Theme.ember)
                    .clipShape(Circle())
            }
            .disabled(model.draft.trimmingCharacters(in: .whitespaces).isEmpty || model.isThinking)
        }
    }
}

/** Three pulsing dots while the counterpart is thinking. */
struct ThinkingDots: View {
    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 20)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            HStack(spacing: 5) {
                ForEach(0 ..< 3, id: \.self) { i in
                    let phase = (sin(t * 5 - Double(i) * 0.7) + 1) / 2
                    Circle()
                        .fill(Theme.dim)
                        .frame(width: 6, height: 6)
                        .opacity(0.3 + phase * 0.7)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Theme.elevated)
        .clipShape(.rect(cornerRadius: 18))
    }
}
