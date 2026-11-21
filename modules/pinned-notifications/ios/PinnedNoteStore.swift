import Foundation

struct PinnedNote: Codable, Equatable {
  let id: String
  let title: String
  let body: String
  let url: String?
  let sortKey: Double
  /// Shown from this time on (ms since 1970); nil: right away.
  let startsAt: Double?
  /// Shown until this time (ms since 1970); nil: until unpinned.
  let endsAt: Double?

  func isShown(at date: Date) -> Bool {
    let time = date.timeIntervalSince1970 * 1000
    return (startsAt.map { time >= $0 } ?? true) && (endsAt.map { time < $0 } ?? true)
  }

  func hasEnded(at date: Date) -> Bool {
    endsAt.map { date.timeIntervalSince1970 * 1000 >= $0 } ?? false
  }

  /// When the note is still to start, the moment it does.
  func startDate(after date: Date) -> Date? {
    guard let startsAt, startsAt > date.timeIntervalSince1970 * 1000 else { return nil }
    return Date(timeIntervalSince1970: startsAt / 1000)
  }
}

/// Unpin or Delete, tapped on a note's notification.
enum NoteAction: String, Codable {
  case unpin
  case delete
}

/// The pinned notes, and the actions taken on their notifications that the app hasn't applied
/// to its own data yet. Kept natively so notifications can be handled while the app is launched
/// in the background, before React Native has started. Actions are queued for the app rather
/// than written to its database: expo-sqlite bundles its own SQLite, and opening the same file
/// with the system's copy in the same process can corrupt it.
final class PinnedNoteStore {
  private let defaults = UserDefaults.standard
  private let notesKey = "pinned_notifications.notes"
  private let actionsKey = "pinned_notifications.pending_actions"
  private let lock = NSRecursiveLock()

  func all() -> [PinnedNote] {
    lock.lock()
    defer { lock.unlock() }
    guard let data = defaults.data(forKey: notesKey) else { return [] }
    return (try? JSONDecoder().decode([PinnedNote].self, from: data)) ?? []
  }

  func get(_ id: String) -> PinnedNote? {
    all().first { $0.id == id }
  }

  func replaceAll(_ notes: [PinnedNote]) {
    lock.lock()
    defer { lock.unlock() }
    if let data = try? JSONEncoder().encode(notes) {
      defaults.set(data, forKey: notesKey)
    }
  }

  func pendingActions() -> [String: NoteAction] {
    lock.lock()
    defer { lock.unlock() }
    guard let data = defaults.data(forKey: actionsKey) else { return [:] }
    return (try? JSONDecoder().decode([String: NoteAction].self, from: data)) ?? [:]
  }

  /// Takes the note out of the pinned list and queues `action` for the app.
  func record(_ action: NoteAction, for id: String) {
    lock.lock()
    defer { lock.unlock() }
    var actions = pendingActions()
    // Delete wins: a note that was unpinned and then deleted must end up deleted
    if actions[id] != .delete { actions[id] = action }
    replaceAll(all().filter { $0.id != id })
    save(actions)
  }

  func acknowledgeActions(_ ids: [String]) {
    lock.lock()
    defer { lock.unlock() }
    var actions = pendingActions()
    ids.forEach { actions.removeValue(forKey: $0) }
    save(actions)
  }

  private func save(_ actions: [String: NoteAction]) {
    if let data = try? JSONEncoder().encode(actions) {
      defaults.set(data, forKey: actionsKey)
    }
  }
}
