import SwiftUI

struct CustomScenarioView: View {
    var onBuilt: (Scenario) -> Void

    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var text: String = ""
    @State private var category: CategoryId = .partner
    @State private var isBuilding: Bool = false
    @State private var errorMessage: String = ""
    @State private var dictation = DictationService()

    var body: some View {
        ZStack {
            Backdrop(tint: Theme.ember)
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        VStack(alignment: .leading, spacing: 8) {
                            EyebrowText("Your scenario")
                            Text("What do you need to say?")
                                .font(Theme.display(26))
                                .foregroundStyle(Theme.text)
                        }
                        Spacer()
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.dim)
                                .frame(width: 34, height: 34)
                                .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
                        }
                    }
                    .padding(.bottom, 20)

                    Text("Describe it in plain words — who it is, what's been happening, what you're afraid of. We'll cast the other person.")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.textDim)
                        .lineSpacing(5)
                        .padding(.bottom, 16)

                    ZStack(alignment: .bottomTrailing) {
                        TextField(
                            "e.g. I need to tell my sister I can't lend her money again…",
                            text: $text,
                            axis: .vertical
                        )
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.text)
                        .lineLimit(5 ... 10)
                        .padding(16)
                        .padding(.bottom, 34)
                        .background(Theme.elevated)
                        .clipShape(.rect(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.line, lineWidth: 1))

                        Button {
                            Haptics.tap()
                            Task {
                                if dictation.status == .recording {
                                    if let spoken = await dictation.stop() {
                                        text = text.isEmpty ? spoken : "\(text) \(spoken)"
                                    }
                                } else {
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

                    EyebrowText("Which part of life?")
                        .padding(.top, 22)
                        .padding(.bottom, 10)

                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        ForEach(ScenarioLibrary.categories) { c in
                            categoryChip(c)
                        }
                    }

                    if !errorMessage.isEmpty {
                        Text(errorMessage)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.amber)
                            .padding(.top, 14)
                    }

                    Button {
                        Haptics.tap()
                        build()
                    } label: {
                        Group {
                            if isBuilding {
                                HStack(spacing: 10) {
                                    ProgressView().tint(Theme.onAccent)
                                    Text("Casting the other person…")
                                        .font(.system(size: 16, weight: .semibold))
                                }
                            } else {
                                Text("Build my rehearsal")
                                    .font(.system(size: 16, weight: .semibold))
                            }
                        }
                        .foregroundStyle(Theme.onAccent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(canBuild ? Theme.ember : Theme.ember.opacity(0.4))
                        .clipShape(.rect(cornerRadius: 16))
                    }
                    .disabled(!canBuild || isBuilding)
                    .padding(.top, 26)
                }
                .padding(.horizontal, 22)
                .padding(.top, 24)
                .padding(.bottom, 40)
            }
        }
        .onAppear {
            if text.isEmpty, let dread = store.profile?.dread {
                text = dread
            }
            if let focus = store.profile?.focus {
                category = focus
            }
        }
    }

    private var canBuild: Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).count >= 8
    }

    private func categoryChip(_ c: Category) -> some View {
        let selected = category == c.id
        return Button {
            Haptics.tap()
            category = c.id
        } label: {
            HStack(spacing: 8) {
                Circle().fill(c.accent).frame(width: 7, height: 7)
                Text(c.label)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(selected ? Theme.text : Theme.textDim)
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
            .background(selected ? Theme.surfaceHigh : Theme.elevated)
            .clipShape(.rect(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(selected ? Theme.lineStrong : Theme.line, lineWidth: 1)
            )
        }
        .buttonStyle(PressableStyle())
    }

    private func build() {
        guard canBuild, !isBuilding else { return }
        isBuilding = true
        errorMessage = ""
        let description = text
        Task {
            do {
                let scenario = try await AIService.buildCustomScenario(
                    description: description,
                    category: category,
                    reaction: store.profile?.reaction,
                    outcome: store.profile?.outcome
                )
                store.addCustomScenario(scenario)
                Haptics.success()
                onBuilt(scenario)
            } catch {
                errorMessage = "Couldn't build that scenario. Add a little more detail and try again."
            }
            isBuilding = false
        }
    }
}
