import SwiftUI

@main
struct BeforeYouSayItApp: App {
    @State private var store = AppStore()
    @State private var purchases = PurchasesStore()

    init() {
        PurchasesStore.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(store)
                .environment(purchases)
                .preferredColorScheme(.dark)
                .tint(Theme.ember)
        }
    }
}
