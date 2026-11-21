import Foundation
import UserNotifications

/// Posts one notification per note.
///
/// iOS has no notifications the user can't dismiss. The closest is a category with
/// `.customDismissAction`: iOS then tells the app (launching it in the background if needed)
/// when a notification is dismissed, and the note is posted again for as long as it exists.
/// The app also re-posts missing notes every time it comes to the foreground.
final class PinnedNotifier {
  static let shared = PinnedNotifier()
  static let categoryId = "pinned-note"

  let store = PinnedNoteStore()
  private let center = UNUserNotificationCenter.current()

  private init() {}

  func registerCategory() {
    let category = UNNotificationCategory(
      identifier: Self.categoryId,
      actions: [],
      intentIdentifiers: [],
      options: [.customDismissAction]
    )
    center.setNotificationCategories([category])
  }

  /// Makes Notification Center match `notes`: removes notifications of deleted notes and posts
  /// the notes that are new, changed, or missing.
  func sync(_ notes: [PinnedNote], completion: @escaping () -> Void) {
    let previous = Dictionary(store.all().map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    store.replaceAll(notes)
    let wanted = Set(notes.map(\.id))

    center.getDeliveredNotifications { delivered in
      let shown = Set(
        delivered
          .filter { $0.request.content.categoryIdentifier == Self.categoryId }
          .map(\.request.identifier)
      )
      let stale = Array(shown.union(previous.keys).subtracting(wanted))
      if !stale.isEmpty {
        self.center.removeDeliveredNotifications(withIdentifiers: stale)
        self.center.removePendingNotificationRequests(withIdentifiers: stale)
      }

      let group = DispatchGroup()
      for note in notes where previous[note.id] != note || !shown.contains(note.id) {
        group.enter()
        self.post(note) { group.leave() }
      }
      group.notify(queue: .main, execute: completion)
    }
  }

  /// The user dismissed `id`'s notification: bring it back if the note still exists.
  func onDismissed(id: String, completion: @escaping () -> Void) {
    guard let note = store.get(id) else {
      completion()
      return
    }
    post(note, completion: completion)
  }

  func permissionStatus(completion: @escaping (String) -> Void) {
    center.getNotificationSettings { settings in
      switch settings.authorizationStatus {
      case .notDetermined:
        completion("undetermined")
      case .denied:
        completion("denied")
      default:
        completion(settings.alertSetting == .disabled && settings.notificationCenterSetting == .disabled ? "denied" : "granted")
      }
    }
  }

  func requestPermission(completion: @escaping (String) -> Void) {
    center.requestAuthorization(options: [.alert]) { _, _ in
      self.permissionStatus(completion: completion)
    }
  }

  private func post(_ note: PinnedNote, completion: @escaping () -> Void) {
    registerCategory()

    let content = UNMutableNotificationContent()
    content.title = note.title
    content.body = note.body
    content.categoryIdentifier = Self.categoryId
    // Its own thread, so each note is a separate notification instead of one stack
    content.threadIdentifier = note.id
    content.userInfo = ["noteId": note.id]
    content.sound = nil
    // Passive: goes into Notification Center without lighting the screen or making a sound,
    // which matters because a dismissed note comes straight back.
    content.interruptionLevel = .passive

    let request = UNNotificationRequest(identifier: note.id, content: content, trigger: nil)
    center.add(request) { _ in completion() }
  }
}
