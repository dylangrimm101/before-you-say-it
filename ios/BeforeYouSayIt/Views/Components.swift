import SwiftUI
import UIKit

// MARK: - Haptics

enum Haptics {
    static func tap(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .light) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}

// MARK: - Backdrop

/** Soft radial glow over the dark training-room background. */
struct Backdrop: View {
    var tint: Color = Theme.ember

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            Ellipse()
                .fill(tint.opacity(0.09))
                .frame(width: 500, height: 380)
                .blur(radius: 90)
                .offset(x: 60, y: -280)
                .ignoresSafeArea()
        }
    }
}

// MARK: - Eyebrow

/** Small uppercase tracking label. */
struct EyebrowText: View {
    let text: String
    var color: Color = Theme.dim

    init(_ text: String, color: Color = Theme.dim) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(1.6)
            .foregroundStyle(color)
    }
}

// MARK: - Card style

struct CardStyle: ViewModifier {
    var padding: CGFloat = 20

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.elevated)
            .clipShape(.rect(cornerRadius: 22))
            .overlay(
                RoundedRectangle(cornerRadius: 22)
                    .strokeBorder(Theme.line, lineWidth: 1)
            )
    }
}

extension View {
    func card(padding: CGFloat = 20) -> some View {
        modifier(CardStyle(padding: padding))
    }
}

// MARK: - Buttons

struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.85 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

struct PrimaryButton: View {
    let title: String
    var disabled: Bool = false
    let action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.onAccent)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(disabled ? Theme.ember.opacity(0.4) : Theme.ember)
                .clipShape(.rect(cornerRadius: 16))
        }
        .buttonStyle(PressableStyle())
        .disabled(disabled)
    }
}

struct GhostButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Theme.textSoft)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 15)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(Theme.lineStrong, lineWidth: 1)
                )
        }
        .buttonStyle(PressableStyle())
    }
}

// MARK: - Meter

/** Animated horizontal score bar. */
struct MeterView: View {
    let value: Int
    var tone: Color = Theme.mint
    @State private var shown: Double = 0

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.surfaceHigh)
                Capsule()
                    .fill(tone)
                    .frame(width: geo.size.width * shown)
            }
        }
        .frame(height: 6)
        .onAppear {
            withAnimation(.easeOut(duration: 0.9).delay(0.15)) {
                shown = Double(value) / 100
            }
        }
    }
}

// MARK: - Score ring

/** Circular animated score ring with count-up number. */
struct ScoreRingView: View {
    let score: Int
    var tone: Color = Theme.mint
    var size: CGFloat = 128

    @State private var progress: Double = 0
    @State private var shownScore: Int = 0

    var body: some View {
        ZStack {
            Circle()
                .stroke(Theme.surfaceHigh, lineWidth: 9)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(tone, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 2) {
                Text("\(shownScore)")
                    .font(Theme.display(38))
                    .foregroundStyle(Theme.text)
                    .contentTransition(.numericText())
                Text("OVERALL")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(1.4)
                    .foregroundStyle(Theme.dim)
            }
        }
        .frame(width: size, height: size)
        .onAppear {
            withAnimation(.easeOut(duration: 1.1)) {
                progress = Double(score) / 100
            }
            animateCount()
        }
    }

    private func animateCount() {
        let steps = 22
        for i in 1 ... steps {
            let target = Int(Double(score) * Double(i) / Double(steps))
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.1 * Double(i) / Double(steps)) {
                withAnimation(.linear(duration: 0.05)) {
                    shownScore = target
                }
                if i == steps { Haptics.success() }
            }
        }
    }
}

// MARK: - Waveform

/** Animated speaking/generating waveform bars. */
struct WaveformView: View {
    var bars: Int = 5
    var tone: Color = Theme.ember
    /** Low quiet pulse (generating) vs lively bars (speaking). */
    var subtle: Bool = false

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
            HStack(spacing: 3) {
                ForEach(0 ..< bars, id: \.self) { i in
                    let phase = Double(i) * 0.9
                    let wave = (sin(t * (subtle ? 3.2 : 7.5) + phase) + 1) / 2
                    let height: CGFloat = subtle ? 4 + wave * 5 : 5 + wave * 15
                    Capsule()
                        .fill(tone)
                        .frame(width: 3, height: height)
                }
            }
        }
        .frame(height: 22)
    }
}

// MARK: - Verdict

func verdictLabel(_ overall: Int) -> (text: String, tone: Color) {
    if overall >= 80 { return ("Ready", Theme.mint) }
    if overall >= 65 { return ("Almost there", Theme.mint) }
    if overall >= 45 { return ("Building", Theme.amber) }
    return ("Keep repping", Theme.ember)
}

func scoreTone(_ value: Int) -> Color {
    if value >= 70 { return Theme.mint }
    if value >= 50 { return Theme.amber }
    return Theme.crimson
}
