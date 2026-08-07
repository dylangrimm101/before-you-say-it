import SwiftUI

struct PaywallView: View {
    @Environment(PurchasesStore.self) private var purchases
    @Environment(\.dismiss) private var dismiss

    private let perks: [(icon: String, text: String)] = [
        ("mic.fill", "Unlimited voice rehearsals with lifelike AI voices"),
        ("sparkles", "Scored debriefs on clarity, empathy & composure"),
        ("bolt.fill", "Daily 2-minute drills that keep your streak alive"),
        ("checkmark", "Custom scenarios built from your real situations"),
    ]

    var body: some View {
        ZStack {
            Backdrop(tint: Theme.ember)
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Spacer()
                        Button {
                            Haptics.tap()
                            dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.dim)
                                .frame(width: 36, height: 36)
                                .overlay(Circle().strokeBorder(Theme.line, lineWidth: 1))
                        }
                    }
                    .padding(.bottom, 6)

                    EyebrowText("Before You Say It Pro", color: Theme.ember)
                    Text("Walk in ready.\nEvery single time.")
                        .font(Theme.display(34))
                        .foregroundStyle(Theme.text)
                        .lineSpacing(6)
                        .padding(.top, 12)
                    Text("Rehearse the conversations that matter until the words come out the way you mean them.")
                        .font(.system(size: 15))
                        .foregroundStyle(Theme.textDim)
                        .lineSpacing(5)
                        .padding(.top, 14)

                    VStack(spacing: 16) {
                        ForEach(perks, id: \.text) { perk in
                            HStack(spacing: 14) {
                                Image(systemName: perk.icon)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Theme.ember)
                                    .frame(width: 34, height: 34)
                                    .background(Theme.emberSoft)
                                    .clipShape(Circle())
                                Text(perk.text)
                                    .font(.system(size: 14.5))
                                    .foregroundStyle(Theme.textSoft)
                                    .lineSpacing(4)
                                Spacer()
                            }
                        }
                    }
                    .padding(.top, 28)

                    Spacer(minLength: 30)

                    bottomSection
                }
                .padding(.horizontal, 24)
                .padding(.top, 14)
                .padding(.bottom, 28)
            }
        }
    }

    @ViewBuilder
    private var bottomSection: some View {
        if purchases.isPro {
            HStack(spacing: 9) {
                Image(systemName: "checkmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.mint)
                Text("You're on Pro — everything is unlocked.")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.mint)
            }
            .frame(maxWidth: .infinity)
            .padding(16)
            .background(Theme.mintSoft)
            .clipShape(.rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.mint.opacity(0.27), lineWidth: 1))
        } else if purchases.isLoading {
            HStack {
                Spacer()
                ProgressView().tint(Theme.ember)
                Spacer()
            }
            .padding(.vertical, 30)
        } else if purchases.monthlyPackage == nil {
            Text("Plans aren't available right now. You can continue and subscribe later.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.amber)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
        } else {
            VStack(spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Monthly")
                            .font(.system(size: 15.5, weight: .semibold))
                            .foregroundStyle(Theme.text)
                        Text("Cancel anytime")
                            .font(.system(size: 12.5))
                            .foregroundStyle(Theme.dim)
                    }
                    Spacer()
                    Text(purchases.priceString)
                        .font(Theme.display(26))
                        .foregroundStyle(Theme.text)
                    + Text(" /mo")
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.dim)
                }
                .padding(18)
                .background(Theme.ember.opacity(0.08))
                .clipShape(.rect(cornerRadius: 16))
                .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.ember.opacity(0.33), lineWidth: 1))

                if !purchases.notice.isEmpty {
                    Text(purchases.notice)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.amber)
                        .multilineTextAlignment(.center)
                }

                PrimaryButton(
                    title: purchases.isPurchasing ? "Processing…" : "Start Pro — \(purchases.priceString)/month",
                    disabled: purchases.isPurchasing
                ) {
                    Task {
                        if await purchases.purchase() {
                            Haptics.success()
                            dismiss()
                        }
                    }
                }

                Button {
                    Haptics.tap()
                    Task {
                        if await purchases.restore() {
                            Haptics.success()
                            dismiss()
                        }
                    }
                } label: {
                    Text(purchases.isRestoring ? "Restoring…" : "Restore purchases")
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.dim)
                }
                .padding(.vertical, 6)

                Text("Billed through the App Store. Renews monthly until cancelled.")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Theme.dim)
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
            }
        }
    }
}
