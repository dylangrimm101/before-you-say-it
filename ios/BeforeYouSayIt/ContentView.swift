import SwiftUI

struct ContentView: View {
    @Environment(AppStore.self) private var store
    @Environment(PurchasesStore.self) private var purchases

    var body: some View {
        Group {
            if store.profile == nil {
                OnboardingView()
            } else {
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: store.profile == nil)
        .task {
            await purchases.load()
        }
    }
}
