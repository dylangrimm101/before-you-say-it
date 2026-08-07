import Foundation
import Observation
import RevenueCat

/**
 RevenueCat wrapper: offerings, customer info and the "pro" entitlement.
 Test Store key drives DEBUG builds; the App Store key drives releases.
 */
@Observable
final class PurchasesStore {
    static let proEntitlement = "pro"

    private(set) var isPro: Bool = false
    private(set) var monthlyPackage: Package?
    private(set) var priceString: String = "$5.00"
    private(set) var isLoading: Bool = true
    private(set) var isPurchasing: Bool = false
    private(set) var isRestoring: Bool = false
    var notice: String = ""

    static func configure() {
        #if DEBUG
        let key = Config.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY
        #else
        let key = Config.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
        #endif
        guard !key.isEmpty else {
            print("[purchases] missing RevenueCat API key — paywall disabled")
            return
        }
        Purchases.configure(withAPIKey: key)
    }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let info = try await Purchases.shared.customerInfo()
            isPro = info.entitlements[Self.proEntitlement]?.isActive == true

            let offerings = try await Purchases.shared.offerings()
            let current = offerings.current
            let pkg = current?.monthly ?? current?.availablePackages.first
            monthlyPackage = pkg
            if let price = pkg?.storeProduct.localizedPriceString {
                priceString = price
            }
        } catch {
            print("[purchases] load failed: \(error.localizedDescription)")
        }
    }

    /** Purchase the monthly package. Returns true when pro unlocked. */
    func purchase() async -> Bool {
        guard let pkg = monthlyPackage, !isPurchasing else { return false }
        isPurchasing = true
        notice = ""
        defer { isPurchasing = false }
        do {
            let result = try await Purchases.shared.purchase(package: pkg)
            if result.userCancelled { return false }
            isPro = result.customerInfo.entitlements[Self.proEntitlement]?.isActive == true
            return isPro
        } catch {
            let nsError = error as NSError
            if nsError.code == ErrorCode.paymentPendingError.rawValue {
                notice = "Your payment is pending approval — access unlocks once it clears."
            } else {
                notice = "Something went wrong with the purchase. Please try again."
            }
            return false
        }
    }

    /** Restore previous purchases. Returns true when pro was restored. */
    func restore() async -> Bool {
        guard !isRestoring else { return false }
        isRestoring = true
        notice = ""
        defer { isRestoring = false }
        do {
            let info = try await Purchases.shared.restorePurchases()
            isPro = info.entitlements[Self.proEntitlement]?.isActive == true
            if !isPro { notice = "No previous subscription found for this account." }
            return isPro
        } catch {
            notice = "Couldn't restore purchases. Please try again."
            return false
        }
    }
}
