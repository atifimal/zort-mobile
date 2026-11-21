import Foundation

struct PinnedNote: Codable, Equatable {
  let id: String
  let title: String
  let body: String
  let url: String?
  let sortKey: Double
}

/// The notes that should currently be in Notification Center. Kept natively so a dismissed
/// notification can be put back while the app is launched in the background, before
/// React Native has started.
final class PinnedNoteStore {
  private let defaults = UserDefaults.standard
  private let key = "pinned_notifications.notes"
  private let lock = NSLock()

  func all() -> [PinnedNote] {
    lock.lock()
    defer { lock.unlock() }
    guard let data = defaults.data(forKey: key) else { return [] }
    return (try? JSONDecoder().decode([PinnedNote].self, from: data)) ?? []
  }

  func get(_ id: String) -> PinnedNote? {
    all().first { $0.id == id }
  }

  func replaceAll(_ notes: [PinnedNote]) {
    lock.lock()
    defer { lock.unlock() }
    if let data = try? JSONEncoder().encode(notes) {
      defaults.set(data, forKey: key)
    }
  }
}
