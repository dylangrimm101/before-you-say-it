import Foundation
import Observation
import UIKit

/** Drives a live rehearsal: turns, tension, voice, and the closing debrief. */
@Observable
final class RehearseViewModel {
    enum InputMode {
        case voice
        case keyboard
    }

    let scenario: Scenario
    let difficulty: Difficulty
    let persona: PersonaVoice
    let reaction: ReactionPattern?
    let outcome: String?

    private(set) var turns: [Turn] = []
    private(set) var tension: Int = 30
    private(set) var isThinking: Bool = false
    private(set) var isDebriefing: Bool = false
    private(set) var debriefedSession: Session?
    var mode: InputMode = .voice
    var voiceOn: Bool = true
    var draft: String = ""
    var errorMessage: String = ""

    let dictation = DictationService()
    private let sessionId = UUID().uuidString
    private let startedAt = Date().timeIntervalSince1970 * 1000

    var userTurnCount: Int {
        turns.filter { $0.role == .user }.count
    }

    var canDebrief: Bool {
        userTurnCount >= 2
    }

    init(scenario: Scenario, difficulty: Difficulty, profile: Profile?) {
        self.scenario = scenario
        self.difficulty = difficulty
        self.persona = profile?.persona ?? .womanHope
        self.reaction = profile?.reaction
        self.outcome = profile?.outcome.isEmpty == false ? profile?.outcome : nil
    }

    func begin() async {
        guard turns.isEmpty else { return }
        let opening = Turn(id: UUID().uuidString, role: .them, text: scenario.openingLine, nudge: nil)
        turns.append(opening)
        if voiceOn {
            await VoiceService.shared.speak(scenario.openingLine, persona: persona)
        }
    }

    func send(_ text: String) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isThinking else { return }
        errorMessage = ""
        VoiceService.shared.stop()

        turns.append(Turn(id: UUID().uuidString, role: .user, text: trimmed, nudge: nil))
        draft = ""
        isThinking = true
        defer { isThinking = false }

        do {
            let turn = try await AIService.nextCounterpartTurn(
                scenario: scenario,
                difficulty: difficulty,
                turns: turns,
                reaction: reaction,
                outcome: outcome
            )
            tension = turn.tension
            turns.append(
                Turn(
                    id: UUID().uuidString,
                    role: .them,
                    text: turn.reply,
                    nudge: turn.nudge.isEmpty ? nil : turn.nudge
                )
            )
            if voiceOn {
                await VoiceService.shared.speak(turn.reply, persona: persona)
            }
        } catch {
            errorMessage = "They lost their train of thought. Try again."
        }
    }

    /** Tap on the mic button: interrupt speech, stop+send, or start recording. */
    func micTap() async {
        switch dictation.status {
        case .recording:
            Haptics.tap(.medium)
            if let text = await dictation.stop() {
                Haptics.success()
                await send(text)
            }
        case .transcribing:
            return
        default:
            VoiceService.shared.stop()
            dictation.reset()
            await dictation.start()
            if dictation.status == .recording {
                Haptics.tap(.medium)
            }
        }
    }

    /** End the rehearsal, generate the debrief and hand back the saved session. */
    func endRehearsal() async -> Session? {
        guard canDebrief, !isDebriefing else { return nil }
        VoiceService.shared.stop()
        isDebriefing = true
        defer { isDebriefing = false }

        do {
            let debrief = try await AIService.generateDebrief(
                scenario: scenario,
                difficulty: difficulty,
                turns: turns,
                reaction: reaction,
                outcome: outcome
            )
            let session = Session(
                id: sessionId,
                scenarioId: scenario.id,
                title: scenario.title,
                counterpart: scenario.counterpart,
                category: scenario.category,
                difficulty: difficulty,
                persona: persona,
                reaction: reaction,
                outcome: outcome,
                turns: turns,
                debrief: debrief,
                startedAt: startedAt,
                endedAt: Date().timeIntervalSince1970 * 1000
            )
            debriefedSession = session
            return session
        } catch {
            errorMessage = "Couldn't score the rehearsal. Try ending it again."
            return nil
        }
    }

    func leave() {
        VoiceService.shared.stop()
    }
}
