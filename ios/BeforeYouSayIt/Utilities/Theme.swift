import SwiftUI

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

/**
 Before You Say It visual language: warm paper, ink type, clay accents —
 matched to beforeyousayit.app. Quiet, editorial, analog.
 */
enum Theme {
    static let bg = Color(hex: 0xF5EFE4)
    static let bgDeep = Color(hex: 0xEDE4D4)
    static let elevated = Color(hex: 0xFBF5E9)
    static let surface = Color(hex: 0xFFFDF7)
    static let surfaceHigh = Color(hex: 0xF2DFD6)
    static let line = Color(hex: 0x262119, alpha: 0.10)
    static let lineStrong = Color(hex: 0x262119, alpha: 0.20)
    static let text = Color(hex: 0x262119)
    static let textSoft = Color(hex: 0x514A3E)
    static let textDim = Color(hex: 0x746B5C)
    static let dim = Color(hex: 0x8A8172)
    static let ember = Color(hex: 0xA94F38)
    static let emberSoft = Color(hex: 0xA94F38, alpha: 0.10)
    static let mint = Color(hex: 0x5F7355)
    static let mintSoft = Color(hex: 0x5F7355, alpha: 0.12)
    static let amber = Color(hex: 0xB4832E)
    static let crimson = Color(hex: 0x843B2A)
    static let blue = Color(hex: 0x4F6C8F)
    /** Type/icons sitting on top of a filled accent surface. */
    static let onAccent = Color(hex: 0xFBF5E9)

    /** Serif display face matching the Expo app's Georgia titles. */
    static func display(_ size: CGFloat) -> Font {
        .custom("Georgia", size: size)
    }
}
