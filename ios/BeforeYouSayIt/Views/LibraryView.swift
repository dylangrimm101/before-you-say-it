import SwiftUI

struct LibraryView: View {
    @Environment(AppStore.self) private var store

    var body: some View {
        NavigationStack {
            ZStack {
                Backdrop(tint: Theme.mint)
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        EyebrowText("The library")
                        Text("Pick the conversation\nyou've been avoiding.")
                            .font(Theme.display(28))
                            .foregroundStyle(Theme.text)
                            .lineSpacing(5)
                            .padding(.top, 8)
                            .padding(.bottom, 26)

                        ForEach(ScenarioLibrary.categories) { category in
                            categorySection(category)
                        }
                    }
                    .padding(.horizontal, 22)
                    .padding(.bottom, 40)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Scenario.self) { scenario in
                ScenarioBriefView(scenario: scenario)
            }
        }
    }

    private func categorySection(_ category: Category) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                Circle().fill(category.accent).frame(width: 7, height: 7)
                EyebrowText(category.label, color: category.accent)
            }
            Text(category.blurb)
                .font(.system(size: 13))
                .foregroundStyle(Theme.dim)
                .padding(.bottom, 6)

            ForEach(ScenarioLibrary.scenariosFor(category.id)) { s in
                NavigationLink(value: s) {
                    HStack(spacing: 14) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(s.title)
                                .font(.system(size: 15.5, weight: .semibold))
                                .foregroundStyle(Theme.text)
                                .multilineTextAlignment(.leading)
                            Text(s.counterpart)
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.dim)
                        }
                        Spacer()
                        Text("\(s.minutes)m")
                            .font(.system(size: 12.5))
                            .foregroundStyle(Theme.dim)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.dim)
                    }
                    .padding(.vertical, 15)
                    .overlay(alignment: .bottom) {
                        Rectangle().fill(Theme.line).frame(height: 0.5)
                    }
                }
                .buttonStyle(PressableStyle())
            }
        }
        .padding(.bottom, 30)
    }
}
