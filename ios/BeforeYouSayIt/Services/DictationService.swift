import AVFoundation
import Foundation
import Observation

enum DictationStatus {
    case idle
    case recording
    case transcribing
    case denied
    case error
}

/**
 Records a short voice clip with AVAudioRecorder, then transcribes it via
 the Rork AI Gateway. Mirrors the Expo useDictation hook.
 */
@Observable
final class DictationService {
    private(set) var status: DictationStatus = .idle
    private(set) var errorMessage: String = ""

    private var recorder: AVAudioRecorder?
    private var fileURL: URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("dictation.m4a")
    }

    func reset() {
        status = .idle
        errorMessage = ""
    }

    /** Ask for mic permission and start recording. */
    func start() async {
        VoiceService.shared.stop()

        let granted = await AVAudioApplication.requestRecordPermission()
        guard granted else {
            status = .denied
            errorMessage = "Microphone access is off. Enable it in Settings to speak your lines."
            return
        }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.defaultToSpeaker])
            try session.setActive(true)

            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 44100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            ]
            let newRecorder = try AVAudioRecorder(url: fileURL, settings: settings)
            newRecorder.record()
            recorder = newRecorder
            status = .recording
            errorMessage = ""
        } catch {
            print("[dictation] start failed: \(error.localizedDescription)")
            status = .error
            errorMessage = "Couldn't start recording. Try again."
        }
    }

    /** Stop recording and return the transcribed text (nil on failure). */
    func stop() async -> String? {
        guard let activeRecorder = recorder else { return nil }
        activeRecorder.stop()
        recorder = nil
        status = .transcribing

        do {
            let data = try Data(contentsOf: fileURL)
            guard data.count > 1000 else {
                status = .idle
                return nil
            }
            let text = try await AIService.transcribeAudio(base64Audio: data.base64EncodedString())
            status = .idle
            return text
        } catch {
            print("[dictation] transcription failed: \(error.localizedDescription)")
            status = .error
            errorMessage = "Couldn't hear that clearly. Try again."
            return nil
        }
    }
}
