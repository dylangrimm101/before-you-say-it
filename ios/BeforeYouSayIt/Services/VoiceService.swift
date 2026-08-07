import AVFoundation
import Foundation
import Observation

enum SpeechState {
    case idle
    case generating
    case speaking
}

/**
 ElevenLabs text-to-speech for the rehearsal counterpart, played through
 AVAudioPlayer. Mirrors the Expo app's voice.ts behaviour: physical beats
 like "(sighs)" are stripped, and only one line plays at a time.
 */
@Observable
final class VoiceService {
    static let shared = VoiceService()

    private(set) var state: SpeechState = .idle

    private var player: AVAudioPlayer?
    private var playerDelegate: PlayerDelegate?

    /** ElevenLabs voice IDs for the two rehearsal personas. */
    private static let voiceIds: [PersonaVoice: String] = [
        .womanHope: "EXAVITQu4vr4xnSDxMaL",
        .manAdam: "cjVigY5qzO86Huf0OWal",
    ]

    /** Low-latency model suited to live conversation. */
    private static let ttsModel = "eleven_turbo_v2_5"

    private init() {}

    /** Stop any counterpart speech that is currently playing. */
    func stop() {
        player?.stop()
        player = nil
        playerDelegate = nil
        state = .idle
    }

    /**
     Speak a counterpart line out loud with the persona's ElevenLabs voice.
     Returns once playback has started.
     */
    func speak(_ text: String, persona: PersonaVoice) async {
        let clean = text
            .replacingOccurrences(of: #"\([^)]{1,60}\)"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }

        stop()
        state = .generating

        do {
            let voiceId = Self.voiceIds[persona] ?? Self.voiceIds[.womanHope]!
            let base = Config.EXPO_PUBLIC_TOOLKIT_URL
            let key = Config.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY
            guard let url = URL(string: "\(base)/v2/elevenlabs/v1/text-to-speech/\(voiceId)?output_format=mp3_44100_128") else {
                state = .idle
                return
            }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
            request.httpBody = try JSONSerialization.data(withJSONObject: [
                "text": clean,
                "model_id": Self.ttsModel,
            ])

            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200 ..< 300).contains(http.statusCode) else {
                state = .idle
                return
            }

            let session = AVAudioSession.sharedInstance()
            try? session.setCategory(.playback, mode: .spokenAudio, options: [])
            try? session.setActive(true)

            let newPlayer = try AVAudioPlayer(data: data)
            let delegate = PlayerDelegate { [weak self] finished in
                Task { @MainActor in
                    guard let self, self.player === finished else { return }
                    self.player = nil
                    self.playerDelegate = nil
                    self.state = .idle
                }
            }
            newPlayer.delegate = delegate
            player = newPlayer
            playerDelegate = delegate
            newPlayer.play()
            state = .speaking
        } catch {
            print("[voice] speak failed: \(error.localizedDescription)")
            state = .idle
        }
    }
}

/** Bounces AVAudioPlayer completion back to the main actor. */
private final class PlayerDelegate: NSObject, AVAudioPlayerDelegate {
    private let onFinish: @Sendable (AVAudioPlayer) -> Void

    init(onFinish: @escaping @Sendable (AVAudioPlayer) -> Void) {
        self.onFinish = onFinish
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        onFinish(player)
    }
}
