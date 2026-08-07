import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "sun.max.fill") }
            LibraryView()
                .tabItem { Label("Scenarios", systemImage: "rectangle.stack.fill") }
            ProgressTabView()
                .tabItem { Label("Progress", systemImage: "chart.line.uptrend.xyaxis") }
        }
        .toolbarBackground(Theme.bgDeep, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
    }
}
