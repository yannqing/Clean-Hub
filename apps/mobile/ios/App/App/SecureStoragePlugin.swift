import Capacitor
import Security

@objc(SecureStoragePlugin)
public class SecureStoragePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecureStoragePlugin"
    public let jsName = "SecureStorage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]
    private let service = "com.cleanhub.app.credentials.v1"
    private var ready = true

    public override func load() {
        // Keychain survives uninstall. An installation without this sandbox
        // marker must not silently inherit the preceding user's session.
        let marker = "cleanhub.secure-storage.installed.v1"
        if !UserDefaults.standard.bool(forKey: marker) {
            let status = SecItemDelete([kSecClass: kSecClassGenericPassword, kSecAttrService: service] as CFDictionary)
            ready = status == errSecSuccess || status == errSecItemNotFound
            if !ready { CAPLog.print("SecureStorage initialization failed: \(status)") }
            if ready { UserDefaults.standard.set(true, forKey: marker) }
        }
    }

    private func query(_ call: CAPPluginCall) -> [CFString: Any]? {
        guard ready else {
            call.reject("Secure credential store is unavailable", "SECURE_STORAGE_UNAVAILABLE")
            return nil
        }
        guard let key = call.getString("key"), key.hasPrefix("cleanhub.mobile.") else {
            call.reject("Invalid credential key")
            return nil
        }
        return [kSecClass: kSecClassGenericPassword, kSecAttrService: service,
                kSecAttrAccount: key, kSecAttrSynchronizable: false]
    }

    @objc func get(_ call: CAPPluginCall) {
        guard var query = query(call) else { return }
        query[kSecReturnData] = true
        query[kSecMatchLimit] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            call.resolve(["value": NSNull()])
        } else if status == errSecSuccess, let data = result as? Data,
                  let value = String(data: data, encoding: .utf8) {
            call.resolve(["value": value])
        } else {
            call.reject("Secure credential read failed (\(status))", "SECURE_STORAGE_READ")
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let query = query(call) else { return }
        guard let value = call.getString("value") else {
            call.reject("Missing credential value")
            return
        }
        let attributes: [CFString: Any] = [
            kSecValueData: Data(value.utf8),
            kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        var status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            status = SecItemAdd(query.merging(attributes) { _, new in new } as CFDictionary, nil)
        }
        if status == errSecSuccess { call.resolve() }
        else { call.reject("Secure credential write failed", "SECURE_STORAGE_WRITE") }
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let query = query(call) else { return }
        let status = SecItemDelete(query as CFDictionary)
        if status == errSecSuccess || status == errSecItemNotFound { call.resolve() }
        else { call.reject("Secure credential removal failed", "SECURE_STORAGE_REMOVE") }
    }
}

@objc(MainViewController)
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SecureStoragePlugin())
    }
}
